# 构建报告

使用 `devtools: { mode: 'report' }` 时，Rolldown 会写出构建报告：一个文件夹，其中包含每次构建的小型 Markdown 和 JSON 文件。报告展示构建如何分配时间、输出中包含什么，以及相较上一次构建的变化。你可以将该文件夹交给编码智能体、自己阅读，或在脚本中使用其中的数据。

::: warning 实验性
`devtools` 选项是实验性的。报告格式在后续版本中可能不同。该报告需要 Rolldown 1.3.0 或更高版本。
:::

## 为什么需要报告

默认的 `'full'` 模式会将每次构建事件写入日志，其中包含每个模块的源代码文本，以供 Vite DevTools 等可视化工具使用。编码智能体不需要可视化视图。如果只有这份日志，智能体必须编写脚本，从这个在大型应用中可能达到数 GB 的文件里提取数据。这会消耗 token 和上下文窗口空间。

我们为编码智能体设计了报告。Rolldown 会计算插件耗时、构建变化和保留大小等数据。智能体读取结果。智能体从 `entry.md`（下方构建中为 1.6 KB）开始，只在需要时打开其他文件。用户和脚本也可以使用该报告。

下表展示了基准测试仓库中 [`apps/10000`](https://github.com/rolldown/benchmarks/tree/main/apps/10000) 的一次构建：

| `devtools`       | 写入的数据 | 构建时间 |
| ---------------- | ---------- | -------- |
| 关闭             | 无         | 1.18 s   |
| `mode: 'report'` | 4.5 MB     | 1.59 s   |
| `mode: 'full'`   | 185 MB     | 1.59 s   |

构建时间是 Apple M3 Max 上 5 次构建的中位数，包含 Node.js 启动时间。两种模式收集相同的事件，因此都会让构建变慢。只在调查某次构建时开启报告。

4.5 MB 中大部分是 `module-graph.json`。智能体和脚本会查询此文件，而不会完整读取它。所有 Markdown 文件合计 14 KB，因为大多数列表只保留前 20 项。

## 用法 {#usage}

::: code-group

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  devtools: { mode: 'report' },
});
```

```js [vite.config.js]
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      devtools: { mode: 'report' },
    },
  },
});
```

```sh [CLI]
$ rolldown src/main.js -d dist --devtools.mode report
```

:::

Vite 8 使用 Rolldown。要查看项目使用的 Rolldown 版本，请运行 `npm ls rolldown`。

## 报告写入位置

Rolldown 会根据 [`cwd`](/reference/InputOptions.cwd) 将报告写入 `node_modules/.rolldown/report/<output dir>/`。`<output dir>` 是相对于 `cwd` 的输出文件夹（`output.dir`、`output.file` 所在文件夹或 `dist`）。其中每个 `..` 都会变成 `__`：

| 输出文件夹 | 报告文件夹                              |
| ---------- | --------------------------------------- |
| `dist`     | `node_modules/.rolldown/report/dist/`   |
| `../out`   | `node_modules/.rolldown/report/__/out/` |

每个输出文件夹保留各自的报告。

Rolldown 在 bundle 关闭时写入报告。`build()`、CLI 和 `vite build` 都会关闭 bundle。使用 [`rolldown()`](/reference/Function.rolldown) API 时，请调用 `bundle.close()`：

```js
import { rolldown } from 'rolldown';

const bundle = await rolldown({
  input: 'src/main.js',
  devtools: { mode: 'report' },
});
await bundle.write({ dir: 'dist' });
await bundle.close(); // Rolldown writes the report here
```

## 阅读报告

此示例为 `apps/10000` 添加了一个插件。该插件只处理 `.css` 文件，但没有[钩子过滤器](/apis/plugin-api/hook-filters)，因此 Rolldown 会为每个模块运行它。

```js [rolldown.config.js]
export default defineConfig({
  // ... the config of the app
  devtools: { mode: 'report' },
  plugins: [
    {
      name: 'my-css-plugin',
      transform(code, id) {
        if (!id.endsWith('.css')) return;
        // ... transform CSS
      },
    },
  ],
});
```

### 从 `entry.md` 开始

摘要会显示主要数据以及接下来应打开的文件：

```text [entry.md]
Build 843.6 ms · output 1.8 MB · 20014 modules (10002 external) / 1 chunk / 1 asset / 4 packages · browser / es · build #1

