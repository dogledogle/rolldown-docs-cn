# 惰性聚合模块优化

惰性聚合模块是一项优化功能，它会避免编译无副作用 [聚合模块](/glossary/barrel-module) 中未使用的重新导出模块，从而提高构建性能。

## 为什么使用惰性聚合模块

[Ant Design](https://ant.design/) 等大型组件库广泛使用聚合模块。即使只导入一个组件，传统打包器也会编译数千个模块，而其中绝大多数并未使用。

下面是一个实际示例，只从 antd 导入 `Button`：

```js
import { Button } from 'antd';
Button;
```

| 指标                 | 不使用惰性聚合模块  | 使用惰性聚合模块 |
| -------------------- | ------------------- | ---------------- |
| 编译的模块数         | 2986                | 250              |
| 构建时间（macOS）    | 约 65ms             | 约 28ms          |
| 构建时间（Windows）  | 约 210ms            | 约 50ms          |

启用惰性聚合模块后，Rolldown 可将编译模块数减少 **92%**，并使构建速度提高 **2～4 倍**。

::: tip
可以使用 [lazy-barrel 示例](https://github.com/rolldown/benchmarks/tree/main/examples/lazy-barrel) 复现该基准测试。
:::

## 惰性聚合模块的工作原理

启用后，Rolldown 会分析实际使用了哪些导出项，只编译对应模块，并跳过未使用的重新导出模块。对于包含大量聚合模块的大型代码库，这能显著提高构建性能。

### 基本示例

```js
// barrel/index.js
export { a } from './a';
export { b } from './b';

// main.js
import { a } from './barrel';
console.log(a);
```

使用惰性聚合模块优化后：

- 加载并分析 `barrel/index.js`。
- 由于导入了 `a`，只编译 `a.js`。
- 由于未使用 `b`，**不编译** `b.js`。

## 支持的导出模式

惰性聚合模块优化支持多种导出模式：

### 星号重新导出

```js
export * from './components';
```

### 命名重新导出

```js
export { Component } from './Component';
export { helper as utils } from './helper';
export { default as Button } from './Button';
export { Button as default } from './Button';
```

### 命名空间重新导出

```js
export * as ns from './module';
```

### 先导入再导出模式

```js
// 等同于 `export { a } from './a'`
import { a } from './a';
export { a };

// 等同于 `export { a as default } from './a'`
import { a } from './a';
export { a as default };

// 等同于 `export * as ns from './module'`
import * as ns from './module';
export { ns };

// 等同于 `export { default as b } from './b'`
import b from './b';
export { b };
```

### 混合导出

```js
export { a } from './a';
export * as ns from './b';
export * from './others';
export * from './more';
```

如果能在命名导出中找到导入项，就不会搜索星号导出，从而避免不必要的模块加载。

不过，如果在命名导出中找不到导入项，就会加载所有星号重新导出以进行解析。如果这些星号重新导出的模块本身也是聚合模块，则只会从中加载特定的导入说明符。

:::: warning default 的重新导出与自身导出
`export { Button as default } from './Button.js'` 和 `import { Button } from './Button.js'; export default Button` **并不等价**。

前一种情况下，导出值会与 `Button.js` 中的值保持同步，因为二者指向同一个变量。

后一种情况下，导出值不会与 `Button.js` 中的值同步，因为 `export default ...` 会创建新变量。

以下示例展示了其中差异：

::: code-group

```js [main.js]
import { Button, increment } from './Button.js';
import ExportDefaultButton, { ReExportedButton } from './re-exporter.js';

console.log(Button); // 1
console.log(ReExportedButton); // 1
console.log(ExportDefaultButton); // 1

increment();

console.log(Button); // 2
console.log(ReExportedButton); // 2
console.log(ExportDefaultButton); // 1
```

```js [re-exporter.js]
import { Button } from './Button.js';
export default Button;

export { Button as ReExportedButton } from './Button.js';
```

```js [Button.js]
export let Button = 1;
export const increment = () => {
  Button++;
};
```

:::

因此，`export default ...` 被视为自身导出，可能会阻止优化（参阅 [自身导出](#own-exports-non-pure-re-export-barrels)）。
::::

## 高级场景

### 自我重新导出

惰性聚合模块可以正确处理从自身重新导出的聚合模块：

```js
// barrel/index.js
export { a } from './a';
export { a as b } from './index'; // 自我重新导出
```

### 循环导出

惰性聚合模块可以正确处理聚合模块之间的循环导出关系：

```js
// barrel-a/index.js
export { a } from './a';
export * from '../barrel-b';

// barrel-b/index.js
export { b } from './b';
export { a as c } from '../barrel-a'; // 循环引用
```

### 动态导入入口

动态导入聚合模块时，它会成为入口点，因此必须提供其全部导出项：

```js
// barrel/a.js
export const a = 'a';
import('./index.js'); // 使聚合模块成为入口点

// barrel/index.js
export { a } from './a';
export { b } from './b'; // 会加载 b.js
```

不过，如果 `b.js` 也是聚合模块，仍会优化其中未使用的导出项。

### 未使用的导入说明符

默认情况下，即使没有使用某个导入说明符，仍会加载其对应模块：

```js
// barrel/index.js
export { a } from './a';
export { b } from './b';

// main.js
import { a } from './barrel'; // 即使从未使用 `a`，仍会加载 a.js
```

### 自身导出（非纯重新导出聚合模块） {#own-exports-non-pure-re-export-barrels}

如果聚合模块包含自身导出（不只是重新导出），一旦使用任何自身导出，就必须加载它的所有导入记录：

```js
// barrel/index.js
import './a';
import { b } from './b';
import { e } from './e';
export { c } from './c';
export { d } from './d';
export { e };

console.log(b);

export const index = 'index'; // 自身导出
export default b; // `default` 是自身导出

// main.js
import { index, c } from './barrel';
// or import b, { c } from './barrel';
```

本例中，导入 `index` 时会加载 `a.js`、`b.js`、`c.js`、`d.js` 和 `e.js`：

- `import './a'`：加载 `a.js`，不请求任何说明符。
- `import { b } from './b'`：加载 `b.js` 并请求 `b`（聚合模块自身的代码使用了它）。
- `import { e } from './e'; export { e }`（先导入再导出）：加载 `e.js` 并请求 `e`，因为 Rolldown 无法静态判断聚合模块自身的代码是否也使用了 `e`。
- `export { c } from './c'`（专用重新导出）：加载 `c.js` 并请求 `c`（因为 main.js 导入了 `c`）。
- `export { d } from './d'`（专用重新导出）：加载 `d.js`，但不请求任何说明符（类似 `import './d'`，因为 main.js 没有导入 `d`）。

请注意专用重新导出记录（`export { .. } from '..'`、`export * as ns from '..'`）与先导入再导出模式生成的共享导入记录之间的区别。当 main.js 加载聚合模块的自身导出、使聚合模块必须执行时，如果 main.js 没有请求专用重新导出记录的绑定，该记录仍可回退到空说明符集合。相比之下，共享导入记录始终保留完整说明符，因为聚合模块自身的代码可能引用这些绑定。

之所以如此，是因为只有在 transform 钩子之后才能确定 `moduleSideEffects`，而惰性聚合模块会在 load 阶段作出决策。当聚合模块由于使用了自身导出而必须执行时，为确保行为正确，必须加载它的所有导入。

如果加载的模块（`a.js`、`b.js` 等）本身也是聚合模块，仍会根据是否请求说明符递归应用惰性聚合模块优化。

## 配置

惰性聚合模块优化目前默认禁用，可以在 Rolldown 配置中启用：

```js
// rolldown.config.js
export default {
  experimental: {
    lazyBarrel: true,
  },
};
```

::: warning
该选项计划在未来移除。如果需要禁用此功能，请 [创建 issue](https://github.com/rolldown/rolldown/issues) 描述你的用例，以便我们在移除选项前加以处理。
:::

## 要求

要让惰性聚合模块优化生效，需要明确将聚合模块标记为无副作用：

1. **包声明**：在 `package.json` 中添加 `"sideEffects": false`。

2. **Rolldown 插件钩子**：从 `resolveId`、`load` 或 `transform` 钩子返回 `moduleSideEffects: false`。

```js
// rolldown.config.js
export default {
  plugins: [
    {
      name: 'mark-barrel-side-effect-free',
      transform(code, id) {
        if (id.includes('/barrel/')) {
          return { moduleSideEffects: false };
        }
      },
    },
  ],
};
```

3. **Rolldown 配置**：使用 `treeshake.moduleSideEffects` 选项。

```js
// rolldown.config.js
export default {
  treeshake: {
    moduleSideEffects: [
      // 使用正则表达式将聚合模块标记为无副作用
      { test: /\/barrel\//, sideEffects: false },
      // 或标记特定路径
      { test: /\/components\/index\.js$/, sideEffects: false },
    ],
  },
};
```

对于更复杂的逻辑，也可以使用函数：

```js
// rolldown.config.js
export default {
  treeshake: {
    moduleSideEffects: (id) => {
      // 将所有 index.js 文件标记为无副作用
      if (id.endsWith('/index.js')) return false;
      return true;
    },
  },
};
```

## 何时使用

惰性聚合模块优化在以下情况下尤其有益：

- 代码库包含许多聚合模块（常见于组件库）。
- 聚合模块重新导出大量模块，但使用者通常只用到少数几个。

## 大型聚合模块

惰性聚合模块会跳过加载、解析和转换未使用的重新导出，但仍会为每个条目执行**解析**步骤。解析器会针对每条导入记录调用 `resolveId` 插件钩子，因此即使实际只使用少数导出，一个包含数千条重新导出的聚合模块仍可能占据大部分构建时间。

典型示例是 `@mui/icons-material/esm/index.js`，其中包含超过 10,000 条重新导出。加载这种文件时，Rolldown 仍会逐一解析每条记录，尽管惰性聚合模块能确保之后只加载和转换请求的图标。

启用 `experimental.lazyBarrel` 且聚合模块包含超过 5,000 条重新导出时，Rolldown 会生成代码为 `LARGE_BARREL_MODULES` 的信息级建议：

```text
advice[LARGE_BARREL_MODULES]: node_modules/@mui/icons-material/esm/index.js has 10611 re-exports. Eagerly resolving every entry can significantly slow down the build. Consider using `@rolldown/plugin-transform-imports` to rewrite imports at the source level so the barrel file is never loaded.
```

[`@rolldown/plugin-transform-imports`](https://github.com/rolldown/plugins/tree/main/packages/transform-imports) 会在源代码层改写导入，使聚合文件完全不被加载，从而绕过解析成本：

```js
// 改写前
import { Home, Search } from '@mui/icons-material';

// 改写后（由插件完成）
import Home from '@mui/icons-material/esm/Home';
import Search from '@mui/icons-material/esm/Search';
```

要关闭该建议，请把 `checks.largeBarrelModules` 设为 `false`，或在 CLI 中传入 `--no-checks.large-barrel-modules`。

::: info 为什么通过插件实现，而不是内置行为？
在 Rolldown 内部延迟解析步骤，会改变 `moduleParsed` 的触发时机和 `ModuleInfo` 完整填充的时机，明显偏离兼容 Rollup 的插件语义。为了在 Rolldown 1.0 发布过程中保持插件约定稳定，我们倾向于只在真正需要的情况下从源代码层解决问题。除图标包等极端情况外，典型聚合模块（数十到几百条重新导出）的解析成本可以忽略不计。
:::

## 限制

- 无法优化具有副作用的聚合模块。
- 无法匹配的命名导入需要加载所有星号重新导出才能完成解析。
- 入口文件、`import * as ns`、`import('..')`、`require('..')` 等会使聚合模块加载全部导出项。
- 如果聚合模块包含自身导出（不只是重新导出），使用任何自身导出都会导致加载其所有导入记录。
