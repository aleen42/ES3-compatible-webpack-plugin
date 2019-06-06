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

const SourceMapSource = require('webpack-core/lib/SourceMapSource');

const {AST_ObjectProperty, AST_Dot, AST_Array, AST_Object, TreeWalker, parse} = require('uglify-js');

/** EMCAScript-262 */
const KEYWORDS = ['break', 'do', 'instanceof', 'typeof', 'case', 'else', 'new', 'var', 'catch', 'finally', 'return', 'void', 'continue', 'for', 'switch', 'while', 'debugger', 'function', 'this', 'with', 'default', 'if', 'throw', 'delete', 'in', 'try'];
const RESERVED_WORDS = ['abstract', 'boolean', 'byte', 'char', 'class', 'double', 'enum', 'export', 'extends', 'final', 'float', 'goto', 'implements', 'import', 'int', 'interface', 'long', 'native', 'package', 'private', 'protected', 'public', 'short', 'static', 'super', 'synchronized', 'this', 'throws', 'transient', 'volatile'];
const NULL_LITERAL = ['null'];
const BOOLEAN_LITERAL = ['true', 'false'];

const _escapeRegular = str => str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
const _escapeReplacement = str => str.replace(/\$/gi, '$$$$');

/**
 * literalRegex: regular expression object for matching all literal words defined in JavaScript
 * @type {string}
 */
const literalRegex = [].concat(RESERVED_WORDS).concat(KEYWORDS).concat(NULL_LITERAL).concat(BOOLEAN_LITERAL).join('|');

class ES3CompatiblePlugin {
    process(source) {
        /** the AST structure (http://lisperator.net/uglifyjs/ast) of UglifyJS */
        const ast = parse(source);

        /** code snippets to be replaced */
        const snippets = [];
        const _snippet = (type, key, start, end) => snippets.push({type, key, start, end});
        const _substr = source.substring.bind(source);

        ast.walk(new TreeWalker(node => {
            if (node instanceof AST_ObjectProperty
                && new RegExp(literalRegex, 'g').test(node.key)
            ) {
                const {key, start: {pos, endpos}} = node;
                /** object properties defined by reserved words */
                _snippet('property_definition', key, pos, endpos);
            } else if (node instanceof AST_Dot
                && new RegExp(literalRegex, 'g').test(node.property)
            ) {
                /** access property defined by reserved words */
                if (_substr(node.end.pos, node.end.endpos) === node.property) {
                    const {property, end: {pos, endpos}} = node;
                    _snippet('dot_access', property, pos, endpos);
                } else {
                    /**
                     * node.start.pos
                     *  \
                     *   \       node.end.endpos
                     *    \      /
                     * if (a.b.c), then both start and end are token of parentheses
                     */
                    const {property, start, end} = node;
                    const entire = _substr(start.pos, end.endpos);

                    _snippet('dot_access', property,
                        start.pos + entire.lastIndexOf(property),
                        start.pos + entire.lastIndexOf(property) + property.length);
                }
            } else if (node instanceof AST_Array || node instanceof AST_Object) {
                const elements = node instanceof AST_Array ? node.elements : node.properties;
                const lastElement = elements[elements.length - 1];

                /** trailing comma in Array or Object */
                if (elements.length
                    && _substr(lastElement.end.endpos, node.end.endpos).indexOf(',') > -1
                ) {
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
        let lastIndex = 0;

        /** sort for nested dot accessing like "a.b.c.d" */
        return snippets.sort((prevItem, item) => prevItem.start - item.start)
            .map(({type, key, start, end}) => {
                const startIndex = lastIndex;
                lastIndex = end;

                return {
                    property_definition: _substr(startIndex, start)
                        + _substr(start, end).replace(new RegExp(`^${_escapeRegular(key)}$`, 'gi'), `'${_escapeReplacement(key)}'`),
                    dot_access: _substr(startIndex, start - 1)
                        + _substr(start - 1, end).replace(new RegExp(`^\\.${_escapeRegular(key)}$`, 'gi'), `['${_escapeReplacement(key)}']`),
                    trailing_comma: _substr(startIndex, start) + _substr(start, end).replace(/,/g, ''),
                }[type];
            }).join('') + source.substr(lastIndex);
    }

    apply(compiler) {
        compiler.plugin('emit', ({assets}, callback) => {
            Object.entries(assets).forEach(([fileName, asset]) => {
                /** ignore map files */
                if (!/\.js$/gi.test(fileName)) return;

                /** todo: how to modify map according to the source? */
                const {source, map} = asset.sourceAndMap();
                asset = new SourceMapSource(this.process(source, fileName), fileName, map, source, map);
            });

            callback();
        });
    }
}

export default ES3CompatiblePlugin;
