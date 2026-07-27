# Rolldown 中的顶层 await（TLA）

背景知识：

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#top_level_await
- https://github.com/tc39/proposal-top-level-await

## Rolldown 如何处理 TLA

现阶段，Rolldown 支持 TLA 的原则是：确保代码在打包后能够运行，但不保证百分之百保留原始代码的语义。

目前的规则如下：

- 如果输入包含 TLA，只能以 `esm` 格式打包和输出。
- 禁止通过 `require` 加载包含 TLA 的模块。

## 从并发变为顺序执行

Rolldown 中 TLA 的一个缺点是，它会将原始代码的并发行为改为顺序执行。虽然仍能保证相对顺序，但确实会降低执行速度；如果原始代码依赖并发行为，甚至可能导致程序无法正常运行。

```dot
digraph {
    bgcolor="transparent";
    rankdir=LR;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    compound=true;

    subgraph cluster_before {
        label="打包前（并发）";
        labeljust="l";
        fontname="Arial";
        fontsize=12;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#22863a|#3fb950}";

        b_main [label="main.js\nimport tla1, tla2", fillcolor="${#fff0e0|#4a2a0a}"];
        b_all [label="Promise.all([\n  tla1,\n  tla2\n])", fillcolor="${#dcfce7|#14532d}"];
        b_tla1 [label="tla1.js\nawait ...", fillcolor="${#dbeafe|#1e3a5f}"];
        b_tla2 [label="tla2.js\nawait ...", fillcolor="${#dbeafe|#1e3a5f}"];
        b_done [label="二者均已完成", fillcolor="${#dcfce7|#14532d}"];

        b_main -> b_all;
        b_all -> b_tla1;
        b_all -> b_tla2;
        b_tla1 -> b_done;
        b_tla2 -> b_done;
    }

    subgraph cluster_after {
        label="打包后（顺序）";
        labeljust="l";
        fontname="Arial";
        fontsize=12;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        a_tla1 [label="await tla1", fillcolor="${#dbeafe|#1e3a5f}"];
        a_tla2 [label="await tla2", fillcolor="${#dbeafe|#1e3a5f}"];
        a_main [label="console.log(\n  foo1, foo2\n)", fillcolor="${#fff0e0|#4a2a0a}"];

        a_tla1 -> a_tla2 [label="然后"];
        a_tla2 -> a_main [label="然后"];
    }
}
```

下面是一个实际示例：

```js
// main.js
import { bar } from './sync.js';
import { foo1 } from './tla1.js';
import { foo2 } from './tla2.js';
console.log(foo1, foo2, bar);

// tla1.js

export const foo1 = await Promise.resolve('foo1');

// tla2.js

export const foo2 = await Promise.resolve('foo2');

// sync.js

export const bar = 'bar';
```

打包后会得到：

```js
// tla1.js
const foo1 = await Promise.resolve('foo1');

// tla2.js
const foo2 = await Promise.resolve('foo2');

// sync.js
const bar = 'bar';

// main.js
console.log(foo1, foo2, bar);
```

可以看到，在打包后的代码中，Promise `foo1` 和 `foo2` 会依次完成；而在原始代码中，它们是并发执行的。

TLA 规范仓库中有一个非常[清晰的示例](https://github.com/tc39/proposal-top-level-await?tab=readme-ov-file#semantics-as-desugaring)，用于解释 TLA 的工作心智模型：

```js
import { a } from './a.mjs';
import { b } from './b.mjs';
import { c } from './c.mjs';

console.log(a, b, c);
```

可以把它理解为经过语法脱糖后的以下代码：

```js
import { a, promise as aPromise } from './a.mjs';
import { b, promise as bPromise } from './b.mjs';
import { c, promise as cPromise } from './c.mjs';

export const promise = Promise.all([aPromise, bPromise, cPromise]).then(() => {
  console.log(a, b, c);
});
```

但在 Rolldown 中，打包后的效果类似于：

```js
import { a, promise as aPromise } from './a.mjs';
import { b, promise as bPromise } from './b.mjs';
import { c, promise as cPromise } from './c.mjs';

await aPromise;
await bPromise;
await cPromise;

console.log(a, b, c);
```
