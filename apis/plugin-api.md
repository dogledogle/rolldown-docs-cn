# 插件 API

## 概览

Rolldown 的插件接口几乎完全兼容 Rollup（详细进度见 [此处](https://github.com/rolldown/rolldown/issues/819)）。因此，如果以前编写过 Rollup 插件，你已经知道如何编写 Rolldown 插件了！

Rolldown 插件是满足下文 [插件接口](#插件接口) 的对象。
插件应以包的形式分发。该包导出一个函数，函数接收插件专用选项，并返回这样的对象。

插件可以自定义 Rolldown 的行为，例如在打包前转译代码，或为不可用的内置模块提供垫片。

<!-- TODO: add a link to a guide on how to use plugins & how to find plugins -->

### 示例

以下示例展示了一个 Rolldown 插件，它会拦截对 `virtual:example` 的导入请求，并返回自定义内容。

::: code-group

```js [rolldown-plugin-example.js]
const id = 'virtual:example';
const resolvedId = '\0' + id;

export default function examplePlugin() {
  return {
    name: 'example-plugin', // 该名称会显示在日志和错误中
    resolveId(source) {
      if (source === id) {
        // 告诉 Rolldown，应将该导入解析为名为 `\0virtual:example` 的模块
        return resolvedId;
      }
      return null; // 其他 ID 按常规方式处理
    },
    load(id) {
      if (id === resolvedId) {
        // `\0virtual:example` 的源代码
        return `export default 'Hello from ${id}';`;
      }
      return null; // 其他 ID 按常规方式处理
    },
  };
}
```

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';
import examplePlugin from './rolldown-plugin-example.js';

export default defineConfig({
  plugins: [examplePlugin()],
});
```

:::

::: warning 钩子过滤器

为保持简单，该示例插件没有使用 [钩子过滤器](/apis/plugin-api/hook-filters)。
为提高性能，建议尽可能使用钩子过滤器。

:::

## 约定

- 插件应使用带 `rolldown-plugin-` 前缀的清晰名称。
- 在 `package.json` 的 `keywords` 字段中包含 `rolldown-plugin` 关键字。
- 如有需要，请确保插件输出正确的 source map。
- 如果插件使用 [虚拟模块](#virtual-modules)，请遵循 [虚拟模块约定](#virtual-modules)。
- （推荐）应为插件编写测试。
- （推荐）应使用英文编写插件文档。

<!-- TODO: add a guide how to test a plugin -->

### 虚拟模块约定 {#virtual-modules}

虚拟模块是一种实用机制，允许使用普通 ESM 导入语法向源文件传递构建时信息或辅助函数。虚拟模块并不存在于文件系统中，而是由插件解析并提供，如 [上面的示例](#示例) 所示。

注册这类插件后，便可通过面向用户的 ID 在 JavaScript 中导入虚拟模块：

```js
import msg from 'virtual:example';

console.log(msg);
```

按照约定，Rolldown 虚拟模块面向用户的路径以 `virtual:` 为前缀。应尽可能使用插件名作为命名空间，避免与生态中的其他插件冲突。例如，`rolldown-plugin-posts` 可以要求用户导入 `virtual:posts` 或 `virtual:posts/helpers` 虚拟模块来获取构建时信息。在内部，使用虚拟模块的插件解析 ID 时应为模块 ID 添加 `\0` 前缀，这是来自 Rollup 生态的约定。这样可以防止其他插件尝试处理该 ID（例如进行 Node.js 解析），source map 等核心功能也可以据此区分虚拟模块和普通文件。

请注意，直接派生自真实文件的模块无需遵循此约定，例如单文件组件（`.vue` 或 `.svelte` SFC）中的脚本模块。SFC 在处理时通常会生成一组子模块，但其中的代码可以映射回文件系统。为这些子模块使用 `\0` 会导致 source map 无法正常工作。

## 插件接口

[`Plugin`](https://rolldown.rs/reference/Interface.Plugin) 接口包含必需的 `name` 属性，以及多个可选属性和钩子。

钩子是定义在插件上的方法，用于与构建流程交互。它们会在构建的不同阶段被调用，可以影响构建的运行方式、提供构建信息，或在构建完成后修改结果。钩子分为以下类型：

- `async`：钩子也可以返回解析为相同类型值的 Promise；否则会标记为 `sync`。
- `first`：如果多个插件实现了该钩子，会依次运行，直到某个钩子返回非 `null` 或 `undefined` 的值。
- `sequential`：如果多个插件实现了该钩子，会按指定的插件顺序全部运行。如果钩子是 `async`，后续同类钩子会等待当前钩子完成。
- `parallel`：如果多个插件实现了该钩子，会按指定的插件顺序全部启动。如果钩子是 `async`，后续同类钩子会并行运行，不会等待当前钩子。

钩子也可以是带有 `handler` 属性的对象，而不是方法。此时 `handler` 属性才是真正的钩子方法。这样便可提供额外的可选属性来控制钩子行为。更多信息请参阅 [`ObjectHook`](https://rolldown.rs/reference/TypeAlias.ObjectHook) 类型。

钩子分为两类：[构建钩子](#构建钩子) 和 [输出生成钩子](#输出生成钩子)。

### 构建钩子

构建钩子在构建阶段运行，主要负责在 Rolldown 处理输入文件前定位、提供和转换这些文件。

构建阶段的第一个钩子是 [`options`](https://rolldown.rs/reference/Interface.Plugin#options)，最后一个始终是 [`buildEnd`](https://rolldown.rs/reference/Interface.Plugin#buildend)。如果发生构建错误，随后还会调用 [`closeBundle`](https://rolldown.rs/reference/Interface.Plugin#closebundle)。

```dot+hooks-graph
# styles
sequential: fillcolor="#ffe8cc", dark$fillcolor="#9d4f1a"
parallel: fillcolor="#ffcccc", dark$fillcolor="#8a2a2a"
first: fillcolor="#fff4cc", dark$fillcolor="#9d7a1a"
internal: fillcolor="#f0f0f0", dark$fillcolor="#3a3a3a"
sync: color="#3c3c43", dark$color="#dfdfd6"
async: color="#ff7e17", dark$color="#cc5f1a", penwidth=1

# nodes
watchChange(https://rolldown.rs/reference/Interface.Plugin#watchchange): parallel, async
closeWatcher(https://rolldown.rs/reference/Interface.Plugin#closewatcher): parallel, async
options(https://rolldown.rs/reference/Interface.Plugin#options): sequential, async
outputOptions(https://rolldown.rs/reference/Interface.Plugin#outputoptions): sequential, async
buildStart(https://rolldown.rs/reference/Interface.Plugin#buildstart): parallel, async
resolveId(https://rolldown.rs/reference/Interface.Plugin#resolveid): first, async
load(https://rolldown.rs/reference/Interface.Plugin#load): first, async
transform(https://rolldown.rs/reference/Interface.Plugin#transform): sequential, async
moduleParsed(https://rolldown.rs/reference/Interface.Plugin#moduleparsed): parallel, async
internalTransform: internal
resolveDynamicImport(https://rolldown.rs/reference/Interface.Plugin#resolvedynamicimport): first, async
buildEnd(https://rolldown.rs/reference/Interface.Plugin#buildend): parallel, async

# edges
options -> outputOptions
outputOptions -> buildStart
buildStart -> resolveId: each entry
resolveId .-> buildEnd: external
resolveId -> load: non-external
load -> transform
transform -> internalTransform
internalTransform -> moduleParsed
moduleParsed .-> buildEnd: no imports
moduleParsed -> resolveDynamicImport: each import()
resolveDynamicImport -> load: non-external
moduleParsed -> resolveId: each import
resolveDynamicImport .-> buildEnd: external
resolveDynamicImport -> resolveId: unresolved
```

请注意，上图中的 `internalTransform` 不是插件钩子，而是 Rolldown 将非 JS 代码转换为 JS 的步骤。

此外，在监听模式下，[`watchChange`](https://rolldown.rs/reference/Interface.Plugin#watchchange) 钩子可能随时触发，用于通知当前运行生成输出后将启动新一轮构建。监听器关闭时还会触发 [`closeWatcher`](https://rolldown.rs/reference/Interface.Plugin#closewatcher) 钩子。

::: warning 不支持的钩子

以下构建钩子受 Rollup 支持，但 Rolldown 尚不支持：

- `shouldTransformCachedModule` ([#4389](https://github.com/rolldown/rolldown/issues/4389))

:::

### 输出生成钩子

输出生成钩子可以提供已生成打包产物的信息，并在构建完成后修改结果。只使用输出生成钩子的插件也可以通过输出选项传入，从而仅针对特定输出运行。

输出生成阶段的第一个钩子是 [`renderStart`](https://rolldown.rs/reference/Interface.Plugin#renderstart)。如果通过 [`bundle.generate(...)`](https://rolldown.rs/reference/Interface.RolldownBuild#generate) 成功生成输出，最后一个钩子是 [`generateBundle`](https://rolldown.rs/reference/Interface.Plugin#generatebundle)；如果通过 [`bundle.write(...)`](https://rolldown.rs/reference/Interface.RolldownBuild#write) 成功生成输出，则是 [`writeBundle`](https://rolldown.rs/reference/Interface.Plugin#writebundle)；如果输出生成期间发生错误，则是 [`renderError`](https://rolldown.rs/reference/Interface.Plugin#rendererror)。

此外，[`closeBundle`](https://rolldown.rs/reference/Interface.Plugin#closebundle) 可以作为最后一个钩子被调用，但用户需要手动调用 [`bundle.close()`](https://rolldown.rs/reference/Interface.RolldownBuild#close) 才能触发。CLI 始终会确保执行此操作。

```dot+hooks-graph
# config
margin=150,0

# styles
sequential: fillcolor="#ffe8cc", dark$fillcolor="#9d4f1a"
parallel: fillcolor="#ffcccc", dark$fillcolor="#8a2a2a"
first: fillcolor="#fff4cc", dark$fillcolor="#9d7a1a"
internal: fillcolor="#f0f0f0", dark$fillcolor="#3a3a3a"
sync: color="#3c3c43", dark$color="#dfdfd6"
async: color="#ff7e17", dark$color="#cc5f1a", penwidth=1
!option: fillcolor="transparent"
!invisible: label="", shape=circle, fixedsize=true, width=0.2, height=0.2, style=filled, fillcolor="#ffffff"

# nodes
renderStart(https://rolldown.rs/reference/Interface.Plugin#renderstart): parallel, sync
resolveFileUrl(https://rolldown.rs/reference/Interface.Plugin#resolvefileurl): first, sync
banner(https://rolldown.rs/reference/Interface.Plugin#banner): sequential, sync
footer(https://rolldown.rs/reference/Interface.Plugin#footer): sequential, sync
intro(https://rolldown.rs/reference/Interface.Plugin#intro): sequential, sync
outro(https://rolldown.rs/reference/Interface.Plugin#outro): sequential, sync
renderChunk(https://rolldown.rs/reference/Interface.Plugin#renderchunk): sequential, sync
minify: internal
postBanner: option, sync
postFooter: option, sync
augmentChunkHash(https://rolldown.rs/reference/Interface.Plugin#augmentchunkhash): sequential, async
generateBundle(https://rolldown.rs/reference/Interface.Plugin#generatebundle): sequential, sync
writeBundle(https://rolldown.rs/reference/Interface.Plugin#writebundle): parallel, sync
renderError(https://rolldown.rs/reference/Interface.Plugin#rendererror): parallel, sync
closeBundle(https://rolldown.rs/reference/Interface.Plugin#closebundle): parallel, sync
beforeImportMeta: invisible
beforeAddons: invisible
afterAddons: invisible

# groups
generateChunks: beforeAddons, banner, footer, intro, outro, afterAddons

# edges
renderStart -> beforeImportMeta: each chunk
beforeImportMeta -> resolveFileUrl: each import.meta.ROLLDOWN_FILE_URL_*
resolveFileUrl -> beforeImportMeta
beforeImportMeta -> beforeAddons
augmentChunkHash -> generateBundle
generateBundle -> writeBundle
writeBundle .-> closeBundle
beforeAddons -> banner
beforeAddons -> footer
beforeAddons -> intro
beforeAddons -> outro
banner -> afterAddons
footer -> afterAddons
intro -> afterAddons
outro -> afterAddons
afterAddons .-> beforeImportMeta: next chunk, constraint=false
afterAddons -> renderChunk: each chunk
renderChunk -> minify
minify -> postBanner
minify -> postFooter
postBanner -> augmentChunkHash
postFooter -> augmentChunkHash
augmentChunkHash .-> renderChunk: next chunk, constraint=false
renderError .-> closeBundle
```

请注意，上图中的 `minify` 不是插件钩子，而是 Rolldown 运行压缩器的步骤。`postBanner` 和 `postFooter` 也不是插件钩子，它们是输出选项；与 `banner` 和 `footer` 不同，它们没有对应的钩子。

::: warning 不支持的钩子

以下输出生成钩子受 Rollup 支持，但 Rolldown 尚不支持：

- `resolveImportMeta` ([#1010](https://github.com/rolldown/rolldown/issues/1010))
- `renderDynamicImport` ([#4532](https://github.com/rolldown/rolldown/issues/4532))

:::

## 插件上下文

在大多数钩子中，可以通过 `this` 访问多种工具函数和信息。更多内容请参阅 [`PluginContext`](https://rolldown.rs/reference/Interface.PluginContext) 类型。

## 支持 TypeScript 和 JSX

为了获得最佳性能，Rolldown 会在调用 [`transform`](https://rolldown.rs/reference/Interface.Plugin#transform) 钩子后才运行内部转换，把 TypeScript 和 JSX 转换为 JavaScript。这意味着使用 `transform` 钩子的插件需要支持 TypeScript 和 JSX。基本上有两种实现方式。

### 处理 TypeScript 和 JSX 语法

向 [`this.parse`](https://rolldown.rs/reference/Interface.PluginContext#parse) 传递 `lang` 选项，即可解析 TypeScript 和 JSX，让插件轻松处理这两种语法。

### 预先转换 TypeScript 和 JSX

如果无法处理 TypeScript 和 JSX AST，仍可使用 `rolldown/utils` 导出的 `transform` 函数先将它们转换为 JavaScript。请注意，这会产生额外开销。

## 与 Rollup 的主要区别

虽然 Rolldown 的插件接口大体兼容 Rollup，但仍需注意一些重要的行为差异：

### 输出生成处理方式

在 Rollup 中，所有输出都在同一流程中一起生成；而 Rolldown 会分别处理每个输出。也就是说，如果存在多份输出配置，Rolldown 会独立处理每个输出。这可能影响某些插件的行为，尤其是在整个构建过程中维护状态的插件。

具体区别如下：

- 在 Rolldown 中，[`outputOptions`](https://rolldown.rs/reference/Interface.FunctionPluginHooks#outputoptions) 钩子在构建钩子**之前**调用，而 Rollup 在构建钩子**之后**调用。
- 每个输出都会分别调用构建钩子，而 Rollup 只为所有输出调用一次。
- 只有至少调用过一次 [`generate()`](https://rolldown.rs/reference/Interface.RolldownBuild#generate) 或 [`write()`](https://rolldown.rs/reference/Interface.RolldownBuild#write) 时，Rolldown 才会调用 [`closeBundle`](https://rolldown.rs/reference/Interface.FunctionPluginHooks#closebundle) 钩子；Rollup 则无论是否调用过 `generate()` 或 `write()` 都会调用。

### 监听模式中的钩子行为

在 Rollup 中，监听模式每次重新构建都会调用 [`options`](https://rolldown.rs/reference/Interface.Plugin#options) 钩子。在 Rolldown 中，`options` 钩子只在创建监听器时调用一次，后续重新构建不会再次调用。

### 顺序执行钩子

在 Rollup 中，[`writeBundle`](https://rolldown.rs/reference/Interface.FunctionPluginHooks#writebundle) 等部分钩子默认是“并行”的，也就是会跨多个插件并发运行。如果需要钩子依次运行，插件必须显式设置 `sequential: true`。

在 Rolldown 中，[`writeBundle`](https://rolldown.rs/reference/Interface.FunctionPluginHooks#writebundle) 钩子默认已经顺序执行，因此插件无需为该钩子指定 `sequential: true`。

### Sourcemap 校验

Rollup 不会根据插件 sourcemap 自身的 `sources` 和 `names` 检查映射。指向缺失 source 的映射会被丢弃；指向缺失 name 的映射会被保留，但不带 name。Rolldown 在将映射转换为内部表示时会检查每个索引，因此 Rollup 能接受的无效映射可能会在这里导致构建失败。例如：

```
Failed to convert json sourcemap to struct
Reference to non-existing source at position 1
```
