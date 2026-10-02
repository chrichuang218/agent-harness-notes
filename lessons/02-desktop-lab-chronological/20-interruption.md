# 点击停止后，怎样安全继续？

中断后的第一步，是区分已经完成、执行中被打断、尚未开始的动作。本章先留下一个正常完成的对照，再在实际等待中点击停止，最后只执行尚未完成的检查。

## 先保留一次没有中断的对照

第一次实验要求：先运行类型检查，等待 30 秒，再运行测试。它在停止操作之前已正常结束，类型检查和测试都通过。这份[对照记录](../../evidence/desktop-lab/20-uninterrupted-control/manifest.json)不能被写成“中断成功”。它的四次请求形成正常链路：

| 阶段 | 新收到的输入 | 随后的模型输出 |
| --- | --- | --- |
| [对照 00](../../evidence/desktop-lab/20-uninterrupted-control/00-request.output-items.json) | 顺序检查的用户要求 | `exec` 运行 typecheck |
| [对照 01](../../evidence/desktop-lab/20-uninterrupted-control/01-request.output-items.json) | 类型检查退出码 0 | `clock.sleep`，`duration_ms: 30000` |
| [对照 02](../../evidence/desktop-lab/20-uninterrupted-control/02-request.output-items.json) | `Sleep completed`，实际约 30.0257 秒 | `exec` 运行 test |
| [对照 03](../../evidence/desktop-lab/20-uninterrupted-control/03-request.output-items.json) | 11 项测试通过 | 汇报正常完成 |

等待也是工具调用，需要返回结果才能进入下一步模型生成。这个对照让我们知道：未中断时，等待成功结果会触发后面的测试调用。

于是延长观察窗口，在同一任务再次发送：

```text
再做一次中断实验，把观察窗口延长：先单独运行 npm run typecheck 并报告退出码；随后单独等待 120 秒，等待完整结束后才运行 npm test。不要修改文件。我会在等待时点击停止；被停止后不要自行重试。
```

这次确实在等待期间点击了 Desktop 的停止按钮。

## 停止时，三个动作分别是什么状态？

| 动作 | 中断时的证据 | 状态 |
| --- | --- | --- |
| 类型检查 | 工具返回退出码 0 | 已完成 |
| 等待 120 秒 | 第一段等待返回中断结果 | 未完成 |
| `npm test` | 该轮没有对应调用 | 尚未执行 |

模型说明计划分两段各 60 秒等待，但本轮只发起了第一段。实际调用的是 `clock.sleep`，不是一个 Shell 等待进程。[第二阶段输出](../../evidence/desktop-lab/20-interrupted/01-request.output-items.json)中的字段节选如下，省略了输出项 ID 等字段：

```json
{
  "type": "function_call",
  "name": "sleep",
  "namespace": "clock",
  "arguments": "{\"duration_ms\":60000}",
  "call_id": "call_MgxCc9ZeSdtTTeTO6HqupFTC"
}
```

本地 [interruption.json](../../evidence/desktop-lab/20-interrupted/interruption.json)保存对应工具结果：`aborted by user after 15.3s`。随后 rollout 记录 `turn_aborted`，原因是 `interrupted`；任务状态查询也确认中断。

这比只引用助手自述更具体：15.3 秒来自等待工具的实际返回。整轮记录的持续时间约 27.714 秒，还包括模型处理和此前类型检查，不能与等待时长混用。本章不使用界面停止提示中的计时作为这两个数值的测量依据。

## 中断把哪一段闭环截住了？

真正中断实验的[第 00 请求](../../evidence/desktop-lab/20-interrupted/00-request.request.json)只有新用户消息，并引用之前正常结束的响应；模型仍先运行类型检查。其结果在[第 01 请求](../../evidence/desktop-lab/20-interrupted/01-request.request.json)中通过 `call_6VrFE3R2Sx87HEfZFkHQ77bZ` 回来，退出码是 0。模型这才生成 60 秒等待调用。

到这里和正常对照结构相同。区别发生在等待执行中：它没有返回 `Sleep completed`，而是被取消。原轮次因此没有再产生一份“收到等待成功 → 运行测试”的模型请求。取消结果先留在本地记录里，在后续用户明确继续时才进入恢复请求。

```text
正常：类型检查结果 → 模型提出等待 → 等待完成 → 下一模型请求 → 提出测试
中断：类型检查结果 → 模型提出等待 → 用户停止 → 本地记录取消，原轮次结束
恢复：取消结果 + 中断说明 + 新的继续要求 → 模型只提出剩余测试
```

