# 插件钩子过滤器

钩子过滤器让 Rolldown 能在调用插件前先在 Rust 端判断过滤条件，从而跳过不必要的 Rust 到 JS 调用。这可以提高性能，并实现更好的并行化。更多细节请参阅[为什么需要插件钩子过滤器](/in-depth/why-plugin-hook-filter)。

## 基本用法

不要在钩子内部检查条件：

```js{5}
export default function myPlugin() {
  return {
    name: 'example',
    transform(code, id) {
      if (!id.endsWith('.data')) {
        // 提前返回
        return
      }
      // 执行实际转换
      return transformedCode
    },
  }
}
```

请改用带有 `filter` 属性的对象钩子格式：

```js{5-7}
export default function myPlugin() {
  return {
    name: 'example',
    transform: {
      filter: {
        id: /\.data$/
      },
      handler(code) {
        // 执行实际转换
        return transformedCode
      },
    }
  }
}
```

Rolldown 会在 Rust 端判断过滤器，只在匹配时调用处理函数。

::: tip
[`@rolldown/pluginutils`](https://npmx.dev/package/@rolldown/pluginutils) 导出了一些钩子过滤器工具，例如 `exactRegex` 和 `prefixRegex`。
:::

## 过滤器属性

除 `id` 外，还可以根据 `moduleType` 和模块源代码进行过滤。`filter` 属性的工作方式与 [`@rollup/pluginutils` 中的 `createFilter`](https://github.com/rollup/plugins/blob/master/packages/pluginutils/README.md#createfilter) 类似。

- 如果向 `include` 传递多个值，**任意一个**值匹配即可。
- 如果过滤器同时包含 `include` 和 `exclude`，`exclude` 优先。
- 如果指定多个过滤器属性，只有全部指定属性都匹配时，过滤器才会匹配。换句话说，只要有一个属性不匹配，无论其他属性如何，该模块都会被排除。例如，以下过滤器只匹配文件名以 `.js` 结尾、源代码包含 `foo` 且不包含 `bar` 的模块：
  ```js
  {
    id: {
      include: /\.js$/,
      exclude: /\.ts$/
    },
    code: {
      include: 'foo',
      exclude: 'bar'
    }
  }
  ```

各钩子支持以下属性：

- `resolveId` hook: `id`
- `load` hook: `id`
- `transform` hook: `id`, `moduleType`, `code`

另请参阅 [`HookFilter`](https://rolldown.rs/reference/Interface.HookFilter)。

> [!NOTE]
> 传入 `string` 时，`id` 会被视为 glob 模式；传入 `RegExp` 时，会被视为正则表达式。
> 在 `resolve` 钩子中，`id` 必须是 `RegExp`，不允许使用 `string`。
> 这是因为 `resolveId` 中的 `id` 值就是导入语句里写下的原始文本，通常不是绝对路径，而 glob 模式是为匹配绝对路径设计的。

## 可组合过滤器

对于更复杂的过滤逻辑，Rolldown 通过 [`@rolldown/pluginutils`](https://github.com/rolldown/rolldown/tree/main/packages/pluginutils) 包提供可组合过滤器表达式。可以使用 `and`、`or` 和 `not` 等逻辑运算构建过滤器。

> [!WARNING]
> Vite 和 unplugin 尚不支持可组合过滤器，它们只能用于 Rolldown 插件。

### 示例

```js
import { and, id, include, moduleType } from '@rolldown/pluginutils';

export default function myPlugin() {
  return {
    name: 'my-plugin',
    transform: {
      filter: [include(and(id(/\.ts$/), moduleType('ts')))],
      handler(code, id) {
        // 只针对 moduleType 为 'ts' 的 .ts 文件调用
        return transformedCode;
      },
    },
  };
}
```

### 可用的过滤器函数

- `and(...exprs)` / `or(...exprs)` / `not(expr)`：以逻辑方式组合过滤器表达式。
- `id(pattern, params?)`：按 ID 过滤。`string` 模式使用严格相等匹配（不是 glob）；`RegExp` 会针对 ID 进行测试。
- `importerId(pattern, params?)`：按导入方 ID 过滤。`string` 模式使用严格相等匹配；`RegExp` 会针对导入方 ID 进行测试。只能用于 `resolveId` 钩子。
- `moduleType(type)`：按模块类型过滤（例如 `'js'`、`'tsx'` 或 `'json'`）。
- `code(pattern)`：按代码内容过滤。
- `query(key, pattern)`：按查询参数过滤。
- `include(expr)` / `exclude(expr)`：顶层包含/排除包装器。
- `queries(obj)`：组合多个查询过滤器。

完整 API 参考请参阅 [`@rolldown/pluginutils` README](https://github.com/rolldown/rolldown/tree/main/packages/pluginutils#readme)。

## 互操作性

Rollup 4.38.0+、Vite 6.3.0+ 以及所有 Rolldown 版本都支持插件钩子过滤器。

### 支持旧版本

如果正在编写需要支持旧版 Rollup（< 4.38.0）或 Vite（< 6.3.0）的插件，可以提供一份在新旧环境中都能工作的回退实现。

具体策略是：在支持时使用带过滤器的对象钩子格式；在旧版本中则回退到内部检查条件的普通函数：

```js
const idFilter = /\.data$/;

export default function myPlugin() {
  return {
    name: 'my-plugin',
    transform: {
      // Rolldown 和较新的 Rollup/Vite 版本会使用过滤器
      filter: { id: idFilter },
      // 过滤器匹配时调用处理函数
      handler(code, id) {
        // 在处理函数中再次检查，以兼容旧版本
        // 只有需要支持旧版本时才有必要这样做
        if (!idFilter.test(id)) {
          return null;
        }
        // 执行实际转换
        return transformedCode;
      },
    },
  };
}
```

这种方式可以确保插件：

- 在 Rolldown 和较新的 Rollup / Vite 版本中使用过滤器，以获得最佳性能。
- 在旧版本中仍能正常工作（旧版本会对所有文件调用处理函数，但内部检查可以确保行为正确）。

> [!TIP]
> 支持旧版本时，请确保过滤器模式与内部检查保持同步，以免造成混淆。

### `moduleType` Filter

Rollup / Vite 7 及更低版本中不存在[模块类型](/in-depth/module-types)概念。因此，这些工具不支持 `moduleType` 过滤器，并会将其忽略。
