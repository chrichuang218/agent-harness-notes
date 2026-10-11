# 任务与会话：下一句话怎样接上之前的工作？

修复总价时，一条用户要求产生了五次模型请求。修复结束后再发一句话，又会开始一个用户轮次。它仍然属于原来的 Desktop 任务，可以接着使用之前的对话。

项目给出工作目录，例如 `codex-ts-demo`。任务是 Desktop 里的一段对话，其中每次新要求开始一个用户轮次，可以包含多次模型请求和工具执行。切换任务以后，原来的对话是否还会进入请求，需要单独检查。

## “我刚才说了什么？”的答案在哪里

第一章发送“你好”后，同一个任务继续收到追问：

```text
我刚才说了什么？
```

实际回答是：

> 你刚才说的是：“你好”。

打开[这次请求](../evidence/desktop-lab/02-context/00-request.request.json)，在 `input` 中搜索“你好”，可以找到前一轮的用户输入和助手问候，当前问题在它们之后。答案已经在上下文中，本轮也没有工具调用。

前一轮的两条消息节选如下，省略了 `id`、`phase` 等字段，保留原有嵌套结构：

```json
[
  {
    "type": "message",
    "role": "user",
    "content": [{ "type": "input_text", "text": "你好\n" }]
  },
  {
    "type": "message",
    "role": "assistant",
    "content": [{ "type": "output_text", "text": "你好！今天想一起做点什么？" }]
  }
]
```

这次请求重发了历史，没有 `previous_response_id`；第二章读取 README 后的请求使用响应引用，只新增工具结果。因此，查历史时需要同时检查 `input` 和响应引用。

<details>
<summary>深入核对：两轮问候的输入位置与标识</summary>

第一轮正式请求有 7 项输入，第二轮有 10 项。前 7 项逐项深比较相同，新增部分是上次回答、环境更新和当前问题：

| 第二轮位置 | 内容 |
| --- | --- |
| `input[6]` | 第一轮用户输入“你好” |
| `input[7]` | 第一轮助手回复 |
| `input[8]` | 环境更新，其中日期变为 `2026-09-30` |
| `input[9]` | “我刚才说了什么？” |

环境更新也使用 `user` 角色，不表示用户在输入框中填写过日期。第二轮[上游请求](../evidence/desktop-lab/02-context/00-request.upstream.json)与客户端正文按值相同，CPA 没有把这段重发历史改成另一种输入形式。

第一轮完整响应的 ID 是 `resp_0e37249022131978016abbdd7cb40c87d09c1a684b05dbefc1`，其中问候消息的 ID 是 `msg_0e37249022131978016abbdd7e07e487d0a741daf042c801e0`。第二轮 `input[7].id` 保留了后者。响应可以包含多条输出项，响应 ID 与其中一条消息的 ID 因而不能互换。这里没有工具调用，也没有用于配对结果的 `call_id`。

两轮各有 1 次正式请求；第一轮另有预热，不能把它算成第三次用户输入。

索引里的 `previousResponseId: null` 表示没有响应引用。原始请求中没有 `previous_response_id` 字段，不是字段值为 `null`。

</details>

## 给原任务一个临时代号

修复完成后，原任务收到一条设置临时代号的消息：

```text
本次会话临时代号是 PRICE-A7。只在本会话中使用，不写入文件，也不要保存为长期记忆。回复收到即可。
```

模型回复“收到。”，没有调用工具。代号与计算逻辑无关，无法从项目源码或乘法常识推算；不写文件的要求也减少了其他任务从磁盘找到它的可能。

随后在同一 TS 项目下新建任务，输入：

```text
不读文件、不搜索其他任务。如果当前上下文里有本项目的实验临时代号，请给出；如果没有，请回答不知道，不要猜。
```

新任务回答“不知道。”。回到原任务，发送完全相同的问题，得到 `PRICE-A7`。

![同一项目的新任务回答不知道实验临时代号](../docs/images/desktop-lab/new-chat-no-code.png)

[新任务实验](../evidence/desktop-lab/08-session-new/manifest.json)与原任务的两次请求，可以用来检查这个回答差异的来源：

