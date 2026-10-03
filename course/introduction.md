# Codex 的一次完整运行

一个计算商品总价的 TypeScript 项目，单价是 10 元，数量是 3，程序却输出 13 元。请 Codex 修复它，最后得到 30 元，中间到底发生了什么？

我们从 Codex Desktop 中的一句“你好”开始，找到它在请求里的位置；再请 Codex 读取文件，沿日志追完这次修复。后续仍使用同一个项目：接入商品目录、增加折扣、安排子任务检查，并观察失败或中断之后如何继续。

## 先认识这个项目

起始错误位于计算函数：

```typescript
export function calculateTotal(unitPrice: number, quantity: number): number {
  return unitPrice + quantity;
}
```

`10 + 3` 得到 13，需求要求的是 `10 × 3`。两种表达式的返回类型都是 `number`，所以类型检查可以通过；行为测试会指出实际结果与预期不同。第 3 章将展示 Codex 如何读取代码、提出修改，再运行检查确认结果。

阅读已保存的对话和日志，无需先配置环境。要自己操作，可以复制[故障快照](../examples/01-baseline/README.md)，使用 Node.js 24 或更高版本，将目录加入 Codex Desktop 项目区。CPA 需已转发 Desktop 请求并开启日志。保留计算错误，从第一章的“你好”开始。

后面的[修复版](../examples/07-fixed/README.md)、[MCP 版](../examples/13-mcp/README.md)与[折扣版](../examples/14-discount/README.md)用于对照不同阶段的项目状态。

## 从操作到机制

前 3 章围绕一次运行展开。你会先找到输入框文字在请求中的位置，再把一次读取的调用和返回配对，最后看它如何扩展成五次请求的修复过程。

接下来的章节追查信息来源：历史怎样接续，规则与技能怎样进入上下文，文件笔记怎样供新任务读取。在此基础上，再看 MCP、权限、计划与多 Agent，最后核对目标完成、中断和流式输出。

| 阅读阶段 | 主题 |
| --- | --- |
| 看懂一次运行 | [01 请求与提示词](01-request.md) · [02 工具系统](02-tools.md) · [03 Agent Loop](03-agent-loop.md) |
| 信息从哪里来 | [04 任务与会话](04-session.md) · [05 上下文](05-context.md) · [06 AGENTS.md](06-agents.md) · [07 Skills](07-skills.md) · [08 记忆](08-memory.md) |
| 扩展能力与控制执行 | [09 MCP](09-mcp.md) · [10 权限](10-permissions.md) · [11 Plan Mode](11-plan.md) · [12 多 Agent](12-multi-agent.md) |
| 完成复杂任务与复盘 | [13 目标与续跑](13-autonomy.md) · [14 流式输出](14-streaming.md) · [15 架构与验证](15-architecture.md) |

章节按理解机制的顺序安排，实际实验的先后顺序保留在原日志中。复现某一章时，请使用它指定的项目状态；例如加入折扣后的函数不能代替最初的故障版本。

## 怎样对照证据阅读

Desktop 对话说明用户提出了什么任务、看到了什么结果。CPA 请求和响应显示模型收到的内容及产生的输出。本地会话记录、项目文件和测试结果则用来核对执行是否发生、任务是否完成。

正文先解释发生了什么；“深入核对”和内嵌工作台供你追查字段、完整输入输出与来源。章末的问题可以先自己判断，再展开答案。

<details>
<summary>实验来源与公开记录的范围</summary>

核心材料来自 2026 年 9 月 29 日至 30 日，10 月 3 日又补充了 Hook、后台命令回收、编辑恢复和文字进度实验。现有[36 组实验、103 个请求阶段](../evidence/desktop-lab/index.json)，其中 3 次预热单独标记。[最初的 Desktop 截图](../docs/images/desktop-hello-readme.png)由实验者提供，与前三轮消息对应。

普通输入实验由 Computer Use 在 Desktop 输入框提交，原生操作另有记录。Hook 的三组早期对照使用 `create_thread` 提交，已在对应材料中单独标明；它们不作为输入框路径的信任状态对照。

章节中的补充截图摄于 2026-10-03，其中旧实验通过重新打开历史对话拍摄，新实验保留执行中或完成后的画面。图片只裁剪界面区域，未改写命令、报错或结果；每张图对应的实验、轮次与裁剪信息见[截图索引](../docs/images/desktop-lab/index.json)。

公开 JSON 保留结构，对个人目录、凭据和加密内容作了替换，未导出认证头。各实验的 `manifest.json` 记录来源和脱敏位置。`output-items.json` 是从流式输出项完成事件中提取的衍生文件，原始完成事件没有被补写。正文中的节选和阅读代号另作说明。

这些日志记录 CPA 可见的模型链路，不包含上游服务未公开的内部处理。原生 Memories 的自动生成与召回未实测，第 8 章只验证了文件笔记。这里使用的是 Codex Desktop 产品和一个简单 TS demo；总价、折扣等结果只证明各次实验约定的场景，没有验证生产业务系统。

早期材料仍可查阅：[两轮对话讲义](../lessons/01-codex-cpa-trace/学习文档.md)、[按实验顺序编排的讲义存档](../lessons/02-desktop-lab-chronological/README.md)。

</details>

[开始第一章：一次请求与提示词组装](01-request.md)
