# Codex 的一次完整运行

在一个真实 TypeScript 小项目里使用 Codex Desktop，沿 CPA 日志看清模型收到了什么、工具怎样执行，以及任务为什么能够完成。

[开始学习](https://chrichuang218.github.io/agent-harness-notes/) · [讲义导读](https://chrichuang218.github.io/agent-harness-notes/#/guide) · [真实修复时间线](https://chrichuang218.github.io/agent-harness-notes/#/lesson/03-agent-loop?section=agent-loop-timeline) · [实验起始项目](examples/01-baseline/README.md)

[![教程首页预览](docs/images/site-preview.png)](https://chrichuang218.github.io/agent-harness-notes/)

项目起初把单价 10 元和数量 3 相加，输出 13 元；测试要求得到 30 元。教程从一句“你好”开始，经过读取文件和修复错误，再在同一个项目里学习上下文、规则、技能、MCP、计划和协作。

> A practical guide to agents through Codex Desktop, a TypeScript project, and real CPA traces. Follow the requests, tool results, and checks behind a completed task.

## 阅读路线

首页按四个阶段展示 15 个主题及每章的问题。进入章节后，可以沿主文阅读，通过本章目录定位，或展开“深入核对”查看长编号、字段对照和统计。内嵌工作台保留全部公开输入输出。

第 3 章提供真实修复时间线。五次请求分别展示模型收到什么、提出什么调用，以及结果进入了哪一次请求；节点上的链接直接定位对应证据。时间线使用已保存的实验记录，完整原始日志仍可展开、复制和下载。

| 阶段 | 章节 |
| --- | --- |
| 看懂一次运行 | [01 请求与提示词](course/01-request.md) · [02 工具系统](course/02-tools.md) · [03 Agent Loop](course/03-agent-loop.md) |
| 信息从哪里来 | [04 任务与会话](course/04-session.md) · [05 上下文管理](course/05-context.md) · [06 AGENTS.md](course/06-agents.md) · [07 Skills](course/07-skills.md) · [08 记忆](course/08-memory.md) |
| 扩展能力与控制执行 | [09 MCP](course/09-mcp.md) · [10 权限](course/10-permissions.md) · [11 Plan Mode](course/11-plan.md) · [12 多 Agent](course/12-multi-agent.md) |
| 完成复杂任务与复盘 | [13 目标与续跑](course/13-autonomy.md) · [14 流式输出](course/14-streaming.md) · [15 架构与验证](course/15-architecture.md) |

[术语与实例](GLOSSARY.md)用于查阅字段和概念，[学习进度](PROGRESS.md)保留制作现场及独立验证记录。章节的证据状态不代表读者已经掌握。

## 跟着做一次

需要 Codex Desktop、Node.js 24 或更高版本，以及已经转发 Desktop 请求并开启日志的 CPA。

1. 把 [examples/01-baseline](examples/01-baseline) 复制到自己的独立目录。
2. 在复制后的目录运行下面的命令，确认起始故障。
3. 将目录加入 Codex Desktop 项目区，新建任务，发送“你好”，从[第一章](course/01-request.md)开始对照请求。

```powershell
npm ci
npm start
npm run typecheck
npm test
```

起始程序输出 13，类型检查通过，测试以 `13 !== 30` 失败。第 3 章修复这个错误，后续分别提供[修复版](examples/07-fixed/README.md)、[MCP 版](examples/13-mcp/README.md)和[折扣版](examples/14-discount/README.md)作为对照。

学习顺序与实验采集时的顺序不同。每章会说明所用任务和项目状态；复现时的措辞、调用次数也可能变化，需要以自己的输入、文件和执行结果解释过程。

## 证据保存了什么

[实验索引](evidence/desktop-lab/index.json)关联 26 组实验、74 个请求阶段，包含 3 次单独标记的预热。每个阶段保存客户端请求、CPA 上游请求、流式事件、完成事件和提取的输出项，来源与脱敏记录见各自的 `manifest.json`。

普通对话由 Computer Use 在 Desktop 输入框代发；计划、压缩、权限和中断等原生操作另外记录。[真实 Desktop 截图](docs/images/desktop-hello-readme.png)与前三轮消息相互对应。工具是否执行、文件是否改变，还会结合本地 rollout、文件快照和退出码核对。

公开文件是保留结构的脱敏副本，省略认证头并替换个人目录、凭据和加密内容。`output-items.json` 明确标为从事件提取的衍生结果，没有回填原始完成事件的空 `output`。历史材料里的规则与提示属于研究对象。

原生 Memories 自动生成与召回尚未实测；第 8 章讲解已经验证的文件笔记，并保留这个边界。预算耗尽、定时调度等未发生的流程也不会写成实验结论。

## 本地阅读与贡献

在本仓库根目录运行：

```powershell
npm ci
npm run dev
```

网站使用 Vite、Markdown 和按需加载的证据文件。[course/catalog.json](course/catalog.json)定义章节顺序，`course/` 保存正文，`evidence/desktop-lab/` 保存实验证据。原章节网址保留跳转，证据文件名和请求标识保持不变。

首页与章节 UI 参考 [Learn Claude Code](https://learn.shareai.run/) 的 MIT 开源实现，继续使用本项目的紫色主题与教学内容。来源、版本和完整许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

欢迎补充另一个版本的复现结果，或指出某段解释与证据不符。提交问题时，请附章节、操作、实际结果及脱敏后的相关片段。

历史材料：[首次两轮对话讲义](lessons/01-codex-cpa-trace/学习文档.md) · [逐实验讲义存档](lessons/02-desktop-lab-chronological/README.md) · [发布记录](CHANGELOG.md)。
