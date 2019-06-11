"""

    rex.graphql.desc
    ================

    API for configuring GraphQL schemas.

    :copyright: 2019-present Prometheus Research, LLC

"""

import inspect
import abc
import functools

from rex.core import Error, cached

from . import code_location
from .param import Param
from .query import lift, Query as QueryCombinator, q


autoloc = code_location.autoloc


class Desc:
    pass


class Type(Desc):
    pass


class Field(Desc):
    pass


class ObjectLike(Type):
    def __init__(self, name, fields, description=None, loc=autoloc):
        if not callable(fields):
            raise Error("Argument 'fields' should be a function")

        self.loc = code_location.here() if loc is autoloc else loc
        self.name = name
        self._fields = fields
        self.description = description

    @property
    def fields(self):
        if callable(self._fields):
            seal(self)
        return self._fields

    def add_field(self, name, field):
        """ Add new field."""
        assert isinstance(field, Field)
        self.fields[name] = field


class Object(ObjectLike):
    """ Define an object type.

    Values of an object type are produced by :func:`compute` fields. The root
    type of a :func:`schema` is also an object type.
    """


class Record(ObjectLike):
    """ Define a record type.

    Values of a record type are produced by :func:`query` fields.

    If the result of a query is a row from a table it is more convenient to use
    :class:`Entity` type instead.
    """


class Entity(Record):
    """ Define an entity type.

    Values of a record type are produced by :func:`query` fields when the
    corresponding query results in a row of some table.
    """


class Compute(Field):
    """ Compute"""

    def __init__(
        self,
        type,
        f=None,
        params=None,
        description=None,
        deprecation_reason=None,
        loc=autoloc,
    ):
        if f is None:
            f = lambda parent, info, params: getattr(
                parent, info.field_name, None
            )

        if params is None:
            params = []

        self.loc = code_location.here() if loc is autoloc else loc
        self.type = type
        self.resolver = f
        self.params = {param.name: param for param in params}
        self.description = description
        self.deprecation_reason = deprecation_reason


class Query(Field):
    """ Query values from database."""

    def __init__(
        self,
        query,
        type=None,
        filters=None,
        description=None,
        deprecation_reason=None,
        paginate=False,
        loc=autoloc,
    ):

        # init params first so we can use self._add_param further
        self.params = {}

        query = lift(query)
        if query.params:
            for param in query.params.values():
                # As query argument value needs to be always available
                # (otherwise we can't construct the query) we mark it as
                # non-null in case it doesn't have default value specified.
                if (
                    isinstance(param, Argument)
                    and not isinstance(param.type, NonNull)
                    and param.default_value is None
                ):
                    param = param.with_type(NonNull(param.type))
                self._add_param(param)

        if paginate:
            self._add_param(
                argument(
                    name="offset",
                    type=scalar.Int,
                    default_value=0,
                    description="Fetch skipping this number of items",
                )
            )
            self._add_param(
                argument(
                    name="limit",
                    type=scalar.Int,
                    default_value=20,
                    description="Fetch only this number of items",
                )
            )

        self.filters = []
        if filters is not None:
            for filter in filters:
                self.add_filter(filter)

        self.loc = code_location.here() if loc is autoloc else loc
        self.query = query
        self.type = type
        self.description = description
        self.deprecation_reason = deprecation_reason
        self.paginate = paginate

    def _add_param(self, param):
        assert isinstance(param, Param)
        if param.name in self.params:
            if self.params[param.name] != param:
                # TODO: more info here
                raise Error("Inconsistent argument configuration:", param.name)
        else:
            self.params[param.name] = param

    def add_filter(self, filter):

        if not isinstance(filter, Filter):
            if isinstance(filter, QueryCombinator):
                filter = FilterOfQuery(query=filter)
            elif callable(filter):
                filter = filter_from_function(filter)
            else:
                raise Error("Invalid filter:", filter)

        for param in filter.params.values():
            self._add_param(param)

        self.filters.append(filter)


class Scalar(Type):
    def __init__(self, name, loc=autoloc):
        self.name = name
        self.loc = code_location.here() if loc is autoloc else loc


class ScalarTypeFactory:
    def __getattr__(self, name):
        return Scalar(name=name, loc=None)


scalar = ScalarTypeFactory()


