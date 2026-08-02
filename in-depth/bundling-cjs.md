# 打包 CJS

Rolldown 为 CommonJS 模块提供一等支持。本文介绍 Rolldown 如何处理 CJS 模块，以及它们如何与 ES 模块互操作。

## 主要特性

### 原生 CJS 支持

Rolldown 会自动识别并处理 CommonJS 模块，无需任何额外插件或包。原生支持意味着：

- 无需安装额外依赖
- 与基于插件的方案相比，性能更好

### 按需执行

Rolldown 会保留 CommonJS 模块的按需执行语义，这是 CommonJS 模块系统的一项核心特性。也就是说，只有真正执行 `require` 时才会运行模块。

示例如下：

```js
// index.js
import { value } from './foo.js';

const getFooExports = () => require('./foo.js');

// foo.js
module.exports = { value: 'foo' };
```

打包后会生成：

```js
// #region \0rolldown/runtime.js
// ……运行时代码
// #endregion

// #region foo.js
var require_foo = __commonJS({
  'foo.js'(exports, module) {
    module.exports = { value: 'foo' };
  },
});

// #endregion
// #region index.js
const getFooExports = () => require_foo();
// #endregion
```

本例中，只有调用 `getFooExports()` 后才会执行 `foo.js` 模块，从而保留 CommonJS 的惰性加载行为。

### ESM/CJS 互操作

Rolldown 在 ES 模块和 CommonJS 模块之间提供无缝互操作。

以下是 ESM 从 CJS 导入内容的示例：

```js
// index.js
import { value } from './foo.js';

console.log(value);

// foo.js
module.exports = { value: 'foo' };
```

打包输出：

```js
// #region \0rolldown/runtime.js
// ……运行时代码
// #endregion

// #region foo.js
var require_foo = __commonJS({
  'foo.js'(exports, module) {
    module.exports = { value: 'foo' };
  },
});

// #endregion
// #region index.js
var import_foo = __toESM(require_foo());
console.log(import_foo.value);

// #endregion
```

`__toESM` 辅助函数会确保 CommonJS 导出被正确转换为 ES 模块格式，从而无缝访问导出值。

## 注意事项

### `require` 外部模块

默认情况下，Rolldown 会尽量保留 `require` 的语义，不会把针对外部模块的 `require` 转换为 `import`。这是因为 `require` 与 ES 模块中 `import` 的语义不同。例如，`require` 会惰性求值，而 `import` 会在代码执行前求值。

::: tip 仍想把 `require` 转换为 `import`？

如果想把 `require` 调用转换为 `import` 语句，可以使用 [内置的 `esmExternalRequirePlugin`](/builtin-plugins/esm-external-require)。请注意，该插件必须负责它要转换的外部模块：请把这些模块列在插件自身的 `external` 选项中，而不是顶层 `external` 选项中。

:::

