# 流式输出：一段“已修复”怎样逐渐出现？

第三章的“已修复”说明随文本片段逐渐返回。最后一次响应记录了 154 个 `response.*` 事件，其中 146 个追加文本，随后文本块、输出项和整个响应依次结束。

在[修复阶段 04 事件](../evidence/desktop-lab/07-fix/04-request.events.json)中，可以按顺序查看第一条增量到响应完成的全部记录。

<details>
<summary>查看这段回答在 Desktop 中的样子</summary>

![总价修复完成后，Desktop 显示已修复和三项验证结果](../docs/images/desktop-lab/fix-result.png)

截图显示了[修复实验](../evidence/desktop-lab/07-fix/manifest.json)的最终回答；分片顺序和完成事件需要查看 CPA 日志，静态画面无法还原。

</details>

## 片段怎样组成同一条消息？

最开始几个 `delta` 的内容依次为：

```text
“已” → “修” → “复” → “：[” → “src” → “/” → “price” → “.ts”
```

这些片段拼成“已修复：[src/price.ts…”，都属于同一次模型响应，其间没有逐片重新请求模型或运行测试。

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

`delta` 是本次新增文字，`item_id` 标明所属输出项，索引定位输出项和内容块，`sequence_number` 给出事件顺序。读流时按所属对象收集片段，再按顺序拼接，避免把不同消息混在一起。

本例只有一个文本输出项。146 个文本增量拼接后，与 `response.output_text.done.text` 及 `response.output_item.done.item.content[0].text` 都一致，可以据此核对正文是否漏片。

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

某个文本块完成后，响应仍可能有其他输出项；`response.completed` 则表示整次响应完成。

上一章的模型响应完整生成了工具调用，工具却在随后被用户中断。响应结束只能说明生成结束，工具是否成功还要另查执行结果。

## 流里也可能是工具参数

修复阶段 04 生成面向用户的说明，它之前的[阶段 03 事件](../evidence/desktop-lab/07-fix/03-request.events.json)则有 187 个 `response.custom_tool_call_input.delta`。这些片段组成 `exec` 的 JavaScript 输入，要求运行验证命令并重读文件。

运行环境收到完整调用后执行工具，把结果交给模型，模型才生成最后的说明。两个阶段的流分别包含工具输入和回答文本：

| 阶段 | 主要增量类型 | 组装成什么 | 随后的动作 |
| --- | --- | --- | --- |
| 03 | `response.custom_tool_call_input.delta` | 工具调用的完整输入 | 执行验证并回传结果 |
| 04 | `response.output_text.delta` | assistant 消息 | 显示最终回答 |

工具输入生成完成后，还要等待执行；执行结果随下一请求返回。

## 为什么完成事件里的 output 是空的？

本样本的[完成事件](../evidence/desktop-lab/07-fix/04-request.response.json)中，`response.output` 是空数组。回答文本已经由前面的流式事件返回，空数组不表示模型没有生成正文。

[输出项汇集](../evidence/desktop-lab/07-fix/04-request.output-items.json)从 `response.output_item.done` 取得完整输出项，与完成事件中仍为空的 `output` 分开保存。

前面章节也使用了这种记录方式：[第一章问候的完成事件](../evidence/desktop-lab/01-hello/01-request.response.json)中 `output` 为空，问候保存在[流式事件](../evidence/desktop-lab/01-hello/01-request.events.json)里；第二章读取 README 的两份完成事件和第三章修复的五份完成事件也都为空。各阶段的工作台“模型输出”取自对应的流式输出项，原始记录仍分别保存在[读取实验](../evidence/desktop-lab/03-readme/manifest.json)和[修复实验](../evidence/desktop-lab/07-fix/manifest.json)中。这些是本教程样本的观察，其他记录应检查各自的实际字段。

只保存完成事件会丢失本样本的回答内容；只保存屏幕文字，则缺少响应标识、事件顺序和用量。

<details>
<summary>深入核对：事件序号与计量单位</summary>

这份最终响应的事件序号从 0 开始：0/1 建立响应，2/3 建立输出项和内容块，4 至 149 追加文本，150 返回完整文本，151/152 结束块与输出项，153 结束响应。`sequence_number` 管事件顺序，`call_id` 管调用与结果的配对，不能互换。

完整文本为 307 个 JavaScript 字符串长度单位；本阶段输出用量为 151 token。字符串长度、146 个文本增量和 token 数分别测量不同对象；跨请求统计用量的方法见[上下文管理](05-context.md#重发引用缓存各自改变什么)。

CPA 时间戳记录事件抵达代理的时刻，可用于观察接收顺序与间隔。模型内部生成和界面绘制发生在另外的环节，因此不能用这些时间戳直接测出屏幕上的逐字显示延迟。

</details>

## 自己核对一次拼接

找到最后一条 `response.output_text.delta` 和对应的 `response.output_text.done`。说明应按哪些字段收集片段，并指出正文核对完成后，还需要查看哪个事件来判断整次响应的结束状态。

<details>
<summary>参考解释</summary>

按同一 `item_id`、`output_index` 和 `content_index` 分组，依序拼接 `delta`，与 `output_text.done.text` 及 `output_item.done` 中的正文比较。随后核对整个响应的完成、失败或未完成事件。本样本最后是 `response.completed`，正文则从先前事件取得。

</details>

已经能从流式事件还原一次模型输出。最后一章把这些记录放回整个运行过程，判断每个组件负责什么、应该向哪里找证据。

[上一章：目标、停止条件与续跑](13-autonomy.md) · [下一章：完整复盘：架构与验证](15-architecture.md)
