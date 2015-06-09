/**
 * @copyright 2015, Prometheus Research, LLC
 */
'use strict';

var moment    = require('moment');
var invariant = require('../invariant');

function generateSchemaFromFields(fields) {
  var schema = {
    type: 'object',
    properties: {},
    required: []
  };
  fields = _removeLayout(fields);
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    _growSchema(schema, _toKeyPath(field.valueKey), _fieldToSchema(field));
  }
  return schema;
}

function _removeLayout(fields) {
  var noLayout = [];
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    if (field.type && field.props) {
      noLayout = noLayout.concat(_removeLayout(field.props.fields));
    } else {
      if (field.type === 'fieldset' || field.type === 'list') {
        field = {...field, fields: _removeLayout(field.fields)};
      }
      noLayout.push(field);
    }
  }
  return noLayout;
}

function _fieldToSchema(field) {
  switch (field.type) {
    case 'fieldset':
      var schema = generateSchemaFromFields(field.fields);
      schema.isRequired = !!field.required;
      return schema;
    case 'list':
      return {
        type: 'array',
        items: generateSchemaFromFields(field.fields),
        isRequired: !!field.required
      };
    case 'date':
      return {
        type: 'string',
        format: Validation.date,
        datetimeFormat: field.format,
        isRequired: !!field.required
      };
    case 'datetime':
      return {
        type: 'string',
        format: Validation.datetime,
        datetimeFormat: field.format,
        isRequired: !!field.required
      };
    case 'bool':
      return {
        type: 'boolean',
        format: Validation.bool,
        isRequired: false
      };
    case 'file':
      return {
        type: 'string',
        format: Validation.file,
        isRequired: !!field.required
      };
    case 'enum':
      return {
        type: 'string',
        format: Validation.enum,
        isRequired: !!field.required
      };
    case 'entity':
      return {
        type: 'string',
        format: Validation.entity,
        isRequired: !!field.required
      };
    case 'integer':
      return {
        type: 'number',
        format: Validation.number,
        isRequired: !!field.required
      };
    case 'string':
    default:
      return {
        type: 'string',
        format: Validation.string,
        formatPattern: field.pattern,
        formatError: field.error,
        isRequired: !!field.required
      };
  }
}

function _mergeObjectSchema(a, b) {
  invariant(a.type === 'object' && b.type === 'object');
  return {
    ...a, ...b,
    properties: {...a.properties, ...b.properties},
    required: _mergeRequired(a.required, b.required)
  };
}

function _mergeArraySchema(a, b) {
  return {
    ...a, ...b,
    items: {...a.items, ...b.items}
  };
}

function _mergeScalarSchema(a, b) {
  return {...a, ...b};
}

function _mergeRequired(a, b) {
  var merged = [];
  for (var i = 0; i < a.length; i++) {
    merged.push(a[i]);
  }
  for (var i = 0; i < b.length; i++) {
    if (merged.indexOf(b[i]) === -1) {
      merged.push(b[i]);
    }
  }
  return merged;
}

function _growSchema(schema, keyPath, grow) {
  if (keyPath.length === 0) {
    if (schema && schema.type === 'object') {
      return _mergeObjectSchema(schema, grow);
    } else if (schema && schema.type === 'array') {
      return _mergeArraySchema(schema, grow);
    } else {
      return _mergeScalarSchema(schema, grow);
    }
  }
  var key = keyPath.shift();
  if (schema) {
    invariant(schema.type === 'object');
  } else {
    schema = {type: 'object', properties: {}, required: []};
  }
  schema.properties[key] = _growSchema(schema.properties[key], keyPath, grow);
  if (schema.properties[key].isRequired) {
    schema.required = schema.required || [];
    schema.required.push(key);
  }
  return schema;
}

function _toKeyPath(keyPath) {
  if (Array.isArray(keyPath)) {
    return keyPath.slice(0);
  } else {
    return keyPath.split('.').filter(Boolean);
  }
}

var DATETIME_ISO_FORMAT = "YYYY-MM-DD HH:mm:ss";
var DATE_ISO_FORMAT = "YYYY-MM-DD";

var Validation = {
  string(value, node) {
    if (node.formatPattern) {
      if (new RegExp(node.formatPattern).exec(value) === null) {
        return node.formatError || 'does not match the pattern';
      }
    }
    return true;
  },

  datetime(value, node) {
    var date = moment(value, DATETIME_ISO_FORMAT, true);
    if (!date.isValid()) {
      return `should be in ${node.datetimeFormat} format`;
    }
    return true;
  },

  date(value, node) {
    var date = moment(value, DATE_ISO_FORMAT, true);
    if (!date.isValid()) {
      return `should be in ${node.datetimeFormat} format`;
    }
    return true;
  }
};

var SchemaUtils = {
  generateSchemaFromFields,
  Validation
};

module.exports = SchemaUtils;
