# 为什么需要插件钩子过滤器？

## 问题所在

尽管 Rolldown 核心使用 Rust 编写并具备并行处理能力，**添加 JavaScript 插件仍可能显著拖慢构建**。原因是每个插件钩子都会针对_每个_模块调用，即使该插件并不关心其中绝大多数模块。

例如，一个只转换 `.css` 文件的 CSS 插件，仍会针对项目中的每个 `.js`、`.ts`、`.jsx` 和其他文件被调用。使用 10 个插件时，这些开销会不断叠加，使构建时间增加 **3～4 倍**。

插件钩子过滤器让 Rolldown 在 Rust 层跳过不必要的插件调用，从而解决这一问题。即使使用大量插件，也能保持快速构建。

## 实际影响

下面通过 [apps/10000](https://github.com/rolldown/benchmarks/tree/main/apps/10000) 基准测试查看实际性能差异：
分支：https://github.com/rolldown/benchmarks/pull/3

```diff
diff --git a/apps/10000/rolldown.config.mjs b/apps/10000/rolldown.config.mjs
--- a/apps/10000/rolldown.config.mjs
+++ b/apps/10000/rolldown.config.mjs
@@ -1,8 +1,25 @@
 import { defineConfig } from "rolldown";
-import { minify } from "rollup-plugin-esbuild";
+// import { minify } from "rollup-plugin-esbuild";
 const sourceMap = !!process.env.SOURCE_MAP;
 const m = !!process.env.MINIFY;
+const transformPluginCount = process.env.PLUGIN_COUNT || 0;

+let transformCssPlugin = Array.from({ length: transformPluginCount }, (_, i) => {
+  let index = i + 1;
+  return {
+    name: `transform-css-${index}`,
+    transform(code, id) {
+      if (id.endsWith(`foo${index}.css`)) {
+        return {
+          code: `.index-${index} {
+  color: red;
+}`,
+          map: null,
+        };
+      }
+    }
+  }
+})
 export default defineConfig({
 	input: {
 		main: "./src/index.jsx",
@@ -11,13 +28,7 @@ export default defineConfig({
 		"process.env.NODE_ENV": JSON.stringify("production"),
 	},
 	plugins: [
-		m
-			? minify({
-					minify: true,
-					legalComments: "none",
-					target: "es2022",
-				})
-			: null,
+    ...transformCssPlugin,
 	].filter(Boolean),
 	profilerNames: !m,
 	output: {
diff --git a/apps/10000/src/index.css b/apps/10000/src/index.css
deleted file mode 100644
diff --git a/apps/10000/src/index.jsx b/apps/10000/src/index.jsx
--- a/apps/10000/src/index.jsx
+++ b/apps/10000/src/index.jsx
@@ -1,7 +1,16 @@
 import React from "react";
 import ReactDom from "react-dom/client";
 import App1 from "./f0";
-import './index.css'
+import './foo1.css'
+import './foo2.css'
+import './foo3.css'
+import './foo4.css'
+import './foo5.css'
+import './foo6.css'
+import './foo7.css'
+import './foo8.css'
+import './foo9.css'
+import './foo10.css'

 ReactDom.createRoot(document.getElementById("root")).render(
 	<React.StrictMode>
```

**测试设置：**

- 10 个 CSS 文件（`foo1.css` 到 `foo10.css`）。
- 每个插件只转换一个特定 CSS 文件（例如，插件 1 只关心 `foo1.css`）。
- 通过 `PLUGIN_COUNT` 控制插件数量。
- 插件采用标准模式：检查文件是否匹配，不匹配则提前返回。

### 不使用过滤器（传统方式）

```bash
Benchmark 1: PLUGIN_COUNT=0 node --run build:rolldown
  Time (mean ± σ):     745.6 ms ±  11.8 ms    [User: 2298.0 ms, System: 1161.3 ms]
  Range (min … max):   732.1 ms … 753.6 ms    3 runs

Benchmark 2: PLUGIN_COUNT=1 node --run build:rolldown
  Time (mean ± σ):     862.6 ms ±  61.3 ms    [User: 2714.1 ms, System: 1192.6 ms]
  Range (min … max):   808.3 ms … 929.2 ms    3 runs

Benchmark 3: PLUGIN_COUNT=2 node --run build:rolldown
  Time (mean ± σ):      1.106 s ±  0.020 s    [User: 3.287 s, System: 1.382 s]
  Range (min … max):    1.091 s …  1.130 s    3 runs

Benchmark 4: PLUGIN_COUNT=5 node --run build:rolldown
  Time (mean ± σ):      1.848 s ±  0.022 s    [User: 4.398 s, System: 1.728 s]
  Range (min … max):    1.825 s …  1.869 s    3 runs

Benchmark 5: PLUGIN_COUNT=10 node --run build:rolldown
  Time (mean ± σ):      2.792 s ±  0.065 s    [User: 6.013 s, System: 2.198 s]
  Range (min … max):    2.722 s … 2.850 s    3 runs

Summary
 'PLUGIN_COUNT=0 node --run build:rolldown' ran
    1.16 ± 0.08 times faster than 'PLUGIN_COUNT=1 node --run build:rolldown'
    1.48 ± 0.04 times faster than 'PLUGIN_COUNT=2 node --run build:rolldown'
    2.48 ± 0.05 times faster than 'PLUGIN_COUNT=5 node --run build:rolldown'
    3.74 ± 0.10 times faster than 'PLUGIN_COUNT=10 node --run build:rolldown'
```

**关键结论：**构建时间随插件数量线性增长，使用 10 个插件会**慢 3.74 倍**（2.8 秒对 745 毫秒）。

## 解决方案：插件钩子过滤器

不要针对每个模块调用每个插件，而是使用 `filter` 告诉 Rolldown 各插件关心哪些文件。具体方式如下：

```diff
diff --git a/apps/10000/rolldown.config.mjs b/apps/10000/rolldown.config.mjs
index 822af995..dee07e68 100644
--- a/apps/10000/rolldown.config.mjs
+++ b/apps/10000/rolldown.config.mjs
@@ -8,14 +8,21 @@ let transformCssPlugin = Array.from({ length: transformPluginCount }, (_, i) =>
   let index = i + 1;
   return {
     name: `transform-css-${index}`,
-    transform(code, id) {
-      if (id.endsWith(`foo${index}.css`)) {
-        return {
-          code: `.index-${index} {
+    transform: {
+      filter: {
+        id: {
+          include: new RegExp(`foo${index}.css$`),
+        }
+      },
+      handler(code, id) {
+        if (id.endsWith(`foo${index}.css`)) {
+          return {
+            code: `.index-${index} {
   color: red;
 }`,
-          map: null,
-        };
+            map: null,
+          };
+        }
       }
     }
   }
