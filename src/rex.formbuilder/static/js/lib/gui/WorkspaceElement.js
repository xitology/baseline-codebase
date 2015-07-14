/*
 * Copyright (c) 2015, Prometheus Research, LLC
 */

'use strict';

var React = require('react');
var {classSet} = React.addons;
var {DragDropMixin} = require('react-dnd');

var ConfirmationModal = require('./ConfirmationModal');
var {DraftSetActions} = require('../actions');
var DraggableTypes = require('./DraggableTypes');
var PropertyEditorModal = require('./PropertyEditorModal');
var _ = require('../i18n').gettext;


var WorkspaceElement = React.createClass({
  mixins: [
    DragDropMixin
  ],

  propTypes: {
    element: React.PropTypes.object.isRequired,
    canMove: React.PropTypes.bool,
    isSubField: React.PropTypes.bool
  },

  getDefaultProps: function () {
    return {
      canMove: true,
      isSubField: false
    };
  },

  statics: {
    configureDragDrop: function (register) {
      register(DraggableTypes.WORKSPACE_ELEMENT, {
        dragSource: {
          beginDrag: function (component) {
            return {
              item: {
                element: component.props.element
              }
            };
          },

          canDrag: function (component) {
            return component.canMove();
          }
        },

        dropTarget: {
          enter: function (component, item) {
            if (component.props.element.EID === item.element.EID) {
              return;
            }

            DraftSetActions.putElement(
              item.element,
              component.props.element
            );
          },

          acceptDrop: function (component, item) {
            DraftSetActions.checkNewHome(item.element);
          },

          canDrop: function (component, item) {
            return component.canMove()
              && !component.props.element.constructor.isContainingElement()
              && (
                !item.element.constructor.isContainingElement()
                || !component.props.isSubField
              )
              && (
                item.element.constructor.canBeSubField()
                || !component.props.isSubField
              )
            ;
          }
        }
      });

      register(DraggableTypes.ELEMENT_TYPE, {
        dropTarget: {
          enter: function (component, item) {
            if (component.props.element.EID === item.element.EID) {
              return;
            }

            DraftSetActions.putElement(
              item.element,
              component.props.element
            );
          },

          leave: function (component, item) {
            if (component.props.element.EID === item.element.EID) {
              component.setState({isDragging: false});
            }
          },

          acceptDrop: function (component) {
            component.setState({isDragging: false});
          },

          canDrop: function (component, item) {
            if (component.props.element.EID === item.element.EID) {
              return true;
            }

            return !component.props.isSubField
              && !component.props.element.constructor.isContainingElement()
              && component.canMove();
          }
        }
      });
    }
  },

  getInitialState: function () {
    var needsEdit = this.props.element.needsEdit
      || this.props.element.forceEdit
      || false;

    return {
      editing: needsEdit,
      deleting: false,
      isDragging: false
    };
  },

  componentWillReceiveProps: function (nextProps) {
    if (nextProps.element.needsEdit || nextProps.element.forceEdit) {
      this.setState({
        editing: true
      });
    }
  },

  onEdit: function () {
    if (!this.state.editing) {
      this.setState({
        editing: true
      });
    }
  },

  canMove: function () {
    return this.props.canMove && !this.state.editing && !this.state.deleting;
  },

  onCompleteEditing: function (element) {
    this.setState({
      editing: false
    }, () => {
      DraftSetActions.updateElement(element);
    });
  },

  onCancelEditing: function () {
    if (this.props.element.needsEdit) {
      DraftSetActions.deleteElement(this.props.element);
    } else {
      this.setState({
        editing: false
      }, () => {
        this.refs.modal.reset();
      });
    }
  },

  onClone: function () {
    DraftSetActions.cloneElement(this.props.element);
  },

  onDelete: function () {
    this.setState({
      deleting: true
    });
  },

  onDeleteAccepted: function () {
    DraftSetActions.deleteElement(this.props.element);
    this.setState({
      deleting: false
    });
  },

  onDeleteRejected: function () {
    this.setState({
      deleting: false
    });
  },

  render: function () {
    var {isDragging} = this.getDragState(DraggableTypes.WORKSPACE_ELEMENT);
    isDragging |= this.state.isDragging;

    var classes = {
      'rfb-workspace-element': true,
      'rfb-dragging': isDragging,
      'rfb-movable': this.props.canMove
    };
    var typeId = this.props.element.constructor.getTypeID();
    if (typeId) {
      classes['rfb-workspace-element-' + typeId] = true;
    }
    classes = classSet(classes);

    return (
      <div
        {...this.dragSourceFor(DraggableTypes.WORKSPACE_ELEMENT)}
        {...this.dropTargetFor(
          DraggableTypes.WORKSPACE_ELEMENT,
          DraggableTypes.ELEMENT_TYPE
        )}
        className={classes}>
        {this.props.element.getWorkspaceComponent()}
        <div className='rfb-workspace-element-tools'>
          <button
            className='rfb-button rfb-icon-button'
            onClick={this.onEdit}>
            <span className='rfb-icon icon-edit' />
          </button>
          <button
            className='rfb-button rfb-icon-button'
            onClick={this.onClone}>
            <span className='rfb-icon icon-clone' />
          </button>
          <button
            className='rfb-button rfb-icon-button'
            onClick={this.onDelete}>
            <span className='rfb-icon icon-delete' />
          </button>
          <ConfirmationModal
            visible={this.state.deleting}
            onAccept={this.onDeleteAccepted}
            onReject={this.onDeleteRejected}>
            <p>{_('Are you sure you want to delete this Element?')}</p>
          </ConfirmationModal>
        </div>
        <PropertyEditorModal
          ref='modal'
          element={this.props.element}
          visible={this.state.editing}
          onComplete={this.onCompleteEditing}
          onCancel={this.onCancelEditing}
          />
      </div>
    );
  }
});


module.exports = WorkspaceElement;
