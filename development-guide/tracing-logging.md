# 追踪与日志

Rolldown 代码库中包含大量 [`tracing::debug!`]（或 `tracing::trace!`）调用，它们会在许多位置输出日志信息。即使不能直接找到 bug，这些日志也能帮助缩小问题范围，或帮助你理解编译器为何执行某项操作。

[`tracing::debug!`]: https://docs.rs/tracing/0.1/tracing/macro.debug.html

要查看日志，需要将 `RD_LOG` 环境变量设置为日志过滤器。日志过滤器的完整语法请参阅 [`tracing-subscriber` 的 rustdoc](https://docs.rs/tracing-subscriber/0.2.24/tracing_subscriber/filter/struct.EnvFilter.html#directives)。

## 用法

```sh
RD_LOG=debug [executing rolldown]
RD_LOG=debug RD_LOG_OUTPUT=chrome-json [executing rolldown]
```

`RD_LOG_OUTPUT=chrome-json` 要求构建时启用 `chrome-tracing` Cargo feature。性能分析构建（`pnpm build-binding:profile`）会启用该 feature，而 release 构建为了减小发布二进制文件的体积会将其禁用。如果没有启用，Rolldown 会回退到可读的标准输出，并打印警告。

## 添加日志

可以在 PR 中添加 `tracing::debug!` 或 `tracing::trace!` 调用。不过，为避免日志噪声，需要谨慎选择二者。

以下规则有助于选择正确的日志级别：

- 如果不知道该选择哪个级别，请使用 `tracing::trace!`。
- 如果日志消息在一次打包中只会输出一次，请使用 `tracing::debug!`。
- 如果日志消息只会输出一次，但内容大小与打包输入规模有关，请使用 `tracing::trace!`。
- 如果日志消息在一次打包中会输出多次，但次数有限，请使用 `tracing::debug!`。
- 如果日志消息的输出次数会随输入规模增长，请使用 `tracing::trace!`。

这些规则也适用于 `#[tracing::instrument]` 属性。

- 如果函数在一次打包中只调用一次，请使用 `#[tracing::instrument(level = "debug", skip_all)]`。
- 如果函数的调用次数会随输入规模增长，请使用 `#[tracing::instrument(level = "trace", skip_all)]`。

::: info
应该追踪哪些信息带有一定主观性，因此审阅者会决定是否保留追踪语句，或要求在合并前将其移除。
:::

## 函数级过滤器

Rolldown 中的许多函数带有以下注解：

```rust
#[instrument(level = "debug", skip(self))]
fn foo(&self, bar: Type) {}

#[instrument(level = "debug", skip_all)]
fn baz(&self, bar: Type) {}
```

因此可以使用：

```sh
RUSTC_LOG=[foo]
```

一次完成以下操作：

- 记录对 `foo` 的所有函数调用。
- 记录参数（`skip` 列表中的参数除外）。
- 在函数返回前，记录编译器其他位置产生的所有内容。

注意：

通常建议使用 `skip_all`，除非确实有充分理由记录参数。

## 追踪模块解析

Rolldown 使用 [oxc-resolver](https://github.com/oxc-project/oxc-resolver)，后者会公开用于调试的追踪信息。

```bash
RD_LOG='oxc_resolver' rolldown
```

该命令会输出 `oxc_resolver::resolve` 函数的追踪信息，例如：

```text
2024-06-11T07:12:20.003537Z DEBUG oxc_resolver: options: ResolveOptions { ... }, path: "...", specifier: "...", ret: "..."
    at /path/to/oxc_resolver-1.8.1/src/lib.rs:212
    in oxc_resolver::resolve with path: "...", specifier: "..."
```

输入值为 `options`、`path` 和 `specifier`，返回值为 `ret`。
