# ESM 外部 require 插件

`esmExternalRequirePlugin` 是 Rolldown 的内置插件，可将针对外部依赖的 CommonJS `require()` 调用转换为 ESM `import` 语句，从而兼容不支持 Node.js 模块 API 的环境。

::: tip 注意
该插件会把 `resolveId.meta.order` 设置为 `'pre'`，确保外部 require 先于其他插件解析。此外，为兼容 Vite，它默认设置 `enforce: 'pre'`。
:::

## 为什么需要此插件

使用 Rolldown 打包代码时，为保留 `require()` 的语义，针对外部依赖的 `require()` 调用不会自动转换为 ESM import。设置 `platform: 'node'` 后，Rolldown 虽然会注入 `require` 函数，但实现方式是生成以下代码：

```js
import { createRequire } from 'node:module';
var __require = createRequire(import.meta.url);
```

但是，这种方式依赖 Node.js 模块 API，而某些环境并不提供该 API。对于之后还会再次打包的库，这种方式同样存在问题，因为打包器很难分析和转换这段代码。

## 用法

从 Rolldown 的插件导出入口导入并使用该插件：

```js
import { defineConfig } from 'rolldown';
import { esmExternalRequirePlugin } from 'rolldown/plugins';

export default defineConfig({
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    esmExternalRequirePlugin({
      external: ['react', 'vue', /^node:/],
    }),
  ],
});
```

::: warning 外部模块必须由该插件负责
每个模块只能列在该插件的 `external` 选项或顶层 `external` 选项之一，不能同时出现。解析时顶层 `external` 优先，因此插件会完全跳过重复模块。构建会成功但发出警告，而输出在运行时仍会对外部模块调用 `require()`。
:::

## 选项

### `external`

类型：`(string | RegExp)[]`

定义应视为外部模块的依赖。输出格式为 ESM 时，针对它们的 `require()` 调用会转换为 `import` 语句。使用非 ESM 输出格式时，这些依赖仍会标记为外部模块，但 `require()` 调用保持不变。

### `skipDuplicateCheck`

类型：`boolean`
默认值：`false`

启用后，跳过检查该插件与顶层 `external` 选项之间的重复外部模块。如果确定不存在重复项，可以借此提高构建性能。

```javascript
esmExternalRequirePlugin({
  external: ['react', 'vue'],
  skipDuplicateCheck: true, // 跳过重复检查以提高性能
});
```

## 检测重复的外部模块

默认情况下，插件会检查指定的外部模块是否也配置在顶层 `external` 选项中。如果发现重复项，会看到以下警告：

```text
Found 2 duplicate external: `react`, `vue`. Remove them from top-level `external` as they're already handled by 'builtin:esm-external-require' plugin.
```

请把此警告视为正确性问题的信号。插件不会处理重复模块：顶层 `external` 选项具有更高优先级，因此输出中仍会保留本应由该插件转换的原始 `require()` 调用。请从顶层 `external` 中移除重复项。这不会丢失任何配置，因为插件本身也会把所负责的模块标记为外部模块。

`skipDuplicateCheck: true` 并不能让重复配置正常工作，它只会隐藏警告。因此，只有确定没有模块同时出现在两处时才应启用。

## 限制

由于该插件会把 `require()` 调用改为 `import` 语句，打包后存在一些语义差异：

- 解析基于 `import` 而非 `require` 的行为。
  - 例如，会使用 `import` 条件而不是 `require` 条件。
- 得到的值可能与原始 `require()` 调用不同，尤其是包含默认导出的模块。

## 工作原理

该插件会拦截针对选项中指定依赖的 `require()` 调用，并创建虚拟门面模块来：

1. 使用 ESM `import * as m from '...'` 导入依赖。
2. 使用 `module.exports = m` 重新导出，以兼容 CommonJS。
3. 将原始 `require()` 替换为对虚拟模块的引用。

对于非外部模块的 `require()` 调用，Rolldown 会自动包装并转换为 ESM import。

```js
// 输入代码
const react = require('react');

// 转换后的输出
const react = require('builtin:esm-external-require-react');

// 虚拟模块：builtin:esm-external-require-react
import * as m from 'react';
module.exports = m;
```
