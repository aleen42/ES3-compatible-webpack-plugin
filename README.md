<h2 align="center">ES3-compatible-webpack-plugin</h2>

![npm](https://aleen42.github.io/badges/src/npm.svg) ![javascript](https://aleen42.github.io/badges/src/javascript.svg)

A Webpack plugin used for converting code to be ES3-compatible with less overheads. For instance, transform object members definitions with keyword into quotes wrapped string, or eliminate trailing commas in arrays.

```js
var obj = { extends: 1 }; /** => var obj = { 'extends': 1 }; */
obj.extends; /** => obj['extends'] */

var arr = [1, 2,]; /** => var arr = [1, 2]; */
```

The first step before using this plugin is to install it:

```bash
npm install --save-dev es3-compatible-webpack-plugin
```

And then, setup it in your Webpack configuration:

```js
/** webpack.config.js */
const ES3CompatibleWebpackPlugin = require('es3-compatible-webpack-plugin').default;

module.exports = {
    /** ... */
    plugins: [
        new ES3CompatibleWebpackPlugin(),
    ],
};
```

### :fuelpump: How to contribute

Have an idea? Found a bug? See [how to contribute](https://aleen42.github.io/PersonalWiki/contribution.html).

### :scroll: License

[MIT](https://aleen42.github.io/PersonalWiki/MIT.html) © aleen42