class Enum(Type):
    def __init__(self, name, values, description=None, loc=autoloc):
        loc = code_location.here() if loc is autoloc else loc
        desc = f"While configuring enum '{name}':"
        with code_location.context(loc, desc=desc):
            # Do basic validation for enum value uniqueness.
            seen = {}
            for v in values:
                desc = f"While configuring enum value:"
                with code_location.context(v.loc, desc=desc):
                    prev = seen.get(v.name)
                    if prev:
                        raise Error(
                            "Enum value with the same name is already defined:",
                            prev.loc,
                        )
                    seen[v.name] = v

        self.loc = loc
        self.name = name
        self.values = values
        self.description = description


class EnumValue:
    def __init__(
        self, name, description=None, deprecation_reason=None, loc=autoloc
    ):
        self.loc = code_location.here() if loc is autoloc else loc
        self.name = name
        self.description = description
        self.deprecation_reason = deprecation_reason


class List(Type):
    def __init__(self, type):
        self.type = type


class NonNull(Type):
    def __init__(self, type):
        self.type = type


class Filter(abc.ABC):
    @abc.abstractproperty
    def params(self):
        """ Arguments which filter accepts."""

    @abc.abstractmethod
    def apply(self, query, values):
        """ Apply filter to query."""


class FilterOfFunction(Filter):
    def __init__(self, params, f):
        self._params = params
        self.f = f

    @property
    def params(self):
        return self._params

    def apply(self, query, values):
        kwargs = {}
        for name in self.params:
            # skip filter if some params are not defined
            if not name in values:
                return query
            kwargs[name] = values[name]
        for clause in self.f(**kwargs):
            query = query.filter(clause)
        return query


class FilterOfQuery(Filter):
    def __init__(self, query):
        self.query = query

    @property
    def params(self):
        return self.query.params

    def apply(self, query, values):
        for name in self.params:
            # skip filter if some params are not defined
            if not name in values:
                return query
        return query.filter(self.query)


def extract_params(f, mark_as_nonnull_if_no_default_value=False):
    sig = inspect.signature(f)
    params = {}
    for param in sig.parameters.values():
        name = param.name
        if isinstance(param.annotation, Param):
            params[name] = param.annotation
        else:
            if not isinstance(param.annotation, Type):
                raise Error(
                    f"Annotation for argument {name} should be GraphQL type"
                )
            type = param.annotation
            default_value = None
            if param.default is not inspect._empty:
                default_value = param.default
            else:
                if mark_as_nonnull_if_no_default_value:
                    type = NonNull(type)
            params[name] = argument(
                name=name, type=type, default_value=default_value
            )

    return_type = None
    if sig.return_annotation is not inspect._empty:
        return_type = sig.return_annotation

    return params, return_type


def filter_from_function(f):
    """ Decorator which allows to define a filter from a function.

    .. note::
        Filters defined using :func:`filter_from_function` are not being
        typechecked against database schema and therefore it is advised not to
        use it unless absolutely neccessary. Prefer to use filters-as-queries.
    """
    params, _ = extract_params(f)
    return FilterOfFunction(params=params, f=f)


def compute_from_function(**config):
    """ Decorator which allows to define a :func:`compute` field from a
    function.

    Annotations are used to define arguments and return type. If an argument has
    no default value then the type will be automatically marked as
    :class:`NonNull`.

    Example::

        @compute_from_function
        def add_numbers(x: scalar.Int, y: scalar.Int) -> scalar.Int:
            return x + y
    """
    def decorate(f):
        params, return_type = extract_params(
            f, mark_as_nonnull_if_no_default_value=True
        )

        if return_type is None:
            raise Error("Missing return annotation:", "def f(..) -> TYPE:")

        def run(parent, info, values):
            kwargs = {}
            for name in params:
                kwargs[name] = values[name]
            return f(**kwargs)

        return compute(
            params=params.values(), f=run, type=return_type, **config
        )

    return decorate


def connectiontype_name(entitytype):
    return f"{entitytype.name}_connection"


