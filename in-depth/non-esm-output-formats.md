# 非 ESM 输出格式

Rolldown 支持非 ESM 输出格式。ESM 中的部分功能无法用于非 ESM 格式，Rolldown 会针对这些功能输出提示信息或提供 polyfill。

## 顶层 await

非 ESM 格式不支持顶层 await。如果输出格式不是 ESM，而 Rolldown 遇到了顶层 await，就会报错。

## `import.meta`

在非 ESM 格式中，`import.meta` 会导致语法错误。为避免这一问题，Rolldown 会用其他值替换 `import.meta`。

### 常见的 `import.meta` 属性 {#well-known-import-meta-properties}

Rolldown 支持以下常见的 `import.meta` 属性：

- `import.meta.url`
- `import.meta.dirname`
- `import.meta.filename`

输出格式为 CJS 时，Rolldown 会为这些属性提供 polyfill。在其他格式中，它们会按照普通属性处理。

:::: tip 在 IIFE 和 UMD 中为 `import.meta.url` 提供 polyfill

Rollup 支持在 IIFE 和 UMD 格式中为 `import.meta.url` 提供 polyfill，但 Rolldown 暂不支持此功能。如果有此需求，可以使用以下配置：

::: code-group

```ts [rolldown.config.ts (IIFE)]
import { defineConfig } from 'rolldown';

const importMetaUrlPolyfillVariableName = '__import_meta_url__';

export default defineConfig({
  transform: {
    define: {
      'import.meta.url': importMetaUrlPolyfillVariableName,
    },
  },
  output: {
    format: 'iife',
    intro:
      "var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;" +
      `var ${importMetaUrlPolyfillVariableName} = (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('main.js', document.baseURI).href)`,
  },
});
```

```ts [rolldown.config.ts (UMD)]
import { defineConfig } from 'rolldown';

const importMetaUrlPolyfillVariableName = '__import_meta_url__';

export default defineConfig({
  transform: {
    define: {
      'import.meta.url': importMetaUrlPolyfillVariableName,
    },
  },
  output: {
    format: 'umd',
    intro:
      "var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;" +
      `var ${importMetaUrlPolyfillVariableName} = (typeof document === 'undefined' && typeof location === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : typeof document === 'undefined' ? location.href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('main.js', document.baseURI).href))`,
  },
});
```

:::

::::

### 其他属性和 `import.meta` 对象本身

其他属性以及 `import.meta` 对象本身都会被替换为 `{}`。由于这种处理无法保留原始值，Rolldown 会在此情况下发出警告。
