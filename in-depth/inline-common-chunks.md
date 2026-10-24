# 内联公共代码块

内联公共代码块可以减少[自动代码拆分](./automatic-code-splitting.md)生成的小型公共代码块数量。Rolldown 会把这些公共代码复制到使用它们的代码块中，并移除独立的公共代码块文件。共享运行时会确保这些副本使用相同的模块状态和导出。

## 用法 {#usage}

```js [rolldown.config.mjs]
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: ['src/a.js', 'src/b.js', 'src/c.js'],
  preserveEntrySignatures: false,
  output: {
    dir: 'dist',
    format: 'es',
    codeSplitting: {
      experimentalInlineCommonChunks: {
        maxSize: 10 * 1024, // < 10 KiB
      },
    },
  },
});
```

`maxSize` 基于转换后的源代码大小，并在渲染、代码压缩和传输压缩之前按代码块汇总。它的默认值为 `0`（禁用）；`Infinity` 表示不限制大小。

入口、动态导入目标和手动代码块不会被内联。只要任一模块与 [`exclude`](/reference/TypeAlias.ExperimentalInlineCommonChunksOptions#exclude) 匹配，它所在的整个公共代码块就不会被内联。

内联需要满足以下条件：

- ESM 输出（[`output.format: 'es'`](/reference/OutputOptions.format)）。
- [`preserveEntrySignatures: false`](/reference/InputOptions.preserveEntrySignatures)，它允许移除未使用的入口导出。
- 启用 [`strictExecutionOrder`](/reference/OutputOptions.strictExecutionOrder)。省略该选项时，Rolldown 会自动启用它。

## 工作原理

自动代码拆分遵循继承自 Rollup 输出模型的两条规则：

1. 模块代码只会出现在一个输出代码块中。
2. 入口只会加载从该入口可到达的应用模块。

[用法](#usage)中的配置定义了三个入口：A、B 和 C。三个入口都会导入一个体积较大的库；A 和 B 还会导入一个带计数器的辅助模块：

::: code-group

```js [src/a.js 和 src/b.js]
import './library.js';
import { inc } from './helper.js';

console.log(inc());
```

```js [src/c.js]
import './library.js';
```

```js [src/helper.js]
console.log('helper initialized');
let count = 0;
export function inc() {
  return ++count;
}
```

:::

无论体积如何，库和辅助模块都会进入不同的公共代码块，因为导入它们的入口集合不同。动态导入目标也算作入口，因此惰性路由之间也会出现相同的情况。

[手动代码拆分](./manual-code-splitting.md)可以将它们合并，但这样一来，C 也会加载辅助模块。内联则会把辅助模块复制到 A 和 B 中。假设辅助模块低于 `maxSize`，而库高于该值：

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [color="${#3c3c43|#dfdfd6}"];

    subgraph cluster_before {
        label="独立的公共代码块";
        fontname="Arial";
        fontcolor="${#3c3c43|#dfdfd6}";
        color="${#3c3c43|#dfdfd6}";
        a [label="A", fillcolor="${#fff0e0|#4a2a0a}"];
        b [label="B", fillcolor="${#fff0e0|#4a2a0a}"];
        c [label="C", fillcolor="${#fff0e0|#4a2a0a}"];
        helper [label="辅助模块", fillcolor="${#dcfce7|#14532d}"];
        library [label="库", fillcolor="${#dbeafe|#1e3a5f}"];
        a -> helper;
        b -> helper;
        { a b c } -> library;
    }

    subgraph cluster_after {
        label="辅助模块已内联";
        fontname="Arial";
        fontcolor="${#3c3c43|#dfdfd6}";
        color="${#3c3c43|#dfdfd6}";
        a_inline [label="A + 辅助模块", fillcolor="${#fff0e0|#4a2a0a}"];
        b_inline [label="B + 辅助模块", fillcolor="${#fff0e0|#4a2a0a}"];
        c_inline [label="C", fillcolor="${#fff0e0|#4a2a0a}"];
        library_inline [label="库", fillcolor="${#dbeafe|#1e3a5f}"];
        { a_inline b_inline c_inline } -> library_inline;
    }
}
```

箭头表示导入关系；图中省略了共享运行时。

### 在副本之间共享状态

在同一 JavaScript 环境中先加载 A 再加载 B，输出如下：

```text
helper initialized
1
2
```

如果将辅助模块的代码主体粘贴到两个文件中，就会创建两个计数器，而且都从 `0` 开始。每个文件都会输出 `helper initialized` 和 `1`。导出对象和函数的身份也会不同。

Rolldown 会把公共代码块包装在一个*工厂函数*中，并将每个副本注册到共享运行时。A 和 B 都包含以下代码（名称已简化，省略了库导入和入口包装代码）：

<!-- prettier-ignore -->
```js
import {
  __share,
  __share_require,
  __share_export,
  __esmMin,
} from './rolldown-runtime.js';

__share('helper', (exports) => {
  let count;
  function inc() {
    return ++count;
  }
  const init_helper = __esmMin(() => {
    console.log('helper initialized');
    count = 0;
  });
  __share_export(exports, {
    inc: () => inc,
    init_helper: () => init_helper,
  });
});

const helper = __share_require('helper');
helper.init_helper();
console.log((0, helper.inc)());
```

| 运行时辅助函数 | 行为 |
| --- | --- |
| `__share` | 注册一个工厂函数，但不调用它。对于同一标识符，首次注册生效。 |
| `__share_require` | 首次使用时运行工厂函数，并缓存其导出对象。 |
| `__esmMin` | 使模块初始化函数只运行一次。 |
| `__share_export` | 通过 getter 暴露导出，保留实时绑定。 |

A 调用 `init_helper` 会初始化共享的 `count`，`inc()` 返回 `1`。B 获得的是同一组函数：它的初始化函数不执行任何操作，而 `inc()` 返回 `2`。

将注册与模块初始化分离，可以让工厂函数在使用方运行之前就可用，而模块顶层代码的执行时机由 `strictExecutionOrder` 控制。

所有副本都必须导入同一个运行时代码块，才能共享状态。

### 加载与缓存

从 A 注册辅助模块并不会移除嵌入 B 文件中的副本；加载 B 时仍会传输这部分代码。

| 加载场景 | 独立的辅助模块代码块 | 将辅助模块内联到 A 和 B |
| --- | --- | --- |
| 冷加载 A | 单独加载辅助模块。 | 在 A 内加载辅助模块。 |
| 随后加载 B | 复用已加载的辅助模块。 | 在 B 内加载另一个副本。 |
| 加载更新后的 A；未更改的辅助模块已缓存 | 复用已缓存的辅助模块。 | 在新版 A 内再次加载辅助模块。 |

为了少一次请求，复制一个小型辅助模块或许是值得的。使用 `maxSize: Infinity` 时，同样的取舍也适用于由 A、B 和 C 共享的大型库：如果它符合内联条件，加载全部三个入口会传输该库的三份副本。运行时还会增加一个共享文件和额外的执行开销。

`maxSize` 衡量的是代码块的源代码大小，而不是各副本为用户会话增加的总字节数。因此，代码块更少并不保证加载更快。在决定是否启用该功能或提高阈值之前，请比较你的应用在内联和不内联时初始加载及后续导航的加载耗时，并将缓存复用情况纳入考量。

## 优化

### 避免不必要的副本

A 和 B 各需要一个工厂函数，因为任一入口都可能先加载。现在假设两者都能动态导入 `detail.js`，而该模块也会使用辅助模块。无论哪个导入先开始，A 或 B 都已经注册了工厂函数，因此 `detail.js` 不需要再包含一份副本：

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    a [label="A + 辅助模块工厂函数", fillcolor="${#fff0e0|#4a2a0a}"];
    b [label="B + 辅助模块工厂函数", fillcolor="${#fff0e0|#4a2a0a}"];
    detail [label="detail.js\n使用已注册的工厂函数", fillcolor="${#dcfce7|#14532d}"];
    { rank=same; a; b; }
    a -> detail [label="import()"];
    b -> detail [label="import()"];
}
```

```js [detail.js]
import { __share_require } from './rolldown-runtime.js';

const helper = __share_require('helper');
helper.init_helper();
console.log((0, helper.inc)());
```

Rolldown 只有在来自配置入口或插件生成入口的每条已知路径都先提供该工厂函数时，才会省略副本。更早的静态依赖也可以提供该工厂函数。

### 让模块保持在同一作用域

Rolldown 会将整个公共代码块包装在一个工厂函数中，因此其中的模块可以直接相互引用。代码压缩器可以在该作用域内重命名和内联代码。从工厂函数外部发起的引用会经过其导出对象，从而限制跨边界的优化。

## 兼容性

### 代码块选择

即使低于 `maxSize`，公共代码块在以下情况下也不会被内联：

- 包含顶层 await，或静态依赖于包含顶层 await 的模块。
- 包含经无用代码消除后仍然存在的 `import.meta`。
- 包含无法解析的动态导入，或导入了外部模块。
- 另一个输出代码块重新导出了它的某个绑定。
- 包含声明模块或内置的 `asset` 或 `copy` 模块。

直接使用 `eval`，或涉及未内联代码块的静态循环，也可能导致无法内联。

### 插件

- 被内联的模块会出现在每个包含其副本的代码块的 [`moduleIds`](/reference/Interface.RenderedChunk#moduleids) 和 [`modules`](/reference/Interface.RenderedChunk#modules) 中。CSS 提取插件和 SSR manifest 插件必须考虑模块属于多个代码块的情况。

  ::: info Vite
  对于 Vite 构建，请将以下 `exclude` 匹配器添加到 `experimentalInlineCommonChunks` 中，以避免 CSS 在多个输出样式表中重复：

  ```js
  exclude: /\.(css|scss|sass|less|styl|stylus|pcss|postcss|sss)(\?|$)/,
  ```

  :::

- 如果 `renderChunk` 钩子为各副本提供了不同的值，则首次注册的副本会决定所有使用方得到的值。请对受影响的模块使用 [`exclude`](/reference/TypeAlias.ExperimentalInlineCommonChunksOptions#exclude)。

更多背景信息，请参阅[设计 RFC](https://github.com/rolldown/rolldown/discussions/10693)。欢迎在[反馈 issue](https://github.com/rolldown/rolldown/issues/11040)中分享应用结果并报告缺陷。
