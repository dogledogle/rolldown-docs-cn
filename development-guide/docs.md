# 文档

Rolldown 使用 [VitePress](https://vitepress.dev) 构建文档。站点源代码位于 `docs` 目录。要了解 VitePress 的功能，请查看 [Markdown 扩展指南](https://vitepress.dev/guide/markdown)。

要为文档作贡献，可以在项目根目录中启动文档开发服务器：

```sh
pnpm run docs
```

由于 `pnpm docs` 命令用于在 npm 中打开模块介绍，因此请使用上面的命令。

接下来便可编辑 Markdown 文件并即时查看变更。文档结构在 `docs/.vitepress/config.ts` 中配置（参阅[站点配置参考](https://vitepress.dev/reference/site-config)）。

如果希望检查构建后的站点，请在项目根目录中运行：

```sh
pnpm docs:build
pnpm docs:preview
```

如果贡献内容不涉及文档构建设置，则无需执行此步骤。
