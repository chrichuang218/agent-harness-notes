# Desktop 截图与实验映射

[课程首页](../../../README.md) · [机器可读映射](index.json)

这 19 张图片在 2026-10-03 从真实 Codex 模式窗口采集。公开版本只裁剪聊天中的相关区域，去掉无关项目、头像和输入法条，没有重绘界面或修改消息。图片保留裁剪后的原始像素尺寸，点击即可查看。

原始全窗口截图与可访问性文本保存在本地私有 `work/desktop-captures/`，不随仓库公开。映射 JSON 保存原图及公开图片的 SHA-256、裁剪矩形、章节、实验编号、任务和轮次。`savedAt` 是文件保存时间；旧实验截图为重新打开历史对话后补拍，实验发生时间以日志为准。

截图能对照界面上的操作和结果。工具是否执行、文件是否改变、流式片段何时到达，仍要核对相应 CPA、本地执行事件和文件观察。

| 截图 | 章节 | 实验日志 |
| --- | --- | --- |
| [问候、追问和读取 README 是同一任务里的三轮输入。](hello-continuation.png) | [01 一次请求与提示词组装](../../../course/01-request.md)、[04 任务与会话](../../../course/04-session.md) | [01-hello](../../../evidence/desktop-lab/01-hello/manifest.json)、[02-context](../../../evidence/desktop-lab/02-context/manifest.json)、[03-readme](../../../evidence/desktop-lab/03-readme/manifest.json) |
| [展开读取这一轮后，Desktop 显示“已读取 README.md”，随后给出三句话概括。](readme-tool.png) | [02 工具系统](../../../course/02-tools.md) | [03-readme](../../../evidence/desktop-lab/03-readme/manifest.json) |
| [修复后的回答列出三项检查和退出码；这是完成后的静态画面，流式过程另由 CPA 事件核对。](fix-result.png) | [03 Agent Loop](../../../course/03-agent-loop.md)、[14 流式输出与协议细节](../../../course/14-streaming.md) | [07-fix](../../../evidence/desktop-lab/07-fix/manifest.json) |
| [另一个任务面对相同临时代号问题，回答“不知道”。](new-chat-no-code.png) | [04 任务与会话](../../../course/04-session.md) | [08-session-new](../../../evidence/desktop-lab/08-session-new/manifest.json) |
| [Desktop 显示压缩标记，后续回答仍给出了代号、表达式和验证命令；触发方式以原生记录为准。](compaction.png) | [05 上下文管理](../../../course/05-context.md) | [08-session-resume](../../../evidence/desktop-lab/08-session-resume/manifest.json)、[10-compaction](../../../evidence/desktop-lab/10-compaction/manifest.json)、[10-compaction-check](../../../evidence/desktop-lab/10-compaction-check/manifest.json) |
| [读取 README 的回答以“项目观察：”开头，对应项目规则要求。](agents-prefix.png) | [06 AGENTS.md：项目规则](../../../course/06-agents.md) | [04-agents](../../../evidence/desktop-lab/04-agents/manifest.json) |
| [输入框只询问本轮编号，回答出现 Hook 注入的编号；该轮没有模型工具调用。](hook-marker-repeat.png) | [06 AGENTS.md：项目规则](../../../course/06-agents.md) | [hook-marker-repeat](../../../evidence/desktop-lab/hook-marker-repeat/manifest.json) |
| [用户消息中的 Price Project Check 技能与只读概览结果。](skill-invocation.png) | [07 Skills：可复用的工作方法](../../../course/07-skills.md) | [05-skills](../../../evidence/desktop-lab/05-skills/manifest.json) |
| [新任务明确从 docs/DECISIONS.md 读取项目决定，这是文件笔记实验。](file-memory-read.png) | [08 记忆与持久信息](../../../course/08-memory.md) | [12-memory-read](../../../evidence/desktop-lab/12-memory-read/manifest.json) |
| [Desktop 显示 Product Catalog 集成已使用，返回单价 12 元，随后按项目表达式得到 36 元。](mcp-query.png) | [09 MCP：接入外部能力](../../../course/09-mcp.md) | [13-mcp](../../../evidence/desktop-lab/13-mcp/manifest.json) |
| [protected.txt 的补丁被 PreToolUse 拦截；allowed.txt 的独立补丁成功，原始拒绝信息保留。](hook-pre-tool.png) | [10 权限与安全](../../../course/10-permissions.md) | [hook-pre-tool](../../../evidence/desktop-lab/hook-pre-tool/manifest.json) |
| [历史计划产物、用户“执行此计划”的输入与实施后的验证结果。](plan-and-implementation.png) | [11 Plan Mode](../../../course/11-plan.md) | [14-plan](../../../evidence/desktop-lab/14-plan/manifest.json)、[14-plan-implement](../../../evidence/desktop-lab/14-plan-implement/manifest.json) |
| [运行中的文字进度：读取与修改已完成，指定测试正在执行；这不是原生计划状态工具。](plan-progress.png) | [11 Plan Mode](../../../course/11-plan.md) | [plan-status](../../../evidence/desktop-lab/plan-status/manifest.json) |
| [完成后明确标注“文字进度”，并将各阶段与实际结果对照，测试退出码为 0。](plan-final.png) | [11 Plan Mode](../../../course/11-plan.md) | [plan-status](../../../evidence/desktop-lab/plan-status/manifest.json) |
| [父任务分别列出 A 的实现检查和 B 的测试覆盖检查，再作汇总。](multi-agent.png) | [12 多 Agent](../../../course/12-multi-agent.md) | [16-multi-agent](../../../evidence/desktop-lab/16-multi-agent/manifest.json) |
| [完成后的回收报告保留同一会话句柄与开始、结束时间；读取 README 的时序由本地执行记录核对。](background-return.png) | [13 目标、停止条件与续跑](../../../course/13-autonomy.md) | [background-return](../../../evidence/desktop-lab/background-return/manifest.json) |
| [受控实验先用过时上下文使补丁失败，再读取实际代码、修正补丁并通过测试。](patch-recovery.png) | [13 目标、停止条件与续跑](../../../course/13-autonomy.md) | [patch-recovery](../../../evidence/desktop-lab/patch-recovery/manifest.json) |
| [历史中断后只补运行尚未完成的测试，已通过的类型检查没有重跑。](interruption-resume.png) | [13 目标、停止条件与续跑](../../../course/13-autonomy.md) | [20-interrupted](../../../evidence/desktop-lab/20-interrupted/manifest.json)、[20-resume](../../../evidence/desktop-lab/20-resume/manifest.json) |
| [通过和故意失败的测试分别返回 0、1；失败断言为 13 !== 30，两个输出均进入 PostToolUse 记录。](hook-post-tool.png) | [15 完整复盘：架构与验证](../../../course/15-architecture.md) | [hook-post-tool](../../../evidence/desktop-lab/hook-post-tool/manifest.json) |

计划进度截图来自任务运行中，其余新实验图为完成后的画面。`plan-progress` 裁掉了上方含个人目录的读取命令行；实际测试命令和可见进度保留。原生计划状态工具本轮不可用，图中的清单明确是文字进度。

编号 Hook 的旧四组没有补拍截图；它们的原 rollout 当前无法重新取得，已用现存 CPA 合并日志核对公开副本。第 6 章采用新输入框实验的截图，保留原四组证据入口。
