# 构建与运行

继续之前，请确保已经完成 [配置流程](./setup-the-project.md)。

## `just` 是什么？

`just` 是 `rolldown` 仓库使用的命令运行器，可以通过一条命令构建、测试和检查项目。

### 用法

只运行 `just` 即可查看所有可用命令。

### 重要命令

- `just roll`：从头构建 Rolldown，并运行所有测试和检查。
- `just test`：运行所有测试。
- `just lint`：格式化并检查代码库。
- `just fix`：修复格式和 lint 问题。
- `just build`：构建 `rolldown` Node.js 包（以及 `@rolldown/pluginutils` Node.js 包）。
- `just run`：使用 Node.js 运行 `rolldown` CLI。

> 大多数命令会同时运行 Rust 和 Node.js 脚本。如果只想处理其中一端，请在 just 命令后附加 `-rust` 或 `-node`，例如 `just lint-rust` 或 `just test-node`。

::: tip
`just roll` 会是开发流程中最常用的命令。无论作出什么变更，都可以直接用它检查一切是否正常。

它能帮助你在本地发现错误，而不必先把变更推送到 GitHub 再等待 CI。

- `just roll-rust`：只运行 Rust 检查。
- `just roll-node`：只运行 Node.js 检查。
- `just roll-repo`：检查文件名等非代码问题。

:::

## 构建

Rolldown 基于 Rust 和 Node.js 构建，因此构建流程包括构建 Rust crate、Node.js 包以及连接二者的粘合层。粘合层本身也是 Node.js 包，但构建它时也会触发 Rust crate 的构建。

NAPI-RS 已经封装了粘合层的构建流程，因此无需关心其中细节。

### `rolldown`

可以使用以下命令构建 `rolldown` 包：

- `just build`/`just build-rolldown`
- `just build-rolldown-release`（**运行基准测试时非常重要**）

这些命令会自动构建 Rust crate 和 Node.js 包。因此无论修改了什么，都可以运行它们来构建最新的 `rolldown` 包。

### WASI

Rolldown 将 WASI 视为一种特殊平台，因此仍使用 `rolldown` 包分发 WASI 版本。

可以使用以下命令构建 WASI 版本：

- `just build-browser`
- `just build-browser-release`（**运行基准测试时非常重要**）

构建 WASI 版本会移除 Rolldown 的原生版本。本地构建流程有意设计为二选一：只能构建原生版本或 WASI 版本，不能混用，尽管 NAPI-RS 本身支持这种方式。

## 运行

可以使用 `just run` 通过 Node.js 运行 `rolldown` CLI。

pnpm workspace 会自动把 `rolldown` 包链接到 `node_modules`，因此可以使用以下命令运行：

```sh
pnpm rolldown
```

`just run` 只是上述命令的别名。

::: warning
运行前请确保已使用 `just build` 构建 `rolldown` 包。
:::