```

**变更内容：**

- 将 `transform` 函数包装在带 `handler` 和 `filter` 属性的对象中。
- 添加 `filter.id.include`，使用正则表达式只匹配插件关心的文件。
- Rolldown 现在会在调用 JavaScript _之前_，先在 Rust 中检查过滤器。

### 使用过滤器（优化后）

```bash
Benchmark 1: PLUGIN_COUNT=0 node --run build:rolldown
  Time (mean ± σ):     739.1 ms ±   6.8 ms    [User: 2312.5 ms, System: 1153.0 ms]
  Range (min … max):   733.0 ms … 746.5 ms    3 runs

Benchmark 2: PLUGIN_COUNT=1 node --run build:rolldown
  Time (mean ± σ):     760.6 ms ±  18.3 ms    [User: 2422.1 ms, System: 1107.4 ms]
  Range (min … max):   739.7 ms … 773.6 ms    3 runs

Benchmark 3: PLUGIN_COUNT=2 node --run build:rolldown
  Time (mean ± σ):     731.2 ms ±  11.1 ms    [User: 2461.3 ms, System: 1141.4 ms]
  Range (min … max):   723.9 ms … 744.0 ms    3 runs

Benchmark 4: PLUGIN_COUNT=5 node --run build:rolldown
  Time (mean ± σ):     741.5 ms ±   9.3 ms    [User: 2621.6 ms, System: 1111.3 ms]
  Range (min … max):   734.0 ms … 751.9 ms    3 runs

Benchmark 5: PLUGIN_COUNT=10 node --run build:rolldown
  Time (mean ± σ):     747.3 ms ±   2.1 ms    [User: 2900.9 ms, System: 1120.0 ms]
  Range (min … max):   745.0 ms … 749.2 ms    3 runs

Summary
  'PLUGIN_COUNT=2 node --run build:rolldown' ran
    1.01 ± 0.02 times faster than 'PLUGIN_COUNT=0 node --run build:rolldown'
    1.01 ± 0.02 times faster than 'PLUGIN_COUNT=5 node --run build:rolldown'
    1.02 ± 0.02 times faster than 'PLUGIN_COUNT=10 node --run build:rolldown'
    1.04 ± 0.03 times faster than 'PLUGIN_COUNT=1 node --run build:rolldown'
