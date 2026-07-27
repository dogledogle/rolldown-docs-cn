# 打包产物分析插件

`bundleAnalyzerPlugin` 是 Rolldown 的内置插件，可生成详细报告，描述打包产物中的代码块、模块、依赖关系和可达性信息。可视化工具、自定义脚本或基于 LLM 的编码智能体都可以使用该报告。

::: tip 实验性功能
该插件目前处于实验阶段，从 `rolldown/experimental` 导出。其 API 可能在未来版本中发生变化。
:::

## 用法

从 Rolldown 的实验性导出入口导入并使用该插件：

```js
import { defineConfig } from 'rolldown';
import { bundleAnalyzerPlugin } from 'rolldown/experimental';

export default defineConfig({
  input: 'src/main.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [bundleAnalyzerPlugin()],
});
```

运行构建后，插件会在打包输出旁生成分析文件（默认为 `dist/analyze-data.json`）。

## 选项

### `fileName`

- **类型：** `string`
- **默认值：** `format` 为 `'json'` 时是 `'analyze-data.json'`，为 `'md'` 时是 `'analyze-data.md'`

生成的分析资源所使用的文件名。该文件与打包产物的其他文件输出到同一目录。

```js
bundleAnalyzerPlugin({
  fileName: 'bundle-analysis.json',
});
```

### `format`

- **类型：** `'json' | 'md'`
- **默认值：** `'json'`

选择输出格式。

- `'json'` 生成结构化数据文件，适合程序分析或第三方可视化工具。
- `'md'` 生成专为 LLM 使用而设计的 Markdown 报告（参阅下文的 [Markdown 格式](#markdown-格式)）。

```js
bundleAnalyzerPlugin({
  format: 'md',
});
```

## JSON 格式

当 `format` 为 `'json'`（默认值）时，生成的文件包含如下结构化对象。`timestamp` 字段表示从 Unix 纪元开始经过的毫秒数。

```jsonc
{
  "meta": {
    "bundler": "rolldown",
    "version": "1.0.0",
    "timestamp": 1705314645123,
  },
  "chunks": [
    {
      "id": "chunk-main",
      "name": "main-abc123.js",
      "size": 45230,
      "type": "static-entry", // or "dynamic-entry" or "common"
      "moduleIndices": [0, 1, 2],
      "entryModule": 0,
      "imports": [
        {
          "targetChunkIndex": 1,
          "type": "static", // or "dynamic"
        },
      ],
      "reachableModuleIndices": [0, 1, 2, 3, 4],
    },
  ],
  "modules": [
    {
      "id": "mod-0",
      "path": "src/main.js",
      "size": 3450,
      "importers": [1, 2],
    },
  ],
}
```

可以将 JSON 输出上传到 [chunk-visualize](https://iwanabethatguy.github.io/chunk-visualize/) 等社区可视化工具，也可以通过自定义脚本处理，以持续跟踪打包指标。

## Markdown 格式

设置 `format: 'md'` 后，插件会生成结构化 Markdown 报告而不是 JSON。该报告专为基于 LLM 的编码智能体设计，可以直接通过管道传入提示词，以获取审查和重构建议。

报告分为以下部分：

| 部分                                       | 说明                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **快速摘要**                               | 输出总大小、输入模块数、入口点和代码拆分（公共）代码块数量。                                                          |
| **按输出贡献排序的最大模块**               | 按大小排列所有模块，并显示每个模块占总输出的百分比。                                                                  |
| **入口点分析**                             | 每个入口的输出文件名、打包大小、加载的代码块和包含的模块。                                                            |
| **依赖链**                                 | 被多个文件导入的模块，有助于理解某个模块为何进入打包产物。                                                            |
| **优化建议**                               | 带有严重程度的可执行建议（见下文）。                                                                                  |
| **完整模块图**                             | 每个模块的完整依赖信息（导入项、导入方和大小）。                                                                      |
| **用于搜索的原始数据**                     | 便于 grep 的行，使用 `[MODULE:]`、`[OUTPUT_BYTES:]`、`[IMPORT:]`、`[IMPORTED_BY:]`、`[ENTRY:]`、`[CHUNK:]` 标签。      |

### 优化建议

建议部分会识别位于**共享公共代码块**中、但只能从**单个静态入口**到达的模块。这些模块没有必要共享。可以在 [`output.codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) 分组中启用 [`entriesAware: true`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup#entriesaware)，将它们移到更靠近入口的位置；这也是报告自身优化提示所推荐的修复方式。

每条建议都会根据公共代码块中“只能从单个入口到达的模块”所占大小比例标记严重程度：

- `[HIGH]`：大于 50%。
- `[MEDIUM]`：介于 30% 和 50% 之间。
- `[LOW]`：小于 30%。

### 通过管道将报告传给 LLM

报告采用纯 Markdown 格式，因此可以直接交给 AI 助手审查：

```bash
# 运行构建后
cat dist/analyze-data.md | your-cli-coding-agent "review this bundle and suggest improvements"
```

## 示例

Rolldown 仓库的 [`examples/bundle-analyzer-demo`](https://github.com/rolldown/rolldown/tree/main/examples/bundle-analyzer-demo) 目录提供了可运行示例。它演示了一个多入口项目，使用 `format: 'md'` 分析时会生成一些有价值的优化建议。
