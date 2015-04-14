"""

    rex.widget.modern.library
    =========================

    :copyright: 2015, Prometheus Research, LLC

"""

from collections import namedtuple

from rex.core import StrVal, RecordVal, OneOfVal, BoolVal, Validate

from ..util import PropsContainer
from ..json_encoder import register_adapter

__all__ = ('ParamVal', 'Param')


Param = namedtuple('Param', ['value', 'context_ref', 'required'])

@register_adapter(Param)
def _encode_Param(param):
    return PropsContainer(param._asdict())


class ParamVal(Validate):

    _validate_shortcut = StrVal()
    _validate_full = RecordVal(('value', StrVal()), ('required', BoolVal(), False))
    _validate = OneOfVal(_validate_shortcut, _validate_full)
    
    def __call__(self, value):
        if isinstance(value, Param):
            return value
        value = self._validate(value)
        if isinstance(value, basestring):
            value = self._validate_full({'value': value, 'required': False})
        if value.value.startswith('$'):
            context_ref = value.value[1:].split('.')
            val = None
        else:
            context_ref = None
            val = value.value
        return Param(
            value=val,
            context_ref=context_ref,
            required=value.required)


