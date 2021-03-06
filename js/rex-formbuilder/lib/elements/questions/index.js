/*
 * Copyright (c) 2015, Prometheus Research, LLC
 */

'use strict';

var Question = require('./Question');
var ShortText = require('./ShortText');
var LongText = require('./LongText');
var Integer = require('./Integer');
var Float = require('./Float');
var BooleanQuestion = require('./Boolean');
var RadioButtonGroup = require('./RadioButtonGroup');
var DropDownMenu = require('./DropDownMenu');
var CheckBoxGroup = require('./CheckBoxGroup');
var DateQuestion = require('./Date');
var Time = require('./Time');
var DateTime = require('./DateTime');
var RepeatingGroup = require('./RepeatingGroup');
var QuestionGrid = require('./QuestionGrid');
var LookupText = require('./LookupText');


module.exports = {
  Question,
  ShortText,
  LongText,
  Integer,
  Float,
  Boolean: BooleanQuestion,
  RadioButtonGroup,
  DropDownMenu,
  CheckBoxGroup,
  Date: DateQuestion,
  Time,
  DateTime,
  RepeatingGroup,
  QuestionGrid,
  LookupText
};

