# Codex 的一次完整运行

一个计算商品总价的 TypeScript 项目，单价是 10 元，数量是 3，程序却输出 13 元。请 Codex 修复它，最后得到 30 元，中间到底发生了什么？

本教程从 Desktop 中的一句“你好”开始，先读懂一份模型请求，再观察文件读取，随后沿真实日志追完这次修复。后续仍使用同一个项目：接入商品目录、增加折扣、安排子任务检查，并观察失败或中断之后如何继续。

## 先认识这个项目

起始错误位于计算函数：

```typescript
export function calculateTotal(unitPrice: number, quantity: number): number {
  return unitPrice + quantity;
}
```

`10 + 3` 得到 13，需求要求的是 `10 × 3`。两种表达式的返回类型都是 `number`，所以类型检查可以通过；行为测试会指出实际结果与预期不同。第 3 章将展示 Codex 如何读取代码、提出修改，再运行检查确认结果。

你可以先阅读这里保存的对话和日志，也可以把[故障快照](../examples/01-baseline/README.md)复制到自己的目录，使用 Node.js 24 或更高版本，将目录加入 Codex Desktop 项目区后复现。CPA 需要已经转发 Desktop 请求并开启日志。开始时保留计算错误，跟着第一章发送“你好”。

后面的[修复版](../examples/07-fixed/README.md)、[MCP 版](../examples/13-mcp/README.md)与[折扣版](../examples/14-discount/README.md)用于对照不同阶段的项目状态。

## 从操作到机制

前 3 章围绕一次运行展开。你会先找到输入框文字在请求中的位置，再把一次读取的调用和返回配对，最后看它如何扩展成五次请求的修复过程。

接下来的章节追查信息来源：对话历史怎样接续，规则与技能怎样进入上下文，文件笔记怎样供新任务读取。等这些关系清楚了，再看 MCP、权限、计划与多 Agent。最后把目标、中断、流式事件放回完整运行过程，检查自己的解释是否有证据支持。

| 阅读阶段 | 主题 |
| --- | --- |
| 看懂一次运行 | [01 请求与提示词](01-request.md) · [02 工具系统](02-tools.md) · [03 Agent Loop](03-agent-loop.md) |
| 信息从哪里来 | [04 任务与会话](04-session.md) · [05 上下文](05-context.md) · [06 AGENTS.md](06-agents.md) · [07 Skills](07-skills.md) · [08 记忆](08-memory.md) |
| 扩展能力与控制执行 | [09 MCP](09-mcp.md) · [10 权限](10-permissions.md) · [11 Plan Mode](11-plan.md) · [12 多 Agent](12-multi-agent.md) |
| 完成复杂任务与复盘 | [13 目标与续跑](13-autonomy.md) · [14 流式输出](14-streaming.md) · [15 架构与验证](15-architecture.md) |

章节按理解机制的顺序安排，实际实验的先后顺序保留在原日志中。复现某一章时，请使用它指定的项目状态；例如加入折扣后的函数不能代替最初的故障版本。

## 怎样对照证据阅读

Desktop 对话说明用户提出了什么任务、看到了什么结果。CPA 请求和响应显示模型收到的内容及产生的输出。本地会话记录、项目文件和测试结果则用来核对执行是否发生、任务是否完成。

主文会沿一条具体过程解释机制。需要追到字段时，可以展开“深入核对”，或使用每章的内嵌工作台查看全部请求阶段、完整输入输出与来源。练习留在章末，答案可以折叠，先自己判断再核对。

<details>
<summary>实验来源与公开记录的范围</summary>

材料来自 2026 年 9 月 29 日至 30 日的真实实验，共[26 组实验、74 个请求阶段](../evidence/desktop-lab/index.json)，其中 3 次预热单独标记。[真实 Desktop 截图](../docs/images/desktop-hello-readme.png)由实验者提供，与前三轮消息对应；普通输入由 Computer Use 通过输入框代发，原生操作另有记录。

公开 JSON 保留结构，对个人目录、凭据和加密内容作了替换，未导出认证头。各实验的 `manifest.json` 记录来源和脱敏位置。`output-items.json` 是从流式输出项完成事件中提取的衍生文件，原始完成事件没有被补写。正文中的节选和阅读代号另作说明。

这些日志记录 CPA 可见的模型链路，不包含上游服务未公开的内部处理。原生 Memories 的自动生成与召回未实测，第 8 章会把它与已经验证的文件笔记区分开。

早期材料仍可查阅：[两轮对话讲义](../lessons/01-codex-cpa-trace/学习文档.md)、[按实验顺序编排的讲义存档](../lessons/02-desktop-lab-chronological/README.md)。

</details>

[开始第一章：一次请求与提示词组装](01-request.md)
