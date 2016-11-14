/**
 * @flow
 */

import type {QueryPointer, Query, Expression} from '../../model';
import type {Actions} from '../../state';

import React from 'react';
import {VBox, HBox} from '@prometheusresearch/react-box';
import {style} from 'react-stylesheet';
import * as css from 'react-stylesheet/css';
import IconRemove from 'react-icons/lib/fa/trash';

import invariant from 'invariant';

import * as q from '../../model/Query';
import * as qp from '../../model/QueryPointer';
import * as QueryButton from '../QueryButton';
import * as QueryPane from '../QueryPane';
import QueryVisToolbar from './QueryVisToolbar';
import QueryVisButtonBase from './QueryVisButton';

class QueryVisButton extends React.Component {

  context: {
    actions: Actions;
  }

  static contextTypes = {
    actions: React.PropTypes.object,
  };

  onSelect = () => {
    this.context.actions.select(this.props.pointer);
  };

  onClose = () => {
    this.context.actions.remove(this.props.pointer);
  };

  render() {
    let {pointer, selected, ...props} = this.props;
    let isSelected = selected && qp.is(selected, pointer);
    return (
      <QueryVisButtonBase
        {...props}
        closeTitle="Remove"
        onClose={this.onClose}
        onSelect={this.onSelect}
        selected={isSelected}
        />
    );
  }
}

class QueryVisInsertAfterButton extends React.Component {

  props: {
    pointer: QueryPointer<q.Query>;
  };

  render() {
    let stylesheet = {
      Root: QueryPane.DefaultPane,
      Button: QueryButton.DefaultButton,
    };
    return (
      <QueryVisButtonBase
        selected
        stylesheet={stylesheet}
        label=""
        />
    );
  }
}


export function QueryVisNavigateButton(props: {
  pointer: QueryPointer<q.NavigateQuery>;
  children?: React$Element<*>;
}) {
  let {pointer, ...rest} = props;
  return (
    <QueryVisButton
      {...rest}
      selectable
      closeable
      stylesheet={{Root: QueryPane.NavigatePane, Button: QueryButton.NavigateButton}}
      pointer={pointer}
      label={getColumnTitle(pointer.query)}
      />
  );
}

function getColumnTitle(query: q.NavigateQuery): string {
  return query.path;
}

export function QueryVisDefineButton(props: {
  pointer: QueryPointer<q.DefineQuery>;
  selected: ?QueryPointer<>;
  insertAfter: ?QueryPointer<>;
}) {
  let {pointer, selected, insertAfter} = props;
  let bindingPointer: QueryPointer<q.QueryPipeline> = (
    qp.select(pointer, ['binding', 'query']): any
  );
  let isSelected = selected && qp.is(selected, pointer)
  return (
    <VBox>
      <QueryVisDefineWrapper>
        <QueryVisNavigationHeader
          selectable
          closeable
          closeTitle="Remove"
          selected={isSelected}
          label={pointer.query.binding.name}
          pointer={pointer}
          />
        <VBox paddingV={8} paddingLeft={8}>
          <QueryVisPipeline
            pointer={bindingPointer}
            selected={selected}
            insertAfter={insertAfter}
            />
        </VBox>
      </QueryVisDefineWrapper>
    </VBox>
  );
}

let QueryVisDefineWrapper = style(VBox, {
  displayName: 'QueryVisDefineWrapper',
  base: {
    borderLeft: css.border(1, '#bbb'),
    borderTop: css.border(1, '#bbb'),
    borderBottom: css.border(1, '#bbb'),
    boxShadow: css.boxShadow(-1, 1, 4, -1, '#aaa'),
    marginLeft: 2,
    marginBottom: 2,
    lastOfType: {
      marginBottom: 2,
    }
  },
});

export function QueryVisFilterButton(props: {
  pointer: QueryPointer<q.FilterQuery>;
}) {
  let {query} = props.pointer;
  let label = getLabelForFilterExpression(query.predicate);
  let stylesheet = {
    Root: QueryPane.FilterPane,
    Button: QueryButton.FilterButton,
  };
  return (
    <QueryVisButton
      {...props}
      selectable
      closeable
      stylesheet={stylesheet}
      label={label}
      />
  );
}

