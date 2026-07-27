# 命令行界面

Rolldown 可以通过命令行使用。你可以提供可选的 Rolldown 配置文件，以简化命令行操作并启用 Rolldown 的高级功能。

## 配置文件

Rolldown 配置文件虽然可选，但功能强大且使用方便，因此**推荐使用**。
配置文件是一个 ES 模块，默认导出包含所需选项的对象。
它通常命名为 `rolldown.config.js`，放在项目根目录中。
也可以在 CJS 文件中使用 CJS 语法，以 `module.exports` 代替 `export default`。
Rolldown 还原生支持 TypeScript 配置文件。

配置文件中可用选项的完整列表请参阅[官方 API 参考（英文）](https://rolldown.rs/reference/)。

```js [rolldown.config.js]
export default {
  input: 'src/main.js',
  output: {
    file: 'bundle.js',
    format: 'cjs',
  },
};
```

要让 Rolldown 使用配置文件，请传入 `-c`（或 `--config`）标志：

```shell
rolldown -c                 # 使用 rolldown.config.{js,mjs,cjs,ts,mts,cts}
rolldown --config           # 与上面相同
rolldown -c my.config.js    # 使用自定义配置文件
```

如果没有传入文件名，Rolldown 会尝试加载工作目录中的 `rolldown.config.{js,mjs,cjs,ts,mts,cts}`。
如果找不到配置文件，Rolldown 会显示错误。

也可以从配置文件中导出函数。该函数会接收命令行参数，因此可以动态调整配置：

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig((commandLineArgs) => {
  if (commandLineArgs.watch) {
    // 监听模式专用配置
  }
  return {
    input: 'src/main.js',
  };
});
```

### 配置加载器

默认情况下，Rolldown 会先使用自身打包配置文件，再进行加载（`configLoader: 'bundle'`）。这种方式适用于所有受支持的运行时，包括 TypeScript 配置。

如果运行时能够直接导入配置（Node.js 22.18+，原生支持移除 TypeScript 类型；Bun；Deno；或通过 `--import` 注册了 `tsx`、`jiti` 等加载器），可以使用 `native` 加载器跳过打包步骤：

```shell
rolldown -c rolldown.config.ts --configLoader native
```

`native` 加载器更简单，并计划在未来成为默认方式。

### 配置智能提示

Rolldown 自带 TypeScript 类型声明，因此可以通过 JSDoc 类型提示使用 IDE 的智能提示：

```js [rolldown.config.js]
/** @type {import('rolldown').RolldownOptions} */
export default {
  // ...
};
```

也可以使用 `defineConfig` 辅助函数，无需 JSDoc 注解即可获得智能提示：

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  // ...
});
```

### 配置数组

要使用不同输入构建不同产物，可以提供配置对象数组：

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.js',
    output: { format: 'esm', entryFileNames: 'bundle.esm.js' },
  },
  {
    input: 'src/main.js',
    output: { format: 'cjs', entryFileNames: 'bundle.cjs.js' },
  },
]);
```

::: tip 使用相同输入生成不同输出

也可以为 `output` 选项提供数组，使用同一输入生成多个输出：

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  output: [
    { format: 'esm', entryFileNames: 'bundle.esm.js' },
    { format: 'cjs', entryFileNames: 'bundle.cjs.js' },
  ],
});
```

:::

## 命令行标志

标志可以采用 `--foo`、`--foo <value>` 或 `--foo=<value>` 的形式传入。`--minify` 等布尔标志不需要值，而 `--transform.define` 等键值选项使用逗号分隔语法：`--transform.define key:value,key2:value2`。许多标志都有短别名，例如 `--minify` 的别名是 `-m`，`--format` 的别名是 `-f`。

::: warning 禁用布尔标志

要_关闭_布尔标志，请添加 `--no-` 前缀，例如 `--no-minify` 或 `--no-codeSplitting`。**不支持**把 `false` 作为值传入，例如 `--minify false` 或 `--codeSplitting=false`，这样做会报错，因为该值会被读取为字符串 `"false"`，而不是布尔值。这与 [Rollup CLI 的行为](https://rollupjs.org/command-line-interface/)一致（例如 `--no-treeshake`）。

一些标志既接受布尔值，也接受对象（例如 `codeSplitting`）。对于这类标志，可以：

- 使用默认值启用：`--codeSplitting`。
- 禁用：`--no-codeSplitting`。
- 使用点号表示法设置嵌套字段：`--codeSplitting.minSize 30000`。

:::

::: info 集成到其他工具

请注意，在 Rolldown 收到参数前，shell 会先解释参数，因此引号和通配符的行为可能出乎意料。对于高级构建流程或与其他工具的集成，请考虑改用 [JavaScript API](/apis/bundler-api)。从配置文件切换到 API 时，主要区别如下：

- 配置必须是对象，不能是 Promise 或函数。
- 针对每组 `inputOptions` 分别运行 [`rolldown.rolldown`](https://rolldown.rs/reference/Function.rolldown)，不能使用配置数组。
- 使用 [`bundle.generate(outputOptions)`](https://rolldown.rs/reference/Interface.RolldownBuild#generate) 或 [`bundle.write(outputOptions)`](https://rolldown.rs/reference/Interface.RolldownBuild#write)，而不是 `output` 选项。

:::

许多选项都有对应的命令行标志。
这些标志的详情请参阅[官方 API 参考（英文）](https://rolldown.rs/reference/)。
如果使用了配置文件，这里传入的参数会覆盖配置文件中的相应值。
下面列出所有受支持的标志：

<script setup>
import { data } from '../data-loading/cli-help.data'
</script>

```sh-vue
{{ data.help }}
```

以下标志只能通过命令行界面使用。

### `-c, --config <filename>`

使用指定的配置文件。如果使用了该参数但未指定文件名，Rolldown 会查找默认配置文件。更多细节请参阅[配置文件](#配置文件)。

### `--configLoader <loader>`

配置文件的加载方式，可选值如下：

- `bundle`（默认值）：导入前先使用 Rolldown 打包配置。
- `native`：直接导入配置，依靠运行时提供 TypeScript 和加载器支持。参阅[配置加载器](#配置加载器)。

### `-h` / `--help`

显示帮助信息。

### `-v` / `--version`

显示已安装的版本号。

### `-w` / `--watch`

磁盘上的源文件发生变化时重新构建打包产物。

::: info `ROLLDOWN_WATCH` 环境变量
在监听模式下，Rolldown 命令行界面会把 `ROLLDOWN_WATCH` 和 `ROLLUP_WATCH` 环境变量设置为 `true`，其他进程可以读取这些变量。插件应该改为检查 [`this.meta.watchMode`](https://rolldown.rs/reference/Interface.PluginContextMeta#watchmode)，它不依赖命令行界面。
:::

### `--environment <values>`

通过 `process.env` 向配置文件传递额外设置。
值采用逗号分隔的键值对形式，其中值为 `true` 时可以省略。

例如：

```shell
rolldown -c --environment INCLUDE_DEPS,BUILD:production
```

这会设置 `process.env.INCLUDE_DEPS = 'true'` 和 `process.env.BUILD = 'production'`。

可以多次使用此选项。
后续设置的变量会覆盖之前的定义。

::: tip 覆盖值
假设 `package.json` 中有以下脚本：

```json
{
  "scripts": {
    "build": "rolldown -c --environment BUILD:production"
  }
}
```

可以通过 `npm run build -- --environment BUILD:development` 调用该脚本，将 `process.env.BUILD` 设置为 `"development"`。

:::
