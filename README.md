# Codex 是如何工作的

从一句“你好”到修复代码，通过真实对话与请求日志理解 Agent。

一次修复为什么需要多次模型请求？这份教程用真实 Codex Desktop 实验、截图和请求日志，解释项目规则、工具结果怎样进入上下文，以及模型怎样根据返回结果继续工作。

[在线阅读](https://chrichuang218.github.io/how-codex-works/) · [完整修复案例](https://chrichuang218.github.io/how-codex-works/#/lesson/03-agent-loop?section=agent-loop-timeline)

[![Codex 修复总价错误后运行类型检查、测试和示例](docs/images/desktop-lab/fix-result.png)](https://chrichuang218.github.io/how-codex-works/#/lesson/03-agent-loop?section=agent-loop-timeline)

项目起初把单价 10 元和数量 3 相加，输出 13 元；测试要求得到 30 元。教程从一句“你好”开始，经过读取文件和修复错误，再在同一个项目里学习上下文、规则、技能、MCP、计划和协作。

## 阅读路线

课程分为四个阶段、16 个主题。按顺序阅读正文，遇到需要核对的字段，再展开“深入核对”或查看工作台里的完整输入输出。左侧当前章的箭头可以收起小节，长目录可独立滚动。

第 3 章的时间线串起修复过程中的五次请求。每个节点显示模型的输入、调用和结果去向，并链接到对应证据。完整日志可以展开、复制和下载。

| 阶段 | 章节 |
| --- | --- |
| 看懂一次运行 | [01 请求与提示词](course/01-request.md) · [02 工具系统](course/02-tools.md) · [03 Agent Loop](course/03-agent-loop.md) |
| 信息从哪里来 | [04 任务与会话](course/04-session.md) · [05 上下文管理](course/05-context.md) · [06 AGENTS.md](course/06-agents.md) · [07 Skills](course/07-skills.md) · [08 记忆](course/08-memory.md) |
| 扩展能力与控制执行 | [09 MCP](course/09-mcp.md) · [10 Hooks](course/10-hooks.md) · [11 权限](course/10-permissions.md) · [12 Plan Mode](course/11-plan.md) · [13 多 Agent](course/12-multi-agent.md) |
| 完成复杂任务与复盘 | [14 目标与续跑](course/13-autonomy.md) · [15 流式输出](course/14-streaming.md) · [16 架构与验证](course/15-architecture.md) |

[术语与实例](GLOSSARY.md)用于查阅字段和概念。

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

Hooks、后台命令、补丁恢复和文字进度的脚本与测试见[运行状态练习](examples/runtime-lab/README.md)，其中分别提供起始文件和结果文件。

复现前先确认该章使用的项目状态。你的回答措辞和调用次数可能不同，可以对照输入、文件与执行结果判断差异。

## 怎样对照日志

[实验索引](evidence/desktop-lab/index.json)关联 43 组实验、110 个请求阶段，其中 3 次为预热。每个阶段可以查看客户端请求、CPA 上游请求、流式事件、完成事件和输出项。

截图展示操作和结果，工作台可切换请求、输出、工具往返和完整文件。判断工具是否执行、文件是否改变，还需要核对本地事件、文件内容与退出码。

第 10 章讲解 Hooks 的配置与信任状态，以及它和 AGENTS、Skills 的分工。编号注入、补丁拦截、执行结果记录分别对应不同的触发时机。第 14 章继续观察后台进程回收和补丁错误恢复。

[第 8 章](course/08-memory.md)对照项目文件笔记与原生记忆：一条偏好经过后台提取和整合后，怎样进入新任务？整合前的“不知道”和整合后的开关对照都有对应请求，可以查到答案的来源。

`output-items.json` 从流式事件中提取完整输出项。有些完成事件的 `output` 为空，回答和工具调用仍可在此前的流式事件中找到，第 15 章会解释它们的关系。

## 本地阅读与贡献

在本仓库根目录运行：

```powershell
npm ci
npm run dev
```

网站使用 Vite、Markdown 和按需加载的证据文件。[course/catalog.json](course/catalog.json)定义章节顺序，`course/` 保存正文，`evidence/desktop-lab/` 保存实验证据。

欢迎补充另一个版本的复现结果，或指出某段解释与证据不符。提交问题时，请附章节、操作、实际结果及脱敏后的相关片段。

[发布记录](CHANGELOG.md) · [维护记录](PROGRESS.md)

## 致谢

🙏 感谢 [LINUX DO](https://linux.do/) 社区的支持与讨论。
