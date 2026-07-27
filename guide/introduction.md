# 简介

## 什么是打包器

在 JavaScript 开发中，打包器负责将一小块一小块的代码（ESM 或 CommonJS 模块）编译成更大、更复杂的内容，例如库或应用程序。

对于 Web 应用，这能显著提升应用的加载和运行速度（即使使用 HTTP/2 也是如此）。对于库，这可以避免使用方再次打包源代码，也能提高运行时的执行性能。

如果你对其中细节感兴趣，可以阅读我们对[为什么仍然需要打包器](/in-depth/why-bundlers)的深入分析。

## 为什么选择 Rolldown

Rolldown 的首要目标是成为 [Vite](https://vite.dev/) 的底层打包器，用一个统一的构建工具取代 Vite 目前依赖的 [esbuild](https://esbuild.github.io/) 和 [Rollup](https://rollupjs.org/)。我们之所以从零开始实现一个新的打包器，主要有以下原因：

- **性能**：Rolldown 使用 Rust 编写，性能与 esbuild 处于同一水平，并且[比 Rollup 快 10～30 倍](https://github.com/rolldown/benchmarks)。它的 WASM 构建也[明显快于 esbuild](https://x.com/youyuxi/status/1869608132386922720)（原因是 Go 对 WASM 的编译效果并不理想）。

- **生态兼容性**：Rolldown 支持与 Rollup / Vite 相同的插件 API，因而能够兼容 Vite 现有的生态系统。

- **额外功能**：Rolldown 提供了一些 Vite 所需、但 esbuild 和 Rollup 不太可能实现的重要功能（详见下文）。

Rolldown 虽然是为 Vite 设计的，但也完全可以作为独立的通用打包器使用。在大多数情况下，它可以直接替代 Rollup；当你需要更精细地控制代码块拆分时，也可以用它替代 esbuild。

## Rolldown 的功能范围

Rolldown 提供了与 Rollup 大体兼容的 API（尤其是插件接口），并拥有类似的摇树优化能力，可用于减小打包产物体积。

不过，Rolldown 的功能范围更接近 esbuild，内置了以下[额外功能](./notable-features)：

- 平台预设。
- TypeScript / JSX / 语法降级转换。
- 兼容 Node.js 的模块解析。
- ESM / CJS 模块互操作。
- `define`
- `inject`
- 代码压缩（开发中）。

Rolldown 还包含一些在 esbuild 中有相近实现、但 Rollup 并不具备的概念：

- [模块类型](./notable-features#module-types)（实验性功能）。
- [插件钩子过滤器](/apis/plugin-api/hook-filters)。

最后，Rolldown 还提供了 esbuild 和 Rollup 都没有（也可能并不打算）实现的功能：

- [手动代码拆分](./notable-features#manual-code-splitting)。
- HMR 支持（开发中）。

## 致谢

如果没有从 [esbuild](https://esbuild.github.io/)、[Rollup](https://rollupjs.org/)、[webpack](https://webpack.js.org/) 和 [Parcel](https://parceljs.org/) 等其他打包器中学到的经验，就不会有 Rolldown。我们向这些重要项目的作者和维护者致以最崇高的敬意与感谢。
