/**
 * This module exports all available actions for a query builder.
 *
 * @flow
 */

import type {
  State,
  StateUpdater,
} from './index';

import type {
  DefineQuery,
  QueryAtom,
  QueryPipeline,
  AggregateQuery,
  NavigateQuery,
  FilterQuery,
  Expression,
} from '../model';

import createLogger from 'debug';
import invariant from 'invariant';
import * as d from '../model/Domain';
import * as q from '../model/Query';
import * as qo from '../model/QueryOperation';
import * as QueryLoc from '../model/QueryLoc';
import * as Fetch from '../fetch';
import * as Focus from './Focus';

let logAction = createLogger('rex-query:state:actions');

/**
 * Initialize query buiulder.
 */
export function init(): StateUpdater {
  return state => {
    return [state, refetchQuery];
  };
}

/**
 * Navigate.
 */
export function navigate({at, path}: {
  at: QueryPipeline,
  path: Array<string>,
}): StateUpdater {
  logAction('navigate', {at, path});
  return state => {
    let add = null;
    let type = q.inferTypeAtPath(at.context.prev, path);
    if (type.card === 'seq' && type.name === 'record' && type.entity != null) {
      add = q.aggregate('count');
    }
    let query = qo.editor(state.query, at)
      .growNavigation({path: path, add: add})
      .getQuery();
    return onQuery(state, {query, selected: state.selected});
  };
}

/**
 * Put a focus on a sequence in a datatable.
 */
export function focusOnSeq(params: {focusedSeq: Focus.Focus}): StateUpdater {
  const {focusedSeq} = params;
  return state => {
    return {...state, focusedSeq};
  };
}

/**
 * Initiate export procedure.
 */
export function exportDataset(): StateUpdater {
  return state => {
    Fetch.initiateDownload(state.api, state.query, {})
      .catch(err => {
        console.error('Error while exporting dataset:', err);
      });
    return state;
  };
}

/**
 * Show column picker.
 */
export function showSelect(): StateUpdater {
  return state => {
    return {...state, showPanel: true, selected: null};
  };
}

/**
 * Show field selection panel.
 */
export function showPanel(): StateUpdater {
  return state => {
    return {...state, showPanel: true};
  };
}

/**
 * Hide field selection panel.
 */
export function hidePanel(): StateUpdater {
  return state => {
    return {
      ...state,
      showPanel: state.insertAfter != null && state.prevSelected
        ? true
        : false,
      insertAfter: null,
      selected: state.insertAfter != null
        ? state.prevSelected
        : null,
      prevSelected: null,
    };
  };
}

/**
 * Undo.
 */
export function undo(): StateUpdater {
  return state => {
    let undoStack = state.undoStack.slice(0);
    let {query, selected} = undoStack.pop();
    let redoStack = state.redoStack.concat({
      query: state.query,
      selected: state.selected,
    });
    let nextState = {...state, query, selected, undoStack, redoStack};
    return [
      nextState,
      refetchQuery,
    ];
  };
}

/**
 * Redo.
 */
export function redo(): StateUpdater {
  return state => {
    let redoStack = state.redoStack.slice(0);
    let {query, selected} = redoStack.pop();
    let undoStack = state.undoStack.concat({
      query: state.query,
      selected: state.selected,
    });
    let nextState = {...state, query, selected, undoStack, redoStack};
    return [
      nextState,
      refetchQuery
    ];
  }
};

/**
 * Initiate new query combinator insertion.
 */
export function setActiveQueryPipeline({pipeline}: {pipeline: QueryPipeline}): StateUpdater {
  return state => {
    return {
      ...state,
      activeQueryPipeline: pipeline,
      selected: null,
      prevSelected: state.selected,
      showPanel: true
    };
  };
};

/**
 * Select a combinator in a query vis panel.
 */
export function setSelected({query}: {query: ?QueryAtom}): StateUpdater {
  logAction('select', {query});
  return state => {
    return {
      ...state,
      selected: query,
      showPanel: true,
      activeQueryPipeline: null,
    };
  };
};

/**
 * Remove a query combinator at pointer.
 */
export function cut({at}: {at: QueryAtom | QueryPipeline}): StateUpdater {
  logAction('cut', at);
  return state => {
    let query = qo.editor(state.query, at, {edge: 'leading'})
      .cut()
      .getQuery();
    return onQuery(state, {query, selected: state.selected});
  };
}

/**
 * Remove a query combinator at pointer.
 */
export function remove({at}: {at: QueryPipeline | QueryAtom}): StateUpdater {
  logAction('remove', {at});
  return state => {
    let editor = qo.editor(state.query, at);
    if (at.name === 'navigate') {
      let query = editor.cut().getQuery();
      return onQuery(state, {query});
    } else {
      if (at.name === 'group') {
        editor = editor.removeSelect();
      }
      editor = editor.remove()
      let query = editor.getQuery();
      return onQuery(state, {query});
    }
  };
}