9 plugin hooks did no work in any call — a hook filter would skip those calls (`timing.md`, "Hooks that did no work")
```

### 在 `timing.md` 中查找原因

以下是钩子表格的前几行：

| 插件                  | 钩子      | 调用次数 | 空操作       | 时间     |
| --------------------- | --------- | -------- | ------------ | -------- |
| `my-css-plugin`       | transform | 10012    | 10012 (100%) | 307.99 s |
| `builtin:data-url`    | resolveId | 50013    | 50013 (100%) | 812.4 ms |
| `builtin:oxc-runtime` | resolveId | 50013    | 50013 (100%) | 763.7 ms |

`my-css-plugin` 在其 10012 次调用中都没有做任何工作，因此这是需要修复的钩子。有两点很重要：

- 307.99 秒远大于 843.6 毫秒的构建时间。该列是所有调用的总和。每次调用还包含等待 JavaScript 线程的时间。不要将此列理解为构建时间。
- `builtin:*` 钩子在 Rust 中运行，因此它们的空操作调用开销很小。

### 在 `delta.md` 中检查结果

添加过滤器，然后再次运行构建。过滤器为什么有帮助，请参阅[为什么需要插件钩子过滤器？](/in-depth/why-plugin-hook-filter)。

```js
transform: {
  filter: { id: /\.css$/ },
  handler(code, id) {
    // ... transform CSS
  },
},
```

`delta.md` 会将本次构建与上一次构建进行比较：

| 指标                      | 上一次   | 当前     | Δ         | Δ%     |
| ------------------------- | -------- | -------- | --------- | ------ |
| `build.scan_ms`           | 452.5 ms | 427.9 ms | -24.5 ms  | -5.4%  |
| `build.total_ms`          | 843.6 ms | 810.6 ms | -33.0 ms  | -3.9%  |
| `plugins.hook_call_count` | 190086   | 180074   | -10012    | -5.3%  |
| `plugins.hook_time_ms`    | 310.71 s | 2.64 s   | -308.07 s | -99.2% |

衡量变化时请使用 `build.total_ms`，而不是 `plugins.hook_time_ms`。钩子时间下降了 99%，但大部分时间都花在等待钩子上。

一对构建之间也会有噪声。在这些构建的 5 对结果中，降幅从 3.9% 到 6.7% 不等。要测试某项改动，请[固定一个基线](#compare-builds)，然后运行不止一次构建。

## Rolldown 如何写入报告

构建运行时，Rolldown 会在内存中将事件转换为计数、大小、图和耗时数据。它不会保留模块的源代码文本。bundle 关闭时，Rolldown 写入这些文件。

```dot
digraph {
    bgcolor="transparent";
    rankdir=LR;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    build [label="Build\nscan, generate", fillcolor="${#fff0e0|#4a2a0a}"];
    memory [label="Memory\ncounts, sizes,\ngraphs, timings", fillcolor="${#dbeafe|#1e3a5f}"];
    folder [label="Report folder\nentry.md, metrics.json,\n.state.json, ...", fillcolor="${#dcfce7|#14532d}"];
    next [label="Next build", fillcolor="${#fff0e0|#4a2a0a}"];

    build -> memory [label="events"];
    memory -> folder [label="bundle closes"];
    folder -> next [label="compare with\n.state.json", style=dashed];
}
```

- `metrics.json` 包含各项数字，Markdown 文件展示其中的一部分。
- `module-graph.json` 和 `chunk-graph.json` 包含完整图数据，这些数据太大，不适合放入 Markdown 列表。
- `.state.json` 包含本次构建的数据。Rolldown 会将下一次构建与此文件比较，以生成 `delta.md`。

## 文件 {#files}

从 `entry.md` 开始。它概述构建情况，并告诉你接下来打开哪个文件。

| 文件                | 内容                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `entry.md`          | 构建时间、输出大小、模块数、代码块数和包数量，以及相较上一次构建的变化。                                                                |
| `timing.md`         | 扫描和生成时间、每个钩子的插件耗时、没有做任何工作的钩子，以及插件 `transform` 钩子中最慢的模块。                                       |
| `chunks.md`         | 最大的代码块、每个代码块存在的原因，以及存在于多个代码块中的模块。                                                                      |
| `modules.md`        | 导入类型、被导入次数最多的模块，以及多个入口共享的模块。                                                                                |
| `packages.md`       | 最大的包、直接依赖和传递依赖，以及存在多个版本的包。                                                                                    |
| `graph.md`          | 入口点、代码块导入图、每个入口的初始加载，以及保留大小。                                                                                |
| `delta.md`          | 相较上一次构建和固定基线的变化。Rolldown 从第二次构建开始写入此文件。                                                                   |
| `metrics.json`      | 本次构建的数字，具有稳定的指标 id，例如 `output.total_bytes` 和 `build.total_ms`。可在脚本中使用此文件。                                |
| `module-graph.json` | 完整的模块图：每个模块及其大小、导入和保留大小。                                                                                        |
| `chunk-graph.json`  | 每个输出代码块及其文件名、大小、入口标志和导入。                                                                                        |
| `history.jsonl`     | 每次构建一行摘要。                                                                                                                      |
| `AGENTS.md`         | 给读取该文件夹的编码智能体的说明。                                                                                                      |
| `.state.json`       | 本次构建的数字。Rolldown 会将下一次构建与此文件比较。                                                                                   |

## 如何阅读这些数字

- `build.total_ms` 包含扫描和生成阶段。它比 CLI 显示的时间更短。
- 在报告中，1 kB 等于 1024 字节。在 CLI 中，1 kB 等于 1000 字节。因此对于报告中显示为 `265.1 kB` 的代码块，CLI 可能显示为 `271.50 kB`。
- Rolldown 在 `generateBundle` 钩子之前、压缩之前测量代码块和资源的大小。这些大小不包含 sourcemap 文件，也不包含 `generateBundle` 或 `writeBundle` 钩子新增或编辑的文件。
- 模块和包大小包含经过摇树优化后渲染出的模块代码，且是在 `renderChunk` 钩子和代码块压缩之前的大小。如果一个模块存在于多个代码块中，其大小会包含每个副本。
- 入口的初始加载包含其自身代码块，以及它直接或通过其他代码块静态导入的所有代码块。
- 直接依赖包是指由 `cwd` 下、`node_modules` 之外的模块导入的包。其他所有包都是传递依赖包。Rolldown 使用导入图来判断，而不是 `package.json` 中的依赖字段。
- 大多数列表只保留前 20 项。`module-graph.json` 包含所有模块，`chunk-graph.json` 包含所有代码块。
- 插件耗时包含 `resolveId`、`load`、`transform` 和 `renderChunk`。每项耗时是同时运行的调用之和，因此可能远大于构建时间。`timing.md` 中的 `Transform hotspots` 表不包含 Rolldown 核心中的 TypeScript 和 JSX 转换。
- 空操作调用是指没有做任何工作的钩子调用：`resolveId`、`load` 或 `renderChunk` 没有返回任何内容，或者 `transform` 没有返回任何内容或返回了相同代码。对于 JavaScript 插件，每次空操作调用仍然会从 Rust 跨越到 JavaScript。[钩子过滤器](/apis/plugin-api/hook-filters)会跳过该调用，报告也不会包含它。内置插件（`builtin:*`）在 Rust 中运行，因此其空操作调用开销很小。

### 保留大小 {#retained-size}

模块的保留大小是指该模块的大小，加上只由它引入的模块的大小。它估算的是：如果将对该模块的所有急切导入都替换为 `import()`，可以从静态初始加载中移除多少渲染后的模块字节。Rolldown 会在所有用户定义的入口范围内计算该值。它不预测压缩后的下载节省量或加载时间。

在此示例中，`a.js` 和 `b.js` 都导入 `shared.js`，且只有 `a.js` 导入 `heavy.js`：

```dot
digraph {
    bgcolor="transparent";
    rankdir=TB;
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    main [label="main.js", fillcolor="${#fff0e0|#4a2a0a}"];
    b [label="b.js\n5.0 kB", fillcolor="${#dbeafe|#1e3a5f}"];
    shared [label="shared.js\n50.0 kB", fillcolor="${#dbeafe|#1e3a5f}"];

    subgraph cluster_retained {
        label="Retained by a.js: 210.1 kB";
        labeljust="l";
        labelloc="b";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        a [label="a.js\n10.0 kB", fillcolor="${#dcfce7|#14532d}"];
        heavy [label="heavy.js\n200.0 kB", fillcolor="${#dcfce7|#14532d}"];
    }

    main -> a;
    main -> b;
    a -> heavy;
    a -> shared;
    b -> shared;
}
```

`graph.md` 显示结果：

| 模块            | 自身     | 保留         | 模块数 | 经由          |
| --------------- | -------- | ------------ | ------ | ------------- |
| `src/a.js`      | 10.0 kB  | **210.1 kB** | 2      | `src/main.js` |
| `src/heavy.js`  | 200.0 kB | **200.0 kB** | 1      | `src/a.js`    |
| `src/shared.js` | 50.0 kB  | **50.0 kB**  | 1      | `src/main.js` |
| `src/b.js`      | 5.0 kB   | **5.0 kB**   | 1      | `src/main.js` |

`a.js` 的保留大小不包含 `shared.js`，因为 `b.js` 也导入了它。`via` 是通往该模块的每条导入路径都会经过的最后一个模块。

要验证这个数字，请将 `main.js` 中对 `a.js` 的导入替换为 `import()`。随后 `delta.md` 中的 `Per-entry initial load` 表会显示降幅：

| 入口          | 上一次   | 当前    | Δ         | Δ%     |
| ------------- | -------- | ------- | --------- | ------ |
| `src/main.js` | 265.1 kB | 55.2 kB | -210.0 kB | -79.2% |

请读取此表，而不是 `output.max_initial_load_bytes`。该指标使用最大的入口，而 `src/a.js` 现在是一个初始加载为 265.3 kB 的入口。要一次性计算多个模块的降幅，请使用 [perf-kit 命令](/in-depth/perf-kit#find-code-that-can-load-later)。

## 比较构建 {#compare-builds}

Rolldown 会将每次构建与同一输出文件夹的上一次构建进行比较。要与某个特定构建比较，请将该构建固定为基线：

```sh
$ cd node_modules/.rolldown/report/dist
$ cp .state.json baseline.json
```

随后 Rolldown 还会在 `delta.md` 和 `metrics.json`（`baselineDelta`）中将之后每次构建与基线比较。要取消固定基线，请删除 `baseline.json`。

## 在脚本中使用这些数字

`metrics.json` 包含一个扁平的 `metrics` 映射，其中的 id 保持稳定。id 会给出单位：`_ms` 表示毫秒，`_bytes` 表示字节，没有后缀表示计数。报告文件夹中的 `AGENTS.md` 列出了所有 id。

```sh
$ cd node_modules/.rolldown/report/dist

