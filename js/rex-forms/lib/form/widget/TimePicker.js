/**
 * @copyright 2016-present, Prometheus Research, LLC
 * @flow
 */

import * as React from "react";
import * as ReactForms from "react-forms/reactive";
import * as ReactUI from "@prometheusresearch/react-ui-0.21";
import Moment from "moment";

import { createMuiTheme } from "@material-ui/core/styles";
import { ThemeProvider } from "@material-ui/styles";

import { TimePicker as RexUITimePicker } from "rex-ui/datepicker";
import DateRange from "@material-ui/icons/DateRange";
import { Button } from "rex-ui";
import { style } from "react-stylesheet";

import { Modal } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";

import type { WidgetProps, WidgetInputProps } from "../WidgetConfig.js";
import MaskedInput from "../MaskedInput";
import InputText from "./InputText";

import {
  RexUIPickerWrapper,
  InputWrapper,
  Toggler,
  TogglerIconStyle,
  ButtonsWrapper,
} from "./styled.components";
import ErrorList from "../ErrorList";

const DATE_REGEX_NO_SECONDS = /^\d\d:\d\d$/;
const DATE_FORMAT_BASE = "HH:mm";

const theme = createMuiTheme();

const InputTime = (props: WidgetInputProps) => {
  const { instrument, formValue, ...rest } = props;

  const [viewDate, setViewDate] = React.useState(Moment());
  const [showModal, setShowModal] = React.useState(false);
  const [timePickerMode, setTimePickerMode] = React.useState("time");

  let selectedDate =
    props.value != null
      ? Moment(props.value, `${DATE_FORMAT_BASE}:ss`)
      : Moment();

  if (!selectedDate.isValid()) {
    selectedDate = Moment();
  }

  const onModalClose = () => setShowModal(false);

  const onChange = value => {
    if (value && value.endsWith(":__")) {
      value = value.substring(0, value.length - 3);
    }

    let viewDate = value != null ? Moment(value, DATE_FORMAT_BASE) : Moment();

    if (!viewDate.isValid()) {
      selectedDate = null;
    }

    setViewDate(viewDate);
    props.onChange(value);
  };

  const onSelectedDate = (date: ?moment$Moment) => {
    const dateString =
      date != null ? date.format(`${DATE_FORMAT_BASE}:00`) : "";
    onChange(dateString);
  };

  const onBlur = () => {
    let { value } = props;
    if (value && value.match(DATE_REGEX_NO_SECONDS)) {
      props.onChange(value + ":00");
    }
    props.onBlur();
  };

  const onShowModal = () => {
    setShowModal(true);
  };

  const onToday = () => {
    const current = Moment();

    onSelectedDate(current);
    setViewDate(current);
  };

  const onClear = () => props.onChange("");

  return (
    <ThemeProvider theme={theme}>
      <div>
        <InputWrapper>
          <ReactUI.Input
            {...rest}
            mask="99:99:99"
            Component={MaskedInput}
            onChange={onChange}
            onBlur={onBlur}
          />
          <Toggler onClick={onShowModal}>
            <DateRange style={TogglerIconStyle} />
          </Toggler>
        </InputWrapper>

        <Modal open={showModal} onClose={onModalClose}>
          <RexUIPickerWrapper>
            <Paper style={{ padding: 16 }}>
              <RexUITimePicker
                mode={timePickerMode}
                onMode={setTimePickerMode}
                viewDate={viewDate}
                onViewDate={setViewDate}
                selectedDate={selectedDate}
                onSelectedDate={onSelectedDate}
              />
              <ButtonsWrapper>
                <Button onClick={onToday} style={{ float: "left" }}>
                  Now
                </Button>
                <Button onClick={onClear} style={{ float: "left" }}>
                  Clear
                </Button>
                <Button onClick={onModalClose}>Close</Button>
              </ButtonsWrapper>

              <ErrorList formValue={formValue} />
            </Paper>
          </RexUIPickerWrapper>
        </Modal>
      </div>
    </ThemeProvider>
  );
};

function TimePicker(props: WidgetProps) {
  const updatedProps = {
    ...props,
    options: props.options
      ? {
          ...props.options,
          width: props.options.width || "small",
        }
      : {
          width: "small",
        },
  };

  let renderInput = (props: WidgetInputProps) => (
    <ReactForms.Input {...props} Component={InputTime} />
  );

  return <InputText {...updatedProps} renderInput={renderInput} />;
}

export default TimePicker;
