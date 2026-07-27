# Replace 插件

`replacePlugin` 是 Rolldown 的内置插件，通过字符串操作替换代码，作用等同于 `@rollup/plugin-replace`。

## 用法

从 Rolldown 的插件导出入口导入并使用该插件：

```js
import { defineConfig } from 'rolldown';
import { replacePlugin } from 'rolldown/plugins';

export default defineConfig({
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    replacePlugin(
      {
        'process.env.NODE_ENV': JSON.stringify('production'),
        __buildVersion: 15,
      },
      {
        preventAssignment: false,
      },
    ),
  ],
});
```

## 选项

### `delimiters`

- **类型：** `[string, string]`
- **默认值：** `["\\b", "\\b(?!\\.)"]`

自定义每个键的匹配方式。只有当键被以下两个模式包围时才会匹配：

- `delimiters[0]`（**左侧**）：键之前必须出现的内容。
- `delimiters[1]`（**右侧**）：键之后必须出现的内容。

二者都是正则表达式。默认值 `["\\b", "\\b(?!\\.)"]` 只在单词边界匹配键，并跳过属性访问，因此 `process.env` 中的 `process` 不会被替换。

### `preventAssignment`

- **类型：** `boolean`
- **默认值：** `false`

防止替换变量声明中的字符串。

```js
replacePlugin({ DEBUG: 'false' }, { preventAssignment: true });

// const DEBUG = true;  // 不替换（赋值）
// console.log(DEBUG);  // 替换为 `false`
```

### `objectGuards`

- **Type:** `boolean`
- **Default:** `false`

自动替换针对对象路径的 `typeof` 检查。

```js
replacePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') }, { objectGuards: true });

// 同时替换：
// typeof process → "object"
// typeof process.env → "object"
```

### `sourcemap`

- **Type:** `boolean`
- **Default:** `false`

为替换结果生成 source map。

## 重要说明

### 替换顺序

插件会按长度降序排列键，以防止局部替换。当替换键互相重叠时，这一点至关重要。

**顺序为何重要：**

```js
// 输入代码：
const apiV2 = API_URL_V2;
const api = API_URL;

replacePlugin({
  API_URL: '"https://api.example.com"',
  API_URL_V2: '"https://api.example.com/v2"',
});

// 不按长度排序（❌ 错误）：
// const apiV2 = "https://api.example.com"_V2;  // 不正确！
// const api = "https://api.example.com";

// 按长度排序（✅ 正确）：
// const apiV2 = "https://api.example.com/v2";  // 先匹配 API_URL_V2
// const api = "https://api.example.com";       // 然后匹配 API_URL
```

插件会优先处理较长的键，因此无需关心定义替换项的顺序。

### 单词边界

默认情况下，替换只发生在单词边界，避免意外替换子字符串。

**示例：**

```js
// 输入代码：
const currentEnv = env;
const environment = getEnvironment();
const config = process.env.NODE_ENV;

replacePlugin({ env: '"production"' });

// 输出：
// const currentEnv = "production";           ✅ 'env' 是独立单词
// const environment = getEnvironment();      ✅ 'env' 是 'environment' 的一部分
// const config = process.env.NODE_ENV;       ✅ 'env' 位于 '.' 后（属性访问）
```

此行为可确保替换 `env` 时不会意外破坏 `environment` 或 `process.env` 等属性访问。如有需要，可以使用 `delimiters` 选项自定义匹配方式。

## 从 @rollup/plugin-replace 迁移

### 功能对比

| 功能            | @rollup/plugin-replace       | Rolldown                        |
| --------------- | ---------------------------- | ------------------------------- |
| API             | `replace({ values: {...} })` | `replacePlugin({...}, options)` |
| 函数值          | ✅ `() => value`             | ❌ 仅支持静态值                 |
| 文件过滤        | ✅ include/exclude           | ❌ 所有文件                     |
| 性能            | JavaScript                   | Rust（更快）                    |

### 迁移示例

```js
// 迁移前（@rollup/plugin-replace）
replace({
  values: { __VERSION__: () => getVersion() },
  include: ['src/**/*.js'],
});

// 迁移后（Rolldown）
replacePlugin({
  __VERSION__: JSON.stringify(getVersion()),
});
```
