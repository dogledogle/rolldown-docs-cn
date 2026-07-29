---
outline: false
---

<script setup>

const contributors = [
  ['Kui Li (underfin)', 'https://github.com/underfin'],
].sort((a, b) => a[0].localeCompare(b[0])); // 按姓名的字母顺序排列

</script>

# 致谢

Rolldown 项目最初由 [Yinan Long](https://github.com/Brooooooklyn)（又名 Brooooooklyn，[NAPI-RS](https://napi.rs/) 作者）创建。如今，Rolldown 由 [Evan You](https://github.com/yyx990803)（[Vite](https://vitejs.dev/) 创建者）、全职 [团队](./team.md) 以及充满热情的开源 [贡献者](https://github.com/rolldown/rolldown/graphs/contributors) 共同领导和建设。

## 过往贡献者

我们特别感谢以下曾经的团队成员，以及为项目、文档或其生态系统作出重要贡献的人士（按姓名字母顺序排列）：

<ul>
<template v-for="contributor in contributors" :key="contributor[0]">
  <li>
    <a :href="contributor[1]" target="_blank">
      {{ contributor[0] }}
    </a>
  </li>
</template>
</ul>

此名单并未涵盖所有贡献者。

## 特别感谢

此外，我们还要感谢：

- [Charlike Mike Reagent](https://github.com/tunnckoCore) 允许我们在 npm 上使用 `rolldown` 包名。
