/**
 * @copyright 2016-present, Prometheus Research, LLC
 */

import * as React from "react";
import PropTypes from "prop-types";
import * as ReactUI from "@prometheusresearch/react-ui-0.21";
import { style } from "@prometheusresearch/react-ui-0.21/stylesheet";
import noop from "lodash/noop";

import { InjectI18N } from "rex-i18n";

import CalculationResults from "./CalculationResults";
import FormEntry from "./FormEntry";
import { post } from "../fetch";
import getLocalizedString from "../getLocalizedString";

let FormSubTitle = function({ children, ...props }) {
  return (
    <ReactUI.Block
      marginStart="3ch"
      style={{
        marginBottom: "0.6em",
        opacity: "0.5",
        fontSize: "1.5em",
        fontWeight: "bold",
      }}
      {...props}
    >
      {children}
    </ReactUI.Block>
  );
};

export default InjectI18N(
  class FormEditor extends React.Component {
    static propTypes = {
      ...FormEntry.propTypes,

      /**
       * The title to display over the form. If not specified, defaults to the
       * title found in the Form or Instrument configuration.
       */
      title: PropTypes.string,

      /**
       * The subtitle to display over the form.
       */
      subtitle: PropTypes.string,

      /**
       * Whether or not to enable the calculation preview functionality. Defaults
       * to false.
       */
      showCalculations: PropTypes.bool,

      /**
       * The minimum interval in ms between autosave events. Defaults to 5000.
       */
      autoSaveInterval: PropTypes.number,

      /**
       * The function to call in order to save the current state of the
       * Assessment. The callback will receive an object that contains:
       * * getAssessment(): The state of the Assessment after the change.
       * * isValid(): Whether or not the current state of the Assessment is valid.
       * * getErrors(): An array of the current validation errors in the form.
       * This callback can (and probably should) return a Promise when performing
       * any long running and/or asynchronous tasks.
       */
      onSave: PropTypes.func,

      /**
       * The function to call when the user moves from entry mode into review
       * mode. The callback will receive an object that contains:
       * * getAssessment(): The state of the Assessment after the change.
       * * isValid(): Whether or not the current state of the Assessment is valid.
       * * getErrors(): An array of the current validation errors in the form.
       */
      onReview: PropTypes.func,

      /**
       * The function to call when the user finalizes the form (post-review). The
       * callback will receive an object that contains:
       * * getAssessment(): The state of the Assessment after the change.
       * * isValid(): Whether or not the current state of the Assessment is valid.
       * * getErrors(): An array of the current validation errors in the form.
       */
      onComplete: PropTypes.func,
    };

    static defaultProps = {
      showCalculations: false,
      autoSaveInterval: 5000,
      onSave: noop,
      onReview: noop,
      onComplete: noop,
    };

    static stylesheet = {
      Root: style("div", {
        position: "relative",

        saving: {
          cursor: "progress",
        },
      }),
      FormTitle: "h1",
      FormSubTitle,
      CommandContainer: style("div", {
        textAlign: "center",
      }),
      ReviewCommand: ReactUI.SuccessButton,
      EditCommand: ReactUI.Button,
      CalculateCommand: ReactUI.Button,
      CompleteCommand: ReactUI.SuccessButton,
      Calculations: CalculationResults,
    };

    constructor(props) {
      super(props);

      this.state = {
        mode: "EDIT",
        formIsValid: false,
        showCalculations: false,
        calculationResults: null,
        saving: false,
        formState: null,
        formStateChanged: false,
      };
    }

    componentDidMount() {
      this._saveInterval = setInterval(
        this.save.bind(this),
        this.props.autoSaveInterval,
      );
    }

    componentWillUnmount() {
      clearInterval(this._saveInterval);
      this._saveInterval = null;
    }

    save(force = false, formState = null) {
      formState = formState || this.state.formState;
      let promise = Promise.resolve(formState);

      if (force || this.state.formStateChanged) {
        this.setState({
          saving: true,
          formStateChanged: false,
        });

        promise = promise.then(this.props.onSave).then(
          () => {
            this.setState({ saving: false });
            return formState;
          },
          error => {
            this.setState({ saving: false });
            throw error;
          },
        );
      }

      return promise;
    }

    onFormMount = form => {
      if (form) {
        this._formRef = form;
        this.setState({
          formIsValid: form.isValid(),
        });
      }
    };

    onCloseCalculations = () => {
      this.setState({
        showCalculations: false,
        calculationResults: null,
      });
    };

    onFormChange = formState => {
      this.setState({
        formIsValid: formState.isValid(),
        formState: formState,
        formStateChanged: true,
      });
    };

    onReview = () => {
      let formState = this._formRef.snapshotState();
      this.setState(
        {
          mode: "REVIEW",
        },
        () => {
          this.save(true, formState).then(this.props.onReview);
        },
      );
    };

    onEdit = () => {
      this.setState({
        mode: "EDIT",
      });
    };

    onCalculate = () => {
      this.setState({
        showCalculations: true,
        calculationResults: null,
      });

      let data = {
        data: JSON.stringify(this._formRef.getAssessment()),
      };
      post(this.props.apiUrls.calculation, data).then(
        data => {
          this.setState({
            calculationResults: data.results,
          });
        },
        () => {
          this.setState({
            calculationResults: {
              [this._("Error")]: this._(
                "There was an error when executing the calculations.",
              ),
            },
          });
        },
      );
    };

    onComplete = () => {
      let formState = this._formRef.snapshotState();
      this.setState(
        {
          mode: "DONE",
        },
        () => {
          this.props.onComplete(formState);
        },
      );
    };

    render() {
      let {
        Root,
        FormTitle,
        FormSubTitle,
        CommandContainer,
        ReviewCommand,
        EditCommand,
        CalculateCommand,
        CompleteCommand,
        Calculations,
      } = this.constructor.stylesheet;
      let { showCalculations, title, subtitle, ...formProps } = this.props;

      if (title === undefined) {
        if (formProps.form.title) {
          title = getLocalizedString(
            formProps.form.title,
            this.getI18N(),
            formProps.form.defaultLocalization,
          );
        } else {
          title = formProps.instrument.title;
        }
      }

      if (this.state.mode === "EDIT") {
        formProps.mode = "entry";
      } else if (this.state.mode === "REVIEW") {
        formProps.mode = "review";
        formProps.noPagination = true;
      } else {
        formProps.mode = "view";
        formProps.noPagination = true;
      }
      if (formProps.onChange) {
        let previousOnChange = formProps.onChange;
        formProps.onChange = formState => {
          previousOnChange(formState);
          this.onFormChange(formState);
        };
      } else {
        formProps.onChange = this.onFormChange;
      }

      let formIsValid = this.state.formIsValid;
      let currentlySaving = this.state.saving;
      let showReview = this.state.mode === "EDIT";
      let showEdit = this.state.mode === "REVIEW";
      let showCalculate =
        showCalculations &&
        formProps.apiUrls.calculation &&
        (this.state.mode === "EDIT" || this.state.mode === "REVIEW");
      let showResults = this.state.showCalculations;
      let showComplete = this.state.mode === "REVIEW";

      return (
        <ReactUI.I18N.I18N dir={this.getI18N().isRightToLeft() ? "rtl" : "ltr"}>
          <Root variant={{ saving: currentlySaving }}>
            {title && <FormTitle>{title}</FormTitle>}
            {subtitle && <FormSubTitle>{subtitle}</FormSubTitle>}
            {showResults && (
              <Calculations
                results={this.state.calculationResults}
                onClose={this.onCloseCalculations}
              />
            )}
            <FormEntry {...formProps} ref={this.onFormMount} />
            <CommandContainer>
              {showReview && (
                <ReviewCommand
                  disabled={!formIsValid || currentlySaving}
                  onClick={this.onReview}
                >
                  {currentlySaving
                    ? this._("Saving Your Progress, Please Wait...")
                    : this._("Review Submission")}
                </ReviewCommand>
              )}
              {showEdit && (
                <EditCommand onClick={this.onEdit}>
                  {this._("Go Back to the Form")}
                </EditCommand>
              )}
              {showComplete && (
                <CompleteCommand
                  disabled={currentlySaving}
                  onClick={this.onComplete}
                >
                  {currentlySaving
                    ? this._("Saving Your Progress, Please Wait...")
                    : this._("Complete Form")}
                </CompleteCommand>
              )}
              {showCalculate && (
                <CalculateCommand
                  disabled={!formIsValid}
                  onClick={this.onCalculate}
                >
                  {this._("Preview Calculation Results")}
                </CalculateCommand>
              )}
            </CommandContainer>
          </Root>
        </ReactUI.I18N.I18N>
      );
    }
  },
);
