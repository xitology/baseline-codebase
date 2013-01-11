(function($) {

// {{{ helper functions
function getRandomStr(len) {
    var text = "";
    var possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i = 0; i < len; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function extend(Child, Parent) {
    var F = function() { };
    F.prototype = Parent.prototype;
    Child.prototype = new F();
    Child.prototype.constructor = Child;
    Child.superclass = Parent.prototype;
}

function isValidNumeric(val, condType) {
    return (
        (condType === 'integer'
            && /^[0-9]+$/.test(val)) ||
        (condType === 'float'
            && /^([+-]?(((\d+(\.)?)|(\d*\.\d+))([eE][+-]?\d+)?))$/.test(val))
    );
}

function objSize (obj) {
    var size = 0, key;
    for (key in obj)
        if (obj.hasOwnProperty(key))
            size++;
    return size;
};

function isValidDate(year, month, day) {
    --month;
    var d = new Date(year, month, day);
    return (d.getDate() == day &&
            d.getMonth() == month &&
            d.getFullYear() == year);
}

function objSize(obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key))
            ++size;
    }
    return size;
}

function toType(obj) {
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

function rexlize(val) {
    if (null === val)
        return rexl.String.value(null);

    type = toType(val);

    if ('number' === type)
        return rexl.Number.value(val);
    else if ('string' === type)
        return rexl.String.value(val);
    else if ('boolean' === type)
        return rexl.Boolean.value(val);

    throw('RexlTypeError');
}

var creoleParser = new Parse.Simple.Creole({
    linkFormat: ''
});

function renderCreole(srcText) {
    var tempDiv = $(document.createElement('div'));
    creoleParser.parse(tempDiv[0], srcText);
    var children = tempDiv.children();

    if (children.size() == 1 &&
        children[0].tagName === 'P') {
        // exclude paragraph wrapper if it's only one
        return children.contents();
    }

    return children;
}
// }}}

// {{{ domains
var Domain = function(name) {
    this.name = name;
};
Domain.prototype.renderEdit = function(templates, value, onChange, customTitles) {
    alert('Implement in subclasses');
};
Domain.prototype.renderView = function(templates, value, onChange, customTitles) {
    var node = $('<div>');
    this.setViewValue(node, value);
    return node;
};
Domain.prototype.setEditValue = function (node, value) {
    alert('Implement in subclasses');
};
Domain.prototype.setViewValue = function (node, value) {
    alert('Implement in subclasses');
};
Domain.prototype.extractValue = function (node) {
    alert('Implement in subclasses');
};
Domain.prototype.conforming = function() {
    return true; // default
}

var TextDomain = function(multiLine) {
    Domain.call(this, 'text');
    this.multiLine = multiLine;
};
extend(TextDomain, Domain);
TextDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var input;

    if (this.multiLine) {
        input = $('<textarea></textarea>');
        if (onChange) {
            input.focusin(function () {
                this.initialValue = $(this).val();
            });
            input.focusout(function () {
                var value = $(this).val();
                if (value !== this.initialValue)
                    onChange();
            });
        }
    } else {
        input = $('<input type="text">')
        if (onChange)
            input.change(onChange);
    }

    this.setEditValue(input, value);
    return input;
};
TextDomain.prototype.setEditValue = function (node, value) {
    node.val( (value !== null && value !== undefined) ? value : '' );
};
TextDomain.prototype.setViewValue = function (node, value) {
    node.text( (value !== null && value !== undefined) ? value : '' );
};
TextDomain.prototype.extractValue = function (node) {
    return $.trim( node.val() ) || null;
};

var DateDomain = function() {
    Domain.call(this, 'date');
};
extend(DateDomain, Domain);
DateDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var input = $('<input type="text">');
    this.setEditValue(input, value);

    if (onChange)
        input.change(onChange);

    input.datepicker({
        dateFormat: 'yy-mm-dd',
        changeYear: true,
        yearRange: "c-90:c+10",
    });

    return input;
};
DateDomain.prototype.setEditValue = function (node, value) {
    node.val( (value !== null && value !== undefined) ? value : '' );
};
DateDomain.prototype.setViewValue = function (node, value) {
    node.text( (value !== null && value !== undefined) ? value : '' );
};
DateDomain.prototype.extractValue = function (node) {
    var value = $.trim( node.val() ) || null;

    if (value !== null) {
        var matches = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!matches)
            throw("InvalidDate");
        if (!isValidDate(matches[1], matches[2], matches[3]))
            throw("InvalidDate2");
    }

    return value;
};


