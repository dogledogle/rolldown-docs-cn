# 原生 MagicString

## 概述

`experimental.nativeMagicString` 是一项优化功能，它使用原生 Rust 版本替代基于 JavaScript 的 MagicString 实现，让 source map 可以在后台线程中生成，从而提升性能。

## 什么是 MagicString？

MagicString 是由 Rich Harris（Rollup 和 Svelte 的创造者）开发的 JavaScript 库。它可以高效地操作字符串，并自动生成 source map。打包器和构建工具通常会将其用于：

- 在插件中转换代码
- 生成 source map
- 精确跟踪行和列
- 高效执行字符串操作（替换、前置、追加等）

## JavaScript 实现与原生 Rust 实现

### 传统的 JavaScript MagicString

原始 MagicString 实现使用 JavaScript 编写并在 Node.js 环境中运行。打包器执行代码转换时，通常会：

1. 将源代码加载为 JavaScript 字符串
2. 使用 MagicString API 应用转换
3. 为转换后的代码生成 source map
4. 在 JavaScript 主线程中完成所有处理

### 原生 Rust 实现

Rolldown 的原生 MagicString 实现使用 Rust 重写核心功能，带来了多项优势：

- **性能**：Rust 的内存安全与零成本抽象让字符串操作更快
- **并行处理**：可以在后台线程中生成 source map
- **内存效率**：能够更好地管理大型代码库所需的内存
- **集成**：与 Rolldown 基于 Rust 的架构无缝集成

## 工作原理

启用 `experimental.nativeMagicString` 后，Rolldown 会调整转换流水线。下图展示了两种架构之间的区别：

::: info
为了便于理解，图中简化了部分技术细节。原生 MagicString 实现会通过转换钩子的 `meta` 参数提供一个 `magicString` 对象，插件可以像使用 JavaScript 版本一样使用它。
:::

### 不使用原生 MagicString

<img width="3426" height="1699" alt="js-magic-string" src="https://github.com/user-attachments/assets/c9e81f8a-fad0-4f99-99c4-c71c67b8912e" style="background: white;" />

（图中勘误："rolldown without js magic-string" 应为 "rolldown without native magic-string"）

### 使用原生 MagicString

<img width="3343" height="1659" alt="native-magic-string" src="https://github.com/user-attachments/assets/71ca5d7b-9b40-46ce-86dd-bfa4bdd73f4b" style="background: white;" />

**关键区别**：原生实现使用 Rust 编写，既具备 Rust 的性能优势，又能在后台线程中生成 source map。将任务转移到后台线程可以提高 CPU 的整体利用率，并带来显著的性能提升。

## API 兼容性

原生实现保持了与 JavaScript 版本的 API 兼容性。目前已经实现了最常用的 API，其余 API 计划在未来版本中逐步补齐。

### 已实现的方法

原生实现目前提供以下 MagicString 方法：

**字符串操作：**

- `append(content)`：在字符串末尾追加内容
- `prepend(content)`：在字符串开头添加内容
- `appendLeft(index, content)`：在指定索引的左侧追加内容
- `appendRight(index, content)`：在指定索引的右侧追加内容
- `prependLeft(index, content)`：在指定索引的左侧添加内容
- `prependRight(index, content)`：在指定索引的右侧添加内容
- `overwrite(start, end, content)`：替换某个范围内的内容
- `update(start, end, content)`：更新某个范围内的内容
- `remove(start, end)`：删除某个范围内的内容
- `replace(from, to)`：替换模式的第一次匹配
- `replaceAll(from, to)`：替换模式的所有匹配

**转换：**

- `indent(indentor?)`：缩进内容，可以指定自定义缩进字符串
- `relocate(start, end, to)`：将内容从一个位置移动到另一个位置

**实用方法：**

- `toString()`：返回转换后的字符串
- `hasChanged()`：检查字符串是否已被修改
- `length()`：返回转换后字符串的长度
- `isEmpty()`：检查字符串是否为空
- `clone()`：返回 MagicString 实例的副本
- `trim(charType?)`：移除两端的空白或指定字符
- `trimStart(charType?)`：移除开头的空白或指定字符
- `trimEnd(charType?)`：移除末尾的空白或指定字符
- `trimLines()`：移除两端的换行符
- `snip(start, end)`：返回一个移除了指定范围外内容的副本
- `slice(start?, end?)`：返回两个位置之间的内容
- `reset(start, end)`：将某个范围恢复为原始内容
- `lastChar()`：返回最后一个字符
- `lastLine()`：返回最后一个换行符之后的内容

**生成 source map：**

- `generateMap(options?)`：以 JSON 字符串形式生成 source map
  - `options.source`：源文件名
  - `options.includeContent`：是否在映射中包含原始源代码
  - `options.hires`：高分辨率模式：`true`、`false` 或 `"boundary"`

### 尚未实现

以下功能计划在未来版本中实现：

- `generateDecodedMap()`：生成包含已解码映射的 source map

## 实际性能

