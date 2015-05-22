"""

    rex.widget.formfield
    ====================

    :copyright: 2015, Prometheus Research, LLC

"""

from htsql.core import domain

from rex.core import Extension, Validate
from rex.core import RecordVal, MapVal, SeqVal, ChoiceVal, OneOfVal
from rex.core import AnyVal, StrVal, IntVal, BoolVal, MaybeVal
from rex.port import Port, GrowVal

from .url import URLVal
from .util import PropsContainer, undefined, MaybeUndefinedVal
from .transitionable import as_transitionable
from .dataspec import CollectionSpecVal
from .keypath import KeyPathVal

__all__ = ('FormField', 'FormFieldVal',
           'validate', 'from_port', 'to_port')


class FormFieldTypeVal(Validate):

    def __call__(self, value):
        form_field_types = FormField.mapped() # pylint: disable=no-member
        validate = ChoiceVal(*form_field_types)
        value = validate(value)
        return form_field_types[value]


class FormFieldVal(Validate):
    """ Validator for form field specifications.
    """

    _validate = OneOfVal(KeyPathVal(), MapVal(StrVal(), AnyVal()))
    _validate_type = FormFieldTypeVal()

    def __init__(self, default_type='string'):
        self.default_type = default_type

    def __call__(self, value):
        if isinstance(value, FormField):
            return value
        value = self._validate(value)
        if isinstance(value, list):
            value = {'value_key': value}
        value = dict(value)
        field_type = value.pop('type', self.default_type)
        field_type = self._validate_type(field_type)
        return field_type(**value)


validate = FormFieldVal()


class FormField(Extension):

    type = NotImplemented
    fields = ()

    @classmethod
    def signature(cls):
        return cls.type

    @classmethod
    def enabled(cls):
        return cls.type is not NotImplemented

    def __init__(self, **values):
        self.values = self.validator(values)._asdict()
        for k, v in self.values.items():
            setattr(self, k, v)

    _default_fields = (
        ('value_key', KeyPathVal()),
        ('required', BoolVal(), False),
        ('width', MaybeUndefinedVal(OneOfVal(StrVal(), IntVal())), undefined),
        ('read_only', BoolVal(), False),
    )

    @property
    def validator(self):
        fields = self._default_fields + self.__class__.fields
        return RecordVal(*fields)

    def __clone__(self, **values):
        next_values = {}
        next_values.update(self.values)
        next_values.update(values)
        return self.__class__(**next_values)

    def __merge__(self, other):
        next_values = {}
        next_values.update(self.values)
        next_values.update(other.values)
        return self.__class__(**next_values)

    def __call__(self):
        values = {'type': self.type}
        values.update(self.values)
        return PropsContainer(values)

    def __repr__(self):
        args = ['%s=%r' % (k, v)
                for k, v in self.values.items()
                if self.validator.fields[k].default != v]
        return '%s(%s)' % (self.__class__.__name__, ', '.join(args))


@as_transitionable(FormField, tag='map')
def _encode_FormField(field): # pylint: disable=invalid-name
    return {k: v for k, v in field().items() if v is not undefined}


def from_port(port, field_val=FormFieldVal()):
    """ Generate fieldset for a port definition."""
    trunk_arm = port.tree.arms.values()[0]
    return _from_arm(port.tree, field_val).fields[0].fields


def _is_required(column):
    return not column.is_nullable and not column.has_default


def _from_arm(arm, field_val, value_key='__root__', label='Root'):
    if arm.kind in ('facet entity', 'trunk entity', 'branch entity', 'root'):
        fields = [_from_arm(v, field_val, value_key=k, label=k)
                  for k, v in arm.items()]
        return field_val({
            'type': 'fieldset' if not arm.is_plural else 'list',
            'value_key': value_key,
            'label': label,
            'fields': fields,
        })
    elif arm.kind == 'column':
        if isinstance(arm.domain, domain.IntegerDomain):
            field_type = 'integer'
        elif isinstance(arm.domain, domain.BooleanDomain):
            field_type = 'bool'
        else:
            field_type = 'string'
        return field_val({
            'type': field_type,
            'value_key': value_key,
            'label': label,
            'required': _is_required(arm.column),
        })
    elif arm.kind == 'link':
        return field_val({
            'value_key': value_key,
            'label': label,
            'required': any(_is_required(c)
                            for j in arm.arc.joins
                            for c in j.origin_columns)
        })
    else:
        raise NotImplementedError('found an unknown arm kind: %s' % arm.kind)


