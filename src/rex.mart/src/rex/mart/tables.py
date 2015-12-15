#
# Copyright (c) 2015, Prometheus Research, LLC
#


from collections import OrderedDict, namedtuple

from htsql.core.cmd.act import analyze
from rex.core import Error, get_settings
from rex.instrument import Instrument, InstrumentVersion, CalculationSet
from rios.core.validation.instrument import get_full_type_definition

from .fields import make_field, make_field_from_htsql, merge_field_into


__all__ = (
    'PrimaryTable',
)


Statement = namedtuple('Statement', ['htsql', 'parameters'])


class MappingTable(object):
    def __init__(self, name):
        self.name = name
        self.fields = OrderedDict()

    @property
    def table_name(self):
        return self.name

    def add_field(self, field):
        merge_field_into(self.fields, field)

    def get_field_facts(self, exclude_fields=None):
        facts = []

        for field in self.fields.itervalues():
            if exclude_fields and field.name in exclude_fields:
                continue
            facts.extend(field.get_deploy_facts(self.table_name))

        return facts

    def get_deploy_facts(self):
        raise NotImplementedError()

    @property
    def statement_skeleton(self):  # pragma: no cover
        # pylint: disable=no-self-use
        return None

    def get_statement(self, values):
        return self.statement_skeleton % (
            ', '.join([
                '$%s :as %s' % (name, name)
                for name in values.iterkeys()
            ]),
        )

    def get_statements_for_assessment(
            self,
            assessment,
            instrument_version_uid,
            selection_record=None):

        statements = []

        value_mapping = self.get_value_mapping(
            assessment,
            instrument_version_uid,
            selection_record=selection_record,
        )

        if value_mapping:
            statements.append(Statement(
                self.get_statement(value_mapping),
                value_mapping,
            ))

        return statements

    def get_value_mapping(
            self,
            assessment,
            instrument_version_uid,
            selection_record=None):

        value_map = {}

        meta = assessment.get('meta', {})
        calculations = meta.get('calculations', {})

        for name, field in self.fields.iteritems():
            if name in assessment['values']:
                value_map.update(field.get_value_mapping(
                    assessment['values'][name],
                    instrument_version=instrument_version_uid,
                ))

            elif name.startswith('meta_'):
                meta_name = name[5:]
                if meta_name in meta:
                    value_map.update(field.get_value_mapping(
                        meta[meta_name],
                    ))

            elif name in calculations:
                value_map.update(field.get_value_mapping(
                    calculations[name],
                ))

            elif selection_record and name in selection_record.__fields__:
                value_map.update(field.get_value_mapping(
                    getattr(selection_record, name),
                ))

        return value_map


class ChildTable(MappingTable):  # pylint: disable=abstract-method
    def __init__(self, name, parent_name):
        super(ChildTable, self).__init__(name)
        self.parent_name = parent_name

    @property
    def table_name(self):
        return '%s_%s' % (
            self.parent_name,
            self.name,
        )

    @property
    def statement_skeleton(self):
        return '/{{$PRIMARY_TABLE_ID :as {1}, %s}} :as {0}/:insert'.format(
            self.table_name,
            self.parent_name,
        )


class FacetTable(ChildTable):
    def get_deploy_facts(self):
        facts = []

        facts.append({
            'table': self.table_name,
        })

        facts.append({
            'link': self.parent_name,
            'of': self.table_name,
            'required': True,
        })
        facts.append({
            'identity': [self.parent_name],
            'of': self.table_name,
        })

        facts.extend(self.get_field_facts(
            exclude_fields=[self.parent_name],
        ))

        return facts


class SegmentedPrimaryTable(FacetTable):
    @property
    def table_name(self):
        return self.name