var RecordListDomain = function(recordDef) {
    Domain.call(this, 'recordList');
    var self = this;
    this.meta = [];
    $.each(recordDef, function (_, questionDef) {
        self.meta.push(
            new MetaQuestion(
                questionDef.name,
                questionDef.title,
                questionDef.required || false,
                domain.getFromDef(questionDef)
            )
        );
    });
};
extend(RecordListDomain, Domain);
RecordListDomain.prototype.renderViewRecord = function (templates, recordValue, customTitles) {
    var record = $('<div>').addClass('rf-view-record');
    var self = this;

    $.each(this.meta, function (i, metaQuestion) {
        var cell = $('<div>').addClass('rf-view-cell');
        cell.append(
            metaQuestion.renderView(
                templates,
                recordValue ? recordValue[metaQuestion.name] : null
            )
        );
        record.append(cell);
    });
};
RecordListDomain.prototype.renderRecordPreview = function (templates, recordValue, customTitles) {
    var record = $('<div>').addClass('rf-preview-content');

    var self = this;

    var firstQuestionPreview = null;

    if (this.meta.length) {
        var metaQuestion = this.meta[0];
        var answer = recordValue ? recordValue[metaQuestion.name] : null;
        if (answer === undefined)
            answer = null;
        renderedQuestionView = this.meta[0].renderView(templates, answer);
        firstQuestionPreview =
            renderedQuestionView.find('.rf-question-answers:first');
    }

    if (firstQuestionPreview)
        record.append(firstQuestionPreview);

    var rest = $('<div>').addClass('rf-collapsed-record-rest');
    var expandHint = templates['expandHint'].clone();
    rest.append(expandHint)
    record.append(rest);
    return record;
};
RecordListDomain.prototype.renderEditRecord = function (templates, recordValue, onChange, customTitles) {
    var record = $('<div>').addClass('rf-record');
    var preview = $('<div>').addClass('rf-record-preview');
    var cells = $('<div>').addClass('rf-cells');
    record.append(preview);
    record.append(cells);
    var self = this;

    $.each(this.meta, function (i, metaQuestion) {
        var cell = $('<div>').addClass('rf-cell');
        var questionValue =
                recordValue ? recordValue[metaQuestion.name] : null;
        cell.append(
            metaQuestion.renderEdit(
                templates,
                questionValue,
                onChange
            )
        );
        if (metaQuestion.required &&
            (questionValue === null || questionValue === undefined)) {
            cell.addClass('rf-cell-error');
        }
        cells.append(cell);
    });

    var btnCollapseRecord = templates['btnCollapseRecord'].clone();
    if (!btnCollapseRecord.hasClass('rf-collapse-record'))
        btnCollapseRecord.addClass('rf-collapse-record');
    btnCollapseRecord.click(function (event) {
        self.collapseRecord(templates, record, null, customTitles);
        event.stopPropagation();
    });
    record.append(btnCollapseRecord);

    var btnRemoveRecord = templates['btnRemoveRecord'].clone();
    var titleNode = btnRemoveRecord.filter('.rf-remove-record-title') 
    if (!titleNode.size())
        titleNode = btnRemoveRecord.find('.rf-remove-record-title');
    if (titleNode.size()) {
        var title = customTitles.removeRecord ?
                    customTitles.removeRecord: 'Remove Group of Answers';
        if (titleNode.prop("tagName") === 'A')
            titleNode.attr('title', title);
        else
            titleNode.text(title);
    }
    btnRemoveRecord.click(function () {
        if ($(this).parents('.rf-disabled:first').size() == 0) {
            record.remove();
            if (onChange)
                onChange();
        }
    });
    record.append(btnRemoveRecord);

    return record;
};
RecordListDomain.prototype.renderView = function (templates, value, onChange, customTitles) {
    var recordList = $('<div>').addClass('rf-record-list');
    var thisDomain = this;
    if (value) {
        $.each(value, function (_, recordValue) {
            recordList.append( thisDomain.renderViewRecord(templates, recordValue, customTitles) );
        });
    }
};
RecordListDomain.prototype.collapseRecord = function (templates, record, recordValue, customTitles) {

    if (record.hasClass('rf-collapsed'))
        return;

    var extractedValue;
    try {
        extractedValue = recordValue ? recordValue : this.extractRecordValue(record);
    } catch(err) {
        alert('Can\'t collapse the group because it consists of wrong values');
        var firstWrongCell = record.find('.rf-cell-error');
        if (firstWrongCell.size())
            firstWrongCell[0].scrollIntoView();
        else
            record[0].scrollIntoView();
        throw("CollapseError");
    };

    var thisDomain = this;
    if (!thisDomain.groupConforming(extractedValue)) {
        // There are wrong or missed values in the group.
        // We don't collapse a group in that case.
        return;
    }

    var previewNode = record.children('.rf-record-preview');
    // console.log('recordValue', recordValue);
    // console.log('extractedValue', extractedValue);
    var previewContent = this.renderRecordPreview(templates, extractedValue, customTitles);
    record.addClass('rf-collapsed');
    record.children('.rf-cells').css('display', 'none');
    previewNode.append(previewContent);


    record.bind('click.rfExpand', function () {
        /*
            record.siblings('.rf-record').each(function (_, sibRecord) {
                sibRecord = $(sibRecord);
                thisDomain.collapseRecord(templates, sibRecord, null, customTitles);
            });
        */
        thisDomain.expandRecord(record);
    });

    // hide 'collapse' button
    record.find('.rf-collapse-record:first').css('display', 'none');
};
RecordListDomain.prototype.expandRecord = function (record) {
    if (!record.hasClass('rf-collapsed'))
        return;

    var previewNode = record.children('.rf-record-preview');
    previewNode.contents().remove();
    record.removeClass('rf-collapsed');
    record.children('.rf-cells').css('display', '');
    record.unbind('click.rfExpand');

    // show 'collapse' button
    record.find('.rf-collapse-record:first').css('display', '');
};
RecordListDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var recordList = $('<div>').addClass('rf-record-list');
    var thisDomain = this;

    if (value) {
        $.each(value, function (i, recordValue) {
            var newRecord = thisDomain.renderEditRecord(templates, recordValue, onChange, customTitles);
            recordList.append( newRecord );
            if (i < value.length - 1)
                thisDomain.collapseRecord(templates, newRecord, recordValue, customTitles);
        });
    }

    var btnAddRecord = templates['btnAddRecord'].clone();
    var titleNode = btnAddRecord.filter('.rf-add-record-title');
    if (!titleNode.size())
        titleNode = btnAddRecord.find('.rf-add-record-title');
    if (titleNode.size()) {
        var title = customTitles.addRecord ?
                    customTitles.addRecord: 'Add Group of Answers';
        if (titleNode.prop('tagName') === 'A')
            titleNode.attr('title', title);
        else
            titleNode.text(title);
    }

    btnAddRecord.click(function () {
        if ($(this).parents('.rf-disabled').size() == 0) {
            recordList.children().each(function (_, record) {
                record = $(record);
                thisDomain.collapseRecord(templates, record, null, customTitles);
            });
            var newRecord = thisDomain.renderEditRecord(templates, null, onChange, customTitles);
            recordList.append( newRecord );
            newRecord[0].scrollIntoView();
        }
    });

    if (recordList.children().size() == 0)
        btnAddRecord.click();

    return recordList.add(btnAddRecord);
};

RecordListDomain.prototype.groupConforming = function (group) {
    var complete = true;
    var thisDomain = this;

    function findMetaByName(name) {
        for (var idx in thisDomain.meta) {
            meta = thisDomain.meta[idx];
            if (meta.name === name)
                return meta;
        }
        return null;
    }

    $.each(group, function (itemName, itemValue) {
        var thisMeta = findMetaByName(itemName);
        if (thisMeta.required && itemValue === null)
            complete = false;
    });

    return complete;
}

RecordListDomain.prototype.conforming = function (value) {
    var complete = true;
    var thisDomain = this;

    if (value !== null) {
        $.each(value, function (idx, group) {
            complete = complete && thisDomain.groupConforming(group);
        });
    }

    return complete;
}