function getLabelForFilterExpression(expression: Expression): string {
  if (expression.name === 'logicalBinary' && expression.op === 'or') {
    let fields = [];
    expression.expressions.forEach(expr => {
      if (
        !(expr.name === 'value' && expr.value === true) &&
         expr.name === 'binary'
      ) {
        if (expr.left.name === 'navigate' && !fields.includes(expr.left.path)) {
          fields.push(expr.left.path);
        }
      }
    });

    if (fields.length) {
      return `Filter by ${fields.join(', ')}`;
    }
  }
  return 'Filter';
}

export function QueryVisGroupButton(props: {
  pointer: QueryPointer<q.GroupQuery>;
}) {
  const {pointer, ...rest} = props;
  return (
    <QueryVisButton
      {...rest}
      selectable
      closeable
      stylesheet={{Root: QueryPane.GroupPane, Button: QueryButton.GroupButton}}
      pointer={pointer}
      label={`Group by ${pointer.query.byPath.join(', ')}`}
      />
  );
}

export function QueryVisAggregateButton(props: {
  pointer: QueryPointer<q.AggregateQuery>;
}) {
  const {pointer, ...rest} = props;
  const domain = pointer.query.context.domain;
  const aggregate = domain.aggregate[pointer.query.aggregate];
  return (
    <QueryVisButton
      {...rest}
      selectable
      closeable
      stylesheet={{Root: QueryPane.AggregatePane, Button: QueryButton.AggregateButton}}
      pointer={pointer}
      label={aggregate.title}
      />
  );
}

class QueryVisNavigationHeader extends React.Component {

  context: {
    actions: Actions;
  }

  static contextTypes = {
    actions: React.PropTypes.object,
  };

  props: {
    label: string;
    pointer: QueryPointer<q.Query>;
    closeable?: boolean;
    closeTitle?: string;
    selected?: ?boolean;
    selectable?: boolean;
  };

  onRemove = (ev: UIEvent) => {
    ev.stopPropagation();
    this.context.actions.cut(this.props.pointer);
  };

  onSelect = (ev: UIEvent) => {
    ev.stopPropagation();
    this.context.actions.select(this.props.pointer);
  };

  render() {
    const {
      label,
      selectable,
      selected,
      closeable,
      closeTitle,
    } = this.props;
    return (
      <QueryVisNavigationHeaderRoot
        variant={{selected}}
        onClick={selectable && this.onSelect}>
        <HBox grow={1} alignItems="center">
          {label}
        </HBox>
        {closeable &&
          <HBox>
            <QueryButton.DefaultButton
              title={closeTitle}
              onClick={this.onRemove}>
              <IconRemove />
            </QueryButton.DefaultButton>
          </HBox>}
      </QueryVisNavigationHeaderRoot>
    );
  }
}

let QueryVisNavigationHeaderRoot = style(HBox, {
  displayName: 'QueryVisNavigationHeaderRoot',
  base: {
    height: 34,
    fontSize: '12px',
    fontWeight: 300,
    backgroundColor: '#F1F1F1',
    color: '#666',
    cursor: 'default',
    textTransform: css.textTransform.capitalize,
    userSelect: css.none,
    borderBottom: css.border(1, '#bbb'),
    paddingLeft: 10,
    paddingRight: 5,
    paddingTop: 7,
    paddingBottom: 7,
  },
  selected: {
    borderLeft: css.border(3, '#bbb'),
    zIndex: 1,
  }
});

