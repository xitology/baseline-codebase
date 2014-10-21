#
# Copyright (c) 2013, Prometheus Research, LLC
#


from rex.core import (Error, AnyVal, BoolVal, UStrVal, UChoiceVal, SeqVal,
        OneOrSeqVal, UnionVal, OnSeq)
from .fact import Fact, LabelVal, QLabelVal, TitleVal, label_to_title
from .meta import uncomment
from .recover import recover
from .sql import mangle, sql_value
from htsql.core.domain import (UntypedDomain, BooleanDomain, IntegerDomain,
        DecimalDomain, FloatDomain, TextDomain, DateDomain, TimeDomain,
        DateTimeDomain, EnumDomain)
import datetime


class ColumnFact(Fact):
    """
    Describes a table column.

    `table_label`: ``unicode``
        Table name.
    `label`: ``unicode``
        The name of the column.
    `type`: *type name* or [``unicode``]
        The type of the column; one of: *boolean*, *integer*,
        *decimal*, *float*, *text*, *date*, *time*, *datetime*.
        For an ``ENUM`` type, specify a list of ``ENUM`` labels.
    `default`: literal value compatible with the column type
        Column default value.
    `former_labels`: [``unicode``]
        Names that the column may had in the past.
    `is_required`: ``bool``
        Indicates if ``NULL`` values are not allowed.
    `is_unique`: ``bool``
        Indicates that each value must be unique across all rows in the table.
    `title`: ``unicode`` or ``None``
        The title of the column.  If not set, generated from the label.
    `is_present`: ``bool``
        Indicates whether the column exists.
    """

    # HTSQL name -> SQL name.
    TYPE_MAP = {
            u"boolean": u"bool",
            u"integer": u"int4",
            u"decimal": u"numeric",
            u"float": u"float8",
            u"text": u"text",
            u"date": u"date",
            u"time": u"time",
            u"datetime": u"timestamp",
    }

    # SQL type name -> HTSQL name.
    REVERSE_TYPE_MAP = dict((sql_name, htsql_name)
                            for htsql_name, sql_name in TYPE_MAP.items())

    # HTSQL name -> HTSQL domain.
    DOMAIN_MAP = {
            u'boolean': BooleanDomain(),
            u'integer': IntegerDomain(),
            u'decimal': DecimalDomain(),
            u'float': FloatDomain(),
            u'text': TextDomain(),
            u'date': DateDomain(),
            u'time': TimeDomain(),
            u'datetime': DateTimeDomain(),
    }

    # Special values.
    VALUE_MAP = {
            "today()": datetime.date.today,
            "now()": datetime.datetime.now,
    }

    fields = [
            ('column', QLabelVal),
            ('of', LabelVal, None),
            ('was', OneOrSeqVal(LabelVal), None),
            ('after', OneOrSeqVal(LabelVal), None),
            ('type', UnionVal((OnSeq, SeqVal(UStrVal(r'[0-9A-Za-z_-]+'))),
                              UChoiceVal(*sorted(TYPE_MAP))), None),
            ('default', AnyVal, None),
            ('required', BoolVal, None),
            ('unique', BoolVal, None),
            ('title', TitleVal, None),
            ('present', BoolVal, True),
    ]

    @classmethod
    def build(cls, driver, spec):
        if not spec.present:
            for field in ['was', 'after', 'type', 'default',
                          'required', 'unique', 'title']:
                if getattr(spec, field) is not None:
                    raise Error("Got unexpected clause:", field)
        if u'.' in spec.column:
            table_label, label = spec.column.split(u'.')
            if spec.of is not None and spec.of != table_label:
                raise Error("Got mismatched table names:",
                            ", ".join((table_label, spec.of)))
        else:
            label = spec.column
            table_label = spec.of
            if spec.of is None:
                raise Error("Got missing table name")
        is_present = spec.present
        if isinstance(spec.was, list):
            former_labels = spec.was
        elif spec.was:
            former_labels = [spec.was]
        else:
            former_labels = []
        type = spec.type
        domain = UntypedDomain()
        if isinstance(type, list):
            domain = EnumDomain(type)
        elif type is not None:
            domain = cls.DOMAIN_MAP[type]
        default = spec.default
        if isinstance(default, str):
            default = default.decode('utf-8', 'replace')
        if isinstance(default, unicode):
            try:
                default = domain.parse(default)
            except ValueError:
                pass
        title = spec.title
        if is_present:
            if type is None:
                raise Error("Got missing clause:", "type")
            if isinstance(type, list):
                if len(type) == 0:
                    raise Error("Got missing enum labels")
                if len(set(type)) < len(type):
                    raise Error("Got duplicate enum labels:",
                                ", ".join(type))
            if not (default is None or
                    (type == u'boolean' and
                        isinstance(default, bool)) or
                    (type == u'integer' and
                        isinstance(default, (int, long))) or
                    (type in (u'decimal', u'float') and
                        isinstance(default, (int, long,
                                             decimal.Decimal, float))) or
                    (type == u'text' and
                        isinstance(default, unicode)) or
                    (type == u'date' and
                        isinstance(default, datetime.date)) or
                    (type == u'date' and
                        default == u'today()') or
                    (type == u'time' and
                        isinstance(default, datetime.time)) or
                    (type == u'datetime' and
                        isinstance(default, datetime.datetime)) or
                    (type == u'datetime' and
                        default == u'now()') or
                    (isinstance(type, list) and
                        isinstance(default, unicode) and default in type)):
                raise Error("Got ill-typed default value:", default)
        is_required = spec.required
        is_unique = spec.unique
        return cls(table_label, label, former_labels=former_labels,
                   title=title, type=type, default=default,
                   is_required=is_required, is_unique=is_unique,
                   is_present=is_present)

    @classmethod
    def recover(cls, driver, column):
        table_fact = recover(driver, column.table)
        if table_fact is None:
            return None
        meta = uncomment(column)
        label = meta.label or column.name
        if mangle(label) != column.name:
            return None
        type = None
        if column.type.is_enum:
            if column.type.schema is column.table.schema:
                type = column.type.labels
                domain = EnumDomain(type)
        else:
            system_schema = driver.get_catalog()[u'pg_catalog']
            if column.type.schema is system_schema:
                type = cls.REVERSE_TYPE_MAP.get(column.type.name)
                domain = cls.DOMAIN_MAP.get(type)
        if type is None:
            return None
        is_unique = any(unique_key.origin_columns == [column]
                        for unique_key in column.unique_keys
                        if not unique_key.is_primary)
        default = meta.default
        if isinstance(default, str):
            default = default.decode('utf-8', 'replace')
        if isinstance(default, unicode):
            try:
                default = domain.parse(default)
            except ValueError:
                pass
        return cls(table_fact.label, label, type, default=default,
                   is_required=column.is_not_null,
                   is_unique=is_unique, title=meta.title)

    def __init__(self, table_label, label, type=None, default=None,
                 former_labels=[], is_required=None, is_unique=None,
                 title=None, is_present=True):
        assert isinstance(table_label, unicode) and len(table_label) > 0
        assert isinstance(label, unicode) and len(label) > 0
        assert isinstance(is_present, bool)
        if is_present:
            assert (isinstance(former_labels, list) and
                    all(isinstance(former_label, unicode)
                        for former_label in former_labels))
            assert (isinstance(type, unicode) and type in self.TYPE_MAP or
                    isinstance(type, list) and len(type) > 0 and
                    all(isinstance(label, unicode) and len(label) > 0
                        for label in type) and
                    len(set(type)) == len(type))
            if is_required is None:
                is_required = True
            assert isinstance(is_required, bool)
            if is_unique is None:
                is_unique = False
            assert isinstance(is_unique, bool)
            assert (title is None or
                    (isinstance(title, unicode) and len(title) > 0))
        else:
            assert former_labels == []
            assert type is None
            assert default is None
            assert is_required is None
            assert is_unique is None
            assert title is None
        self.table_label = table_label
        self.label = label
        self.type = type
        self.default = default
        self.former_labels = former_labels
        self.is_required = is_required
        self.is_unique = is_unique
        self.title = title
        self.is_present = is_present
        self.table_name = mangle(table_label)
        self.name = mangle(label)
        self.name_for_link = mangle(label, u'id')
        if type is None:
            self.type_name = None
            self.enum_labels = None
            self.domain = None
        elif isinstance(type, list):
            self.type_name = mangle([table_label, label], u'enum')
            self.enum_labels = type
            self.domain = EnumDomain(type)
        else:
            self.type_name = self.TYPE_MAP[type]
            self.enum_labels = None
            self.domain = self.DOMAIN_MAP[type]
        self.uk_name = mangle([table_label, label], u'uk')

    def __repr__(self):
        args = []
        args.append(repr(self.table_label))
        args.append(repr(self.label))
        if self.type is not None:
            args.append(repr(self.type))
        if self.default is not None:
            args.append("default=%r" % self.default)
        if self.former_labels:
            args.append("former_labels=%r" % self.former_labels)
        if self.is_required is not None and self.is_required is not True:
            args.append("is_required=%r" % self.is_required)
        if self.is_unique is not None and self.is_unique is not False:
            args.append("is_unique=%r" % self.is_unique)
        if self.title is not None:
            args.append("title=%r" % self.title)
        if not self.is_present:
            args.append("is_present=%r" % self.is_present)
        return "%s(%s)" % (self.__class__.__name__, ", ".join(args))

    def __call__(self, driver):
        if self.is_present:
            return self.create(driver)
        else:
            return self.drop(driver)

    def create(self, driver):
        # Ensures that the column is present.
        schema = driver.get_schema()
        system_schema = driver.get_system_schema()
        # Find the table.
        if self.table_name not in schema:
            raise Error("Discovered missing table:", self.table_label)
        table = schema[self.table_name]
        # Verify that we don't have a link under the same name.
        if self.name_for_link in table:
            raise Error("Discovered link with the same name:", self.label)
        # Verify if we need to rename the column.
        if self.name not in table:
            for former_label in self.former_labels:
                former = self.clone(label=former_label)
                if former.name not in table:
                    continue
                column = table[former.name]
                # Rename the column.
                column.alter_name(driver, self.name)
                # Rename auxiliary objects.
                self.rebase(driver, former)
                identity = recover(driver, table.primary_key)
                if identity is not None:
                    identity.rebase(driver)
                break
        # Determine the column type.
        if self.enum_labels:
            # Make sure the ENUM type exists.
            if self.type_name not in schema.types:
                schema.create_enum_type(driver,
                        self.type_name, self.enum_labels)
            type = schema.types[self.type_name]
        else:
            # A regular system type.
            type = system_schema.types[self.type_name]
        # Format the default value.
        default = self.default
        if default is not None:
            if self.type != u'text':
                default = self.VALUE_MAP.get(default, default)
            default = sql_value(default)
        # Create the column if it does not exist.
        if self.name not in table:
            table.create_column(
                    driver, self.name, type, self.is_required, default)
        column = table[self.name]
        # Check that the column has the right type.
        if self.enum_labels is not None:
            if not (type.is_enum and type.labels == self.enum_labels):
                type = None
        if column.type != type:
            raise Error("Discovered column with mismatched type:", self.label)
        # Update `NOT NULL` constraint.
        if column.is_not_null != self.is_required:
            # If necessary, drop `PRIMARY KEY` before dropping `NOT NULL`.
            if not self.is_required and column in (table.primary_key or []):
                identity_fact = recover(driver, table.primary_key)
                if identity_fact is not None:
                    identity_fact.purge(driver)
            column.alter_is_not_null(driver, self.is_required)
        # Update `UNIQUE` constraint.
        is_unique = (len(column.unique_keys) > 0)
        if self.is_unique and not is_unique:
            table.create_unique_key(driver, self.uk_name, [column], False)
        elif not self.is_unique and is_unique:
            for unique_key in column.unique_keys:
                unique_key.drop(driver)
        # Update the default value.
        meta = uncomment(column)
        saved_default = meta.default
        if isinstance(saved_default, str):
            saved_default = saved_default.decode('utf-8')
        if isinstance(saved_default, unicode):
            try:
                saved_default = self.domain.parse(saved_default)
            except ValueError:
                pass
        if saved_default != self.default:
            column.alter_default(driver, default)
        # Store the original column label, column title and default value.
        saved_label = self.label if self.label != self.name else None
        saved_title = self.title if self.title != label_to_title(self.label) \
                      else None
        if isinstance(self.default, (bool, int, unicode,
                                     datetime.date, datetime.datetime)):
            saved_default = self.default
        else:
            saved_default = self.domain.dump(self.default)
        if meta.update(label=saved_label, title=saved_title,
                       default=saved_default):
            comment = meta.dump()
            column.alter_comment(driver, comment)

    def drop(self, driver):
        # Ensures that the column is absent.
        # Find the table.
        schema = driver.get_schema()
        if self.table_name not in schema:
            return
        table = schema[self.table_name]
        # Verify that we don't have a link under the same name.
        if self.name_for_link in table:
            raise Error("Discovered link with the same name:",
                        self.label)
        # Find the column.
        if self.name not in table:
            return
        column = table[self.name]
        type = column.type
        # Check if we need to purge the identity.
        identity_fact = None
        if column in (table.primary_key or []):
            identity_fact = recover(driver, table.primary_key)
        # Drop the column.
        column.drop(driver)
        # Drop the dependent ENUM type.
        if type.is_enum:
            type.drop(driver)
        # Purge the identity.
        if identity_fact is not None:
            identity_fact.purge(driver)

    def rebase(self, driver, former=None, **kwds):
        # Updates the names after the table or the column is renamed.
        if former is None:
            former = self.clone(**kwds)
        schema = driver.get_schema()
        assert self.table_name in schema
        table = schema[self.table_name]
        assert self.name in table
        column = table[self.name]
        # Rename the `ENUM` type.
        enum_type = schema.types.get(former.type_name)
        if enum_type is not None:
            enum_type.alter_name(driver, self.type_name)
        # Rename the `UNIQUE` constraint.
        constraint = table.constraints.get(former.uk_name)
        if constraint is not None:
            constraint.alter_name(driver, self.uk_name)

    def purge(self, driver):
        # Removes remains of a column after the table is dropped.
        schema = driver.get_schema()
        # Drop the ENUM type.
        if isinstance(self.type, list):
            enum_type = schema.types.get(self.type_name)
            if enum_type is not None:
                enum_type.drop(driver)


