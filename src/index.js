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

const UglifyJS = require('uglify-js');

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
        const ast = UglifyJS.parse(source);

        /** code snippets to be replaced */
        const snippets = [];

        ast.walk(new UglifyJS.TreeWalker(node => {
            if (node instanceof UglifyJS.AST_ObjectProperty
                && new RegExp(literalRegex, 'g').test(node.key)
            ) {
                /** object properties defined by reserved words */
                snippets.push({
                    type: 'property_definition',
                    key: node.key,
                    start: node.start.pos,
                    end: node.start.endpos
                });
            } else if (node instanceof UglifyJS.AST_Dot
                && new RegExp(literalRegex, 'g').test(node.property)
            ) {
                /** access property defined by reserved words */
                const snippetObject = {type: 'dot_access', key: node.property};
                if (source.substring(node.end.pos, node.end.endpos) === node.property) {
                    snippets.push(Object.assign(snippetObject, {start: node.end.pos, end: node.end.endpos}));
                } else {
                    /**
                     * node.start.pos
                     *  \
                     *   \       node.end.endpos
                     *    \      /
                     * if (a.b.c), then both start and end are token of parentheses
                     */
                    const wholeString = source.substring(node.start.pos, node.end.endpos);

                    snippets.push(Object.assign(snippetObject, {
                        start: node.start.pos + wholeString.lastIndexOf(snippetObject.key),
                        end: node.start.pos + wholeString.lastIndexOf(snippetObject.key) + snippetObject.key.length,
                    }));
                }
            } else if (node instanceof UglifyJS.AST_Array || node instanceof UglifyJS.AST_Object) {
                const elements = node instanceof UglifyJS.AST_Array ? node.elements : node.properties;

                /** trailing comma in Array or Object */
                if (elements.length
                    && source.substring(elements[elements.length - 1].end.endpos, node.end.endpos).indexOf(',') > -1
                ) {
                    if (!node.end.comments_before.length) {
                        /** without comments before */
                        snippets.push({
                            type: 'trailing_comma',
                            start: elements[elements.length - 1].end.endpos,
                            end: node.end.endpos
                        });
                    } else {
                        /** between last item and comments */
                        snippets.push({
                            type: 'trailing_comma',
                            start: elements[elements.length - 1].end.endpos,
                            end: node.end.comments_before[0].pos
                        });

                        if (source.substring(node.end.comments_before[0].endpos, node.end.endpos).indexOf(',') > -1) {
                            /** between comments and right-brackets */
                            snippets.push({
                                type: 'trailing_comma',
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
        let lastIndex = 0;

        /** sort for nested dot accessing like "a.b.c.d" */
        return snippets.sort((prevItem, item) => prevItem.start - item.start).reduce((result, item) => {
            const startIndex = lastIndex;
            lastIndex = item.end;

            switch (item.type) {
                case 'property_definition':
                    return result + source.substring(startIndex, item.start)
                        + source.substring(item.start, item.end).replace(new RegExp(`^${_escapeRegular(item.key)}$`, 'gi'), `'${_escapeReplacement(item.key)}'`);
                case 'dot_access':
                    return result + source.substring(startIndex, item.start - 1)
                        + source.substring(item.start - 1, item.end).replace(new RegExp(`^\\.${_escapeRegular(item.key)}$`, 'gi'), `['${_escapeReplacement(item.key)}']`);
                case 'trailing_comma':
                    return result + source.substring(startIndex, item.start)
                        + source.substring(item.start, item.end).replace(/,/g, '');
            }
        }, '') + source.substr(lastIndex);
    }

    apply(compiler) {
        compiler.plugin('emit', (compilation, callback) => {
            for (const fileName in compilation.assets) {
                /** ignore map files */
                if (!/\.js$/gi.test(fileName)) continue;

                /** todo: how to modify map according to the source? */
                let {source, map} = compilation.assets[fileName].sourceAndMap();
                compilation.assets[fileName] = new SourceMapSource(this.process(source, fileName), fileName, map, source, map);
            }

            callback();
        });
    }
}

export default ES3CompatiblePlugin;