def connectiontype_uncached(entitytype, filters=None):

    by_id = q.id.text() == argument("id", NonNull(scalar.ID))
    return Record(
        name=connectiontype_name(entitytype),
        fields=lambda: {
            "get": query(
                q.entity.filter(by_id).first(),
                type=entitytype,
                description=f"Get {entitytype.name} by id",
                loc=None,
            ),
            "all": query(
                q.entity,
                type=entitytype,
                filters=filters,
                description=f"Get all {entitytype.name} items",
                loc=None,
            ),
            "paginated": query(
                q.entity,
                type=entitytype,
                filters=filters,
                paginate=True,
                description=f"Get all {entitytype.name} items (paginated)",
                loc=None,
            ),
            "count": query(
                q.entity.count(),
                description=f"Get the number of {entitytype.name} items",
                loc=None,
            ),
        },
        loc=None,
    )


connectiontype = cached(connectiontype_uncached)


def connect(type, query=None, filters=None, loc=autoloc):

    loc = code_location.here() if loc is autoloc else loc
    if query is None:
        query = q.navigate(type.name)
    return Query(
        query=q.define(entity=query),
        type=connectiontype(type),
        description=f"Connection to {type.name}",
        loc=loc,
    )


class Argument(Param):
    """ Param passed an GraphQL argument."""

    def __init__(
        self,
        name,
        type,
        default_value=None,
        description=None,
        out_name=None,
        loc=autoloc,
    ):
        self.loc = code_location.here() if loc is autoloc else loc
        self.name = name
        self.type = type
        self.default_value = default_value
        self.description = description
        self.out_name = out_name

    def with_type(self, type):
        return self.__class__(
            name=self.name,
            type=type,
            default_value=self.default_value,
            description=self.description,
            out_name=self.out_name,
            loc=self.loc,
        )

    def __eq__(self, o):
        return (
            self.__class__ == o.__class__
            and self.name == o.name
            and self.type == o.type
            and self.default_value == o.default_value
            and self.out_name == o.out_name
        )


class ComputedParam(Param):
    """ Param computed at runtime."""

    def __init__(self, name, type, compute):
        self.name = name
        self.type = type
        self.compute = compute

    def with_type(self, type):
        return self.__class__(name=self.name, type=type, compute=self.compute)

    def __eq__(self, o):
        return (
            self.__class__ == o.__class__
            and self.name == o.name
            and self.type == o.type
            and self.compute == o.compute
        )


@functools.singledispatch
def seal(descriptor):
    assert False, f"Do not know how to seal {descriptor!r}"


@seal.register(Object)
@seal.register(Record)
@seal.register(Entity)
def _(descriptor):
    if callable(descriptor._fields):
        descriptor._fields = descriptor._fields()
        for v in descriptor._fields.values():
            seal(v)


@seal.register(List)
@seal.register(NonNull)
def _(descriptor):
    seal(descriptor.type)


@seal.register(Enum)
@seal.register(Scalar)
def _(descriptor):
    pass


@seal.register(Compute)
@seal.register(Query)
def _(descriptor):
    if descriptor.type is not None:
        seal(descriptor.type)


#: Define a field which queries values from a database.
#:
#: Example::
#:
#:   schema(fields=lambda: {
#:      'regionCount': query(
#:        query=q.region.count(),
#:      )
#:   })
#:
#: In case query results in a scalar value (like the example above) rex.graphql
#: can infer result type automatically. Oherwise you need to specify it::
#:
#:   region = Entity(name="region", fields=lambda: { ... })
#:   schema(fields=lambda: {
#:      'regionCount': query(
#:        query=q.region,
#:        type=region,
#:      )
#:   })
#:
query = Query

#: Define a field which computes value at runtime.
#:
#: Example::
#:
#:   settings = Object(
#:     name='Settings',
#:     fields=lambda: {'title': compute(scalar.String)}
#:   )
#:
#:   def get_settings():
#:       return {'title': 'App'}
#:
#:   schema(fields=lambda: {
#:      'settings': compute(
#:        type=settings,
#:        f=get_settings
#:      )
#:   })
#:
#: By default :func:`compute` computes the value as ``getattr(parent, name)``
#: but ``f`` argument can be supplied instead.
#:
compute = Compute

#: Define a GraphQL argument.
argument = Argument

#: Define a parameter.
param = ComputedParam

#: Parameter which points to the parent object in GraphQL schema.
parent_param = ComputedParam(
    name="parent", type=None, compute=lambda parent, ctx: parent
)