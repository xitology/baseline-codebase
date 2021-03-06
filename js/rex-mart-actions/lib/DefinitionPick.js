/**
 * @copyright 2016, Prometheus Research, LLC
 */

import React from "react";

import { Action, TitleBase as Title } from "rex-action";
import { withFetch, DataSet } from "rex-widget/data";
import { DataTableBase } from "rex-widget/datatable";
import * as rexui from "rex-ui";

import { getDefinitionContext } from "./context";

function prettifyDefinition(definition) {
  let newDef = { ...definition };
  newDef.can_generate_pretty = newDef.can_generate ? "Yes" : "No";
  return newDef;
}

function prettifyColumn(column) {
  let newColumn = { ...column };
  if (["can_generate"].indexOf(newColumn.valueKey[0]) > -1) {
    newColumn.valueKey[0] = newColumn.valueKey[0] + "_pretty";
  }
  return newColumn;
}

export default withFetch(
  class DefinitionPick extends React.Component {
    static defaultProps = {
      icon: "list"
    };

    onSelect = (definitionId, definition) => {
      let newContext = getDefinitionContext(this.props.context, definitionId);
      newContext["mart_definition"] = definitionId;
      this.props.onContext(newContext);
    };

    render() {
      let { title, onClose, fields } = this.props;
      let { definitions } = this.props.fetched;

      if (definitions.updating) {
        return <rexui.PreloaderScreen />;
      }

      let data = DataSet.fromData(
        definitions.data.definitions.map(prettifyDefinition)
      );

      let columns = fields.map(prettifyColumn);

      return (
        <Action noContentWrapper title={title} onClose={onClose}>
          <DataTableBase
            allowReselect
            data={data}
            columns={columns}
            onSelect={this.onSelect}
          />
        </Action>
      );
    }

    static renderTitle({ title }, { mart_definition }) {
      return <Title title={title} subtitle={mart_definition} />;
    }
  },
  function({ definitions }) {
    return { definitions };
  }
);
