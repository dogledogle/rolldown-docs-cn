# 导入属性

## 概览

导入属性是导入语句中的 `with { ... }` 子句：

```js
import config from './config.json' with { type: 'json' };
const data = await import('./data.json', { with: { type: 'json' } });
```

Node.js 和浏览器要求使用 `with { type: 'json' }` 才能导入 JSON，浏览器还要求使用 `with { type: 'css' }` 才能导入 CSS 模块脚本。这类导入在为这些运行时编写的代码中很常见，包括你的依赖项。

启用 `experimental.importAttributes` 后，Rolldown 会将使用不同属性导入的同一文件视为不同模块。插件可以在 `resolveId`、`load` 和 `transform` 中读取属性，并可在 `resolveId` 中修改它们。设计背景请参阅 [RFC](https://github.com/rolldown/rolldown/discussions/11217)。

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  experimental: {
    importAttributes: true,
  },
});
```

::: warning 实验性
`experimental.importAttributes` 默认关闭。开启后会改变带属性导入的模块 id。如果你的项目使用自定义插件，请先阅读[迁移插件](#migrating-plugins)。同时请查看[限制](#limitations)。
:::

## 支持的语法

Rolldown 会从静态导入、重新导出以及带有静态 `with` 对象的动态导入中读取属性：

| 语法                                                    | `attributes`       |
| ------------------------------------------------------- | ------------------ |
| `import x from 'a' with { type: 'json' }`               | `{ type: 'json' }` |
| `export * from 'a' with { type: 'json' }`               | `{ type: 'json' }` |
| `import('a', { with: { type: 'json' } })`               | `{ type: 'json' }` |
| `import x from 'a' assert { type: 'json' }`             | `{ type: 'json' }` |
| `import('a', options)`，其中 `options` 不是字面量       | `{}`               |
| `require()`、`new URL()`、CSS `@import`                 | `{}`               |

Rolldown 在构建时读取属性，因此 `import()` 的选项必须直接写在调用中。如果它们来自变量，例如 `import('./data.json', options)`，则不会提取属性。

Rolldown 会将已移除的 `assert` 关键字视为 `with` 以保持兼容，但此支持将在未来移除。

## 工作原理

### 模块 id {#module-ids}

启用该选项后，导入属性会成为模块 id 的一部分。插件会为每个模块看到三个值：

| 值           | 描述                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `rawId`      | 不带属性的已解析 id。这是要读取和监听的文件。                                                       |
| `attributes` | 以 `Record<string, string>` 表示的导入属性。`{}` 表示没有属性。                                     |
| `id`         | 模块 id，由 `rawId` 和 `attributes` 构建。没有属性时等于 `rawId`。                                  |

id 的形式为 `rawId?attributes=<encoded attributes>`。Rolldown 会按 key 对属性排序，使用 `JSON.stringify` 序列化，并用 `encodeURIComponent` 编码结果。如果 `rawId` 已包含 `?`，分隔符则为 `&`。

```js
import config from './config.json' with { type: 'json' };
import small from './logo.png' with { size: '100' };
import large from './logo.png' with { size: '400' };
import original from './logo.png';
```

| 导入                                 | `rawId`            | `attributes`       | `id`                                                        |
| ------------------------------------ | ------------------ | ------------------ | ----------------------------------------------------------- |
| `'./config.json'` `{ type: 'json' }` | `/src/config.json` | `{ type: 'json' }` | `/src/config.json?attributes=%7B%22type%22%3A%22json%22%7D` |
| `'./logo.png'` `{ size: '100' }`     | `/src/logo.png`    | `{ size: '100' }`  | `/src/logo.png?attributes=%7B%22size%22%3A%22100%22%7D`     |
| `'./logo.png'` `{ size: '400' }`     | `/src/logo.png`    | `{ size: '400' }`  | `/src/logo.png?attributes=%7B%22size%22%3A%22400%22%7D`     |
| `'./logo.png'`（无属性）             | `/src/logo.png`    | `{}`               | `/src/logo.png`（不变）                                     |

::: warning 避免使用 `?attributes`
避免在你自己的 id 中将查询参数命名为 `attributes`。如果其值恰好符合此格式，Rolldown 和 `parseModuleId` 会将其读取为导入属性。
:::

### 外部模块 {#external-modules}

在 ESM 输出中，[外部模块](/in-depth/external-modules)的导入会保留其属性，包括动态 `import()`。无论是否启用 `experimental.importAttributes`，这一点都成立。未启用该选项时，带属性导入的外部模块仍会在其[模块 id](#module-ids) 中包含这些属性，例如在 `this.getModuleIds()` 中。

启用该选项后，`resolveId` 钩子可以更改输出中的属性。如果 [`external`](/reference/InputOptions.external) 选项在解析前将某个导入标记为外部模块，`resolveId` 钩子不会运行，因此该导入会保留源代码中写下的属性。

对于 `cjs`、`iife` 和 `umd` 输出，请参阅[非 ESM 输出格式](/in-depth/non-esm-output-formats#import-attributes)。

### 内置 `type` 属性 {#built-in-type-attributes}

启用该选项后，`type` 属性会选择 Rolldown 的某个[模块类型](/in-depth/module-types)。常见情况无需插件即可工作：

| 属性            | 模块类型 | 默认导出     |
| --------------- | -------- | ------------ |
| `type: 'json'`  | `json`   | 解析后的 JSON |
| `type: 'text'`  | `text`   | `string`     |
| `type: 'bytes'` | `binary` | `Uint8Array` |

```js
import config from './config.json' with { type: 'json' };
import shader from './shader.glsl' with { type: 'text' };
import wasm from './module.wasm' with { type: 'bytes' };
import data from './data.txt' with { type: 'json' };
```

Rolldown 按以下优先级确定模块类型（从高到低）：

1. `load` 钩子返回的 `moduleType`。
2. `type` 属性，当其值为 `json`、`text` 或 `bytes` 时。
3. 文件扩展名，包括 [`moduleTypes`](/reference/InputOptions.moduleTypes) 选项中的任何映射。

其他 `type` 值（例如 `'css'`）没有内置含义，会原样传递给插件。插件可以在其 `load` 钩子中处理它们。

## 插件 API

未启用该选项时，下列字段仍然存在，但 `attributes` 始终为 `{}`，且 `resolveId` 返回的 `attributes` 会被忽略。唯一例外是用于外部模块的 `this.resolve`，它会返回导入的属性。

### `resolveId`

```ts
resolveId(
  source: string,
  importer: string | undefined,
  extraOptions: {
    // ...
    // new: attributes of this import
    attributes: Record<string, string>;
    // new: `importer` without its attributes
    importerRawId: string | undefined;
    // new: attributes of the importer
    importerAttributes: Record<string, string>;
  },
): string | false | null | undefined | PartialResolvedId;

