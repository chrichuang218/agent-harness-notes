# Codex 是如何工作的

学 Java 或 TypeScript，通常从打印一句“Hello World”开始。理解 Codex，也可以从发送一句“你好”开始。

输入框里只有两个字，模型实际收到了什么？打开真实 Codex Desktop 的这次请求，可以逐项查看用户消息、应用指令、工具定义和环境信息，再对照响应，看一句回答怎样产生。这也是后面阅读日志的方法：先找到模型得到的信息，再追踪它的输出和下一步。

## 先认识这个项目

后续用一个简单的 TypeScript 项目作为实验载体。它计算商品总价，单价是 10 元，数量是 3，程序却输出 13 元。请 Codex 把结果修正为 30 元：它怎样找到错误，又怎样确认修复有效？接着仍用这个项目接入商品目录、增加折扣、安排子任务检查，观察失败或中断后怎样继续。

起始错误位于计算函数：

```typescript
export function calculateTotal(unitPrice: number, quantity: number): number {
  return unitPrice + quantity;
}
```

`10 + 3` 得到 13，期望计算的是 `10 × 3`。两种表达式的返回类型都是 `number`，所以类型检查可以通过，行为测试却会失败。第 3 章中，Codex 根据这个失败结果读取代码、修改运算，再运行检查。

阅读对话和日志，无需先配置环境。要自己操作，可以复制[故障快照](../examples/01-baseline/README.md)，使用 Node.js 24 或更高版本，将目录加入 Codex Desktop 项目区。CPA 需已转发 Desktop 请求并开启日志。保留计算错误，从第一章的“你好”开始。

后面的[修复版](../examples/07-fixed/README.md)、[MCP 版](../examples/13-mcp/README.md)与[折扣版](../examples/14-discount/README.md)用于对照不同阶段的项目状态。

## 从操作到机制

前 3 章依次处理一句问候、一次文件读取和一次修复。把读取操作的调用与返回配对后，就能继续追踪修复时的五次请求，判断每次返回怎样影响下一步。

接下来追查信息来源：历史怎样接续，规则与技能怎样进入上下文，文件笔记怎样供新任务读取。后续的 MCP、Hooks、权限、计划与多 Agent 都在这些操作之上展开，最后再核对任务完成、中断恢复和流式输出。

| 阅读阶段 | 主题 |
| --- | --- |
| 看懂一次运行 | [01 请求与提示词](01-request.md) · [02 工具系统](02-tools.md) · [03 Agent Loop](03-agent-loop.md) |
| 信息从哪里来 | [04 任务与会话](04-session.md) · [05 上下文](05-context.md) · [06 AGENTS.md](06-agents.md) · [07 Skills](07-skills.md) · [08 记忆](08-memory.md) |
| 扩展能力与控制执行 | [09 MCP](09-mcp.md) · [10 Hooks](10-hooks.md) · [11 权限](10-permissions.md) · [12 Plan Mode](11-plan.md) · [13 多 Agent](12-multi-agent.md) |
| 完成复杂任务与复盘 | [14 目标与续跑](13-autonomy.md) · [15 流式输出](14-streaming.md) · [16 架构与验证](15-architecture.md) |

复现时使用各章指定的项目状态。例如，加入折扣后的函数不能代替最初的故障版本。

## 怎样对照证据阅读

Desktop 对话里能看到任务要求和回答；CPA 记录让你展开实际请求、响应和请求中可见的完整上下文。公开副本经过脱敏，未记录的服务端内容不在观察范围内。要确认工具是否执行、任务是否完成，还需要查看本地会话记录、项目文件和测试结果。

遇到需要核对的字段，可以展开“深入核对”或进入工作台查看完整记录。章末的问题留给你先判断，再展开答案。

<details>
<summary>请求与执行记录</summary>

[实验索引](../evidence/desktop-lab/index.json)列出 43 组实验、110 个请求阶段，其中 3 次预热单独标记。

本地工具和 MCP 服务的执行状态不全在 CPA 日志里；核对执行时，还要找到对应的工具返回、进程记录与文件结果。

</details>

[开始第一章：一次请求与提示词组装](01-request.md)
