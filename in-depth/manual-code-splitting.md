# 手动代码拆分

手动代码拆分是一项强大的功能，可作为 [自动代码拆分](./automatic-code-splitting.md) 的补充。当你希望将应用拆分成更小、更易管理的部分，以优化加载性能时，它会非常有用。

阅读本指南前，你应该先了解 Rolldown 的 [自动代码拆分](./automatic-code-splitting.md) 功能。本指南将说明手动代码拆分的工作原理，以及如何有效地使用它。

在深入细节之前，我们先澄清几点：

- 自动代码拆分与手动代码拆分并不冲突。使用手动代码拆分不代表禁用自动代码拆分。
  根据配置，一个模块会由自动代码拆分或手动代码拆分处理，但不会同时由两者处理。如果某个模块未被手动代码拆分捕获，它仍会按照 [自动代码拆分](./automatic-code-splitting.md) 指南中介绍的规则，被放入自动代码拆分创建的代码块中。

## 为什么使用手动代码拆分？

自动代码拆分不会考虑加载性能或缓存失效，只会根据模块的静态导入对它们进行分组。这可能产生不理想的代码块，例如创建体积过大的代码块，既不利于加载性能，又可能导致每次部署都使缓存失效。

## 如何使用手动代码拆分？

来看下面的示例：

```jsx
// index.jsx
import * as ReactDom from 'react-dom';
import App from './App.jsx';

ReactDom.createRoot(document.getElementById('root')).render(<App />);

// App.jsx
import * as React from 'react';
import { Button } from 'ui-lib';

export default function App() {
  return <Button onClick={() => alert('Button clicked!')} />;
}
```

得到以下输出：

```js [output-hash0.js]
// node_modules/react/index.js
'React library code';

// node_modules/ui-lib/index.js
'UI library code';

// node_modules/react-dom/index.js
'ReactDOM library code';

// App.js
function App() {
  return <Button onClick={() => alert('Button clicked!')} />;
}

// index.js

ReactDom.createRoot(document.getElementById('root')).render(<App />);
```

在此示例中：

- 我们使用了 3 个库：`react`、`react-dom` 和 `ui-lib`。
- `output-hash0.js` 是 Rolldown 生成的输出文件。
- `hash0` 是输出文件的哈希值；文件内容变化时，该值也会变化。

### 减少缓存失效

先来讨论缓存失效。这里的缓存失效是指，当你部署应用的新版本时，浏览器需要下载新版文件。如果文件很大，就可能造成不佳的用户体验。

例如，如果你修改了 `app.jsx` 文件：

```jsx [app.jsx]
function App() {
  return <Button onClick={() => alert('Button clicked!')} />; // [!code --]
  return <Button onClick={() => alert('Button clicked!!!')} />; // [!code ++]
}
```

自然会得到一个 `output-hash1.js` 文件。除了 `App` 函数中的改动，它与 `output-hash0.js` 内容相同。

现在，如果部署这个新版本，浏览器需要下载整个 `output-hash1.js` 文件，尽管其中仅有一小部分发生了变化。这是因为文件的哈希值已改变，浏览器会将它视为新文件。

为解决这个问题，可以使用 `codeSplitting` 选项将输出中的库拆分到单独的代码块中，因为与应用代码相比，这些库通常不会频繁变化。

```js [rolldown.config.js]
export default {
  // ……其他配置
  output: {
    codeSplitting: {
      groups: [
        {
          test: /node_modules/,
          name: 'libs',
        },
      ],
    },
  },
};
```

使用上述 `codeSplitting` 选项后，输出如下：

::: code-group

```js [output-hash0.js]
import ... from './libs-hash0.js';
// App.js
function App() {
  return <Button onClick={() => alert("Button clicked!")} />;
}

// index.js

ReactDom.createRoot(document.getElementById("root")).render(<App />);
```

```js [libs-hash0.js]
// node_modules/react/index.js
"React library code";

// node_modules/ui-lib/index.js
"UI library code";

// node_modules/react-dom/index.js
"ReactDOM library code";

export { ... };
```

:::

例如，修改 `app.jsx` 文件后：

```jsx [app.jsx]
function App() {
  return <Button onClick={() => alert('Button clicked!')} />; // [!code --]
  return <Button onClick={() => alert('Button clicked!!!')} />; // [!code ++]
}
```

将得到以下输出：

::: code-group

