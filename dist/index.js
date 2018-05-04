'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 *                                                               _
 *   _____  _                           ____  _                 |_|
 *  |  _  |/ \   ____  ____ __ ___     / ___\/ \   __   _  ____  _
 *  | |_| || |  / __ \/ __ \\ '_  \ _ / /    | |___\ \ | |/ __ \| |
 *  |  _  || |__. ___/. ___/| | | ||_|\ \___ |  _  | |_| |. ___/| |
 *  |_/ \_|\___/\____|\____||_| |_|    \____/|_| |_|_____|\____||_|
 *
 *  ===============================================================
 *             More than a coder, More than a designer
 *  ===============================================================
 *
 *  - Document: index.js
 *  - Author: aleen42
 *  - Description:
 *  - Create Time: Feb, 9th, 2018
 *  - Update Time: Feb, 24th, 2018
 *
 */

var SourceMapSource = require('webpack-core/lib/SourceMapSource');

var UglifyJS = require('uglify-js');

/** EMCAScript-262 */
var KEYWORDS = ['break', 'do', 'instanceof', 'typeof', 'case', 'else', 'new', 'var', 'catch', 'finally', 'return', 'void', 'continue', 'for', 'switch', 'while', 'debugger', 'function', 'this', 'with', 'default', 'if', 'throw', 'delete', 'in', 'try'];
var RESERVED_WORDS = ['abstract', 'boolean', 'byte', 'char', 'class', 'double', 'enum', 'export', 'extends', 'final', 'float', 'goto', 'implements', 'import', 'int', 'interface', 'long', 'native', 'package', 'private', 'protected', 'public', 'short', 'static', 'super', 'synchronized', 'this', 'throws', 'transient', 'volatile'];
var NULL_LITERAL = ['null'];
var BOOLEAN_LITERAL = ['true', 'false'];

var _escapeRegular = function _escapeRegular(str) {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
};
var _escapeReplacement = function _escapeReplacement(str) {
    return str.replace(/\$/gi, '$$$$');
};

/**
 * literalRegex: regular expression object for matching all literal words defined in JavaScript
 * @type {string}
 */
var literalRegex = [].concat(RESERVED_WORDS).concat(KEYWORDS).concat(NULL_LITERAL).concat(BOOLEAN_LITERAL).join('|');

var ES3CompatiblePlugin = function () {
    function ES3CompatiblePlugin() {
        _classCallCheck(this, ES3CompatiblePlugin);
    }

    _createClass(ES3CompatiblePlugin, [{
        key: 'process',
        value: function process(source) {
            /** the AST structure (http://lisperator.net/uglifyjs/ast) of UglifyJS */
            var ast = UglifyJS.parse(source);

            /** code snippets to be replaced */
            var snippets = [];

            ast.walk(new UglifyJS.TreeWalker(function (node) {
                if (node instanceof UglifyJS.AST_ObjectProperty && new RegExp(literalRegex, 'g').test(node.key)) {
                    /** object properties defined by reserved words */
                    snippets.push({
                        type: 'property_definition',
                        key: node.key,
                        start: node.start.pos,
                        end: node.start.endpos
                    });
                } else if (node instanceof UglifyJS.AST_Dot && new RegExp(literalRegex, 'g').test(node.property)) {
                    /** access property defined by reserved words */
                    var snippetObject = { type: 'dot_access', key: node.property };
                    if (source.substring(node.end.pos, node.end.endpos) === node.property) {
                        snippets.push(Object.assign(snippetObject, { start: node.end.pos, end: node.end.endpos }));
                    } else {
                        /**
                         * node.start.pos
                         *  \
                         *   \       node.end.endpos
                         *    \      /
                         * if (a.b.c), then both start and end are token of parentheses
                         */
                        var wholeString = source.substring(node.start.pos, node.end.endpos);

                        snippets.push(Object.assign(snippetObject, {
                            start: node.start.pos + wholeString.lastIndexOf(snippetObject.key),
                            end: node.start.pos + wholeString.lastIndexOf(snippetObject.key) + snippetObject.key.length
                        }));
                    }
                } else if (node instanceof UglifyJS.AST_Array) {
                    if (node.elements.length && source.substring(node.elements[node.elements.length - 1].end.endpos, node.end.endpos).indexOf(',') > -1) {
                        /** array trailing comma */
                        if (!node.end.comments_before.length) {
                            /** without comments before */
                            snippets.push({
                                type: 'array_trailing_comma',
                                start: node.elements[node.elements.length - 1].end.endpos,
                                end: node.end.endpos
                            });
                        } else {
                            /** between last item and comments */
                            snippets.push({
                                type: 'array_trailing_comma',
                                start: node.elements[node.elements.length - 1].end.endpos,
                                end: node.end.comments_before[0].pos
                            });

                            if (source.substring(node.end.comments_before[0].endpos, node.end.endpos).indexOf(',') > -1) {
                                /** between comments and right-brackets */
                                snippets.push({
                                    type: 'array_trailing_comma',
                                    start: node.end.comments_before[0].endpos,
                                    end: node.end.endpos
                                });
                            }
                        }
                    }
                }
            }));

            /**
             *   lastIndex                lastIndex[0]               lastIndex[1]        lastIndex[2]
             *  /                        /                          /                   /
             * 0      start[0]          end[0]          start[1]   end[1]     start[2] end[2] str.length
             * |      |                 |               |          |          |        |      |
             * xx ... property_definition: value ... xxx.dot_access ... xxxxxx,        ] xxxxxx
             */
            var lastIndex = 0;

            /** sort for nested dot accessing like "a.b.c.d" */
            return snippets.sort(function (prevItem, item) {
                return prevItem.start - item.start;
            }).reduce(function (result, item) {
                var startIndex = lastIndex;
                lastIndex = item.end;

                switch (item.type) {
                    case 'property_definition':
                        return result + source.substring(startIndex, item.start) + source.substring(item.start, item.end).replace(new RegExp('^' + _escapeRegular(item.key) + '$', 'gi'), '\'' + _escapeReplacement(item.key) + '\'');
                    case 'dot_access':
                        return result + source.substring(startIndex, item.start - 1) + source.substring(item.start - 1, item.end).replace(new RegExp('^\\.' + _escapeRegular(item.key) + '$', 'gi'), '[\'' + _escapeReplacement(item.key) + '\']');
                    case 'array_trailing_comma':
                        return result + source.substring(startIndex, item.start) + source.substring(item.start, item.end).replace(/,/g, '');
                }
            }, '') + source.substr(lastIndex);
        }
    }, {
        key: 'apply',
        value: function apply(compiler) {
            var _this = this;

            compiler.plugin('emit', function (compilation, callback) {
                for (var fileName in compilation.assets) {
                    /** ignore map files */
                    if (!/\.js$/gi.test(fileName)) continue;

                    /** todo: how to modify map according to the source? */

                    var _compilation$assets$f = compilation.assets[fileName].sourceAndMap(),
                        source = _compilation$assets$f.source,
                        map = _compilation$assets$f.map;

                    compilation.assets[fileName] = new SourceMapSource(_this.process(source, fileName), fileName, map, source, map);
                }

                callback();
            });
        }
    }]);

    return ES3CompatiblePlugin;
}();

exports.default = ES3CompatiblePlugin;