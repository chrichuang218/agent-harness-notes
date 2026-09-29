# 把检查流程写成 Skill，怎样被用上？

项目约定描述持续适用的工作要求，Skill 则可以包装一次可重复的具体流程。本章把“查看用途、命令和实现差异”写成技能，观察目录信息、技能正文和工具执行分别在哪里出现。

## 准备一个小技能

在项目的 `.agents/skills/price-project-check/SKILL.md` 中放入以下内容。本次实验使用的正文是：

```markdown
---
name: price-project-check
description: 对商品总价项目做只读概览检查，核对用途、运行方式与实现是否符合 README。用于用户要求项目概览检查时，不用于运行测试或修复代码。
---

# 商品总价项目检查

读取项目根目录的 README.md、package.json 和 src/price.ts。

输出三个部分：用途、可用命令、实现与需求的差异。每个部分指出依据的文件。

只报告实际读到的信息；未运行测试时，明确写“未运行测试”。不要修改文件，也不要执行 npm 命令。
```

`name` 和 `description` 提供名称与适用说明，正文提供具体步骤和约束。这里只做只读检查，保留计算错误给后面的修复实验。

新建项目任务，显式发送：

```text
$price-project-check 请对当前项目做一次只读概览检查。
```

## 正文在工具调用之前就出现了

打开[第一阶段请求](../evidence/desktop-lab/05-skills/00-request.request.json)，可以找到三个不同位置：

| 位置 | 实际内容 |
| --- | --- |
| `input[2].content[1].text` | 可用技能目录，列出名称、描述和路径 |
| `input[6].content[0].text` | 输入框中的显式调用 |
| `input[7].content[0].text` | `<skill>` 块，含名称、路径与完整正文 |

因此本次显式调用时，Desktop 已经把技能正文附加到初始请求。我们不需要假设模型先从目录推断步骤，也不能把后续读取当成“第一次获得技能正文”。

“目录里出现技能”和“正文进入上下文”是两件可分别核对的事。本样本证明显式调用这条路径的行为；没有测试模型只凭描述自动选择技能时，正文会怎样加载。

## 四条命令，为什么只算一次工具调用？

模型返回一个 `custom_tool_call`。下面节选[输出项](../evidence/desktop-lab/05-skills/00-request.output-items.json)的三个原始字段，其余字段省略：

```json
{
  "type": "custom_tool_call",
  "call_id": "call_liyjTQFrR1JWvixVysn2Xm73",
  "name": "exec"
}
```

其 `input` 代码使用 `Promise.allSettled` 发起四个 `tools.exec_command`，读取 `SKILL.md`、`README.md`、`package.json` 和 `src/price.ts`。这次读取技能是再次核对文件；其他三个文件也在同一批代码中安排读取。

所以 Desktop 展示的四次命令执行，与 CPA 记录的一次外层工具调用并不矛盾。执行完成后，四份结果合在一个 `custom_tool_call_output` 中，使用同一个 `call_id` 回传。没有“模型先读完技能，再发起另一轮请求决定读三个文件”这个中间阶段。

## 流程怎样影响输出

最终回答按“用途、可用命令、实现与需求的差异”组织，并明确写出“未运行测试”。它指出代码把 `unitPrice` 与 `quantity` 相加，而 README 要求相乘。你可以在[最终输出项](../evidence/desktop-lab/05-skills/01-request.output-items.json)逐项核对。

这里的 `10 + 3 = 13` 是依据源码进行静态推算，不是本轮运行程序或测试得到的结果。技能要求“不执行 npm 命令”，实际工具结果也只包含文件读取。下一章再专门观察测试执行。

本轮共 2 次正式模型请求、1 次外层工具调用，输入 token 合计 67,312，输出 token 合计 707。统计排除预热，按模型响应求和；四条内部命令不会被写成四次模型工具调用，也不据此直接估算费用。

## 自己检查一次分层

在第二阶段请求里找到四份文件结果。它们是否拥有四个不同的 `call_id`？再回到第一阶段请求，说明为什么模型在读取文件之前就能够知道技能要求检查哪三个项目文件。

<details>
<summary>参考解释</summary>

第二阶段只有一个 `custom_tool_call_output` 和一个 `call_id`，其内容块包含四份执行结果。第一阶段的 `input[7]` 已附加完整技能正文，其中列出了三个项目文件。模型此次又读取了 Skill，但不能把读取发生的时点误当成正文首次进入上下文的时点。

</details>

[上一章：给项目加一条规则，会发生什么？](04-agents.md) · [下一章：测试失败了，Codex 怎样知道？](06-tests.md)