export function setAggregate({at, aggregate, path}: {
  at: AggregateQuery,
  aggregate: string,
  path?: ?string,
}): StateUpdater {
  logAction('setAggregate', {at});
  return state => {
    if (path == null) {
      path = null
    }
    let nextAggregate = q.aggregate(aggregate, path);
    let query = qo.editor(state.query, at)
      .replaceWith(nextAggregate)
      .getQuery();
    return onQuery(state, {query, selected: nextAggregate});
  };
}

export function setNavigate({at, path}: {
  at: NavigateQuery,
  path: string,
}): StateUpdater {
  logAction('setNavigate', {at});
  return state => {
    let nextNavigate = q.navigate(path)
    let query = qo.editor(state.query, at)
      .removeSelect()
      .replaceWith(nextNavigate)
      .getQuery();
    return onQuery(state, {query, selected: nextNavigate});
  };
}

export function setFilter({at, expression}: {
  at: FilterQuery,
  expression: Expression,
}): StateUpdater {
  logAction('setFilter', {at});
  return state => {
    let nextFilter = q.filter(expression);
    let query = qo.editor(state.query, at)
      .replaceWith(nextFilter)
      .getQuery();
    return onQuery(state, {query, selected: nextFilter});
  };
}

/**
 * Update group query with new column list.
 */
export function setGroupByPath(
  {at, byPath}: {
    at: q.GroupQuery,
    byPath: Array<string>,
  }
): StateUpdater {
  return state => {
    let prevType = at.context.prev.type;
    invariant(
      prevType && prevType.name === 'record' && prevType.entity != null,
      'Invalid type info'
    );
    const entity = prevType.entity;

    let editor = qo.editor(state.query, at)

    editor = editor
      .transformWith(query => ({
        id: query.id,
        name: 'group',
        byPath: byPath,
        context: query.context,
      }));

    if (byPath.length === 0) {
      editor = editor.removeSelect();
    }

    editor = editor
      .inferType()
      .growNavigation({
        path: [entity],
        add: q.aggregate('count')
      })

    let query = editor.getQuery();

    return onQuery(state, {query, selected: state.selected});
  };
}

/**
 * Append a new navigate combinator at pointer.
 */
export function appendNavigate(
  {at, path = []}: {
    at: QueryPipeline;
    path?: Array<string>;
  }
): StateUpdater {
  logAction('appendNavigate', {at, path});
  return state => {
    if (path.length === 0) {
      return state;
    }
    let query = qo.editor(state.query, at)
      .insertAfter({what: path.map(q.use)})
      .getQuery()
    return onQuery(state, {query, selected: state.selected || state.prevSelected});
  };
}

/**
 * Append a new define combinator at query.
 */
export function appendDefine(
  {at, path, select}: {
    at: QueryPipeline;
    path?: Array<string>;
    select?: boolean;
  }
): StateUpdater {
  logAction('appendDefine', {at, path, select});
  return state => {
    let name = generateQueryID(
      at.context.scope,
      path
        ? `${path.join(' ')} query`
        : 'query'
    );

    let expression = path != null
      ? q.pipeline(...path.map(q.use))
      : q.pipeline(q.use(''));

    let def = q.def(name, expression);

    let query = qo.editor(state.query, at)
      .insertAfter({what: [def]})
      .growNavigation({path: [name]})
      .getQuery();
    query = q.inferType(state.domain, query);
    return onQuery(state, {query, selected: select ? def : null, activeQueryPipeline: null});
  };
}

/**
 * Append a new filter combinator at pointer.
 */
export function appendFilter({at}: {
    at: QueryPipeline
  }): StateUpdater {
  logAction('appendFilter', {at});
  return state => {
    let filter = q.filter(q.or(q.value(true)));
    let query = qo.editor(state.query, at)
      .insertAfter({what: [filter]})
      .getQuery();
    return onQuery(state, {query, selected: filter});
  };
}

/**
 * Append a new filter combinator to a pipeline.
 */
export function appendGroup({at}: {
  at: QueryPipeline
}): StateUpdater {
  return state => {
    let group = q.group([]);
    let query = qo.editor(state.query, at)
      .insertAfter({what: [group]})
      .getQuery();
    return onQuery(state, {query, selected: group});
  };
}

/**
 * Append a new aggregate combinator to a pipeline.
 */
export function appendAggregate({at}: {
  at: QueryPipeline
}): StateUpdater {
  return state => {
    let aggregate = q.aggregate('count');
    let query = qo.editor(state.query, at)
      .insertAfter({what: [aggregate]})
      .getQuery();
    return onQuery(state, {query, selected: aggregate});
  };
}

/**
 * Append a new aggregate combinator at pointer.
 */
