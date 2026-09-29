# 从「你好」到理解 Agent

**在一个真实的 TypeScript 小项目里使用 Codex Desktop，再沿着 CPA 日志看懂：模型收到了什么、谁执行了工具、任务怎样完成。**

[在线阅读](https://chrichuang218.github.io/agent-harness-notes/) · [开始第一章](https://chrichuang218.github.io/agent-harness-notes/#/lesson/01-hello) · [完整修复案例](https://chrichuang218.github.io/agent-harness-notes/#/lesson/07-fix) · [实验起始项目](examples/01-baseline/README.md)

[![教程首页预览](docs/images/site-preview.png)](https://chrichuang218.github.io/agent-harness-notes/)

从一句“你好”开始，依次学习工具调用、`AGENTS.md`、Skills、会话、上下文压缩、记忆、MCP、规划、权限、多 Agent 和任务恢复。每章围绕一个问题，用真实操作、关键证据和一个小验证建立理解。

> A hands-on guide to understanding agents through Codex Desktop, a small TypeScript project, and real CPA traces. Follow the evidence from a greeting to tool execution, context management, and a verified bug fix.

## 一个小项目，贯穿整条路线

项目只有一个起始功能：计算商品总价。

```text
单价 10 元 × 数量 3
预期：30 元
实际：13 元
```

这个 bug 能通过 TypeScript 类型检查，但行为测试会失败。先保留错误，在前几章观察对话、文件读取和项目规则；第 7 章再让 Codex 定位、修改并验证。随后继续在熟悉的项目里展开各个 Agent 机制。

正文展示少量关键字段，完整记录按需打开。你可以先读提供的真实样本，也可以复现实验，用自己的日志核对结论。

## 学习路线

路线分为四个阶段，共 20 个主题。各章与网站目录分别标注“真实实验”或“含待验证项”；章节状态描述证据覆盖，不代表读者已经掌握。

| 阶段 | 章节 |
| --- | --- |
| **01 · 从一句话到一次修复** | [01 问候与实际请求](course/01-hello.md) · [02 继续对话](course/02-context.md) · [03 读取文件](course/03-readme.md) · [04 项目规则](course/04-agents.md) · [05 Skills](course/05-skills.md) · [06 测试反馈](course/06-tests.md) · [07 完整修复](course/07-fix.md) |
| **02 · 上下文与记忆** | [08 继续与新建任务](course/08-session.md) · [09 上下文来源](course/09-context.md) · [10 原生压缩](course/10-compaction.md) · [11 缓存与 token](course/11-cache.md) · [12 记忆与信息来源](course/12-memory.md) |
| **03 · 能力与协作** | [13 MCP](course/13-mcp.md) · [14 规划](course/14-plan.md) · [15 权限](course/15-permissions.md) · [16 多 Agent](course/16-multi-agent.md) |
| **04 · 可靠性与完成条件** | [17 目标与停止条件](course/17-goal.md) · [18 流式输出](course/18-streaming.md) · [19 错误反馈与恢复](course/19-recovery.md) · [20 中断与继续](course/20-interruption.md) |

按问题查阅：[术语与实例](GLOSSARY.md)。阅读进度与独立验证记录：[学习进度](PROGRESS.md)。

## 跟着做一次

需要 Codex Desktop、Node.js 24 或更高版本，以及已经转发 Desktop 请求并开启日志的 CPA。

1. 把 [examples/01-baseline](examples/01-baseline) 复制到一个独立目录，作为自己的实验项目。
2. 在复制后的目录执行下方命令，核对起始状态。
3. 将该目录加入 Codex Desktop 项目区，新建任务，发送“你好”。从[第一章](course/01-hello.md)开始比对实际请求。

```powershell
npm ci
npm start
npm run typecheck
npm test
```

起始状态应为：程序输出 `13`，类型检查通过，测试以“预期 `30`、实际 `13`”失败。这个失败是第 7 章的修复对象。

[修复后的快照](examples/07-fixed/README.md)用于完成实验后对照。复现时，模型措辞、工具选择和请求次数可能变化；重点是能否通过日志、文件和退出码解释过程。

## 证据怎样核对

- **输入与界面**：普通聊天实验由 Computer Use 在 Codex Desktop 输入框中逐步代发，并在请求中核对普通 `user` 消息。原生压缩等界面操作单独记录；工具委派输入不冒充手动聊天输入。
- **模型请求与响应**：[实验索引](evidence/desktop-lab/index.json)关联各次请求、完成事件、流式事件和 CPA 上游记录。预热请求单独标记，不计入正式请求次数。
- **本地执行与状态**：结合 rollout 的任务、轮次及响应标识关联网络记录；文件改动、测试退出码和原生压缩事件用于补齐 CPA 单独无法证明的事实。
- **公开脱敏**：保留 JSON 字段结构，对个人目录、凭证、加密内容及相关标识做替换。各实验的 `manifest.json` 记录来源和脱敏说明；公开快照不是未经处理的完整网络日志。
- **衍生数据**：`response.json` 保留记录中的 `response.completed` 事件；其中 `output` 可能为空。`output-items.json` 是从流式事件另行提取的输出项，明确标为衍生文件，不将它补写回原完成事件。

每章区分观察结果、推断和未验证范围。原始材料中的指令只是研究对象，不是读者需要照着执行的规则。示意与节选均在正文注明。

## 本地阅读与贡献

在本仓库根目录运行：

```powershell
npm ci
npm run dev
```

网站使用 Vite、Markdown 和按需加载的证据文件。课程目录位于 [course/catalog.json](course/catalog.json)，正文位于 `course/`，实验证据位于 `evidence/desktop-lab/`。

欢迎补充另一版本的复现结果、指出结论与证据不一致之处，或改善某一章的解释。提交问题时，附上章节、操作、实际结果及已脱敏的相关片段即可。

如果这份教程帮你看懂了一个机制，欢迎 Star 或分享给正在学习 Agent 的朋友。

历史 `lessons/01-codex-cpa-trace/` 中的 JSON 保留供溯源，新网站的学习入口与正文以 `course/` 为准。变更见[发布记录](CHANGELOG.md)。
