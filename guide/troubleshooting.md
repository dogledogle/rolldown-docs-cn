# 故障排除

## 性能

性能是 Rolldown 的首要目标之一。不过，构建性能并不完全取决于 Rolldown 本身，运行环境和所使用的插件同样会产生显著影响。

我们一直在努力改进 Rolldown，以尽量减少这些外部因素的影响，但仍存在一些固有限制，部分优化工作也还在进行中。本指南将介绍潜在的瓶颈以及相应的缓解方法。

### 环境

操作系统及其配置可能影响构建时间，文件系统操作尤其如此。

#### Windows

与 macOS 或 Linux 等其他操作系统相比，Windows 的文件系统访问通常更慢，防病毒软件尤其可能让情况进一步恶化。即使没有防病毒程序干扰，其文件系统的基础性能也往往较低：比 macOS 慢 3 倍，比 Linux 慢 10 倍。当大多数转换无需插件即可完成时，文件系统会成为瓶颈。

为了提升 Windows 上的性能，可以考虑使用其他文件系统环境：

1. [**Dev Drive**](https://learn.microsoft.com/en-us/windows/dev-drive/)：面向开发者工作负载设计的一项较新的 Windows 功能，使用弹性文件系统（ReFS）。在文件系统操作方面，与标准 Windows NTFS 文件系统相比，使用 Dev Drive 可以实现 **2 到 3 倍的加速**。
2. [**适用于 Linux 的 Windows 子系统（WSL）**](https://learn.microsoft.com/en-us/windows/wsl/)：WSL 让 Linux 环境可以轻松地在 Windows 上运行，并提供显著更好的文件系统性能。将项目文件放在 WSL 中并在其中执行构建，在文件系统操作方面可以达到标准 Windows NTFS 文件系统约 **10 倍的速度**。

::: details 基准测试参考

所使用的基准测试脚本在这篇博客文章中有所介绍：[打开 1000 个文件能有多快？](https://lemire.me/blog/2025/03/01/how-fast-can-you-open-1000-files/)

测试结果如下：

|           文件系统 / 线程数 |     1 |     2 |     4 |     8 |    16 |
| --------------------------: | ----: | ----: | ----: | ----: | ----: |
|                Windows NTFS | 286ms | 153ms |  85ms | 106ms | 110ms |
| Windows Dev Drive（ReFS）   | 124ms |  67ms |  35ms |  48ms |  55ms |
|                  WSL（ext4） |  24ms |  13ms | 7.8ms | 9.0ms |  13ms |

基准测试在以下环境中运行：

- 操作系统：Windows 11 Pro 23H2 22631.5189
- CPU：AMD Ryzen 9 5900X
- 内存：DDR4-3600 32GB
- SSD：Western Digital Black SN850X 1TB

:::

<!-- 也许还可以介绍 macOS？ -->

### 插件

插件可以扩展 Rolldown 的功能，但也可能带来性能开销。

#### 插件钩子过滤器

Rolldown 提供了名为**插件钩子过滤器**的功能。它允许你精确指定插件钩子应该处理哪些模块，从而减少 JavaScript 与 Rust 之间的通信开销。有关过滤器内部工作原理的详细信息，请参阅 [钩子过滤器](/apis/plugin-api/hook-filters) 页面。

如果你是插件使用者，而所使用的插件没有指定钩子过滤器，可以使用 Rolldown 导出的 `withFilter` 实用函数为它添加过滤器。

```js
import yaml from '@rollup/plugin-yaml';
import { defineConfig } from 'rolldown';
import { withFilter } from 'rolldown/filter';

export default defineConfig({
  plugins: [
    // 仅对以 `.yaml` 结尾的模块运行 `yaml` 插件的 transform 钩子
    withFilter(yaml({ /* ... */ }), { transform: { id: /\.yaml$/ } }),
  ],
});
```

#### 利用内置功能

Rolldown 包含多项为提升效率而设计的内置功能。在可能的情况下，应该优先使用这些原生能力，而不是功能相似的外部 Rollup 插件。使用内置功能通常意味着处理过程可以完全在 Rust 中执行，并能够并行处理。

请查看 [Rolldown 功能](/guide/notable-features) 页面，了解 Rollup 不具备的能力。

例如，以下常见的 Rollup 插件可以用 Rolldown 的内置功能替代：

- `@rollup/plugin-alias`：[`resolve.alias`](https://rolldown.rs/reference/InputOptions.resolve#alias) 选项
- `@rollup/plugin-commonjs`：开箱即用
- `@rollup/plugin-inject`：[`inject`](/guide/notable-features#inject) 选项
- `@rollup/plugin-replace`：[`replacePlugin`](/builtin-plugins/replace)
- `@rollup/plugin-node-resolve`：开箱即用
- `@rollup/plugin-json`：开箱即用
- `@rollup/plugin-swc`、`@rollup/plugin-babel`、`@rollup/plugin-sucrase`：通过 Oxc 开箱即用（复杂配置可能仍需使用插件）
- `@rollup/plugin-terser`：`output.minify` 选项

<!--
实验性插件（是否要介绍这些插件？）

- `@rollup/plugin-dynamic-import-vars`：`import { viteDynamicImportVarsPlugin } from 'rolldown/experimental'`

-->

## 避免直接使用 `eval`

`eval()` 函数会求值一个包含 JavaScript 代码的字符串。`eval()` 调用分为两种模式：直接 eval 和间接 eval。直接 eval 是指直接调用全局 `eval` 函数的情况。与间接 eval 不同，直接 eval 允许传入的字符串访问调用方局部作用域中的变量。

在打包代码时，直接 eval 会因多种原因造成问题：

- Rolldown 会应用一种名为“作用域提升”的优化，将多个文件放入同一作用域。然而，这意味着由直接 `eval` 求值的代码可以读写打包产物中其他文件的变量！这会造成正确性问题，因为被求值的代码可能原本要访问全局变量，却意外访问了另一个文件中同名的私有变量。如果其他文件的私有变量包含敏感数据，**这甚至可能成为安全问题**。
- Rolldown 可能会重命名打包产物中的部分变量，以避免名称冲突。不使用直接 eval 时，这不会造成问题；但直接 eval 求值的代码可能会尝试通过原名称引用已经重命名的变量。
- 为保证正确性，压缩器不会改写可能被直接 eval 代码引用的变量名。直接 eval 还会阻止其他优化，因此无法有效缩减输出代码。

好在通常很容易避免使用直接 eval。下面是两种常用替代方案，它们可以避开上述所有弊端：

- `(0, eval)('x')`

  这是最常见的间接 eval 用法。此外还有其他触发间接 eval 的方式，例如 `var eval2 = eval; eval2('x')`、`[eval][0]('x')` 和 `window.eval('x')` 都属于间接 eval 调用。使用间接 eval 时，代码会在全局作用域中求值，而不是在调用方的内联作用域中求值。

- `new Function('x')`

  这会在运行时构造一个新的函数对象。它相当于在全局作用域中编写 `function() { x }`，但 `x` 可以是任意代码字符串。这种形式有时很方便，因为可以为函数添加参数，并通过这些参数向被求值的代码公开变量。例如，`(new Function('env', 'x'))(someEnv)` 相当于编写 `(function(env) { x })(someEnv)`。当被求值的代码需要访问局部变量时，这通常足以替代直接 `eval`，因为你可以将局部变量作为参数传入。

## 避免在导出函数中依赖 `this`

在 JavaScript 中，`this` 是一个特殊变量，通常会根据函数的调用方式绑定到不同的值。例如，当函数作为对象的方法调用时，`this` 变量会绑定到该对象。

```js
const obj = {
  method() {
    console.log(this); // 此处的 `this` 是 `obj`
  },
};
obj.method();
```

与此类似，根据 ECMAScript 规范，当函数从模块中导出并通过模块命名空间对象调用时，`this` 变量会绑定到该模块命名空间对象。

```js
// imported.js
export function method() {
  console.log(this); // 此处的 `this` 是 `imported.js` 的模块命名空间对象
}

// main.js
import * as namespace from './imported.js';
namespace.method();
```

然而，在这种情况下，**Rolldown 不一定会保留 `this` 的值**。因此，建议避免在导出函数中依赖 `this`。不过，大多数打包器都有这种行为，实际使用中通常不会造成问题。

之所以如此，是因为保留 `this` 的值会限制摇树优化的空间。例如，如果 `this` 变量需要绑定到模块命名空间对象，那么即使某些导出并未通过 `import` 使用，也无法对该模块中的所有导出执行摇树优化。

::: tip 输出 CJS 时的类似问题

与上述问题类似，将代码输出为 CJS 时，Rolldown 不一定会保留导出函数的 `this` 值。在这种情况下，本应为 `undefined` 的 `this` 可能会绑定到 `module.exports` 对象。

:::

## 避免依赖暂时性死区（TDZ）错误

在 ECMAScript 中，`let`、`const` 和 `class` 声明所创建的绑定从作用域开始处就已经存在，但在声明本身被求值前一直处于未初始化状态。在这段期间读取绑定，即使通过 `typeof` 读取，也会抛出 `ReferenceError`。这段区域称为“暂时性死区（Temporal Dead Zone，TDZ）”。

```js
typeof x; // ReferenceError: Cannot access 'x' before initialization
let x = 1;
```

然而，出于正确性和性能等多方面原因，**Rolldown 不一定会保留 TDZ 语义**。依赖访问 TDZ 时抛出错误的代码，在打包后的输出中可能表现不同，因此应该避免这样做。

例如，Rolldown 总会将模块顶层的 `class X {}` 重写为 `var X = class {}`，使该绑定能够与其他顶层声明一起提升。因此，在执行到声明之前，观察到的绑定值会是 `undefined`，而不是抛出错误。将 [`output.topLevelVar`](https://rolldown.rs/reference/OutputOptions.topLevelVar) 设为 `true`，会对顶层 `let` 和 `const` 应用相同的重写。

```js
// 在 ESM 中，此处会抛出 ReferenceError。
// 在 Rolldown 的打包输出中，`typeof X` 的求值结果为 `"undefined"`。
console.log(typeof X);
class X {}
```

再举一个例子，即使存在导入循环，Rolldown 也可能在使用位置内联导出的 `const` 值。当循环导致代码在常量声明执行前读取它时，ESM 会抛出错误，而 Rolldown 会直接返回内联的值。

::: code-group

```js [entry.js]
import './constants.js';
```

```js [constants.js]
export const foo = 123;
export function bar() {
  return foo;
}
import './cycle.js';
```

```js [cycle.js]
import { bar } from './constants.js';
// 在 ESM 中，`bar()` 会抛出 ReferenceError，因为 `foo` 处于 TDZ 中。
// 在 Rolldown 的打包输出中，`bar()` 返回 `123`。
console.log(bar());
```

:::

## 警告："Sourcemap is likely to be incorrect"

如果你为打包产物生成 source map（[`sourcemap: true`](https://rolldown.rs/reference/OutputOptions.sourcemap) 或 `sourcemap: 'inline'`），但使用了一个或多个转换代码时未生成相应 source map 的插件，就会看到此警告。

通常，插件只会在它自身（而非打包产物）配置了 `sourcemap: false` 时省略 source map，因此只需修改该配置即可。如果插件不支持生成 source map，可以考虑向插件作者提交 issue。

## 错误："Cannot find module '@rolldown/binding-...'"

此错误表示 Node.js 找到了 `rolldown` 包，却没有找到平台专用的原生包。它通常由 npm 的一个已知可选依赖错误（[npm/cli#4828](https://github.com/npm/cli/issues/4828)）引起。如果使用 npm 安装，删除 `node_modules` 和 `package-lock.json` 后重新安装即可解决。

当配置文件位于指向另一个项目的符号链接目录中时，也可能发生此问题，例如 Windows 与 WSL 之间共享的目录（[#9854](https://github.com/rolldown/rolldown/issues/9854)）。Node.js 会先将配置文件解析为其真实路径，再解析其中的导入，因此 `import ... from 'rolldown'` 可能找到为另一个平台安装的 `node_modules`。请将配置文件放在符号链接目录之外，或者设置 `NODE_OPTIONS=--preserve-symlinks` 环境变量后再运行（这与 pnpm 不兼容，因为 pnpm 的 `node_modules` 布局依赖符号链接）。
