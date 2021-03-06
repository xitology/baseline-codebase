/**
 * @copyright 2016, Prometheus Research, LLC
 */

import * as React from "react";
import * as ReactUI from "@prometheusresearch/react-ui-0.21";

export default class Divider extends React.Component {
  render() {
    return (
      <ReactUI.Block marginBottom="medium">
        <hr />
      </ReactUI.Block>
    );
  }
}
