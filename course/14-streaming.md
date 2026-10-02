# 流式输出：一段“已修复”怎样逐渐出现？

第三章修复总价错误后，Desktop 显示了一段以“已修复”开头的说明。在 CPA 记录中，这段回答并非一次性返回：最后一次响应有 154 个 `response.*` 事件，其中 146 个逐段追加文本。

本章只拆这份已经保存的响应，不重新运行修复。完整序列在[修复阶段 04 事件](../evidence/desktop-lab/07-fix/04-request.events.json)。

## 片段怎样组成同一条消息？

最开始几个 `delta` 的内容依次为：

```text
“已” → “修” → “复” → “：[” → “src” → “/” → “price” → “.ts”
```

这行按真实字段整理，表示消息开头的分片顺序。它们合起来成为“已修复：[src/price.ts…”，没有在每个片段到达时重新运行测试或发起新的模型请求。

第一条文本增量包含以下字段，省略日志时间戳等外层信息：

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

`delta` 是本次新增文字，`item_id` 标明所属输出项，索引定位输出项和内容块，`sequence_number` 给出事件顺序。读流时先确认片段属于同一个对象，再按顺序拼接，才能避免把不同消息混在一起。

本例只有一个文本输出项。146 个文本增量拼接后，与 `response.output_text.done.text` 一致，也与 `response.output_item.done.item.content[0].text` 一致。这提供了核对正文是否漏片的办法。

## 不同的 done，结束了什么？

同一份记录里，局部文字完成之后，还有内容块、输出项和整个响应的结束事件：

| 事件 | 本样本中的作用 |
| --- | --- |
| `response.created` / `response.in_progress` | 建立响应并开始生成 |
| `response.output_item.added` / `response.content_part.added` | 建立输出项及其内容块 |
| `response.output_text.delta` | 追加文本片段 |
| `response.output_text.done` | 返回这个文本块的完整文字 |
| `response.content_part.done` / `response.output_item.done` | 完成内容块和输出项 |
| `response.completed` | 完成本次响应，带回用量等信息 |

因此看到一次 `done`，先看它结束的是哪个对象。某个文本块完成后，一次响应仍可能还有其他输出项；最后的 `response.completed` 才描述整个响应的完成。

上一章还看到另一层边界：响应完整生成了工具调用，工具却在之后被用户中断。响应结束不会替后续工具宣布成功。

## 流里也可能是工具参数

修复阶段 04 生成面向用户的说明，它之前的[阶段 03 事件](../evidence/desktop-lab/07-fix/03-request.events.json)则有 187 个 `response.custom_tool_call_input.delta`。这些片段组成 `exec` 的 JavaScript 输入，要求运行验证命令并重读文件。

运行环境收到完整调用后执行工具，再把实际结果交给模型，才产生最后的说明。两个阶段的流分别承载工具输入和回答文本：

| 阶段 | 主要增量类型 | 组装成什么 | 随后的动作 |
| --- | --- | --- | --- |
| 03 | `response.custom_tool_call_input.delta` | 工具调用的完整输入 | 执行验证并回传结果 |
| 04 | `response.output_text.delta` | assistant 消息 | 显示最终回答 |

工具定义仍是可调用接口的说明；这里看到的是模型为本次操作生成的具体输入。执行结果还要等工具运行后返回，它不会因为参数已经生成完成而提前存在。

## 为什么完成事件里的 output 是空的？

打开本样本的[完成事件](../evidence/desktop-lab/07-fix/04-request.response.json)，会看到 `response.output` 是空数组。回答文本已经在前面的流式事件里返回，空数组不能推翻那些事件中的正文。

教程因此同时保留完整事件序列和[输出项汇集](../evidence/desktop-lab/07-fix/04-request.output-items.json)。后者从 `response.output_item.done` 提取，是衍生文件；原完成事件没有被改写或补入正文。

如果只保存最终完成事件，这个样本就会丢失回答内容。如果只保存屏幕文字，又无法核对响应身份、流式顺序和用量。回看一次生成，需要把相关记录对应起来。

<details>
<summary>深入核对：生成之前的输入、事件序号与用量</summary>

[阶段 03 输出](../evidence/desktop-lab/07-fix/03-request.output-items.json)提出验证调用，编号为 `call_6YUxjdksnb3eIeh5ySJjO2p8`。[阶段 04 请求](../evidence/desktop-lab/07-fix/04-request.request.json)通过同一编号带回 typecheck、test、start 和文件重读的结果，并用 `previous_response_id` 引用前一响应：

```text
resp_0061bd7340416e34016abbe37f911087d0833167280989557b
```

随后产生的最终响应 ID 为：

```text
resp_0061bd7340416e34016abbe3868fc487d088322102a9cdf40e
```

其事件序号从 0 开始：0/1 建立响应，2/3 建立输出项和内容块，4 至 149 追加文本，150 返回完整文本，151/152 结束块与输出项，153 结束响应。`sequence_number` 管事件顺序，`call_id` 管调用与结果的配对，不能互换。

完整文本为 307 个 JavaScript 字符串长度单位；本阶段输出用量为 151 token。字符串长度、146 个文本增量和 token 数分别测量不同对象。整轮五次正式响应共有 1,056 输出 token，不能与最后一个阶段混为一谈。

CPA 时间戳表示事件抵达代理的时间，能用来观察接收顺序与间隔。它不等于模型内部生成时间，也不是界面绘制时间，不能直接据此测出用户屏幕的逐字显示延迟。

本章未实现双后端协议适配，也没有网络重试实验；观察对象是已经采集的这一套响应事件。

</details>

## 自己核对一次拼接

找到最后一条 `response.output_text.delta` 和对应的 `response.output_text.done`。说明应按哪些字段收集片段，并指出正文核对完成后，还需要查看哪个事件来判断整次响应的结束状态。

<details>
<summary>参考解释</summary>

按同一 `item_id`、`output_index` 和 `content_index` 分组，依序拼接 `delta`，与 `output_text.done.text` 及 `output_item.done` 中的正文比较。随后核对整个响应的完成、失败或未完成事件。本样本最后是 `response.completed`，正文则从先前事件取得。

</details>

[上一章：目标、停止条件与续跑](13-autonomy.md) · [下一章：完整复盘：架构与验证](15-architecture.md)
