# 插件间通信

使用许多专用插件时，有时需要让互不相关的插件在构建期间交换信息。Rolldown 提供了多种机制来实现这一点。

## 自定义解析器选项

假设有一个插件，需要根据另一个插件生成导入的方式，将导入解析为不同 ID。一种实现方式是改写导入，使用特殊的代理 ID。例如，CommonJS 文件中经由 `require("foo")` 转译的导入，可以变成带特殊 ID 的普通导入 `import "foo?require=true"`，让解析器插件识别这一情况。

但问题在于，这个代理 ID 实际并不对应文件，因此传给其他解析器时可能产生意外副作用。此外，如果 ID 由插件 `A` 创建、由插件 `B` 解析，两个插件之间就会形成依赖，导致没有 `B` 时无法使用 `A`。

自定义解析器选项解决了这一问题：通过 [`this.resolve`](https://rolldown.rs/reference/Interface.PluginContext#resolve) 手动解析模块时，可以向插件传递额外选项。整个过程无需修改 ID，因此即使目标插件不存在，也不会妨碍其他插件正确解析模块。

```js
function requestingPlugin() {
  return {
    name: 'requesting',
    async buildStart() {
      const resolution = await this.resolve('foo', undefined, {
        custom: { resolving: { specialResolution: true } },
      });
      console.log(resolution.id); // "special"
    },
  };
}

function resolvingPlugin() {
  return {
    name: 'resolving',
    resolveId(id, importer, { custom }) {
      if (custom.resolving?.specialResolution) {
        return 'special';
      }
      return null;
    },
  };
}
```

请遵循约定：自定义选项应放在与解析插件名称对应的属性中。解析插件有责任说明它支持哪些选项。

## 自定义模块元数据

插件可以使用自定义元数据标注模块。这些元数据可由自身或其他插件通过 [`resolveId`](https://rolldown.rs/reference/Interface.Plugin#resolveid)、[`load`](https://rolldown.rs/reference/Interface.Plugin#load) 和 [`transform`](https://rolldown.rs/reference/Interface.Plugin#transform) 钩子设置，并可通过 [`this.getModuleInfo`](https://rolldown.rs/reference/Interface.PluginContext#getmoduleinfo)、[`this.load`](https://rolldown.rs/reference/Interface.PluginContext#load) 和 [`moduleParsed`](https://rolldown.rs/reference/Interface.Plugin#moduleparsed) 钩子访问。元数据必须始终能够通过 `JSON.stringify` 序列化，并会持久化到缓存中，例如在监听模式下。

```js
function annotatingPlugin() {
  return {
    name: 'annotating',
    transform(code, id) {
      if (thisModuleIsSpecial(code, id)) {
        return { meta: { annotating: { special: true } } };
      }
    },
  };
}

function readingPlugin() {
  let parentApi;
  return {
    name: 'reading',
    buildEnd() {
      const specialModules = Array.from(this.getModuleIds()).filter(
        (id) => this.getModuleInfo(id).meta.annotating?.special,
      );
      // 使用此列表执行某些操作
    },
  };
}
```

请注意，添加或修改数据的插件应使用与插件名称对应的属性，本例中是 `annotating`。另一方面，任何插件都可以通过 `this.getModuleInfo` 读取其他插件的所有元数据。

如果多个插件添加元数据，或在不同钩子中添加元数据，这些 `meta` 对象会进行浅合并。假设插件 `first` 在 `resolveId` 钩子中添加 `{meta: {first: {resolved: "first"}}}`，又在 `load` 钩子中添加 `{meta: {first: {loaded: "first"}}}`；同时插件 `second` 在 `transform` 钩子中添加 `{meta: {second: {transformed: "second"}}}`，最终的 `meta` 对象会是 `{first: {loaded: "first"}, second: {transformed: "second"}}`。由于插件把两份数据都存放在顶层 `first` 属性下，`load` 钩子的结果会覆盖 `resolveId` 钩子的结果。另一个插件的 `transform` 数据则会放在它旁边。

Rolldown 开始加载模块时就会创建该模块的 `meta` 对象，并在模块的每个生命周期钩子中更新它。如果保存了对此对象的引用，也可以手动更新。要访问尚未加载模块的 meta 对象，可以通过 [`this.load`](https://rolldown.rs/reference/Interface.PluginContext#load) 触发对象创建和模块加载：

```js
function plugin() {
  return {
    name: 'test',
    buildStart() {
      // 触发模块加载。也可以在这里传入初始 "meta" 对象，
      // 但如果模块已通过其他方式加载，该对象会被忽略
      this.load({ id: 'my-id' });
      // 模块信息现在已经可用，无需等待 this.load
      const meta = this.getModuleInfo('my-id').meta;
      // 现在也可以手动修改 meta
      meta.test = { some: 'data' };
    },
  };
}
```

## 插件直接通信

对于其他类型的插件间通信，建议使用以下模式。`api` 永远不会与未来新增的插件钩子冲突。

```js
function parentPlugin() {
  return {
    name: 'parent',
    api: {
      // ……向其他插件公开的方法和属性
      doSomething(...args) {
        // 执行某些操作
      },
    },
    // ……插件钩子
  };
}

function dependentPlugin() {
  let parentApi;
  return {
    name: 'dependent',
    buildStart({ plugins }) {
      const parentName = 'parent';
      const parentPlugin = plugins.find((plugin) => plugin.name === parentName);
      if (!parentPlugin) {
        // 如果依赖可选，也可以静默处理
        throw new Error(`This plugin depends on the "${parentName}" plugin.`);
      }
      // 现在可以在后续钩子中访问 API 方法
      parentApi = parentPlugin.api;
    },
    transform(code, id) {
      if (thereIsAReasonToDoSomething(id)) {
        parentApi.doSomething(id);
      }
    },
  };
}
```

## 描述性元数据

插件可以为模块和插件自身附加描述性元数据。这些元数据仅用于提供信息，供 [Vite DevTools](https://github.com/vitejs/devtools) 等检查构建的工具展示。

### 模块描述

工具通常通过 ID 显示模块，而 ID 往往难以理解。例如，`\0vite/modulepreload-polyfill.js` 无法说明模块的用途，这对虚拟模块尤其不便。插件可以通过 [`resolveId`](https://rolldown.rs/reference/Interface.Plugin#resolveid)、[`load`](https://rolldown.rs/reference/Interface.Plugin#load) 或 [`transform`](https://rolldown.rs/reference/Interface.Plugin#transform) 钩子的返回值，为模块附加易读的 [`description`](https://rolldown.rs/reference/Interface.ModuleOptions#description)。

```js
function modulePreloadPolyfillPlugin() {
  return {
    name: 'vite:modulepreload-polyfill',
    load: {
      filter: { id: /^\0vite\/modulepreload-polyfill\.js$/ },
      handler(id) {
        return {
          code: '/* ... */',
          description: '用于 rel="modulepreload" 的 link 标签 polyfill',
        };
      },
    },
  };
}
```

### 插件元数据

一个包通常会发布多个插件，而插件的 `name` 不一定能表明它来自哪个包。插件可以通过插件对象的 [`meta`](https://rolldown.rs/reference/Interface.Plugin#meta) 属性声明来源包的名称和版本，让工具按包归属和分组插件。还可以通过 `description` 属性附加插件用途的简短描述。

```js
function vuePlugin() {
  return {
    name: 'vite:vue',
    meta: {
      packageName: '@vitejs/plugin-vue',
      version: '5.0.0',
      description: '处理 Vue 单文件组件',
    },
    // ……插件钩子
  };
}
```

完整结构请参阅 [`PluginMeta`](https://rolldown.rs/reference/Interface.PluginMeta) 类型。
