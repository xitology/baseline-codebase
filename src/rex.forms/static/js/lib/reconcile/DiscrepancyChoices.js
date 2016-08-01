/**
 * @copyright 2014-present, Prometheus Research, LLC
 */

import * as React from 'react';
import * as ReactUI from '@prometheusresearch/react-ui';
import {style} from '@prometheusresearch/react-ui/stylesheet';

import {InjectI18N} from 'rex-i18n';

import QuestionValue from '../form/QuestionValue';
import {defaultViewWidgetConfig} from '../form/WidgetConfig';
import Header from './Header';


@InjectI18N
export default class DiscrepancyChoices extends React.Component {

  static propTypes = {
    discrepancy: React.PropTypes.object.isRequired,
    question: React.PropTypes.object.isRequired,
    instrument: React.PropTypes.object.isRequired,
    formValue: React.PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      manualOverride: false,
    };
  }

  onManualOverride = (manualOverride) => {
    this.props.formValue.update(manualOverride ? null : undefined);
    this.setState({manualOverride});
  };

  updateValue = (value) => {
    if (this.state.manualOverride) {
      this.setState({manualOverride: false});
    }
    this.props.formValue.update(value);
  };

  render() {
    let {formValue, question, instrument, discrepancy} = this.props;
    let {manualOverride} = this.state;
    let values = this.renderValues(discrepancy);
    let widgetProps = {
      noClearButton: true,
      showEmptyOption: true,
    };
    return (
      <div>
        {values}
        <ReactUI.Block marginTop="small">
          <ReactUI.Block>
            <ReactUI.Checkbox
              label={this._('Manual Override')}
              value={manualOverride}
              onChange={this.onManualOverride}
              />
          </ReactUI.Block>
          {manualOverride &&
            <ReactUI.Block marginTop="small">
              <QuestionValue
                noLabel
                noHelp
                noAudio
                widgetProps={widgetProps}
                disabled={!manualOverride}
                question={question}
                instrument={instrument}
                formValue={formValue}
              />
            </ReactUI.Block>}
        </ReactUI.Block>
      </div>
    );
  }

  renderValue(value) {
    let {question, formValue, instrument} = this.props;
    let active = formValue.value === value;
    let Value = style(defaultViewWidgetConfig[instrument.type.base], {
      Root: ReactUI.Block
    });

    return (
      <ReactUI.QuietButton
        variant={{active}}
        onClick={this.updateValue.bind(null, value)}>
        <Value
          question={question}
          formValue={{value}}
          noValueText="-"
          />
      </ReactUI.QuietButton>
    );
  }

  renderValues(discrepancy) {
    let {question, formValue, instrument} = this.props;
    let Value = style(defaultViewWidgetConfig[instrument.type.base], {
      Root: ReactUI.Block
    });

    let values = Object.keys(discrepancy).sort()
      .map((key) => {
        let value = this.renderValue(discrepancy[key]);
        return (
          <td key={key}>
            <ReactUI.Block>
              {value}
            </ReactUI.Block>
          </td>
        );
      })
      .concat(
        <td key="_final_value">
          <ReactUI.Block paddingV="x-small" paddingH="small">
            <Value
              question={question}
              formValue={formValue}
              noValueText="-"
              />
          </ReactUI.Block>
        </td>
      );

    return (
      <table style={{width: '100%'}}>
        <Header entries={this.props.entries} />
        <tbody>
          <tr>{values}</tr>
        </tbody>
      </table>
    );
  }
}

