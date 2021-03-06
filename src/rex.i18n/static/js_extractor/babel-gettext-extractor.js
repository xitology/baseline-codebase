// Adapted from:
// https://github.com/muffinresearch/babel-gettext-extractor
//
// The MIT License (MIT)
//
// Copyright (c) 2015 jruchaud
// Copyright (c) 2015 Sentry
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

'use strict';

var gettextParser = require('gettext-parser');
var fs = require('fs');
var process = require('process');

var DEFAULT_FUNCTION_NAMES = {
  gettext: ['msgid'],
  dgettext: ['domain', 'msgid'],
  ngettext: ['msgid', 'msgid_plural', 'count'],
  dngettext: ['domain', 'msgid', 'msgid_plural', 'count'],
  pgettext: ['msgctxt', 'msgid'],
  dpgettext: ['domain', 'msgctxt', 'msgid'],
  npgettext: ['msgctxt', 'msgid', 'msgid_plural', 'count'],
  dnpgettext: ['domain', 'msgctxt', 'msgid', 'msgid_plural', 'count']
};

var DEFAULT_FILE_NAME = 'gettext.po';

var DEFAULT_HEADERS = {
  'content-type': 'text/plain; charset=UTF-8',
};

var DEFAULT_PLURALS = 2;

/*
 * Sorts the object keys by the file reference.
 * There's no guarantee of key iteration in order prior to es6
 * but in practice it tends to work out.
 */
function sortObjectKeysByRef(unordered) {
  const ordered = {};
  Object.keys(unordered).sort((a,b) => {
    const refA = unordered[a].comments.reference.toLowerCase();
    const refB = unordered[b].comments.reference.toLowerCase();
    if (refA < refB) {
      return -1;
    }
    if (refA > refB) {
      return 1;
    }
    return 0;
  }).forEach(function(key) {
    ordered[key] = unordered[key];
  });
  return ordered;
}

function getTranslatorComment(node) {
  var comments = [];
  (node.leadingComments || []).forEach(function(commentNode) {
    var match = commentNode.value.match(/^\s*translators:\s*(.*?)\s*$/im);
    if (match) {
      comments.push(match[1]);
    }
  });
  return comments.length > 0 ? comments.join('\n') : null;
}

function plugin(babel) {
  var t = babel.types;
  var currentFileName;
  var data;
  var relocatedComments = {};

  return {
    visitor: {

      VariableDeclaration(path) {
        var translatorComment = getTranslatorComment(path.node);
        if (!translatorComment) {
          return;
        }
        path.node.declarations.forEach(function(declarator) {
          var comment = getTranslatorComment(declarator);
          if (!comment) {
            var key = declarator.init.start + '|' + declarator.init.end;
            relocatedComments[key] = translatorComment;
          }
        });
      },

      CallExpression(path, config) {
        var gtCfg = config.opts || {};

        var functionNames = gtCfg.functionNames || DEFAULT_FUNCTION_NAMES;
        var fileName = gtCfg.fileName || DEFAULT_FILE_NAME;
        var headers = gtCfg.headers || DEFAULT_HEADERS;
        var nplurals = gtCfg.nPlurals || DEFAULT_PLURALS;
        var base = gtCfg.baseDirectory;
        if (base) {
          if (base === '.') {
            base = process.cwd() + '/';
          } else {
            base = base.match(/^(.*?)\/*$/)[1] + '/';
          }
        }

        if (fileName !== currentFileName) {
          currentFileName = fileName;
          data = {
            charset: 'UTF-8',
            headers: headers,
            translations: {context: {}}
          };
        }

        var defaultContext = data.translations.context;

        if (functionNames.hasOwnProperty(path.node.callee.name) ||
            path.node.callee.property &&
            functionNames.hasOwnProperty(path.node.callee.property.name)) {
          var functionName = functionNames[path.node.callee.name]
                          || functionNames[path.node.callee.property.name];
          var translate = {};

          var args = path.node.arguments;
          for (var i = 0, l = args.length; i < l; i++) {
            var name = functionName[i];

            if (name && name !== 'count' && name !== 'domain') {
              var arg = args[i];
              var value = arg.value;
              if (value) {
                translate[name] = value;
              }

              if (name === 'msgid_plural') {
                translate.msgstr = [];
                for (var p = 0; p < nplurals; p++) {
                  translate.msgstr[p] = '';
                }
              }
            }
          }

          var fn = config.file.log.filename;
          if (base && fn && fn.substr(0, base.length) == base) {
            fn = fn.substr(base.length);
          }

          translate.comments = {
            reference: fn + ':' + path.node.loc.start.line
          };

          var translatorComment = getTranslatorComment(path.node);
          if (!translatorComment) {
            translatorComment = getTranslatorComment(path.parentPath);
            if (!translatorComment) {
              translatorComment = relocatedComments[
                path.node.start + '|' + path.node.end];
            }
          }

          if (translatorComment) {
            translate.comments.translator = translatorComment;
          }

          var context = defaultContext;
          var msgctxt = translate.msgctxt;
          if (msgctxt) {
            data.translations[msgctxt] = data.translations[msgctxt] || {};
            context = data.translations[msgctxt];
          }

          // Do not add translation if msgid is undefined.
          if (typeof translate.msgid !== 'undefined') {
            context[translate.msgid] = translate;
          }

          // Sort by file reference to make output idempotent for the same input.
          if (data.translations && data.translations.context) {
            data.translations.context = sortObjectKeysByRef(data.translations.context);
          }

          var output = gettextParser.po.compile(data);
          fs.writeFileSync(fileName, output);
        }
      }
    }
  };
};

module.exports = plugin;