RecordListDomain.prototype.extractRecordValue = function (node) {
    var record = {};
    var hasAnswer = false;
    var thisDomain = this;

    $(node).children('.rf-cells')
           .children('.rf-cell').each(function (j, cellNode) {

        var jCellNode = $(cellNode);
        var thisMeta = thisDomain.meta[j];
        try {
            var value = thisMeta.extractValue(jCellNode.children());
        } catch(err) {
            jCellNode.addClass('rf-cell-error');
            throw(err);
        }

        if (thisMeta.required && value === null)
            jCellNode.addClass('rf-cell-error');
        else
            jCellNode.removeClass('rf-cell-error');

        if (value !== null)
            hasAnswer = true;

        record[ thisMeta.name ] = value;
    });

    return record;
}

RecordListDomain.prototype.extractValue = function (node) {
    var ret = [];
    var thisDomain = this;
    var records = node.children('.rf-record');
    records.each(function (i, recordNode) {
        recordNode = $(recordNode);
        var record = thisDomain.extractRecordValue(recordNode);
        for (var item in record) {
            if (record[item] !== null) {
                ret.push(record);
                break;
            }
        }
    });

    return ret.length ? ret : null;
};

var NumberDomain = function(isFloat) {
    Domain.call(this, 'number');
    this.isFloat = isFloat;
};
extend(NumberDomain, Domain);
NumberDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var input = $('<input type="text">');
    this.setEditValue(input, value);

    if (onChange)
        input.change(onChange);

    return input;
};
NumberDomain.prototype.setEditValue = function (node, value) {
    node.val( (value !== null && value !== undefined) ? value : '' );
};
NumberDomain.prototype.setViewValue = function (node, value) {
    node.text( (value !== null && value !== undefined) ? value : '' );
};
NumberDomain.prototype.extractValue = function (node) {
    var value = $.trim( node.val() ) || null;

    if (value !== null) {
        if (this.isFloat && isValidNumeric(value, 'float'))
            value = parseFloat(value);
        else if (!this.isFloat && isValidNumeric(value, 'integer'))
            value = parseInt(value);
        else
            throw("InvalidNumeric");
    }

    return value;
};

var EnumCodeRegExp = new RegExp("^[a-z0-9\\-]+$", "");
var EnumDomain = function (options) {
    Domain.call(this, 'enum');
    this.variants = options.variants;
    $.each(this.variants, function (_, variant) {
        if (!EnumCodeRegExp.test(variant.code)) {
            alert('Invalid enum-answer identifier: "' + variant.code + '"');
            throw("InvalidIdentifier");
        }
    });
    this.dropDown = options.dropDown;
    this.allowClear = options.allowClear;
};
extend(EnumDomain, Domain);
var alreadyUsedNames = {};
EnumDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var ret;
    var thisDomain = this;

    if (this.dropDown) {
        ret = $('<select>').addClass('rf-answer-select');
        var option = $('<option>');
        ret.append(option);

        $.each(this.variants, function (_, variant) {
            var option = $('<option>');
            option.text(variant.title);
            option.attr('value', variant.code);
            ret.append(option);
        });

        ret.change(onChange);
    } else {
        ret = $('<ul>').addClass('rf-answer-list');
        var randName = getRandomStr(10);
        while(alreadyUsedNames[randName])
            randName = getRandomStr(10);
        alreadyUsedNames[randName] = true;

        $.each(this.variants, function (_, variant) {
            var li = $('<li>');
            var label = $('<label>');

            if (variant.title)
                label.append( renderCreole(variant.title) );
            else 
                label.text(variant.code);

            li.append(label);

            var input =
                $('<input type="radio">')
                    .attr('name', randName)
                    .attr('value', variant.code)
                    .change(onChange);

            label.prepend(input);
            ret.append(li);
        });

        if (this.allowClear) {
            var btnClear = templates['btnClear'].clone();
            btnClear.click(function () {
                if ($(this).parents('.rf-disabled').size() == 0) {
                    $(this).parents('.rf-answer-list:first')
                                .find('input[type="radio"]')
                                .removeAttr('checked');
                    onChange();
                }
            });
            ret = ret.append( $('<li>').append(btnClear) );
        }
    }

    this.setEditValue(ret, value);
    return ret;
};
EnumDomain.prototype.setViewValue = function (node, value) {
    var title = null;
    for (var idx in this.variants) {
        var variant = this.variants[idx];
        if (variant.code === value) {
            title = variant.title || variant.code;
            break;
        }
    }
    node.text( (title !== null) ? title : '' );
};
EnumDomain.prototype.setEditValue = function (node, value) {
    if (!this.dropDown) {
        node.find('input[type="radio"]').each(function (idx, element) {
            var input = $(element);
            if (input.val() === value)
                input.attr('checked', 'checked');
            else
                input.removeAttr('checked');
        });
    } else
        node.val(value);
};
EnumDomain.prototype.extractValue = function (node) {
    if (!this.dropDown) {
        var input = node.find('input[type="radio"]:checked');
        if (input.size())
            return input.val();
    } else {
        var value = node.val();
        if (value)
            return value;
    }
    return null;
};


var SetCodeRegExp = new RegExp("^[a-z0-9_]+$", "");
var SetDomain = function (variants) {
    Domain.call(this, 'set');
    this.variants = variants;
    $.each(this.variants, function (_, variant) {
        if (!SetCodeRegExp.test(variant.code)) {
            alert('Invalid set-answer identifier: ' + variant.code);
            throw("InvalidIdentifier");
        }
    });
};
extend(SetDomain, Domain);
SetDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var ret = $('<ul>').addClass('rf-answer-list');
    var thisDomain = this;

    $.each(this.variants, function (_, variant) {
        var li = $('<li>');
        var label = $('<label>').text(variant.title);
        li.append(label);

        label.prepend(
            $('<input type="checkbox">')
                .attr('value', variant.code)
                .change(onChange)
        );

        ret.append(li);
    });

    this.setEditValue(ret, value);
    return ret;
};
SetDomain.prototype.setEditValue = function (node, value) {
    node.find('input[type="checkbox"]').each(function (idx, element) {
        var input = $(element);
        if (value && value[input.val()])
            input.attr('checked', 'checked');
        else
            input.removeAttr('checked');
    });
};
SetDomain.prototype.setViewValue = function (node, value) {
    var answers = [];
    for (var idx in this.variants) {
        var variant = this.variants[idx];
        if (value[variant.code]) {
            var answer = variant.title || variant.code;
            answers.push(answer);
        }
    }
    node.text(answers.join(', '));
};
SetDomain.prototype.extractValue = function (node) {
    var inputs = node.find('input[type="checkbox"]');
    var values = {};
    var total = 0;
    inputs.each(function (_, input) {
        values[$(input).val()] = $(input).is(':checked');
        ++total;
    });
    return total ? values : null;
};