使用 [rolldown/benchmarks](https://github.com/rolldown/benchmarks/) 作为基准测试用例。

### 构建时间

| 运行规模   | oxc 原始转换 + js magicString | oxc 原始转换 + native magicString | 节省时间 | 加速比 |
| ---------- | ----------------------------- | --------------------------------- | -------- | ------ |
| apps/1000  | 497.6 ms                      | 431.1 ms                          | 66.5 ms  | 1.15x  |
| apps/5000  | 1.100 s                       | 894.5 ms                          | 205.5 ms | 1.23x  |
| apps/10000 | 1.814 s                       | 1.368 s                           | 446.0 ms | 1.33x  |

### 插件转换时间（构建时间减去 noop 插件的构建时间）

| 运行规模 | 转换时间（oxc 原始转换 + js magicString） | 转换时间（oxc 原始转换 + native magicString） | 节省时间 | 加速比 |
| -------- | ---------------------------------------- | -------------------------------------------- | -------- | ------ |
| 1000     | 172.0 ms                                 | 105.5 ms                                     | 66.5 ms  | 1.63x  |
| 5000     | 455.4 ms                                 | 249.9 ms                                     | 205.5 ms | 1.82x  |
| 10000    | 799.0 ms                                 | 353.0 ms                                     | 446.0 ms | 2.26x  |

详细的基准测试结果请参阅 [基准测试拉取请求](https://github.com/rolldown/benchmarks/pull/9/files)。

## 使用示例

### 在基础插件中使用原生 MagicString

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  experimental: {
    nativeMagicString: true,
  },
  output: {
    sourcemap: true,
  },
  plugins: [
    {
      name: 'transform-example',
      transform(code, id, meta) {
        if (!meta?.magicString) {
          // nativeMagicString 不可用时回退
          return null;
        }

        const { magicString } = meta;

        // 转换示例：添加调试注释
        if (code.includes('console.log')) {
          magicString.replace(/console\.log\(/g, 'console.log("[DEBUG]", ');
        }

        // 示例：添加文件头
        magicString.prepend(`// Transformed from: ${id}\n`);

        return {
          code: magicString,
        };
      },
    },
  ],
});
```

## 兼容性与回退方案

### 检查原生 MagicString 是否可用

```javascript [rolldown.config.js]
transform(code, id, meta) {
  if (meta?.magicString) {
    // 原生 MagicString 可用
    const { magicString } = meta;

    // 使用原生实现
    // 注意：直接返回 magicString 对象，而不是字符串
    return {
      code: magicString
    };
  } else {
    // 回退到常规字符串操作
    // 或使用 JavaScript MagicString 库
    const MagicString = require('magic-string');
    const ms = new MagicString(code);

    // 在这里执行转换……

    return {
      code: ms.toString(),
      map: ms.generateMap()
    };
  }
}
```

### Rollup 兼容性

此功能为 Rolldown 专用，Rollup 并不提供。对于需要同时支持两种打包器的插件：

```javascript [plugin.js]
function createTransform() {
  return function (code, id, meta) {
    if (meta?.magicString) {
      // 使用原生 MagicString 的 Rolldown
      return transformWithNativeMagicString(code, id, meta);
    } else {
      // Rollup，或未使用原生 MagicString 的 Rolldown
      return transformWithJsMagicString(code, id);
    }
  };
}
```

::: tip 提示

你可以使用 [`rolldown-string`](https://github.com/sxzz/rolldown-string)，它提供了一个适用于两种打包器的统一接口。

:::

## 何时使用原生 MagicString

### 推荐场景

1. **大型代码库**：包含数百或数千个文件的项目
2. **复杂转换**：执行大量代码操作的插件
3. **大量使用 source map**：需要详细 source map 的项目
4. **性能敏感**：构建速度至关重要的流程
5. **开发模式**：在开发过程中缩短重新构建时间

### 需要谨慎的场景

1. **实验性功能**：作为实验性功能，其 API 可能发生变化
2. **插件兼容性**：部分插件可能依赖 JavaScript MagicString 的特定行为
3. **调试**：原生实现可能会产生不同的错误消息

## 迁移指南

### 启用原生 MagicString

1. **更新配置：**

```javascript [rolldown.config.js]
export default {
  experimental: {
    nativeMagicString: true,
  },
  output: {
    sourcemap: true, // 生成 source map 时必需
  },
};
```

2. **更新插件：**

```javascript [rolldown.config.js]
// 之前
transform(code, id) {
  const ms = new MagicString(code);
  // ……转换操作
  return { code: ms.toString(), map: ms.generateMap() };
}

// 之后
transform(code, id, meta) {
  if (meta?.magicString) {
    const { magicString } = meta;
    // ……转换操作（使用相同的 API）
    return { code: magicString };
  }
  // 回退逻辑
}
```

## 限制与注意事项

### 当前限制

1. **实验性状态**：API 可能在未来版本中发生变化
2. **边缘情况**：部分边缘情况的行为可能与 JavaScript 版本不同
3. **调试**：错误消息可能不太熟悉

### 最佳实践

1. **始终检查是否可用**：使用前确认 `meta?.magicString` 存在
2. **提供回退方案**：加入回退逻辑以保证兼容性
3. **充分测试**：使用两种实现测试转换逻辑
4. **报告问题**：向 Rolldown 团队报告任何行为差异

## 总结

`experimental.nativeMagicString` 利用 Rust 在代码转换任务中的效率，为 Rolldown 带来了显著的性能优化。尽管使用时需要考虑兼容性，但它所带来的性能收益使其非常适合大型项目和性能敏感的构建流程。

作为一项实验性功能，建议在生产工作流中采用之前，先在开发环境中进行充分测试。Rolldown 团队正在积极开发此功能，社区反馈对其持续改进非常宝贵。
