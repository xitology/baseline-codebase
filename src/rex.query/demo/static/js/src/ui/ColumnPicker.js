/**
 * @flow
 */

import type {Query, Context} from '../model/Query';
import type {QueryPointer} from '../model/QueryPointer';
import type {Actions} from '../state';

import React from 'react';
import {VBox, HBox} from '@prometheusresearch/react-box';
import * as ReactUI from '@prometheusresearch/react-ui';
import {style} from 'react-stylesheet';
import * as css from 'react-stylesheet/css';

import * as FieldList from '../state/FieldList';
import * as t from '../model/Type';
import * as q from '../model/Query';
import {MenuGroup, MenuButton} from './menu';
import PlusIcon from './PlusIcon';

type Navigation = {
  value: string;
  label: string;
  context: Context;
};

type ColumnPickerProps = {
  pointer: QueryPointer<Query>;
  before?: boolean;
  selected: FieldList.FieldList;
  onSelect: (path: Array<string>) => *;
  allowNested?: boolean;
};

export default class ColumnPicker extends React.Component<*, ColumnPickerProps, *> {

  state: {
    searchTerm: ?string;
  };

  context: {
    actions: Actions;
  };

  static contextTypes = {actions: React.PropTypes.object};

  state = {
    searchTerm: null,
  };

  render() {
    let {pointer, before, allowNested, selected: selectedList, onSelect} = this.props;
    let options = before
      ? getNavigationBefore(pointer.query.context)
      : getNavigationAfter(pointer.query.context);
    let {searchTerm} = this.state;
    if (searchTerm != null) {
      let searchTermRe = new RegExp(searchTerm, 'ig');
      options = options.filter(column => {
        return searchTermRe.test(column.label) || searchTermRe.test(column.value);
      });
    }
    let entityGroup = [];
    let fieldGroup = [];
    options.forEach(column => {
      let selected = FieldList.findBy(selectedList, column.value);
      let type = t.maybeAtom(column.context.type);
      let isEntity = type && type.name === 'entity';
      let button = (
        <ColumnPickerButton
          key={column.value}
          path={[column.value]}
          column={column}
          onSelect={onSelect}
          selected={selected != null}
          actions={this.context.actions}
          />
      );
      if (allowNested && isEntity && selected != null) {
        button = (
          <VBox key={column.value}>
            {button}
            <VBox paddingLeft={15}>
              <ColumnPickerGroup
                path={[column.value]}
                allowNested={allowNested}
                context={column.context}
                selected={selected}
                onSelect={onSelect}
                actions={this.context.actions}
                />
            </VBox>
          </VBox>
        );
      }
      if (isEntity) {
        entityGroup.push(button);
      } else {
        fieldGroup.push(button);
      }
    });
    return (
      <VBox>
        <VBox padding={10}>
          <ReactUI.Input
            placeholder="Search columns…"
            value={searchTerm === null ? '' : searchTerm}
            onChange={this.onSearchTerm}
            />
        </VBox>
        <MenuGroup paddingV={20}>
          <MenuButton icon="＋" onClick={this.onAddDefine}>
            Define new attribute
          </MenuButton>
        </MenuGroup>
        {entityGroup.length > 0 &&
          <VBox paddingBottom={10}>
            <MenuGroup title="Entity">
              {entityGroup}
            </MenuGroup>
          </VBox>}
        {fieldGroup.length > 0 &&
          <VBox>
            <MenuGroup title="Field">
              {fieldGroup}
            </MenuGroup>
          </VBox>}
      </VBox>
    );
  }

  onAddDefine = (e: UIEvent) => {
    e.stopPropagation();
    this.context.actions.appendDefine({
      pointer: this.props.pointer,
      select: true,
    });
  };

  onSearchTerm = (e: UIEvent) => {
    let target: {value: string} = (e.target: any);
    this.setState({searchTerm: target.value === '' ? null : target.value});
  };
}

class ColumnPickerButton extends React.Component {

  state: {
    hover: boolean;
  };

  props: {
    selected: boolean;
    path: Array<string>;
    column: {label: string; value: string, context: Context};
    onSelect: (path: Array<string>) => *;
    actions: Actions;
  };

  state = {
    hover: false,
  };

  onSelect = (e: UIEvent) => {
    e.stopPropagation();
    let {onSelect, path} = this.props;
    onSelect(path);
  };

