# 打包器 API

Rolldown 提供三个主要 API 函数，用于以编程方式打包代码。

## `rolldown()`

`rolldown()` 是兼容 Rollup `rollup` 函数的 API。

```js
import { rolldown } from 'rolldown';

let bundle,
  failed = false;
try {
  bundle = await rolldown({
    input: 'src/main.js',
  });
  await bundle.write({
    format: 'esm',
  });
} catch (e) {
  console.error(e);
  failed = true;
}
if (bundle) {
  await bundle.close();
}
process.exitCode = failed ? 1 : 0;
```

更多细节请参阅 [`rolldown()` API 参考](https://rolldown.rs/reference/Function.rolldown)。

## `watch()`

`watch()` 是兼容 Rollup `watch` 函数的 API。

```js
import { watch } from 'rolldown';

const watcher = watch({/* ... */});
watcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    console.log(event.duration);
    event.result.close();
  }
});

// 停止监听
watcher.close();
```

更多细节请参阅 [`watch()` API 参考](https://rolldown.rs/reference/Function.watch)。

## `build()`

::: warning 实验性功能

此 API 仍处于实验阶段，可能会在补丁版本中发生变化。

:::

对于大多数用例，`build()` 都是最简单的选择。该 API 与 esbuild 的 `build` 函数相似，可在一次调用中完成打包和写入，并自动清理资源。

```js
import { build } from 'rolldown';

const result = await build({
  input: 'src/main.js',
  output: {
    file: 'bundle.js',
  },
});
console.log(result);
```

更多细节请参阅 [`build()` API 参考](https://rolldown.rs/reference/Function.build)。
