/**
 * @copyright 2015, Prometheus Research, LLC
 */
'use strict';

var React                       = require('react');
var RexWidget                   = require('rex-widget');
var emptyFunction               = RexWidget.emptyFunction;
var {VBox, HBox}                = RexWidget.Layout;
var {overflow, boxShadow, rgb}  = RexWidget.StyleUtils;
var Theme                       = require('./Theme');

var Style = {
  header: {
    boxShadow: Theme.shadow.light,
    padding: 10
  },
  content: {
    padding: 10,
    overflow: overflow.auto
  },
  footer: {
    boxShadow: Theme.shadow.light,
    padding: 5
  }
};

var Action = React.createClass({

  propTypes: {
    /**
     * Action title.
     */
    title: React.PropTypes.string,

    /**
     * Content area.
     */
    children: React.PropTypes.node,

    /**
     * Callback which is invoked when close button is clicked.
     */
    onClose: React.PropTypes.func,

    /**
     * Action width.
     */
    width: React.PropTypes.number,

    /**
     * Render callback for footer.
     */
    renderFooter: React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      renderFooter: emptyFunction.thatReturnsNull
    };
  },

  render() {
    var {children, title, onClose, width} = this.props;
    var footer = this.props.renderFooter();
    return (
      <VBox style={{width}} size={1}>
        <HBox style={Style.header}>
          {title &&
            <VBox size={1}>
              <h4>{title}</h4>
            </VBox>}
          {onClose &&
            <RexWidget.Button
              quiet
              icon="remove"
              onClick={onClose}
              />}
        </HBox>
        <VBox size={1} style={Style.content}>
          {children}
        </VBox>
        {footer &&
          <VBox style={Style.footer}>
            {footer}
          </VBox>}
      </VBox>
    );
  }
});

module.exports = Action;