var DualNumberDomain = function(firstName, secondName, size) {
    this.firstName = firstName;
    this.secondName = secondName;
    this.size = size;
};
extend(DualNumberDomain, Domain);
DualNumberDomain.prototype.renderEdit = function (templates, value, onChange, customTitles) {
    var ret = $('<div></div>');
    var span = $('<span></span>');
    span.html(this.firstName);
    ret.append(span);
    var input = $('<input type="text">');
    input.attr("size", 10);
    input.attr("name", "first");

    if (onChange)
        input.change(onChange);

    ret.append(input);
    var span = $('<span></span>');
    span.html(this.secondName);
    ret.append(span);
    var input = $('<input type="text">');
    input.attr("size", 10);
    input.attr("name", "second");
    ret.append(input);

    if (value)
        this.setEditValue(ret, value);

    if (onChange)
        input.change(onChange);

    return ret;
};
DualNumberDomain.prototype.setViewValue = function (node, value) {
    var displayValue = '';
    if (value !== null) {
        var first = Math.floor(value / this.size);
        var second = value % this.size;
        
        displayValue = this.firstName + ': ' + first + ', ' +
                       this.secondName + ': ' + second;
    } else
        displayValue = '';
    node.text(displayValue);
};
DualNumberDomain.prototype.setEditValue = function (node, value) {
    var first = Math.floor(value / this.size);
    var second = value % this.size;
    $(node).children("input[name='first']").val(first);
    $(node).children("input[name='second']").val(second);
};
DualNumberDomain.prototype.extractValue = function (node) {
    var first = $( node ).children("input[name='first']").val();
    var second = $( node ).children("input[name='second']").val();
    if (first) 
        if (isValidNumeric(first, 'integer')) 
            lbs = parseInt(first);
        else
            throw("InvalidNumeric");

    if (second) 
        if (isValidNumeric(second, 'float')) 
            second = parseFloat(second);
        else
            throw("InvalidNumeric");

    var value = first * this.size + second;

    return value;
};


var WeightDomain = function() {
    Domain.call(this, 'weight');
    DualNumberDomain.call(this, 'lbs', 'ounce', 16);
};
extend(WeightDomain, DualNumberDomain);

var TimeWDomain = function() {
    Domain.call(this, 'time_week');
    DualNumberDomain.call(this, 'month', 'week', 4);
};
extend(TimeWDomain, DualNumberDomain);

var TimeDomain = function() {
    Domain.call(this, 'time_month');
    DualNumberDomain.call(this, 'year', 'month', 12);
};
extend(TimeDomain, DualNumberDomain);

var TimeHDomain = function() {
    Domain.call(this, 'time_hours');
    DualNumberDomain.call(this, 'days', 'hours', 24);
};
extend(TimeHDomain, DualNumberDomain);

var TimeMDomain = function() {
    Domain.call(this, 'time_minutes');
    DualNumberDomain.call(this, 'hours', 'minutes', 60);
};
extend(TimeMDomain, DualNumberDomain);

var TimeDDomain = function() {
    Domain.call(this, 'time_days');
    DualNumberDomain.call(this, 'weeks', 'days', 7);
};
extend(TimeDDomain, DualNumberDomain);

var domain = {
    all: {
        'integer': NumberDomain,
        'float': NumberDomain,
        'string': TextDomain,
        'text': TextDomain,
        'enum': EnumDomain,
        'set': SetDomain,
        'date': DateDomain,
        'weight' : WeightDomain,
        'time_week' : TimeWDomain,
        'time_hours' : TimeHDomain,
        'time_month' : TimeDomain,
        'time_minutes' : TimeMDomain,
        'time_days' : TimeDDomain,
        'rep_group': RecordListDomain
    },

    get: function(type, options) {
        var cls = this.all[type];
        return new cls(options);
    },

    annotationFromData: function(def, data) {
        if (data.annotations)
            return data.annotations[def.name] || null;
        return null;
    },

    valueFromData: function(def, data) {
        var questionType = def.type;

        switch(questionType) {
        case "set":
            var value = {};
            $.each(def.answers, function (_, answer) {
                var property = def.name + '_' + answer.code;
                if (data.answers && data.answers.hasOwnProperty(property)) {
                    value[answer.code] = data.answers[property];
                }
            });
            // return value if it's not empty
            for (item in value)
                return value;
            break;

        default:
            if (data.answers && data.answers.hasOwnProperty(def.name))
                return data.answers[def.name];
        }

        return null;
    },

    getFromDef: function(def) {
        var questionType = def.type;

        switch(questionType) {
        case "enum":
            return this.get(questionType, {
                'variants': def.answers,
                'dropDown': def.dropDown || false,
                'allowClear': def.required ? false : true
            });
        case "set":
            return this.get(questionType, def.answers);
        case "integer":
        case "float":
            return this.get(questionType,
                            "float" === questionType);
        case "rep_group":
            return this.get(questionType, def.repeatingGroup);
        case "string":
        case "text":
            return this.get(questionType,
                            "text" === questionType);
        }

        return this.get(questionType);
    }
};




// }}}

