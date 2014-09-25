/**
 * @jsx React.DOM
 */
'use strict';

var React            = require('react/addons');
var cx               = React.addons.classSet;
var LoadingIndicator = require('./LoadingIndicator');

var Preloader = React.createClass({

  render() {
    return (
      <div className={cx("rw-Preloader", this.props.className)}>
        <LoadingIndicator /> 
        {this.props.caption &&
          <div className="rw-Preloader__caption">
            {this.props.caption}
          </div>}
      </div>
    );
  },

  getDefaultProps() {
    return {caption: null};
  }
});

module.exports = Preloader;
