#
# Copyright (c) 2013, Prometheus Research, LLC
#


import htsql.core.util
import weakref


class Image(object):
    # Mirrors a database object.

    __slots__ = ('owner',)

    def __init__(self, owner):
        self.owner = owner

    def remove(self):
        for cls in self.__class__.__mro__:
            if hasattr(cls, '__slots__'):
                for slot in cls.__slots__:
                    if not (slot.startswith('__') and slot.endswith('__')):
                        delattr(self, slot)

    def __unicode__(self):
        raise NotImplementedError()

    def __str__(self):
        return unicode(self).encode('utf-8')

    def __repr__(self):
        return "<%s %s>" % (self.__class__.__name__, self)


class NamedImage(Image):
    # Database object with a name.

    __slots__ = ('name',)

    max_name_length = 63

    def __init__(self, owner, name):
        assert len(name) <= self.max_name_length
        super(NamedImage, self).__init__(owner)
        self.name = name

    def __unicode__(self):
        return self.name

    def rename(self, name):
        self.name = name


class ImageMap(object):
    # Ordered collection of named database objects.

    __slots__ = ('_image_by_name', '_names')

    def __init__(self):
        self._image_by_name = {}
        self._names = []

    def __unicode__(self):
        return u"{%s}" % u", ".join(unicode(self._image_by_name[name])
                                    for name in self._names)

    def __str__(self):
        return unicode(self).encode('utf-8')

    def __repr__(self):
        return "<%s %s>" % (self.__class__.__name__, self)

    def __iter__(self):
        return (self._image_by_name[name] for name in self._names)

    def __len__(self):
        return len(self._names)

    def __nonzero__(self):
        return bool(self._names)

    def __contains__(self, name):
        return (name in self._image_by_name)

    def __getitem__(self, name):
        return self._image_by_name[name]

    def get(self, name, default=None):
        return self._image_by_name.get(name, default)

    def add(self, image):
        name = image.name
        if name in self._image_by_name:
            raise KeyError(name)
        self._image_by_name[name] = image
        self._names.append(name)

    def remove(self, image):
        name = image.name
        if name not in self._image_by_name:
            raise KeyError(name)
        del self._image_by_name[name]
        if name == self._names[-1]:
            self._names.pop()
        else:
            self._names.remove(name)

    def replace(self, name, image):
        if name not in self._image_by_name:
            raise KeyError(name)
        index = self._names.index(name)
        del self._image_by_name[name]
        name = image.name
        if name in self._image_by_name:
            raise KeyError(name)
        self._image_by_name[name] = image
        self._names[index] = name

    def first(self):
        if not self._names:
            raise KeyError()
        return self._image_by_name[self._names[0]]

    def last(self):
        if not self._names:
            raise KeyError()
        return self._image_by_name[self._names[-1]]


class CatalogImage(Image):
    # Database catalog.

    __slots__ = ('schemas', '__weakref__')

    def __init__(self):
        super(CatalogImage, self).__init__(weakref.ref(self))
        self.schemas = ImageMap()

    def __unicode__(self):
        return u"."

    def __contains__(self, name):
        return (name in self.schemas)

    def __getitem__(self, name):
        return self.schemas[name]

    def __iter__(self):
        return iter(self.schemas)

    def __len__(self):
        return len(self.schemas)

    def get(self, name, default=None):
        return self.schemas.get(name, default)

    def remove(self):
        while self.schemas:
            self.schemas.last().remove()
        super(CatalogImage, self).remove()

    def add_schema(self, name):
        return SchemaImage(self, name)