var Form = function(config, data, paramValues) {
    var self = this;

    // if pages are in group, set group skip logic to each page
    // of this group
    // if page/group in this group has the own skip logic 
    // use += '<higher-level skip logic>' | (!<higher-level skip logic>) & own-skip-logic
    // while building pages list
    // loop through its questions on the each page and to this.questions[id] = question

    this.finished = false;

    this.finish = function () {
        self.finished = true;
    }

    this.title = config.title || '';

    this.pages = [];
    this.questions = {};
    this.params = {};

    $.each(config.params || {}, function (_, param) {
        var forRexlize = null;
        if (paramValues[param.name]) {
            // TODO: consider a way to provide info about external param types
            //  to do more accurate conversion here

            if (paramValues[param.name] instanceof Array ||
                paramValues[param.name] instanceof Object)

                throw('ComplexParamsNotSupported');
            else if (param.type === "NUMBER")
                forRexlize = parseFloat(paramValues[param.name]);
            else
                forRexlize = paramValues[param.name];
        }
        self.params[param.name] = rexlize(forRexlize);
    });

    function mergeSkipExpr(first, second) {
        var parts = $.grep([first, second], function(item) {
            return item;
        });

        var newSkipExpr;

        if (0 == parts.length)
            newSkipExpr = '';
        else if (1 == parts.length)
            newSkipExpr = parts[0];
        else
            newSkipExpr = '(' + parts[0] + ')|(' + parts[1] + ')';

        return newSkipExpr;
    }

    function group(list, skipExpr, data) {
        skipExpr = skipExpr || '';
        $.each(list, function(_, item) {
            if(item.type == 'group')
                group(item.pages, mergeSkipExpr(skipExpr, item.skipIf), data);
            else
                page(item, data, skipExpr);
        });
    }

    function page(item, data, skipExpr) {
        var questions = $.map(item.questions, function(question) {
            var question = new Question(question.name,
                                        question.title,
                                        domain.getFromDef(question),
                                        domain.valueFromData(question, data),
                                        question.disableIf || null,
                                        question.constraints || null,
                                        question.required || false,
                                        question.annotation || false,
                                        domain.annotationFromData(question, data),
                                        question.customTitles || {}
                                       );

            if(self.questions[question.name])
                alert('duplicated question id:' + question.name); // TODO: throw error here
            else
                self.questions[question.name] = question;

            return question;
        });
        var page = new Page(questions, item.title, item.introduction || null, mergeSkipExpr(skipExpr, item.skipIf) || null);
        self.pages.push(page);
    }

    group(config.pages, null, data);

    // TODO: set initial values for questions


    var expr = {};
    // loop through all pages and questions and extract rexl expressions
    // as following
    // expr['a=1'].push({obj: page, ifTrue: 'skip', ifFalse: 'unskip'})
    // expr['a=1'].push({obj: question, ifTrue: 'disable', ifFalse: 'enable'})
    $.each(this.pages, function(_, page) {
        if(page.skipExpr) {
            var e = expr[page.skipExpr] = expr[page.skipExpr] || [];
            e.push({
                obj: page,
                ifTrue: 'skip',
                ifFalse: 'unskip'
            });
        }
    });

    $.each(this.questions, function(_, question) {
        if(question.disableExpr) {
            var e = expr[question.disableExpr] = expr[question.disableExpr] || [];
            e.push({
                obj: question,
                ifTrue: 'disable',
                ifFalse: 'enable'
            });
        }

        if(question.validateExpr) {
            // validate expression should not affect question until it is answered
            question.validateExpr = question.name + '==null()|(' + question.validateExpr + ')';
            var e = expr[question.validateExpr] = expr[question.validateExpr] || [];
            e.push({
                obj: question,
                ifTrue: 'validate',
                ifFalse: 'invalidate'
            });
        }
    });

    // building the change graph
    this.change = {};
    $.each(expr, function(expr, actions) {
        var parsed = rexl.parse(expr);
        $.each(parsed.getNames(), function(_, name) {
            name = name[0];
            // form external parameters will not change their value
            // so we can exclude them from the change graph
            if (undefined === self.params[name]) {
                self.change[name] = self.change[name] || [];
                self.change[name].push({
                    expr: parsed,
                    actions: actions
                });
            }
        });
    });
};

Form.prototype.initState = function() {
    var self = this;

    // bind the change event on each question
    // and calculate the initial form state
    $.each(this.change, function(key, list) {
        function changeQuestion() {
            $.each(list, function(_, value) {
                var result = self.calculate(value.expr);
                methodKey = result ? 'ifTrue':'ifFalse';
                // apply needed method to needed entity
                $.each(value.actions, function(_, action) {
                    var method = action[methodKey];
                    action.obj[method]();
                });
            });
        }
        changeQuestion();
        $(self.questions[key]).bind('change', changeQuestion);
    });
};

Form.prototype.calculate = function(expr) {
    var self = this;
    var ret = expr.evaluate(function(name) {
        // TODO: add params handling
        //if(self.hasParam(name[0]))
        //    return self.getRexlParamValue(name[0]);
        if (undefined !== self.params[name[0]])
            return self.params[name[0]];

        var question = self.questions[name[0]];
        if(!question) {
            alert("No such question: " + name[0]);
        }
        var rexlValue = question.getRexlValue(name.slice(1, name.length));
        return rexlValue;
    });
    return ret;
};

var Page = function(questions, title, introduction, skipExpr) {
    var self = this;
    this.questions = questions;
    this.title = title;
    this.skipExpr = skipExpr;
    this.introduction = introduction;
    this.renderedPage = null;
};

Page.prototype.update = function () {
    if (this.renderedPage)
        this.renderedPage.css('display', this.skipped ? 'none' : 'block');
}

Page.prototype.conforming = function () {
    var self = this;
    var isConforming = true;

    $.each(self.questions, function(id, question) {
        if (!self.skipped && !question.disabled &&
               (question.invalid || question.wrong ||
                !question.conforming() /* question.getValue() === null */ && question.annotation === null)) {
            question.markAsNotConforming();
            isConforming = false;
        }
    });

    return isConforming;
}

Page.prototype.skip = function() {
    this.skipped = true;
    this.update();
};

Page.prototype.unskip = function () {
    this.skipped = false;
    this.update();
};

Page.prototype.render = function(templates, onFormChange, mode) {
    var self = this;

    if (self.renderedPage)
        return self.renderedPage;

    var page = $('<div>').addClass('rf-page');
    $.each(self.questions, function (_, question) {
        var questionNode = null;
        if (mode === "edit")
            questionNode = question.edit( templates, onFormChange );
        else
            questionNode = question.view( templates );
        page.append(questionNode);
    });

    self.renderedPage = page;
    self.update();
    return page;
};

