# 主要特性

本页介绍 Rolldown 中一些值得关注、但 Rollup 没有内置对应功能的特性。

## 平台预设

- 通过 [`platform`](https://rolldown.rs/reference/InputOptions.platform) 选项配置。
- 默认值：输出格式为 `cjs` 时是 `'node'`，其他情况下是 `'browser'`
- 可选值：`browser | node | neutral`

与 [esbuild 的 `platform` 选项](https://esbuild.github.io/api/#platform) 类似，该选项为模块解析和 `process.env.NODE_ENV` 的处理方式提供了一组合理的默认值。

**与 esbuild 的主要区别：**

- 无论使用什么平台，默认输出格式始终为 `esm`。

::: tip
以浏览器为目标平台时，Rolldown 不会为 Node 内置模块提供 polyfill。你可以通过 [rolldown-plugin-node-polyfills](https://github.com/rolldown/rolldown-plugin-node-polyfills) 选择启用。
:::

## 内置转换

Rolldown 开箱即用地支持以下由 [Oxc](https://oxc.rs/docs/guide/usage/transformer) 驱动的转换。
转换行为可通过 [`transform`](https://rolldown.rs/reference/InputOptions.transform) 选项配置。
目前支持：

- TypeScript
  - 提供 [`tsconfig`](https://rolldown.rs/reference/InputOptions.tsconfig) 选项时，根据 `tsconfig.json` 设置配置。
  - 支持旧版装饰器和装饰器元数据。
- JSX
- 语法降级
  - 自动转换现代语法，使其兼容你指定的目标环境。
  - 最低 [支持降级到 ES2015](https://oxc.rs/docs/guide/usage/transformer/lowering#transformations)。

## CJS 支持

Rolldown 开箱即用地支持混合 ESM / CJS 模块图，无需使用 `@rollup/plugin-commonjs`。它基本遵循 esbuild 的语义，并且 [通过了 esbuild 的全部 ESM / CJS 互操作测试](https://github.com/evanw/bundler-esm-cjs-tests)。

更多细节请参阅 [打包 CJS](/in-depth/bundling-cjs)。

## 模块解析

- 通过 [`resolve`](https://rolldown.rs/reference/InputOptions.resolve) 选项配置
- 由 [oxc-resolver](https://github.com/oxc-project/oxc-resolver) 驱动，并与 webpack 的 [enhanced-resolve](https://github.com/webpack/enhanced-resolve) 保持一致

Rolldown 默认按照 TypeScript 和 Node.js 的行为解析模块，无需使用 `@rollup/plugin-node-resolve`。

提供顶层 [`tsconfig`](https://rolldown.rs/reference/InputOptions.tsconfig) 选项时，Rolldown 会遵循指定 `tsconfig.json` 中的 `compilerOptions.paths`。

## Define

- 通过 [`transform.define`](https://rolldown.rs/reference/InputOptions.transform#define) 选项配置。

此功能可用常量表达式替换全局标识符，与 [Vite](https://vite.dev/config/shared-options.html#define) 和 [esbuild](https://esbuild.github.io/api/#define) 中的相应选项保持一致。

::: tip `@rollup/plugin-replace` 的行为不同

请注意，它的行为与 [`@rollup/plugin-replace`](https://github.com/rollup/plugins/tree/master/packages/replace) 不同。由于替换基于 AST，要替换的值必须是有效的标识符或成员表达式。如果需要文本替换，请使用内置的 [`replacePlugin`](/builtin-plugins/replace)。

:::

## Inject

- 通过 [`transform.inject`](https://rolldown.rs/reference/InputOptions.transform#inject) 选项配置。

此功能可使用模块导出的特定值填充全局变量。它等同于 [`@rollup/plugin-inject`](https://github.com/rollup/plugins/tree/master/packages/inject)，在概念上也与 [esbuild 的 `inject` 选项](https://esbuild.github.io/api/#inject) 相似。

## 手动代码拆分 {#manual-code-splitting}

- 通过 [`output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) 选项配置。

Rolldown 允许细粒度控制代码块拆分行为，类似于 webpack 的 [`optimization.splitChunks`](https://webpack.js.org/plugins/split-chunks-plugin/#optimizationsplitchunks) 功能。

更多细节请参阅 [手动代码拆分](/in-depth/manual-code-splitting)。

## 模块类型 {#module-types}

- ⚠️ 实验性功能

这在概念上类似于 [esbuild 的 `loader` 选项](https://esbuild.github.io/api/#loader)：用户可以通过 [`moduleTypes`](https://rolldown.rs/reference/InputOptions.moduleTypes) 选项在全局范围内将文件扩展名关联到内置模块类型，也可以在插件钩子中指定某个模块的类型。更多细节请参阅 [模块类型](/in-depth/module-types)。

## 代码压缩

- 通过 [`output.minify`](https://rolldown.rs/reference/OutputOptions.minify) 选项配置。

代码压缩由 [Oxc Minifier](https://oxc.rs/docs/guide/usage/minifier) 驱动。更多细节请参阅其文档。
