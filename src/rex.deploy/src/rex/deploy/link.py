#
# Copyright (c) 2013, Prometheus Research, LLC
#


from rex.core import Error, BoolVal, OneOrSeqVal
from .fact import Fact, LabelVal, QLabelVal, TitleVal, label_to_title
from .image import SET_DEFAULT
from .meta import uncomment
from .recover import recover
from .sql import mangle


class LinkFact(Fact):
    """
    Describes a link between two tables.

    `table_label`: ``unicode``
        The name of the origin table.
    `label`: ``unicode``
        The name of the link.
    `target_table_label`: ``unicode`` or ``None``
        The name of the target table.  Must be ``None``
        if ``is_present`` is not set.
    `former_labels`: [``unicode``]
        Names that the link may have had in the past.
    `is_required`: ``bool`` or ``None``
        Indicates if ``NULL`` values are not allowed.  Must be ``None``
        if ``is_present`` is not set.
    `is_unique`: ``bool`` or ``None``
        Indicates that each value must be unique across all rows in the table.
    `title`: ``unicode`` or ``None``
        The title of the link.  If not set, borrowed from the target title
        or generated from the label.
    `is_present`: ``bool``
        Indicates whether the link exists.
    """

    fields = [
            ('link', QLabelVal),
            ('of', LabelVal, None),
            ('to', LabelVal, None),
            ('was', OneOrSeqVal(LabelVal), None),
            ('after', OneOrSeqVal(LabelVal), None),
            ('required', BoolVal, None),
            ('unique', BoolVal, None),
            ('title', TitleVal, None),
            ('present', BoolVal, True),
    ]

    @classmethod
    def build(cls, driver, spec):
        if not spec.present:
            for field in ['to', 'was', 'after', 'required', 'unique', 'title']:
                if getattr(spec, field) is not None:
                    raise Error("Got unexpected clause:", field)
        if u'.' in spec.link:
            table_label, label = spec.link.split(u'.')
            if spec.of is not None and spec.of != table_label:
                raise Error("Got mismatched table names:",
                            ", ".join((table_label, spec.of)))
        else:
            label = spec.link
            table_label = spec.of
            if spec.of is None:
                raise Error("Got missing table name")
        target_table_label = spec.to
        if isinstance(spec.was, list):
            former_labels = spec.was
        elif spec.was:
            former_labels = [spec.was]
        else:
            former_labels = []
        is_required = spec.required
        is_unique = spec.unique
        title = spec.title
        is_present = spec.present
        if is_present:
            if target_table_label is None:
                target_table_label = label
        return cls(table_label, label, target_table_label,
                    former_labels=former_labels, is_required=is_required,
                    is_unique=is_unique, title=title, is_present=is_present)

    @classmethod
    def recover(cls, driver, column):
        table_fact = recover(driver, column.table)
        if table_fact is None:
            return None
        meta = uncomment(column)
        label = meta.label
        if label is None:
            if not column.name.endswith(u'_id'):
                return None
            label = column.name[:-2].rstrip(u'_')
        if mangle(label, u'id') != column.name:
            return None
        foreign_keys = column.foreign_keys
        if len(foreign_keys) != 1:
            return None
        [foreign_key] = foreign_keys
        if (foreign_key.origin_columns != [column] or
            foreign_key.target_columns[0].name != u'id'):
            return None
        target_table_fact = recover(driver, foreign_key.target)
        if target_table_fact is None:
            return None
        is_unique = any(unique_key.origin_columns == [column]
                        for unique_key in column.unique_keys
                        if not unique_key.is_primary)
        return cls(table_fact.label, label, target_table_fact.label,
                   is_required=column.is_not_null,
                   is_unique=is_unique, title=meta.title)

    def __init__(self, table_label, label, target_table_label=None,
                 former_labels=[], is_required=None, is_unique=None,
                 title=None, is_present=True):
        assert isinstance(table_label, unicode) and len(table_label) > 0
        assert isinstance(label, unicode) and len(label) > 0
        assert isinstance(is_present, bool)
        if is_present:
            assert (isinstance(target_table_label, unicode)
                    and len(target_table_label) > 0)
            assert (isinstance(former_labels, list) and
                    all(isinstance(former_label, unicode)
                        for former_label in former_labels))
            if is_required is None:
                is_required = True
            assert isinstance(is_required, bool)
            if is_unique is None:
                is_unique = False
            assert isinstance(is_unique, bool)
            assert (title is None or
                    (isinstance(title, unicode) and len(title) > 0))
        else:
            assert target_table_label is None
            assert former_labels == []
            assert is_required is None
            assert is_unique is None
            assert title is None
        self.table_label = table_label
        self.label = label
        self.target_table_label = target_table_label
        self.former_labels = former_labels
        self.is_required = is_required
        self.is_unique = is_unique
        self.title = title
        self.is_present = is_present
        self.table_name = mangle(table_label)
        self.name = mangle(label, u'id')
        self.name_for_column = mangle(label)
        if is_present:
            self.target_table_name = mangle(target_table_label)
            self.fk_name = mangle([table_label, label], u'fk')
            self.uk_name = mangle(
                    [table_label, label],u'uk')
        else:
            self.target_table_name = None
            self.fk_name = None
            self.uk_name = None

    def __repr__(self):
        args = []
        args.append(repr(self.table_label))
        args.append(repr(self.label))
        if self.target_table_label is not None:
            args.append(repr(self.target_table_label))
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
        # Ensures that the link is present.
        schema = driver.get_schema()
        if self.table_name not in schema:
            raise Error("Discovered missing table:", self.table_label)
        table = schema[self.table_name]
        if self.target_table_name not in schema:
            raise Error("Discovered missing table:", self.target_table_label)
        target_table = schema[self.target_table_name]
        if u'id' not in target_table or not target_table[u'id'].unique_keys:
            raise Error("Discovered table without surrogate key:",
                        self.target_table_label)
        target_column = target_table[u'id']
        # Verify that we don't have a regular column under the same name.
        if self.name_for_column in table:
            raise Error("Discovered column with the same name:", self.label)
        # Verify if we need to rename the link.
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
        # Create the link column if it does not exist.
        if self.name not in table:
            table.create_column(
                    driver, self.name, target_column.type, self.is_required)
        column = table[self.name]
        # Verify the column type and `NOT NULL` constraint.
        if column.type != target_column.type:
            raise Error("Discovered link with mismatched type:", self.label)
        if column.is_not_null != self.is_required:
            # If necessary, drop `PRIMARY KEY` before dropping `NOT NULL`.
            if not self.is_required and column in (table.primary_key or []):
                identity_fact = recover(driver, table.primary_key)
                if identity_fact is not None:
                    identity_fact.purge(driver)
            column.alter_is_not_null(driver, self.is_required)
        # Create a `FOREIGN KEY` constraint and, if necessary,
        # an associated index.
        has_key = any(foreign_key
                      for foreign_key in table.foreign_keys
                      if list(foreign_key) == [(column, target_column)])
        if not has_key:
            table.create_foreign_key(
                    driver, self.fk_name, [column],
                    target_table, [target_column],
                    on_delete=SET_DEFAULT)
            if not self.is_unique:
                schema.create_index(driver, self.fk_name, table, [column])
        # Create a `UNIQUE` constraint or a regular index.
        is_unique = (len(column.unique_keys) > 0)
        index = schema.indexes.get(self.fk_name)
        if self.is_unique and not is_unique:
            if index is not None:
                index.drop(driver)
            table.create_unique_key(driver, self.uk_name, [column])
        elif not self.is_unique and is_unique:
            for unique_key in column.unique_keys:
                unique_key.drop(driver)
            if index is None:
                schema.create_index(driver, self.fk_name, table, [column])
        # Store the original link label and the link title.
        meta = uncomment(column)
        preferred_label = self.name[:-2].rstrip(u'_') \
                                if self.name.endswith(u'_id') else None
        saved_label = self.label if self.label != preferred_label else None
        preferred_title = label_to_title(self.label)
        if self.label == self.target_table_label:
            target_meta = uncomment(target_table)
            if target_meta.title:
                preferred_title = target_meta.title
        saved_title = self.title if self.title != preferred_title else None
        if meta.update(label=saved_label, title=saved_title):
            comment = meta.dump()
            column.alter_comment(driver, comment)

    def drop(self, driver):
        # Ensures that the link is absent.
        # Find the table.
        schema = driver.get_schema()
        if self.table_name not in schema:
            return
        table = schema[self.table_name]
        # Verify that we don't have a regular column under the same name.
        if self.name_for_column in table:
            raise Error("Discovered column with the same name:", self.label)
        # Find the column.
        if self.name not in table:
            return
        column = table[self.name]
        # Check if we need to purge the identity.
        identity_fact = None
        if table.primary_key is not None and column in table.primary_key:
            identity_fact = recover(driver, table.primary_key)
        # Drop the link.
        column.drop(driver)
        # Purge the identity.
        if identity_fact is not None:
            identity_fact.purge(driver)

    def rebase(self, driver, former=None, **kwds):
        # Updates the names after the table or the column gets renamed.
        if former is None:
            former = self.clone(**kwds)
        schema = driver.get_schema()
        assert self.table_name in schema
        table = schema[self.table_name]
        # Rename the `FOREIGN KEY` constraint and its index.
        constraint = table.constraints.get(former.fk_name)
        if constraint is not None:
            constraint.alter_name(driver, self.fk_name)
        index = schema.indexes.get(former.fk_name)
        if index is not None:
            index.alter_name(driver, self.fk_name)
        # Rename the `UNIQUE` constraint.
        constraint = table.constraints.get(former.uk_name)
        if constraint is not None:
            constraint.alter_name(self, self.uk_name)

    def purge(self, driver):
        # Removes remains of a link after the table is dropped.
        pass