```js [output-hash1.js]
import ... from './libs-hash0.js';
// App.js
function App() {
  return <Button onClick={() => alert("Button clicked!!!")} />;
}

// index.js

ReactDom.createRoot(document.getElementById("root")).render(<App />);
```

```js [libs-hash0.js]
// node_modules/react/index.js
"React library code";

// node_modules/ui-lib/index.js
"UI library code";

// node_modules/react-dom/index.js
"ReactDOM library code";

export { ... };
```

:::

- `libs-hash0.js` 文件没有变化，因此浏览器可以使用其缓存版本。
- `output-hash1.js` 文件发生了变化，因此浏览器会下载新版本。

### 提升加载性能

手动代码拆分还可以将应用拆分为数量合理的代码块，利用浏览器的并行加载能力来提升加载性能。

在上一个示例中，我们将所有库放进了同一个代码块，这对加载性能而言并非最优。如果这些库体积过大，浏览器就要花费很长时间下载该代码块，进而造成不佳的用户体验。

为解决这个问题，可以使用 `codeSplitting` 选项将各个库拆分到单独的代码块中，让浏览器并行下载它们。

```js [rolldown.config.js]
export default {
  // ……其他配置
  output: {
    codeSplitting: {
      groups: [
        {
          test: /node_modules\/react/,
          name: 'react',
        },
        {
          test: /node_modules\/react-dom/,
          name: 'react-dom',
        },
        {
          test: /node_modules\/ui-lib/,
          name: 'ui-lib',
        },
      ],
    },
  },
};
```

使用上述 `codeSplitting` 选项后，输出如下：

::: code-group

```js [output-hash0.js]
import ... from './react-hash0.js';
import ... from './react-dom-hash0.js';
import ... from './ui-lib-hash0.js';

// App.js
function App() {
  return <Button onClick={() => alert("Button clicked!")} />;
}
// index.js
ReactDom.createRoot(document.getElementById("root")).render(<App />);
```

```js [react-hash0.js]
"React library code";
export { ... };
```

```js [react-dom-hash0.js]
"ReactDOM library code";
export { ... };
```

```js [ui-lib-hash0.js]
"UI library code";
export { ... };
```

:::

现在，各个库已拆分到独立的代码块中，浏览器可以并行下载它们。这可以显著提升应用的加载性能，尤其是当这些库体积较大时。

## 限制

### 为什么总会有一个 `runtime.js` 代码块？

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    compound=true;

    subgraph cluster_problem {
        label="不使用 runtime.js";
        labeljust="l";
        fontname="Arial";
        fontsize=12;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#cb2431|#f85149}";

        p_main [label="main.js", fillcolor="${#fff0e0|#4a2a0a}"];
        p_first [label="first.js", fillcolor="${#dbeafe|#1e3a5f}"];
        p_second [label="second.js\n（在此定义 __esm、__export）", fillcolor="${#dbeafe|#1e3a5f}"];

        p_main -> p_first [label="导入"];
        p_main -> p_second [label="导入 __esm"];
        p_first -> p_second [label="导入"];
        p_second -> p_first [label="导入", color="${#cb2431|#f85149}", fontcolor="${#cb2431|#f85149}", style=dashed];
    }

    subgraph cluster_solution {
        label="使用 runtime.js";
        labeljust="l";
        fontname="Arial";
        fontsize=12;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#22863a|#3fb950}";

        s_runtime [label="runtime.js\n（__esm、__export）", fillcolor="${#dcfce7|#14532d}"];
        s_main [label="main.js", fillcolor="${#fff0e0|#4a2a0a}"];
        s_first [label="first.js", fillcolor="${#dbeafe|#1e3a5f}"];
        s_second [label="second.js", fillcolor="${#dbeafe|#1e3a5f}"];

        s_main -> s_runtime [label="导入"];
        s_main -> s_first [label="导入"];
        s_first -> s_runtime [label="导入"];
        s_first -> s_second [label="导入"];
        s_second -> s_runtime [label="导入"];
        s_second -> s_first [label="导入"];
    }
}
```

简而言之：如果通过分组使用手动代码拆分，Rolldown 会强制生成一个 `runtime.js` 代码块，确保运行时代码始终先于其他代码块执行。

`runtime.js` 是一个特殊代码块，**只**包含加载和执行应用所需的运行时代码。打包器会强制生成它，确保运行时代码始终先于其他代码块执行。

由于手动代码拆分允许在代码块之间移动模块，因此很容易在输出代码中产生循环导入。这可能导致运行时代码未能在其他代码块之前执行，进而使应用出错。

以下是一段存在循环导入的输出代码示例：

```js
// first.js
import { __esm, __export, init_second, value$1 as value } from './second.js';
var first_exports = {};
__export(first_exports, { value: () => value$1 });
var value$1;
var init_first = __esm({
  'first.js'() {
    init_second();
    // ...
  },
});
export { first_exports, init_first, value$1 as value };