var MetaQuestion = function (name, title, required, domain) {
    this.name = name;
    this.title = title;
    this.domain = domain;
    this.required = required;
    this.customTitles = {};
    this.attrIdName = 'attribute-name';
};

/*
MetaQuestion.prototype.renderDomain = function (templates, value, onChange, customTitles) {
    var domainNode = this.domain.render(templates, value, onChange, customTitles);
};
*/

MetaQuestion.prototype.extractValue = function (node) {
    var domainNode = node.find('.rf-question-answers:first').children();
    return this.domain.extractValue(domainNode);
};

MetaQuestion.prototype.render = function (templates, value, onChange, mode) {
    var domainNode = null,
        templateName = null;

    if (mode === "edit") {
        domainNode = this.domain.renderEdit(templates, value, onChange, this.customTitles);
        templateName = 'editQuestion';
    } else {
        domainNode = this.domain.renderView(templates, value, this.customTitles);
        templateName = 'viewQuestion';
    }
    var questionNode = templates[templateName].clone();

    questionNode.attr('data-' + this.attrIdName, this.name);

    questionNode.addClass('rf-type-' + this.domain.name);

    questionNode.find('.rf-question-title')
            .append(renderCreole(this.title))
            .end()
            .find('.rf-question-annotation')
            .css('display', 'none')
            .end()
            .find('.rf-question-required')
            .css('display', this.required ? '' : 'none')
            .end()
            .find('.rf-question-answers')
            .append(domainNode);

    if (this.required)
        questionNode.addClass('rf-required');

    return questionNode;
}

MetaQuestion.prototype.renderView = function (templates, value) {
    return this.render(templates, value, null, 'view');
};

MetaQuestion.prototype.renderEdit = function (templates, value, onChange) {
    return this.render(templates, value, onChange, 'edit');
};

// TODO: push all arguments as a dictionary
var Question = function(name, title, domain, value, disableExpr,
                        validateExpr, required, askAnnotation,
                        annotation, customTitles) {
    MetaQuestion.call(this, name, title, required, domain);
    this.value = value;
    this.disableExpr = disableExpr;
    this.validateExpr = validateExpr;
    this.askAnnotation = askAnnotation;
    this.annotation = annotation;
    this.markAsRight();
    this.customTitles = customTitles;
    this.wrong = false;
    this.notConforming = false;
    this.attrIdName = 'question-name';
    // TODO: convert validate expr to use this.id instead of 'this';
};
extend(Question, MetaQuestion);

Question.prototype.view = function(templates) {
    if (!this.viewNode) {
        this.viewNode = this.renderView(templates, this.value);
        this.update();
    }
    return this.viewNode;
};

Question.prototype.edit = function(templates, onFormChange) {
    // TODO: rename .node to editNode
    if (!this.node) {
        var self = this;
        this.node =
            this.renderEdit(
                templates,
                this.value,
                function () {
                    try {
                        var extractedValue =
                            self.extractValue(self.node);
                        self.setValue(extractedValue);
                        self.markAsRight();
                        self.markAsConforming();
                        if (onFormChange)
                            onFormChange();
                    } catch(err) {
                        self.markAsWrong();
                    }
                }
            );
        this.update();
    }
    return this.node;
};

Question.prototype.renderEdit = function (templates, value, onChange) {
    var questionNode =
        MetaQuestion.prototype.renderEdit.call(this, templates, value, onChange);
    var self = this;
    if (this.askAnnotation) {
        var annotationNode = $(templates['annotation']);
        annotationNode
            .find('.rf-annotation-variants')
            .val(self.annotation ? self.annotation : '')
            .change(function () {
                self.annotation = $(this).val() || null;
            });
        questionNode
            .find('.rf-question-annotation')
            .append(annotationNode)
            .css('display', '');
    }
    return questionNode;
}

Question.prototype.getAnnotation = function() {
    return this.annotation;
}

Question.prototype.setAnnotation = function(annotation) {
    this.annotation = annotation;
}

Question.prototype.update = function() {
    var nodes = [this.node, this.viewNode];
    var self = this;
    $.each(nodes, function(_, node) {
        if(node) {
            var activeElements = node.find('input,textarea,select,button');

            if (self.disabled) {
                node.addClass('rf-disabled');
                activeElements.attr('disabled', 'disabled');
            } else {
                node.removeClass('rf-disabled');
                activeElements.removeAttr('disabled');
            }

            if (self.wrong || self.invalid || self.notConforming)
                node.addClass('rf-error');
            else
                node.removeClass('rf-error');
        }
    });
};

Question.prototype.setValue = function(value) {

    this.value = value;
    this.update();

    $(this).trigger('change');
};

Question.prototype.getValue = function() {
    return this.value;
};

Question.prototype.conforming = function() {
    return (this.required && this.value === null) ?
                false:
                this.domain.conforming(this.value);
}

Question.prototype.getRexlValue = function(name) {
    if (this.domain instanceof SetDomain) {
        if (null === this.value)
            return rexlize(null);
        else if (name.length)
            return rexlize(this.value[name[0]]);

        return rexlize(objSize(this.value));
    } else if (this.domain instanceof RecordListDomain) {
        if (null === this.value)
            return rexlize(null);

        return rexlize(this.value.length);
    } else
        return rexlize(this.value);
};

Question.prototype.disable = function() {
    this.setValue(null);
    this.disabled = true;
    this.update();
};

Question.prototype.enable = function() {
    this.disabled = false;
    this.update();
};

Question.prototype.invalidate = function() {
    this.invalid = true;
    this.update();
};

Question.prototype.validate = function() {
    this.invalid = false;
    this.update();
};

Question.prototype.markAsNotConforming = function () {
    if (!this.notConforming) {
        this.notConforming = true;
        this.update();
    }
}

Question.prototype.markAsConforming = function () {
    if (this.notConforming) {
        this.notConforming = false;
        this.update();
    }
}

Question.prototype.markAsWrong = function() {
    if (!this.wrong) {
        this.wrong = true;
        this.update();
    }
}

Question.prototype.markAsRight = function() {
    if (this.wrong) {
        this.wrong = false;
        this.update();
    }
}

