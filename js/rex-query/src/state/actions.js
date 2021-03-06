/**
 * This module exports all available actions for a query builder.
 *
 * @flow
 */

import type { State, StateUpdater } from "./index";

import type {
  DomainAggregate,
  DefineQuery,
  QueryAtom,
  QueryPipeline,
  SelectQuery,
  AggregateQuery,
  NavigateQuery,
  FilterQuery,
  GroupQuery,
  Expression,
  QueryLoc,
  ExportFormat,
  ChartConfig,
  Query
} from "../model/types";
import type { Chart, ChartType } from "../charting/types";

import createLogger from "debug";
import invariant from "invariant";
import debounce from "lodash/debounce";

import * as q from "../model/Query";
import * as t from "../model/Type.js";
import * as qo from "../model/QueryOperation";
import * as QL from "../model/QueryLoc";
import * as Fetch from "../fetch";
import * as Ch from "../chart/model";
import * as Focus from "./Focus";

let logAction = createLogger("rex-query:state:actions");

let logFetch = createLogger("rex-query:state:fetch");

// FIXME: we need better sync mechanism, this is just hacky.
let refetchIndex = 0;

const refetchQuery = {
  prepare: state => {
    const { query } = state;
    if (query.context.hasInvalidType) {
      return state;
    }
    if (query.context.type.name === "invalid") {
      return {
        ...state,
        queryLoading: false,
        queryInvalid: true
      };
    } else {
      return {
        ...state,
        queryLoading: true,
        queryInvalid: false
      };
    }
  },

  perform: debounce((state, setState) => {
    const {
      query,
      config: { api, translateOptions }
    } = state;
    if (query.context.hasInvalidType) {
      return;
    }
    logFetch("fetching", state.query);
    refetchIndex += 1;
    const currentRefetchIndex = refetchIndex;
    return Promise.resolve().then(_ => {
      // $FlowFixMe: ...
      const queryToFetch: Query = state.chartList.reduce((q, cSpec) => {
        const cConfig = state.config.chartConfigs.filter(
          c => c.type === cSpec.chart.type
        )[0];
        if (cConfig == null) {
          console.warn("Unknown chart type:", cSpec.chart.type);
          return q;
        } else {
          // $FlowFixMe: ...
          return Ch.enrichQuery(q, cSpec.chart, cConfig);
        }
      }, query);
      Fetch.fetch(api, queryToFetch, translateOptions).then(
        data => {
          if (refetchIndex === currentRefetchIndex) {
            setState("fetchFinish", state => ({
              ...state,
              data,
              dataError: null,
              queryLoading: false
            }));
          }
        },
        err => {
          setState("fetchError", state => ({
            ...state,
            dataError: String(err),
            queryLoading: false
          }));
        }
      );
    });
  }, 1000)
};

/**
 * Initialize query buiulder.
 */
export function init(): StateUpdater {
  return state => {
    return [state, refetchQuery];
  };
}

/**
 * Initialize query buiulder.
 */
export function setState(stateUpdate: Object): StateUpdater {
  return state => {
    state = { ...state, ...stateUpdate };
    let query = q.inferType(state.config.domain, state.query);
    let res = onQuery(state, { query });
    return res;
  };
}

export function setActiveTab(params: { activeTab: string }): StateUpdater {
  logAction("setActiveTab", params);
  return state => {
    return { ...state, activeTab: params.activeTab };
  };
}

export function addChart(params: {
  chartConfig: ChartConfig<any, any>
}): StateUpdater {
  logAction("addChart", params);
  return state => {
    const { chartConfig } = params;
    const chartSpec = {
      id: `${chartConfig.type}-${state.chartList.length + 1}`,
      label: null,
      chart: chartConfig.getInitialChart(state.query)
    };
    const chartList = state.chartList.concat(chartSpec);
    return {
      ...state,
      activeTab: chartSpec.id,
      chartList
    };
  };
}

export function updateChart(params: {
  chartId: string,
  chart?: Chart,
  label?: string
}): StateUpdater {
  logAction("updateChart", params);
  return state => {
    const chartList = state.chartList.slice(0);
    const chartIdx = state.chartList.findIndex(
      chart => chart.id === params.chartId
    );
    invariant(chartIdx != null, "Cannot find chart: %s", params.chartId);
    const nextChart = { ...chartList[chartIdx] };
    if (params.chart != null) {
      nextChart.chart = params.chart;
    }
    if (params.label != null) {
      nextChart.label = params.label;
    }
    chartList.splice(chartIdx, 1, nextChart);
    return [{ ...state, chartList }, refetchQuery];
  };
}