// main.js
import { first_exports, init_first } from './first.js';
import { __esm, init_second, second_exports } from './second.js';

var init_main = __esm({
  'main.js'() {
    init_first();
    init_second();
    // ...
  },
});

init_main();

// second.js
import { init_first, value } from './first.js';
var __esm = '...';
var __export = '...';

var second_exports = {};
__export(second_exports, { value: () => value$1 });
var value$1;
var init_second = __esm({
  'second.js'() {
    init_first();
    // ...
  },
});

export { __esm, __export, init_second, second_exports, value$1 };
```

运行 `node ./main.js` 时，模块的遍历顺序是 `main.js` -> `first.js` -> `second.js`，而模块执行顺序是 `second.js` -> `first.js` -> `main.js`。

`second.js` 尝试在 `__esm` 函数初始化之前调用它。这会导致运行时错误，因为代码实际上是在尝试将 `undefined` 作为函数调用。

通过强制生成 `runtime.js`，打包器可以确保任何依赖运行时代码的代码块都会先加载 `runtime.js`，再执行自身。这样能保证运行时代码始终先于其他代码块执行，从而避免循环导入问题。

### 为什么分组中包含不满足约束条件的模块？

当一个模块被某个分组捕获时，Rolldown 会尝试递归捕获它的依赖项，而不再考虑约束条件。这是因为 Rolldown 默认只允许改写非入口代码块的导出。

例如，有以下代码：

```js
// entry.js
import { value } from './a.js';

console.log(value);

export const foo = 'foo';

// a.js
import { value as valueB } from './b.js';
export const value = 'a' + valueB;

// b.js
export const value = 'b';
```

假设我们想将 `a.js` 模块移入单独的代码块，同时让 `b.js` 模块与 `entry.js` 留在同一代码块中，会得到：

::: code-group

```js [entry.js]
import { value } from './a.js';

// b.js
const value = 'b';

// entry.js
const foo = 'foo';
console.log(value);

export { foo, value };
```

```js [a.js]
import { value } from './entry.js';

// a.js
export const value = 'a' + value;
```

:::

可以看到，为了让 `a.js` 正常工作，我们必须修改入口代码块 `entry.js` 的导出签名，并额外导出 `value`。这完全违背了原代码只从 `entry.js` 导出 `foo` 的意图。

如果不希望出现这种行为，可以使用 [`codeSplitting.includeDependenciesRecursively: false`](https://rolldown.rs/reference/OutputOptions.codeSplitting#includedependenciesrecursively) 将其禁用。

::: warning 注意事项

使用 `includeDependenciesRecursively: false` 时，分组依赖的模块可能会留在入口代码块中。从入口代码块导出非入口模块是无效的。为避免这种情况，如果没有显式设置 `preserveEntrySignatures`，Rolldown 会隐式将其设为 `'allow-extension'`。

- [`InputOptions.preserveEntrySignatures: false | 'allow-extension'`](https://rolldown.rs/reference/InputOptions.preserveEntrySignatures)

`includeDependenciesRecursively: false` 会增加生成无效输出代码的可能性。如果遇到执行顺序或循环依赖造成的问题，可以考虑启用：

- [`strictExecutionOrder: true`](https://rolldown.rs/reference/OutputOptions.strictExecutionOrder)

:::

### 为什么代码块会大于 `maxSize`？

`maxSize` 是一个目标值，而不是严格限制。在以下情况下，代码块可能超过该值：

- 如果单个模块大于 `maxSize`，生成的代码块就会超出限制。Rolldown 目前不支持将单个模块拆分到多个代码块中。
- Rolldown 会优先考虑 `minSize` 配置。如果拆分一个大代码块会使新代码块低于 `minSize` 阈值，Rolldown 会保留原代码块，不进行拆分，以免生成过小的文件。