class SchemaImage(NamedImage):
    # Database schema.

    __slots__ = ('tables', 'types', '__weakref__')

    def __init__(self, catalog, name):
        super(SchemaImage, self).__init__(weakref.ref(catalog), name)
        self.tables = ImageMap()
        self.types = ImageMap()
        catalog.schemas.add(self)

    @property
    def catalog(self):
        return self.owner()

    def __contains__(self, name):
        return (name in self.tables)

    def __getitem__(self, name):
        return self.tables[name]

    def __iter__(self):
        return iter(self.tables)

    def __len__(self):
        return len(self.tables)

    def get(self, name, default=None):
        return self.tables.get(name, default)

    def rename(self, name):
        old_name = self.name
        self.name = name
        self.catalog.schemas.replace(old_name, self)
        return self

    def remove(self):
        while self.tables:
            self.tables.last().remove()
        while self.types:
            self.types().last().remove()
        super(SchemaImage, self).remove()

    def add_table(self, name):
        return TableImage(self, name)

    def add_type(self, name):
        return TypeImage(self, name)

    def add_domain_type(self, name):
        return DomainTypeImage(self, name, base_type)

    def add_enum_type(self, name, labels):
        return EnumTypeImage(self, name, labels)


class TypeImage(NamedImage):
    # Type.

    __slots__ = ()

    def __init__(self, schema, name):
        super(TypeImage, self).__init__(weakref.ref(schema), name)
        schema.types.add(self)

    @property
    def schema(self):
        return self.owner()

    @property
    def columns(self):
        return [column for schema in self.schema.catalog
                       for table in schema
                       for column in table
                       if column.type is self]

    @property
    def domains(self):
        return [type for schema in self.schema.catalog
                     for type in schema.types
                     if isinstance(type, DomainTypeImage) and
                        type.base_type is self]

    def rename(self, name):
        old_name = self.name
        self.name = name
        self.catalog.types.replace(old_name, self)
        return self

    def remove(self):
        for column in self.columns:
            column.remove()
        for domain in self.domains:
            domain.remove()
        super(self, TypeImage).remove()


class DomainTypeImage(TypeImage):
    # Domain type.

    __slots__ = ('base_type',)

    def __init__(self, schema, name, base_type):
        super(DomainTypeImage, self).__init__(schema, name)
        self.base_type = base_type


class EnumTypeImage(TypeImage):
    # `ENUM` type.

    __slots__ = ('labels',)

    def __init__(self, schema, name, labels):
        super(EnumTypeImage, self).__init__(schema, name)
        self.labels = labels


class TableImage(NamedImage):
    # Database table.

    __slots__ = ('columns', 'constraints', 'primary_key', 'unique_keys',
                 'foreign_keys', 'referring_foreign_keys', '__weakref__')

    def __init__(self, schema, name):
        super(TableImage, self).__init__(weakref.ref(schema), name)
        self.columns = ImageMap()
        self.constraints = ImageMap()
        self.primary_key = None
        self.unique_keys = []
        self.foreign_keys = []
        self.referring_foreign_keys = []
        schema.tables.add(self)

    @property
    def schema(self):
        return self.owner()

    def __contains__(self, name):
        return (name in self.columns)

    def __getitem__(self, name):
        return self.columns[name]

    def __iter__(self):
        return iter(self.columns)

    def __len__(self):
        return len(self.columns)

    def get(self, name, default=None):
        return self.columns.get(name, default)

    def rename(self, name):
        old_name = self.name
        self.name = name
        self.schema.tables.replace(old_name, self)
        return self

    def remove(self):
        while self.constraints:
            self.constraints.last().remove()
        while self.columns:
            self.columns.last().remove()
        super(TableImage, self).remove()

    def add_column(self, name, type, is_nullable):
        return ColumnImage(self, name, type, is_nullable)

    def add_constraint(self, name):
        return ConstraintImage(self, name)

    def add_unique_key(self, name, columns, is_primary=False):
        return UniqueKeyImage(self, name, columns, is_primary)

    def add_primary_key(self, name, columns):
        return UniqueKeyImage(self, name, columns, True)

    def add_foreign_key(self, name, columns, target, target_columns):
        return ForeignKeyImage(self, name, columns, target, target_columns)


