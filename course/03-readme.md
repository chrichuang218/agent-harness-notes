# 请它读 README，谁执行了操作？

模型怎样知道磁盘上写了什么？本章把一次文件读取拆成可核对的闭环：模型提出工具调用，运行环境执行命令，工具结果进入下一次请求，模型据此回答。

仍在同一个 Desktop 任务中操作。项目保持[初始状态](../examples/01-baseline/README.md)，这次只读说明，不修复总价错误。

## 精确限定任务

发送：

```text
请只阅读项目的 README.md，用三句话说明项目做什么、如何运行、当前已知问题。不要修改任何文件，也不要修复问题。
```

Codex 先说明将阅读 README，随后执行 PowerShell 的 `Get-Content`，最后给出三句话：项目计算商品总价；需要 Node.js 24，并列出运行与检查命令；README 记载总价输出 13 而预期 30。

本轮有 **2 次正式模型请求、1 次工具调用**。一条用户消息并不等于一次模型请求：收到文件内容后，模型还需要继续处理。

## 从调用找到结果

第一次请求包含 13 项 `input`，包括前面的对话、本轮问题和助手进度文字。模型随后返回一个工具调用。下面节选[第一阶段输出项](../evidence/desktop-lab/03-readme/00-request.output-items.json)中的实际字段，省略了状态与内部元数据：

```json
{
  "type": "custom_tool_call",
  "call_id": "call_a288dLl8tyNv8JFlTJgNdtfK",
  "name": "exec",
  "input": "text(await tools.exec_command({cmd:\"Get-Content -LiteralPath 'E:\\\\Develop\\\\github\\\\codex-ts-demo\\\\README.md' -Raw\",\"max_output_tokens\":10000}));\n"
}
```

这里的 `exec` 是外层工具，传入的代码调用 `tools.exec_command`，再执行读取命令。本样本没有名为 `read_file` 的调用，也不是 `function_call` 类型。讲解时应沿用实际协议，避免用一个通用示意替换证据。

命令执行后，下一次请求的 `input[0]` 使用 `custom_tool_call_output`，并携带完全相同的 `call_id`。它的 `output` 是内容块数组，包含执行信息和 README 正文。编号让我们把“提出的调用”与“返回的结果”配对，而不只依赖显示顺序。

## 为什么第二次请求只有一项？

打开[第二次请求](../evidence/desktop-lab/03-readme/01-request.request.json)，其中这个字段原样记录为：

```json
{
  "previous_response_id": "resp_0e37249022131978016abbe1b0762087d08637b9adb365b489"
}
```

这是字段节选，不是完整请求。它恰好指向[第一次完成事件](../evidence/desktop-lab/03-readme/00-request.response.json)的 `response.id`。第二次 `input` 只有一项工具结果，历史通过响应引用接续。上一章观察到的是历史重发；这一次，同一任务的工具回传走了引用方式。

最终三句话位于[第二阶段输出项](../evidence/desktop-lab/03-readme/01-request.output-items.json)。读到这里，可以完整连起来：

```text
第一次请求 → custom_tool_call
执行 Get-Content → custom_tool_call_output
第二次请求（引用第一次响应）→ 最终回答
```

这张流程是依据本次事件整理的概括，完整字段仍以链接中的 JSON 为准。

## 读取证明了什么，没证明什么

工具结果的 `exit_code` 为 0，并带回 README 内容，支持“读取成功”的判断。README 说测试应失败，仍只是文件中的说明；本轮没有运行测试，不能宣称已经重新验证过故障。

两次正式响应合计输入 token 66,422、输出 token 185，排除预热。这个求和用于观察工作过程中的用量，不是费用，也不代表两份互不重复的上下文。

## 独立配对一次

只看本轮两阶段证据，分别找出 `call_id` 和 `previous_response_id`。它们各自连接哪两个对象？再指出哪一个值能证明命令成功退出。

<details>
<summary>参考解释</summary>

`call_id` 连接工具调用与工具结果；`previous_response_id` 连接第二次模型请求与第一次模型响应。工具结果内的 `exit_code: 0` 表示这次命令成功退出。三者作用不同，不能互相替代，也不能用它们证明本轮没有执行过的测试通过。

</details>

[上一章：再说一句话，怎样接着聊？](02-context.md) · [下一章：给项目加一条规则，会发生什么？](04-agents.md)
