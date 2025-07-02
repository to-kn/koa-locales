koa-locales
=======

**Now TypeScript-first, ESM, and Node.js 18+!**
- Uses ESM (`import`/`export`), outputs to `dist/esm/`, and is CI-tested on GitHub Actions.
- Use the built output (`dist/esm/index.js`) as the main entry point for consumers, but tests and development use the source (`src/`).
- Modern test suite with [Vitest](https://vitest.dev/).

[![NPM version][npm-image]][npm-url]

koa locales, i18n solution for koa:

1. All locales resources location on `options.dirs`.
2. resources file supports: `*.js`, `*.json`, `*.yml`, `*.yaml` and `*.properties`, see [examples](test/locales/).
3. One api: `__(key[, value, ...])`.
4. Auto detect request locale from `query`, `cookie` and `header: Accept-Language`.

## Requirements

- Node.js >= 18
- ESM ("type": "module" in package.json)
- TypeScript (for development)

## Installation

```bash
$ npm install koa-locales --save
```

## Quick start (ESM/TypeScript)

```js
import locales from 'koa-locales';
import Koa from 'koa';

const app = new Koa();
const options = {
  dirs: [__dirname + '/locales', __dirname + '/foo/locales'],
};
locales(app, options);
```

## Development & Testing

- Run tests with [Vitest](https://vitest.dev/):
  ```sh
  npm run test
  ```
- Lint and format with [Biome](https://biomejs.dev/):
  ```sh
  npm run lint
  ```
- Build TypeScript to ESM:
  ```sh
  npm run build
  ```
- CI runs on GitHub Actions (see `.github/workflows/`)

## API Reference

### `locales(app, options)`

Patch locales functions to koa app.

- {Application} app: koa app instance.
- {Object} options: optional params.
  - {String} functionName: locale function name patch on koa context. Optional, default is `__`.
  - {String} dirs: locales resources store directories. Optional, default is `['$PWD/locales']`.
  - {String} defaultLocale: default locale. Optional, default is `en-US`.
  - {String} queryField: locale field name on query. Optional, default is `locale`.
  - {String} cookieField: locale field name on cookie. Optional, default is `locale`.
  - {String} cookieDomain: domain on cookie. Optional, default is `''`.
  - {Object} localeAlias: locale value map. Optional, default is `{}`.
  - {Boolean} writeCookie: set cookie if header not sent. Optional, default is `true`.
  - {String|Number} cookieMaxAge: set locale cookie value max age. Optional, default is `1y`, expired after one year.

```js
locales({
  app: app,
  dirs: [__dirname + '/app/locales'],
  defaultLocale: 'zh-CN',
});
```

#### Aliases

The key `options.localeAlias` allows to not repeat dictionary files, as you can configure to use the same file for *es_ES* for *es*, or *en_UK* for *en*.

```js
locales({
  localeAlias: {
    es: es_ES,
    en: en_UK,
  },
});
```

### `context.__(key[, value1[, value2, ...]])`

Get current request locale text.

```js
async function home(ctx) {
  ctx.body = {
    message: ctx.__('Hello, %s', 'fengmk2'),
  };
}
```

Examples:

```js
__('Hello, %s. %s', 'fengmk2', 'koa rock!')
=>
'Hello fengmk2. koa rock!'

__('{0} {0} {1} {1} {1}', ['foo', 'bar'])
=>
'foo foo bar bar bar'

__('{a} {a} {b} {b} {b}', {a: 'foo', b: 'bar'})
=>
'foo foo bar bar bar'
```

### `context.__getLocale()`

Get locale from query / cookie and header.

### `context.__setLocale()`

Set locale and cookie.

### `context.__getLocaleOrigin()`

Where does locale come from, could be `query`, `cookie`, `header` and `default`.

### `app.__(locale, key[, value1[, value2, ...]])`

Get the given locale text on application level.

```js
console.log(app.__('zh', 'Hello'));
// stdout '你好' for Chinese
```

## Usage on template

```js
this.state.__ = this.__.bind(this);
```

[Nunjucks] example:

```html
{{ __('Hello, %s', user.name) }}
```

[Pug] example:

```pug
p= __('Hello, %s', user.name)
```

[Koa-pug] integration:

You can set the property *locals* on the KoaPug instance, where the default locals are stored.

```js
app.use(async (ctx, next) => {
  koaPug.locals.__ = ctx.__.bind(ctx);
  await next();
});
```

## Debugging

If you are interested on knowing what locale was chosen and why you can enable the debug messages from [debug].

There is two level of verbosity:

```sh
$ DEBUG=koa-locales node .
```
With this line it only will show one line per request, with the chosen language and the origin where the locale come from (queryString, header or cookie).

```sh
$ DEBUG=koa-locales:silly node .
```

## Locale File Formats

You can provide locale files in the following formats:

- `.json` (recommended for most use cases)
- `.yml` or `.yaml`
- `.properties`
- `.cjs` (CommonJS JavaScript, e.g. `module.exports = { ... }`)

> **Note:** `.js` ESM modules are not supported for synchronous loading. Use `.cjs` for JavaScript locale files if you need sync loading.
