/**
 * @copyright 2015, Prometheus Research, LLC
 */

import React, {PropTypes} from 'react';
import autobind           from 'autobind-decorator';
import {Column, Table}    from 'fixed-data-table';
import * as Stylesheet    from '@prometheusresearch/react-stylesheet';
import emptyFunction      from '../emptyFunction';
import WithDOMSize        from '../WithDOMSize';
import {VBox, HBox}       from '../Layout';
import Icon               from '../Icon';
import isString           from '../isString';
import LoadingIndicator   from '../LoadingIndicator';
import * as KeyPath       from '../KeyPath';
import TouchableArea      from '../TouchableArea';
import ZyngaScroller      from '../Scroller';
import {isTouchDevice}    from '../Environment';

@WithDOMSize
@Stylesheet.styleable
export default class DataTableBase extends React.Component {

  static propTypes = {
    /**
     * DataSet to render.
     */
    data: PropTypes.object,

    /**
     * An array of column specifications.
     */
    columns: PropTypes.array,

    /**
     * Current pagination position {top: ..., skip: ...}
     */
    pagination: PropTypes.object,

    /**
     * Callback which is called on next pagination position.
     */
    onPagination: PropTypes.func,

    /**
     * Current sort direction.
     */
    sort: PropTypes.object,

    /**
     * Callback which is called on next sort direction.
     */
    onSort: PropTypes.func,

    /**
     * Wrapper DOM size, will be determined automatically if not provided.
     */
    DOMSize: PropTypes.object,

    /**
     * Minimum value for column width.
     */
    minColumnWidth: PropTypes.number,

    /**
     * Height of the datatable header.
     */
    headerHeight: PropTypes.number,

    /**
     * Height of the datatable row.
     */
    rowHeight: PropTypes.number,
  };

  static defaultProps = {
    top: 50,
    skip: 0,
    minColumnWidth: 90,
    rowHeight: 35,
    headerHeight: 35,
    pagination: {top: 50, skip: 0},
    sort: {valueKey: null, asc: true},
    onSort: emptyFunction,
    onSelect: emptyFunction,
  };

  static stylesheet = Stylesheet.createStylesheet({
    Root: {
      Component: VBox,
      overflow: 'hidden',
    },
    LoadingPane: {
      Component: VBox,
      background: 'white',
      position: 'absolute',
      zIndex: 1000,
      height: 35,
      left: 0,
      right: 0,
      boxShadow: '0px -2px 4px 0px rgb(204, 204, 204)',
      justifyContent: 'center',
      bottom: -35,
      opacity: 0,
      transition: ['opacity 0.3s', 'bottom 0.3s'],
      visible: {
        bottom: 0,
        opacity: 100
      }
    },
    SortIndicator: {
      Component: VBox,
      cursor: 'pointer',
      color: '#bbb',
      fontSize: '70%',

      hover: {
        color: '#666'
      },
      active: {
        color: '#666'
      }
    },
    ErrorInfo: {
      Component: VBox,
      color: '#a94442',
      backgroundColor: '#f2dede',
      borderColor: '#ebccd1',

      padding: 10,
      maxHeight: 100,

      position: 'absolute',
      zIndex: 1001,
      left: 0,
      right: 0,
      bottom: 0,
      boxShadow: '0px -2px 4px 0px rgb(204, 204, 204)'
    }
  });

  constructor(props) {
    super(props);
    this._rowIndexMax = null;
    this.state = {
      columnWidth: {},
      left: 0,
      top: 0
    };
    this.scroller = null;
    if (isTouchDevice) {
      this.scroller = new ZyngaScroller(this.onTouchScroll);
    }
  }

