/*
 * Copyright (c) 2015, Prometheus Research, LLC
 */

'use strict';

var objectPath = require('object-path');
var deepCopy = require('deep-copy');

var Question = require('./Question');
var properties = require('../../properties');
var {isEmpty} = require('../../util');
var _ = require('../../i18n').gettext;


class Time extends Question {
  static getName() {
    return _('Time');
  }

  static getTypeID() {
    return 'question-time';
  }

  static getPropertyConfiguration(isSubElement) {
    var cfg = Question.getPropertyConfiguration(isSubElement);
    cfg.properties.advanced.unshift(
      {
        name: 'range',
        minLabel: _('Earliest Time'),
        maxLabel: _('Latest Time'),
        schema: properties.TimeRange
      }
    );
    return cfg;
  }

  constructor() {
    super();
    this.range = {};
  }

  parse(element, instrument, field) {
    super.parse(element, instrument, field);
    this.range = objectPath.get(field, 'type.range', {});
  }

  serialize(instrument, form, context) {
    context = context || this;

    /*eslint no-redeclare:0 */
    var {instrument, form} = super.serialize(instrument, form, context);

    var field = context.getCurrentSerializationField(instrument);
    if (!isEmpty(this.range)) {
      objectPath.set(field, 'type.base', 'time');
      objectPath.set(field, 'type.range', this.range);
    } else {
      field.type = 'time';
    }

    return {
      instrument,
      form
    };
  }

  clone(exact, configurationScope) {
    var newElm = super.clone(exact, configurationScope);
    newElm.range = deepCopy(this.range);
    return newElm;
  }
}


Question.registerElement(
  Time,
  function (element, instrument, field) {
    if (field.type.rootType === 'time') {
      var widget = objectPath.get(element, 'options.widget.type');
      if (!widget || (widget === 'timePicker')) {
        var elm = new Time();
        elm.parse(element, instrument, field);
        return elm;
      }
    }
  }
);


module.exports = Time;

