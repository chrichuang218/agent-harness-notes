# 点击“压缩”以后，历史怎样变化？

长任务需要控制上下文规模，压缩可能把详细过程整理成较短的接续材料。本章通过 Desktop 的原生“压缩”操作，核对界面、CPA 请求与本地会话替换事件，再验证哪些信息仍能继续使用。

## 从真实菜单触发

在包含修复记录和 `PRICE-A7` 代号的原任务中，通过输入框的 `/` 菜单点击“压缩”。点击前，界面显示“压缩此聊天的上下文（已使用 5%）”；完成后显示“上下文已压缩”和“上下文用量：1%”。

这些文字保存在[界面观察记录](../evidence/desktop-lab/ui-observations.json)中。这次是手动操作，不是等待自动达到阈值，也不是给模型发送一句“请帮我总结”来替代原生功能。

5% 与 1% 是界面显示的取整比例，不能直接解释成精确节省了 80% 的模型输入 token。它们的统计范围也不应与某份 CPA 响应的用量混为一谈。

## 网络里发生了什么？

CPA 捕获到一份 `response.create` 请求，共 35 项 `input`。末尾是客户端加入的压缩要求，以 `You are performing a CONTEXT CHECKPOINT COMPACTION` 开头。

请求的 `client_metadata["x-codex-turn-metadata"]` 是 JSON 字符串，解析后的相关字段节选如下：

```json
{
  "request_kind": "compaction",
  "compaction": {
    "trigger": "manual",
    "reason": "user_requested",
    "implementation": "responses",
    "phase": "standalone_turn",
    "strategy": "memento"
  }
}
```

在[压缩请求](../evidence/desktop-lab/10-compaction/00-request.request.json)中可以原样核对。这次实现确实使用 Responses 请求，元数据明确标为压缩；没有假设所有压缩都必须走一个独立命名的 HTTP 接口。

## 摘要生成，不是全部证据

仅看到模型写出摘要，还不足以证明应用替换了任务上下文。本次 rollout 随后记录了真正的 `compacted` 事件，保存于[本地压缩事件](../evidence/desktop-lab/10-compaction/compaction.json)。

其中 `compaction_response_id` 与 CPA 完成事件的 `response.id` 精确相同，`window_number` 变为 1，`replacement_history` 包含 6 项：5 条原用户消息，以及带接续说明的摘要消息。后者长 1,349 个 JavaScript 字符串长度单位，包含任务完成状态、修改、验证、约束和临时代号。

因此这份样本形成了可核对的链条：原生菜单操作 → 标记为压缩的网络请求 → 摘要响应 → 本地历史替换事件。公开导出对加密内容与个人标识做了脱敏，没有把它们解密或伪造成可读正文。

## 压缩后问三个具体问题

完成压缩后，在同一任务输入：

```text
不要读取文件。请根据当前上下文回答：实验临时代号是什么？修复后的总价表达式是什么？修复时验证了哪三条命令？
```

实际回答给出 `PRICE-A7`、`unitPrice * quantity`，以及 `npm run typecheck`、`npm test`、`npm start`，并指出退出码均为 0。没有工具调用。

[追问请求](../evidence/desktop-lab/10-compaction-check/00-request.request.json)共有 13 项输入，未携带 `previous_response_id`。其中 `input[2]` 到 `input[7]` 对应保留的用户消息与摘要，后面还附加了当前应用指令、项目规则和新问题。

这说明本次是用替换后的内容重建接续输入。它并非仅把旧响应 ID 换个名字，详细工具输出也没有按原来的完整序列重新出现在这份请求中。

## 哪些信息保留了，哪些仍然未知？

三个问题答对，支持“这些事实在压缩后仍可使用”。它不能证明历史细节全部无损，也不能证明模型此后永远不会遗漏。摘要本身可以逐条核对：业务状态、测试结果和重要约束是否准确，比只看“压缩完成”提示更有意义。

本次压缩消耗 25,806 输入 token、661 输出 token；压缩后追问消耗 33,723 输入、63 输出。两项都是正式响应，均无工具调用，统计排除预热。前者是生成压缩材料的工作，后者是用新上下文回答问题，不能把两者直接相减当作节省量。

## 练习：证明“已替换”

请从证据中分别找出摘要内容、原生替换事件和压缩后请求。若只留下摘要回答，为什么还不能证明 Desktop 真正用它接替了原历史？

<details>
<summary>参考解释</summary>

模型可以在普通对话里生成摘要，而应用继续保留原历史。这里额外存在 `compacted` 事件，其响应 ID 对应压缩请求，且后续请求实际使用了 `replacement_history` 中的消息。三个层次连起来，才支持这次原生压缩和接续确实发生。

</details>

[上一章：模型眼前的上下文，都从哪里来？](09-context.md) · [下一章：输入很少，为什么仍然有很多 token？](11-cache.md)