# Read one number
$ jq '.metrics["output.total_bytes"]' metrics.json
1887396

# Fail a CI step when the output is too large (`-e` exits with 1 on false)
$ jq -e '.metrics["output.total_bytes"] < 2000000' metrics.json
true

# Show the JavaScript plugin hooks in the top no-op hooks
$ jq -r '.noopHooks[] | select(.plugin | startswith("builtin:") | not) | "\(.plugin) \(.hook) \(.noopCalls)/\(.calls)"' metrics.json
my-css-plugin transform 10012/10012
```

其他 JSON 数据包含以下字段：

| 数据                                                | 字段                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `delta.metrics` 和 `baselineDelta.metrics`，按 id   | `prev`、`curr`、`delta`、`pct`                                                                                                                  |
| `module-graph.json` 中的 `modules`                  | `id`、`bytes`、`retainedBytes`、`retainedModuleCount`、`idom`、`staticReachable`、`dynamicOnly`、`imports`（每项为 `[targetIndex, isDynamic]`） |
| `chunk-graph.json` 中的 `chunks`                    | `fileName`、`name`、`bytes`、`isEntry`、`facadeModuleId`、`imports`、`dynamicImports`                                                           |

## 限制

- [`watch()`](/reference/Function.watch)、`rolldown --watch` 和开发引擎（`experimental.devMode`）不会写入报告。
- 一次构建会写入报告或 devtools 日志（`mode: 'full'`，默认值），不会同时写入两者。
- 报告位于 `node_modules` 内，因此干净安装会删除它，以及固定的基线。
- 一个 bundle 写一份报告：当一个 bundle 写入多个输出时，第一个输出决定文件夹，而报告描述的是最后一个输出。

## 相关工具

- 默认的 `'full'` 模式会写入完整的 devtools 事件日志。当你需要在 `@rolldown/debug` 或 Vite DevTools 中查看每个事件时，请使用该模式。
- [`bundleAnalyzerPlugin`](/builtin-plugins/bundle-analyzer) 会将一份包含代码块和模块的分析文件写入输出文件夹。报告则增加构建和插件耗时、包数据以及构建之间的变化。Rolldown 会将报告写在输出文件夹之外。
- [`@rolldown/perf-kit`](/in-depth/perf-kit) 为编码智能体测量页面加载、服务器启动和 Cloudflare Worker 启动时间，帮助应用更快启动。它会读取 `module-graph.json` 来[查找可以延迟加载的代码](/in-depth/perf-kit#find-code-that-can-load-later)，并读取 `chunk-graph.json` 来[查找启动较晚的代码块](/in-depth/perf-kit#configure-the-build)。
