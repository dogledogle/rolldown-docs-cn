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
