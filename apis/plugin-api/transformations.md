# 源代码转换

如果插件转换了源代码，就应该自动生成 source map，除非插件提供了明确的 `sourceMap: false` 选项。Rolldown 只关心 `mappings` 属性，其他内容都会自动处理。[magic-string](https://github.com/Rich-Harris/magic-string) 提供了一种简单的方法，可为添加或删除代码片段等基础转换生成此类映射。

如果生成 source map 没有意义，请返回一个空的 source map：

```js
return {
  code: transformedCode,
  map: { mappings: '' },
};
```

如果转换没有移动代码，可以返回 `null` 来保留现有 source map：

```js
return {
  code: transformedCode,
  map: null,
};
```

## 转换代码块

可以使用 [`renderChunk`](https://rolldown.rs/reference/Interface.Plugin#renderchunk) 转换代码块。如果返回所应用转换的 sourcemap，Rolldown 会将该映射与之前的转换组合起来，并根据选项重新构建 `x_google_ignoreList` 字段：

```js
import MagicString from 'magic-string';

export default function myPlugin() {
  return {
    name: 'example',
    renderChunk(code) {
      const s = new MagicString(code);
      s.prepend('/* banner */\n');
      return { code: s.toString(), map: s.generateMap({ hires: 'boundary' }) };
    },
  };
}
```

我们不建议在 [`generateBundle`](https://rolldown.rs/reference/Interface.Plugin#generatebundle) 中进行转换。它在哈希计算之后运行，因此输出文件名保留的是未转换代码的哈希；同时它在 `.map` 资源构建之后运行，因此编辑 `chunk.map` 不会改变该文件。不过，如果必须在那里转换，请组合映射并自行写入资源：

```js
import remapping from '@jridgewell/remapping';
import MagicString from 'magic-string';

export default function myPlugin() {
  return {
    name: 'example',
    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;

        const s = new MagicString(chunk.code);
        // ……你的转换逻辑……
        if (!s.hasChanged()) continue;

        // 低分辨率映射在组合时可能退化为空，因此请保留边界处的映射。
        const step = s.generateMap({ source: chunk.fileName, hires: 'boundary' });
        chunk.code = s.toString();

        if (chunk.map) {
          // 组合 source map
          chunk.map = remapping([step, chunk.map], () => null);

          // 输出文件来自此资源，而不是来自 `chunk.map`。
          const asset = bundle[`${chunk.fileName}.map`];
          if (asset) asset.source = chunk.map.toString();
        }
      }
    },
  };
}
```