var defaultTemplates = {
    'progressBar':
          '<div class="rf-progress-bar-fill-wrap">'
            + '<div class="rf-progress-bar-fill"></div>'
            + '<span class="rf-progress-bar-pct">30%</span>'
        + '</div>',
    'btnRemoveRecord':
        '<button class="rf-remove-record"><span class="rf-remove-record-title">Remove this group</span></button>',
    'btnCollapseRecord':
        '<button class="rf-collapse-record"><span class="rf-collapse-record-title">Collapse</span></button>',
    'btnAddRecord':
        '<button class="rf-add-record"><span class="rf-add-record-title">Add group of answers</span></button>',
    'btnClear':
        '<button class="rf-clear-answers">Clear</button>',
    'expandHint':
        '<span class="rf-expand-hint">(Click to expand)</span>',
    'editQuestion':
          '<div class="rf-question rf-question-edit">'
            + '<div class="rf-question-required"><abbr title="This question is mandatory">*</abbr></div>'
            + '<div class="rf-question-title"></div>'
            + '<div class="rf-question-answers"></div>'
            + '<div class="rf-question-annotation"></div>'
        + '</div>',
    'viewQuestion':
          '<div class="rf-question rf-question-view">'
            + '<div class="rf-question-required"><abbr title="This question is mandatory">*</abbr></div>'
            + '<div class="rf-question-title"></div>'
            + '<div class="rf-question-answers"></div>'
            + '<div class="rf-question-annotation"></div>'
        + '</div>',
    'annotation':
          '<div class="rf-annotation">'
            + '<span class="rf-annotation-title">I can\'t answer because:</span>'
            + '<select class="rf-annotation-variants">'
                + '<option value=""></option>'
                + '<option value="do_not_know">I don\'t know the answer.</option>'
                + '<option value="do_not_want">I don\'t want to answer.</option>'
            + '</select>'
        + '</div>'
};

