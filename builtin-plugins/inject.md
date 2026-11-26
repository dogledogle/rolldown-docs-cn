# Inject 插件

`injectPlugin` 是 Rolldown 的内置插件，会为模块使用的每个全局变量添加相应的导入。它的作用与 [`transform.inject`](/reference/InputOptions.transform#inject) 相同，但仅作用于通过 `include` 和 `exclude` 选定的模块。这等同于 [`@rollup/plugin-inject`](https://github.com/rollup/plugins/tree/master/packages/inject)。

## 用法

从 Rolldown 的插件导出入口导入并使用该插件：

```js
import { defineConfig } from 'rolldown';
import { injectPlugin } from 'rolldown/plugins';

export default defineConfig({
  input: 'src/index.js',
  plugins: [
    injectPlugin(
      {
        // import { useState } from '#app'
        useState: ['#app', 'useState'],
      },
      {
        exclude: /node_modules/,
      },
    ),
  ],
});
```

第一个参数接受与 [`transform.inject`](/reference/InputOptions.transform#inject) 相同的模式：

```js
import path from 'node:path';

injectPlugin({
  // import { Promise } from 'es6-promise'
  Promise: ['es6-promise', 'Promise'],

  // import { Promise as P } from 'es6-promise'
  P: ['es6-promise', 'Promise'],

  // import $ from 'jquery'
  $: 'jquery',

  // import * as fs from 'node:fs'
  fs: ['node:fs', '*'],

  // 为属性访问模式注入 shim
  'Object.assign': path.resolve('src/helpers/object-assign.js'),
});
```

模块只会为其作为值使用、且自身未声明或导入的名称添加导入。ID 包含空字节（`\0`）的模块（例如虚拟模块和 Rolldown 的运行时）始终会被跳过，行为与 Rollup 的 `createFilter` 类似。

## 选项

### `include`

- **类型：** `string | RegExp | (string | RegExp)[]`

只向 ID 与这些模式之一匹配的模块注入。字符串会被视为 glob 模式。相对的字符串模式会根据 [`cwd`](/reference/InputOptions.cwd) 选项解析；如果在 Rolldown 构建之外调用该插件（例如由 Vite 调用），则根据 `process.cwd()` 解析。

### `exclude`

- **类型：** `string | RegExp | (string | RegExp)[]`

即使模块匹配 `include`，只要其 ID 与这些模式之一匹配，也绝不会向该模块注入。

## 为不同模块使用不同的值

每个 `injectPlugin` 都有自己的一组值和过滤器，因此可以为不同模块中的同一个名称注入不同的值。插件会按顺序运行，而已经导入某个名称的模块会保留该导入。

```js
export default defineConfig({
  plugins: [
    // 应用代码获得框架提供的 `foo`
    injectPlugin({ foo: ['framework', 'foo'] }, { exclude: /node_modules/ }),
    // 其他模块获得 shim
    injectPlugin({ foo: ['foo-shim', 'foo'] }),
  ],
});
```

## 与 `transform.inject` 的区别

`injectPlugin` 在 `transform` 钩子中运行，因此它会在 Rolldown 降级 JSX 和 TypeScript 并应用 [`transform.define`](/reference/InputOptions.transform#define) 之前看到代码：

- 如果注入的对象名称是某个 `define` 键的前缀，例如注入 `process` 而定义了 `process.env.NODE_ENV`，那么 `define` 将不再匹配，因为 `process` 不再是全局变量。对于这些值，请使用 [`replacePlugin`](/builtin-plugins/replace)，或者将负责替换它们的插件放在 `injectPlugin` 之前。
- 使用经典 JSX 运行时，注入 `React` 不会生效，因为此时 `<div />` 尚未转换为 `React.createElement(...)`。
- 对 TS 模块而言，`declare const useKey: () => string` 这类环境声明会被视为声明，因此不会注入 `useKey`。`transform.inject` 会在该声明被移除后运行，因此会注入 `useKey`。
- Rolldown 会将 `.cjs` 模块作为 CommonJS 解析，而 `import` 语句在其中无效，因此会跳过这些模块。如果这些模块需要使用这些名称，请改用 `transform.inject`。