class MatrixTable(FacetTable):
    def merge(self, field, instrument_version, field_filter):
        if field['type']['base'] != 'matrix':  # pragma: no cover
            raise Error(
                'Cannot merge a field of type "%s" (%s) with a matrix'
                ' field' % (
                    field['type']['base'],
                    field['id'],
                )
            )

        for row in field['type']['rows']:
            for col in field['type']['columns']:
                if not field_filter(
                        [field['id'], row['id'], col['id']],
                        col.get('identifiable', False)):
                    continue

                name = '%s_%s' % (row['id'], col['id'])
                col['type'] = get_full_type_definition(
                    instrument_version.definition,
                    col['type'],
                )
                mapped_field = make_field(
                    col,
                    name=name,
                    instrument_version=instrument_version.uid,
                )
                self.add_field(mapped_field)

    def get_value_mapping(
            self,
            assessment,
            instrument_version_uid,
            selection_record=None):

        value_mapping = {}

        if self.name not in assessment['values'] \
                or not assessment['values'][self.name]['value']:
            return value_mapping

        value = assessment['values'][self.name]['value']
        for row_id, columns in value.iteritems():
            for col_id, cell in columns.iteritems():
                subfield_name = '%s_%s' % (row_id, col_id)
                if subfield_name in self.fields:
                    value_mapping.update(
                        self.fields[subfield_name].get_value_mapping(
                            cell,
                            instrument_version=instrument_version_uid,
                        )
                    )

        return value_mapping


class BranchTable(ChildTable):
    def get_deploy_facts(self):
        facts = []

        facts.append({
            'table': self.table_name,
        })

        facts.append({
            'link': self.parent_name,
            'of': self.table_name,
            'required': True,
        })
        facts.append({
            'column': 'record_uid',
            'type': 'integer',
            'of': self.table_name,
            'required': True,
        })
        facts.append({
            'identity': [
                self.parent_name,
                {'record_uid': 'offset'},
            ],
            'of': self.table_name,
        })

        facts.extend(self.get_field_facts(
            exclude_fields=[self.parent_name, 'record_uid'],
        ))

        return facts


class RecordListTable(BranchTable):
    def merge(self, field, instrument_version, field_filter):
        if field['type']['base'] != 'recordList':  # pragma: no cover
            raise Error(
                'Cannot merge a field of type "%s" (%s) with a recordList'
                ' field' % (
                    field['type']['base'],
                    field['id'],
                )
            )

        for subfield in field['type']['record']:
            if not field_filter(
                    [field['id'], subfield['id']],
                    subfield.get('identifiable', False)):
                continue

            subfield['type'] = get_full_type_definition(
                instrument_version.definition,
                subfield['type'],
            )
            mapped_field = make_field(
                subfield,
                instrument_version=instrument_version.uid,
            )
            self.add_field(mapped_field)

    def get_statements_for_assessment(
            self,
            assessment,
            instrument_version_uid,
            selection_record=None):

        statements = []

        if self.name not in assessment['values'] \
                or not assessment['values'][self.name]['value']:
            return statements

        for record in assessment['values'][self.name]['value']:
            value_mapping = self.get_value_mapping(
                {'values': record},
                instrument_version_uid,
                selection_record=selection_record,
            )
            if value_mapping:
                statements.append(Statement(
                    self.get_statement(value_mapping),
                    value_mapping,
                ))

        return statements