  onHover = () => {
    this.setState({hover: true});
  };

  onHoverOff = () => {
    this.setState({hover: false});
  };

  onNavigate = (e: UIEvent) => {
    e.stopPropagation();
    let {actions, path} = this.props;
    actions.appendNavigate({path, select: false});
  };

  onDefine = (e: UIEvent) => {
    e.stopPropagation();
    let {actions, path} = this.props;
    actions.appendDefine({path, select: false});
  };

  render() {
    let {column, selected} = this.props;
    let {hover} = this.state;
    let buttonGroup = hover
      ?  <HBox>
          <ReactUI.QuietButton
            icon={<PlusIcon />}
            onClick={this.onNavigate}
            groupHorizontally
            size="x-small">
            Nav
          </ReactUI.QuietButton>
          <ReactUI.QuietButton
            icon={<PlusIcon />}
            onClick={this.onDefine}
            groupHorizontally
            size="x-small">
            Def
          </ReactUI.QuietButton>
        </HBox>
      : column.context.type
      ? <ColumnType alignSelf="center">
          {t.toString(column.context.type)}
        </ColumnType>
      : null;
    return (
      <MenuButton
        onMouseEnter={this.onHover}
        onMouseLeave={this.onHoverOff}
        selected={selected}
        icon={selected ? '✓' : null}
        buttonGroup={buttonGroup}
        onClick={this.onSelect}>
        <VBox grow={1} justifyContent="center">
          {column.label}
        </VBox>
      </MenuButton>
    );
  }
}

function ColumnPickerGroup({
  actions, path, selected: selectedList, context, onSelect, allowNested
}) {
  let buttons = getNavigationAfter(context).map(column => {
    let selected = FieldList.findBy(selectedList, column.value);
    let type = t.maybeAtom(column.context.type);
    let isEntity = type && type.name === 'entity';
    let button = (
      <ColumnPickerButton
        path={path.concat(column.value)}
        key={column.value}
        column={column}
        onSelect={onSelect}
        selected={selected != null}
        actions={actions}
        />
    );
    if (allowNested && isEntity && selected) {
      button = (
        <VBox key={column.value}>
          {button}
          <VBox paddingLeft={15}>
            <ColumnPickerGroup
              path={path.concat(column.value)}
              allowNested={allowNested}
              context={column.context}
              selected={selected}
              onSelect={onSelect}
              actions={actions}
              />
          </VBox>
        </VBox>
      );
    }
    return button;
  });
  return <ColumnPickerGroupRoot>{buttons}</ColumnPickerGroupRoot>;
}

let ColumnPickerGroupRoot = style(VBox, {
  base: {
    borderLeft: css.border(1, '#eee'),
  }
});

let ColumnType = style(HBox, {
  displayName: 'ColumnType',
  base: {
    paddingLeft: 10,
    paddingRight: 10,
    fontFamily: 'Menlo, Monaco, monospace',
    fontSize: '7pt',
    color: '#888',
  }
});

function getNavigationBefore(context: Context): Array<Navigation> {
  return getNavigation(context, context.inputType);
}

function getNavigationAfter(context: Context): Array<Navigation> {
  return getNavigation(context, context.type);
}

function getNavigation(context, type) {
  let {scope, domain} = context;
  let navigation = [];

  let contextAtQuery = {
    ...context,
    type: t.maybeAtom(type),
  };

  // Collect paths from an input type
  if (type != null) {
    let baseType = t.atom(type);
    if (baseType.name === 'void') {
      for (let k in domain.entity) {
        if (domain.entity.hasOwnProperty(k)) {
          navigation.push({
            value: k,
            label: domain.entity[k].title,
            context: q.inferTypeStep(contextAtQuery, q.navigate(k)).context,
          });
        }
      }
    } else if (baseType.name === 'entity') {
      let attribute = domain.entity[baseType.entity].attribute;
      for (let k in attribute) {
        if (attribute.hasOwnProperty(k)) {
          navigation.push({
            value: k,
            label: attribute[k].title,
            context: q.inferTypeStep(contextAtQuery, q.navigate(k)).context,
          });
        }
      }
    }
  }

  for (let k in scope) {
    if (scope.hasOwnProperty(k)) {
      navigation.push({
        value: k,
        label: k,
        context: q.inferTypeStep(contextAtQuery, scope[k]).context,
      });
    }
  }

  return navigation;
}
