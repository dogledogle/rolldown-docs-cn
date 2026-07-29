# 上游同步说明

本仓库只维护 [`rolldown/rolldown`](https://github.com/rolldown/rolldown) 仓库中 `docs/` 目录的中文版本。

## 分支约定

- `main`：中文文档和独立站点所需的适配代码。
- `upstream-docs`：未经翻译的英文文档快照。每个提交都在提交信息中记录对应的 Rolldown 源提交。

## 拉取上游更新

```sh
pnpm sync:upstream
```

该命令只更新本地 `upstream-docs` 分支，不会覆盖 `main` 上的中文内容。命令完成后会输出用于审阅增量的 `git diff` 命令。根据该差异将新增或修改的英文内容翻译到 `main`，检查构建，再提交中文更新。

不要直接把 `upstream-docs` 合并到 `main`。翻译会使同一行在两个分支上都发生变化，直接合并容易产生大范围冲突，也可能让英文内容混入中文站点。

## 自动同步与翻译

GitHub Actions 工作流 `Upstream docs translation` 会在北京时间每天 06:00 运行，也可以从 Actions 页面手动触发。工作流会：

1. 更新并推送 `upstream-docs` 英文快照。
2. 比较上一次已处理的英文 tree 与最新英文 tree；没有文档变化时不会调用模型。
3. 使用旧英文、新英文和当前中文作为三方输入，通过 Codex CLI 移植上游增量。
4. 构建站点并创建或更新 `codex/upstream-sync` PR。

首次启用前，在仓库 Settings 中完成以下配置：

- Repository variable `MODEL_BASE_URL`：兼容 Responses API 的模型 Base URL。
- Repository variable `MODEL_NAME`：模型服务实际使用的模型 ID。
- Actions secret `TRANSLATION_API_KEY`：模型 API Key。不要将 Key 写入文件、提交、PR 或日志。
- Actions 的 Workflow permissions 允许读写仓库内容并创建 Pull Request。

模型服务必须支持 Responses API、流式输出和工具调用。工作流会先执行只读兼容性预检；预检失败时不会发布翻译分支。

检查全部通过时 PR 为普通审核状态。构建失败、翻译存在未解决项或机器人分支无法更新到最新 `main` 时，PR 会转为 Draft，并在 PR 描述或评论中列出原因。工作流不会自动合并 PR。

本地验证同步工具：

```sh
pnpm test:upstream
```

## 首次关联个人远程仓库

当前的 `upstream` 远程固定指向 Rolldown 官方仓库。创建自己的 GitHub 仓库后，将其添加为 `origin`：

```sh
git remote add origin git@github.com:<你的账号>/rolldown-docs-cn.git
git push -u origin main
git push origin upstream-docs
```

后续从 `origin` 协作，从 `upstream` 获取官方文档更新。
