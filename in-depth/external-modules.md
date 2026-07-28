# 外部模块

模块被标记为外部模块后，Rolldown 不会将其打包，而是在输出中保留 `import` 或 `require` 语句，并假定该模块在运行时可用。

```js
// 输入
import lodash from 'lodash';
console.log(lodash);

// 输出（lodash 是外部模块）
import lodash from 'lodash';
console.log(lodash);
```

本页完整解释外部模块的工作方式：模块如何成为外部模块、如何确定它在输出中的导入路径，以及相关选项和插件钩子如何交互。

## 模块如何成为外部模块

可以通过三种方式将模块标记为外部模块：

1. **[`external`](https://rolldown.rs/reference/InputOptions.external) 选项**：配置级模式（字符串、正则表达式、数组或函数），用于测试每个导入说明符。模式语法、示例和注意事项请参阅 [选项参考](https://rolldown.rs/reference/InputOptions.external)。

2. **插件的 `resolveId` 钩子**：插件可以返回 `{ id, external: true }`（或 `"relative"` / `"absolute"`），明确将模块标记为外部模块。插件也可以 `return false`，使用与 `external` 选项相同的规范化方式将原始说明符标记为外部模块。

3. **无法解析的模块**：如果插件和内部解析器都找不到模块，但 `external` 选项匹配该说明符，Rolldown 会将其视为外部模块，而不是抛出错误。

## 完整解析流程

Rolldown 遇到导入时会依次执行以下步骤：

### 1. 第一次 `external` 检查

使用 `isResolved: false`，根据 [`external`](https://rolldown.rs/reference/InputOptions.external) 选项测试原始导入说明符（例如 `'./utils'`、`'lodash'`）。如果匹配，会立即将模块标记为外部模块，**完全跳过插件和内部解析器**。

### 2. 插件 `resolveId`

如果第一次检查未匹配，插件将有机会解析导入：

| 插件返回值                            | 效果                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `return false`                        | 外部模块。使用原始说明符作为模块 ID（与步骤 1 采用相同规范化方式）。              |
| `return { id, external: true }`       | 外部模块。使用 `id` 作为模块 ID。                                                 |
| `return { id, external: "relative" }` | 外部模块。路径**始终**转换为相对路径（覆盖配置）。                                |
| `return { id, external: "absolute" }` | 外部模块。路径**始终**原样保留（覆盖配置）。                                      |
| `return { id }`（没有 `external`）    | 已解析，使用解析后的 ID 继续步骤 3。                                              |
| `return null`                         | 没有插件处理，进入步骤 3。                                                        |

### 3. 内部解析器

Rolldown 的内置解析器尝试在磁盘上查找模块。

### 4. 第二次 `external` 检查

使用 `isResolved: true`，根据 [`external`](https://rolldown.rs/reference/InputOptions.external) 选项测试解析后的 ID（例如 `'/project/node_modules/vue/dist/vue.runtime.esm-bundler.js'`）。如果匹配，会将该说明符标记为外部模块。

### 5. 确定输出路径

无论在哪一步将模块标记为外部模块（第一次检查、插件或第二次检查），都会统一应用 [`makeAbsoluteExternalsRelative`](https://rolldown.rs/reference/InputOptions.makeAbsoluteExternalsRelative)，确定输出中的导入路径：

- **裸说明符**（例如 `'lodash'`、`'node:fs'`）：在第一次检查中匹配时会原样输出。如果在第二次检查（解析后的路径）中匹配，则会输出完整解析路径（参阅 [有关 `/node_modules/` 的注意事项](https://rolldown.rs/reference/InputOptions.external#avoid-node-modules-for-npm-packages)）。

- **相对和绝对说明符**：会进行两项处理：
  1. **解析时规范化**：对于第一次检查和 `return false`，启用 `makeAbsoluteExternalsRelative`（默认启用）后，会相对于导入方目录解析相对说明符（即**原始导入说明符**），并将其规范化为绝对路径。这样，从不同目录导入的 `'./utils'` 会正确映射到不同的外部模块。对于第二次检查和 `return { id, external: true }`，**解析后的模块 ID** 已经是绝对路径。

  2. **渲染时输出**：绝对的已解析模块 ID 可能会从输出代码块所在位置转换回相对路径（例如 `'/project/src/utils.js'` → `'./utils.js'`）。是否转换取决于 `makeAbsoluteExternalsRelative` 的值，以及原始导入说明符是否为相对路径。

插件覆盖值（`external: "relative"` / `"absolute"`）会完全跳过这套逻辑。各个值如何控制此行为及相关示例，请参阅 [`makeAbsoluteExternalsRelative` 参考](https://rolldown.rs/reference/InputOptions.makeAbsoluteExternalsRelative)。

## 特殊情况

### Data URL

包含有效 `data:` URL（例如 `data:text/javascript,export default 42`）且文件格式受支持的说明符，由 Rolldown 内部 dataurl 插件处理；该插件会**打包内联内容**。它们不会自动视为外部模块。

其他 `data:` URL 会自动视为外部模块，除非由自定义插件处理。

### HTTP URL

以 `http://`、`https://` 或 `//` 开头的说明符，无论 `external` 选项如何配置，都会**自动视为外部模块**，除非由自定义插件处理。这些 ID 会原样输出，不受 `makeAbsoluteExternalsRelative` 影响。

```js
import lib from 'https://cdn.example.com/lib.js';
// 始终为外部模块，原样输出
```

## 移除未使用的导入

如果从外部模块导入的内容没有任何用途，Rolldown 会将其移除。

```js
// 输入
import { used, unused } from 'ext-pkg';
console.log(used);

// 输出
import { used } from 'ext-pkg';
console.log(used);
```

请注意，即使所有导入项都被移除，语句本身通常仍会保留。外部模块被假定具有副作用，因此语句会变为裸导入 `import 'ext-pkg';`。只有外部模块也被标记为无副作用时，语句才会完全消失。

::: warning 与已打包模块的区别

如果已打包模块实际没有导出 `unused`，无论是否使用该导入项，Rolldown 都会在构建时生成 `MISSING_EXPORT` 错误。

对于外部模块，Rolldown 不知道存在哪些导出项，因此无法检查。如果 `unused` 不存在，导入它会在运行时抛出错误，而移除该导入也会一并消除错误。通常，在没有任何提示的情况下改变语义并不妥当，但 Rolldown 在这里作了例外处理。未使用的导入通常来自 Rolldown 自身或插件执行的无用代码消除，而不是手写代码，因此这个错误很少是你真正想看到的错误。

:::
