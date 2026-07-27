# 代码风格

编写 Rolldown 代码时，建议遵循以下准则。它们并非十分严格的规则，因为我们希望保留灵活性，也明白其中一些规则在特定情况下可能适得其反。请尽可能多地遵循这些准则。

## Rust

### 通用 API 设计

我们倾向于遵循 [Rust API 准则](https://rust-lang.github.io/api-guidelines/)中的建议。这些准则主要由 Rust 库团队编写，源自构建 Rust 标准库和 Rust 生态中其他 crate 的经验。

我们理解这些规则并非在所有场景都适用，但仍应尽可能遵循。

### 规则：文件名应与文件中的主要结构体、trait、枚举或函数同名

示例：

- 如果一个文件实现了 `Resolver` 和 `ResolverConfig` 等结构体，应将文件命名为 `resolver.rs`，因为 `Resolver` 是该文件实现的主要结构体。
- 如果文件中只有一个结构体，例如 `ResolverConfig`，文件应命名为 `resolver_config.rs`，而不是 `config.rs`。
- 如果一个结构体复杂到需要单独的目录，仍应优先把它放在与结构体同名的文件中。例如，将 `bundler.rs` 移至 `bundler/bundler.rs`，而不是 `bundler/mod.rs`。

原因：

理解 Rolldown 代码库时，通常会以结构体、函数和 trait 为线索。如果文件名与结构体名称直接对应，就能更快地找到相关代码。Rolldown 这样的大型代码库包含大量文件和模块，这一点尤其有帮助。

## 其他

### 添加测试

总体而言，我们使用两个环境运行不同目的的测试。更多信息请参阅[测试](./testing.md)。

建议优先考虑在 Rust 端添加测试，原因如下：

- 无需考虑 Rust 与 JavaScript 之间的桥接，调试支持更好。
- 无需编译绑定 crate 和运行 Node.js，开发周期更短。

在以下情况下，可以考虑在 Node.js 端添加测试：

- 测试涉及 JavaScript API 的行为。
- 测试涉及 `rolldown` 包本身的行为。
- 端到端测试。
