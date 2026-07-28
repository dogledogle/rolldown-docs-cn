# 仓库结构

本文概述仓库结构以及各目录的用途。

## `/crates`

所有 Rust crate 都存放在此目录中。

- `/bench`：项目 Rust 端的基准测试程序。
- `/rolldown`：Rolldown 打包器的核心逻辑。
- `/rolldown_binding`：将核心逻辑绑定到 Node.js 的粘合代码。

## `/packages`

所有 Node.js 包都存放在此目录中。

- `/rolldown`：项目的 Node.js 包。
- `/bench`：项目 Node.js 端的基准测试程序。
- `/rollup-tests`：使用 Rolldown 运行 Rollup 测试的适配器。
- `/vite-tests`：使用本地 Rolldown 运行 Vite 自有测试套件的脚本；测试在共享根目录 `/vite` 检出的临时克隆上执行。

## `/vite`

开发服务器测试框架（`packages/test-dev-server`）和 `packages/vite-tests` 共用的唯一 Vite 检出目录。它由 `just setup-vite` 创建，是一个被 Git 忽略的 [vitejs/vite](https://github.com/vitejs/vite) 克隆，其中最新的 `rolldown-canary` 已变基到最新 `main`。此目录必须保持未修改状态，切勿编辑其中的 Vite 源文件。

## `/examples`

此目录包含在 Node.js 中针对不同场景使用 `rolldown` 的示例。

## `/scripts`

此目录包含用于自动化项目各项任务的脚本。

## `/web`

此目录包含与项目相关的站点。

- `/docs`：项目文档。
