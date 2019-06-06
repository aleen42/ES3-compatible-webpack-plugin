'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

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
 *  - Update Time: Jun, 6th, 2019
 *
 */

var SourceMapSource = require('webpack-core/lib/SourceMapSource');

var _require = require('uglify-js'),
    AST_ObjectProperty = _require.AST_ObjectProperty,
    AST_Dot = _require.AST_Dot,
    AST_Array = _require.AST_Array,
    AST_Object = _require.AST_Object,
    TreeWalker = _require.TreeWalker,
    parse = _require.parse;

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
            var ast = parse(source);

            /** code snippets to be replaced */
            var snippets = [];
            var _snippet = function _snippet(type, key, start, end) {
                return snippets.push({ type: type, key: key, start: start, end: end });
            };
            var _substr = source.substring.bind(source);

            ast.walk(new TreeWalker(function (node) {
                if (node instanceof AST_ObjectProperty && new RegExp(literalRegex, 'g').test(node.key)) {
                    var key = node.key,
                        _node$start = node.start,
                        pos = _node$start.pos,
                        endpos = _node$start.endpos;
                    /** object properties defined by reserved words */

                    _snippet('property_definition', key, pos, endpos);
                } else if (node instanceof AST_Dot && new RegExp(literalRegex, 'g').test(node.property)) {
                    /** access property defined by reserved words */
                    if (_substr(node.end.pos, node.end.endpos) === node.property) {
                        var property = node.property,
                            _node$end = node.end,
                            _pos = _node$end.pos,
                            _endpos = _node$end.endpos;

                        _snippet('dot_access', property, _pos, _endpos);
                    } else {
                        /**
                         * node.start.pos
                         *  \
                         *   \       node.end.endpos
                         *    \      /
                         * if (a.b.c), then both start and end are token of parentheses
                         */
                        var _property = node.property,
                            start = node.start,
                            end = node.end;

                        var entire = _substr(start.pos, end.endpos);

                        _snippet('dot_access', _property, start.pos + entire.lastIndexOf(_property), start.pos + entire.lastIndexOf(_property) + _property.length);
                    }
                } else if (node instanceof AST_Array || node instanceof AST_Object) {
                    var elements = node instanceof AST_Array ? node.elements : node.properties;
                    var lastElement = elements[elements.length - 1];

                    /** trailing comma in Array or Object */
                    if (elements.length && _substr(lastElement.end.endpos, node.end.endpos).indexOf(',') > -1) {
                        if (!node.end.comments_before.length) {
                            /** without comments before */
                            _snippet('trailing_comma', '', lastElement.end.endpos, node.end.endpos);
                        } else {
                            /** between last item and comments */
                            _snippet('trailing_comma', '', lastElement.end.endpos, node.end.comments_before[0].pos);

                            if (_substr(node.end.comments_before[0].endpos, node.end.endpos).indexOf(',') > -1) {
                                /** between comments and right-brackets */
                                _snippet('trailing_comma', '', node.end.comments_before[0].endpos, node.end.endpos);
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
            }).map(function (_ref) {
                var type = _ref.type,
                    key = _ref.key,
                    start = _ref.start,
                    end = _ref.end;

                var startIndex = lastIndex;
                lastIndex = end;

                return {
                    property_definition: _substr(startIndex, start) + _substr(start, end).replace(new RegExp('^' + _escapeRegular(key) + '$', 'gi'), '\'' + _escapeReplacement(key) + '\''),
                    dot_access: _substr(startIndex, start - 1) + _substr(start - 1, end).replace(new RegExp('^\\.' + _escapeRegular(key) + '$', 'gi'), '[\'' + _escapeReplacement(key) + '\']'),
                    trailing_comma: _substr(startIndex, start) + _substr(start, end).replace(/,/g, '')
                }[type];
            }).join('') + source.substr(lastIndex);
        }
    }, {
        key: 'apply',
        value: function apply(compiler) {
            var _this = this;

            compiler.plugin('emit', function (_ref2, callback) {
                var assets = _ref2.assets;

                Object.entries(assets).forEach(function (_ref3) {
                    var _ref4 = _slicedToArray(_ref3, 2),
                        fileName = _ref4[0],
                        asset = _ref4[1];

                    /** ignore map files */
                    if (!/\.js$/gi.test(fileName)) return;

                    /** todo: how to modify map according to the source? */

                    var _asset$sourceAndMap = asset.sourceAndMap(),
                        source = _asset$sourceAndMap.source,
                        map = _asset$sourceAndMap.map;

                    asset = new SourceMapSource(_this.process(source, fileName), fileName, map, source, map);
                });

                callback();
            });
        }
    }]);

    return ES3CompatiblePlugin;
}();

exports.default = ES3CompatiblePlugin;