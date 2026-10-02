# 逐渐出现的文字，怎样组成一次响应？

Desktop 中一段回答逐渐显示，CPA 日志中则出现许多事件。这些事件如何组成同一条消息？本章复用第七章的最后一次响应，把片段、完整文本与完成标记对应起来。

用户原任务是修复总价错误并运行三项验证。工具结果返回后，模型生成以“已修复”开头的最终说明。本章只检查这最后一个阶段，不重新运行修复。

## 这次生成之前，模型刚收到了什么？

第 7 章[阶段 03 输出](../../evidence/desktop-lab/07-fix/03-request.output-items.json)提出一次 `exec`，内部安排 typecheck、test、start 和文件重读。调用编号是 `call_6YUxjdksnb3eIeh5ySJjO2p8`。本地执行完成后，[阶段 04 请求](../../evidence/desktop-lab/07-fix/04-request.request.json)把所有结果放在一个 `custom_tool_call_output` 中，沿相同编号返回。

这一请求的 `previous_response_id` 是 `resp_0061bd7340416e34016abbe37f911087d0833167280989557b`，指向发出验证调用的上一响应。因此模型生成下面的回答时，不只有“已修复”三个字可用，而是已经获得修复任务、此前动作以及三条命令的退出码等上下文。

服务为新一轮生成创建响应 `resp_0061bd7340416e34016abbe3868fc487d088322102a9cdf40e`。后面的文本增量属于这次生成；不是每追加一个字就重新发送一次工具结果或再做一次验证。

## 一条回答，154 个事件

打开[阶段 04 流式事件](../../evidence/desktop-lab/07-fix/04-request.events.json)。其中共有 154 个 `response.*` 事件，146 个是 `response.output_text.delta`。这些数字描述本样本，不是固定协议要求。

开头几个文本增量依次是：

```text
“已” → “修” → “复” → “：[” → “src” → “/” → “price” → “.ts”
```

这行是按实际 `delta` 字段整理的顺序示意。它们共同构成“已修复：[src/price.ts…”这条消息的开头，不是八次独立回答。

## 读懂一个增量事件

下面节选第一条文本增量的原始字段，省略日志外层时间戳及其他字段：

```json
{
  "type": "response.output_text.delta",
  "content_index": 0,
  "delta": "已",
  "item_id": "msg_0061bd7340416e34016abbe38c863087d083ee1e42b33a80b9",
  "output_index": 0,
  "sequence_number": 4
}
```

`delta` 提供新增文字，`item_id` 标识所属输出项，两个索引用于定位输出项和内容块，`sequence_number` 标识事件顺序。真实消费者应按所属对象处理片段，不能把不同消息的增量不加区分地拼在一起。

本样本只有一个文本输出项，146 个 `delta` 按顺序拼接后，与 `response.output_text.done.text` 完全一致，也与 `response.output_item.done.item.content[0].text` 完全一致。完整文本有 307 个 JavaScript 字符串长度单位；这个长度不是 token 数，增量个数也不是 token 数。

## “文本结束”与“响应结束”各表示什么？

本样本依次出现这些层次：

| 事件 | 在这份记录中的作用 |
| --- | --- |
| `response.created` / `response.in_progress` | 响应建立并开始进行 |
| `response.output_item.added` / `response.content_part.added` | 开始一个输出项及其内容块 |
| `response.output_text.delta` | 逐段追加文本 |
| `response.output_text.done` | 提供该文本块的完整文字 |
| `response.content_part.done` / `response.output_item.done` | 标记内容块和输出项完成 |
| `response.completed` | 标记整个响应完成并带回用量等信息 |

看到一个文本块结束，不能不看后续就认定整个响应结束；一次响应还可能包含其他输出项。这里最终观察到 `response.completed`，才有这份响应正常完成的证据。

## 文本流与工具调用流，不是同一种内容

回看[阶段 03 的事件](../../evidence/desktop-lab/07-fix/03-request.events.json)，会看到 187 个 `response.custom_tool_call_input.delta`，随后是对应的 `input.done` 和 `output_item.done`。它们逐步组成的是 `exec` 的 JavaScript 输入。到了阶段 04，146 个 `response.output_text.delta` 组成的才是面向用户的回答。

| 响应阶段 | 主要增量类型 | 组装后的对象 | 运行环境接下来做什么 |
| --- | --- | --- | --- |
| 03 | `response.custom_tool_call_input.delta` | 一次 `custom_tool_call` 的完整输入 | 执行其中安排的验证工具，把结果交回模型 |
| 04 | `response.output_text.delta` | 一条 assistant 文本消息 | 显示回答，本轮没有后续工具调用 |

所以界面里看到某些文字正在出现，不一定代表模型正在回答用户；模型也可能正在生成工具参数。工具定义负责规定可调用接口，调用流负责形成这一次的具体动作，工具结果负责返回实际执行信息，这三层不能合并成“模型在终端输出”。

本样本第 04 阶段的 `sequence_number` 从 0 开始：0/1 建立响应，2/3 建立输出项和内容块，4～149 追加文本，150 返回完整文本，151/152 结束块与输出项，153 结束响应。序号解释事件顺序，`call_id` 则连接工具调用与返回；它们承担不同关联职责。

## 完成事件没有正文，不等于回答消失

本次[完成事件](../../evidence/desktop-lab/07-fix/04-request.response.json)中的 `response.output` 是空数组，但完整消息已经通过前面的事件返回。若采集器只保存完成事件，会丢掉解释界面文字所需的证据。

因此教程同时保存事件序列，以及从 `response.output_item.done` 提取的[输出项文件](../../evidence/desktop-lab/07-fix/04-request.output-items.json)。后者明确标为衍生汇集；没有修改原始完成事件来制造一份“原本就有完整正文”的记录。

一个可复核的读法是：先按 `item_id` 和内容位置收集 delta，再与 `output_text.done.text` 比较，最后核对 `output_item.done.item.content` 与 `response.completed`。前几项证明文字是什么，最后一项证明本次模型响应如何结束。只存最终完成事件会丢正文；只存屏幕上显示的正文，又会丢响应身份、调用归属和用量。

第 20 章还会看到更细的边界：模型已经完整生成了一个等待工具调用，`response.completed` 也已到达，但工具随后被用户中断。响应结束、工具结束、整个用户轮次结束是三个不同层级。

## 时间戳能说明多快吗？

CPA 时间戳可以帮助观察事件抵达代理的顺序和间隔。它不等于模型内部生成时间，也不等于用户屏幕真正绘制文字的时刻；网络缓冲、代理和界面更新都可能影响观感。

本阶段输出用量为 151 token，不能用 146 个增量事件替代。第七章整轮的 1,056 输出 token 是五次正式响应求和，排除预热；不要把不同统计范围放在一起比较。

## 自己核对一次拼接

在事件文件中找到最后一个 `response.output_text.delta` 和 `response.output_text.done`。说明怎样验证片段没有遗漏，以及为什么看到一个 `done` 仍需要继续检查响应结束事件。

<details>
<summary>参考解释</summary>

按同一 `item_id`、`output_index` 和 `content_index` 收集有序 `delta`，拼接后对照 `output_text.done.text`，再核对 `output_item.done`。最后检查 `response.completed` 或相应失败、未完成事件；局部内容完成不能替代整个响应的最终状态。

</details>

[上一章：任务什么时候应该停止？](17-goal.md) · [下一章：工具失败后，怎样继续工作？](19-recovery.md)
