/*
 * Copyright (c) 2015, Prometheus Research, LLC
 */

'use strict';

var ReactForms = require('react-forms');

var RangedProperty = require('./RangedProperty');


class NumericRange extends RangedProperty {
  static create(props) {
    props = props || {};
    props.scalarType = ReactForms.schema.NumberNode;
    return RangedProperty.create(props);
  }
}


module.exports = NumericRange;
