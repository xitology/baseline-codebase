/**
 * @flow
 */

import type {Expression, FilterQuery} from '../model/types';
import type {Actions} from '../state';

import * as React from 'react';
import {Element} from 'react-stylesheet';
import * as ReactUI from '@prometheusresearch/react-ui';

import * as q from '../model/Query';
import * as qn from '../model/QueryNavigation';
import {Icon, Theme, Menu} from '../ui';
import QueryPanelBase from './QueryPanelBase';
import FilterCondition from './filter/FilterCondition';

function ORSeparator() {
  return (
    <Element
      position="relative"
      padding={{vertical: 10}}
      textAlign="center"
      fontWeight={300}
      color="#888"
      fontSize="0.7em">
      <hr />
      <Element
        position="absolute"
        top={5}
        left="50%"
        width={25}
        marginLeft={-12.5}
        padding={5}
        background="#fff">
        OR
      </Element>
    </Element>
  );
}

type FilterQueryPanelProps = {
  query: FilterQuery,
  onClose: () => *,
};

type FilterQueryPanelState = {
  expressions: Array<Expression>,
};

export default class FilterQueryPanel extends React.Component<
  FilterQueryPanelProps,
  FilterQueryPanelState,
> {
  context: {
    actions: Actions,
  };

  static contextTypes = {actions: React.PropTypes.object};

  constructor(props: FilterQueryPanelProps) {
    super(props);
    let {predicate} = props.query;
    if (
      predicate.name === 'logicalBinary' &&
      predicate.op === 'or' &&
      predicate.expressions.length > 0
    ) {
      this.state = {
        expressions: predicate.expressions,
      };
    } else {
      this.state = {
        expressions: [q.value(true)],
      };
    }
  }

  componentWillReceiveProps(nextProps: FilterQueryPanelProps) {
    const {predicate} = nextProps.query;
    let expressions = [q.value(true)];
    if (predicate && predicate.name === 'logicalBinary') {
      expressions = predicate.expressions;
    }
    this.setState({expressions});
  }

  render() {
    let {onClose, query} = this.props;
    let {expressions} = this.state;

    let navigation = Array.from(qn.getNavigation(query.context).values());
    let fields = navigation.filter(field => {
      let type = field.context.type;
      return type.name !== 'invalid';
    });

    let conditions = expressions.map((expression, idx) => {
      let isInvalid = expression.context.type.name === 'invalid';
      return (
        <Element key={idx}>
          {idx !== 0 && <ORSeparator />}
          <Element
            border={!isInvalid ? 'none' : `1px solid ${Theme.invalid.borderColor}`}
            padding={{horizontal: 5, vertical: 10}}>
            {expressions.length > 1 &&
              <Element textAlign="right" marginBottom={5}>
                <ReactUI.QuietButton
                  size="x-small"
                  title="Remove filter condition"
                  icon={<Icon.IconRemove />}
                  onClick={this.onConditionRemove.bind(this, idx)}
                />
              </Element>}
            <Element verticalAlign="middle">
              <FilterCondition
                fields={fields}
                expression={expression}
                onUpdate={this.onConditionUpdate.bind(this, idx)}
              />
            </Element>
          </Element>
        </Element>
      );
    });

    return (
      <QueryPanelBase title="Filter" onClose={onClose} theme={Theme.filter} query={query}>
        <ReactUI.VBox overflow="visible" padding={0}>
          <ReactUI.VBox overflow="visible" padding={5}>
            {conditions}
          </ReactUI.VBox>
          <Menu.MenuGroup padding={{vertical: 20}}>
            <Menu.MenuButton icon="＋" onClick={this.onAddCondition}>
              Add Another Condition
            </Menu.MenuButton>
          </Menu.MenuGroup>
        </ReactUI.VBox>
      </QueryPanelBase>
    );
  }

  onAddCondition = () => {
    let expressions = this.state.expressions.slice();
    expressions.push(q.value(true));
    this.setState({expressions});
  };

  onConditionUpdate(index: number, condition: Expression) {
    let expressions = this.state.expressions.slice();
    expressions[index] = condition;
    this.setState({expressions}, () => this.updateQuery());
  }

  onConditionRemove(index: number) {
    let expressions = this.state.expressions.slice();
    expressions.splice(index, 1);
    this.setState({expressions}, () => this.updateQuery());
  }

  updateQuery() {
    let {expressions} = this.state;

    expressions = expressions.filter(
      expression => !(expression.name === 'value' && expression.value === true),
    );

    let expression =
      expressions.length > 0
        ? q.or(
            ...expressions.map(expression =>
              q.inferExpressionType(this.props.query.context, expression),
            ),
          )
        : q.or(q.value(true));

    this.context.actions.setFilter({
      at: this.props.query,
      expression,
    });
  }
}
