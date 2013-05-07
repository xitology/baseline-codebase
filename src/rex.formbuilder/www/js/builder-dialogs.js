
(function () {

var builder = $.RexFormBuilder = $.RexFormBuilder || {};
var dialogNS = builder.dialog = {};

dialogNS.QuestionDialog = function (o) {

    var template =
            '<div>'
              + '<div class="rb-question-dialog-text"></div>'
          + '</div>';
    var parent = o.parent || null;
    var node = $(template).dialog({
        autoOpen: false,
        title: 'Question',
        width: 400,
        height: 200,
        modal: true,
        close: function () {
            if (options.onResult)
                options.onResult(retValue);
            options = null;
            retValue = null;
        }
    });
    var txtNode = node.find('.rb-question-dialog-text');
    var options = null;
    var retValue = null;
    var self = this;

    function setDialogButtons(buttons) {
        var optButtons = {};
        for (var btnName in buttons) {
            var f = function () {
                var callee = arguments.callee;
                retValue = buttons[callee.btnName]();
                self.close();
            }
            f.btnName = btnName;
            optButtons[btnName] = f;
        }
        node.dialog('option', 'buttons', optButtons);
    }

    this.open = function (o) {
        options = {};
        options.txt = o.txt || '';
        options.onResult = o.onResult || null;
        options.title = o.title || '';
        txtNode.text(options.txt);
        options.buttons = o.buttons || {
            'Ok': function () {
                return true;
            },
            'Cancel': function () {
                return false;
            }
        };
        setDialogButtons(options.buttons);
        node.dialog('option', 'title', options.title);
        node.dialog('open');
    }

    this.close = function () {
        node.dialog('close');
    }
}


dialogNS.promptDialog = function (o) {

    var self = this;
    var parent = o.parent || null;
    var template =
         '<div class="rb-prompt-dialog">'
            + '<div>'
            +   '<h3></h3>'
            +   '<input type="text" class="rb-prompt-input" />'
            + '</div>'
        + '</div>';
    this.options = null;

    this.close = function () {
        self.options = null;
        node.dialog('close');
    };

    var node = $(template);
    var input = $('input.rb-prompt-input', node);
    var header = $('h3', node);

    this.validate = function (value) {
        if (self.options.validate && !self.options.validate(value))
            return false;
        return true;
    };

    this.onOk = function () {
        var newValue = jQuery.trim(input.val());
        if (!self.validate(newValue)) {
            alert("Wrong input value!");
            return;
        }
        if (self.options.onSet)
            self.options.onSet(newValue);
        self.close();
    };

    node = node.dialog({
        autoOpen: false,
        title: 'Edit Group',
        width: 300,
        height: 230,
        modal: true,
        buttons: {
            'Ok': self.onOk,
            'Cancel': self.close
        }
    });

    this.open = function (o) {
        self.options = {};
        self.options.initialValue = o.initialValue || '';
        self.options.onSet = o.onSet || null;
        self.options.validate = o.validate || null;
        self.options.title = o.title || 'Edit Value';
        self.options.question = o.question || 'Please input value:';
        node.dialog('option', 'title', self.options.title);
        header.text(self.options.question);
        input.val(self.options.initialValue);
        node.dialog('open');
    };
}


dialogNS.EditParamDialog = function (o) {

    var self = this;
    var template =
        '<div class="rb_edit_param_dialog">'
          + '<div>'
          +     'Set identifier name:<br><input type="text" class="rb_edit_param_name" />'
          + '</div>'
          + '<div style="margin-top: 20px;">'
          +     'Type:<br>'
          +     '<select class="rb_select_param_type" >'
          +         '<option value="NUMBER">Number</option>'
          +         '<option value="STRING">String</option>'
          +         '<option value="DATE">Date</option>'
          +     '</select>'
          + '</div>'
      + '</div>';

    var node = null;
    var options = null;

    this.close = function () {
        options = null;
        node.dialog('close');
    }

    node = $(template);
    var nameInput = $('input.rb_edit_param_name', node);
    var typeInput = $('select.rb_select_param_type', node);

    if (o.extTypes) {
        for (var typeName in o.extTypes) {
            var typeDesc = o.extTypes[typeName];
            $('<option>', {
                value: typeName,
                text: typeDesc.title || typeName
            }).appendTo(typeInput);
        }
    }

    this.onOk = function () {
        var newName = jQuery.trim(nameInput.val());
        var newType = typeInput.val();
        if (newName) {
            options.onChange(newName, newType);
            self.close();
        }
    }

    node = node.dialog({
        autoOpen: false,
        title: 'Edit Parameter',
        width: 300,
        height: 230,
        modal: true,
        buttons: {
            'Ok': self.onOk,
            'Cancel': self.close
        }
    });

    var onChange = function () {
        var val = nameInput.val();
        var newVal = val.replace(builder.illegalIdChars, '');
        if (newVal !== val)
            nameInput.val(newVal);
    };

    nameInput.change(onChange);
    nameInput.keyup(onChange);

    this.open = function (o) {
        options = {};
        options.extTypes = o.extTypes || null;
        options.onChange = o.onChange || null;
        options.paramName = o.paramName || '';
        options.paramType = o.paramType || 'NUMBER';
        options.dialogTitle = o.dialogTitle || 'Edit Parameter';
        nameInput.val(options.paramName);
        typeInput.val(options.paramType);
        node.dialog('option', 'title', options.dialogTitle);
        node.dialog('open');
    };
}


dialogNS.ShowJSONDialog = function (o) {
    var node = null;
    var outputNode = null;
    var parent = o.parent || null;
    var template =
        '<div>'
          + '<div class="rb_json_text_wrap">'
          +     '<textarea class="rb_json_text" wrap="off" readonly="readonly"></textarea>'
          + '</div>'
      + '</div>';

    this.close = function () {
        node.dialog('close');
    }
    node = $(template).dialog({
        autoOpen: false,
        title: "Instrument's JSON",
        width: 600,
        height: 300,
        modal: true,
    });
    outputNode = $('textarea', node);
    this.open = function () {
        var jsonTxt =
            builder.generateMetaJSON(
                builder.instrumentName || '',
                true
            );
        outputNode.val(jsonTxt);
        node.dialog('open');
    };
}


dialogNS.BeforeTestDialog = function (o) {

    var self = this;
    var options = null;
    var parent = o.parent || null;
    var extTypes = o.extTypes || null;
    var template =
        '<div class="before_test_dialog">'
          + '<h1>Please, set values for parameters to start a test:</h1>'
          + '<table class="before_test_parameters"></table>'
      + '</div>';

    this.close = function () {
        options = null;
        node.dialog('close');
    };

    this.onOk = function () {
        var paramDict = {};
        var valid = true;

        paramTable.find('tr').each(function () {
            var jRow = $(this);
            var paramName = jRow.attr('data-param');
            var param = builder.context.findParamData(paramName);
            var value = jQuery.trim(jRow.find('input,select').val());

            if (value) {
                var realType = param.type;

                if (param.type !== 'STRING' &&
                    param.type !== 'NUMBER' &&
                    param.type !== 'DATE') {
                    
                    if (extTypes) {
                        typeDesc =
                            extTypes[param.type];
                        if (typeDesc)
                            realType = typeDesc.type;
                    }
                }
                switch(realType) {
                case 'DATE':
                    var m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                    if (!m || !builder.isValidDate(m[1], m[2], m[3])) {
                        valid = false;
                        break;
                    }
                    paramDict[paramName] = value;
                    break;
                case 'NUMBER':
                    if (!builder.isValidNumeric(value, 'float')) {
                        valid = false;
                        break;
                    }
                    paramDict[paramName] = value;
                    break;
                default:
                    paramDict[paramName] = value;
                }
            } else
                paramDict[paramName] = null;
        });

        if (valid) {
            if (options.callback)
                options.callback(paramDict);
            self.close();
        }
    }

    var node = $(template);
    var paramTable = $('.before_test_parameters', node);
    node = node.dialog({
        autoOpen: false,
        title: 'Set Input Parameters',
        width: 300,
        height: 230,
        modal: true,
        buttons: {
            'Ok': self.onOk,
            'Cancel': self.close
        }
    });

    this.open = function (o) {
        options = {};
        options.callback = o.callback || null;
        options.paramValues = o.paramValues || {};
        params = builder.context.getIndexByType('parameter');
        paramTable.contents().remove();
        for (var idx in params) {
            var param = params[idx];
            var rowHTML = '<tr><td>'
                            + builder.escapeHTML(param.name) + '</td>'
                            + '<td class="rb_test_param_value"></td></tr>';
            var row = $(rowHTML);
            row.attr('data-param', param.name);
            var isScalar = true;
            var realType = param.type;
            var typeDesc;
            if (param.type !== 'NUMBER' &&
                param.type !== 'STRING' &&
                param.type !== 'DATE') {
                if (extTypes) {
                    typeDesc =
                        extTypes[param.type];
                    if (typeDesc && typeDesc.type === 'ENUM')
                        isScalar = false;
                    realType = typeDesc;
                }
            }

            var paramValuePlace = row.find('.rb_test_param_value:first');

            if (isScalar) {
                var input = $('<input type="text" />');
                paramValuePlace.append(input);
                if (realType === "DATE") {
                    input.datepicker({
                        dateFormat: 'yy-mm-dd'
                    });
                }
                if (options.paramValues && 
                    options.paramValues[param.name]) {

                    input.val(options.paramValues[param.name]);
                }
            } else {
                var select = $('<select>');
                $('<option>', {
                    value: '',
                    text: ''
                }).appendTo(select);

                for (var idx in typeDesc.variants) {
                    var variant = typeDesc.variants[idx];
                    $('<option>', {
                        value: variant.code,
                        text: variant.title || variant.code
                    }).appendTo(select);
                }
                paramValuePlace.append(select);

                if (options.paramValues && 
                    options.paramValues[param.name]) {

                    select.val(options.paramValues[param.name]);
                }
            }

            paramTable.append(row);
        }
        node.dialog('open');
    };
};


})();