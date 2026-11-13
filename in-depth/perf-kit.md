# Perf Kit

`@rolldown/perf-kit` 帮助编码智能体让你的应用启动得更快。它会测量浏览器中的页面、Node.js 或 Deno 服务器，或 Cloudflare Worker。智能体修改代码，perf-kit 显示哪些改动应当保留。

::: warning 实验性
perf-kit 是实验性的，其命令和输出在后续版本中可能不同。最低要求 Rolldown 1.3.0。
:::

## 为什么需要 perf-kit

编码智能体可以为提升速度而修改代码，但面临 3 个问题：

- 一次构建无法证明收益，因为每次测量都有噪声。
- 损坏的页面可能测得更快。如果某项改动隐藏了主视觉区域，LCP 测到的是更廉价的绘制。
- 智能体可能过早停止。一个未显示任何问题的工具，并不能说明其他信号也没有问题。

perf-kit 为智能体提供固定基线、对渲染输出的检查，以及一份包含所有未决线索的列表。智能体决定修改什么，数据决定保留什么。

## 设置

你需要：

- Node.js 22 或更高版本。
- 一个已构建的应用。perf-kit 不负责构建。
- 对于页面：机器上安装 Chrome 或 Edge。`CHROME_PATH` 用于选择浏览器。
- 对于 Worker：应用的 devDependencies 中包含 `@cloudflare/vite-plugin` 和 `wrangler`。覆盖率功能需要 Wrangler 4.108.0 或更高版本。

perf-kit 没有依赖，因此无需安装步骤即可运行：

::: code-group

```sh [vp]
$ vp dlx @rolldown/perf-kit help
```

```sh [npm]
$ npx @rolldown/perf-kit help
```

:::

要将其添加到项目中，请运行 `vp add -D @rolldown/perf-kit` 或 `npm i -D @rolldown/perf-kit`。之后命令为 `vp exec perf-kit` 或 `npx perf-kit`。perf-kit 会将状态保存在运行目录下的 `.perf-kit/` 中。它会在其中写入 `.gitignore`，因此状态不会进入提交。

### 配置构建 {#configure-the-build}

设置以下选项并重新构建应用：

::: code-group

```js [rolldown.config.js]
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  devtools: { mode: 'report' },
  output: { sourcemap: true },
});
```

```js [vite.config.js]
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    rolldownOptions: {
      devtools: { mode: 'report' },
    },
  },
});
```

:::

