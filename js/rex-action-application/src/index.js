// TODO: rex-widget should go first because it sets up the __webpack_public_path__
// this should be broadly fixed
import * as rexWidget from "rex-widget";

rexWidget.Transitionable.registerPackageResolver(function(pkgName) {
  switch (pkgName) {
    case "rex-about":
      return import("rex-about");
    case "rex-acquire-actions":
      return import("rex-acquire-actions");
    case "rex-action":
      return import("rex-action");
    case "rex-dbgui":
      return import("rex-dbgui");
    case "rex-formbuilder":
      return import("rex-formbuilder");
    case "rex-mart-actions":
      return import("rex-mart-actions");
    case "rex-query":
      return import("rex-query");
    case "rex-widget":
      return import("rex-widget");
    case "rex-widget-chrome":
      return import("rex-widget-chrome");
    case "rex-demo-baseline":
      return import("rex-demo-baseline");
    default:
      throw Error(`${pkgName} not found in the bundle.`)
  }
});

// this is needed for rex.form_previewer to work
window.Rex = window.Rex || {};
window.Rex = {
  FormPreviewer: {
    renderForm: function(options) {
      return import("rex-form-previewer").then(m => {
        m.renderForm(options);
      });
    }
  }
};
