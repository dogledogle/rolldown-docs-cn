<script setup lang="ts">
  import { data } from '../data-loading/node-version.data.js'
</script>

# 配置项目

## 前置条件

构建和运行 Rolldown 只需要少量工具。你需要：

- 通过 [rustup](https://www.rust-lang.org/tools/install) 安装 Rust。
- 安装 `just`。

可以运行以下命令快速安装 `just`，也可以按照官方 [指南](https://github.com/casey/just?tab=readme-ov-file#installation) 安装：

::: code-group

```sh [Npm]
npm install --global just-install
```

```sh [Pnpm]
pnpm --global add just-install
```

```sh [Yarn]
yarn global add just-install
```

```sh [Homebrew]
brew install just
```

```sh [Cargo]
cargo install just
```

:::

- 安装 `cmake`。

可以按照官方 [下载说明](https://cmake.org/download/) 进行安装。

- 安装 Node.js {{ data.nodeVersion }} / 21.2.0 或更高版本。

## `just setup`

首次检出仓库后，只需在仓库根目录中运行 `just setup`。

如果最后看到 `✅✅✅ Setup complete!`，说明构建和运行 Rolldown 所需的一切都已准备就绪。

可以运行 `just roll`，验证所有内容能否正常工作。

::: tip

- `just roll` 可能需要运行一段时间，因为它会从头构建 Rolldown 并运行全部测试。
- 如果想了解 `just setup` 在底层做了什么，可以查看仓库根目录中的 [`justfile`](https://github.com/rolldown/rolldown/blob/main/justfile)。

:::

现在可以继续阅读下一章 [构建与运行](./building-and-running.md)。如果希望深入了解配置过程，请继续阅读本页。

## 深入了解

本节将详细介绍构建和运行 Rolldown 所需安装的工具与依赖。

### 配置 Rust

Rolldown 基于 Rust 构建，因此环境中必须存在 `rustup` 和 `cargo`。可以从 [官方网站安装 Rust](https://www.rust-lang.org/tools/install)。

### 配置 Node.js

Rolldown 是使用 [NAPI-RS](https://napi.rs/) 构建并发布到 npm registry 的 npm 包，因此需要 Node.js 和 pnpm（用于依赖管理）。

建议使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 等版本管理器安装 Node.js。请确保安装并使用 Node.js {{ data.nodeVersion }} 或更高版本，这是本项目的最低要求。如果已经在使用自己选择的 Node.js 版本管理器，并且当前版本满足要求，可以跳过此步骤。

#### 配置 pnpm

建议通过 [corepack](https://nodejs.org/api/corepack.html) 启用 pnpm，这样处理本项目时便会自动使用正确的 pnpm 版本：

```shell
corepack enable
```

以验证所有内容均已正确配置。