```

**关键结论：**使用过滤器后，无论插件数量多少，性能几乎相同（约 740 毫秒），相关开销已被**消除**。

### 性能对比

| 插件数量     | 不使用过滤器   | 使用过滤器 | 加速倍数  |
| ------------ | -------------- | ----------- | --------- |
| 0 个插件     | 745ms          | 739ms       | 1.0x      |
| 1 个插件     | 863ms          | 761ms       | 1.13x     |
| 2 个插件     | 1,106ms        | 731ms       | 1.51x     |
| 5 个插件     | 1,848ms        | 742ms       | 2.49x     |
| 10 个插件    | 2,792ms        | 747ms       | **3.74x** |

**结论：**如果插件只关心特定文件，请使用过滤器。这样无论添加多少插件，都能保持较快的构建速度。

## 底层工作原理

要理解过滤器为何如此有效，首先需要了解 Rolldown 如何使用 JavaScript 插件处理模块。

Rolldown 使用并行处理（类似[生产者-消费者问题](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem)）高效构建模块图。以下是一个简单的依赖图：

**依赖图**

```dot [Dependency Graph]
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    a [label="a.js", fillcolor="${#fff0e0|#4a2a0a}"];
    b [label="b.js", fillcolor="${#dbeafe|#1e3a5f}"];
    c [label="c.js", fillcolor="${#dbeafe|#1e3a5f}"];
    d [label="d.js", fillcolor="${#dbeafe|#1e3a5f}"];
    e [label="e.js", fillcolor="${#dbeafe|#1e3a5f}"];
    f [label="f.js", fillcolor="${#dbeafe|#1e3a5f}"];

    a -> b;
    a -> c;
    b -> d;
    b -> e;
    c -> f;
}
```

### 不使用 JavaScript 插件

![不使用 JavaScript 插件进行打包](https://github.com/user-attachments/assets/ad071cf9-6a34-4a7d-a669-02efec342d45)

所有工作都在 Rust 中并行运行。多个 CPU 核心同时处理模块，使吞吐量最大化。

> [!NOTE]
> 这些图展示的是概念算法，而不是准确的实现细节。为便于理解，部分时间片被刻意放大；`fetch_module` 实际以微秒级速度运行。

### 使用 JavaScript 插件（无过滤器）

![使用 JavaScript 插件进行打包](https://github.com/user-attachments/assets/7e95fb60-d345-4d23-a35e-c7d062fa2b70)

瓶颈在于：**JavaScript 插件在单线程中运行**。尽管 Rolldown 的 Rust 核心可以并行处理，每个模块仍必须：

1. 在“菱形”处停止（钩子调用阶段）。
2. 跨越 FFI 边界，从 Rust 进入 JavaScript。
3. 等待_所有_插件依次运行。
4. 再从 JavaScript 返回 Rust。

这个串行点会成为主要瓶颈。可以看到，随着插件增加，菱形区域越来越宽，而 CPU 核心只能空闲等待 JavaScript。

### 使用过滤器（优化后）

添加过滤器后，Rolldown 会在进入 JavaScript 前**在 Rust 中**判断过滤器：

```
对于每个模块：
  对于每个插件：
    ✓ 在 Rust 中检查过滤器（微秒级）
    ✗ 不匹配则跳过
    → 只为匹配的插件调用 JavaScript
```

这消除了大部分 FFI 开销和 JavaScript 执行时间。在基准测试中，大多数插件并不匹配大多数文件，因此几乎所有调用都被跳过。菱形区域重新缩小，CPU 利用率保持较高水平，构建速度也得以维持。

## 何时使用过滤器

**在以下情况下使用过滤器：**

- 插件只处理特定文件类型（例如 `.css`、`.svg`、`.md`）。
- 插件只针对特定目录（例如 `src/**`、`node_modules/**`）。
- 构建中包含多个插件。
- 关注构建性能。

## 快速参考

```js
// ❌ 不使用过滤器：针对每个模块调用
export default {
  name: 'my-plugin',
  transform(code, id) {
    if (!id.endsWith('.css')) return;
    // ……转换 CSS
  },
};

// ✅ 使用过滤器：只针对 CSS 文件调用
export default {
  name: 'my-plugin',
  transform: {
    filter: {
      id: { include: /\.css$/ },
    },
    handler(code, id) {
      // ……转换 CSS
    },
  },
};
```

完整的过滤器 API 和选项请参阅[插件钩子过滤器用法](/apis/plugin-api/hook-filters)。