- `sourcemap: true`：当页面的入口代码块没有 sourcemap 时，`scan` 和 `coverage` 会报错停止。无论使用哪种打包器，都要启用 sourcemap。
- `devtools: { mode: 'report' }` 会写入[构建报告](/in-depth/build-report)。这需要 Rolldown，而 Vite 8 使用 Rolldown。perf-kit 会读取其中 2 个文件：
  - `module-graph.json`，用于[查找可以延迟加载的代码](#find-code-that-can-load-later)的命令。
  - `chunk-graph.json`，用于找出启动较晚的代码块的检查。Vite manifest（`build.manifest: true`）也可以。

对于 Worker，请跳过此步骤。`worker-config` 构建会设置这两个选项。

## 与编码智能体配合使用

1. 复制适合你目标的提示词。
2. 填写 `<...>` 部分。其余文本保持不变。
3. 将提示词交给智能体。

浏览器和服务器提示词会让智能体先运行 `help`。`help` 会打印 `AGENTS.md` 的路径，这是给智能体的手册。不要在这些提示词中添加告诉智能体如何测量或做性能分析的步骤。手册会完成这些事，而同时这样做的提示词会让智能体偏离手册。

::: info 使用 Cloudflare Worker 提示词之前
应用必须使用 Rolldown 构建。

1. 在应用中运行 `vp add -D @rolldown/perf-kit` 或 `npm i -D @rolldown/perf-kit`。
2. 将 `dist-attrib/` 和 `perf-kit.vite.config.ts` 添加到 `.gitignore`，以免智能体提交它们。

与其他两个提示词不同，这个提示词列出了命令。我们已与编码智能体测试过这种形式。请保持 `<command>`、`<module>` 和 `<class modules>` 原样，因为智能体会填写它们。如果应用构建了多个 Worker，请为第一个 `worker-scan` 添加 `--worker <name>`。
:::

::: code-group

```text [浏览器页面加载]
Make <page> of our app at <repo path> load faster. Dependencies are installed
with <pm>. The build command is `<build command>`.

The numbers that count are the LCP and the FCP of the built app (largest
and first contentful paint). Measure them on a throttled mobile profile: fast
3G, 4x CPU, cold cache. Take a baseline before any change. Report every
result against it. Runs are noisy. You decide the run count.

Tools: run `npx @rolldown/perf-kit help` first. Its AGENTS.md is the manual.

Rules:
- Do not remove features.
- The rendered page must not change.
- `<test command>` must stay green.
- Make one change at a time. Keep it only when it is clearly faster. Revert
  all other changes.

Report:
- the numbers before and after
- every change you tried, with its delta, the reverted ones too
- for each kept change, the file and why it was safe
```

```text [Node 或 Deno 服务器启动]
Cut the startup time of our server at <repo path>. Dependencies are installed
with <pm>. The build command is `<build command>`. The entry is
`<dist/server.js>`.

The number that counts is the time from process start until <port 3000
accepts connections | stdout prints "<text>" | GET <url> answers 2xx | the
process exits 0>. Use a cold compile cache. Take a baseline before any
change. Report every result against it. Runs are noisy. You decide the run
count.

Tools: run `npx @rolldown/perf-kit help` first. Its AGENTS.md is the manual.
Read its server section.

Rules:
- Do not remove features.
- Keep the readiness signal as declared.
- `<test command>` must stay green.
- Make one change at a time. Keep it only when it is clearly faster. Revert
  all other changes.

Report:
- the numbers before and after
- every change you tried, with its delta, the reverted ones too
- for each kept change, the file and why it was safe
```

```text [Cloudflare Worker 启动]
Task: lower the Cloudflare Worker startup time of the app in DIR=<repo path>

Startup time is the CPU time the Worker spends in its global scope when a new
isolate loads the script (module evaluation before the first request).
Cloudflare limits this time.

Rules:
- Work only inside DIR. Do not read or change files outside DIR.
- Do not use the network: no web search, no web fetch, no git fetch or clone.
- Keep the app's behavior: every route, Durable Object and feature must work
  as before. Do not remove features.
- The app must still build with `<build command>` (run in DIR). Its tests must
  still pass (`<test command>` in DIR). Do not add TypeScript errors
  (`<typecheck command>` in DIR).
- Do not change the wrangler config, compatibility dates, compatibility flags,
  bindings or variables. Do not deploy or upload.
- Do not install, remove or upgrade packages.
- Budget: at most 10 rounds. A round is one code change followed by one build.
  Stop after round 10, or earlier when you have no more ideas. This budget
  overrides any instruction in a tool's AGENTS.md to continue.
- DIR is a git repository. Commit each change you keep (one commit per kept
  change). Revert each change you do not keep.

Tools: perf-kit is installed in this app. It measures the Worker startup and
shows which modules cost the time. Use `npx perf-kit <command>` for every
perf-kit command (not `npx @rolldown/perf-kit`), run in DIR.
1. Before round 1, read `DIR/node_modules/@rolldown/perf-kit/AGENTS.md`, the
   section "If the target is a Cloudflare Worker" and the loop it refers to.
2. Setup (not a round): `npx perf-kit worker-config --app .`, then
   `npx vite build --config perf-kit.vite.config.ts`, then
   `npx perf-kit worker-scan --app . --request / --pin`.
3. Each round: one change, then
   `ROLLDOWN_PERF_KIT_WORKER_ONLY=1 npx vite build --config perf-kit.vite.config.ts`,
   then `npx perf-kit worker-scan`. Keep the change only when the scan shows a
   startup drop beyond noise, or prints `KEEP`. `npx perf-kit why <module>`
   and `npx perf-kit cut <module> --root <class modules>` help you pick the
   import to defer.

Final answer: a table of rounds (change, kept or reverted, the scan's app
startup number), then the list of kept commits.
```

:::

## 阅读结果

智能体报告修改前后的数字，以及它尝试过的每项改动。对于页面，还要检查这 2 项：

- **结论清单。** 它会将每条线索标记为 OPEN、clear 或 UNKNOWN。对于每条 OPEN 线索，智能体必须给出理由：一次测量或一项约束。
- **渲染输出检查。** `scan --parity` 会将最终构建与原始构建比较。如果两者不同，该构建的数字在重新匹配之前都不作数。只有你可以接受差异（`npx @rolldown/perf-kit parity approve`）或添加掩码，之后每次结论都会列出它。

## 示例

此示例使用 Rolldown 仓库中的演示应用。它展示了一项被 perf-kit 保留的改动和一项被拒绝的改动。要获得你自己的数字，请运行 `just build-rolldown`，然后在 `packages/perf-kit` 中运行以下命令。下面的数字来自 Apple M3 Max。

```sh
$ node harness.mjs gen
$ node harness.mjs build
$ node harness.mjs scan
```

首次扫描会固定基线。以下是其部分输出：

```text
LCP 1224ms (p75 1226ms) | FCP 1224ms | load 1196ms | CLS 0 | transfer 167.1KB | 1 js requests

  ../src/features/charts.ts            145.4KB  paint   0.1%  settle 100.0%  post-paint-only
  ../src/features/badges.ts              4.2KB  paint   0.5%  settle  99.8%  post-paint-only

  [OPEN]    defer candidates (4) - charts 145.4KB, markdown 107.1KB, analytics 58.5KB
            next: lazy-load them, rebuild, re-measure

VERDICT: not done - 4 lead(s) OPEN, 0 signal(s) UNKNOWN or stale.
```

下图展示了同一次扫描的覆盖率部分。冷模块是指浏览器已下载并解析，但首次绘制没有运行的模块。381.3 KB 中约有 315 KB 是冷模块。

```dot
digraph {
    layout=neato;
    bgcolor="transparent";
    node [shape=box, style=filled, fixedsize=true, height=0.7, penwidth=0.6, fontname="Arial", fontsize=13, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [arrowhead=none, penwidth=0.7, color="${#3c3c43|#dfdfd6}"];

    charts [pos="1.068,1!", width=2.136, label="charts.ts\n145.4 KB", fillcolor="${#e5e7eb|#3f3f46}"];
    markdown [pos="2.923,1!", width=1.573, label="markdown.ts\n107.1 KB", fillcolor="${#e5e7eb|#3f3f46}"];
    analytics [pos="4.139,1!", width=0.859, label="analytics.ts\n58.5 KB", fontsize=11, fillcolor="${#e5e7eb|#3f3f46}"];
    badges [pos="4.600,1!", width=0.062, label="", fillcolor="${#e5e7eb|#3f3f46}"];
    i18n [pos="4.917,1!", width=0.571, label="", fillcolor="${#dcfce7|#14532d}"];
    hero [pos="5.383,1!", width=0.360, label="", fillcolor="${#dcfce7|#14532d}"];
    small [pos="5.583,1!", width=0.040, label="", fillcolor="${#dcfce7|#14532d}"];

    node [shape=plain, style="", fixedsize=false, fontsize=11];
    title [pos="2.45,1.58!", label="main.js, 381.3 KB. Each block is one module. Its width shows its size.", fontsize=12];
    badgesText [pos="3.8,0.2!", label="badges.ts\n4.2 KB"];
    i18nText [pos="4.52,0.2!", label="i18n.ts\n38.9 KB"];
    heroText [pos="5.32,0.2!", label="hero_data.ts\n24.5 KB"];
    smallText [pos="6.35,0.2!", label="3 small modules\n2.7 KB"];
    legend [pos="1.05,0.2!", label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="3" CELLPADDING="0"><TR><TD BORDER="1" COLOR="${#3c3c43|#dfdfd6}" BGCOLOR="${#e5e7eb|#3f3f46}" WIDTH="16" HEIGHT="11" FIXEDSIZE="TRUE"></TD><TD ALIGN="LEFT"> Cold at the first paint</TD></TR><TR><TD BORDER="1" COLOR="${#3c3c43|#dfdfd6}" BGCOLOR="${#dcfce7|#14532d}" WIDTH="16" HEIGHT="11" FIXEDSIZE="TRUE"></TD><TD ALIGN="LEFT"> Runs before the first paint</TD></TR></TABLE>>];

    badgesText -> badges;
    i18nText -> i18n;
    heroText -> hero;
    smallText -> small;
}
```

首次绘制只运行了 `charts.ts` 的 0.1%，因此该模块可以延迟加载。`defer` 命令会将其导入移到 `import()` 之后。它仅在演示应用中有效。在你的应用中，由智能体编辑导入。

```sh
$ node harness.mjs defer charts
$ node harness.mjs build
$ node harness.mjs scan --no-early-stop
```

```text
vs pinned baseline: FCP -318ms (-25.9%) -> improved (noise threshold 30ms)
vs pinned baseline: LCP -318ms (-25.9%) -> improved (noise threshold 30ms)
```

保留此改动。然后运行 `scan --pin`。下一项改动会延迟加载 `badges.ts`，其大小为 4.2 KB：

```text
vs pinned baseline: FCP -8ms (-0.9%) -> within-noise (noise threshold 30ms)
vs pinned baseline: LCP -8ms (-0.9%) -> within-noise (noise threshold 30ms)
next: neither FCP nor LCP improved beyond noise. Revert the change and test a different experiment.
```

降幅小于噪声，因此还原此改动。然后对最终构建运行 `scan --parity`：

```text
  [clear]   rendered output vs the original build - same on 1 of 1 page(s)

VERDICT: not done - 4 lead(s) OPEN, 0 signal(s) UNKNOWN or stale.
```

页面渲染结果相同，LCP 降低约 26%。结论仍为 `not done`，因为 `markdown.ts` 和其他线索仍为 OPEN。智能体必须修复每条线索或为其给出理由。

## perf-kit 如何判断改动

perf-kit 会将每次构建与固定的基线比较。首次扫描会固定基线，并将该构建保存为原始版本。随后智能体重复以下循环：

```dot
digraph {
    layout=neato;
    splines=curved;
    bgcolor="transparent";
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    first [pos="0,3.3!", label="First scan\npins the baseline,\nsaves the original", fillcolor="${#fff0e0|#4a2a0a}"];
    leads [pos="0,2.3!", label="Read the leads", fillcolor="${#dbeafe|#1e3a5f}"];
    change [pos="2.3,1.6!", label="Make one change", fillcolor="${#dbeafe|#1e3a5f}"];
    build [pos="2.3,0.7!", label="Build, run\nthe app tests", fillcolor="${#dbeafe|#1e3a5f}"];
    scan [pos="0,0!", label="scan\ncompares with the baseline", fillcolor="${#dbeafe|#1e3a5f}"];
    decide [pos="-2.4,1.15!", shape=plain, style="", label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="7" STYLE="ROUNDED" COLOR="${#3c3c43|#dfdfd6}"><TR><TD BGCOLOR="${#dcfce7|#14532d}">Gain beyond noise:<BR/>keep, scan --pin</TD></TR><HR/><TR><TD BGCOLOR="${#fee2e2|#7f1d1d}">No gain:<BR/>revert the change</TD></TR></TABLE>>];
    final [pos="0,1.15!", label="scan --parity\nverdict", fillcolor="${#fff0e0|#4a2a0a}"];

    exit [pos="0.62,1.76!", shape=plain, style="", fontsize=10, label="no more\nchanges"];

    first -> leads;
    leads -> change;
    change -> build;
    build -> scan;
    scan -> decide;
    decide -> leads;
    leads -> final [style=dashed];
}
```

每个目标都有自己的数字和规则：

| 目标   | 数字                                        | 满足以下条件时算作收益                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面   | FCP 和 LCP                                  | 两者之一降幅超过噪声，且两者升幅都不超过噪声。噪声为 30 毫秒或基线的 2%，取较大者。每次运行都必须同时具备两者。                                                                                                                                                                                                                                                                                                     |
| 服务器 | 应用启动时间（`runtime.app_startup_ms`）    | 时间降幅超过 8 毫秒或基线的 2%，取较大者。对于较小的启动时间，`node-scan` 会打印提示；此时使用字节数和模块数。                                                                                                                                                                                                                                                                                                     |
| Worker | 全局作用域时间（`worker.app_startup_ms`）   | 在固定构建与当前构建的成对运行中，时间下降。低于 3 毫秒下限时，全部 5 对都必须下降。如果 5 对中有 4 对下降，则再运行 4 对，且 9 对中必须有 8 对下降。超过下限时，5 对中需有 4 对或 9 对中需有 7 对一致。在噪声范围内的扫描，如果启动字节数减少 1%（至少 32 KB）或模块数减少 10%（至少 50 个），会打印 `KEEP`。                                                                                                     |

页面扫描还会固定节流设置。默认是 1.6 Mbit/s 网络、150 毫秒往返延迟和 4 倍 CPU 降速。较慢的应用最多可获得 8 倍带宽。如果你使用不同的节流设置，请在修改代码前重新固定基线。

::: info 为什么一次只做一项改动？
一次构建中包含 2 项改动时，数字无法说明是哪项改动带来了收益。一项改动造成的损失也可能被另一项改动的收益掩盖。Worker 有一个例外：当每个导入都低于下限时，智能体可以将其中 2 或 3 个作为一个组一起延迟加载。
:::

::: info 为什么只能由你接受渲染差异？
一项改动常常因为破坏了页面而让页面变快，例如样式表没有加载。如果智能体可以批准差异或添加掩码，它就能移除破坏的唯一迹象。
:::

::: info 为什么结论经常显示“not done”？
一个没有显示任何问题的信号，只能证明该信号看不到问题。因此结论需要每个信号都清晰且最新。固定的基线会记录收益，但不会关闭线索。
:::

## 线索

线索是 `scan` 在页面上发现的可能原因。它不是证据，因此请在源代码中检查并测量改动。延迟加载代码是指稍后加载，通常使用 `import()`。请先修复前 2 行。当页面受这些问题阻塞时，延迟加载可能测得比实际更差。

| 线索                              | 含义                                                                                       | 常见修复                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `render-blocking CSS`             | 首次绘制等待样式表，因此 JavaScript 改动无法移动 FCP。                                     | 内联小型关键 CSS。以非阻塞方式加载其余部分。                                                        |
| `LCP after load`                  | LCP 在 load 事件之后超过 150 毫秒才出现。下载、CPU 工作或隐藏元素都可能导致。              | 检查渲染在等待哪些响应。立即显示 LCP 元素，并仅对装饰元素做动画。                                    |
| `late chunk candidates`           | 静态导入在父级完成后超过一次往返才启动。                                                   | 如果绘制需要该代码块，请测试更早的 preload 或另一个代码块边界。如果不需要，则延迟加载。              |
| `pre-paint CPU`                   | 首次绘制前运行了长任务。                                                                   | 延迟首次渲染不需要的工作，例如预热缓存和遥测。                                                      |
| `defer candidates`                | 3 KB 或更大的模块在绘制时运行的字节数不足其大小的 2%。                                     | 将其导入移到 `import()` 之后。                                                                      |
| `cold bytes at paint`             | 浏览器获取并解析了模块，但首次绘制几乎不读取它。                                           | 延迟加载该导入。如果一次启动调用引入了大型 SDK，则延迟该调用。                                      |
| `static pre-paint transfer`       | 代码块在首次绘制前下载，在首次绘制后运行。                                                 | 按需加载它们，或将其从初始标签和 preload 中移除。                                                    |
| `large modules executed at paint` | 大型模块在绘制时运行。这不能证明首次渲染需要其内容。                                       | 检查首次渲染读取了其中多少内容。将剩余部分拆分到 `import()` 之后。                                  |
| `sibling variant groups`          | 一组语言区域或主题被加载，但一个会话只使用其中一个。                                       | 将默认项保留在入口中。使用 `import()` 加载当前变体。                                                |
| `statically retained imports`     | 一个模块在初始加载中保留了 100 KB 或更多。此线索需要构建报告。                             | 使用 [`what-if` 和 `cut`](#find-code-that-can-load-later) 找到要编辑的导入。                         |

`node-scan` 和 `worker-scan` 会输出其他线索。[`AGENTS.md`](https://github.com/rolldown/rolldown/blob/main/packages/perf-kit/AGENTS.md) 会解释每条线索以及修复顺序。

## 自行运行命令

你也可以在没有智能体的情况下运行这些命令。[README](https://github.com/rolldown/rolldown/blob/main/packages/perf-kit/README.md) 列出了所有命令、标志和输出文件。

### 页面

以 `npx @rolldown/perf-kit <command>` 的形式运行每条命令。

1. 构建应用并运行 `scan --app <dir>`。首次扫描会固定基线，并将构建副本保存为原始版本。后续命令会记住目标。要添加客户端路由，请使用 `--pages /pricing,/settings`。
2. 阅读输出中的线索。每条线索都会指出下一步。
3. 做一项改动。重新构建应用并运行其测试。
4. 运行 `scan --no-early-stop`。如果报告了超过噪声的改进，请运行 `scan --pin`。否则还原改动。
5. 完成后，运行 `scan --parity` 和 `verdict`。

### Node.js 或 Deno 服务器

```sh
$ npx @rolldown/perf-kit node-scan --entry dist/server.js --ready port:3000
```

`--ready` 声明服务器何时就绪：`port:<n>`、`stdout:<regex>`、会返回 2xx 的 `http://` URL，或 `exit`。perf-kit 会将其与目标一起固定。

`--exec deno` 使用 Deno 运行服务器。不支持 Bun。保留改动后，请运行 `node-scan --pin`。

### Cloudflare Worker

在应用文件夹中运行以下命令：

::: code-group

```sh [vp]
$ vp add -D @rolldown/perf-kit
$ vp exec perf-kit worker-config --app .
$ vp exec vite build --config perf-kit.vite.config.ts
$ vp exec perf-kit worker-scan --app . --request /
```

```sh [npm]
$ npm i -D @rolldown/perf-kit
$ npx perf-kit worker-config --app .
$ npx vite build --config perf-kit.vite.config.ts
$ npx perf-kit worker-scan --app . --request /
```

:::

`worker-config` 会写入一个包装应用配置的 Vite 配置。`--request` 添加启动后要调用的路由。保留改动后，请运行 `worker-scan --pin`。数字来自本地 CPU。请在改动前后使用 `wrangler check startup` 获取 Cloudflare 报告的数字。

### 已部署的站点

```sh
# Measure the deployed site in your own logged-in Chrome
$ npx @rolldown/perf-kit field --config field.json

# Save one deployed variant as a recording
$ npx @rolldown/perf-kit record --config field.json --variant base

# Serve the recording to a headless Chrome, with local builds in place of the deployed files
$ npx @rolldown/perf-kit replay --archive <dir> --dist base=<dir> --dist candidate=<dir>
```

在比较构建之前，请使用 `--calibrate` 检查录制。[README](https://github.com/rolldown/rolldown/blob/main/packages/perf-kit/README.md) 说明了具体方法。输出和录制包含你账户中的真实响应，因此 perf-kit 会将它们写在仓库之外。

### 查找可以延迟加载的代码 {#find-code-that-can-load-later}

以 `npx @rolldown/perf-kit <command>` 的形式运行每条命令。这些命令需要[构建报告](#configure-the-build)，且不需要运行浏览器。它们的数字是线索而非测量值，因此请用 `scan` 检查每项改动。

| 命令                  | 回答的问题                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `graph`               | 按保留大小排序的模块：当一个导入变为动态导入时从初始加载中移除的字节数，以及需要切断的链路。   |
| `what-if <module>...` | 延迟加载会释放的确切模块和字节数。对于 2 个或更多模块，它会将其作为一个方案计价。               |
| `cut <module>`        | 当多条路径到达该模块时，需要变为动态导入的最少导入语句数。                                     |
| `why <module>`        | 该模块的直接静态导入方，以及从入口出发的一条导入链。                                           |
| `graph-diff`          | 自固定基线以来进入或离开初始加载的模块及其字节数。                                             |

当多条路径到达一个模块时，`cut` 会有所帮助。在此示例中，有 3 个模块导入 `d3.js`，因此逐个直接导入编辑需要 3 次编辑。`cut` 找到 2 次：

```dot
digraph {
    rankdir=TB;
    bgcolor="transparent";
    node [shape=box, style="filled,rounded", fontname="Arial", fontsize=12, margin="0.2,0.1", color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];
    edge [fontname="Arial", fontsize=10, color="${#3c3c43|#dfdfd6}", fontcolor="${#3c3c43|#dfdfd6}"];

    main [label="main.js\n11.7 KB", fillcolor="${#fff0e0|#4a2a0a}"];
    sparkline [label="sparkline.js\n4.9 KB", fillcolor="${#dbeafe|#1e3a5f}"];

    subgraph cluster_leaves {
        label="Leaves the initial load: 273.6 KB";
        labeljust="l";
        labelloc="b";
        fontname="Arial";
        fontsize=11;
        fontcolor="${#3c3c43|#dfdfd6}";
        style="dashed,rounded";
        color="${#d44803|#ff712a}";

        charts [label="charts.js\n19.6 KB", fillcolor="${#dcfce7|#14532d}"];
        bar [label="bar-chart.js\n29.3 KB", fillcolor="${#dcfce7|#14532d}"];
        line [label="line-chart.js\n29.3 KB", fillcolor="${#dcfce7|#14532d}"];
        d3 [label="d3.js\n195.3 KB", fillcolor="${#dcfce7|#14532d}"];
    }

    main -> charts [color="${#d44803|#ff712a}", penwidth=2, style=dashed, label="  edit 1", fontcolor="${#d44803|#ff712a}"];
    main -> sparkline;
    charts -> bar;
    charts -> line;
    bar -> d3;
    line -> d3;
    sparkline -> d3 [color="${#d44803|#ff712a}", penwidth=2, style=dashed, label="  edit 2", fontcolor="${#d44803|#ff712a}"];
}
```

```text
min cut for src/d3.js - 2 import edge(s) to make dynamic (naive what-if would touch 3):
  src/main.js  ->  src/charts.js
  src/sparkline.js  ->  src/d3.js
make each import dynamic (import()) -> frees 273.6KB / 4 module(s) from the initial load.
```

编辑 1 还会移动 `charts.js` 和 2 个图表模块。请检查首次渲染是否不需要它们。

## 限制

- 实验室数字仅在单台机器和固定节流设置下有效。信号是两个构建之间的差异。
- 延迟加载只是转移工作，并不会删除工作。首次请求或交互需要该模块时，仍需承担其加载成本。
- 渲染输出检查看到的是服务器发送的页面，不包含交互。它不会比较点击、登录或实时数据之后的状态，因此请保持应用自身的测试通过。
- perf-kit 不会收集真实用户的指标。field 模式测量的是一个账户、一个网络和一台机器。
- 目前，`--ready exit` 和以 `^` 开头的 `stdout:` 模式在 inspector 下会超时。