export function removeChart(params: { chartId: string }): StateUpdater {
  logAction("removeChart", params);
  return state => {
    const chartList = state.chartList.slice(0);
    const chartIdx = state.chartList.findIndex(
      chart => chart.id === params.chartId
    );
    invariant(chartIdx != null, "Cannot find chart: %s", params.chartId);
    chartList.splice(chartIdx, 1);
    return { ...state, chartList, activeTab: "__dataset__" };
  };
}

function ensurePipelineHasCount(pipe: QueryAtom[]): QueryAtom[] {
  const last = pipe[pipe.length - 1];
  if (last != null && last.name === "aggregate") {
    return pipe;
  } else {
    return pipe.concat(q.aggregate("count"));
  }
}

function getLastNonSelectAtPipeline(pipeline: QueryPipeline) {
  const last = pipeline.pipeline[pipeline.pipeline.length - 1];
  if (last.name !== "select") {
    return last;
  }
  const prevLast = pipeline.pipeline[pipeline.pipeline.length - 2];
  return prevLast;
}

/**
 * Select a path at a given query pipeline.
 */
export function select({
  at,
  path
}: {
  at: QueryPipeline,
  path: string[]
}): StateUpdater {
  logAction("select", { at, path });
  return state => {
    const lastNonSelect = getLastNonSelectAtPipeline(at);
    const type = q.inferTypeAtPath(
      q.regularizeContext(lastNonSelect.context),
      path
    );

    let editAtCompletion;
    if (type.card === "seq" && type.name === "record" && type.entity != null) {
      editAtCompletion = ensurePipelineHasCount;
    }

    const query = qo
      .editor(state.query, at)
      .growNavigation({ path, editAtCompletion })
      .getQuery();
    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Select a path at a given query pipeline and deselect all other paths.
 */
export function selectFocus({
  at,
  path
}: {
  at: QueryPipeline,
  path: string[]
}): StateUpdater {
  logAction("selectFocus", { at, path });
  return state => {
    const lastNonSelect = getLastNonSelectAtPipeline(at);
    if (lastNonSelect.context.type.name !== "record") {
      return state;
    }
    let editAtCompletion;
    const type = q.inferTypeAtPath(
      q.regularizeContext(lastNonSelect.context),
      path
    );
    if (type.card === "seq" && type.name === "record" && type.entity != null) {
      editAtCompletion = ensurePipelineHasCount;
    }

    const query = qo
      .editor(state.query, at)
      .removeSelect()
      .growNavigation({ path, editAtCompletion })
      .getQuery();
    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Select all paths at a given query pipeline.
 */
export function selectAll({ at }: { at: QueryPipeline }): StateUpdater {
  logAction("selectAll", { at });
  return state => {
    const lastNonSelect = getLastNonSelectAtPipeline(at);
    const type = lastNonSelect.context.type;
    if (type.name !== "record") {
      return state;
    }

    const attrs = t.recordLikeAttribute(type);

    let query = state.query;

    for (const name in attrs) {
      const path = [name];
      const type = q.inferTypeAtPath(
        q.regularizeContext(lastNonSelect.context),
        path
      );

      let editAtCompletion;
      if (
        type.card === "seq" &&
        type.name === "record" &&
        type.entity != null
      ) {
        editAtCompletion = ensurePipelineHasCount;
      }

      query = qo
        .editor(query, at)
        .growNavigation({ path, editAtCompletion })
        .getQuery();
    }
    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Sort by.
 */

export function sortBy({
  at,
  sort
}: {
  at: SelectQuery,
  sort: { navigatePath: Array<string>, dir: "asc" | "desc" }
}): StateUpdater {
  logAction("sortBy", { at, sort });
  return state => {
    const query = qo
      .editor(state.query, at)
      .transformWith(_ => {
        return ({ ...at, name: "select", sort }: any);
      })
      .getQuery();
    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Put a focus on a sequence in a datatable.
 */
export function focusOnSeq(params: { focusedSeq: Focus.Focus }): StateUpdater {
  const { focusedSeq } = params;
  return state => {
    return { ...state, focusedSeq };
  };
}

/**
 * Initiate export procedure.
 */
export function exportDataset(format: ExportFormat): StateUpdater {
  return state => {
    Fetch.initiateDownload(state.config.api, state.query, {}, format).catch(
      err => {
        console.error("Error while exporting dataset:", err);
      }
    );
    return state;
  };
}

/**
 * Show column picker.
 */
export function showSelect(): StateUpdater {
  return state => {
    return { ...state, showPanel: true, selected: null };
  };
}

/**
 * Show field selection panel.
 */
export function showPanel(): StateUpdater {
  return state => {
    return { ...state, showPanel: true };
  };
}

/**
 * Hide field selection panel.
 */
export function hidePanel(): StateUpdater {
  return state => {
    return {
      ...state,
      showPanel: state.insertAfter != null && state.prevSelected ? true : false,
      insertAfter: null,
      selected: state.insertAfter != null ? state.prevSelected : null,
      prevSelected: null
    };
  };
}

/**
 * Undo.
 */
export function undo(): StateUpdater {
  return state => {
    let undoStack = state.undoStack.slice(0);
    let { query, selected, focusedSeq } = undoStack.pop();
    let redoStack = state.redoStack.concat({
      query: state.query,
      selected: state.selected,
      focusedSeq: state.focusedSeq
    });
    let nextState = {
      ...state,
      query,
      selected,
      focusedSeq,
      undoStack,
      redoStack
    };
    return [nextState, refetchQuery];
  };
}

/**
 * Redo.
 */
export function redo(): StateUpdater {
  return state => {
    let redoStack = state.redoStack.slice(0);
    let { query, selected, focusedSeq } = redoStack.pop();
    let undoStack = state.undoStack.concat({
      query: state.query,
      selected: state.selected,
      focusedSeq: state.focusedSeq
    });
    let nextState = {
      ...state,
      query,
      selected,
      focusedSeq,
      undoStack,
      redoStack
    };
    return [nextState, refetchQuery];
  };
}

/**
 * Initiate new query combinator insertion.
 */
export function setActiveQueryPipeline({
  pipeline
}: {
  pipeline: QueryPipeline
}): StateUpdater {
  return state => {
    return {
      ...state,
      activeQueryPipeline: pipeline,
      selected: null,
      prevSelected: state.selected,
      showPanel: true
    };
  };
}

/**
 * Select a combinator in a query vis panel.
 */
export function setSelected({ query }: { query: ?QueryAtom }): StateUpdater {
  logAction("setSelected", { query });
  return state => {
    return {
      ...state,
      selected: query,
      showPanel: true,
      activeQueryPipeline: null
    };
  };
}

/**
 * Remove a query combinator at pointer.
 */
export function cut({ at }: { at: QueryAtom | QueryPipeline }): StateUpdater {
  logAction("cut", at);
  return state => {
    let query = qo
      .editor(state.query, at, { edge: "leading" })
      .cut()
      .getQuery();
    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Remove a query combinator at pointer.
 */
export function remove({
  at
}: {
  at: QueryPipeline | QueryAtom
}): StateUpdater {
  logAction("remove", { at });
  return state => {
    let editor = qo.editor(state.query, at);
    if (at.name === "navigate") {
      let query = editor.cut().getQuery();
      return onQuery(state, { query });
    } else {
      if (at.name === "group") {
        editor = editor.removeSelect();
      }
      editor = editor.remove();
      let query = editor.getQuery();
      return onQuery(state, { query });
    }
  };
}

export function setAggregate({
  at,
  aggregate,
  path
}: {
  at: AggregateQuery,
  aggregate: string,
  path?: ?string
}): StateUpdater {
  logAction("setAggregate", { at });
  return state => {
    if (path == null) {
      path = null;
    }
    let nextAggregate = q.aggregate(aggregate, path);
    let query = qo
      .editor(state.query, at)
      .replaceWith(nextAggregate)
      .getQuery();
    return onQuery(state, { query, selected: nextAggregate });
  };
}

export function setNavigate({
  at,
  path
}: {
  at: NavigateQuery,
  path: string
}): StateUpdater {
  logAction("setNavigate", { at });
  return state => {
    let nextNavigate = q.navigate(path);
    let query = qo
      .editor(state.query, at)
      .removeSelect()
      .replaceWith(nextNavigate)
      .getQuery();
    return onQuery(state, { query, selected: nextNavigate });
  };
}

export function setFilter({
  at,
  expression
}: {
  at: FilterQuery,
  expression: ?Expression
}): StateUpdater {
  logAction("setFilter", { at });
  return state => {
    let nextFilter: FilterQuery = { ...q.filter(expression), id: at.id };
    let query = qo
      .editor(state.query, at)
      .replaceWith(nextFilter)
      .getQuery();
    return onQuery(state, { query, selected: nextFilter });
  };
}

type SetGroupByPathParams = {
  at: GroupQuery,
  byPath: Array<string>
};

/**
 * Update group query with new column list.
 */
export function setGroupByPath({
  at,
  byPath
}: SetGroupByPathParams): StateUpdater {
  return state => {
    let prevType = at.context.prev.type;
    invariant(
      prevType && prevType.name === "record" && prevType.entity != null,
      "Invalid type info"
    );
    const entity = prevType.entity;

    let editor = qo.editor(state.query, at);

    editor = editor.transformWith(query => ({
      name: "group",
      ...query,
      byPath: byPath
    }));

    if (byPath.length === 0) {
      editor = editor.removeSelect();
    }

    editor = editor.inferType();

    editor = editor.growNavigation({
      path: [entity],
      editAtCompletion: pipe => {
        const tail = pipe[pipe.length - 1];
        if (tail && tail.name !== "aggregate") {
          pipe = pipe.concat(q.aggregate("count"));
        }
        return pipe;
      }
    });

    let query = editor.getQuery();

    return onQuery(state, { query, selected: state.selected });
  };
}

/**
 * Append a new navigate combinator at pointer.
 */
export function appendNavigate({
  at,
  path = []
}: {
  at: QueryPipeline,
  path?: Array<string>
}): StateUpdater {
  logAction("appendNavigate", { at, path });
  return state => {
    if (path.length === 0) {
      return state;
    }
    let query = qo
      .editor(state.query, at)
      .insertAfter({ what: path.map(q.use) })
      .getQuery();
    return onQuery(state, {
      query,
      selected: state.selected || state.prevSelected,
      activeQueryPipeline: null
    });
  };
}

/**
 * Append a new define combinator at query.
 */
export function appendDefine({
  at,
  path,
  select
}: {
  at: QueryPipeline,
  path?: Array<string>,
  select?: boolean
}): StateUpdater {
  logAction("appendDefine", { at, path, select });
  return state => {
    let name = generateQueryID(
      at.context.scope,
      path ? `${path.join(" ")} query` : "query"
    );

    let expression =
      path != null ? q.pipeline(...path.map(q.use)) : q.pipeline(q.use(""));

    let def = q.def(name, expression);

    let query = qo
      .editor(state.query, at)
      .insertAfter({ what: [def] })
      .growNavigation({ path: [name] })
      .getQuery();
    const lastNonSelect = getLastNonSelectAtPipeline(at);
    const type = q.inferTypeAtPath(
      q.regularizeContext(lastNonSelect.context),
      path || []
    );
    const isRecord = type.name === "record";
    query = q.inferType(state.config.domain, query);
    const selected =
      select && isRecord ? def : state.selected || state.prevSelected;
    return onQuery(state, {
      query,
      selected,
      activeQueryPipeline: null
    });
  };
}

/**
 * Append a new filter combinator at pointer.
 */
export function appendFilter({ at }: { at: QueryPipeline }): StateUpdater {
  logAction("appendFilter", { at });
  return state => {
    let filter = q.filter(null);
    let query = qo
      .editor(state.query, at)
      .insertAfter({ what: [filter] })
      .getQuery();
    return onQuery(state, { query, selected: filter });
  };
}

/**
 * Append a new filter combinator to a pipeline.
 */
export function appendGroup({ at }: { at: QueryPipeline }): StateUpdater {
  return state => {
    let group = q.group([]);
    let query = qo
      .editor(state.query, at)
      .insertAfter({ what: [group] })
      .getQuery();
    return onQuery(state, { query, selected: group });
  };
}

/**
 * Append a new aggregate combinator to a pipeline.
 */
export function appendAggregate({ at }: { at: QueryPipeline }): StateUpdater {
  return state => {
    let aggregate = q.aggregate("count");
    let query = qo
      .editor(state.query, at)
      .insertAfter({ what: [aggregate] })
      .getQuery();
    return onQuery(state, { query, selected: aggregate });
  };
}

/**
 * Append a new aggregate combinator at pointer.
 */
export function appendDefineAndAggregate({
  at,
  path,
  aggregate
}: {
  at: QueryPipeline,
  path: Array<string>,
  aggregate: DomainAggregate
}): StateUpdater {
  return state => {
    let newQuery;
    let name = generateQueryID(at.context.scope, path.join(" ") + " Query");
    let query = qo
      .editor(state.query, at)
      .transformPipelineWith(pipeline => {
        pipeline = pipeline.slice(0);
        let select = null;
        if (pipeline[pipeline.length - 1].name === "select") {
          select = pipeline.pop();
        }
        let innerPipeline = [];
        if (path.length > 0) {
          innerPipeline = innerPipeline.concat(path.map(p => q.use(p)));
        } else {
          innerPipeline.push(q.here);
        }
        innerPipeline.push(q.aggregate(aggregate.name));
        newQuery = q.def(name, q.pipeline(...innerPipeline));
        pipeline.push(newQuery);
        if (select) {
          pipeline.push(select);
        }
        return pipeline;
      })
      .growNavigation({ path: [name] })
      .getQuery();
    return onQuery(state, {
      query,
      selected: newQuery,
      activeQueryPipeline: null
    });
  };
}

/**
 * Rename define combinator binding at pointer.
 */
export function renameDefineBinding({
  at,
  name
}: {
  at: DefineQuery,
  name: string
}): StateUpdater {
  return state => {
    // TODO: implement it!
    return state;
  };
}

function reconcileSelected(
  selected: ?QueryLoc<>,
  prevSelected: ?QueryLoc<>
): ?QueryAtom {
  // Nothing is going to be selected.
  if (selected == null) {
    return null;
  }

  let resolved = QL.tryResolveLoc(selected);

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
  for (let query of QL.traverseLoc(prevSelected)) {
    if (query.name === "pipeline") {
      continue;
    }
    let parentLoc = QL.loc(selected.rootQuery, query);
    let resolved = QL.tryResolveLoc(parentLoc);
    if (resolved != null) {
      return resolved;
    }
  }

  return null;
}

function onQuery(
  state: State,
  {
    query,
    selected,
    activeQueryPipeline
  }: {
    query: QueryPipeline,
    selected?: ?QueryAtom,
    activeQueryPipeline?: ?QueryPipeline
  }
) {
  if (selected === undefined) {
    selected = state.selected;
  }
  selected = reconcileSelected(
    selected != null ? QL.loc(query, selected) : null,
    state.selected != null ? QL.loc(state.query, state.selected) : null
  );
  if (activeQueryPipeline === undefined) {
    activeQueryPipeline = state.activeQueryPipeline;
  }

  let selectedDidChange =
    (!state.selected && selected) ||
    (state.selected && selected && selected.id !== state.selected.id);

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

  // clear chartList if we change the root navigate to another relationship
  let chartList = state.chartList;
  let activeTab = state.activeTab;
  if (getRootEntity(state.query) !== getRootEntity(query)) {
    chartList = [];
    activeTab = "__dataset__";
  }

  let nextState = {
    ...state,
    query,
    chartList,
    activeTab,
    selected,
    activeQueryPipeline,
    showPanel: showPanel,
    undoStack: state.undoStack.concat({
      query: state.query,
      selected: state.selected,
      focusedSeq: state.focusedSeq
    }),
    redoStack: [],
    focusedSeq
  };
  return [nextState, refetchQuery];
}
function generateQueryID(scope, prefix = "Query") {
  if (scope[prefix] == null) {
    return prefix;
  }
  let c = 1;
  while (scope[prefix + " " + c] != null) {
    c += 1;
  }
  return prefix + " " + c;
}

function reconcileFocus(focusedSeq: Focus.Focus, query) {
  let nextFocusedSeq = Focus.chooseFocus(query);
  return nextFocusedSeq;
}

function getRootEntity(query: QueryPipeline) {
  const def = query.pipeline[1];
  if (def == null) {
    return null;
  }
  if (def.name !== "define") {
    return null;
  }
  const navigate = def.binding.query.pipeline[0];
  if (navigate == null) {
    return null;
  }
  if (navigate.name !== "navigate") {
    return null;
  }
  return navigate.path;
}
