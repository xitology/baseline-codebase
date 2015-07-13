/**
 * @copyright 2015, Prometheus Research, LLC
 */

import React           from 'react';
import RexWidget       from 'rex-widget';
import Action          from '../Action';
import ActionButton    from '../ActionButton';
import SidebarRenderer from '../SidebarRenderer';

let {VBox} = RexWidget.Layout;
let {linearGradient, border, borderStyle, rgb, insetBoxShadow} = RexWidget.StyleUtils;

let Style = {

  sidebar: {
    background: rgb(210),
    boxShadow: insetBoxShadow(0, 1, 3, 0, rgb(186))
  },

  sidebarButton: {
    fontSize: '80%'
  }
};

@SidebarRenderer
export default class Alternative extends React.Component {

  static defaultProps = {
    width: 480,
    title: 'Alternative',
    icon: 'file'
  };

  constructor(props) {
    super(props);
    this.state = {index: 0};
  }

  render() {
    let {actions, ...props} = this.props;
    let action = actions[this.state.index];
    return React.cloneElement(action, {
      ...props,
      onContext: this.onContext
    });
  }

  renderSidebar() {
    let buttons = this.props.actions.map((action, index) =>
      <ActionButton
        align="right"
        style={Style.sidebarButton}
        key={action.props.id}
        active={index === this.state.index}
        action={action}
        onClick={() => this.setState({index})}
        />
    );
    return (
      <VBox style={Style.sidebar}>
        {buttons}
      </VBox>
    );
  }

  onContext = (context) => {
    this.setState({index: 0});
    this.props.onContext(context);
  }

  static getIcon(props) {
    let Actions = require('../Actions');
    return Actions.getIcon(props.actions[0]);
  }
}
