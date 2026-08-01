<p align="center">
  <a href="https://rolldown-docs-cn.pages.dev/" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://rolldown.rs/rolldown-light.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://rolldown.rs/rolldown-dark.svg">
      <img src="https://rolldown.rs/rolldown-dark.svg" alt="Rolldown" height="64">
    </picture>
  </a>
</p>

<h1 align="center">📘 Rolldown 中文文档</h1>

<p align="center">
  Rolldown 官方英文文档的简体中文翻译
</p>

<p align="center">
  <a href="https://rolldown-docs-cn.pages.dev/"><strong>在线阅读</strong></a>
  ·
  <a href="https://rolldown.rs/">英文文档</a>
  ·
  <a href="https://github.com/rolldown/rolldown">Rolldown 仓库</a>
  ·
  <a href="https://github.com/dogledogle/rolldown-docs-cn/issues">反馈问题</a>
</p>

<p align="center">
  <a href="https://github.com/dogledogle/rolldown-docs-cn/actions/workflows/upstream-sync.yml"><img src="https://github.com/dogledogle/rolldown-docs-cn/actions/workflows/upstream-sync.yml/badge.svg" alt="上游文档同步状态"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

> [!IMPORTANT]
> 本仓库专注于中文文档的翻译与站点维护。文档内容以 [Rolldown 官方英文文档](https://rolldown.rs/) 为准；Rolldown 的使用问题、功能建议和缺陷报告，请前往 [Rolldown 官方仓库](https://github.com/rolldown/rolldown/issues) 或 [Discord 社区](https://chat.rolldown.rs/) 讨论。

## 📖 关于本仓库

[Rolldown](https://github.com/rolldown/rolldown) 是一个使用 Rust 编写的高性能 JavaScript/TypeScript 打包器，提供兼容 Rollup 的 API 和插件接口，并计划成为 Vite 未来的打包器。

本仓库维护 Rolldown 官方仓库 [`docs/`](https://github.com/rolldown/rolldown/tree/main/docs) 目录的独立简体中文版本，包括：

- 官方文档的中文翻译与术语维护；
- 中文站点配置、主题与独立构建适配；
- 上游文档变更的同步与翻译自动化。

本仓库不包含 Rolldown 的实现源码。自动生成的完整 API Reference 暂未复制到中文站点，相关链接将跳转至 [官方 API Reference](https://rolldown.rs/reference/)。

## 🤝 参与贡献

欢迎修正错别字、改进译文、统一术语或补充尚未翻译的内容。提交修改前，请注意：

- 只影响中文表达的问题，请在本仓库提交 Issue 或 Pull Request；
- 同样适用于英文原文或其他语言版本的改进，请优先反馈至 [Rolldown 官方仓库](https://github.com/rolldown/rolldown)；
- 请勿直接将 `upstream-docs` 分支合并到中文文档分支，上游增量需要经过翻译与审阅。

一个典型的贡献流程如下：

```sh
git clone https://github.com/dogledogle/rolldown-docs-cn.git
cd rolldown-docs-cn
pnpm install
pnpm dev
```

完成修改后，运行 `pnpm build` 检查文档站点能否正常构建，再向本仓库提交 Pull Request。

## 🛠️ 本地开发

开发环境需要 [Node.js](https://nodejs.org/) 20.19 或更高版本，以及 [pnpm](https://pnpm.io/) 11.13.1。仓库已通过 `packageManager` 字段固定 pnpm 版本，可使用 Corepack 启用：

```sh
corepack enable
pnpm install
pnpm dev
```

启动后，根据终端输出访问本地开发服务器。

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 VitePress 开发服务器 |
| `pnpm build` | 构建生产版本并检查文档错误 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm sync:upstream` | 更新 `upstream-docs` 英文快照分支 |
| `pnpm test:upstream` | 测试上游同步与翻译辅助工具 |

## 🗂️ 目录结构

```text
.
├─ guide/                 # 使用指南
├─ apis/                  # API 文档
├─ builtin-plugins/       # 内置插件
├─ in-depth/              # 深入理解 Rolldown
├─ contribution-guide/    # 贡献指南
├─ development-guide/     # 开发指南
├─ glossary/              # 术语表
├─ .vitepress/            # 站点配置与主题
└─ scripts/               # 上游同步与翻译自动化脚本
```

## ✍️ 翻译约定

- 保留代码、命令、路径、API 名称、配置项、错误代码和字面量；
- 产品名与技术名使用官方写法，例如 Rolldown、Rollup、Vite、webpack、esbuild、Node.js 和 TypeScript；
- 常用术语统一为“打包器”“代码块”“入口”“代码拆分”“插件钩子”“摇树优化”和“无用代码消除”；
- `source map`、ESM、CJS、CommonJS 等术语保持英文；
- 在忠于原意的前提下使用自然、清晰的简体中文，避免逐词直译。

## 🔄 上游同步

- `main`：维护中文文档和独立站点适配；
- `upstream-docs`：保存未经翻译的上游英文文档快照；
- 自动同步任务定期检查上游变化，并通过 Pull Request 提交待审阅的中文更新。

同步命令、自动翻译流程和分支维护方式详见 [《上游同步说明》](./UPSTREAM.md)。

## 📄 许可

本仓库中的上游文档及其修改版本遵循 [MIT License](./LICENSE)。

“开发指南”部分深受 [rustc-dev-guide](https://github.com/rust-lang/rustc-dev-guide) 启发，其中部分内容沿用自该项目，并遵循相同的 MIT 许可证。