export function appendDefineAndAggregate({at, path, aggregate}: {
  at: QueryPipeline,
  path: Array<string>;
  aggregate: d.DomainAggregate;
}): StateUpdater {
  return state => {
    let name = generateQueryID(at.context.scope, path.join(' ') + ' Query');
    let query = qo.editor(state.query, at)
      .transformPipelineWith(pipeline => {
        pipeline = pipeline.slice(0);
        let select = null;
        if (pipeline[pipeline.length - 1].name === 'select') {
          select = pipeline.pop();
        }
        let innerPipeline = [];
        if (path.length > 0) {
          innerPipeline = innerPipeline.concat(path.map(p => q.use(p)));
        } else {
          innerPipeline.push(q.here);
        }
        innerPipeline.push(q.aggregate(aggregate.name));
        pipeline.push(
          q.def(
            name,
            q.pipeline(...innerPipeline),
          )
        );
        if (select) {
          pipeline.push(select);
        }
        return pipeline;
      })
      //.growNavigation({path: [name]})
      .getQuery();
    return onQuery(state, {query, selected: state.prevSelected, activeQueryPipeline: null});
  };
}

/**
 * Rename define combinator binding at pointer.
 */
export function renameDefineBinding(
  {at, name}: {
    at: DefineQuery,
    name: string,
  }
): StateUpdater {
  return state => {
    // TODO: implement it!
    return state;
  };
}

function reconcileSelected(
  selected: ?QueryLoc.QueryLoc<>,
  prevSelected: ?QueryLoc.QueryLoc<>
): ?QueryAtom {
  // Nothing is going to be selected.
  if (selected == null) {
    return null;
  }

  let resolved = QueryLoc.tryResolveLoc(selected);

  // Prev selected state isn't available, nothing we can do but hope the current
  // selection works.
  if (prevSelected == null) {
    return resolved;
  }

  // Ok, the current selected state is valid.
  if (resolved != null) {
    return resolved;
  }

  // Try to backtrack and find the closest valid selected state.
  for (let query of QueryLoc.traverseLoc(prevSelected)) {
    if (query.name === 'pipeline') {
      continue;
    }
    let parentLoc = QueryLoc.loc(selected.rootQuery, query);
    let resolved = QueryLoc.tryResolveLoc(parentLoc);
    if (resolved != null) {
      return resolved;
    }
  }

  return null;
}

function onQuery(state: State, {
  query,
  selected,
  activeQueryPipeline,
}: {
  query: QueryPipeline,
  selected?: ?QueryAtom,
  activeQueryPipeline?: ?QueryPipeline,
}) {
  if (selected === undefined) {
    selected = state.selected;
  }
  selected = reconcileSelected(
    selected != null
      ? QueryLoc.loc(query, selected)
      : null,
    state.selected != null
      ? QueryLoc.loc(state.query, state.selected)
      : null,
  );
  if (activeQueryPipeline === undefined) {
    activeQueryPipeline = state.activeQueryPipeline;
  }

  let selectedDidChange = (
    (!state.selected && selected) ||
    (state.selected && selected && selected.id !== state.selected.id)
  );

  let showPanel = state.showPanel;
  if (activeQueryPipeline != null && !selectedDidChange) {
    activeQueryPipeline = null;
    showPanel = false;
  }
  if (activeQueryPipeline == null && state.activeQueryPipeline != null) {
    showPanel = false;
  }
  if (selectedDidChange) {
    showPanel = true;
  }
  let focusedSeq = reconcileFocus(state.focusedSeq, query);
  let nextState = {
    ...state,
    query,
    selected,
    activeQueryPipeline,
    showPanel: showPanel,
    undoStack: state.undoStack.concat({
      query: state.query,
      selected: state.selected,
    }),
    redoStack: [],
    focusedSeq,
  };
  return [
    nextState,
    refetchQuery
  ];
}

// FIXME: we need better sync mechanism, this is just hacky.
let refetchIndex = 0;

let fetchLog = createLogger('rex-query:state:fetch');

function refetchQuery(state, setState) {
  const {query, api} = state;
  fetchLog('fetching', state.query);
  if (query.context.hasInvalidType) {
    return;
  }
  refetchIndex += 1;
  const currentRefetchIndex = refetchIndex;
  Promise.resolve().then(_ => {
    if (query.context.type.name === 'invalid') {
      setState(
        'queryInvalid',
        state => ({...state, queryLoading: false, queryInvalid: true})
      );
    } else {
      setState(
        'fetchStart',
        state => ({...state, queryLoading: true, queryInvalid: false})
      );
      Fetch.fetch(api, query, state.translateOptions).then(data => {
        if (refetchIndex === currentRefetchIndex) {
          setState(
            'fetchFinish',
            state => ({...state, data, queryLoading: false})
          );
        }
      });
    }
  });
}

function generateQueryID(scope, prefix = 'Query') {
  if (scope[prefix] == null) {
    return prefix;
  }
  let c = 1;
  while (scope[prefix + ' ' + c] != null) {
    c += 1;
  }
  return prefix + ' ' + c;
}

function reconcileFocus(focusedSeq: Focus.Focus, query) {
  let nextFocusedSeq = Focus.chooseFocus(query);
  return nextFocusedSeq;
}
