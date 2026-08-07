# 贡献指南

无论贡献大小，我们始终欢迎！本页汇总了参与 Rolldown 项目的一般准则。

## 开放式开发

所有开发工作都直接在 [GitHub](https://github.com/rolldown/rolldown) 上进行。核心团队成员和外部贡献者（通过 fork）提交的 pull request 都会经过相同的审查流程。

除 GitHub 外，我们还使用 [Discord 服务器](https://chat.rolldown.rs) 进行实时讨论。

## AI 使用政策

使用 AI 工具（包括 ChatGPT、Claude、Copilot 等 LLM）为 Rolldown 作贡献时：

- **请披露 AI 的使用情况**，以减轻维护者的负担
- **如果变更需要事先讨论，请在发起 pull request 前讨论**。遵循下文 [提交 pull request](#提交-pull-request) 的相同规则；如果不确定适用哪种方式，请先创建 issue
- 你需要对自己提交的所有 AI 生成 issue 或 PR **负责**
- **低质量或未经审查的 AI 内容会被立即关闭**
- **反复提交低质量（“slop”）PR 的贡献者会在不预先警告的情况下被封禁。**如果你承诺按照本政策为 Rolldown 作贡献，封禁可能被解除。可以通过我们的 [Discord](https://chat.rolldown.rs/) 申请解封。

我们鼓励使用 AI 工具辅助开发，但所有贡献在提交前都必须由贡献者充分审查和测试。对于 AI 生成的代码，贡献者必须理解并验证其内容，再进行调整以满足 Rolldown 的标准。

## 报告 bug

请先搜索现有 issue，确认没有相同问题后再在 GitHub 上提交 bug 报告。描述应尽可能详尽，并添加所有适用标签。

提高 bug 修复概率的最佳方式是提供最小复现，例如包含可运行示例的公开仓库、可用的代码片段，或指向 [REPL](https://repl.rolldown.rs/) 的链接，以便在浏览器中快速复现。

## 请求新功能

请求新功能前，请搜索 [open issues](https://github.com/rolldown/rolldown/issues)，其他人可能已经提出过相同请求。如果没有，请创建标题以 `[request]` 开头的 issue。描述应尽可能详尽，并添加所有适用标签。

## 提交 pull request

我们欢迎针对 bug、修复、改进和新功能的 pull request。发起前，请判断变更适用于以下哪种方式：[直接提交](#直接提交-pull-request)，或 [先讨论方案](#先讨论方案)。无论采用哪种方式，提交前都请确保构建能在本地通过。

有关配置项目开发环境的说明，请参阅 [配置项目](../development-guide/setup-the-project.md)。

> [!NOTE]
> 提交 pull request 前，请阅读 [开源协作礼仪](https://developer.mozilla.org/en-US/docs/MDN/Community/Open_source_etiquette) 一章。

### 直接提交 pull request

对于正确性不言自明的变更，无需事先讨论：

- 预期行为明确的 bug 修复
- 文档、拼写错误和注释修复
- 针对现有行为的测试
- 小型、独立且不影响用户的内部清理

如果存在相关 issue，请在 pull request 中添加链接。

### 先讨论方案

对于以下变更，请在开始编码或发起 pull request **之前**创建或评论 issue，并与团队达成一致：

- 新功能和新的公共 API
- 对现有公共 API 或默认行为的变更
- 修复尚未在 issue 讨论中就方案达成一致的问题

对于这些变更，难点通常是就正确方向达成一致，而不是编写代码。提前充分讨论，可以确保你的工作能够被合并，避免因方向仍未确定而停滞。

如果未达成一致就为此类变更发起 pull request，我们可能会将其关闭。**关闭并不代表否定你的工作，也不是拒绝你这位贡献者。**它只表示该变更需要先经过讨论流程。如果希望继续推动，请在关联 issue 或我们的 [Discord](https://chat.rolldown.rs) 中分享你的想法；一旦就方向达成一致，我们非常欢迎再次提交 pull request。

### 草稿 pull request

如果 pull request 仍在开发中，请将其创建为 [草稿](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request)，只有在确实希望团队审查时才标记为 **Ready for review**。将 PR 转为“Ready for review”会通知审阅者和代码所有者，因此请等到变更完成且构建在本地通过后再操作。这样维护者的收件箱便能集中处理真正需要关注的 PR。

### 分支组织

所有 pull request 都直接提交到 `main` 分支。我们只为即将发布的版本或破坏性变更使用单独分支，其他内容一律以 `main` 为目标。

进入 `main` 的代码必须兼容最新稳定版本。可以包含额外功能，但不能包含破坏性变更。我们应该能够随时基于 `main` 的最新提交发布新的次版本。
