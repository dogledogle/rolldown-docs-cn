# 入口代码块（Entry Chunk）

之所以要创建入口代码块，是因为我们需要输出一个 JavaScript 文件来：

- 导出入口模块的导出项。
- 充当相应 [入口](./entry.md) 的执行点。
- 存放入口模块及其依赖的代码（前提是这些代码没有被拆分到其他代码块中）。

假设有一个既能独立运行、又能被其他应用作为库使用的应用。

文件结构如下：

```js
// component.js
export function component() {
  return 'Hello World';
}

// render.js
export function render(component) {
  console.log(component());
}

// app.js
import { component } from './component.js';
import { render } from './render.js';

render(component);

// lib.js
export { component } from './component.js';
```

配置如下：

```js
export default defineConfig({
  input: {
    app: './app.js',
    lib: './lib.js',
  },
});
```

Rolldown 会生成类似下面的输出：

::: code-group

```js [app.js]
import { component } from './common.js';

function render(component) {
  console.log(component());
}

render(component);
```

```js [lib.js]
export { component } from './common.js';
```

```js [common.js]
export function component() {
  return 'Hello World';
}
```

:::

- 创建 `lib.js` 是因为我们需要生成导出签名 `export { component }`，并从 `lib.js` 中将其导出。
- 虽然 `app.js` 没有导出任何内容，我们仍需创建它，作为应用的执行点。
- 你还会发现，从执行点 `app.js` 开始，只会执行它所导入的模块，例如 `render.js`。这既是需要执行点的另一个原因，也是执行点所提供的语义保证。
