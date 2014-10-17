/**
 * @jsx React.DOM
 * @copyright Prometheus Research, LLC 2014
 */
'use strict';

var React     = require('react');
var PropTypes = React.PropTypes;

var CheckboxGroup = React.createClass({

  propTypes: {
    options: PropTypes.array.isRequired,
    value: PropTypes.array,
    onChange: PropTypes.func
  },

  render() {
    var name = this._rootNodeID;
    var value = this.props.value;
    var options = this.props.options.map((option) => {
      var checked = value && value.indexOf(option.value) > -1;
      return (
        <div
          className="rf-CheckboxGroup__button"
          key={option.value}>
          <label className="rf-CheckboxGroup__label">
            <input
              onChange={this.onChange}
              checked={checked}
              className="rf-CheckboxGroup__checkbox"
              type="checkbox"
              name={name}
              value={option.value} />
            <span className="rf-CheckboxGroup__caption">
              {option.name}
            </span>
          </label>
        </div>
      );
    });

    return (
      <div className="rf-CheckboxGroup">
        {options}
      </div>
    );
  },

  getDefaultProps() {
    return {value: []};
  },

  onChange(e) {
    if (!this.props.onChange) {
      return;
    }

    var nextValue = this.props.value.slice(0);

    if (e.target.checked) {
      nextValue.push(e.target.value);
    } else {
      var idx = nextValue.indexOf(e.target.value);
      if (idx > -1) {
        nextValue.splice(idx, 1);
      }
    }

    var values = this.props.options.map((o) => o.value);
    nextValue.sort((a, b) => values.indexOf(a) - values.indexOf(b));

    this.props.onChange(nextValue);
  }
});

module.exports = CheckboxGroup;
