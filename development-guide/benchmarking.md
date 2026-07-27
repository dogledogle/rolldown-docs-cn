# 基准测试

## 准备工作

运行基准测试前，请使用以下命令准备所需的测试夹具：

```shell
# 在项目根目录中
just setup-bench
```

## Rust 基准测试

`bench-rust` 会自动构建 Rust 代码，无需手动构建。

```shell
# 在项目根目录中
just bench-rust
```

## Node.js 基准测试

请先确保以 release 模式构建 Node.js 绑定：

```shell
just build-rolldown-release
```

然后运行：

```sh
just bench-node
```
