# 测试

## 快速指南

::: tip 简而言之
运行 `just test-update` 可以执行所有 Rust 和 Node.js 测试，并自动更新快照。
:::

我们有两组测试套件：一组用于 Rust，另一组用于 Node.js。

::: warning 应遵循的测试原则

1. 添加带有选项的新功能时，只要可行，就务必在 JavaScript 侧添加相关测试。

有关如何选择测试技术的更多细节，请参阅 [如何选择测试技术](#如何选择测试技术)。
:::

- `just test`：运行所有测试。
- `just test-update`：运行所有测试并自动更新快照
- `just test-rust`：运行所有 Rust 测试。
- `just test-node`：运行所有 Node.js 测试。
- `just test-node-rolldown`：仅运行 Rolldown 的 Node.js 测试。
- `just test-node-rollup`：仅运行 Rollup 的测试。

## 概念

测试是 Rolldown 开发流程中的关键部分。在添加新功能和进行修改时，它能帮助我们确保打包器的正确性、稳定性和性能。

由于 Rolldown 是一个**打包器**，与孤立测试单个组件的单元测试相比，我们更倾向于覆盖端到端场景的集成测试。这样可以验证从输入文件到输出打包产物的整个打包过程是否符合预期。

我们通常使用两类测试：

- 数据驱动测试：测试运行器会查找符合特定约定（例如文件夹结构和文件命名）的测试用例，并自动运行它们。这是我们添加新测试的主要方式。
- 手动测试：对于难以用数据驱动方式表达的复杂场景，我们会编写手动测试代码，用它来设置测试环境、以特定选项运行打包器，并通过程序验证输出。

## Rust

我们使用 Rust 的内置测试框架编写和运行测试。测试用例存放在 `crates/rolldown/tests` 文件夹中。

### 数据驱动测试

数据驱动测试用例是一个包含 `_config.json` 文件的文件夹。测试运行器会从 `_config.json` 读取配置，打包输入文件，并执行输出文件以验证行为。

`_config.json` 包含测试套件的配置。如果一切正常，得益于这项 [配置](https://github.com/rolldown/rolldown/blob/main/.vscode/settings.json#L40-L43)，编辑 `_config.json` 时应该能够获得自动补全。

所有可用选项请参阅：

- [打包器选项](https://github.com/rolldown/rolldown/blob/100c6ee13cef9c50529b8d6425292378ea99eae9/crates/rolldown_common/src/inner_bundler_options/mod.rs#L53)
- [JSON Schema 文件](https://github.com/rolldown/rolldown/blob/main/crates/rolldown_testing/_config.schema.json)

#### 数据驱动测试会做什么？

- 生成构建产物的快照，其中包括：
  - 打包后的输出文件
  - 打包过程中发出的警告和错误

- 如果不存在 `_test.mjs`，就在 Node.js 环境中运行输出文件，以验证运行时行为。可以将其理解为运行 `node --import ./dist/entry1.mjs --import ./dist/entry2.mjs --import ./dist/entry3.mjs --eval ""`。

- 如果存在 `_test.mjs`，则运行它来验证更复杂的行为。

#### 提示

- 运行 Rust 测试时，快照会自动更新，无需额外命令。

#### 功能完整的数据驱动测试

`_config.json` 存在一定限制，因此我们也支持直接使用 Rust 编写测试。可以参考：

[`crates/rolldown/tests/rolldown/errors/plugin_error`](https://github.com/rolldown/rolldown/blob/86c7aa6557a2bb7eef03133b148b1703f4e21167/crates/rolldown/tests/rolldown/errors/plugin_error)

这种方式基本上只是用直接配置打包器的 Rust 代码替代 `_config.json`，其他部分与数据驱动测试完全相同。

#### esbuild

Rolldown 还会运行从 esbuild 打包器测试套件派生的测试，以验证兼容性。这些测试位于 `crates/rolldown/tests/esbuild`。

`scripts` 目录包含用于管理 esbuild 测试的实用工具：

- **`gen-esbuild-tests`**：从 esbuild 的 Go 测试文件生成测试用例。
- **`esbuild-snap-diff`**：将 Rolldown 的输出快照与 esbuild 的预期输出进行比较。它会生成差异报告和兼容性统计信息，帮助跟踪 Rolldown 的行为与 esbuild 的接近程度。

  该脚本会在 `scripts/src/esbuild-tests/snap-diff/summary/` 中生成 Markdown 摘要文件，并在 `scripts/src/esbuild-tests/snap-diff/stats/stats.md` 中生成总体统计信息。

在文件夹名称前添加 `.` 可以跳过测试用例（例如 `.test_case_name`）。被跳过的测试必须在 `scripts/src/esbuild-tests/reasons.ts` 中记录原因。

#### HMR 测试

如果测试用例文件夹包含任何名为 `*.hmr-*.js` 的文件，测试就会在启用 HMR 的模式下运行。

##### HMR 编辑文件

- 匹配 `*.hmr-*.js` 模式的文件称为 **HMR 编辑文件**。
- 这些文件表示对现有源文件的修改。
- `hmr-` 后面的部分表示修改的**步骤编号**。例如，`main.hmr-1.js` 表示在**步骤 1** 中应用的修改。

##### 测试如何运行

1. 将所有非 HMR 文件复制到临时目录。
2. 使用这些文件生成初始构建。
3. 然后开始 HMR 步骤 1：使用 `.hmr-1.js` 文件覆盖临时目录中相应的文件，并生成 HMR 补丁。
4. 对步骤 2、3 等重复此过程，逐步应用 `*.hmr-2.js`、`*.hmr-3.js` 等文件。

::: details 示例

假设测试文件夹包含以下文件：

- `main.js`
- `sub.js`
- `main.hmr-1.js`
- `sub.hmr-1.js`
- `sub2.hmr-2.js`

测试将经历以下步骤：

1. **初始构建**：`main.js`、`sub.js`
2. **步骤 1**：
   - 使用 `main.hmr-1.js` 替换 `main.js`
   - 使用 `sub.hmr-1.js` 替换 `sub.js`
3. **步骤 2**：
   - `main.js` 和 `sub.js` 保持步骤 1 之后的状态
   - 使用 `sub2.hmr-2.js` 的内容添加 `sub2.js`

:::

### 手动测试

对于难以用数据驱动方式表达的复杂场景，我们会编写手动测试代码，用它来设置测试环境、以特定选项运行打包器，并通过程序验证输出。

这里没有太多特别之处，编写使用 Rolldown 执行打包和验证的常规 Rust 测试代码即可。

### test262 集成测试

Rolldown 集成了 [test262](https://github.com/tc39/test262) 测试套件，用于验证对 ECMAScript 规范的遵循情况。由于其他测试用例应该由 Oxc 侧覆盖，因此只运行 `test/language/module-code` 下的测试用例。

设置项目时，运行 `just setup` 后应该已经初始化 Git 子模块；不过，在运行集成测试前还应该运行 `just update-submodule` 来更新子模块。

可以使用以下命令运行 test262 集成测试：

```shell
TEST262_FILTER="attribute" cargo test --test integration test262_module_code -- --no-capture
```

- `TEST262_FILTER` 允许按名称过滤测试（例如 `"attribute"`）。如果省略此环境变量，将运行所有测试用例。请注意，设置该环境变量后不会更新结果快照。
- `--no-capture` 选项会显示所有测试输出。

预期失败的测试用例列在 [`crates/rolldown/tests/test262_failures.json`](https://github.com/rolldown/rolldown/blob/main/crates/rolldown/tests/test262_failures.json) 中。

## Node.js

Rolldown 使用 [Vitest](https://vitest.dev/) 测试 Node.js 侧的代码。

位于 `packages/rolldown/tests` 中的测试用于检验 Rolldown 的 Node.js API（即发布到 NPM 的 `rolldown` 包所提供的 API）。

- `just test-node-rolldown`：运行 Rolldown 测试。
- `just test-node-rolldown --update`：运行测试并更新快照。

### 数据驱动测试

数据驱动测试位于 `packages/rolldown/tests/fixtures`。

数据驱动测试用例是一个包含 `_config.ts` 文件的文件夹。测试运行器会从 `_config.ts` 读取配置，打包输入文件，并根据预期结果验证输出。

### 手动测试

这里同样没有太多特别之处，编写使用 Rolldown 执行打包和验证的常规 JavaScript/TypeScript 测试代码即可。

### 运行特定文件的测试

要运行特定文件的测试，可以使用：

```shell
just test-node-rolldown test-file-name
```

例如，要运行 `fixture.test.ts` 中的测试，可以使用 `just test-node-rolldown fixture`。

### 提示

#### 运行特定测试

要运行特定测试，可以使用：

```shell
just test-node-rolldown -t test-name
```

`fixture.test.ts` 中的测试名称由其文件夹名称定义。`tests/fixtures/resolve/alias` 对应的测试名称为 `resolve/alias`。

要运行 `tests/fixtures/resolve/alias` 测试，可以使用 `just test-node-rolldown -t resolve/alias`。

::: info

- `just test-node-rolldown -t aaa bbb` 与 `just test-node-rolldown -t "aaa bbb"` 不同。前者会运行名称中包含 `aaa` 或 `bbb` 的测试；后者会运行名称中包含 `aaa bbb` 的测试。

- 有关更高级的用法，请参阅 <https://vitest.dev/guide/filtering>。

:::

## 开发服务器测试

[`@rolldown/test-dev-server`](https://github.com/rolldown/rolldown/tree/main/packages/test-dev-server) 是 Rolldown **开发引擎**（HMR、惰性编译和错误恢复）的测试工具。其测试位于 `packages/test-dev-server/tests`，分为两个套件：

| 套件       | 平台      | 驱动内容                                                                                     |
| ---------- | --------- | -------------------------------------------------------------------------------------------- |
| **browser**  | `browser` | 真实 Chromium 页面连接到**进程内运行、采用完整打包模式的 Vite 开发服务器**。大多数开发引擎测试位于此处。 |
| **fixtures** | `node`    | 自定义开发服务器将内容构建到**磁盘**，再将构建产物作为 `node` 子进程运行。                    |

浏览器测试套件运行在 Vite 本身之上（`experimental.bundledDev`）。所使用的 Vite 位于仓库根目录的 `vite/` 检出中。这是一个被 Git 忽略的 vitejs/vite 克隆，其 `rolldown-canary` 分支已变基到 `main`；它的 `rolldown` 依赖链接到工作区的 `packages/rolldown`。因此，测试会通过真实的 Vite 集成来检验本地 Rolldown 绑定。测试工具的架构和设计理由记录在 [开发服务器测试工具设计文档](https://github.com/rolldown/rolldown/blob/main/internal-docs/dev-server-test-harness/implementation.md) 中。修改测试工具本身之前，请先阅读该文档。

### 浏览器 playground

大多数开发引擎回归测试会编写为**浏览器 playground**，而不是单元测试。playground 是由进程内开发服务器提供给真实 Chromium 页面的微型应用，位于：

```text
playground/<name>/
```

每个 playground 通常包含：

```text
dev.config.mjs            # Rolldown 开发配置（browser 平台，不设置 dev.port）
index.html                # 在 / 提供；其中的模块 script 标签是构建入口
main.js                   # index.html 引用的入口
package.json              # 工作区成员（复制一个现有文件）
__tests__/<name>.spec.ts  # 测试规范（留在源目录中，永不复制）
```

Vite 会从 `index.html` 的 `<script type="module">` 标签中发现入口（`dev.config.mjs` 中的 `input` 字段只适用于 Node.js 平台）。浏览器测试始终启用惰性编译，因为完整打包模式会强制设置 `devMode.lazy: true`。

测试工具会根据测试规范的路径发现 playground，将其复制到 `playground-temp/<name>/`，在操作系统分配的端口上启动进程内开发服务器，打开 Chromium 页面并导航至该页面。因此，**添加测试只需增加一个文件夹和一份测试规范，无需编辑任何中央注册表**。

测试规范通过 `~utils` 别名导入辅助工具。运行测试规范时，测试工具已经启动服务器，并让 `page` 导航到了对应页面：

```ts
import { describe, expect, test } from 'vitest';
import { editFile, page, waitForBuildStable } from '~utils';

describe('<name>', () => {
  test('applies an HMR update', async () => {
    editFile('main.js', (code) => code.replace('hello', 'world'));
    await expect.poll(() => page.textContent('h1')).toBe('world');
  });
});
```

::: warning 等待服务器异步工作完成，切勿使用 sleep
使用 `expect.poll` 轮询 DOM；在后续编辑前执行 `await waitForBuildStable()`；或者通过 `untilBrowserLogAfter` 等待浏览器日志。固定时长的 `sleep` 既不稳定又缓慢。
:::

#### 断言 Vite 的信号

服务器和客户端均来自 Vite，因此测试规范会对 Vite 自身的信号进行断言：

- **错误浮层**：Vite 的 `<vite-error-overlay>` 自定义元素在 **shadow root** 中渲染，因此在宿主元素上调用 `locator(...).textContent()` 不会返回内容。请使用 `~utils` 中的 `errorOverlay()` 和 `errorOverlayText()` 辅助函数。
- **服务器日志**（收集到 `serverLogs` 中）：`✘ Build error: …`、`hmr update …`、`hmr invalidate …`、`page reload`。
- **浏览器日志**（收集到 `browserLogs` 中）：`[vite] connected.`、`[vite] hot updated: …`。

#### 构建和运行

修改 Rust 或开发服务器的 `src/` 后需要重新构建一次，因为测试导入的是编译后的 `dist/`，而不是 TypeScript 源代码：

```sh
just build-rolldown
pnpm --filter @rolldown/test-dev-server build
```

浏览器测试套件还需要设置 Vite 检出：克隆或更新 vitejs/vite，将 `rolldown-canary` 变基到 `main`，然后安装、构建，并将工作区中的 Rolldown 链接到该检出。接手的检出如果有未提交修改或切换到了其他分支，会按原样构建。在检出中执行安装后，需要重新运行设置命令，因为安装操作会重置 Rolldown 链接：

```sh
just setup-vite
```

然后，在 `packages/test-dev-server/tests/` 中运行：

```sh
# 单个 playground
pnpm exec vitest run --config=vitest.config.e2e.mts playground/<name>

# 整个浏览器测试套件
pnpm test:browser
```

#### 一份测试规范与多份测试规范

**同一 playground 中的多份测试规范文件会并发运行**（文件并行），每份文件都会基于共享的 `playground-temp/<name>/` 副本派生自己的开发服务器。只有各场景**彼此独立**时这样做才安全，也就是说，每份测试规范导航自己的 DOM，并且只编辑自己的文件（`lazy-compilation` 的四份测试规范就是这样共存的）。如果多个场景共享同一个打包产物或入口，一个场景的编辑会重建另一份测试规范的页面，就应该将它们放进**同一份测试规范文件**中（这也是 `hmr-full-bundle-mode` 的多个场景位于同一份测试规范中的原因）。

同一份测试规范文件中的测试共享一个 `page` 并按顺序运行，因此不要让它们相互干扰。编辑应该**只向前推进**，否则就要恢复修改内容，因为后续测试不能假设前一个测试的编辑已经被还原。此外，发生任何重新加载后，都要**重新获取元素句柄**（使用 `page.locator(...)` 或重新调用 `page.$`），因为重新加载会使旧句柄失效。

最好为每个场景提供**独立的 DOM 节点**，避免一个测试的编辑干扰另一个测试的断言。`hmr-full-bundle-mode` 就为每个场景分别保留了 `.app`、`.hmr`、`.hmr-error` 和 `.rebuild-error`。

#### 冷启动 playground

部分惰性编译错误只会在首次请求全新服务器时复现。添加 `__tests__/serve.ts`，让测试工具启动服务器但不执行导航，由测试规范自行发起第一次请求：

```ts
import type { DevServerHandle, ServeContext } from '~utils';

export async function serve(ctx: ServeContext): Promise<DevServerHandle> {
  return ctx.createServer();
}
```

### Node.js fixture 测试

对于 **Node.js** 平台，请使用 `fixtures/<name>/` 和 `fixtures.test.ts`（通过 `pnpm test:fixtures` 运行）。此时开发服务器会构建到磁盘，并将构建产物作为 `node` 子进程运行。如果普通 HMR、惰性编译或错误浮层回归可以由浏览器 playground 覆盖，就不要将其添加到这里。

## Rollup 行为对齐测试

我们还会用 Rolldown 运行 Rollup 自己的测试，以实现与 Rollup 的行为对齐。

为此，`packages/rollup-tests/test` 中的每个测试用例都会代理到项目根目录 `rollup` Git 子模块中的对应测试。

设置项目时，运行 `just setup` 后应该已经初始化 Git 子模块；不过，在运行 Rollup 测试前还应该运行 `just update-submodule` 来更新子模块。

在 `/packages/rollup-tests` 中：

- `just test-node-rollup`：运行 Rollup 测试。
- `just test-node-rollup --update`：运行测试并更新测试状态。

要运行特定测试，请为 `just test-node-rollup` 使用 `--grep` 选项：

```shell
just test-node-rollup --grep "function"
```

这将只运行名称与 `"function"` 匹配的测试。有关更多过滤选项，请参阅 [Mocha 的 grep 文档](https://mochajs.org/#grep)。

> [!NOTE]
> 部分 Rollup 测试需要特定的 Node.js 版本才能运行。测试会在 `_config.js` 文件中指定 `minNodeVersion`，当当前 Node.js 版本低于要求时自动跳过。除非使用 Node.js 24 或更高版本，否则通过的测试数量会有所不同。

## 如何选择测试技术

我们的 Rust 测试基础设施足以覆盖大多数 JavaScript 场景（例如插件，以及在配置中传递函数）。不过，由于 JavaScript 用户仍然是我们的首要用户群体，只要可行，就尽量在 JavaScript 侧添加测试。以下是有关如何选择测试技术的一些经验。

::: tip 简而言之
如果不想花时间决定使用哪种方式，请在 JavaScript 侧添加测试。
:::

### 优先使用 Rust

1. 测试 Rolldown 核心发出的警告或错误。
   - [错误](https://github.com/rolldown/rolldown/blob/568197a06444809bf44642d88509313ee2735594/crates/rolldown/tests/rolldown/errors/assign_to_import/artifacts.snap?plain=1#L2-L54)
   - [警告](https://github.com/rolldown/rolldown/blob/568197a06444809bf44642d88509313ee2735594/crates/rolldown/tests/rolldown/warnings/eval/artifacts.snap?plain=1#L1-L28)
2. 矩阵测试。假设要测试一系列不同的 [格式](https://github.com/rolldown/rolldown/blob/568197a06444809bf44642d88509313ee2735594/crates/rolldown/tests/rolldown/topics/bundler_esm_cjs_tests/4/_config.json?plain=1#L1-L21)，使用 `configVariants` 只需一个测试就能完成。
3. 与链接算法（摇树优化、代码块拆分）相关的测试。这些测试可能需要大量调试，在 Rust 侧添加测试可以缩短“编码、调试、再编码”的工作循环。

### 优先使用 JavaScript

以上未提及的类别都应该在 JavaScript 侧添加测试。
