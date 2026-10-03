# UserPromptSubmit 编号实验

2026-10-03，Computer Use 在 Codex Desktop 输入框提交了下面的问题：

> 本轮实验编号是什么？只根据已有上下文回答，不要读取文件或调用工具；没有就说“不知道”。

模型回答 `HOOK-5467aee6-40de-4432-8f83-93ed1bc73794`。本轮只有一次模型请求，没有模型工具调用。编号由本地 `UserPromptSubmit` Hook 生成，经 `additionalContext` 加入请求；模型读取这段上下文后回答。

## 沿编号核对

| 位置 | 记录 |
| --- | --- |
| [本地 Hook 事件](hook-events.json) | `event=UserPromptSubmit`，`session_id` 与任务一致，`turn_id` 与本轮一致，`marker` 为上述编号 |
| [客户端请求](00-request.request.json) | `input[2].content[0].text` 是问题，`input[3].role` 为 `developer`，`input[3].content[0].text` 包含编号与 Hook 说明 |
| [上游请求](00-request.upstream.json) | 与客户端请求逐值相同，编号仍在同一字段 |
| [输出项](00-request.output-items.json) | `items[0].content[0].text` 与本地编号一致，未出现工具调用 |
| [完成事件](00-request.response.json) | `response.id=resp_092b822b0796fc55016ac05e40c1c487d0921006f007cadada`，`status=completed` |
| 请求的 `client_metadata` | `x-codex-turn-metadata` 是 JSON 字符串，解码后的 `turn_trigger=composer`，`client_type=desktop_app` |

`previous_response_id` 指向同一任务的[上一轮](../hook-c-tool-origin/manifest.json)。上一轮由 `create_thread` 工具提交，回答“不知道”。因此这两轮的提交方式与对话历史都不同。

## 三组工具提交记录的范围

[A](../hook-a-baseline/manifest.json)、[B](../hook-b-untrusted/manifest.json) 和 [C 的首轮](../hook-c-tool-origin/manifest.json) 都由 `create_thread` 提交。它们的请求把问题放在 `input[7].output` 的 `<codex_delegation><input>` 中，`turn_trigger=app_tool_create_thread`。三个请求都没有编号，回答均为“不知道”。

A、B 的名称沿用采集时的配置状态。它们不能证明普通输入框提交在未配置、未信任和已信任之间的行为差异，因为这些轮次都走了工具提交路径。成功的输入框轮次证明了该次受信任 Hook 的编号注入；本实验没有测完所有信任状态与提交方式的组合。

前三组 `manifest.prompt` 为空，是当时采集器只提取普通 `user` 消息所致。问题原文仍在请求的工具输出中，也在各组新增的 `submission.submittedPrompt` 中注明，未回填或改写原始请求。

## 来源复核

[audit.json](audit.json) 记录了现存 CPA 合并日志的文件名和行号。四组的客户端与上游请求、完成事件，经过相同脱敏后，均与最初导出逐值一致；各组 `output-items.json` 也与流式事件的 `response.output_item.done.item` 一致。

最初 `manifest` 引用的临时分片已合并。原始 rollout 在审计时未找到，不能声称本次重新读取过它。审计使用现存 CPA 原始日志、已保存副本和本地 Hook 事件完成核对。

[Hook 定义快照](hook-definition-snapshot.json) 保存交接时检查到的项目 Hook 列表和编号脚本。列表中的 `PreToolUse`、`PostToolUse` 是后续准备，不能据此推断它们在编号实验当时已经配置。该快照的项目 Hooks 均为 `enabled=true`、`trustStatus=trusted`，`warnings` 与 `errors` 为空。