使用 [`platform: 'node'`](../guide/notable-features.md#平台预设) 时，Rolldown 会通过 [`module.createRequire`](https://nodejs.org/docs/latest/api/module.html#modulecreaterequirefilename) 生成 `require` 函数，完整保留 `require` 的语义。与转换为 `import` 相比，这种方式有两个缺点：

1. 要求运行时支持 `module.createRequire` 函数，而部分兼容 Node.js 的环境可能不提供该函数
2. 不适合预期会再次打包的库，因为 `require` 函数会成为局部变量，使打包器更难静态分析代码

对于其他平台，Rolldown 会原样保留 `require`，由运行环境提供该函数，或由用户手动注入。例如，可以使用 [`inject` 功能](../guide/notable-features.md#inject)，注入一个返回 `import` 所得值的 `require` 函数。

::: code-group

```js [rolldown.config.js]
import path from 'node:path';
export default {
  inject: {
    require: path.resolve('./require.js'),
  },
};
```

```js [require.js]
import fs from 'node:fs';

export default (id) => {
  if (id === 'node:fs') {
    return fs;
  }
  throw new Error(`Requiring ${JSON.stringify(id)} is not allowed.`);
};
```

:::

### 从 CJS 模块导入 `default` 时的歧义

生态中常见两种处理 CJS 模块导入的方式。Rolldown 会尝试自动支持两种解释，但它们在 `default` 导入上**互不兼容**。在这种情况下，Rolldown 会使用类似 [webpack](https://webpack.js.org/) 和 [esbuild](https://esbuild.github.io/) 的启发式规则，确定 `default` 导入的值。

如果满足以下任一条件，`default` 导入就是被导入 CJS 模块的 `module.exports` 值。否则，`default` 导入就是被导入 CJS 模块的 `module.exports.default` 值。

- 导入方是 `.mjs` 或 `.mts` 文件
- （动态导入时）导入方是 `.cjs` 或 `.cts` 文件
- 距离导入方最近的 `package.json` 将 `type` 字段设为 `module`
- （动态导入时）距离导入方最近的 `package.json` 将 `type` 字段设为 `commonjs`
- 被导入 CJS 模块的 `module.exports.__esModule` 值未设为 `true`
- 被导入 CJS 模块的 `module.exports` 值没有自身的 `default` 属性

最后一项用于处理设置了 `__esModule`、但实际没有提供 `default` 导出的 CJS 模块（例如 tslib 的 UMD 构建）。没有这项规则时，`default` 导入会是 `undefined`。`@rollup/plugin-commonjs` 使用相同的回退方式处理这种情况。

:::: details 详细行为

假设有以下 ESM 导入方模块和 CJS 被导入模块：

::: code-group

```js [index.js]
import foo from './importee.cjs';
console.log(foo);
```

```js [importee.cjs]
Object.defineProperty(module.exports, '__esModule', {
  value: true,
});
module.exports.default = 'foo';
```

:::

第一种解释是 [Babel](https://babel.dev/) 的方式，这段代码会输出 `foo`。这种解释会根据 `__esModule` 标志改变行为。转换器通常设置 `__esModule`，表示模块原本使用 ESM 语法编写（本例中是 `export default 'foo'`），随后被转换为 CJS 语法。这种行为的依据是：转换后的模块应与未转换的原始模块表现一致。[`@rollup/plugin-commonjs`](https://github.com/rollup/plugins/tree/master/packages/commonjs) 默认使用这种解释。

第二种解释是 Node.js 的方式，这段代码会输出 `{ default: 'foo' }`。其依据是：CJS 模块动态设置导出键，而 ESM 要求静态确定导出键。因此，为了允许访问所有导出，会将整个 `module.exports` 公开为默认导出。设置 `defaultIsModuleExports: false` 时，`@rollup/plugin-commonjs` 使用这种解释。

这两种解释对 `default` 导入的预期值不同，Rolldown 必须判断该使用哪一种。

::::

::: details 这套启发式规则的依据是什么？

Rolldown 的启发式规则基于以下假设：受 Node.js 模块类型判断机制影响的文件，预期能在 Node.js 中运行。要让 ESM 文件在 Node.js 中运行，它们需要使用 `.mjs` 扩展名，或在最近的 `package.json` 中把 `type` 字段设为 `module`（[从而使用 ESM 加载器](https://nodejs.org/api/packages.html#determining-module-system)），代码也应按照 Node.js 的解释编写。另一方面，对于使用 ESM 语法编写、但未被 Node.js 模块类型判断机制标记为 ESM 的文件，它们很可能会由其他工具转换，而这些工具通常遵循 Babel 的解释。

:::

#### 给库作者的建议

如果正在编写新代码，强烈建议**以 ESM 语法发布代码**。随着 Node.js 提供 [`require(ESM)` 功能](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require)，这样做已经没有主要障碍。
如果仍需以 CJS 语法发布代码，强烈建议**避免使用 `default` 导出**。

从 CJS 模块导入默认导出时，建议编写能同时处理两种解释的代码。例如：

```js
import rawFoo from './importee.cjs';
const foo =
  typeof rawFoo === 'object' && rawFoo !== null && rawFoo.__esModule ? rawFoo.default : rawFoo;
console.log(foo);
```

在两种解释下，这段代码都会输出 `foo`。请注意，TypeScript 可能会为此代码显示类型错误，这是因为 [TypeScript 不支持这种行为](https://github.com/microsoft/TypeScript/issues/54102)，但可以安全忽略该错误。

#### 给库用户的建议

如果发现的问题似乎由这种不兼容导致，请尝试使用 [publint](https://publint.dev/) 检查包。它提供了 [检测此类不兼容的规则](https://publint.dev/rules#cjs_with_esmodule_default_export)（请注意，它只检查包中的部分文件，而不是全部文件）。

如果启发式规则不适用于你的情况，可以使用上一节中同时处理两种解释的代码。如果导入发生在依赖中，建议向该依赖提交 issue。在问题解决前，可以使用 [`patch-package`](https://github.com/ds300/patch-package)、[`pnpm patch`](https://pnpm.io/cli/patch) 或类似工具作为临时方案。

### 对 `.js` 文件应用严格模式

对于以 `.js` 结尾的文件，Rolldown 会将其作为 ESM 解析（[#7009](https://github.com/rolldown/rolldown/issues/7009)），不会回退到 CJS。这意味着只允许在非严格模式（sloppy mode）中使用的语法会被拒绝。

目前可以将文件扩展名改为 `.cjs`，作为临时解决方法。

## 未来计划

Rolldown 对 CommonJS 模块的一等支持为多种潜在优化奠定基础：

- 针对 CommonJS 模块的高级摇树优化能力
- 更好的无用代码消除