class ColumnImage(NamedImage):
    # Database column.

    __slots__ = ('type', 'is_nullable', '__weakref__')

    def __init__(self, table, name, type, is_nullable):
        super(ColumnImage, self).__init__(weakref.ref(table), name)
        table.columns.add(self)
        self.type = type
        self.is_nullable = is_nullable

    @property
    def table(self):
        return self.owner()

    @property
    def unique_keys(self):
        return [unique_key
                for unique_key in self.table.unique_keys
                if self in unique_key.origin_columns]

    @property
    def foreign_keys(self):
        return [foreign_key
                for foreign_key in self.table.foreign_keys
                if self in foreign_key.origin_columns]

    @property
    def referring_foreign_keys(self):
        return [foreign_key
                for foreign_key in self.table.referring_foreign_keys
                if self in foreign_key.target_columns]

    def rename(self, name):
        old_name = self.name
        self.name = name
        self.table.columns.replace(old_name, self)
        return self

    def set_type(self, type):
        self.type = type
        return self

    def set_is_nullable(self, is_nullable):
        self.is_nullable = is_nullable
        return self

    def remove(self):
        for unique_key in self.unique_keys:
            unique_key.remove()
        for foreign_key in self.foreign_keys:
            foreign_key.remove()
        for foreign_key in self.referring_foreign_keys:
            foreign_key.remove()
        self.table.columns.remove(self)
        super(ColumnImage, self).remove()


class ConstraintImage(NamedImage):
    # Table constraint.

    __slots__ = ()

    def __init__(self, origin, name):
        super(ConstraintImage, self).__init__(weakref.ref(origin), name)
        origin.constraints.add(self)

    @property
    def origin(self):
        return self.owner()

    def rename(self, name):
        old_name = self.name
        self.name = name
        self.origin.constraints.replace(old_name, self)
        return self

    def remove(self):
        self.table.constraints.remove(self)
        super(ConstraintImage, self).remove()


class UniqueKeyImage(ConstraintImage):
    # `UNIQUE`/`PRIMARY KEY` constraint.

    __slots__ = ('origin_columns', 'is_primary')

    def __init__(self, origin, name, origin_columns, is_primary):
        super(UniqueKeyImage, self).__init__(origin, name)
        self.origin_columns = origin_columns
        self.is_primary = is_primary
        if is_primary:
            assert origin.primary_key is None
            origin.primary_key = self
        origin.unique_keys.append(self)

    def __contains__(self, column):
        return (column in self.origin_columns)

    def __getitem__(self, index):
        return self.origin_columns[index]

    def __iter__(self):
        return iter(self.origin_columns)

    def __len__(self):
        return len(self.origin_columns)

    def remove(self):
        self.origin.unique_keys.remove(self)
        if self.is_primary:
            self.origin.primary_key = None
        super(UniqueKeyImage, self).remove()


class ForeignKeyImage(ConstraintImage):
    # Foreign key constraint.

    __slots__ = ('origin_columns', 'coowner', 'target_columns')

    def __init__(self, origin, name, origin_columns, target, target_columns):
        super(ForeignKeyImage, self).__init__(origin, name)
        self.origin_columns = origin_columns
        self.coowner = weakref.ref(target)
        self.target_columns = target_columns
        origin.foreign_keys.append(self)
        target.referring_foreign_keys.append(self)

    @property
    def target(self):
        return self.coowner()

    def __contains__(self, column_pair):
        return (column_pair in zip(self.origin_columns, self.target_columns))

    def __getitem__(self, index):
        return (self.origin_columns[index], self.target_columns[index])

    def __iter__(self):
        return iter(zip(self.origin_columns, self.target_columns))

    def __len__(self):
        return len(self.origin_columns)

    def remove(self):
        self.origin.foreign_keys.remove(self)
        self.target.referring_foreign_keys.remove(self)
        super(ForeignKeyImage, self).remove()


