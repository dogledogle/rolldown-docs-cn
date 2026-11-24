# 无用代码消除

无用代码消除（DCE）是一种优化技术，会从打包产物中移除未使用的代码，使产物更小、加载更快。

Rolldown 会移除**同时**满足以下两个条件的代码：

1. **未使用**：该值从未被使用
2. **没有副作用**：移除代码不会改变程序行为

以下是一个简单示例：

```js
// math.js
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

// main.js
import { add } from './math.js';
console.log(add(2, 3));
```

本例中，`multiply` 从未被导入，也没有副作用，因此 Rolldown 会将其从最终产物中移除。

::: tip 摇树优化
摇树优化是由 [Rollup 推广开来的](https://rollupjs.org/faqs/#what-is-tree-shaking) 相关术语，指一种特定的无用代码消除技术：通过“摇动”语法树移除未使用的代码。
:::

## 什么是副作用？

副作用是指任何影响自身作用域之外内容的操作。常见副作用包括：

- 修改全局变量或 DOM
- 导入 CSS 文件（会向页面应用样式）
- 修改原型或全局对象的 polyfill

```js
// 副作用：应用样式
import './styles.css';
// 副作用：修改全局对象
window.API_URL = '/api';
// 副作用：修改原型
Array.prototype.first = function () {
  return this[0];
};
```

## Rolldown 如何检测副作用

Rolldown 会自动分析代码，并通过检查以下内容检测副作用：

- 模块是否包含导入时运行的顶层代码
- 函数调用是否可能修改外部状态
- 属性访问是否可能触发具有副作用的 getter

不过，静态分析存在局限。有些模式过于动态，无法分析；不确定时，Rolldown 可能会保守地保留代码。可以使用 [`treeshake.unknownGlobalSideEffects`](https://rolldown.rs/reference/InputOptions.treeshake#unknownglobalsideeffects) 和 [`treeshake.propertyReadSideEffects`](https://rolldown.rs/reference/InputOptions.treeshake#propertyreadsideeffects) 调整此行为。

也可以明确将代码标记为无副作用，帮助 Rolldown 执行更积极的无用代码消除。

## 将代码标记为无副作用

可以使用注解注释告诉 Rolldown 某段代码没有副作用。注解默认启用，可以通过 [`treeshake.annotations`](https://rolldown.rs/reference/InputOptions.treeshake#annotations) 禁用。

### `@__PURE__`

`@__PURE__` 注解告诉打包器，某个函数调用或 `new` 表达式没有副作用。如果结果未使用，可以移除整个调用。

```js
const button = /* @__PURE__ */ createButton();
const widget = /* @__PURE__ */ new Widget();
```

如果从未使用 `button` 和 `widget`，Rolldown 会彻底移除这两个调用。没有注解时，Rolldown 无法确定 `createButton()` 和 `new Widget()` 没有副作用，因此会保留它们。

注解必须出现在调用或 `new` 表达式的**紧邻前方**才会生效。如果放在其他位置，Rolldown 会生成 `INVALID_ANNOTATION` 警告。

::: warning 常见的无效位置

```js
// 位于非调用表达式之前
/* @__PURE__ */ globalThis.createElement;

// 位于声明之前
/* @__PURE__ */ function foo() {}

// 位于变量声明符的标识符与 `=` 之间
const foo /* @__PURE__ */ = bar();
```

:::

::: tip
为了兼容其他工具，注解也可以写成 `/* #__PURE__ */`（使用 `#` 代替 `@`）。
:::

### `@__NO_SIDE_EFFECTS__`

`@__NO_SIDE_EFFECTS__` 注解告诉打包器，对该函数声明的任何调用都没有副作用。

```js
/* @__NO_SIDE_EFFECTS__ */
function createComponent(name) {
  return {
    name,
    render() {
      return `<${name}></${name}>`;
    },
  };
}

// 如果未使用 `button`，会移除该调用
const button = createComponent('button');
// 如果未使用 `input`，也会移除该调用
const input = createComponent('input');
```

如果知道函数本身始终是纯函数，这种方式比在每个调用位置添加 `@__PURE__` 更方便。

## 将整个模块标记为无副作用

将模块标记为无副作用后，Rolldown 可以移除 `import './setup.js'` 这样的裸导入。当 Rolldown 跳过对某个模块的求值时，也会跳过只能通过该次求值访问到的依赖，即使这些依赖具有副作用。

如果模块是入口，或者为了提供其本地定义的导出项或命名空间对象而必须执行，Rolldown 会保留其顶层副作用，并照常对未使用的纯语句执行摇树优化。

### 导出与重新导出

Rolldown 可以沿着具名重新导出、`export *`，或对先前导入绑定的导出，经由无副作用的模块追溯到定义该绑定的模块。

```js [utils.js]
// utils.js 被标记为无副作用
console.log('utils initialized');

import { multiply } from './math.js';
export { multiply };

export function add(a, b) {
  return a + b;
}
```

在 `utils.js` 被标记为无副作用时：

- 如果没有任何其他内容需要 `utils.js`，裸导入 `import './utils.js'` 会被移除。
- 如果从 `utils.js` 使用的唯一绑定是 `multiply`，Rolldown 会直接将其解析到 `math.js`，并跳过 `utils.js` 中的日志输出。
- 如果执行 `import { add } from './utils.js'` 并随后使用 `add`，则会保留 `utils.js` 及其日志输出。
- `import * as utils from './utils.js'` 后接 `Object.keys(utils)` 时会使用命名空间对象，并保留 `utils.js` 及其日志输出。像 `utils.multiply` 这样可静态解析的属性访问，可以直接沿重新导出追踪。

对于已导入的 `multiply`，`export { multiply as default }` 会转发该导入绑定。而表达式 `export default multiply` 会创建一个以该绑定值初始化的本地默认导出。

::: details `import()` 呢？

这同样适用于 `import()`。如果被导入的模块被标记为无副作用，`import()` 位于模块顶层，并且其解析得到的值未被使用，Rolldown 会让 `import()` 解析为空对象，而不加载该模块。即使该模块导出了 `then`，这一行为仍然成立；否则，在解析 `import()` 时会调用该 `then`。

```js
// lib.js（标记为无副作用）
export function then(resolve) {
  console.log('then');
  resolve({});
}

// main.js
import('./lib.js');
console.log('main');
```

输出将是：

```js
Promise.resolve().then(() => /* @__PURE__ */ Object.freeze({ __proto__: null }));
console.log('main');
```

此处 `lib.js` 不会包含在打包产物中，且 `import()` 会解析为空对象，因此 `then` 永远不会运行。当 `import()` 解析得到的值被使用时、当 `import()` 位于函数内部时，或者当模块未被标记为无副作用时，`then` 仍会运行。

:::

### 重新导出与代码拆分

当多个入口从同一个无副作用的 [聚合模块](/glossary/barrel-module) 导入时，对于只使用转发绑定的入口，Rolldown 可以跳过聚合模块。另一个入口如果使用了其中定义的绑定，仍会加载该聚合模块。

```js
// barrel.js（标记为无副作用）
import { HeavyService } from './heavy.js';

console.log('barrel initialized');

export const createService = () => new HeavyService();
export { light } from './light.js';

// entry-light.js
import { light } from './barrel.js';
console.log(light());

// entry-heavy.js
import { createService } from './barrel.js';
console.log(createService().run());
```

将 `barrel.js` 标记为无副作用后，`entry-light.js` 入口会直接加载 `light.js`。`entry-heavy.js` 入口会加载聚合模块和 `heavy.js`，并输出 `barrel initialized`。在默认的副作用分析下，Rolldown 会检测到这条日志，因此两个入口都会加载聚合模块。

### 如何将模块标记为无副作用

可以使用 `package.json` 中的 `sideEffects` 字段、[`treeshake.moduleSideEffects`](https://rolldown.rs/reference/InputOptions.treeshake#modulesideeffects)，或插件钩子返回的 `moduleSideEffects` 结果。

#### package.json 中的 `sideEffects`

`package.json` 中的 `sideEffects` 字段告诉打包器，包中的哪些文件具有副作用：

```json [package.json]
{
  "name": "my-library",
  "sideEffects": false
}
```

设置 `sideEffects: false` 会将包中的所有文件标记为无副作用，这在工具库中很常见。

也可以指定具有副作用的文件数组：

```json [package.json]
{
  "name": "my-library",
  "sideEffects": ["./src/polyfill.js", "**/*.css"]
}
```

这会将 `polyfill.js` 和匹配的 CSS 文件标记为具有副作用；包中的其他所有文件都会被标记为无副作用。

数组接受 glob 模式（支持 `*`、`**`、`{a,b}`、`[a-z]`）。`*.css` 等不包含 `/` 的模式会被视为 `**/*.css`。

::: warning CSS 文件
如果库导入 CSS 文件，请确保将它们包含在 `sideEffects` 数组中，否则 CSS 导入可能会被移除：

```json [package.json]
{
  "name": "my-component-library",
  "sideEffects": ["**/*.css", "**/*.scss"]
}
```

:::

#### 插件钩子：`moduleSideEffects`

插件可以从 `resolveId`、`load` 或 `transform` 钩子返回 [`moduleSideEffects`](https://rolldown.rs/reference/Interface.SourceDescription#modulesideeffects)，覆盖特定模块的副作用检测结果：

```js [rolldown.config.js]
export default {
  plugins: [
    {
      name: 'my-plugin',
      resolveId(source) {
        if (source === 'my-pure-module') {
          return {
            id: source,
            moduleSideEffects: false,
          };
        }
        return null;
      },
    },
  ],
};
```

Rolldown 会按以下顺序检查这些来源，以确定模块的副作用：

1. `transform` 钩子返回的 `moduleSideEffects`
2. `load` 钩子返回的 `moduleSideEffects`
3. `resolveId` 钩子返回的 `moduleSideEffects`
4. [`treeshake.moduleSideEffects`](https://rolldown.rs/reference/InputOptions.treeshake#modulesideeffects)，当该选项能为模块给出结论时
5. 针对打包模块，`package.json` 中的 `sideEffects` 字段
6. 针对打包模块的静态分析，以及 Rolldown 对外部模块默认的副作用假设

选项的默认值 `true`、未匹配任何规则，以及回调返回 `undefined` 的情况，都会继续交由后续来源处理。钩子返回 `moduleSideEffects: true` 时，会将打包模块直接交给静态分析，绕过该选项和包元数据。

## 示例：优化组件库

假设有以下结构的组件库：

```text
my-component-lib/
├── package.json
└── src/
     ├── index.js
     └── components/
         ├── Button.js
         ├── Button.css
         ├── Modal.js
         └── Modal.css
```

::: code-group

```js [src/index.js]
export { Button } from './components/Button.js';
export { Modal } from './components/Modal.js';
```

```js [src/components/Button.js]
import './Button.css';
export function Button(props) {
  /* ... */
}
```

:::

为了确保可以移除未使用的组件，请只将 CSS 文件标记为具有副作用：

```json [package.json]
{
  "name": "my-component-lib",
  "sideEffects": ["**/*.css"]
}
```

现在，当使用者只导入 `Button` 时：

```js
import { Button } from 'my-component-lib';

render(<Button />);
```

Rolldown 将会：

1. 包含 `components/Button.js`（因为使用了 `Button`）
2. 包含 `components/Button.css`（因为 `components/Button.js` 导入了它，且它被标记为具有副作用）
3. 排除 `components/Modal.js`（因为未使用 `Modal`）
4. 排除 `components/Modal.css`（因为 `components/Modal.js` 被排除）
