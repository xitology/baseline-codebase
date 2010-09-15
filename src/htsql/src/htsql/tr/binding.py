#
# Copyright (c) 2006-2010, Prometheus Research, LLC
# Authors: Clark C. Evans <cce@clarkevans.com>,
#          Kirill Simonov <xi@resolvent.net>
#


"""
:mod:`htsql.tr.binding`
=======================

This module declares binding nodes.
"""


from ..util import maybe, listof, Node
from ..entity import TableEntity, ColumnEntity, Join
from ..domain import Domain, VoidDomain, BooleanDomain, TupleDomain
from .syntax import Syntax
from .coerce import coerce


class Binding(Node):
    """
    Represents a binding node.

    This is an abstract class; see subclasses for concrete binding nodes.

    A binding tree (technically, a DAG) is an intermediate stage of the HTSQL
    translator.  A binding tree is translated from the syntax tree by the
    *binding* process.  A binding tree is translated to a code tree by the
    *encoding* process.

    The following adapters are associated with the binding process and generate
    new binding nodes::

        Bind: (Syntax, BindState) -> Binding, ...
        Lookup: (Binding, IdentifierSyntax) -> Binding

    See :class:`htsql.tr.bind.Bind` and :class:`htsql.tr.lookup.Lookup` for
    more details.

    The following adapters are associated with the encoding process and
    convert binding nodes to code and space nodes::

        Encode: (Binding, EncodeState) -> Code
        Relate: (Binding, EncodeState) -> Space

    See :class:`htsql.tr.encode.Encode` and :class:`htsql.tr.encode.Relate`
    for more details.

    The constructor arguments:

    `domain` (:class:`htsql.domain.Domain`)
        The type of the binding node; use :class:`htsql.domain.VoidDomain`
        instance when not applicable.

    `syntax` (:class:`htsql.tr.syntax.Syntax`)
        The syntax node that generated the binding node; should be used
        for presentation or error reporting only, there is no guarantee
        that that the syntax node is semantically, or even syntaxically
        valid.

    Other attributes:

    `mark` (:class:`htsql.mark.Mark`)
        The location of the node in the original query (for error reporting).
    """

    def __init__(self, domain, syntax):
        assert isinstance(domain, Domain)
        assert isinstance(syntax, Syntax)

        self.domain = domain
        self.syntax = syntax
        self.mark = syntax.mark

    def __str__(self):
        # Display an HTSQL expression (approximately) corresponding
        # to the binding node.
        return str(self.syntax)


class ChainBinding(Binding):
    """
    Represents a link binding node.

    Each link binding has an associated `base` parent node.  The base node
    specifies the context of the node; the meaning of the context depends
    on the concrete binding type.
    
    Chain bindings together with their bases form a subtree (or a forest)
    in the binding graph.

    Chain bindings are typically (but not always) generated by the lookup
    adapter; that is, `Lookup` applied to a base node generates a link
    binding with the given base.

    Chaing bindings are often expected to correspond to some space nodes;
    therefore they should have a non-trivial implementation of the `Relate`
    adapter.

    Constructor arguments:

    `base` (:class:`Binding`)
        The link context.
    """

    def __init__(self, base, domain, syntax):
        assert isinstance(base, Binding)
        super(ChainBinding, self).__init__(domain, syntax)
        self.base = base


class RootBinding(ChainBinding):
    """
    Represents a root link binding.

    The root binding represents a scalar context in the binding tree.
    `Lookup` over a root binding is a table lookup; `Relate` over
    a root binding produces the scalar space.

    For a root link binding, the `base` refers to the binding itself.
    """

    def __init__(self, syntax):
        # Note: `self.base is self` for the root binding.
        super(RootBinding, self).__init__(self, VoidDomain(), syntax)


class TableBinding(ChainBinding):
    """
    Represents a table link binding.

    This is an abstract class; see :class:`FreeTableBinding` and
    :class:`JoinedTableBinding` for concrete subclasses.

    A table binding represents a table context; `Lookup` over a table
    binding looks for columns and links; `Relate` over a table binding
    produces a table space.

    Note that a table binding has a special domain
    :class:`htsql.domain.TupleDomain`.

    `table` (:class:`htsql.entity.TableEntity`)
        The table which the binding is associated with.
    """

    def __init__(self, base, table, syntax):
        assert isinstance(table, TableEntity)
        super(TableBinding, self).__init__(base, TupleDomain(), syntax)
        self.table = table


class FreeTableBinding(TableBinding):
    """
    Represents a free table binding.

    A free table represents a table cross joined to its base.
    """


class JoinedTableBinding(TableBinding):
    """
    Represents a joined table binding.

    A joined table is attached to its base using a sequence of joins.

    `joins` (a list of :class:`htsql.entity.Join`)
        A sequence of joins that attach the table to its base.
    """

    def __init__(self, base, table, joins, syntax):
        assert isinstance(joins, listof(Join)) and len(joins) > 0
        super(JoinedTableBinding, self).__init__(base, table, syntax)
        self.joins = joins


class SieveBinding(ChainBinding):
    """
    Represents a sieve binding.

    A sieve applies a filter to the base binding.

    `filter` (:class:`Binding`)
        A Boolean expression that filters the base.
    """

    def __init__(self, base, filter, syntax):
        assert isinstance(filter, Binding)
        assert isinstance(filter.domain, BooleanDomain)
        super(SieveBinding, self).__init__(base, TupleDomain(), syntax)
        self.filter = filter


class SortBinding(ChainBinding):
    """
    Represents a sort table expression.

    A sort binding specifies the order of the `base` rows.  It could also
    extract a subset of the rows.

    `order` (a list of :class:`Binding`)
        The expressions by which the base rows are sorted.

    `limit` (an integer or ``None``)
        If set, indicates that only the first `limit` rows are produced
        (``None`` means no limit).

    `offset` (an integer or ``None``)
        If set, indicates that only the rows starting from `offset`-th
        are produced (``None`` means ``0``).
    """

    def __init__(self, base, order, limit, offset, syntax):
        assert isinstance(order, listof(Binding))
        assert isinstance(limit, maybe(int))
        assert isinstance(offset, maybe(int))
        super(SortBinding, self).__init__(base, base.domain, syntax)
        self.order = order
        self.limit = limit
        self.offset = offset


class ColumnBinding(ChainBinding):
    """
    Represents a table column.

    `column` (:class:`htsql.entity.ColumnEntity`)
        The column entity.

    `link` (:class:`JoinedTableBinding` or ``None``)
        If set, indicates that the binding could also represent a link
        to another table.  Any `Lookup` or `Relate` requests applied
        to the column binding are delegated to `link`.
    """

    def __init__(self, base, column, link, syntax):
        assert isinstance(column, ColumnEntity)
        assert isinstance(link, maybe(JoinedTableBinding))
        super(ColumnBinding, self).__init__(base, column.domain, syntax)
        self.column = column
        # FIXME: this is a hack to permit reparenting of a column binding.
        # It is used when `Lookup` delegates the request to a base binding
        # and then reparents the result.  Fixing this may require passing
        # the expected base together with any `Lookup` request.
        if link is not None and link.base is not base:
            link = link.clone(base=base)
        self.link = link


class QueryBinding(Binding):
    """
    Represents the whole HTSQL query.

    `root` (:class:`RootBinding`)
        The root binding associated with the query.

    `segment` (:class:`SegmentBinding` or ``None``)
        The query segment.
    """

    def __init__(self, root, segment, syntax):
        assert isinstance(root, RootBinding)
        assert isinstance(segment, maybe(SegmentBinding))
        super(QueryBinding, self).__init__(VoidDomain(), syntax)
        self.root = root
        self.segment = segment


class SegmentBinding(Binding):
    """
    Represents a segment of an HTSQL query.

    `base` (:class:`Binding`)
        The base of the segment.

    `elements` (a list of :class:`Binding`)
        The segment elements.
    """

    def __init__(self, base, elements, syntax):
        assert isinstance(base, Binding)
        assert isinstance(elements, listof(Binding))
        super(SegmentBinding, self).__init__(VoidDomain(), syntax)
        self.base = base
        self.elements = elements


class LiteralBinding(Binding):
    """
    Represents a literal value.

    `value` (valid type depends on the domain)
        The value.

    `domain` (:class:`htsql.domain.Domain`)
        The value type.
    """

    def __init__(self, value, domain, syntax):
        # FIXME: It appears `domain` is always `UntypedDomain()`.
        # Hard-code the domain value then?
        super(LiteralBinding, self).__init__(domain, syntax)
        self.value = value


class EqualityBindingBase(Binding):
    """
    Represents an equality operator.

    This is an abstract class for the ``=`` and ``==`` operators.

    `lop` (:class:`Binding`)
        The left operand.

    `rop` (:class:`Binding`)
        The right operand.
    """

    def __init__(self, lop, rop, syntax):
        assert isinstance(lop, Binding)
        assert isinstance(rop, Binding)
        # We want to use an engine-specific Boolean type, which, we assume,
        # must always exist.
        domain = coerce(BooleanDomain())
        assert domain is not None
        super(EqualityBindingBase, self).__init__(domain, syntax)
        self.lop = lop
        self.rop = rop


class EqualityBinding(EqualityBindingBase):
    """
    Represents the "equality" (``=``) operator.

    The regular "equality" operator treats ``NULL`` as a special value:
    if any of the arguments is ``NULL``, the result is also ``NULL``.
    """


class TotalEqualityBinding(EqualityBindingBase):
    """
    Represents the "total equality" (``==``) operator.

    The "total equality" operator treats ``NULL`` as a regular value.
    """


class ConnectiveBindingBase(Binding):
    """
    Represents an N-ary logical connective.

    This is an abstract class for "AND" (``&``) and "OR" (``|``) operators.

    `ops` (a list of :class:`Binding`)
        The operands.
    """

    def __init__(self, ops, syntax):
        assert isinstance(ops, listof(Binding))
        # Use the engine-specific Boolean type, which, we assume,
        # must always exist.
        domain = coerce(BooleanDomain())
        assert domain is not None
        super(ConnectiveBindingBase, self).__init__(domain, syntax)
        self.ops = ops



class ConjunctionBinding(ConnectiveBindingBase):
    """
    Represents the logical "AND" (``&``) operator.
    """


class DisjunctionBinding(ConnectiveBindingBase):
    """
    Represents the logical "OR" (``|``) operator.
    """


class NegationBinding(Binding):
    """
    Represents the logical "NOT" (``!``) operator.

    `op` (:class:`Binding`)
        The operand.
    """

    def __init__(self, op, syntax):
        assert isinstance(op, Binding)
        # Use the engine-specific Boolean type, which, we assume,
        # must always exist.
        domain = coerce(BooleanDomain())
        assert domain is not None
        super(NegationBinding, self).__init__(domain, syntax)
        self.op = op


class CastBinding(Binding):
    """
    Represents a type conversion operator.

    `op` (:class:`Binding`)
        The operand to convert.

    `domain` (:class:`htsql.domain.Domain`)
        The target domain.
    """

    def __init__(self, op, domain, syntax):
        super(CastBinding, self).__init__(domain, syntax)
        self.op = op


class FunctionBinding(Binding):
    """
    Represents a function or an operator binding.

    This is an abstract class; see subclasses for concrete functions and
    operators.

    `domain` (:class:`Domain`)
        The type of the result.

    `arguments` (a dictionary)
        A mapping from argument names to values.
    """

    def __init__(self, domain, syntax, **arguments):
        super(FunctionBinding, self).__init__(domain, syntax)
        self.arguments = arguments
        for key in arguments:
            setattr(self, key, arguments[key])


class WrapperBinding(Binding):
    """
    Represents a decorating binding.

    This class has several subclasses, but could also be used directly
    when the only purpose of decorating is attaching a different syntax node.

    A decorating binding adds extra attributes to the base binding,
    but does not affect the encoding or lookup operations.

    `base` (:class:`Binding`)
        The decorated binding.
    """

    def __init__(self, base, syntax):
        super(WrapperBinding, self).__init__(base.domain, syntax)
        self.base = base


class OrderBinding(WrapperBinding):
    """
    Represents an order decorator (postfix ``+`` and ``-`` operators).

    `base` (:class:`Binding`)
        The decorated binding.

    `dir` (``+1`` or ``-1``).
        Indicates the direction; ``+1`` for ascending, ``-1`` for descending.
    """

    def __init__(self, base, dir, syntax):
        assert dir in [-1, +1]
        super(OrderBinding, self).__init__(base, syntax)
        self.dir = dir


class TitleBinding(WrapperBinding):
    """
    Represents a title decorator (the ``as`` operator).

    The title decorator is used to specify the column title explicitly
    (by default, a serialized syntax node is used as the title).

    `base` (:class:`Binding`)
        The decorated binding.

    `title` (a string)
        The title.
    """

    def __init__(self, base, title, syntax):
        assert isinstance(title, str)
        super(TitleBinding, self).__init__(base, syntax)
        self.title = title


class FormatBinding(WrapperBinding):
    """
    Represents a format decorator (the ``format`` operator).

    The format decorator is used to provide hints to the renderer
    as to how display column values.  How the format is interpreted
    by the renderer depends on the renderer and the type of the column.

    `base` (:class:`Binding`)
        The decorated binding.

    `format` (a string)
        The formatting hint.
    """

    def __init__(self, base, format, syntax):
        assert isinstance(format, str)
        super(FormatBinding, self).__init__(base, syntax)
        self.format = format