| 操作 | 当前请求怎样带上下文 | 实际回答 |
| --- | --- | --- |
| [原任务设置代号](../evidence/desktop-lab/08-session-seed/00-request.request.json) | 新增设置消息，引用先前响应 | 收到。 |
| [新任务追问](../evidence/desktop-lab/08-session-new/00-request.request.json) | 重新组装初始上下文，无响应引用 | 不知道。 |
| [回原任务追问](../evidence/desktop-lab/08-session-resume/00-request.request.json) | 新增问题，引用设置代号时的响应 | PRICE-A7 |

在新任务请求中搜索 `PRICE-A7`，找不到它。原任务追问的当前 `input` 也没有重写代号，但它的响应引用接到了设置代号的历史。只搜索当前这一份 JSON，会漏掉这条来源。

## 沿引用找到代号

先打开[设置代号的完成事件](../evidence/desktop-lab/08-session-seed/00-request.response.json)，复制其中的 `response.id`；再与原任务追问中的 `previous_response_id` 对照，两者相同。

原任务通过这条引用接回设置代号的历史，最终[输出项](../evidence/desktop-lab/08-session-resume/00-request.output-items.json)是 `PRICE-A7`。本轮没有读取文件或检索其他任务的调用。

新任务有相同的项目路径、规则和可用工具，但请求中没有设置代号的消息，也没有指向它的响应引用。工作目录相同，并不自动带入原任务的临时对话。

<details>
<summary>深入核对：任务 ID、响应 ID 与三份请求</summary>

设置和追问请求的 `client_metadata.thread_id` 相同，新任务的值不同。`thread_id` 标记任务归属，`response.id` 标记一次模型响应，`previous_response_id` 指向需要接续的响应。任务 ID 本身不包含历史正文。

设置代号响应的 ID 是：

```text
resp_0061bd7340416e34016abbe3f61b1887d085792e6d9fb02f1d
```

原任务追问的字段节选如下，省略消息 `id` 和其他请求字段：

```json
{
  "previous_response_id": "resp_0061bd7340416e34016abbe3f61b1887d085792e6d9fb02f1d",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [{
        "type": "input_text",
        "text": "不读文件、不搜索其他任务。如果当前上下文里有本项目的实验临时代号，请给出；如果没有，请回答不知道，不要猜。\n"
      }]
    }
  ]
}
```

新任务首请求有 7 项输入：`input[0]` 是工具定义，`input[1]` 至 `input[4]` 是 developer 消息，`input[5]` 附加规则与环境，`input[6]` 是追问。其[输出项](../evidence/desktop-lab/08-session-new/00-request.output-items.json)回答“不知道”。

设置代号、在新任务追问、回原任务追问，各有 1 次正式请求，均无工具调用。判断答案来源应核对输入与响应引用，而不是仅比较请求大小。

</details>

## 这个对照证明了什么

本次对照确认，原任务能够沿响应引用继续使用代号，新任务没有自动取得这段旧对话。实验没有退出 Desktop 或模拟进程崩溃，尚未验证重启与异常恢复的行为。

如果把代号写入 `AGENTS.md`，或让新任务读取记录文件，信息就有了新的进入路径。第八章会观察后一种做法；本次对照没有通过这些文件入口传递代号。

请分别定位“你好”追问和代号追问的答案来源，再解释：为什么前者可以在当前 `input` 中直接找到答案，而后者需要沿响应引用往前查？

<details>
<summary>核对思路</summary>

“你好”实验重发了历史，旧用户消息和助手回答直接出现在第二轮 `input` 中。代号追问只新增问题，设置代号的消息位于 `previous_response_id` 接续的历史。新任务既没带入代号，也没引用那段历史。仅看最终回答无法区分这些来源，还需要检查请求和引用。

</details>

同一任务能继续使用历史。下一章观察历史变长后，压缩怎样改变后续请求可用的材料。

[上一章：Agent Loop](03-agent-loop.md) · [下一章：上下文管理](05-context.md)
