# 模块类型

作为 Web 打包器，Rolldown 内置支持的文件类型并不只有 JavaScript。例如，Rolldown 可以直接处理 TypeScript 和 JSX 文件，在打包前将它们解析并转换为 JavaScript。我们把 Rolldown 中获得一等支持的这些文件类型称为**模块类型（Module Types）**。

## 模块类型如何影响用户

Rolldown 会自动识别和处理已知的模块类型，因此最终用户通常无需关心这一概念。

默认情况下，Rolldown 根据文件扩展名判断模块类型。但在某些情况下，这还不够。例如，一个包含 JSON 数据的文件使用了 `.data` 扩展名。由于扩展名不是 `.json`，Rolldown 无法将其识别为 JSON 文件。

这时，用户需要明确告诉 Rolldown，应将扩展名为 `.data` 的文件视为 JSON 模块类型。可以通过配置中的 `moduleTypes` 选项实现：

```js [rolldown.config.js]
export default {
  moduleTypes: {
    '.data': 'json',
  },
};
```

## 模块类型与插件

插件可以通过 `load` 和 `transform` 钩子指定某个文件的模块类型：

```js
const myPlugin = {
  load(id) {
    if (id.endsWith('.data')) {
      return {
        code: '...',
        moduleType: 'json',
      };
    }
  },
};
```

模块类型的主要意义在于，它为支持的类型提供了统一约定，让多个需要处理同一模块类型的插件更容易串联起来。

例如，`@vitejs/plugin-vue` 目前会为 `.vue` 文件中的样式块创建虚拟 CSS 模块，并在虚拟模块的 ID 后附加 `?lang=css`，让 Vue 插件能够将这些模块识别为 CSS。但这只是 Vue 插件内部的约定，其他插件可能会忽略查询字符串，因而无法识别这一约定。

有了模块类型，`@vitejs/plugin-vue` 可以将虚拟 CSS 模块的类型明确指定为 `css`，PostCSS 等其他插件无需了解 Vue 插件，也能处理这些 CSS 模块。

再举一例：要支持 `.jsonc` 文件，插件只需在 `load` 钩子中移除 `.jsonc` 文件的注释，并返回 `moduleType: 'json'`，其余工作交给 Rolldown 即可。