$.RexFormsClient = function (o) {
    var self = this;

    this.mode = o.mode ? o.mode : 'normal';
    this.saveBeforeFinish = o.saveBeforeFinish || false;

    if (!o)
        throw("RexFormsClient got no parameters");

    var mandatoryParams = [
        'formMeta',
        'formName'
    ];

    if (o.package)
        mandatoryParams.push('saveURL');

    $.each(mandatoryParams, function (_, paramName) {
        if (!o[paramName])
            throw("Mandatory parameter '" + paramName + "' is not set");
    });

    // creating mandatory form elements
    function createFormElement (elemName, target) {
        self[elemName] = $( target );
        if (self[elemName].size() == 0)
            throw("Couldn't create mandatory element '" + elemName + "'" );
    }

    createFormElement( 'formArea', o.formArea || '#rf_form_area' );
    createFormElement( 'questionArea', o.questionArea || '#rf_question_area' );
    createFormElement( 'btnNext', o.btnNext || '#rf_button_next' );
    createFormElement( 'btnPrev', o.btnPrev || '#rf_button_prev' );

    this.pageTitleArea = $( o.pageTitleArea || '#rf_page_title' );
    this.formTitleArea = $( o.formTitleArea || '#rf_form_title' );
    this.pageIntroductionArea = $( o.pageIntroductionArea || '#rf_page_introduction' );

    this.btnNext.click(function () {
        self.nextPage();
    });

    this.btnPrev.click(function () {
        self.prevPage();
    });

    // building template objects
    var templates = this.templates = {};
    $.each(defaultTemplates, function (key, value) {
        var target;
        if (o.templates && o.templates[key])
            target = o.templates[key];
        else
            target = defaultTemplates[key];
        templates[key] = $( target );
    });

    // creating optional form elements
    var progressBar = null;
    var progressBarArea = $( o.progressBarArea ) || null;
    if (progressBarArea) {
        progressBar = this.templates['progressBar'];
        progressBar.appendTo(progressBarArea);
    }
    this.progressBar = progressBar;


    if (this.mode !== 'normal' &&
        this.mode !== 'preview') {
        throw("Wrong mode: " + this.mode);
    }

    this.previewURL = o.previewURL || null;
    this.saveURL = o.saveURL;
    this.finishCallback = o.finishCallback || null;
    this.events = o.events || {};

    this.form = new Form(o.formMeta, o.formData || {}, o.paramValues || {});
    this.form.initState();
    this.currentPageIdx = -1;
    this.package = o.package || null;
    this.formName = o.formName;
    this.changeStamp = 0;
    this.savedChangeStamp = 0;

    var updateProgress = function (forcePct) {
        var current = self.currentPageIdx;
        var total = self.form.pages.length;
        var completed = current >= 0 ? current: 0;
        var pct;

        if (forcePct)
            pct = forcePct;
        else
            pct = (total > 0) ? Math.floor(100 * completed/total) : 0;

        self.raiseEvent('updateProgress', {
            pct: pct,
            completed: completed,
            total: total
        });
    };

    var updateButtons = function () {
        // TODO: think how to do it better
        var showButton = self.mode !== 'preview' && self.currentPageIdx;
        self.btnPrev.css('display', showButton ? '':'none');
    }

    var validateAndGo = function (step, startFrom) {
        if (self.form.finished)
            return;

        var validateAndScroll = function (page) {
            if (!page.conforming()) {
                alert("There are missed required questions or wrong answers on this page. Please correct the information you provided.");
                var firstWrongQuestion = self.questionArea.find('.rf-error:first');
                if (firstWrongQuestion.size()) {
                    var firstWrongCell = firstWrongQuestion.find('.rf-cell-error');
                    if (firstWrongCell.size()) {
                        var collapsed = firstWrongCell.parents('.rf-collapsed:first');
                        // console.log('collapsed:', collapsed);
                        // console.log('firstWrongCell:', firstWrongCell);
                        if (collapsed.size())
                            // expand collapsed cell
                            collapsed.click();
                        firstWrongCell[0].scrollIntoView();
                    } else
                        firstWrongQuestion[0].scrollIntoView();
                }
                // there are invalid answers or
                //  missed answers for required questions
                return false;
            }
            return true;
        }

        var pages = self.form.pages;
        
        if (self.mode === "preview") {
            for (var idx in pages)
                if (!validateAndScroll(pages[idx]))
                    return;
        } else if (self.currentPageIdx >= 0 & step > 0) {
            if (!validateAndScroll(pages[self.currentPageIdx]))
                return;
        }

        var idx = (startFrom !== undefined && startFrom !== null) ?
                    startFrom : self.currentPageIdx + step;
        var total = pages.length;

        while (idx >= 0 && idx < total) {
            if (!pages[idx].skipped) {
                if (self.currentPageIdx != -1)
                    self.save(null, false);
                self.renderPage(idx, true);
                updateProgress();
                updateButtons();
                /*
                var formOffset = self.formArea.offset();
                var scrollTop = formOffset ? formOffset.top : 0;
                var doc = $("body");
                if (doc.scrollTop() > scrollTop)
                    doc.animate({ scrollTop: scrollTop }, "slow");
                */
                window.scrollTo(0, 0);
                self.saveLastVisitPage(idx);
                return;
            }

            self.raiseEvent('skipPage', idx);
            idx += step;
        }

        if (step > 0) {
            updateProgress(100);
            updateButtons();

            // if (!self.preview())
            self.finish();
        }
    };

    this.clearQuestions = function () {
        self.questionArea.children().detach();
    }

    this.renderPreview = function () {
        var self = this;
        if (!self.raiseEvent('beforePreviewRender')) {
            // stop rendering if aborted
            return;
        }

        $.each(self.form.pages, function (idx, _) {
            self.questionArea.append(
                self.renderPage(idx, false)
            );
            updateButtons();
        });
    }

    var annotationDialogTemplate = defaultTemplates['annotationDialog'];
    // this.annotationDialog = new AnnotationDialog(annotationDialogTemplate);

    this.renderPage = function (pageIdx, clear) {
    
        if (!self.raiseEvent('beforePageRender', pageIdx)) {
            // stop rendering if aborted
            return;
        }

        self.currentPageIdx = pageIdx;

        if (clear)
            self.clearQuestions();

        var page = self.form.pages[pageIdx];

        self.pageTitleArea.contents().remove();
        if (page.title)
            self.pageTitleArea.append( renderCreole(page.title) );
        else
            self.pageTitleArea.contents().remove();

        if (self.mode !== "preview") {
            if (page.introduction)
                self.pageIntroductionArea.append( renderCreole(page.introduction) );
            else
                self.pageIntroductionArea.contents().remove();
        }

        self.questionArea.append(
            page.render(
                self.templates,
                /*
                function (questionName) {
                    self.annotationDialog.askAnnotation(questionName);
                },
                */
                function () {
                    ++self.changeStamp;
                },
                /* 
                    TODO: restore this after implementing of "edit" button
                    on question preview
                     (self.mode === "preview") ? 'view' : 'edit'
                */
                'edit'
            )
        );

        page.conforming();
        self.raiseEvent('pageRendered', pageIdx);
    };

    this.raiseEvent = function(eventName, eventData) {
        $(this).trigger('rexforms:' + eventName, eventData);
        if (self.events[eventName])
            return this.events[eventName](eventData);

        return true;
    };

    this.nextPage = function() {
        validateAndGo(1);
    };

    this.prevPage = function() {
        validateAndGo(-1);
    };

    this.collectAnnotations = function () {
        var annotations = {};
        $.each(this.form.questions, function (_, question) {
            var annotation = question.getAnnotation();
            if (annotation)
                annotations[question.name] = annotation;
        });
        return annotations;
    }

    this.collectAnswers = function () {
        var answers = {};
        $.each(this.form.questions, function (_, question) {
            var value = question.getValue();

            if (value instanceof Object && !(value instanceof Array)) {
                $.each(value, function (key, value) {
                    answers[question.name + '_' + key] = value;
                });
            } else
                answers[question.name] = value;
        });
        return answers;
    }

    this.save = function (callback, sync) {
        if (null === self.package)
            return;

        var collectedData = {
            version: null, // TODO
            answers: self.collectAnswers(),
            annotations: self.collectAnnotations(),
            finished: self.form.finished
        };
        // var changeStamp = self.changeStamp;
        collectedData = $.toJSON(collectedData);

        if (!self.raiseEvent('beforeSave', collectedData))
            // stop if aborted
            return;

        new function () {
            var changeStamp = self.changeStamp;
            $.ajax({
                url: self.saveURL,
                success: function(content) {
                    self.savedChangeStamp = changeStamp;
                    self.raiseEvent('saved');
                    // console.log('save: success');
                    if (callback)
                        callback();
                },
                async: sync ? false : true,
                cache: false,
                data: 'data=' + encodeURIComponent(collectedData)
                    + '&form=' + encodeURIComponent(self.formName)
                    + '&package=' + encodeURIComponent(self.package),
                type: 'POST'
            });
        }
    };

    this.preview = function () {
        if (!self.raiseEvent('preview'))
            return true;

        if (this.previewURL)
            window.location.href = this.previewURL;

        return false;
    }

    this.finish = function () {
        var realFinish = function () {
            var eventRetData = {};
            var retValue = self.raiseEvent('beforeFinish', eventRetData);
            if (!retValue || eventRetData.cancel)
                return;

            self.btnNext.add(this.btnPrev).css('display', 'none');
            self.clearQuestions();

            self.form.finish();
            self.save(function () {
                self.raiseEvent('finished');
            }, false);
        }

        if (self.saveBeforeFinish) {
            self.save(function () {
                realFinish();
            }, false);
        } else
            realFinish();
    };

    this.getBookmarkName = function () {
        return 'rf_' + this.formName + '_' + this.package + '_bookmark';
    }

    this.getLastVisitPage = function () {
        if (this.package) {
            value = localStorage.getItem(this.getBookmarkName());
            if (value !== null && value !== undefined)
                value = parseInt(value);
            return value;
        }
        return null;
    }

    this.saveLastVisitPage = function (value) {
        if (this.package)
            localStorage.setItem(this.getBookmarkName(), value);
    }

    this.formTitleArea.append( renderCreole(this.form.title) );

    window.onbeforeunload = function (e) {
        if (self.savedChangeStamp < self.changeStamp) {
            // There are unsaved changes.
            // Saving synchrounously.
            self.save(null, true);
        }
    };

    if (this.mode === 'preview')
        this.renderPreview();
    else {
        // 'normal' mode
        var lastVisitPage = null;
        if (!o.ignoreBookmark && o.formData && objSize(o.formData))
            lastVisitPage = this.getLastVisitPage();
        validateAndGo(1, lastVisitPage);
    }
}

})(jQuery);

// vim: set foldmethod=marker:
