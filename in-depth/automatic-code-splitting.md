# 自动代码拆分

自动代码拆分是根据模块创建代码块的过程。本章介绍其行为和背后的原理。

自动代码拆分无法由用户直接控制，而是按照特定规则运行。为了与 [手动代码拆分](./manual-code-splitting.md) 所执行的拆分相区别，本文将其称为自动代码拆分。

自动代码拆分会生成两类代码块。

## **入口代码块**

**入口代码块**通过把静态连接的模块合并到一个代码块中生成。“静态”是指静态 `import ... from '...'` 或 `require(...)`。

**入口代码块**又分为两类。

第一类是**初始代码块**。**初始代码块**根据用户配置生成。例如，`input: ['./a.js', './b.js']` 定义了两个**初始代码块**。

第二类是**动态代码块**。**动态代码块**由动态导入产生。动态导入用于按需加载代码，因此不会把导入的代码与导入方放在一起。

以下代码会生成两个代码块：

```js
// entry.js（包含在 `input` 选项中）
import foo from './foo.js';
import('./dyn-entry.js');

// dyn-entry.js
require('./bar.js');

// foo.js
export default 'foo';

// bar.js
module.exports = 'bar';
```

本例中存在两组静态连接的模块。

```dot
digraph {
    bgcolor="transparent";
    rankdir=LR;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    subgraph cluster_group1 {
        label="第 1 组（初始代码块）";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        entry [label="entry.js", fillcolor="${#fff0e0|#4a2a0a}"];
        foo [label="foo.js", fillcolor="${#fff0e0|#4a2a0a}"];
        entry -> foo [label="静态导入"];
    }

    subgraph cluster_group2 {
        label="第 2 组（动态代码块）";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#0366d6|#58a6ff}";

        dyn [label="dyn-entry.js", fillcolor="${#dbeafe|#1e3a5f}"];
        bar [label="bar.js", fillcolor="${#dbeafe|#1e3a5f}"];
        dyn -> bar [label="require()"];
    }

    entry -> dyn [label="import()", style=dashed];
}
```

由于存在两组模块，自动代码拆分最终会生成两个代码块。

## **公共代码块**

当一个模块被至少两个不同入口静态导入时，就会生成**公共代码块**，把这些模块放入独立代码块中。

这种行为的目的如下：

- 确保最终打包输出中的每个 JavaScript 模块都是单例。
- 执行某个入口时，只执行该入口导入的模块。

需要特别注意：模块能否放入同一个公共代码块，取决于它们是否由相同的入口导入。

以下代码会生成六个代码块：

```js
// entry-a.js（包含在 `input` 选项中）
import 'shared-by-ab.js';
import 'shared-by-abc.js';
console.log(globalThis.value);

// entry-b.js（包含在 `input` 选项中）
import 'shared-by-ab.js';
import 'shared-by-bc.js';
import 'shared-by-abc.js';
console.log(globalThis.value);

// entry-c.js（包含在 `input` 选项中）
import 'shared-by-bc.js';
import 'shared-by-abc.js';
console.log(globalThis.value);

// shared-by-ab.js
globalThis.value = globalThis.value || [];
globalThis.value.push('ab');

// shared-by-bc.js
globalThis.value = globalThis.value || [];
globalThis.value.push('bc');

// shared-by-abc.js
globalThis.value = globalThis.value || [];
globalThis.value.push('abc');
```

会生成以下代码块：

::: code-group

```js [entry-a.js]
import './common-ab.js';
import './common-abc.js';
```

```js [entry-b.js]
import './common-ab.js';
import './common-bc.js';
import './common-abc.js';
```

```js [entry-c.js]
import './common-bc.js';
import './common-abc.js';
```

```js [common-ab.js]
globalThis.value = globalThis.value || [];
globalThis.value.push('ab');
```

```js [common-bc.js]
globalThis.value = globalThis.value || [];
globalThis.value.push('bc');
```

```js [common-abc.js]
globalThis.value = globalThis.value || [];
globalThis.value.push('abc');
```

:::

下图展示了入口如何共享依赖，以及模块如何分组到代码块中：

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    newrank=true;

    // 入口节点
    entry_a [label="entry-a.js", fillcolor="${#fff0e0|#4a2a0a}"];
    entry_b [label="entry-b.js", fillcolor="${#fff0e0|#4a2a0a}"];
    entry_c [label="entry-c.js", fillcolor="${#fff0e0|#4a2a0a}"];

    // 共享模块节点
    shared_ab [label="shared-by-ab.js", fillcolor="${#dbeafe|#1e3a5f}"];
    shared_bc [label="shared-by-bc.js", fillcolor="${#dbeafe|#1e3a5f}"];
    shared_abc [label="shared-by-abc.js", fillcolor="${#e0e7ff|#2e1065}"];

    // 边
    entry_a -> shared_ab;
    entry_a -> shared_abc;
    entry_b -> shared_ab;
    entry_b -> shared_bc;
    entry_b -> shared_abc;
    entry_c -> shared_bc;
    entry_c -> shared_abc;

    // 代码块分组
    subgraph cluster_chunk_a {
        label="entry-a.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";
        entry_a;
    }
    subgraph cluster_chunk_b {
        label="entry-b.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";
        entry_b;
    }
    subgraph cluster_chunk_c {
        label="entry-c.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";
        entry_c;
    }
    subgraph cluster_common_ab {
        label="common-ab.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#0366d6|#58a6ff}";
        shared_ab;
    }
    subgraph cluster_common_bc {
        label="common-bc.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#0366d6|#58a6ff}";
        shared_bc;
    }
    subgraph cluster_common_abc {
        label="common-abc.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#0366d6|#58a6ff}";
        shared_abc;
    }
}
```

`entry-*.js` 代码块根据上文所述原因生成。`common-*.js` 代码块是**公共代码块**，创建原因如下：

- `common-ab.js`：`shared-by-ab.js` 同时被 `entry-a.js` 和 `entry-b.js` 导入。
- `common-bc.js`：`shared-by-bc.js` 同时被 `entry-b.js` 和 `entry-c.js` 导入。
- `common-abc.js`：`shared-by-abc.js` 被全部三个入口导入。

你可能会问，为什么自动代码拆分不把 `shared-by-*.js` 文件放入单一公共代码块。原因是这样做会违背原始代码的意图。

对于上面的示例，如果创建单一公共代码块，内容将类似于：

```js [common-all.js]
globalThis.value = globalThis.value || [];
globalThis.value.push('ab');
globalThis.value = globalThis.value || [];
globalThis.value.push('bc');
globalThis.value = globalThis.value || [];
globalThis.value.push('abc');
```

对于该输出，执行任何入口都会得到 `['ab', 'bc', 'abc']`。但原始代码中，每个入口会得到不同结果：

- `entry-a.js`: `['ab', 'abc']`
- `entry-b.js`: `['ab', 'bc', 'abc']`
- `entry-c.js`: `['bc', 'abc']`

## 模块放置顺序

Rolldown 会尽量按照原始代码中的声明顺序放置模块。

对于以下代码：

```js
// entry.js
import { foo } from './foo.js';
console.log(foo);

// foo.js
export var foo = 'foo';
```

Rolldown 会从入口开始模拟执行，以计算模块顺序。

本例的执行顺序是 `[foo.js, entry.js]`，因此打包输出类似于：

```js [output.js]
// foo.js
var foo = 'foo';

// entry.js
console.log(foo);
```

### 保持执行顺序并非最高优先级

不过，Rolldown 有时不会遵循模块的原始顺序。这是因为确保模块为单例的优先级高于按照声明顺序放置模块。

对于以下代码：

```js
// entry.js（包含在 `input` 选项中）
import './setup.js';
import './execution.js';

import('./dyn-entry.js');

// setup.js
globalThis.value = 'hello, world';

// execution.js
console.log(globalThis.value);

// dyn-entry.js
import './execution.js';
```

打包输出将是：

::: code-group

```js [entry.js]
import './common-execution.js';

// setup.js
globalThis.value = 'hello, world';
```

```js [dyn-entry.js]
import './common-execution.js';
```

```js [common-execution.js]
console.log(globalThis.value);
```

:::

`common-execution.js` 是公共代码块。之所以生成它，是因为 `entry.js` 和 `dyn-entry.js` 都导入了 `execution.js`。

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    compound=true;

    subgraph cluster_entry {
        label="entry.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        entry [label="entry.js", fillcolor="${#fff0e0|#4a2a0a}"];
        setup [label="setup.js", fillcolor="${#fff0e0|#4a2a0a}"];
    }

    subgraph cluster_dyn {
        label="dyn-entry.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        dyn [label="dyn-entry.js", fillcolor="${#fff0e0|#4a2a0a}"];
    }

    subgraph cluster_common {
        label="common-execution.js 代码块";
        labeljust="l";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#0366d6|#58a6ff}";

        execution [label="execution.js", fillcolor="${#dbeafe|#1e3a5f}"];
    }

    entry -> setup [label="import"];
    entry -> execution [label="import"];
    entry -> dyn [label="import()", style=dashed];
    dyn -> execution [label="import"];
}
```

这个示例揭示了问题：打包前代码输出 `hello, world`，打包后却输出 `undefined`。目前没有简单方法解决此问题，其他输出 ESM 的打包器也面临同样情况。

::: info 其他打包器的相关 issue

- [evanw/esbuild#399](https://github.com/evanw/esbuild/issues/399)
- [rollup/rollup#4539](https://github.com/rollup/rollup/issues/4539)

:::

关于如何解决此问题，已经有一些讨论。一种方式是在原始顺序会被破坏时，把模块移入额外的公共代码块，但这会使输出过于碎片化。Rolldown 改为提供 [`strictExecutionOrder`](https://rolldown.rs/reference/OutputOptions.strictExecutionOrder)：它会包装 ESM 模块主体，使其在保持 ESM 输出的同时按源代码顺序运行。当被包装的入口与其他代码共享实现代码块时，严格模式会生成一个小型入口门面，在正确时机触发实现，因此输出代码块的形态可能改变。默认情况下，严格模式会包装所有符合条件的模块；实验性的 `onDemandWrapping` 模式则根据预测的代码块执行风险，推导出一组保守的模块子集。
