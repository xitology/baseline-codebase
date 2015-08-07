/**
 * @copyright 2015, Prometheus Research, LLC
 */

import Transitionable   from 'rex-widget/lib/Transitionable';
import {ContextBinding} from './DataSpecification';
import * as Typing      from './Typing';

Transitionable.register('contextbinding', function decode_query(payload) {
  return new ContextBinding(payload[0], payload[1]);
});

Transitionable.register('type:any', function decode_type_any(payload) {
  return Typing.anytype;
});

Transitionable.register('type:value', function decode_type_value(payload) {
  return new Typing.ValueType(payload);
});

Transitionable.register('type:entity', function decode_type_entity(payload) {
  return new Typing.EntityType(payload[0], payload[1]);
});

Transitionable.register('type:row', function decode_type_row(payload) {
  return new Typing.RowType(payload[0], payload[1]);
});

Transitionable.register('type:record', function decode_type_record(payload) {
  return new Typing.RecordType(payload[0], payload[1]);
});
