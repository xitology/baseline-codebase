/**
 * @copyright 2016, Prometheus Research, LLC
 */

import React from "react";

import { Action } from "rex-action";
import { ConfigurableEntityForm } from "rex-widget/form";
import { withFetch, forceRefreshData } from "rex-widget/data";
import {
  Preloader,
  Button,
  DangerButton,
  QuietButton,
  Notification,
  showNotification
} from "rex-widget/ui";
import * as Stylesheet from "rex-widget/stylesheet";
import { VBox } from "rex-widget/layout";
import * as CSS from "rex-widget/css";
import { put, del } from "rex-widget/lib/fetch";

import Title from "./Title";

let stylesheet = Stylesheet.create({
  Root: {
    Component: VBox,
    background: CSS.rgba(255, 226, 226, 0.4),
    color: CSS.rgb(68, 22, 22)
  },

  Content: {
    Component: VBox,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10
  },

  MessageBottom: {
    marginTop: 10,
    fontSize: "90%"
  },

  Message: {
    fontSize: "90%",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: "2em"
  },

  Tools: {
    textAlign: "center",
    marginTop: "2em"
  }
});

export default withFetch(
  class MartView extends React.Component {
    static defaultProps = {
      icon: "file"
    };

    constructor() {
      super();
      this.state = {
        deleting: false,
        confirmDelay: 0
      };
    }

    render() {
      let { fields, context, onClose, fetched } = this.props;
      let title = this.constructor.renderTitle(this.props, context);

      let tools;
      if (!fetched.data.updating && fetched.data.data.can_manage) {
        let pinned = fetched.data.data.pinned;

        tools = (
          <stylesheet.Tools>
            <Button
              icon="pushpin"
              onClick={this.onSetPinned.bind(this, !pinned)}
            >
              {pinned ? "Unpin" : "Pin"}
            </Button>
            <DangerButton icon="remove" onClick={this.onRequestDelete}>
              Delete
            </DangerButton>
          </stylesheet.Tools>
        );
      }

      let content;
      if (fetched.data.updating) {
        content = <Preloader />;
      } else if (this.state.deleting) {
        content = (
          <stylesheet.Root>
            <stylesheet.Content>
              <stylesheet.Message>
                <p>You are about to permanently delete this Mart database.</p>
                <p>
                  There is NO WAY to undo this action, so be absolutely sure
                  that you want to do this.
                </p>
              </stylesheet.Message>
              <div>
                <DangerButton
                  onClick={this.onDelete}
                  disabled={this.state.confirmDelay > 0}
                  icon="remove"
                >
                  Delete
                </DangerButton>
                <Button onClick={this.onCancelDelete}>Cancel</Button>
              </div>
              <stylesheet.MessageBottom>
                {this.state.confirmDelay > 0 && (
                  <p>Wait {this.state.confirmDelay} seconds</p>
                )}
              </stylesheet.MessageBottom>
            </stylesheet.Content>
          </stylesheet.Root>
        );
      } else {
        content = (
          <div>
            <ConfigurableEntityForm
              key={fetched.data.data.id}
              disableValidation
              readOnly
              entity={"Mart"}
              value={fetched.data.data}
              fields={fields}
            />
            {tools}
          </div>
        );
      }

      return (
        <Action title={title} onClose={onClose}>
          {content}
        </Action>
      );
    }

    getMart() {
      if (this.props.entity) {
        return this.props.context[this.props.entity.name];
      } else {
        return this.props.context.mart;
      }
    }

    getMartId() {
      const mart = this.getMart();
      return mart.id;
    }

    onSetPinned(pinned) {
      let url = "rex.mart:/mart/" + this.getMartId() + "/_api";
      let message = "Mart #" + this.getMartId() + " has been ";
      message += pinned ? "pinned." : "unpinned.";

      put(url, null, { pinned }, { jsonifyData: true }).then(() => {
        forceRefreshData();
        showNotification(<Notification kind={"success"} text={message} />);
      });
    }

    onRequestDelete = () => {
      this.setState({
        deleting: true,
        confirmDelay: 5
      });
    }

    onCancelDelete = () => {
      this.setState({
        deleting: false
      });
    }

    onDelete = () => {
      let url = "rex.mart:/mart/" + this.getMartId() + "/_api";
      del(url).then(() => {
        this.props.onEntityUpdate(this.getMart(), null);
      });
    }

    componentDidMount() {
      this._countdown = setInterval(this.countdown, 1000);
    }

    componentWillUnmount() {
      clearTimeout(this._countdown);
    }

    countdown = () => {
      if (this.state.confirmDelay > 0) {
        this.setState({
          confirmDelay: this.state.confirmDelay - 1
        });
      }
    }

    static renderTitle({ title, entity }, context) {
      let martId;
      if (entity) {
        martId = context[entity.name].id;
      } else if (context.mart) {
        martId = context.mart.id;
      }
      return (
        <Title title={title} subtitle={martId ? "#" + martId : undefined} />
      );
    }
  },
  function({ data, entity, context }) {
    let martId;
    if (entity) {
      martId = context[entity.name].id;
    } else {
      martId = context.mart.id;
    }
    data = data.params({ mart: martId });
    return { data };
  }
);
