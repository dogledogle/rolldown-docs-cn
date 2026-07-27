# Rolldown 中文文档

本仓库是 [Rolldown](https://github.com/rolldown/rolldown) 官方仓库 `docs/` 目录的独立简体中文版本。

文档内容以 Rolldown 官方英文文档为准。本仓库负责中文翻译、中文站点配置和独立构建适配，不包含 Rolldown 的实现源码。自动生成的完整 API Reference 暂未复制到本仓库，相关链接会跳转到 [Rolldown 官方 API Reference](https://rolldown.rs/reference/)。

## 本地开发

需要 Node.js 20.19 或更高版本，以及 pnpm 11.13.1。

```sh
pnpm install
pnpm dev
```

常用命令：

```sh
pnpm dev            # 启动本地开发服务器
pnpm build          # 构建生产站点
pnpm preview        # 预览生产构建
pnpm sync:upstream  # 更新 upstream-docs 英文快照分支
```

## 上游同步

- `main` 分支维护中文文档和独立站点适配。
- `upstream-docs` 分支保存未经翻译的上游英文文档快照。
- 不要直接把 `upstream-docs` 合并到 `main`。请查看两个快照间的差异，将上游增量翻译并移植到 `main`。

完整流程请参阅[上游同步说明](./UPSTREAM.md)。

## 翻译约定

- 保留代码、命令、路径、API 名称、配置项、错误代码和字面量。
- 产品名与技术名使用官方写法，例如 Rolldown、Rollup、Vite、webpack、esbuild、Node.js 和 TypeScript。
- 常用术语统一为“打包器”“代码块”“入口”“代码拆分”“插件钩子”“摇树优化”和“无用代码消除”。
- `source map`、ESM、CJS、CommonJS 等术语保持英文。

## 许可

本仓库中的上游文档及其修改版本遵循 [MIT License](./LICENSE)。

“开发指南”部分深受 [rustc-dev-guide](https://github.com/rust-lang/rustc-dev-guide) 启发，其中部分内容沿用自该项目，并遵循相同的 MIT 许可证。
