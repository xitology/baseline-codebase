/**
 * @copyright 2015 Prometheus Research, LLC
 */

import React from "react";
import assert from "assert";
import { style, create, isStylesheet } from "../";

describe("index", function() {
  describe("style(...)", function() {
    it("creates a component with a stylesheet attached", function() {
      let Component = "div";
      let Styled = style(Component, { width: 10 });
      assert(Styled.Component === "div");
      assert(Styled.stylesheet.style.base.width === 10);
      assert(Styled.displayName === "Styled(div)");
    });

    it("allows to override displayName", function() {
      let Component = "div";
      let Styled = style(Component, { width: 10 }, "CustomDisplayName");
      assert(Styled.displayName === "CustomDisplayName");
    });

    it("allows to override displayName via stylesheet spec", function() {
      let Component = "div";
      let Styled = style(Component, {
        width: 10,
        displayName: "CustomDisplayName"
      });
      assert(Styled.displayName === "CustomDisplayName");
    });

    it("delegates to style() method if component has it", function() {
      class Component extends React.Component {
        render() {
          return <div className={this.props.className} />;
        }

        static style(_stylesheet) {
          return "span";
        }
      }

      let Styled = style(Component, { width: 10 });
      assert(Styled === "span");
    });
  });

  describe("create(...)", function() {
    it("creates a new stylesheet", function() {
      let stylesheet = create({ width: 10 });
      assert(isStylesheet(stylesheet));
    });
  });
});