class PrimaryTable(MappingTable):
    def __init__(self, definition, database):
        self.definition = definition
        super(PrimaryTable, self).__init__(self.definition['name'])
        self.children = OrderedDict()

        self._add_selector_fields(
            self.definition['selector'],
            database,
            parental_fields=self.definition['parental_relationship']['parent']
        )
        self._add_calculation_fields(
            self.definition['post_load_calculations'],
        )
        self._add_instruments(self.definition['instrument'])
        self._add_meta_fields(self.definition['meta'])
        self._segment_fields()

    def get_deploy_facts(self):
        facts = []

        facts.append({
            'table': self.name,
        })

        parents = self.definition['parental_relationship']['parent'][:]
        facts.extend([
            {
                'link': parent,
                'of': self.name,
                'required': True,
            }
            for parent in parents
        ])

        facts.append({
            'column': 'assessment_uid',
            'of': self.name,
            'type': 'text',
            'required': True,
        })

        identity = parents[:]
        if self.definition['parental_relationship']['type'] in \
                ('trunk', 'branch', 'ternary'):
            identity.append('assessment_uid')
        facts.append({
            'identity': identity,
            'of': self.name,
        })

        facts.append({
            'column': 'instrument_version_uid',
            'of': self.name,
            'type': 'text',
            'required': True,
        })

        facts.extend(self.get_field_facts(
            exclude_fields=parents + [
                'assessment_uid',
                'instrument_version_uid',
            ],
        ))

        # Add the children
        for child in self.children.itervalues():
            facts.extend(child.get_deploy_facts())

        return facts

    def _add_selector_fields(self, selector, database, parental_fields=None):
        with database:
            info = analyze(selector)

        selected_fields = []
        for field in info.meta.domain.item_domain.fields:
            mapped_field = make_field_from_htsql(field)
            selected_fields.append(mapped_field.name)
            if mapped_field.name != 'assessment_uid':
                self.add_field(mapped_field)

        if 'assessment_uid' not in selected_fields:
            raise Error(
                'Selector does not include "assessment_uid" field specifying'
                ' Assessment UIDs'
            )

        parental_fields = set(parental_fields or [])
        missing = parental_fields - set(selected_fields)
        if missing:
            raise Error(
                'Selector is missing fields declared as parental links: %s' % (
                    ', '.join(list(missing)),
                )
            )

        dupe_fields = set([
            name
            for name in selected_fields
            if selected_fields.count(name) > 1
        ])
        if dupe_fields:
            raise Error(
                'Selector includes multiple fields with the same name: %s' % (
                    ', '.join(list(dupe_fields)),
                )
            )

    def _add_calculation_fields(self, calculations):
        for calculation in calculations:
            fake_field = {
                'id': calculation['name'],
                'type': {
                    'base': calculation['type'],
                },
            }
            mapped_field = make_field(fake_field)
            self.add_field(mapped_field)

    def _add_instruments(self, instruments):
        inst_impl = Instrument.get_implementation()
        iv_impl = InstrumentVersion.get_implementation()
        cs_impl = CalculationSet.get_implementation()

        for instrument_uid in instruments:
            instrument = inst_impl.get_by_uid(instrument_uid)
            if not instrument:
                raise Error(
                    'An Instrument with UID "%s" could not be found' % (
                        instrument_uid,
                    ),
                )

            versions = iv_impl.find(instrument=instrument.uid)
            if not versions:
                raise Error(
                    'No InstrumentVersions for UID "%s" exist' % (
                        instrument_uid,
                    ),
                )

            for version in versions:
                calculations = cs_impl.find(instrument_version=version.uid)
                self._add_instrument_fields(version)
                if calculations:
                    self._add_calculationset_fields(calculations[0])

    def is_field_allowed(self, name, identifiable):
        if self.definition['fields'] is None:
            # Definition explicitly excludes all fields
            return False

        if isinstance(name, list):
            name = '.'.join(name)
        if len(self.definition['fields']) > 0 \
                and name not in self.definition['fields'] \
                and name not in [
                    field.split('.')[0]
                    for field in self.definition['fields']]:
            # Definition does not specify this field
            return False

        if self.definition['identifiable'] == 'none' and identifiable:
            # No identifable fields allowed
            return False
        if self.definition['identifiable'] == 'only' and not identifiable:
            # Only identifiable fields are allowed
            return False

        return True

    def is_calculation_allowed(self, name):
        if self.definition['calculations'] is None:
            # Definition explicitly excludes all calculations
            return False

        if len(self.definition['calculations']) > 0 \
                and name not in self.definition['calculations']:
            # Definition does not specify this field
            return False

        return True

    def _add_instrument_fields(self, instrument_version):
        for field in instrument_version.definition['record']:
            if not self.is_field_allowed(
                    [field['id']],
                    field.get('identifiable', False)):
                continue

            field['type'] = get_full_type_definition(
                instrument_version.definition,
                field['type'],
            )

            if field['type']['base'] == 'recordList':
                self._add_instrument_recordlist(field, instrument_version)

            elif field['type']['base'] == 'matrix':
                self._add_instrument_matrix(field, instrument_version)

            else:
                self._add_instrument_simple(field, instrument_version)

    def _add_instrument_simple(self, field, instrument_version):
        if field['id'] in self.children:
            raise Error(
                'Cannot merge a "%s" field with a complex field (%s)' % (
                    field['type']['base'],
                    field['id'],
                )
            )

        mapped_field = make_field(
            field,
            instrument_version=instrument_version.uid,
        )
        self.add_field(mapped_field)

    def _add_instrument_recordlist(self, field, instrument_version):
        if field['id'] in self.fields:
            raise Error(
                'Cannot merge a recordList field with any other type'
                ' of field (%s)' % (
                    field['id'],
                )
            )

        if field['id'] in self.children:
            self.children[field['id']].merge(
                field,
                instrument_version,
                self.is_field_allowed,
            )
        else:
            table = RecordListTable(field['id'], self.name)
            table.merge(field, instrument_version, self.is_field_allowed)
            if len(table.fields) > 0:
                self.children[field['id']] = table

    def _add_instrument_matrix(self, field, instrument_version):
        if field['id'] in self.fields:
            raise Error(
                'Cannot merge a matrix field with any other type'
                ' of field (%s)' % (
                    field['id'],
                )
            )

        if field['id'] in self.children:
            self.children[field['id']].merge(
                field,
                instrument_version,
                self.is_field_allowed,
            )
        else:
            table = MatrixTable(field['id'], self.name)
            table.merge(field, instrument_version, self.is_field_allowed)
            if len(table.fields) > 0:
                self.children[field['id']] = table

    def _add_calculationset_fields(self, calculationset):
        for calc in calculationset.definition['calculations']:
            if not self.is_calculation_allowed(calc['id']):
                continue

            field = {
                'id': calc['id'],
                'type': {'base': calc['type']},
                'identifiable': calc.get('identifiable', False),
            }
            mapped_field = make_field(field)
            self.add_field(mapped_field)

    def _add_meta_fields(self, meta_fields):
        if meta_fields is None:
            return

        for meta in meta_fields:
            for name, type_ in meta.items():
                field = {
                    'id': 'meta_%s' % (name,),
                    'type': {'base': type_},
                }
                mapped_field = make_field(field)
                self.add_field(mapped_field)

    def _segment_fields(self):
        segments = []

        field_ids = self.fields.keys()
        max_size = get_settings().mart_max_columns

        primary_data_fields = max_size - 2  # two UID fields
        primary_data_fields -= len(
            self.definition['parental_relationship']['parent']
        )
        primary_data_fields -= len(self.definition['post_load_calculations'])
        additional_data_fields = max_size - 1  # link to primary

        if primary_data_fields > 0:
            segments.append(field_ids[:primary_data_fields])
            start = primary_data_fields
        else:
            start = 0
        for i in xrange(start, len(field_ids), additional_data_fields):
            segments.append(field_ids[i:(i + additional_data_fields)])

        for idx, segment in enumerate(segments[1:]):
            name = '%s_%s' % (
                self.name,
                (idx + 2),
            )
            child = SegmentedPrimaryTable(name, self.name)
            self.children[name] = child

            for field_id in segment:
                child.fields[field_id] = self.fields.pop(field_id)

    @property
    def statement_skeleton(self):
        return '/{{$assessment_uid :as assessment_uid,' \
            ' $instrument_version_uid :as instrument_version_uid, %s}}' \
            ' :as {0}/:insert'.format(
                self.table_name,
            )

    def get_statements_for_assessment(
            self,
            assessment,
            instrument_version_uid,
            selection_record=None):

        statements = super(PrimaryTable, self).get_statements_for_assessment(
            assessment,
            instrument_version_uid,
            selection_record=selection_record,
        )

        for child in self.children.itervalues():
            statements.extend(child.get_statements_for_assessment(
                assessment,
                instrument_version_uid,
                selection_record=selection_record,
            ))

        return statements

    def get_calculation_statements(self):
        if not self.definition['post_load_calculations']:
            return []

        defines = []
        assigns = []
        for calculation in self.definition['post_load_calculations']:
            defines.append('$%s := %s' % (
                calculation['name'],
                calculation['expression'],
            ))
            assigns.append('$%s :as %s' % (
                calculation['name'],
                calculation['name'],
            ))

        statement = '/%s.define(%s){id(), %s}/:update' % (
            self.table_name,
            ', '.join(defines),
            ', '.join(assigns),
        )

        return [statement]