  render() {
    let {
      DOMSize,
      rowHeight,
      headerHeight,
      minColumnWidth,
      columns,
      sort,
      style,
      data: {data, updating, error}
    } = this.props;
    let {Root, ErrorInfo, LoadingPane} = this.stylesheet;
    if (!this.props.DOMSize) {
      return <Root style={style} size={1} />;
    }
    let rowsCount = data ? data.length : 0;
    let columnElements = [];

    let columnWidth = Math.max(Math.floor(DOMSize.width / columns.length), minColumnWidth);
    for (let i = 0; i < columns.length; i++) {
      let column = columns[i];
      if (isString(column)) {
        column = {
          valueKey: column,
          label: column
        };
      }
      columnElements.push(
        <Column
          key={column.valueKey}
          width={this.state.columnWidth[column.valueKey] || columnWidth}
          cellDataGetter={this.cellDataGetter}
          cellRenderer={this.cellRenderer}
          headerRenderer={this.headerRenderer}
          fixed={column.fixed}
          dataKey={column.valueKey}
          label={column.label || KeyPath.normalize(column.valueKey).join('.')}
          columnData={{...column, sort}}
          isResizable={true}
          />
      );
    }
    return (
      <TouchableArea
        element={Root}
        size={1}
        scroller={isTouchDevice ? this.scroller : undefined}
        style={{...style, cursor: 'pointer'}}>
        <Table
          onContentHeightChange={
            isTouchDevice ?
              this.onContentDimensionsChange :
              undefined}
          scrollTop={isTouchDevice ? this.state.top : undefined}
          scrollLeft={isTouchDevice ? this.state.left : undefined}
          overflowX={isTouchDevice ? 'hidden' : 'auto'}
          overflowY={isTouchDevice ? 'hidden' : 'auto'}
          headerHeight={headerHeight}
          rowHeight={rowHeight}
          height={DOMSize.height}
          width={DOMSize.width}
          rowGetter={this.rowGetter}
          rowClassNameGetter={this.rowClassNameGetter}
          onRowClick={this.onRowClick}
          onScrollEnd={this.onScrollEnd}
          onColumnResizeEndCallback={this.onColumnResizeEndCallback}
          isColumnResizing={false}
          rowsCount={rowsCount}>
          {columnElements}
        </Table>
        <LoadingPane state={{visible: updating}}>
          <LoadingIndicator />
        </LoadingPane>
        {error && <ErrorInfo>{error.message}</ErrorInfo>}
      </TouchableArea>
    );
  }

  @autobind
  onTouchScroll(left, top) {
    if (isTouchDevice) {
      this.setState({left, top});
    }
  }

  @autobind
  onContentDimensionsChange(contentHeight, contentWidth) {
    if (isTouchDevice) {
      this.scroller.setDimensions(
        this.props.DOMSize.width,
        this.props.DOMSize.height,
        contentWidth,
        contentHeight
      );
    }
  }

  @autobind
  onColumnResizeEndCallback(newWidth, dataKey) {
    newWidth = Math.max(this.props.minColumnWidth, newWidth);
    let columnWidth = {...this.state.columnWidth, [dataKey]: newWidth};
    this.setState({columnWidth});
  }

  @autobind
  headerRenderer(label, cellDataKey, columnData) {
    let {SortIndicator} = this.stylesheet;
    let {sort: {valueKey, asc}, onSort} = this.props;
    let active = KeyPath.equals(columnData.valueKey, valueKey);
    let sort = {valueKey: columnData.valueKey, asc: active ? !asc : true};
    let icon = active ? (asc ? 'sort-by-attributes' : 'sort-by-attributes-alt') : 'sort';
    return (
      <HBox size={1}>
        <VBox size={1}>
          {label}
        </VBox>
        <SortIndicator onClick={onSort.bind(null, sort)} centerVertically>
          <Icon name={icon} />
        </SortIndicator>
      </HBox>
    );
  }

  @autobind
  cellRenderer(cellData, cellDataKey, rowData, rowIndex, columnData) {
    let onCellClick;
    if (this.props.onCellClick) {
      onCellClick = this.props.onCellClick.bind(null, cellDataKey, cellData, rowData);
    }
    if (columnData.widget && columnData.widget.column) {
      return React.cloneElement(columnData.widget.column, {cellData, onCellClick});
    } else {
      return (
        <span title={cellData} onClick={onCellClick}>
          {renderToString(cellData)}
        </span>
      );
    }

    return cellData;
  }

  @autobind
  cellDataGetter(cellDataKey, rowData) {
    return KeyPath.get(cellDataKey, rowData);
  }

  @autobind
  rowGetter(rowIndex) {
    if (rowIndex > this._rowIndexMax) {
      this._rowIndexMax = rowIndex;
    }
    let rowData = this.props.data.data[rowIndex];
    return rowData;
  }

  @autobind
  rowClassNameGetter(rowIndex) {
    let {selected} = this.props;
    let row = this.rowGetter(rowIndex);
    if (row && row.id == selected) { // eslint-disable-line eqeqeq
      return 'DataTable__row--selected';
    }
  }

  @autobind
  onScrollEnd() {
    let {
      pagination: {top, skip},
      data: {updating, hasMore, data}
    } = this.props;
    if (data && data.length - this._rowIndexMax < 10 && !updating && hasMore) {
      this.props.onPagination({top, skip: skip + top});
    }
  }

  @autobind
  onRowClick(e, rowIndex, row) {
    let {selected, onSelect} = this.props;
    if (row.id != selected) { // eslint-disable-line eqeqeq
      onSelect(row.id, row);
    }
  }
}

/**
 * Render null and undefined as empty string but get toString from any other
 * object.
 */
function renderToString(value) {
  return value == null ?  '' : String(value);
}
