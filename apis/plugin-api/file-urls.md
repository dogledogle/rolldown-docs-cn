# 文件 URL

要在 JS 代码中引用文件 URL，请使用 `import.meta.ROLLDOWN_FILE_URL_referenceId` 替换形式。它会生成相对于 `import.meta.url` 解析已生成文件的代码，并假定全局 `URL` 可用。该功能开箱即用，适用于 `esm` 格式，也适用于 `node` 平台上的 `cjs` 格式，因为该环境会为 `import.meta.url` 提供 [polyfill](/in-depth/non-esm-output-formats#well-known-import-meta-properties)。对于 `iife` 和 `umd` 格式，需要为 `import.meta.url` 提供 polyfill，或者实现 [`resolveFileUrl`](https://rolldown.rs/reference/Interface.Plugin#resolvefileurl) 钩子，返回不依赖 `import.meta.url` 的代码。该钩子也可用于自定义其他格式的 URL 解析方式。

> [!TIP]
> 为兼容 Rollup，Rolldown 也接受 `import.meta.ROLLUP_FILE_URL_referenceId`，将其作为 `import.meta.ROLLDOWN_FILE_URL_referenceId` 的别名。

以下示例会检测 `.svg` 文件的导入，将导入的文件生成为资源，并返回其 URL，例如可用作 `img` 标签的 `src` 属性：

::: code-group

```js [rolldown-plugin-svg-asset.js]
import path from 'node:path';
import fs from 'node:fs';

function svgResolverPlugin() {
  return {
    name: 'svg-resolver',
    resolveId: {
      filter: { id: /\.svg$/ },
      handler(source, importer) {
        return path.resolve(path.dirname(importer), source);
      },
    },
    load: {
      filter: { id: /\.svg$/ },
      handler(id) {
        const referenceId = this.emitFile({
          type: 'asset',
          name: path.basename(id),
          source: fs.readFileSync(id),
        });
        return `export default import.meta.ROLLDOWN_FILE_URL_${referenceId};`;
      },
    },
  };
}
```

```js [main.js (用法)]
import logo from '../images/logo.svg';
const image = document.createElement('img');
image.src = logo;
document.body.appendChild(image);
```

:::

与资源类似，也可以在 JS 代码中通过 `import.meta.ROLLDOWN_FILE_URL_referenceId` 引用生成的代码块。

以下示例会检测以 `register-paint-worklet:` 为前缀的导入，并生成所需代码和独立代码块，以创建 CSS paint worklet。请注意，该示例只适用于现代浏览器，并且要求输出格式设置为 `es`。

::: code-group

```js [rolldown-plugin-paint-worklet.js]
import { prefixRegex } from '@rolldown/pluginutils';
const REGISTER_WORKLET = 'register-paint-worklet:';

function registerPaintWorkletPlugin() {
  return {
    name: 'register-paint-worklet',
    load: {
      filter: { id: prefixRegex(REGISTER_WORKLET) },
      handler(id) {
        return `CSS.paintWorklet.addModule(
          import.meta.ROLLDOWN_FILE_URL_${this.emitFile({
            type: 'chunk',
            id: id.slice(REGISTER_WORKLET.length),
          })}
        );`;
      },
    },
    resolveId: {
      filter: { id: prefixRegex(REGISTER_WORKLET) },
      handler(source, importer) {
        // 移除前缀，将所有内容解析为绝对 ID，再重新添加前缀。
        // 这样便可使用相对导入定义 worklet。
        return this.resolve(source.slice(REGISTER_WORKLET.length), importer).then(
          (resolvedId) => REGISTER_WORKLET + resolvedId.id,
        );
      },
    },
  };
}
```

```js [main.js (用法)]
import 'register-paint-worklet:./worklet.js';
import { color, size } from './config.js';
document.body.innerHTML += `<h1 style="background-image: paint(vertical-lines);">color: ${color}, size: ${size}</h1>`;
```

```js [worklet.js (用法)]
import { color, size } from './config.js';
registerPaint(
  'vertical-lines',
  class {
    paint(ctx, geom) {
      for (let x = 0; x < geom.width / size; x++) {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.rect(x * size, 0, 2, geom.height);
        ctx.fill();
      }
    }
  },
);
```

```js [config.js (用法)]
export const color = 'greenyellow';
export const size = 6;
```

:::

构建这段代码后，主代码块和 worklet 会通过共享代码块共用 `config.js` 中的代码。这样便可利用浏览器缓存减少传输数据，加快 worklet 的加载速度。

## 传递 `urlId`

::: warning 实验性功能

`urlId` API 处于实验阶段，可能在次版本中发生变化。

:::

Rolldown 扩展了该语法，允许添加可选的 `urlId`（`import.meta.ROLLDOWN_FILE_URL_referenceId_urlId`）。`urlId` 是任意标识符，会以 `args.urlId` 的形式转发给 [`resolveFileUrl`](https://rolldown.rs/reference/Interface.Plugin#resolvefileurl) 钩子。因此，同一个插件可以根据引用位置，以不同方式解析同一生成文件：

```js [rolldown-plugin-svg-resolver.js]
import path from 'node:path';
import fs from 'node:fs';

function svgResolverPlugin() {
  return {
    name: 'svg-resolver',
    load: {
      filter: { id: /\.svg$/ },
      handler(id) {
        const referenceId = this.emitFile({
          type: 'asset',
          name: path.basename(id),
          source: fs.readFileSync(id),
        });
        // 附加 `urlId`，让 `resolveFileUrl` 能够特殊处理该引用。
        return `export default import.meta.ROLLDOWN_FILE_URL_${referenceId}_inline;`;
      },
    },
    resolveFileUrl({ referenceId, relativePath, urlId }) {
      if (urlId === 'inline') {
        // 以不同方式解析内联引用
      }
      // ...
    },
  };
}
```

只有 Rolldown 专用的 `ROLLDOWN_FILE_URL_` 前缀会识别 `urlId`。兼容 Rollup 的 `ROLLUP_FILE_URL_` 别名不会携带 `urlId`。默认解析方式（没有插件处理该引用时）会忽略 `urlId`。

`urlId` 只能包含 ASCII 标识符字符：字母（`a`-`z`、`A`-`Z`）、数字（`0`-`9`）、`_` 和 `$`。