interface PartialResolvedId {
  // ...
  // new: replaces the attributes of the import
  attributes?: Record<string, string>;
}
```

由于 `importer` 包含导入方的属性，请使用 `importerRawId` 获取其文件。

返回 `attributes` 可替换导入的属性，返回 `{}` 可移除属性。`load` 和 `transform` 无法更改它们。

例如，要为外部 JSON 导入添加 Node.js 所需的属性：

```js
resolveId(source) {
  if (source.endsWith('.json')) {
    return { id: source, external: true, attributes: { type: 'json' } };
  }
},
// input:  import pkg from '../package.json'
// output: import pkg from '../package.json' with { type: "json" };
```

::: info 注意
`resolveDynamicImport` 钩子会收到相同的新选项，也可以返回 `attributes`。
:::

### `load`

```ts
load(
  id: string,
  // new
  options: {
    // `id` without attributes
    rawId: string;
    // attributes of the module
    attributes: Record<string, string>;
  },
): LoadResult;
```

### `transform`

```ts
transform(
  code: string,
  id: string,
  meta: {
    // ...
    // new: `id` without attributes
    rawId: string;
    // new: attributes of the module
    attributes: Record<string, string>;
  },
): TransformResult;
```

### `this.resolve`

```ts
this.resolve(
  source: string,
  // changed: also accepts `{ rawId, attributes }`
  importer?: string | { rawId: string; attributes?: Record<string, string> },
  options?: {
    // ...
    // new: attributes of the simulated import
    attributes?: Record<string, string>;
  },
): Promise<ResolvedId | null>;

interface ResolvedId {
  // ...
  // without attributes
  id: string;
  // new: final attributes
  attributes: Record<string, string>;
}
```

### `this.load`

```ts
this.load(options: {
  // ...
  // changed: also accepts `{ rawId, attributes }`
  id: string | { rawId: string; attributes?: Record<string, string> };
}): Promise<ModuleInfo>;
```

属性仅来自 `id`。要加载带有属性的 `this.resolve` 结果，请将 `{ rawId: resolved.id, attributes: resolved.attributes }` 作为 `id` 传入。

## 辅助函数

只有 `resolveId`、`load`、`transform`、`this.resolve` 和 `this.load` 提供 `rawId` 与 `attributes`。在其他地方，插件拿到的是组合 id：

| 位置                                                                                              | 字段                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `this.getModuleInfo()`、`moduleParsed`                                                            | `id`、`importedIds`、`importers`、`dynamicImporters` |
| `this.getModuleIds()`                                                                             | 所有带导入属性的返回 id                              |
| `renderChunk`、`generateBundle` 中的输出代码块                                                    | `facadeModuleId`、`moduleIds`、`modules` 的 key      |
| `onLog`、`onwarn`                                                                                 | `log.id`                                             |
| 选项回调，例如[代码拆分组](/in-depth/manual-code-splitting)的 `test`                              | 模块 id                                              |

使用 `rolldown/utils` 中的 `parseModuleId` 和 `stringifyModuleId` 处理这些 id：

```ts
function parseModuleId(id: string): { rawId: string; attributes: Record<string, string> };
function stringifyModuleId(rawId: string, attributes?: Record<string, string>): string;
```

```js
import { parseModuleId, stringifyModuleId } from 'rolldown/utils';

