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

## 首次关联个人远程仓库

当前的 `upstream` 远程固定指向 Rolldown 官方仓库。创建自己的 GitHub 仓库后，将其添加为 `origin`：

```sh
git remote add origin git@github.com:<你的账号>/rolldown-docs-cn.git
git push -u origin main
git push origin upstream-docs
```

后续从 `origin` 协作，从 `upstream` 获取官方文档更新。
