# 无用代码消除

无用代码消除（DCE）是一种优化技术，会从打包产物中移除未使用的代码，使产物更小、加载更快。

Rolldown 会移除**同时**满足以下两个条件的代码：

1. **未使用**：该值从未被使用。
2. **没有副作用**：移除代码不会改变程序行为。

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

- 修改全局变量或 DOM。
- 导入 CSS 文件（会向页面应用样式）。
- 修改原型或全局对象的 polyfill。

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

- 模块是否包含导入时运行的顶层代码。
- 函数调用是否可能修改外部状态。
- 属性访问是否可能触发具有副作用的 getter。

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

除了标记单个表达式或函数，也可以把整个模块标记为无副作用。如果模块被标记为无副作用，并且它自身的导出项均未使用，Rolldown 就会把该模块中的每条语句都视为无副作用。

::: details “它自身的导出项均未使用”是什么意思？

这里指**在模块自身中定义**的导出项，不包括从其他模块重新导出的内容。

```js [utils.js]
// 假设该文件被标记为无副作用
window.loaded = true; // 副作用

// 在该文件中定义，算作“它自身的导出项”
export function add(a, b) {
  return a + b;
}

// 从其他文件重新导出，不计入其中
export { multiply } from './math.js';
export * from './math2.js';
import { divide } from './math3.js';
export { divide };
```

本例中：

- 如果执行 `import { add } from './utils.js'`，模块会被视为“已使用”，因为 `add` 在 `utils.js` 中定义。
- 如果只执行 `import { multiply } from './utils.js'`，模块会被视为“未使用”，因为 `multiply` 只是重新导出，并非在此处定义。

:::

例如，请考虑以下情况：

```js
// math.js
window.myGlobal = 'hello'; // 副作用：修改全局对象

export function add(a, b) {
  return a + b;
}

// main.js
import './math.js';
console.log('main');
```

如果将 `math.js` 标记为无副作用，输出将是：

```js
console.log('main');
```

:::: warning 这是有条件的

只有模块自身的导出项均未使用时，其中的语句才会被视为无副作用。如果使用了任何导出项，副作用仍会保留。

::: details 示例

例如，请考虑以下情况：

```js
// math.js（标记为无副作用）
window.myGlobal = 'hello'; // 副作用：修改全局对象

export function add(a, b) {
  return a + b;
}

// main.js
import { add } from './math.js';
console.log('main', add(2, 3));
```

输出将是：

```js
window.myGlobal = 'hello';

function add(a, b) {
  return a + b;
}

console.log('main', add(2, 3));
```

另一方面，如果将 `math.js` 中的每条语句都标记为无副作用，输出将是：

```js
function add(a, b) {
  return a + b;
}

console.log('main', add(2, 3));
```

:::

::::

### package.json 中的 `sideEffects`

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

这会告诉 Rolldown，大多数文件没有副作用，未使用时可以移除；但 `polyfill.js` 和 CSS 文件必须保留。

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

### 插件钩子：`moduleSideEffects`

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

确定模块副作用时，优先级顺序如下：

1. `transform` 钩子返回的 `moduleSideEffects`。
2. `load` 钩子返回的 `moduleSideEffects`。
3. `resolveId` 钩子返回的 `moduleSideEffects`。
4. [`treeshake.moduleSideEffects`](https://rolldown.rs/reference/InputOptions.treeshake#modulesideeffects) 选项。
5. `package.json` 中的 `sideEffects` 字段。

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

1. 包含 `components/Button.js`（因为使用了 `Button`）。
2. 包含 `components/Button.css`（因为 `components/Button.js` 导入了它，且它被标记为具有副作用）。
3. 排除 `components/Modal.js`（因为未使用 `Modal`）。
4. 排除 `components/Modal.css`（因为 `components/Modal.js` 被排除）。