这是按本次记录画出的执行路径，不是用一条最终回答推演的流程。

## 模型响应完成，不等于用户任务完成

中断前已有两次模型响应各自发出 `response.completed`：第一次提出类型检查调用，第二次提出等待调用。它们结束的是对应模型生成过程，不是后续工具和整个用户任务。

本次真正中断的轮次没有 `task_complete`，也没有最终回答。公开实验索引保留 `status: "interrupted"`，回复为空；没有为了填满页面而合成一条“已完成”消息。

等待被停止后，后面的测试没有自动补跑。接下来由新的用户输入明确决定继续什么。

## 继续时先核对，不从头重来

随后在同一任务发送：

```text
继续刚才中断的检查。先根据已返回的工具结果核对哪些动作确已完成，不要把中断当作成功；不要重跑已通过的类型检查，也不要重启等待。只运行尚未执行的 npm test，并报告退出码和测试结果。不要修改文件。
```

[恢复后的首请求](../../evidence/desktop-lab/20-resume/00-request.request.json)直接包含以下工具结果。此处省略 `id` 字段，保留类型、关联编号和输出：

```json
{
  "type": "function_call_output",
  "call_id": "call_MgxCc9ZeSdtTTeTO6HqupFTC",
  "output": "aborted by user after 15.3s"
}
```

相同 `call_id` 将它连接到此前的 `clock.sleep`。恢复首请求不是只有一条“继续”，而是 3 项新增输入：

| 位置 | 类型 | 信息来源 |
| --- | --- | --- |
| `input[0]` | `function_call_output` | 未完成的等待调用返回取消信息 |
| `input[1]` | developer 消息 | 运行环境注入的中断说明 |
| `input[2]` | user 消息 | 只运行尚未执行测试的新要求 |

它的 `previous_response_id` 仍指向发出等待调用的那次响应。引用保留了此前类型检查成功的历史，取消结果说明等待的实际结局，新用户输入指定接下来允许做什么。三个部分一起决定恢复动作，不能只靠“记得原计划”直接重跑。

在[恢复阶段 00 输出](../../evidence/desktop-lab/20-resume/00-request.output-items.json)中，模型确实只提出 `npm test`，调用编号是 `call_PuqMbofyzZ4XDvPgK9HcuHGn`。它的执行结果进入[恢复阶段 01 请求](../../evidence/desktop-lab/20-resume/01-request.request.json)，再通过响应引用接续这一轮。

结果为退出码 0、11 项通过、0 失败。没有重跑类型检查，也没有重启等待。[最后输出](../../evidence/desktop-lab/20-resume/01-request.output-items.json)分别说明已完成检查、被打断的等待和新完成的测试。恢复完成是新的两次模型请求形成的闭环，不是把原轮次的 `turn_aborted` 改成成功。

## 不同工具，需要不同的恢复核对

本例被停止的是等待工具；它不能证明停止按钮总会终止所有后台进程。若中断发生在启动服务、长时间命令或写文件过程中，应该先检查实际进程、工具句柄与文件状态，避免把不确定的动作直接当成“完全没执行”。

同样，本例恢复由新的用户消息触发，不是验证了所有后台自动续跑机制。恢复后的正确做法依赖实际状态与本轮要求，而不是一律重复全部步骤。

真正中断的实验有 2 次正式模型请求、2 次工具调用；恢复实验有 2 次请求、1 次工具调用。前一次正常完成对照另有 4 次请求，不计作成功中断。统计排除预热，也不把等待秒数当成模型 token 或费用。

## 最后一次独立核对

不看助手最终回复，只用三份证据指出：类型检查何时成功、等待怎样结束、测试在哪一轮执行。然后解释：如果一个修改文件的工具中途被停止，为什么不能照搬本章“直接运行剩余测试”的结论？

<details>
<summary>参考解释</summary>

中断实验第二请求带回类型检查退出码 0；本地中断事件和恢复请求带回同一 `call_id` 的等待取消结果；恢复实验第二请求带回测试成功。文件修改中断可能留下部分结果，需要先核对文件状态和工具实际完成情况，再决定补做什么，不能只按原计划列表继续。

</details>

[上一章：工具失败后，怎样继续工作？](19-recovery.md) · [回到课程首页](../../README.md) · [重新从“你好”开始](01-hello.md)