function QueryVisQueryButton(props: {
  pointer: QueryPointer<>;
  selected: ?QueryPointer<>;
  insertAfter: ?QueryPointer<>;
  closeable?: boolean;
}) {
  const {pointer, ...rest} = props;
  if (pointer.query.name === 'here') {
    return null;
  } else if (pointer.query.name === 'navigate') {
    return (
      <QueryVisNavigateButton
        {...rest}
        pointer={((pointer: any): QueryPointer<q.NavigateQuery>)}
        />
    );
  } else if (pointer.query.name === 'filter') {
    return (
      <QueryVisFilterButton
        {...rest}
        pointer={((pointer: any): QueryPointer<q.FilterQuery>)}
        />
    );
  } else if (pointer.query.name === 'pipeline') {
    return (
      <QueryVisPipeline
        {...rest}
        pointer={((pointer: any): QueryPointer<q.QueryPipeline>)}
        />
    );
  } else if (pointer.query.name === 'select') {
    return null;
  } else if (pointer.query.name === 'define') {
    return (
      <QueryVisDefineButton
        {...rest}
        pointer={((pointer: any): QueryPointer<q.DefineQuery>)}
        />
    );
  } else if (pointer.query.name === 'group') {
    return (
      <QueryVisGroupButton
        {...rest}
        pointer={((pointer: any): QueryPointer<q.GroupQuery>)}
        />
    );
  } else if (pointer.query.name === 'aggregate') {
    return (
      <QueryVisAggregateButton
        {...rest}
        pointer={((pointer: any): QueryPointer<q.AggregateQuery>)}
        />
    );
  } else if (pointer.query.name === 'select') {
    return null;
  } else if (pointer.query.name === 'limit') {
    return null;
  } else {
    invariant(false, 'Unknown query type: %s', pointer.query.name);
  }
}

function QueryVisPipeline({pointer, closeable, insertAfter, ...props}: {
  pointer: QueryPointer<q.QueryPipeline>;
  selected: ?QueryPointer<Query>;
  insertAfter: ?QueryPointer<>;
  closeable?: boolean;
}) {
  let pipeline = qp.spread(pointer);
  let topLevel = pointer.path.length === 0;
  let items = [];
  let disableAdd = false;
  pipeline.forEach((pointer, idx) => {
    items.push(
      <QueryVisPipelineItem key={idx} variant={{topLevel}}>
        <QueryVisQueryButton
          {...props}
          insertAfter={insertAfter}
          closeable={closeable && idx > 0}
          pointer={pointer}
          />
      </QueryVisPipelineItem>
    );
    if (qp.is(pointer, insertAfter)) {
      disableAdd = true;
      items.push(
        <QueryVisPipelineItem key="__insertAfter__" variant={{topLevel}}>
          <QueryVisInsertAfterButton
            pointer={pointer}
            />
        </QueryVisPipelineItem>
      );
    }
  });
  let last = pipeline[pipeline.length - 1];
  let insertAfterPointer = last.query.name === 'select'
    ? pipeline[pipeline.length - 2]
    : last;
  return (
    <QueryVisPipelineRoot paddingLeft={topLevel ? 8 : 0}>
      {items}
      <QueryVisToolbar
        disableAdd={disableAdd}
        pointer={insertAfterPointer}
        />
    </QueryVisPipelineRoot>
  );
}

let QueryVisPipelineRoot = style(VBox, {
  displayName: 'QueryVisPipelineRoot',
  base: {
    backgroundColor: '#fff',
  }
});

let QueryVisPipelineItem = style(VBox, {
  displayName: 'QueryVisPipelineItem',
  base: {
    marginBottom: 5,
    lastOfType: {
      marginBottom: 0,
    }
  },
  topLevel: {
    marginBottom: 10,
    lastOfType: {
      marginBottom: 0,
    }
  }
});

type QueryVisProps = {
  pointer: QueryPointer<Query>;
  onShowSelect: () => *;
  selected: ?QueryPointer<>;
  insertAfter: ?QueryPointer<>;
};

/**
 * Render graphical query representation.
 */
export class QueryVis extends React.Component<*, QueryVisProps, *> {

  render() {
    let {pointer, selected, insertAfter} = this.props;
    return (
      <VBox grow={1}>
        <QueryVisNavigationHeader
          pointer={pointer}
          label="My Queries"
          />
        <QueryVisQueryButton
          selected={selected}
          insertAfter={insertAfter}
          pointer={pointer}
          />
      </VBox>
    );
  }

  onShowSelect = (e: UIEvent) => {
    e.stopPropagation();
    this.props.onShowSelect();
  };

}
