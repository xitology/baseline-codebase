"""

    rex.graphql.reflect
    ===================

    Reflect database schema into GraphQL schema.

    :copyright: 2019-present Prometheus Research, LLC

"""

from cached_property import cached_property
from rex.db import get_db
from htsql.core.tr.lookup import prescribe, unwrap
from htsql.core.tr.bind import BindingState
from htsql.core.tr.binding import (
    RootBinding,
    LocateBinding,
    ClipBinding,
    SelectionBinding,
    TableBinding,
)
from htsql.core.syn.syntax import VoidSyntax
from htsql.core import domain
from htsql.core.model import (
    HomeNode,
    DomainNode,
    TableArc,
    ChainArc,
    ColumnArc,
    SyntaxArc,
    InvalidArc,
)
from htsql.core.classify import classify, localize, relabel

from . import desc, introspection, model, model_scalar, schema
from .query import query as q


def type_from_domain(dom: domain.Domain):
    if isinstance(dom, domain.BooleanDomain):
        return desc.scalar.Boolean
    elif isinstance(dom, domain.FloatDomain):
        return desc.scalar.Float
    elif isinstance(dom, domain.IntegerDomain):
        return desc.scalar.Int
    elif isinstance(dom, domain.TextDomain):
        return desc.scalar.String
    elif isinstance(dom, domain.DateDomain):
        return desc.scalar.Date
    elif isinstance(dom, domain.DateTimeDomain):
        return desc.scalar.Datetime
    elif isinstance(dom, domain.DecimalDomain):
        return desc.scalar.Decimal
    else:
        # TODO: support enums!
        return None


eq_domain_types = {
    domain.TextDomain,
    domain.FloatDomain,
    domain.IntegerDomain,
    domain.DateDomain,
    domain.DateTimeDomain,
    domain.DecimalDomain,
    domain.EnumDomain,
}

range_domain_types = {
    domain.FloatDomain,
    domain.IntegerDomain,
    domain.DateDomain,
    domain.DateTimeDomain,
    domain.DecimalDomain,
}


class EqFilter(desc.Filter):
    def __init__(self, arg, query):
        self.arg = arg
        self.query = query

    @property
    def params(self):
        return {self.arg.name: self.arg}

    def apply(self, query, values):
        if self.arg.name not in values:
            return query
        v = values[self.arg.name]
        return query.filter(self.query == v)