def to_port(entity, fields, filters=None, mask=None):
    """ Generate port from fieldset."""
    fields = _nest(fields)
    return Port(_to_port_query(entity, fields, filters=filters, mask=mask))


_grow_val = GrowVal()
_form_field_val = FormFieldVal()


def _to_port_query(entity, fields, filters=None, mask=None):
    grow = {
        'entity': entity,
        'select': [],
        'with': [],
    }
    if filters is not None:
        grow['filters'] = filters
    if mask is not None:
        grow['mask'] = mask
    for field in fields:
        assert len(field.value_key) == 1
        key = field.value_key[0]
        if isinstance(field, (List, Fieldset)):
            grow['with'].append(_to_port_query(key, field.fields))
        elif isinstance(field, CalcFormField):
            grow['with'].append('%s := %s' % (key, field.expr))
        else:
            grow['select'].append(field.value_key[0])
    return _grow_val(grow)


def _nest(fields):
    fields_by_key = {}
    for field in fields:
        key = field.value_key[0]
        if len(field.value_key) > 1:
            field = field.__clone__(value_key=field.value_key[1:])
            if key in fields_by_key:
                fields_by_key[key] = fields_by_key[key].__clone__(
                    fields=fields_by_key[key].fields + [field])
            else:
                fields_by_key[key] = _form_field_val({
                    'value_key': [key],
                    'type': 'fieldset',
                    'fields': [field],
                })
        else:
            if key in fields_by_key:
                fields_by_key[key] = fields_by_key[key].__merge__(field)
            else:
                fields_by_key[key] = field.__clone__()
    fields = [f.__clone__(fields=_nest(f.fields)) if isinstance(f, Fieldset) else f
              for f in fields_by_key.values()]
    fields = sorted(fields, key=lambda f: tuple(f.value_key))
    return fields


class StringFormField(FormField):

    type = 'string'
    fields = (
        ('label', MaybeVal(StrVal()), None),
        ('pattern', MaybeVal(StrVal()), None),
        ('error', MaybeVal(StrVal()), None),
    )


class IntegerFormField(FormField):

    type = 'integer'
    fields = (
        ('label', MaybeVal(StrVal()), None),
        ('error', MaybeVal(StrVal()), None),
    )


class BoolFormField(FormField):

    type = 'bool'
    fields = (
        ('label', StrVal(), None),
    )


class DateFormField(FormField):

    type = 'date'
    fields = (
        ('label', StrVal(), None),
    )


class FileFormField(FormField):

    type = 'file'
    fields = (
        ('label', StrVal(), None),
        ('download', URLVal()),
        ('storage', URLVal(), 'rex.file:/'),
    )


class EnumFormField(FormField):

    type = 'enum'

    _value_val = RecordVal(
        ('value', StrVal()),
        ('label', MaybeVal(StrVal()), None),
    )

    fields = (
        ('label', StrVal(), None),
        ('options', SeqVal(_value_val)),
    )


@as_transitionable(EnumFormField._value_val.record_type, tag='map')
def _encode_EnumFormField_value(value): # pylint: disable=invalid-name
    return value._asdict()


class EntityFormField(FormField):

    type = 'entity'

    fields = (
        ('label', MaybeVal(StrVal()), None),
        ('data', CollectionSpecVal()),
    )


class CalcFormField(FormField):

    type = 'calc'

    fields = (
        ('expr', StrVal()),
        ('label', MaybeVal(StrVal()), None),
    )


class CompositeFormField(FormField):

    def __merge__(self, other):
        next_values = {}
        next_values.update(self.values)
        next_values.update(other.values)
        next_values['fields'] = self.fields + other.fields
        return self.__class__(**next_values)


class Fieldset(CompositeFormField):

    type = 'fieldset'

    fields = (
        ('label', MaybeVal(StrVal()), None),
        ('fields', SeqVal(validate)),
    )


class List(CompositeFormField):

    type = 'list'

    fields = (
        ('label', StrVal()),
        ('fields', SeqVal(validate)),
    )
