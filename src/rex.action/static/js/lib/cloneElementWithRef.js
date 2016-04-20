/**
 * @copyright 2015-2016, James Ide
 * @copyright 2016-present, Prometheus Research, LLC
 */

import React from 'react';

export default function cloneElementWithRef(element, config, ...children) {
  let cloneRef = config.ref;
  let originalRef = element.ref;
  if (originalRef == null || cloneRef == null) {
    return React.cloneElement(element, config, ...children);
  }

  if (typeof originalRef !== 'function') {
    console.warn( // eslint-disable-line no-console
      'Cloning an element with a ref that will be overwritten because it ' +
      'is not a function. Use a composable callback-style ref instead. ' +
      'Ignoring ref: ' + originalRef,
    );
    return React.cloneElement(element, config, ...children);
  }

  return React.cloneElement(element, {
    ...config,
    ref(component) {
      cloneRef(component);
      originalRef(component);
    },
  }, ...children);
}