parseModuleId('/src/a.json?attributes=%7B%22type%22%3A%22json%22%7D');
// → { rawId: '/src/a.json', attributes: { type: 'json' } }

stringifyModuleId('/src/a.json', { type: 'json' });
// → '/src/a.json?attributes=%7B%22type%22%3A%22json%22%7D'

// warn about JSON files imported without `type: 'json'`
moduleParsed(info) {
  const { rawId, attributes } = parseModuleId(info.id);
  if (rawId.endsWith('.json') && attributes.type !== 'json') {
    this.warn(`${rawId} is imported without { type: 'json' }`);
  }
},
```

::: info 注意
[`output.paths`](/reference/OutputOptions.paths)、[`output.globals`](/reference/OutputOptions.globals) 和 [`treeshake.moduleSideEffects`](/reference/InputOptions.treeshake) 接收的是 `rawId`，而不是组合 id。
:::

## 迁移插件 {#migrating-plugins}

启用该选项后，将模块 id 当作文件路径处理的插件可能会出错。下面各节涵盖常见情况及其修复方法。在真实项目中，最常见的触发场景是 Node 兼容代码中的 JSON，例如 `import pkg from './package.json' with { type: 'json' }`。

### 从 `rawId` 读取文件

`id` 可能以属性后缀结尾，因此它不总是文件路径。请从 `rawId` 读取文件：

```js
// before: fails with ENOENT for a module with attributes
load(id) {
  return fs.readFile(id, 'utf8');
}

// after
load(id, { rawId }) {
  return fs.readFile(rawId, 'utf8');
}
```

对于任何将 id 用作路径的代码，也同样适用。`path.extname(id)` 会返回 `.json?attributes=%7B...%7D`，而 `this.addWatchFile(id)` 会监听一个不存在的文件。`path.dirname(id)` 仍然可用，因为 `/` 已在属性内部被编码。

### 匹配扩展名 {#match-the-extension}

检查 `id` 结尾的代码永远无法匹配带属性的模块。请改为检查 `rawId`：

```js
// before: never matches a module with attributes
transform(code, id) {
  if (!id.endsWith('.json')) return;
}

// after
transform(code, id, { rawId }) {
  if (!rawId.endsWith('.json')) return;
}
```

钩子过滤器匹配的是组合 id，因此将扩展名锚定到 id 结尾的过滤器会停止匹配。请允许查询后缀：

```js
import { id, include, makeIdFiltersToMatchWithQuery } from '@rolldown/pluginutils';

// allow a query suffix by hand
filter: { id: /\.json($|\?)/ },

// `@rolldown/pluginutils` turns `/\.json$/` into `/\.json(?:\?.*)?$/`
filter: { id: makeIdFiltersToMatchWithQuery(/\.json$/) },

// composable filters: match the id with its query removed
filter: [include(id(/\.json$/, { cleanUrl: true }))],
```

对于 `json` 和 `text`，你可以改为按 `moduleType` 过滤。模块类型在 `transform` 运行前就已确定，因此带有 `type: 'json'` 的导入已经具有模块类型 `json`：

```js
transform: {
  filter: { moduleType: 'json' },
  handler(code, id, { rawId, attributes }) {
    // ...
  },
}
```

这并不适用于 `bytes`。其模块类型是 `binary`，而且 `transform` 不会在二进制模块上运行。

### 使用 `importerRawId` 比较导入方

如果导入模块本身也是通过属性导入的，那么 `importer` 是它的组合 id。例如，通过 `with { type: 'css' }` 导入的 CSS 文件可能包含 `@import`。请使用 `importerRawId` 获取文件：

```js
// before: `importer` may be `/src/style.css?attributes=...`
resolveId(source, importer) {
  if (!importer?.endsWith('.css')) return;
  // resolve `@import` and `url()` in CSS
}

