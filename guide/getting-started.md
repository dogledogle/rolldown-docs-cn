# 快速开始

::: tip 在寻找特定用例的方案？
对于大多数应用，推荐[通过 Vite 使用 Rolldown](https://vite.dev/guide/rolldown.html#how-to-try-rolldown)，因为 Vite 提供了完整的开发体验，包括开发服务器、HMR 和经过优化的生产构建。

如果需要打包库，请查看 [tsdown](https://tsdown.dev/)。
:::

## 安装

::: code-group

```sh [vp]
$ vp add -D rolldown
```

```sh [npm]
$ npm install -D rolldown
```

```sh [pnpm]
$ pnpm add -D rolldown
```

```sh [yarn]
$ yarn add -D rolldown
```

```sh [bun]
$ bun add -D rolldown
```

:::

::: details 使用小众平台（CPU 架构、操作系统）？

项目为以下平台分发预构建二进制文件（按照 [Node.js v24 平台支持等级](https://github.com/nodejs/node/blob/v24.x/BUILDING.md#platform-list)分组）：

- Tier 1
  - Linux x64 glibc (`x86_64-unknown-linux-gnu`)
  - Linux arm64 glibc (`aarch64-unknown-linux-gnu`)
  - Windows x64 (`x86_64-pc-windows-msvc`)
  - Apple x64 (`x86_64-apple-darwin`)
  - Apple arm64 (`aarch64-apple-darwin`)
- Tier 2
  - Windows arm64 (`aarch64-pc-windows-msvc`)
  - Linux s390x glibc (`s390x-unknown-linux-gnu`)
  - Linux ppc64le glibc (`powerpc64le-unknown-linux-gnu`)
- 实验性支持
  - Linux x64 musl (`x86_64-unknown-linux-musl`)
  - Linux armv7 (`armv7-unknown-linux-gnueabihf`)
  - FreeBSD x64 (`x86_64-unknown-freebsd`)
  - OpenHarmony arm64 (`aarch64-unknown-linux-ohos`)
- 其他
  - Linux arm64 musl (`aarch64-unknown-linux-musl`)
  - Android arm64 (`aarch64-linux-android`)
  - Wasm + Wasi (`wasm32-wasip1-threads`)

如果你使用的平台没有预构建二进制文件，可以选择以下方案：

- 使用 Wasm 构建
  1. 下载 Wasm 构建。
     - 使用 npm 时，可以运行 `npm install --cpu wasm32 --os wasip1-threads`。
     - 使用 Yarn 或 pnpm 时，需要将以下内容添加到 `.yarnrc.yaml` 或 `pnpm-workspace.yaml`：
       ```yaml
       supportedArchitectures:
         os:
           - wasip1-threads
         cpu:
           - wasm32
       ```
  2. 让 Rolldown 加载 Wasm 构建。
     - 如果预构建二进制文件不可用，Rolldown 会自动回退到 Wasm 二进制文件。
     - 如果需要强制 Rolldown 使用 Wasm 构建，可以设置环境变量 `NAPI_RS_FORCE_WASI=error`。
- 从源代码构建
  1. 克隆仓库。
  2. 按照[项目配置说明](/development-guide/setup-the-project)配置项目。
  3. 按照[构建说明](/development-guide/building-and-running)构建项目。
  4. 将环境变量 `NAPI_RS_NATIVE_LIBRARY_PATH` 设置为所克隆仓库中 `packages/rolldown` 的路径。

:::

### 发布渠道

- [latest](https://npmx.dev/package/rolldown#versions)：目前为 `1.x.x`。
- [pkg.pr.new](https://pkg.pr.new/~/rolldown/rolldown)：从 `main` 分支持续发布。使用 `npm i https://pkg.pr.new/rolldown@sha` 安装，其中 `sha` 是 [pkg.pr.new](https://pkg.pr.new/~/rolldown/rolldown) 上列出的成功构建。

## 使用 CLI

要验证 Rolldown 是否正确安装，请在安装目录中运行：

```sh
$ ./node_modules/.bin/rolldown --version
```

你还可以通过以下命令查看 CLI 选项和示例：

```sh
$ ./node_modules/.bin/rolldown --help
```

### 第一次打包

先创建两个 JavaScript 源文件：

```js [src/main.js]
import { hello } from './hello.js';

hello();
```

```js [src/hello.js]
export function hello() {
  console.log('Hello Rolldown!');
}
```

然后在命令行中运行：

```sh
$ ./node_modules/.bin/rolldown src/main.js --file bundle.js
```

此时应该会看到内容被写入当前目录的 `bundle.js`。运行它以验证结果：

```sh
$ node bundle.js
```

终端中应该会输出 `Hello Rolldown!`。

### 添加 package.json 构建脚本

为避免每次输入很长的命令，可以将它放入 `package.json` 脚本：

```json{5} [package.json]
{
  "name": "my-rolldown-project",
  "type": "module",
  "scripts": {
    "build": "rolldown src/main.js --file bundle.js"
  },
  "devDependencies": {
    "rolldown": "^1.0.0"
  }
}
```

现在，只需运行以下命令即可构建：

::: code-group

```sh [vp]
$ vp run build
```

```sh [npm]
$ npm run build
```

```sh [pnpm]
$ pnpm run build
```

```sh [yarn]
$ yarn build
```

```sh [bun]
$ bun run build
```

:::

## 使用配置文件

需要更多选项时，建议使用配置文件以获得更大灵活性。配置文件可以采用 `.js`、`.cjs`、`.mjs`、`.ts`、`.mts` 或 `.cts` 格式。创建如下配置文件：

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  output: {
    file: 'bundle.js',
  },
});
```

Rolldown 支持大多数 [Rollup 配置选项](https://rollupjs.org/configuration-options)，同时还提供一些[值得关注的额外功能](./notable-features)。完整的选项列表请参阅[官方 API 参考（英文）](https://rolldown.rs/reference/)。

虽然直接导出普通对象也能工作，但建议使用 [`defineConfig`](https://rolldown.rs/reference/Function.defineConfig) 辅助函数，以获得选项类型提示和自动补全。该辅助函数仅用于提供类型，会原样返回传入的选项。

接下来，可以在 npm 脚本中使用 `--config` CLI 选项（简写为 `-c`），让 Rolldown 使用配置文件：

```json{5} [package.json]
{
  "name": "my-rolldown-project",
  "type": "module",
  "scripts": {
    "build": "rolldown -c"
  },
  "devDependencies": {
    "rolldown": "^1.0.0"
  }
}
```

### 在同一配置中执行多次构建

也可以通过数组指定多份配置，Rolldown 会并行执行这些打包任务。

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.js',
    output: {
      format: 'esm',
    },
  },
  {
    input: 'src/worker.js',
    output: {
      format: 'iife',
      dir: 'dist/worker',
    },
  },
]);
```

## 使用插件

Rolldown 的插件 API 与 Rollup 相同，因此使用 Rolldown 时可以复用大多数现有 Rollup 插件。不过，Rolldown 提供了许多[内置功能](./notable-features)，很多场景不再需要插件。

Rolldown 还针对部分用例提供了内置插件。更多信息请参阅[内置插件](/builtin-plugins/)。

发布到 npm 的社区插件可以在 [Vite 插件目录](https://registry.vite.dev/plugins)中查找。

## 使用 API

Rolldown 提供了兼容 [Rollup](https://rollupjs.org/javascript-api/) 的 JavaScript API，将 `input` 和 `output` 选项分开处理：

```js
import { rolldown } from 'rolldown';

const bundle = await rolldown({
  // 输入选项
  input: 'src/main.js',
});

// 使用不同的输出选项，在内存中生成打包产物
await bundle.generate({
  // 输出选项
  format: 'esm',
});
await bundle.generate({
  // 输出选项
  format: 'cjs',
});

// 或者直接写入磁盘
await bundle.write({
  file: 'bundle.js',
});
```

你也可以使用更简洁的 `build` API，它接受的选项与配置文件导出的选项完全相同：

```js
import { build } from 'rolldown';

// build 默认写入磁盘
await build({
  input: 'src/main.js',
  output: {
    file: 'bundle.js',
  },
});
```

## 使用监听器

Rolldown 的监听器 API 与 Rollup 的 [`watch`](https://rollupjs.org/javascript-api/#rollup-watch) 兼容。

```js
import { watch } from 'rolldown';

const watcher = watch({/* 选项 */}); // 或 watch([/* 多组选项 */] )

watcher.on('event', () => {});

await watcher.close(); // 与 Rollup 不同：Rolldown 在这里返回 Promise。
```
