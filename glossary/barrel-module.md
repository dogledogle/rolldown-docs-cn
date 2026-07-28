# 聚合模块（Barrel Module）

聚合模块是一种重新导出其他模块功能的模块，通常用于为包或目录提供更简洁的公共 API：

```js
// components/index.js（聚合模块）
export { Button } from './Button';
export { Card } from './Card';
export { Modal } from './Modal';
export { Tabs } from './Tabs';
// ……以及另外数十个组件
```

这样，使用者便可以从单一入口导入所需内容：

```js
import { Button, Card } from './components';
```

然而，聚合模块可能带来性能问题，因为传统打包器需要编译所有被重新导出的模块，即使实际只用到了其中少数几个。要了解 Rolldown 如何解决这一问题，请参阅 [惰性聚合模块优化](/in-depth/lazy-barrel-optimization)。
