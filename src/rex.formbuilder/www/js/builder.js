
(function () {

var builder = $.RexFormBuilder = $.RexFormBuilder || {};

var Question = function (def, templates) {
    var self = this;
    this.type = def.type;
    this.name = def.name;
    this.title = def.title;
    this.templates = templates;
    // this.hint = def.hint || null;
    this.help = def.help || null;
    this.customTitles = def.customTitles || {};
    this.required = def.required || false;
    this.annotation = def.annotation || false;
    this.explanation = def.explanation || false;
    this.slave = def.slave || null;
    this.disableIf = def.disableIf || null;
    this.constraints = def.constraints || null;
    this.annotation = def.annotation || null;
    this.explanation = def.explanation || null;

    this.getNode = function () {
        if (!self.node) {
            self.node = this.templates.create('question');
            self.node.data('owner', this);
            self.updateNode();
        }
        return self.node;
    };

    this.updateNode = function() {
        if (self.node) {
            var title = builder.truncateText(self.title || '', 100);
            self.node.find('.rb-question-title').text(title);
            self.node.find('.rb-question-name').text(self.name);
            self.node.find('.rb-question-descr').text(self.description())
        }
    };
};
Question.prototype.description = function () {
    return builder.questionTypes[this.type].title;
};
Question.prototype.getDef = function () {
    var def = {
        type: this.type,
        name: this.name,
        title: this.title,
        required: this.required,
    };
    if (this.help)
        def.help = this.help;
    if (this.customTitles)
        def.customTitles = $.extend(true, {}, this.customTitles);
    if (this.slave)
        def.slave = this.slave;
    if (this.disableIf)
        def.disableIf = this.disableIf;
    if (this.constraints)
        def.constraints = this.constraints;
    if (this.annotation)
        def.annotation = this.annotation;
    if (this.explanation)
        def.explanation = this.explanation;
    return def;
};

var VariantQuestion = function (def, templates) {
    Question.call(this, def, templates);
    this.dropDown = def.dropDown || false;
    this.answers = def.answers || [];
};
builder.extend(VariantQuestion, Question);
VariantQuestion.prototype.description = function () {
    var self = this;
    var titles = [];
    var titles = $.map(self.answers, function(answer, _) {
        return answer.title || answer.code;
    });
    return titles.join(', ');
};
VariantQuestion.prototype.getDef = function () {
    var def = Question.prototype.getDef.call(this);
    if (this.dropDown)
        def.dropDown = this.dropDown;
    def.answers = $.extend(true, {}, this.answers);
    return def;
}

var RepeatingGroupQuestion = function (def, templates) {
    Question.call(this, def, templates);
    var self = this;
    this.group = [];
    $.each(def.repeatingGroup, function (_, questionDef) {
        var type = questionDef.type;
        var cls = builder.questionTypes[type].cls;
        var question = new cls(questionDef, templates);
        self.group.push(question);
    });
};
builder.extend(RepeatingGroupQuestion, Question);
RepeatingGroupQuestion.prototype.getDef = function () {
    var def = Question.prototype.getDef.call(this);
    def.repeatingGroup = [];
    $.each(this.group, function (_, question) {
        def.repeatingGroup.push(question.getDef());
    });
};

var Page = function (o) {
    var self = this;
    this.parent = null;
    this.questions = [];
    this.templates = o.templates;
    this.onSelectPage = o.onSelectPage || null;
    this.node = this.createNode();
    this.node.data('owner', this);
    $.each(o.def.questions || [], function (_, questionDef) {
        var cls = builder.questionTypes[questionDef.type].cls;
        var question = new cls(questionDef, self.templates);
        self.questions.push(question);
    });
    this.setTitle(o.def.title || null);
    this.cId = o.def.cId || null;
    this.setSkipIf(o.def.skipIf || null);
    this.bindEvents();
};
Page.prototype.bindEvents = function () {
    var self = this;
    self.node.click(function () {
        if (self.onSelectPage)
            self.onSelectPage(self);
    });
    self.node.find('.rb-page-add-next:first').click(function () {
        var page = new Page({
            def: {
                type: "page",
                title: null,
                questions: [],
                // TODO: generate unique cId
            },
            templates: self.templates
        });
        self.parent.append(page, self);
        page.node[0].scrollIntoView();
    });
    self.node.find('.rb-page-remove:first').click(function () {
        if (confirm("Are you sure you want to remove this item?"))
            self.remove();
    });
};
Page.prototype.setTitle = function (title) {
    this.title = title;
    var titleNode = this.node.find('.rb-page-title:first');
    var text;
    if (this.title) {
        text = builder.truncateText(this.title, 30);
        titleNode.text(text);
        titleNode.removeClass('rb-not-set');
    } else {
        var total = this.questions.length;
        if (total) {
            text = builder.truncateText(this.questions[0].title, 30);
            titleNode.text(text);
            if (total > 1)
                titleNode.append('<br><span class="rb-dark-text">And ' + (total - 1) + ' question(s)</span>');
            titleNode.removeClass('rb-not-set');
        } else {
            titleNode.text('Untitled page');
            titleNode.addClass('rb-not-set');
        }
    }
};
Page.prototype.createNode = function () {
    return this.templates.create('page');
};
Page.prototype.setSkipIf = function (skipIf) {
    this.skipIf = skipIf;
};
Page.prototype.remove = function () {
    this.parent.exclude(this);
    this.node.remove();
};

var PageContainer = function (pageList, pageDefs, onSelectPage) {
    var self = this;
    this.pages = [];
    this.pageList = pageList;
    this.pageList.data('owner', this);
    this.pageList.sortable({
        cursor: 'move',
        toleranceElement: '> div',
        connectWith: '.rb-page-list',
        stop: function (event, ui) {
            var element = ui.item.data('owner');
            var receiverNode = ui.item.parent();
            var receiver = receiverNode.data('owner');
            if (element.parent !== receiver)
                element.parent.exclude(element);
            receiver.rearrange();
        }
    });
    $.each(pageDefs, function (_, def) {
        var page;
        var opts = {
            templates: self.templates,
            onSelectPage: onSelectPage,
            def: def
        };
        if (def.type == "group")
            page = new Group(opts);
        else
            page = new Page(opts);
        self.append(page);
    });
};
PageContainer.prototype.append = function (page, after) {
    if (after) {
        var idx = this.pages.indexOf(after);
        this.pages.splice(idx + 1, 0, page);
        after.node.after(page.node);
    } else {
        this.pages.push(page);
        this.pageList.append(page.node);
    }
    page.parent = this;
};
PageContainer.prototype.exclude = function (page) {
    var idx = this.pages.indexOf(page);
    this.pages.splice(idx, 1);
};
PageContainer.prototype.rearrange = function () {
    var self = this;
    self.pages = [];
    self.pageList.children().each(function (_, item) {
        item = $(item);
        var itemOwner = item.data('owner');
        self.pages.push(itemOwner);
    });
    console.log('rearranged:', self.pages);
};
PageContainer.prototype.createEmptyPage = function () {
    return new Page({
        def: {
            type: "page",
            title: null,
            questions: []
            // TODO: generate unique cId
        },
        templates: this.templates
    });
};

var Group = function (o) {
    var self = this;
    Page.call(this, o);
    PageContainer.call(this, self.node.find('.rb-page-list:first'),
                        o.def.pages || [], o.onSelectPage);
    self.skipIfEditor = new EditableLogic({
        nodeText: self.node.find('.rb-group-skip-if:first'),
        nodeBtn: self.node.find('.rb-group-skip-if-change:first'),
        value: self.skipIf,
        maxVisibleTextLen: 30,
        emptyValueText: 'Never skipped',
        onChange: function (newValue) {
            self.skipIf = newValue;
        }
    });
};
builder.extend(Group, Page);
builder.extend(Group, PageContainer);
Group.prototype.createNode = function () {
    return this.templates.create('group');
};
Group.prototype.setTitle = function (title) {
    this.title = title;
    var titleNode = this.node.find('.rb-group-title:first');
    if (this.title) {
        var text = builder.truncateText(this.title, 30);
        titleNode.text(text);
        titleNode.removeClass('rb-not-set');
    } else {
        titleNode.text('Untitled group');
        titleNode.addClass('rb-not-set');
    }
};
Group.prototype.setSkipIf = function (skipIf) {
    this.skipIf = skipIf;
    if (this.skipIfEditor)
        this.skipIfEditor.setValue(this.skipIf);
    /*
    var skipIfNode = this.node.find('.rb-group-skip-if:first');
    if (this.skipIf) {
        var text = builder.truncateText(this.title, 30);
        skipIfNode.text(truncated);
        skipIfNode.removeClass('rb-not-set');
    } else {
        skipIfNode.text('Never skipped');
        skipIfNode.addClass('rb-not-set');
    }
    */
};
Group.prototype.bindEvents = function () {
    var self = this;
    self.node.find('.rb-group-remove:first').click(function () {
        if (confirm("Are you sure you want to remove this item?"))
            self.remove();
    });
    self.node.find('.rb-group-title:first')
        .add(self.node.find('.rb-group-title-change:first'))
            .click(function () {
                builder.promptDialog.open({
                    title: 'Edit Group Title',
                    question: 'Please provide a new group title:',
                    initialValue: self.title,
                    onSet: function (newValue) {
                        self.setTitle(newValue);
                    }
                })
            });
};

(function () {
    var scripts = document.getElementsByTagName( 'script' );
    var thisScriptTag = $(scripts[ scripts.length - 1 ]);
    builder.basePrefix =
        thisScriptTag.attr('data-prefix') || '';
    builder.formsPrefix =
        thisScriptTag.attr('data-forms-prefix') || '';
})();

builder.questionTypes = {
    'integer': { 
        title: 'Integer',
        cls: Question
    },
    'float': { 
        title: 'Float',
        cls: Question
    },
    'enum': { 
        title: 'One-choice List',
        cls: VariantQuestion
    },
    'set': { 
        title: 'Multi-select List',
        cls: VariantQuestion
    },
    'string': { 
        title: 'Text String',
        cls: Question
    },
    'text': { 
        title: 'Text',
        cls: Question
    },
    'date': { 
        title: 'Date',
        cls: Question
    },
    'weight': { 
        title: 'Weigth',
        cls: Question
    },
    'time_week': { 
        title: 'Time (weeks)',
        cls: Question
    },
    'time_month': { 
        title: 'Time (month)',
        cls: Question
    },
    'time_hours': { 
        title: 'Time (hours)',
        cls: Question
    },
    'time_minutes': { 
        title: 'Time (minutes)',
        cls: Question
    },
    'time_days': { 
        title: 'Time (days)',
        cls: Question
    },
    'rep_group': { 
        title: 'Repeating Group of Questions',
        cls: RepeatingGroupQuestion
    }
};
builder.copyQuestion = function (question) {
    var type = question.type;
    var def = question.getDef();
    var cls = builder.questionTypes[type].cls;
    return new cls(def, question.templates);
};

$.RexFormBuilder.predefinedLists = {};

var Templates = function () {
    var self = this;
    var templates = {
        'questionEditor': $('#tpl_question_editor').removeAttr('id'),
        'variant': $('#tpl_variant').removeAttr('id'),
        'question': $('#tpl_question').removeAttr('id'),
        'page': $('#tpl_page').removeAttr('id'),
        'group': $('#tpl_page_group').removeAttr('id'),
        'parameter': $('#tpl_parameter').removeAttr('id'),
        'customTitle': $('#tpl_custom_title').removeAttr('id')
    };

    var selectQType = $('select[name="question-type"]',
                                templates['questionEditor']);
    if (selectQType) {
        for (type in builder.questionTypes) {
            var title = builder.questionTypes[type].title;
            selectQType.append($('<option value="' + type
                                    + '"></option>').text(title));
        }
    }

    this.get = function (tplName) {
        if (templates[tplName])
            return templates[tplName];
        return null;
    }

    this.create = function (tplName) {
        return self.get(tplName).clone();
    }
};

var Context = function (name, extParamTypes, manualEditConditions, urlStartTest, urlSaveForm) {
    this.instrumentName = name;
    this.extParamTypes = extParamTypes;
    this.manualEditCondtions = manualEditConditions;
    this.urlStartTest = urlStartTest;
    this.urlSaveForm = urlSaveForm;
};

var Pages = function (o) {
    var self = this;
    this.templates = o.templates;
    this.addPageButton = o.addPageButton;
    this.makeGroupButton = o.makeGroupButton;
    PageContainer.call(this, o.pageList, o.pages, o.onSelectPage);
    this.addPageButton.click(function () {
        var page = self.createEmptyPage();
        self.append(page);
        page.node[0].scrollIntoView();
        // TODO: make this page as current
    });
};
builder.extend(Pages, PageContainer);

var InputParameter = function (def, parent, template, extParamTypes, onRemove) {
    var self = this;
    self.parent = parent;
    self.node = template.clone();
    var removeBtn = self.node.find('a.rb-param-remove');
    var editBtn = self.node.find('a.rb-param-edit');
    removeBtn.click(function () {
        self.parent.exclude(self);
        self.node.remove();
    });
    editBtn.click(function () {
        builder.editParamDialog.open({
            paramName: self.name,
            paramType: self.type,
            onChange: function (newName, newType) {
                if (builder.inputParameters.updateParameter(self, newName,
                                                            newType)) {
                    var oldName = self.name;
                    /*
                    if (oldName !== newName)
                        $.RexFormBuilder.renameREXLIdentifiers(oldName, newName);
                    */
                }
            }
        });
    });
    this.remove = function () {
        self.node.remove();
    };
    this.update = function (name, type) {
        self.name = name;
        self.type = type;
        self.node.find('.rb-param-name').text(self.name);
        var typeTitle = builder.paramTypeTitle(self.type);
        self.node.find('.rb-param-type').text(typeTitle);
    };

    this.update(def.name, def.type);
};

var InputParameters = function (o) {
    var self = this;
    self.parameters = [];
    self.template = o.template;
    self.listNode = o.listNode;
    self.addButton = o.addButton;
    self.extParamTypes = o.extParamTypes || {};

    this.sort = function() {
        self.parameters.sort(function (a, b) {
            if (a.name === b.name)
                return 0;
            return (a.name < b.name) ? -1: 1;
        });
        $.each(self.parameters, function (_, parameter) {
            self.listNode.append(parameter.node);
        });
    };
    this.isUnique = function (name, except) {
        var isUnique = true;
        $.each(self.parameters, function(_, parameter) {
            if (parameter.name === name && parameter !== except) {
                isUnique = false;
            }
        });
        return isUnique;
    };
    this.exclude = function (parameter) {
        var idx = self.parameters.indexOf(parameter);
        self.parameters.splice(idx, 1);
        parameter.node.detach();
    };
    this.add = function (paramDef) {
        if (!self.isUnique(paramDef.name)) {
            alert("Could not add parameter '" + paramDef.name
                    + "': parameter already exists");
            return;
        }
        var parameter = new InputParameter(paramDef, self, self.template,
                               self.extParamTypes);
        self.parameters.push(parameter);
        self.sort(); // also it will auto-append new parameter to the list node
    };
    this.updateParameter = function (parameter, newName, newType) {
        if (!self.isUnique(newName, parameter)) {
            alert("Could not change parameter: parameter '" + newName
                    + "' already exists");
            return;
        };
        parameter.update(newName, newType);
    };

    $.each(o.parameters, function (_, paramDef) {
        self.add(paramDef);
    });

    self.addButton.click(function () {
        builder.editParamDialog.open({
            onChange: function (newName, newType) {
                var paramDef = {
                    name: newName,
                    type: newType
                };
                builder.inputParameters.add(paramDef);
            }
        });
    });
};

var EditableLogic = function (o) {
    var self = this;
    self.value = null;
    self.nodeText = o.nodeText;
    self.nodeBtn = o.nodeBtn;
    self.maxVisibleTextLen = o.maxVisibleTextLen || 30;
    self.emptyValueText = o.emptyValueText || 'Not set';
    self.onChange = o.onChange || null;

    self.setValue = function (value, internal) {
        self.value = value ? value : '';
        if (self.onChange)
            self.onChange(self.value);
        if (!internal) {
            if (self.value) {
                var text = builder.truncateText(self.value, 
                                                self.maxVisibleTextLen);
                self.nodeText.text(text)
                             .removeClass('rb-not-set');
            } else
                self.nodeText.text(self.emptyValueText)
                             .addClass('rb-not-set');
        }
    };

    self.getValue = function () {
        return self.value;
    };

    self.openEditor = function () {
        // TODO: open condition editor
        console.log('open condition editor');
    };

    self.nodeBtn.click(self.openEditor);
    self.setValue(o.value || null);
};

var EditableTitle = function (o) {
    var self = this;
    self.value = null;
    self.nodeText = o.nodeText;
    self.nodeBtn = o.nodeBtn;
    self.nodeInput = o.nodeInput;
    self.maxVisibleTextLen = o.maxVisibleTextLen || 30;
    self.emptyTitleText = o.emptyTitleText || 'Untitled';
    self.onChange = o.onChange || null;

    self.setTitle = function (title, internal) {
        self.value = title ? title : '';
        if (self.onChange)
            self.onChange(self.value);
        if (!internal) {
            if (self.value) {
                var text = builder.truncateText(self.value, 
                                                self.maxVisibleTextLen);
                self.nodeText.text(text)
                             .removeClass('rb-not-set');
            } else
                self.nodeText.text(self.emptyTitleText)
                             .addClass('rb-not-set');
            self.nodeInput.val(self.value);
        }
    };

    self.getTitle = function () {
        return self.value;
    };

    self.showEditor = function () {
        self.nodeInput.css('display', '');
        self.nodeBtn.add(self.nodeText).css('display', 'none');
    };

    self.closeEditor = function () {
        self.nodeInput.css('display', 'none');
        self.nodeBtn.add(self.nodeText).css('display', '');
    };

    self.nodeInput.css('display', 'none');
    self.nodeInput.change(function () {
        var val = self.nodeInput.val();
        self.setTitle(val);
        self.closeEditor();
    });
    self.nodeBtn.click(self.showEditor);
    self.setTitle(o.title || null);
    self.closeEditor();
};

builder.customTitleTypes = {
    'removeRecord': 'Remove Group of Answers',
    'addRecord': 'Add Group of Answers'
};

var CustomTitle = function (type, text, parent, templates) {
    var self = this;
    self.type = null;
    self.text = null;
    self.parent = parent;
    self.node = templates.create('customTitle');

    self.nodeFor = self.node.find('.rb-custom-title-for:first');
    self.nodeText = self.node.find('.rb-custom-title-text:first');
    self.nodeEdit = self.node.find('.rb-custom-title-edit:first');
    self.nodeRemove = self.node.find('.rb-custom-title-remove:first');

    self.nodeEdit.click(function () {
        builder.customTitleDialog.open({
            initialType: self.type,
            initialText: self.text,
            validate: function (type, text) {
                if (!text)
                    return false;
                return self.parent.isUnique(type, self);
            },
            onSet: function (newType, newText) {
                self.setText(newText);
                self.setType(newType);
                self.parent.sort();
            }
        });
    });

    self.nodeRemove.click(function () {
        self.remove();
    });

    self.setText = function (text) {
        self.text = text;
        self.nodeText.text(self.text);
    };
    self.setType = function (type) {
        self.type = type;
        self.nodeFor.text(builder.customTitleTypes[self.type]);
    };
    self.remove = function (type) {
        self.parent.exclude(self);
        self.node.remove();
    };

    self.setType(type);
    self.setText(text);
};

var CustomTitleEditor = function (o) {
    var self = this;
    self.titles = [];
    self.node = o.node;
    self.nodeList = self.node.find(".rb-custom-titles:first");
    self.nodeAddButton = self.node.find(".rb-custom-title-add:first");
    self.templates = o.templates;

    self.nodeAddButton.click(function () {
        builder.customTitleDialog.open({
            validate: function (type, text) {
                if (!text)
                    return false;
                return self.isUnique(type);
            },
            onSet: function (newType, newText) {
                self.add(newType, newText)
            }
        });
    });

    self.exclude = function (item) {
        var idx = self.titles.indexOf(item);
        self.titles.splice(idx, 1);
    };
    self.sort = function() {
        self.titles.sort(function (a, b) {
            var a = builder.customTitleTypes[a.type];
            var b = builder.customTitleTypes[b.type];
            if (a === b)
                return 0;
            return (a < b) ? -1: 1;
        });
        $.each(self.titles, function (_, title) {
            self.nodeList.append(title.node);
        });
    };
    self.isUnique = function (type, except) {
        var isUnique = true;
        $.each(self.titles, function(_, title) {
            if (title.type === type && title !== except) {
                isUnique = false;
            }
        });
        return isUnique;
    };
    self.add = function (type, text) {
        var title = new CustomTitle(type, text, self, self.templates);
        self.titles.push(title);
        self.sort(); // it will also append the new title to the list node
    };

    $.each(o.customTitles, function (type, text) {
        self.add(type, text);
    });
};

var Variant = function (code, title, separator, parent, templates) {
    var self = this;
    self.title = title;
    self.code = code;
    self.node = templates.create('variant');
    self.node.data('owner', this);
    self.parent = parent;
    self.autoGenerateId = !code;
    self.separator = '_'; // default
    self.illegalIdChars = builder.illegalIdChars;

    var inputCode = self.node.find('input[name=answer-code]:first');
    var inputTitle = self.node.find('input[name=answer-title]:first');
    var removeButton = self.node.find('.rb-variant-remove:first');

    self.remove = function () {
        self.parent.exclude(self);
        self.node.remove();
    };
    self.setSeparator = function (separator) {
        var previous = self.separator;
        if (previous === separator)
            return;
        self.illegalIdChars = builder.getIllegalIdChars(separator);
        self.separator = separator;
        if (self.code) {
            self.code = self.code.replace(previous, self.separator);
            inputCode.val(self.code);
        }
    };

    removeButton.click(function () {
        self.remove();
    });

    inputTitle.val(self.title || '');
    inputTitle.change(function () {
        self.title = $.trim(inputTitle.val());
        if (self.autoGenerateId)
            inputCode.val(builder.getReadableId(self.title, false, self.separator, 45));
    });

    var fixInputAnswerIdentifier = function (input) {
        var val = input.val();
        var newVal = val.replace(self.illegalIdChars, '');
        if (newVal !== val)
            input.val( newVal );
    };

    self.setSeparator(separator);
    inputCode.val(self.code || '');
    inputCode.keyup(function () {
        fixInputAnswerIdentifier( inputCode );
    });
    inputCode.change(function () {
        self.autoGenerateId = false;
        fixInputAnswerIdentifier( inputCode );
        var val = $.trim(inputCode.val());
        self.code = val;
    });
};

var VariantsEditor = function (o) {
    var self = this;
    var node = o.node;
    var nodeHeader = node.find(".rb-question-answers-header:first");
    var nodeList = node.find(".rb-question-answers-list:first");
    var nodeAddButton = node.find(".rb-question-answers-add:first");
    var nodeHint = node.find(".rb-question-answers-list-hint:first");
    self.variants = [];

    nodeList.sortable({
        cursor: 'move',
        toleranceElement: '> div',
        stop: function (event, ui) {
            self.rearrange();
        }
    });

    self.show = function () {
        node.css('display', '');
    };
    self.hide = function () {
        node.css('display', 'none');
    };
    self.updateHelpers = function () {
        var empty = (self.variants.length == 0);
        nodeHeader.css('display', empty ? 'none': '');
        nodeHint.css('display', empty ? '': 'none');
    };
    self.rearrange = function () {
        self.variants = [];
        nodeList.children().each(function (_, item) {
            var item = $(item);
            var owner = item.data('owner');
            self.variants.push(owner);
        });
    };
    self.exclude = function (variant) {
        var idx = self.variants.indexOf(variant);
        self.variants.splice(idx, 1);
        self.updateHelpers();
    };
    self.setSeparator = function (separator) {
        self.separator = separator;
        $.each(self.variants, function (_, variant) {
            variant.setSeparator(separator);
        });
    };
    self.add = function (code, title) {
        var variant = new Variant(code, title, self.separator, self, o.templates);
        self.variants.push(variant);
        nodeList.append(variant.node);
        self.updateHelpers();
    };
    nodeAddButton.click(function () {
        self.add(null, null);
    });
    self.setSeparator(o.separator);
    $.each(o.answers, function (_, answer) {
        self.add(answer.code, answer.title);
    });
    self.updateHelpers();
};

/*
var SubquestionEditor = function (node, subquestions, templates) {
    var self = this;
    var node = self.node.find('.rb-subquestions-wrap:first');
    var nodeList = self.node.find('.rb-subquestions:first');

    this.show = function () {
        node.css('display', 'none');
    };
    this.hide = function () {
        node.css('display', 'none');
    };
};
*/

var QuestionContainer = function (o) {
    var self = this;
    self.editors = [];
    self.questions = [];
    self.listNode = o.listNode;
    self.listNode.sortable({
        cursor: 'move',
        toleranceElement: '> div',
        stop: function (event, ui) {
            self.rearrange();
        }
    });
    self.addButton = o.addButton;
    self.addButton.click(function () {
        self.openQuestionEditor(null);
    });
    self.rearrange = function () {
        self.questions.length = 0;
        self.listNode.children().each(function () {
            var item = $(this);
            var owner = item.data('owner');
            if (owner) {
                if (owner instanceof QuestionEditor) {
                    var question = owner.question;
                    if (question.name)
                        owner = owner.question;
                }
                self.questions.push(owner);
            }
        });
    };
    self.excludeQuestion = function (question) {
        var idx = self.questions.indexOf(question);
        self.editors.splice(idx, 1);
    };
    self.excludeEditor = function (editor) {
        var idx = self.editors.indexOf(editor);
        self.editors.splice(idx, 1);
    };
    self.openQuestionEditor = function (question) {
        var isNew = question ? true : false;
        var editor = new QuestionEditor(question, self, self.templates);
        self.editors.push(editor);
        if (isNew) {
            var questionNode = question.getNode();
            questionNode.before(editor.node);
            questionNode.detach();
        } else
            self.listNode.append(editor.node);
    };
    self.emptyListNode = function () {
        self.listNode.children()
                     .unbind("click.question").detach();
    };
    self.syncListNode = function () {
        $.each(self.questions, function (_, question) {
            var node = question.getNode();
            node.bind("click.question", function () {
                var owner = $(this).data('owner');
                self.openQuestionEditor(owner);
            });
            self.listNode.append(question.getNode());
        });
    };
};

var QuestionEditor = function (question, parent, templates) {
    var self = this;
    self.parent = parent;
    self.question = question;
    self.templates = templates;
    self.node = self.templates.create('questionEditor');

    QuestionContainer.call(self, {
        listNode: self.node.find('.rb-subquestions:first'),
        addButton: self.node.find('.rb-subquestion-add:first'),
    });
    if (self.question && self.question.type === "rep_group") {
        $.each(self.question.group, function (_, question) {
            var copy = builder.copyQuestion(question);
            self.questions.push(copy);
        });
        self.syncListNode();
    }

    self.autoGenerateId = !(self.question && self.question.name);

    var nodeTitle = self.node.find('textarea[name=question-title]:first');
    var nodeName = self.node.find('input[name=question-name]:first');
    var nodeRequired = self.node.find('input[name=question-required]:first');
    var nodeAnnotation = self.node.find('input[name=question-annotation]:first');
    var nodeExplanation = self.node.find('input[name=question-explanation]:first');
    var nodeType = self.node.find('select[name=question-type]:first');
    var nodeCancel = self.node.find('.rb-question-cancel:first');
    var nodeSubquestions = self.node.find('.rb-subquestions-wrap:first');

    if (self.parent instanceof QuestionEditor)
        // nested repeating groups are not allowed
        nodeType.find("option[value=rep_group]").remove();

    var fixInputIdentifier = function (input) {
        var val = input.val();
        var newVal = val.replace(builder.illegalIdChars, '');
        if (newVal !== val) {
            input.val( newVal );
        }
    }

    nodeName.change(function () {
        self.autoGenerateId = false;
        fixInputIdentifier( $(this) );
    });
    nodeName.keyup(function () {
        fixInputIdentifier( $(this) );
    });

    nodeTitle.change(function () {
        if (self.autoGenerateId) {
            var titleVal = $.trim(nodeTitle.val());
            nodeName.val(
                builder.getReadableId(titleVal, true, '_', 45)
            );
        }
    });

    var constraintEditor = new EditableLogic({
        nodeText: self.node.find(".rb-question-constraint:first"),
        nodeBtn: $(".rb-question-constraint-change:first"),
        maxVisibleTextLen: 30,
        emptyValueText: 'No constraints',
        value: self.question ? self.question.constraints : null
    });
    var disableIfEditor = new EditableLogic({
        nodeText: self.node.find(".rb-question-disable-if:first"),
        nodeBtn: $(".rb-question-disable-if:first"),
        maxVisibleTextLen: 30,
        emptyValueText: 'Never disabled',
        value: self.question ? self.question.disableIf : null
    });
    var answerEditor = new VariantsEditor({
        node: self.node.find(".rb-question-answers:first"),
        answers: self.question && builder.isListType(self.question.type) ? 
                    self.question.answers: [],
        templates: self.templates,
        separator: self.question && self.question.type === "enum" ? '-' : '_'
    });
    var customTitleEditor = new CustomTitleEditor({
        node: self.node.find(".rb-custom-titles-wrap:first"),
        templates: self.templates,
        customTitles: self.question ? self.question.customTitles : {}
    });

    nodeType.change(function () {
        var type = nodeType.val();
        if (builder.isListType(type)) {
            answerEditor.show();
            nodeSubquestions.css('display', 'none');
            answerEditor.setSeparator( type === "enum" ? '-': '_' );
        } else {
            answerEditor.hide();
            nodeSubquestions.css('display', (type === "rep_group") ?
                                                '': 'none');
        }
    });

    if (self.question) {
        nodeTitle.val(self.question.title || '');
        nodeName.val(self.question.name || '');
        if (self.question.required)
            nodeRequired.attr('checked', 'checked');
        if (self.question.annotation)
            nodeAnnotation.attr('checked', 'checked');
        if (self.question.explanation)
            nodeExplanation.attr('checked', 'checked');
        nodeType.val(self.question.type).change();
    }
};
builder.extend(QuestionEditor, QuestionContainer);

var PageEditor = function (o) {
    var self = this;
    self.templates = o.templates;
    self.editorNode = o.editorNode;
    QuestionContainer.call(self, {
        listNode: o.listNode,
        addButton: self.editorNode.find('.rb-question-add:first')
    });
    self.pageTitle = new EditableTitle({
        nodeText: $("#rb_page_title"),
        nodeBtn: $("#rb_page_title_change"),
        nodeInput: $("#rb_page_title_input"),
        maxVisibleTextLen: 60,
        emptyTitleText: 'Untitled page',
        onChange: function (newValue) {
            if (self.page)
                self.page.setTitle(newValue);
        }
    });
    self.page = null;
    self.skipIfEditor = new EditableLogic({
        nodeText: $("#rb_page_skip_if"),
        nodeBtn: $("#rb_page_skip_if_change"),
        maxVisibleTextLen: 60,
        emptyValueText: 'Never skipped',
        onChange: function (newValue) {
            if (self.page)
                self.page.setSkipIf(newValue);
        }
    });
    this.setPage = function (page) {
        self.page = page;
        self.pageTitle.setTitle(page ? page.title : null);
        self.skipIfEditor.setValue(page ? page.skipIf : null);
        self.emptyListNode();
        self.questions = self.page ? self.page.questions : [];
        self.syncListNode();
        self.editors = [];
    };
    this.show = function (page) {
        self.setPage(page);
        self.editorNode.css('display', '');
    };
    this.hide = function () {
        self.setPage(null);
        self.editorNode.css('display', 'none');
    };
    this.setSkipIf = function (skipIf) {
        this.skipIf = skipIf;
        var skipIfNode = this.node.find('.rb-group-skip-if:first');
        if (this.skipIf) {
            var text = builder.truncateText(this.title, 30);
            skipIfNode.text(truncated);
            skipIfNode.removeClass('rb-not-set');
        } else {
            skipIfNode.text('Never skipped');
            skipIfNode.addClass('rb-not-set');
        }
    };
    this.setPage(null);
};
builder.extend(PageEditor, QuestionContainer);

builder.initDialogs = function () {
    var commonOptions = {
        parent: builder
    };
    builder.showJSONDialog =
        new builder.dialog.ShowJSONDialog(commonOptions);
    builder.promptDialog =
        new builder.dialog.promptDialog(commonOptions);
    var dialogOptions = $.extend({
        extTypes: builder.context.extParamTypes
    }, commonOptions);
    builder.editParamDialog =
        new builder.dialog.EditParamDialog(dialogOptions);
    dialogOptions = $.extend({
        extTypes: builder.context.extParamTypes
    }, commonOptions);
    builder.beforeTestDialog =
        new builder.dialog.BeforeTestDialog(dialogOptions);
    builder.questionDialog =
        new builder.dialog.QuestionDialog(commonOptions);
    dialogOptions = $.extend({
        customTitleTypes: builder.customTitleTypes
    }, commonOptions);
    builder.customTitleDialog =
        new builder.dialog.CustomTitleDialog(dialogOptions);
    builder.progressDialog = $('.rb_progress_dialog').dialog({
        dialogClass: 'progress-dialog',
        modal: true,
        autoOpen: false,
        width: 350,
        open: function () { },
        close: function () { }, 
    });
}

builder.init = function (o) {
    builder.context =
        new Context(o.instrument, o.extParamTypes,
                    o.manualEditConditions || false,
                    o.urlStartTest || null, o.urlSaveForm || null);
    builder.templates = new Templates();
    builder.initDialogs();
    builder.instrumentTitle = new EditableTitle({
        nodeText: $('#rb_instrument_title'),
        nodeBtn: $('#rb_instrument_title_button'),
        nodeInput: $('#rb_instrument_title_input'),
        title: o.code.title,
        maxVisibleTextLen: 30,
        emptyTitleText: 'Untitled instrument'
    });
    builder.inputParameters = new InputParameters({
        listNode: $("#rb_params_list"),
        addButton: $("#rb_params_add"),
        template: builder.templates.get('parameter'),
        extParamTypes: o.extParamTypes,
        parameters: o.code.params || [], // [{type: "STRING", name: "abc"}],
    });
    builder.pages = new Pages({
        makeGroupButton: $("#rb_make_group"),
        addPageButton: $("#rb_add_new_page"),
        pageList: $("#rb_page_list"),
        pages: o.code.pages,
        templates: builder.templates,
        onSelectPage: function (page) {
            builder.pageEditor.show(page);
        }
    });
    builder.pageEditor = new PageEditor({
        editorNode: $("#rb_page_editor"),
        pageTitleNode: $("#rb_page_title"),
        pageTitleButton: $("#rb_page_title_change"),
        pageTitleInput: $("#rb_page_title_input"),
        skipIfNode: $("#rb_page_skip_if"),
        skipIfButton: $("#rb_page_skip_if_change"),
        listNode: $("#rb_question_list"),
        templates: builder.templates
    });
};

/* 
$.RexFormBuilder.namesWhichBreaksConsistency = function (names, exclude) {
    console.log('namesWhichBreaksConsistency(', names, ')');

    var badNames = {};
    var chkNames = {};
    $.each(names, function (_, name) {
        chkNames[name] = true;
    });

    questionIndex = $.RexFormBuilder.context.getIndexByType('question');

    for (var idx in questionIndex) {
        var question = questionIndex[idx];
        
        if (question === exclude)
            continue;
        
        if (chkNames[question.name]) {

            badNames[question.name] = true;
            delete chkNames[question.name];

        } else if (question.type === "set") {

            for (var idx in question.answers) {
                var fullName = question.name + '_'
                               + question.answers[idx].code;
                if (chkNames[fullName]) {
                    badNames[fullName] = true;
                    delete chkNames[fullName];
                }
            }
        }
    }

    return Object.keys(badNames);
}

$.RexFormBuilder.generateMetaJSON = function(instrumentName, doBeautify) {
    var instrumentMeta = $.RexFormBuilder.generateMeta(instrumentName);

    if (doBeautify && JSON && JSON.stringify)
        return JSON.stringify(instrumentMeta, null, 4);

    return $.toJSON(instrumentMeta);
}

$.RexFormBuilder.saveInstrumentReal = function(callback) {
    var instrumentName = $.RexFormBuilder.instrumentName;

    if (!instrumentName)
        instrumentName = prompt("Please set instrument name:");

    if (instrumentName) {
        if ($.RexFormBuilder.context.getIndexByType('question').length == 0) {
            alert('A form should contain at least one question!');
            return;
        }
    
        var meta = $.RexFormBuilder.generateMeta(instrumentName);

        meta = $.toJSON(meta);
        var schema = 'instrument=' + encodeURIComponent(instrumentName) 
                    + '&data=' + encodeURIComponent( meta );

        var url = $.RexFormBuilder.context.urlSaveForm ||
                 ($.RexFormBuilder.basePrefix + "/add_instrument");
        $.ajax({url : url,
            success : function(content) {
                if (!$.RexFormBuilder.instrumentName)
                    $.RexFormBuilder.instrumentName = instrumentName;

                if (callback)
                    callback();
                else
                    alert('instrument saved!');
            },
            error: function() {
                $.RexFormBuilder.closeProgress();
                alert('Error of saving instrument!');
            },
            data : schema,
            type: 'POST'
        });
    }
};

$.RexFormBuilder.saveInstrument = function(callback) {
    $.RexFormBuilder.closeOpenedEditor(function () {
        $.RexFormBuilder.saveInstrumentReal();
    }, questionListDiv);
}

$.RexFormBuilder.hints = {
    emptyField: 'This field could not be empty!',
    wrongQuestionId: 'Question names must begin with a letter. '
                      + 'They may contain letters, numbers, and '
                      + 'underscores, e.g. "q01_test".',
    dupQuestionId: 'There is another question with the same name. Question names should be unique in each group.',
    wrongAnswerId: 'Choice identifiers are required. They may contain letters, numbers and dashes, e.g. "yes_1".',
    dupAnswerId: 'There are several answers with the same code. Answer codes should be unique in each question.',
    emptyAnswerId: 'Answer Id could not be empty!',
    noAnswers: 'Please add at least one choice',
    wrongScore: 'Scores should be numerical'
}

$.RexFormBuilder.dismissIt = function(a) {
    var p = $(a).parents('div:first').remove();
}

$.RexFormBuilder.putHint = function(element, hintId) {
    var existentHint = element.next('.rb_hint');
    if (existentHint.size() == 0 ||
        existentHint.attr('data-hint-id') !== hintId) {

        existentHint.remove();
        var hint = $(document.createElement('div'))
                             .addClass('rb_hint')
                             .addClass('rb_red_hint')
                             .addClass('rb_question_input')
                             .attr('data-hint-id', hintId);
        hint.text($.RexFormBuilder.hints[hintId] + ' ');
        hint.append(' <a href="javascript:void(0)" onclick="$.RexFormBuilder.dismissIt(this);">Dismiss this message</a>');
        element.after(hint);
    }
}

$.RexFormBuilder.processREXLObject = function (rexlObj, chCount, oldName, newName) {
    if (rexlObj.type === "IDENTIFIER") {
        if (rexlObj.value === oldName) {
            rexlObj.value = newName;
            ++chCount;
        }
    }

    if (rexlObj.args && rexlObj.args.length) {
    
        if (rexlObj.type === "OPERATION" &&
            rexlObj.value === "." && rexlObj.args.length > 0) {

            chCount += $.RexFormBuilder.processREXLObject(rexlObj.args[0],
                                                        chCount,
                                                        oldName,
                                                        newName);

        } else {

            for (var idx in rexlObj.args) {
                chCount += $.RexFormBuilder.processREXLObject(rexlObj.args[idx],
                                                            chCount,
                                                            oldName,
                                                            newName);
            }
        }
    }

    return chCount;
}

$.RexFormBuilder.renameREXLIdentifierIfExist = 
        function (obj, condName, oldName, newName) {

    var chCounter = 0;

    if (obj[condName] && obj.cache && obj.cache[condName]) {
        if (chCounter = $.RexFormBuilder.processREXLObject(obj.cache[condName], 
                                                         0, 
                                                         oldName, 
                                                         newName)) {

            obj[condName] = obj.cache[condName].toString();
            console.log('updated:', obj[condName]);
        }
    }
    return chCounter;
}

$.RexFormBuilder.renameREXLIdentifiers = function (oldName, newName) {
    var qIndex = $.RexFormBuilder.context.getIndexByType('question');
    for (var pos in qIndex) {
        $.RexFormBuilder.renameREXLIdentifierIfExist(qIndex[pos], 
                                                   'disableIf',
                                                   oldName,
                                                   newName);
        $.RexFormBuilder.renameREXLIdentifierIfExist(qIndex[pos],
                                                   'constraints', 
                                                   oldName, 
                                                   newName);
    }

    $('.rb_question_editor', questionListDiv).each(function () {
        var editor = $(this);

        if ($.RexFormBuilder.renameREXLIdentifierIfExist(this, 
                                                       'disableIf',
                                                       oldName,
                                                       newName)) {

            $.RexFormBuilder.updateDisableLogicDescription(editor);
        }

        if ($.RexFormBuilder.renameREXLIdentifierIfExist(this, 
                                                       'constraints',
                                                       oldName,
                                                       newName)) {

            $.RexFormBuilder.updateConstraintsDescription(editor);
        }
    });

    var pIndex = $.RexFormBuilder.context.getIndexByType('page');
    for (var pos in pIndex) {
        $.RexFormBuilder.renameREXLIdentifierIfExist(pIndex[pos],
                                                   'skipIf',
                                                   oldName,
                                                   newName);
    }

    var pIndex = $.RexFormBuilder.context.getIndexByType('group');
    for (var pos in pIndex) {
        $.RexFormBuilder.renameREXLIdentifierIfExist(pIndex[pos],
                                                   'skipIf',
                                                   oldName,
                                                   newName);
    }
}

$.RexFormBuilder.makeREXLCache = function (obj, condName) {
    if (obj[condName]) {
        try {
            var parsed = rexl.parse(obj[condName]);

            if (!obj['cache'])
                obj['cache'] = {};

            obj['cache'][condName] = parsed;
        } catch(err) {
            delete obj[condName];
        }
    }
}

$.RexFormBuilder.changeConstraints = function(btn) {
    var jButton = $(btn);
    var questionEditor = jButton.parents('.rb_question_editor:first');

    $.RexFormBuilder.constraintsThisQuestion =
        $.RexFormBuilder.collectQuestionData(questionEditor);

    if ($.RexFormBuilder.constraintsThisQuestion) {
        $.RexFormBuilder.conditionEditor.open({
            title: 'Edit Constraints',
            callback: function (newValue) {
                questionEditor[0].constraints = newValue;
                $.RexFormBuilder.makeREXLCache(questionEditor[0], 'constraints');
                $.RexFormBuilder.updateConstraintsDescription(questionEditor);
            },
            defaultIdentifier: 'this',
            onClose: function (newValue) {
                $.RexFormBuilder.constraintsThisQuestion = null;
            },
            conditions: questionEditor[0].constraints
        });
    } else {
        alert('Impossible: there are wrong values in the editor');
    }
}

builder.initConditionEditor = function () {
    builder.conditionEditor = new ConditionEditor({
        urlPrefix: $.RexFormBuilder.basePrefix,
        manualEdit: builder.context.manualEditConditions,
        identifierTitle: 'Question or parameter',
        onDescribeId: function (identifier) {

            var ret = null;
            var questionData = null;

            if (identifier === "this") {
                if ($.RexFormBuilder.constraintsThisQuestion)
                    questionData = $.RexFormBuilder.constraintsThisQuestion;
            } else
                questionData = $.RexFormBuilder.context.findQuestionData(identifier);

            if (questionData) {
                ret = {};
                switch(questionData.type) {
                case 'float':
                case 'integer':
                    ret.type = 'number';
                    break;
                case 'set':
                case 'enum':
                case 'yes_no':

                    if (questionData.type === "set")
                        ret.type = "set";
                    else
                        ret.type = "enum";

                    if (questionData.type === "yes_no")
                        ret.variants = [
                            {
                                code: 'yes',
                                title: 'Yes'
                            },
                            {
                                code: 'no',
                                title: 'No'
                            }
                        ];
                    else
                        ret.variants = questionData.answers;

                    break;
                case 'date':
                    ret.type = 'date';
                    break;
                case 'string':
                case 'text':
                default:
                    ret.type = 'string';
                    break;
                }
            } else if (identifier !== "this") {
                var paramData = $.RexFormBuilder.context.findParamData(identifier);
                if (paramData) {
                    ret = {};

                    switch(paramData.type) {
                    case 'NUMBER':
                        ret.type = 'number';
                        break;
                    case 'STRING':
                    default:
                        if (builder.context.extParamTypes) {
                            var typeDesc = 
                                builder.context.extParamTypes[paramData.type];

                            console.log('typeDesc[' + paramData.type +']:', typeDesc);

                            if (typeDesc) {
                                switch(typeDesc.type) {
                                case 'NUMBER':
                                    ret.type = 'number';
                                    break;
                                case 'ENUM':
                                    ret.type = 'enum';
                                    ret.variants = typeDesc.variants;
                                    break;
                                case 'DATE':
                                    ret.type = 'date';
                                    break;
                                default:
                                case 'STRING':
                                    ret.type = 'string';
                                    break;
                                }
                            } else {
                                ret.type = 'string';
                            }
                        } else
                            ret.type = 'string';
                        break;
                    }
                }
            }

            console.log('onDescribeId[' + identifier + ']', ret);

            return ret;
        },
        onSearchId: function (term) {

            var ret = [];
            var matcher =
                new RegExp($.ui.autocomplete.escapeRegex(term), "i");

            if ($.RexFormBuilder.constraintsThisQuestion) {
                var item = $.RexFormBuilder.constraintsThisQuestion;
                if ("this".indexOf(term) != -1) {
                    ret.push({
                        "title": item.title ?
                            $.RexFormBuilder.truncateText(item.title, 80) : '',
                        "value": "this"
                    });
                }
            }

            var qIndex = $.RexFormBuilder.context.getIndexByType('question');
            for (var pos in qIndex) {
                var item = qIndex[pos];
                
                if (!item.slave && item.name) {
                    if (item.name.search(matcher) !== -1 ||
                        (item.title &&
                            item.title.search(matcher) !== -1)) {

                        ret.push({
                            "title": item.title ?
                                $.RexFormBuilder.truncateText(item.title, 80) : '',
                            "value": item.name
                        });
                    }
                }
            }

            var pIndex = $.RexFormBuilder.context.getIndexByType('parameter');

            for (var pos in pIndex) {
                var item = pIndex[pos];

                if (item.name.search(matcher) !== -1) {
                    ret.push({
                        "title": 'parameter ('
                                + builder.paramTypeTitle(item.type, builder.context.extParamTypes)
                                + ')',
                        "value": item.name
                    });
                }
            }

            console.log('onSearchId', ret);
            return ret;
        }
    });
}

$.RexFormBuilder.getItemLevel = function(pageDiv, objType) {
    var level = 0;
    var cls = (objType === 'page') ?
                'rb_page_group':
                'rb_condition_group';
    var element = pageDiv.parents("." + cls + ":first");
    while (element.size()) {
        ++level;
        element = element.parents("." + cls + ":first");
    }
    return level;
}

$.RexFormBuilder.checkIfEdge = function(element, fromLeft, objType) {
    var selector = (objType === 'page') ?
                        '.rb_page,.rb_page_group':
                        '.rb_condition_item,.rb_condition_group';
    return (fromLeft && element.prev(selector).size() === 0) ||
            (!fromLeft && element.next(selector).size() === 0);
}

$.RexFormBuilder.getLowestAllowedLevel = function(element, level, fromLeft, objType) {

    var cls = (objType === 'page') ?
                    'rb_page_group' : 'rb_condition_group';

    while (element.size() && level) {
        if ($.RexFormBuilder.checkIfEdge(element, fromLeft, objType)) {
            --level;
            element = element.parent('.' + cls + ':first');
        } else
            break;
    }
    return level;
}

$.RexFormBuilder.getCutoff = function(page, objType) {
    var cutoff = [];
    var element = page;

    var chkId = (objType === 'page') ?
                    'rb_pages_list':
                    'rb_condition_builder_list';

    cutoff.push(element);

    do {
        element = element.parent();
        
        if (!element.hasClass(chkId))
            cutoff.unshift(element);
    } while (element.attr('class') !== chkId && element.size())

    return cutoff;
}

$.RexFormBuilder.interceptCutoff = function(cutoff1, cutoff2) {
    var intercept = []
    var len = cutoff1.length < cutoff2.length ? 
                cutoff1.length:
                cutoff2.length;
                
    for (var idx = 0; idx < len; idx++) {
        if (cutoff1[idx][0] === cutoff2[idx][0])
            intercept.push(cutoff1[idx]);
    }
    return intercept;
}

$.RexFormBuilder.makePageGroupFromSelection = function() {
    $.RexFormBuilder.editPageDialog.open({
        mode: 'group'
    });
}

$.RexFormBuilder.processSelectedPages = function(newGroupName) {
    var firstPage = $.RexFormBuilder.currentSelection[0];
    var lastPage = 
        $.RexFormBuilder.currentSelection[$.RexFormBuilder.currentSelection.length - 1];
    var pushToGroup = [];

    if (firstPage === lastPage) {
        pushToGroup.push(firstPage);
    } else {
        var firstLevel = $.RexFormBuilder.getItemLevel(firstPage, 'page');
        var secondLevel = $.RexFormBuilder.getItemLevel(lastPage, 'page');

        var firstLowestAllowedLevel =
                $.RexFormBuilder.getLowestAllowedLevel(firstPage, firstLevel, true);

        var lastLowestAllowedLevel =
                $.RexFormBuilder.getLowestAllowedLevel(lastPage, secondLevel, false);

        var lowestAllowedLevel =
                (firstLowestAllowedLevel < lastLowestAllowedLevel) ?
                                    lastLowestAllowedLevel:
                                    firstLowestAllowedLevel;

        if (lowestAllowedLevel > firstLevel ||
            lowestAllowedLevel > secondLevel)
            return;

        var firstCutoff = $.RexFormBuilder.getCutoff(firstPage, 'page');
        var lastCutoff = null;
        var cutoff = firstCutoff;
        var total = $.RexFormBuilder.currentSelection.length;

        for (var idx = 1; idx < total; idx++) {
            var currentCutoff = 
                $.RexFormBuilder.getCutoff($.RexFormBuilder.currentSelection[idx], 
                                        'page');
            cutoff = $.RexFormBuilder.interceptCutoff(cutoff, currentCutoff);
            if (cutoff.length - 1 < lowestAllowedLevel) {
                return;
            }
            if (idx == total - 1)
                lastCutoff = currentCutoff;
        }

        if (lastCutoff) {
            var startFrom = firstCutoff[ cutoff.length ];
            var endOn = lastCutoff[ cutoff.length ];

            pushToGroup.push(startFrom);
            var element = startFrom;

            do {
                element = element.next();
                pushToGroup.push(element);
            } while (endOn[0] !== element[0] && element.size());
        }
    }

    if (pushToGroup.length) {
        var pageGroup = $.RexFormBuilder.createGroup('pageGroup');
        var pageSublistDiv = pageGroup.find('.rb_class_pages_list:first');

        var newGroupData = $.RexFormBuilder.context.createNewGroup();
        pushToGroup[0].before(pageGroup);
        newGroupData.title = newGroupName;
        pageGroup.data('data', newGroupData);

        for (var idx in pushToGroup) {
            pageSublistDiv.append(pushToGroup[idx]);
        }
        $.RexFormBuilder.setPageListSortable(pageSublistDiv);
        $.RexFormBuilder.updateGroupDiv(pageGroup);
    }
}

$.RexFormBuilder.showProgress = function(params) {
    $.RexFormBuilder.progressDialog.startParams = params;
    $.RexFormBuilder.progressDialog.dialog('option', 'buttons', params['buttons']);
    $('.rb_progress_text', $.RexFormBuilder.progressDialog).html(params['title']);
    $.RexFormBuilder.startPollingTimeout();
    $.RexFormBuilder.progressDialog.dialog("open");
}

$.RexFormBuilder.closeProgress = function() {
    $.RexFormBuilder.stopPollingTimeout();
    $.RexFormBuilder.progressDialog.startParams = null;
    $.RexFormBuilder.progressDialog.dialog("close");
}

$.RexFormBuilder.stopPollingTimeout = function() {
    if ($.RexFormBuilder.progressDialog.pollTimeout !== null) {
        clearTimeout($.RexFormBuilder.progressDialog.pollTimeout)
        $.RexFormBuilder.progressDialog.pollTimeout = null;
    }
}

$.RexFormBuilder.startPollingTimeout = function() {
    $.RexFormBuilder.progressDialog.pollTimeout =
        setTimeout("$.RexFormBuilder.progressDialogPolling()", 1000);
}

$.RexFormBuilder.progressDialogPolling = function() {
    var params = $.RexFormBuilder.progressDialog.startParams;
    params['pollCallback']();
}

$.RexFormBuilder.showInstrumentJSON = function() {
    
}

$.RexFormBuilder.testInstrument = function() {

    var params = $.RexFormBuilder.context.getIndexByType('parameter');
    var toBeContinued = function (paramDict) {
        $.RexFormBuilder.closeOpenedEditor(function () {
            $.RexFormBuilder.showProgress({
                title: '<center>Preparing the form for a test...</center>',
                pollCallback: function () { }
            });

            $.RexFormBuilder.savedParamValues = paramDict;
            $.RexFormBuilder.saveInstrumentReal($.RexFormBuilder.testInstrumentStage4);
        }, questionListDiv);
    }

    if (params.length) {
        $.RexFormBuilder.beforeTestDialog.open({
            paramValues: $.RexFormBuilder.savedParamValues || {},
            callback: toBeContinued
        });
    } else
        toBeContinued({});
}

$.RexFormBuilder.testInstrumentStage2 = function() {
    $.ajax({url : $.RexFormBuilder.basePrefix
                    + "/construct_instrument?code="
                    + $.RexFormBuilder.instrumentName
                    + '&schema=demo',
        success : function(content) {
            console.log('construct successful:', content);
            $.RexFormBuilder.testInstrumentStage4();
        },
        error: function() {
            $.RexFormBuilder.closeProgress();
            alert('Error of construct_instrument!');
        },
        type: 'GET'
    });
}

$.RexFormBuilder.testInstrumentStage4 = function() {
    $.RexFormBuilder.closeProgress();
    var paramStr = '';
    if ($.RexFormBuilder.savedParamValues) {
        for (var paramName in $.RexFormBuilder.savedParamValues) {
            paramValue = $.RexFormBuilder.savedParamValues[paramName];
            paramStr += '&' + 'p_' + encodeURIComponent(paramName) + '=' 
                        + (paramValue ? encodeURIComponent(paramValue) : '');
        }
    }
    var url = $.RexFormBuilder.context.urlStartTest || 
            ($.RexFormBuilder.formsPrefix + '/start_roads');

    var query = 'test=1&'
              + 'instrument=' + encodeURIComponent($.RexFormBuilder.instrumentName)
              + paramStr;

    window.open(url + '?' + query, '_blank');
}

*/

})();