class Reflect:
    def __init__(
        self,
        db=None,
        include_tables=None,
        exclude_tables=None,
        disable_filter_reflecton=False,
    ):
        self.types = {}
        self.fields = {}
        self._extra_fields = {}
        self._db = db
        self.include_tables = include_tables
        self.exclude_tables = exclude_tables
        self.disable_filter_reflecton = disable_filter_reflecton

        with self.db:
            self._reflect()

    @cached_property
    def db(self):
        return self._db if self._db is not None else get_db()

    def is_table_allowed(self, table):
        if self.include_tables is not None:
            if table.name not in self.include_tables:
                return False
        if self.exclude_tables is not None:
            if table.name in self.exclude_tables:
                return False
        return True

    def _reflect_fields(self, arc):
        def fields():
            # Binding state is going to be used to type SyntaxArc.
            state = BindingState(RootBinding(VoidSyntax()))
            recipe = prescribe(arc, state.scope)
            table_binding = state.use(recipe, state.scope.syntax)
            state.push_scope(table_binding)

            fields = {}
            for label in classify(arc.target):
                query = q.navigate(label.name)
                if isinstance(label.arc, ColumnArc):
                    fields[label.name] = desc.query(query, loc=None)
                elif isinstance(label.arc, SyntaxArc):

                    # Probe the kind of output
                    probe = state.bind(label.arc.syntax)
                    while isinstance(probe, (LocateBinding, ClipBinding)):
                        probe = probe.seed
                    selection_binding = unwrap(
                        probe, SelectionBinding, is_deep=True
                    )
                    table_binding = unwrap(probe, TableBinding, is_deep=True)

                    fieldtype = None
                    if selection_binding is not None:
                        # This will be handled by rex.graphql.model code later
                        # and raise an error.
                        pass
                    elif table_binding is not None:
                        fieldtype = self.types[table_binding.table.name]
                    else:
                        # This is likely a column, the type will be inferred by
                        # rex.graphql.model later.
                        pass

                    fields[label.name] = desc.query(
                        query, type=fieldtype, loc=None
                    )
                elif isinstance(label.arc, ChainArc):
                    table = label.arc.target.table
                    if not self.is_table_allowed(table):
                        continue
                    is_connection = all(
                        join.is_reverse and not join.is_contracting
                        for join in label.arc.joins
                    )
                    if is_connection:
                        fields[label.name] = self._reflect_connection(
                            label.arc, query
                        )
                    else:
                        fieldtype = self.types[table.name]
                        fields[label.name] = desc.query(
                            query, type=fieldtype, loc=None
                        )
                elif isinstance(label.arc, InvalidArc):
                    # TODO: Print a warning
                    continue
                else:
                    # TODO: Print a warning
                    continue
            return fields

        return fields

    def _reflect_filters(self, query, fieldtype, node):
        for label in classify(node):
            if not isinstance(label.target, DomainNode):
                continue
            domain_type = type(label.target.domain)
            arg_type = type_from_domain(label.target.domain)
            arg_query = q.navigate(label.name)
            if not arg_type:
                continue
            if domain_type in eq_domain_types:
                # Add "column__eq" filter
                arg = desc.argument(
                    f"{label.name}__eq",
                    desc.List(arg_type),
                    loc=None,
                    description=f"Filter by {label.name} being equal to",
                )
                yield EqFilter(arg, arg_query)

            if domain_type in range_domain_types:
                # Add "column__lt" filter
                arg = desc.argument(
                    f"{label.name}__lt",
                    arg_type,
                    loc=None,
                    description=f"Filter by {label.name} being less than to",
                )
                yield arg_query < arg
                # Add "column__le" filter
                arg = desc.argument(
                    f"{label.name}__le",
                    arg_type,
                    description=f"Filter by {label.name} being less than or equal to",
                )
                yield arg_query <= arg
                # Add "column__gt" filter
                arg = desc.argument(
                    f"{label.name}__gt",
                    arg_type,
                    description=f"Filter by {label.name} being greater than to",
                )
                yield arg_query > arg
                # Add "column__ge" filter
                arg = desc.argument(
                    f"{label.name}__ge",
                    arg_type,
                    description=f"Filter by {label.name} being greater than or equal to",
                )
                yield arg_query >= arg

    def _reflect_connection(self, arc, query):
        table = arc.target.table

        # Get entitytype for the table
        entitytype = self.types.get(table.name)
        if entitytype is None:
            entitytype = desc.Entity(
                name=table.name, fields=self._reflect_fields(arc), loc=None
            )
            self.types[table.name] = entitytype

        # Get connectiontype for the entitytype
        connectiontype_name = desc.connectiontype_name(entitytype)
        connectiontype = self.types.get(connectiontype_name)
        if connectiontype is None:
            filters = []
            if not self.disable_filter_reflecton:
                filters = list(
                    self._reflect_filters(
                        query=query, fieldtype=entitytype, node=arc.target
                    )
                )

            connectiontype = desc.connectiontype_uncached(
                entitytype, filters=filters
            )
            self.types[connectiontype_name] = connectiontype

        return desc.query(
            query=q.define(entity=query),
            type=connectiontype,
            description="Connection to {entitytype.name}",
            loc=None,
        )

    def _reflect(self):
        for label in classify(HomeNode()):
            if not isinstance(label.arc, TableArc):
                continue
            arc = label.arc
            query = q.navigate(label.name)
            if not self.is_table_allowed(arc.target.table):
                continue
            self.fields[label.name] = self._reflect_connection(arc, query)
        # Seal all fields so all reflection code runs here
        for field in self.fields.values():
            desc.seal(field)

    def add_field(self, name, field):
        self._extra_fields[name] = field

    def to_schema(self):
        fields = lambda: {**self.fields, **self._extra_fields}
        return schema(fields=fields, db=self.db, loc=None)


reflect = Reflect