# 指令（Directive）

JavaScript 中有一种称为“指令”的机制，用于标注部分代码。

Rolldown 可能无法完整保留指令相关的语义，下面介绍 Rolldown 处理指令的策略。

## `"use strict"`

`"use strict"` 指令用于告知 JavaScript 引擎强制使用严格模式。由于保留顶层 `"use strict"` 指令的语义较为复杂，并且会增大输出体积，Rolldown 可能不会保留它。

由于 ES 模块始终运行在严格模式下，当 `output.format: 'es'` 时，Rolldown 不会输出任何 `"use strict"` 指令。需要注意的是，这也意味着以 ES 模块格式输出时，原本不处于严格模式的代码会被强制置于严格模式。

可以通过 [`output.strict`](https://rolldown.rs/reference/OutputOptions.strict) 选项控制是否生成 `"use strict"` 指令：

- `true`：始终在输出顶部生成 `"use strict"`（不适用于 ESM 格式，因为 ESM 始终处于严格模式）。
- `false`：永不在输出中生成 `"use strict"`。
- `'auto'`（默认值）：遵循源代码中的 `"use strict"` 指令。

```ts
import { defineConfig } from 'rolldown';

export default defineConfig({
  output: {
    format: 'cjs',
    strict: true,
  },
});
```

当 `output.format` 不是 `'es'` 且 `output.strict` 为 `'auto'` 时，Rolldown 会在以下任一情况下输出 `"use strict"` 指令：

- 指令不在顶层作用域中，且不在严格模式作用域内（[REPL](https://repl.rolldown.rs/#eNptjk0KAyEMha8SsrGF4gGE3mQ24mhxsMmgsR0YvHu1pT+LbpJ8L+G97BjQ7Bhp9pteypgJzZdP6Dr6beUsRQdmOEOo5CQygT0cYZ8IQNXioUiOTtTg7KVmAtXvO7eJuo9HI7n6dsLMKc18J+2YQrxo+cT+2fw+ALMPtibpoXnEcJW1inkjQOB8tV1QbinqJbbRngVbz751s2TFF8H2AIc5VRY=)）。
- 指令位于顶层作用域中，且该模块是入口模块（[REPL](https://repl.rolldown.rs/#eNptUEtuhDAMvYqVDVCN6Kobuuw12FBwpqmCQx2nTYVy9zGD5qPRbJK8Z7+PshprutU4mjC333F7k+lu+GBGhVWKCFHYjVK99+TmJbDA1/+C/JE+ESyHGar2Nf6kgVF121ZPY6AYPLY+HOvrcv3WNDpVZzSdcMJyMFfdJf9GPC3QE+ZzhQntkLyATTSKCwS7sM4NrD0BMEpiggwvkFVXNFfjOHg/hT9qtaB1x7vcJ5O9wEPe2vNmH5IsSboLBLCB50GJatQ/2MmyXefDFM3+VTM/CEYx5QSMo4I7)）。
- 指令位于顶层作用域中，且启用了 `output.preserveModules`（[REPL](https://repl.rolldown.rs/#eNptkE1uhDAMha9iZQNUiK66ocuuewM2FJwpVYip40ypUO5eZxAz1Wg2Sfzz/L14M9a0m5n8iGvzFfLbm/YW12bQsIgBIQhPgxSvnZ/mhVjg83dBfosfCJZphqJ5Dt+xZ1Rd7ur8QD6Qw8bRqbw2ly9VpVWdjKYVjphqc9Ud/FvioQFcLwZGtH10Ajb6QSbysMvKtYKt8wCMEtnDCk+wqiopVWFMzo304xu1Z6fTP+qDyo6/420d5/EUZYnSHiGAJZ57TRSDbqA+sgtjQD7jO43RYWghf3ovpnxdDpPU2VlRrhcMYtIfQpqMFA==)）。

## 其他指令

ECMAScript 规范允许各实现定义额外指令。由于这些额外指令并非规范的一部分，Rolldown 无法得知它们的语义，只能假设它们遵循与 `"use strict"` 相似的语义。但出于上述同样的原因，Rolldown 可能不会保留顶层指令。

Rolldown 会在以下任一情况下输出指令：

- 指令不在顶层作用域中（[REPL](https://repl.rolldown.rs/#eNptjt0KwyAMhV8l5MYNig8g7E16I1ZHi02Kxq1QfPfpxn4udpPkOwnn5MCA5sCZJr/rJfeZ0Hx5QNfQ7xsnyTowwwVCISczE9jTGY6RAFTJHlzJwqvqnLyURKDafeM6UvPxaCQVXwdMHOPEd9KOKcxXLZ/YP5vfB2DywZYoLTT1GC6yFTFvBAicVtsE5ZasXmLt7VmwtuxbM4tWfBasD4hqVRg=)）。
- 指令位于顶层作用域中，且该模块是入口模块（[REPL](https://repl.rolldown.rs/#eNptUM1OwzAMfhUrl7ZolBOXcuQ1eimtM4pSuzgOdKr67riLtiHYJYn9/Sqr865Z3UgDLvVH3N/kmtt8cL2NRYoIfYrK0yOSyql4aWmcZhaF99OM8preELzwBEX9FD9TJ2jqndVSzxQ5YB34WF7J5XNVGWr+6BqVhNvBXXWXFrfF/xoZywm4nJsM6LsUFHyiXkcmyJxyqWBtCUBQkxAs8ACL6TaLt1ThEAb+ptp6+vH4K/4Oknv8yVtb2e056Zy0uYwAnmXqbFH09hV5ue3X+XCbZX+ZWegUo7rtB/Gqh1w=)）。
- 指令位于顶层作用域中，且启用了 `output.preserveModules`（[REPL](https://repl.rolldown.rs/#eNptkM9ShDAMxl8l0wvgIJ684NGzb8AFIV1xSoNps7LD8O6mMOw6upe2+fPl+zWLsaZezOB7nKvPkN7e1Le4NJ2GmQSETkKk8RF95Ev20vhhnIgjfFwm5Fd5R7BMI2TVU/iSllHVqavxHflADitHp/zanD8XhVZ1Ppo6suBamqvuoLgl/mOM1IvD5IDzxtGjbcVFsOK7OJCHXZ3PBSyNB2CMwh5meIBZVauaqyeTcz19+0op7XD6ZX6nslP88VsaTuNJ4iSxPkIASzy2msg6XUR5ZCfGgHzGtw0/1JD+vhfXdG2HWZXsrFaujRiiWX8ALR2RKg==)）。

如果希望向所有文件添加自定义指令，可以使用 `output.banner` 选项：

```ts
import { defineConfig } from 'rolldown';

export default defineConfig({
  output: {
    banner: "'use client';",
  },
});
```