// after
resolveId(source, importer, { importerRawId }) {
  if (!importerRawId?.endsWith('.css')) return;
  // ...
}
```

### 按模块 id 保存状态

插件通常会在 `resolveId` 中返回一个 id，并以其为键保存数据供 `load` 使用。如果导入带有属性，`load` 收到的该 id 会追加属性。由于带属性与不带属性的模块是不同的模块，请将数据保存在完整模块 id 下：

```js
import { stringifyModuleId } from 'rolldown/utils';

const sources = new Map();

resolveId(source, importer, { attributes }) {
  if (source.startsWith('virtual:')) {
    const id = '\0' + source;
    sources.set(stringifyModuleId(id, attributes), buildSource(source, attributes));
    return id;
  }
},
load(id) {
  return sources.get(id);
},
```

### 转发 `this.resolve` 和 `this.load` 调用

如果你的 `resolveId` 钩子将参数转发给 `this.resolve`，则无需修改。Rolldown 会为你从 `importer` 读取属性：

```js
resolveId(source, importer, options) {
  // importer: '/src/style.css?attributes=%7B%22type%22%3A%22css%22%7D'
  return this.resolve(source, importer, { ...options, skipSelf: true });
},
```

`this.resolve` 会在 `attributes` 字段中返回属性。`this.load` 只会从 `id` 读取属性。因此，要加载带有属性的模块，请将 `{ rawId, attributes }` 作为 `id` 传入：

```js
const resolved = await this.resolve('./data.js', importer, { attributes: { type: 'foo' } });
// resolved: { id: '/src/data.js', attributes: { type: 'foo' }, ... }
const info = await this.load({
  ...resolved,
  id: { rawId: resolved.id, attributes: resolved.attributes },
});
// info.id: '/src/data.js?attributes=%7B%22type%22%3A%22foo%22%7D'
```

未启用该选项时，`resolved.attributes` 为 `{}`，而 `info.id` 为 `/src/data.js`。同一段代码在两种情况下都能工作。

### 检查魔法查询

魔法查询（例如 Vite 的 `?raw`、`?url` 和 `?inline`）会与属性共享查询字符串。同时使用两者的导入会将其都保留在 id 中，因此将查询锚定到 id 结尾的检查会停止匹配：

```js
// import svg from './icon.svg?raw' with { type: 'text' }
// id: '/src/icon.svg?raw&attributes=%7B%22type%22%3A%22text%22%7D'
id.endsWith('?raw'); // false
/[?&]raw\b/.test(id); // true
```

## 与 Rollup 5 的兼容性

Rolldown 遵循 [Rollup 5](https://github.com/rollup/rollup/pull/6266) 的导入属性设计。本节假设 `experimental.importAttributes` 已开启。模块 id 格式相同，因此同一模块在两个打包器中会得到相同的 id。新的钩子字段、`this.resolve` 和 `this.load` 的行为相同，并且 `INVALID_IMPORT_ATTRIBUTE` 会在相同情况下报告。

差异：

- Rolldown 为 `type: 'json'`、`type: 'text'` 和 `type: 'bytes'` 提供内置模块类型。Rollup 5 不会赋予任何属性内置含义。
- Rolldown 始终使用 `with` 渲染外部导入的属性。Rollup 5 可以使用 `output.externalImportAttributes` 丢弃它们，或在已废弃的 `output.importAttributesKey` 下使用 `assert`。
- 对于外部模块的 `import()`，Rolldown 会保留写下的选项，除非 `resolveId` 钩子更改了属性。Rollup 5 始终根据属性重建选项，因此会丢弃值为变量的条目。
- Rolldown 不支持 `this.resolve()` 中已废弃的 `importerAttributes` 选项。请改为将 `importer` 传为 `{ rawId, attributes }`。

尚未支持：

- `ModuleInfo` 和 `RenderedModule` 中的 `rawId` 与 `attributes`
- 代码块中的 `facadeModuleRawId` 和 `facadeModuleAttributes`
- `external` 函数的第四个参数，以及 `output.globals` 和 `output.paths` 函数的 `{ attributes }`
- 当 `output.globals` 的对象形式为同一外部模块的多个属性变体赋予相同全局名称时，`AMBIGUOUS_GLOBAL_NAME` 警告
- 使用 `{ rawId, attributes }` 对象调用 `this.getModuleInfo()`，以及带属性的 `this.emitFile()` 代码块
- `resolveFileUrl` 钩子中的 `moduleRawId` 和 `moduleAttributes`

## 限制 {#limitations}

- 尚不支持 Rolldown 的 dev 模式。
- 钩子过滤器尚无法匹配属性。请改为在钩子中检查 `attributes`。
- Vite 尚不支持该选项。其开发服务器和内置插件仍需更新。
