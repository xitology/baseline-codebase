/**
 * @copyright 2016, Prometheus Research, LLC
 */

import invariant from 'invariant';
import * as React from 'react';
import * as ReactForms from 'react-forms/reactive';
import * as ReactDOM from 'react-dom';
import * as ReactUI from '@prometheusresearch/react-ui';
import {style} from '@prometheusresearch/react-ui/stylesheet';
import map from 'lodash/map';

import {InjectI18N} from 'rex-i18n';

import parseBoolean from '../../parseBoolean';
import focusNextWithin from '../../focusNextWithin';
import Widget from '../Widget';
import * as FormContext  from '../FormContext';
import OptionLabel from '../OptionLabel';
import Help from '../Help';
import * as Hotkey from './HotKey';


let RadioInput = style(ReactUI.Radio, {
  Label: {
    fontSize: null,
    disabled: {
      color: '#aaa'
    }
  }
});

let RadioGroupInput = style(ReactUI.RadioGroup, {
  Radio: props => <RadioInput {...props} />
});


@InjectI18N
@ReactForms.reactive
export default class RadioGroup extends React.Component {

  static propTypes = {

    /**
     * Disable rendering "Clear My Selection" button.
     *
     * By default this widgets renders it.
     */
    noClearButton: React.PropTypes.bool,

    /**
     * Show an option which clears the current value.
     */
    showEmptyOption: React.PropTypes.bool,
  };

  static contextTypes = {
    ...FormContext.contextTypes,
  };

  render() {
    let {
      options: {orientation = 'vertical'},
      instrument: {type},
      question: {fieldId, enumerations},
      formValue,
      editable, onCommitEdit, onCancelEdit,
      noClearButton,
      showEmptyOption,
      disabled,
      ...props
    } = this.props;
    let {event} = this.context;

    let options;
    if (type.base === 'boolean') {
      options = [
        {value: true, label: this._('Yes')},
        {value: false, label: this._('No')},
      ];
    } else if (type.base === 'enumeration') {
      // If question.options.enumerations is available then use them, otherwise
      // fallback to instrument description
      if (enumerations) {
        options = map(enumerations, enumeration => ({
          value: enumeration.id,
          label: <OptionLabel text={enumeration.text} audio={enumeration.audio} />,
          hint: enumeration.help && <Help>{enumeration.help}</Help>,
        }));
      } else {
        options = Object.keys(type.enumerations).sort().map((enumeration) => {
          return {
            value: enumeration,
            label: enumeration,
          };
        });
      }

      if (event) {
        let hidden = event.hiddenEnumerations(fieldId);
        options = options.filter(enumeration =>
          hidden.indexOf(enumeration.value) === -1);
      }

    } else {
      invariant(
        false,
        '<RadioGroup /> is incompatible with field of type %s',
        type.base
      );
    }

    if (showEmptyOption) {
      options.unshift({
        value: null,
        label: (
          <ReactUI.Text color="#AAAAAA">
            {this._('No Value')}
          </ReactUI.Text>
        ),
      });
    }

    let keys = {};
    if (options.length <= 10) {
      let hotkeys = Hotkey.hotkeysFromOptions(options, this.props.options);
      keys = Hotkey.configureHotkeys(hotkeys);
      if (hotkeys) {
        options = options.map(option => {
          if (hotkeys[option.value]) {
            let label = (
              <span>
                <ReactUI.LabelText style={{unicodeBidi: 'isolate'}}>[{hotkeys[option.value]}]</ReactUI.LabelText>
                {' '}
                {option.label}
              </span>
            );
            return {
              ...option,
              label
            };
          } else {
            return option;
          }
        });
      }
    }

    return (
      <ReactUI.Block>
        <Hotkey.EditHotKeyHandler
          editable={editable}
          onCommitEdit={onCommitEdit}
          onCancelEdit={onCancelEdit}>
          <Hotkey.HotkeyHandler keys={keys} onKey={this.onKey}>
            <Widget
              {...props}
              disabled={disabled}
              formValue={formValue}
              padding="x-small">
              <RadioGroupInput
                layout={orientation}
                options={options}
                />
            </Widget>
          </Hotkey.HotkeyHandler>
        </Hotkey.EditHotKeyHandler>
        {!noClearButton && formValue.value != null &&
          <ReactUI.QuietButton
            tabIndex={-1}
            disabled={disabled}
            size="small"
            onClick={this.onClearValue}>
            {this._('Clear My Selection')}
          </ReactUI.QuietButton>}
      </ReactUI.Block>
    );
  }

  onClearValue = () => {
    this.props.formValue.update(null);
  };

  onKey = key => {
    let {instrument, formValue} = this.props;
    let value = key.value;
    if (instrument.type.base === 'boolean') {
      value = parseBoolean(value);
    }
    formValue.update(value);

    focusNextWithin(ReactDOM.findDOMNode(this.context.self));
  };
}
