// @flow

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as mui from "@material-ui/core";

function App() {
  return <div>Hello World</div>;
}

ReactDOM.render(
  <>
    <mui.CssBaseline />
    <App />
  </>,
  (document.getElementById("root"): any),
);
