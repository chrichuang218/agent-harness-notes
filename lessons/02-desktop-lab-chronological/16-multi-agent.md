# 两个子智能体，怎样分工与汇总？

同一个折扣功能，可以分别检查实现边界和测试覆盖。本章让两个只读子智能体独立调查，父任务等待并汇总；再用任务 ID、时间和文件状态判断它们实际怎样协作。

## 给出两个可以分开的检查任务

使用[第 14 章折扣项目](../../examples/14-discount/README.md)，在 Desktop 输入：

```text
创建两个只读子智能体并等待两者完成：A 检查 src/price.ts 的折扣参数与边界行为；B 检查 tests/price.test.ts 的覆盖范围。都不要修改文件，也不要运行长任务。最后分别标明各自发现并汇总。
```

父任务发起两次 `spawn_agent`，路径分别为 `/root/a_price_boundaries` 和 `/root/b_test_coverage`。第一次调用参数的字段节选如下，省略加密的委派消息：

```json
{
  "task_name": "a_price_boundaries",
  "fork_turns": "all"
}
```

它来自[父任务第一阶段输出](../../evidence/desktop-lab/16-multi-agent/00-request.output-items.json)中的 `function_call.arguments`，先解析该 JSON 字符串即可核对。公开证据对密文做了脱敏，没有把密文解释成可读的任务正文。

## 父任务先委派，返回的还不是检查结论

两次 `spawn_agent` 并不是同一个模型响应里同时发出的。父任务实际用了五次请求：

| 阶段 | 本次新获得什么 | 输出动作 |
| --- | --- | --- |
| [00](../../evidence/desktop-lab/16-multi-agent/00-request.output-items.json) | 当前权限/环境更新和用户分工要求 | `spawn_agent` 创建 A |
| [01](../../evidence/desktop-lab/16-multi-agent/01-request.output-items.json) | A 的任务路径 | `spawn_agent` 创建 B |
| [02](../../evidence/desktop-lab/16-multi-agent/02-request.output-items.json) | B 的任务路径 | 读取项目决定和 README |
| [03](../../evidence/desktop-lab/16-multi-agent/03-request.output-items.json) | 项目文档正文 | `wait_agent` 等待结果 |
| [04](../../evidence/desktop-lab/16-multi-agent/04-request.output-items.json) | 等待结果、子任务消息和重组后的历史 | 分别汇总 A、B 的发现 |

阶段 01 请求的工具返回原文是 `{"task_name":"/root/a_price_boundaries"}`，通过 `call_LleINkkheKDASZQRQPmQ4KgN` 对应第一次委派。它证明任务已建立并给出地址，不代表 A 已经完成审阅。B 的创建返回同理。A 可以在父任务准备 B 时继续运行，所以委派动作先后发生与后续执行区间重叠并不矛盾。

## 它们确实是不同任务

[协作记录](../../evidence/desktop-lab/16-multi-agent/collaboration.json)连接了父子任务 ID、原始 rollout 行号、开始与结束事件及最终汇总。A、B 各有独立的 `threadId`、当前 `turnId` 和模型响应链。

两个子任务的首个正式请求各包含 22 项输入，能看到先前的项目决定、折扣计划、实施结果和当前检查要求。这里使用了 `fork_turns: "all"`，实际表现是继承已有对话材料，随后在不同任务中继续生成；不是两个完全没有上下文的空白模型。

两份首个正式请求还携带各自的 `previous_response_id`，分别接到子任务自己的预热响应。可对照 [A 预热请求](../../evidence/desktop-lab/16-agent-a/00-prewarm.request.json)、[A 预热完成事件](../../evidence/desktop-lab/16-agent-a/00-prewarm.response.json)，以及 [B 预热请求](../../evidence/desktop-lab/16-agent-b/00-prewarm.request.json)、[B 预热完成事件](../../evidence/desktop-lab/16-agent-b/00-prewarm.response.json)：预热各有 2 项输入、`generate: false`、没有生成输出；首个正式请求是在该响应基础上提交 22 项新增内容。

因此 22 不是完整有效上下文的总项数。读取一份正式请求时，仍然必须查看它引用的响应。两次预热也不是两个子任务已经完成了检查，不能计入下面的正式推理与工具动作数量。

子任务 rollout 还复制了父任务之前的轮次记录。采集时只选择各子任务自己的当前轮次，不能把继承记录再次计作子任务刚完成的工作。

## 子任务内部也有各自的工具循环

独立 Agent 并不是把用户提示拆成两段文字后拼回应答。A 和 B 都有自己的“提出调用 → 取得结果 → 继续判断”过程：

| 子任务阶段 | 当前请求收到什么 | 本次模型输出 |
| --- | --- | --- |
| [A 00](../../evidence/desktop-lab/16-agent-a/00-request.output-items.json) | 22 项继承与委派上下文 | 读取并给 `src/price.ts` 加行号 |
| [A 01](../../evidence/desktop-lab/16-agent-a/01-request.output-items.json) | 函数源码 | 读取项目规则、package 和本机 Skill |
| [A 02](../../evidence/desktop-lab/16-agent-a/02-request.output-items.json) | 上述读取结果 | 运行短 Node 探针 |
| [A 03](../../evidence/desktop-lab/16-agent-a/03-request.output-items.json) | 探针输出与退出码 0 | 提交实现边界结论 |
| [B 00](../../evidence/desktop-lab/16-agent-b/00-request.output-items.json) | 22 项继承与委派上下文 | 读取规则、测试、源码和 package |
| [B 01](../../evidence/desktop-lab/16-agent-b/01-request.output-items.json) | 文件正文 | 读取本机 Skill |
| [B 02](../../evidence/desktop-lab/16-agent-b/02-request.output-items.json) | 技能正文 | 提交静态覆盖分析 |

它们的工具结果分别进入各自下一请求；父任务没有在这期间代替 A 执行探针，也没有凭创建成功返回就知道 B 的覆盖判断。两个子任务都读了本机 `ponytail` Skill，这是当前环境的影响，不是多 Agent 协议必需环节。

## 是否并行，要看真实时间

以下时间来自各子任务自身的开始与完成事件，转换为本次使用的北京时间：

| 子任务 | 开始 | 完成 |
| --- | --- | --- |
| A | 00:48:30.289 | 00:49:10.648 |
| B | 00:48:35.700 | 00:49:06.515 |

两个运行区间重叠 30.815 秒，支持本次存在并发工作的判断。它不证明任意一瞬间都有两个 CPU 指令同时执行，也不能仅凭这个重叠计算“快了多少”；那需要另做串行对照。

父任务在等待期间读取了项目决定和 README，并通过 `wait_agent` 等待子任务结果，最后分别列出 A、B 的发现。

## 结论怎样回到父模型？

[父任务第 04 请求](../../evidence/desktop-lab/16-multi-agent/04-request.request.json)值得完整展开：它有 75 项输入，没有 `previous_response_id`。它重新携带历史，并增加子任务消息；不能把这一阶段画成“只发送一个等待结果”的普通增量请求。当前证据能描述这种重组方式，没有证明内部为何在此时切换。

末尾几个位置各司其职：

| 位置 | 类型 | 内容 |
| --- | --- | --- |
| `input[70]` | `function_call` | 父任务此前提出的 `wait_agent` |
| `input[71]` | `function_call_output` | `{"message":"Wait completed.","timed_out":false}` |
| `input[72]` | `agent_message` | `Sender: /root/b_test_coverage` 与 B 的完整结论 |
| `input[74]` | `agent_message` | `Sender: /root/a_price_boundaries` 与 A 的完整结论 |

等待结果只说明等待结束。真正的审阅内容出现在另两项 `agent_message` 中，文本带有 `Message Type: FINAL_ANSWER`、发送方和 `Payload`。模型收到它们以后，才有材料生成父任务的最终汇总。这里可观察到的传递内容是显式结果消息，不能据此宣称父模型获得了另一个 Agent 的全部内部推理。

因此可以沿两条关联追踪：用 `call_id` 找委派与等待的工具返回；用子任务路径、`threadId` 和 `agent_message` 发送方追踪检查结果来源。创建成功、执行完成、结果已交到父模型，是三个不同节点。

## 两份检查，证据强度不同

**A 检查实现并运行短探针。** 它确认默认参数、0～100 整数校验和 `RangeError` 符合方案；运行结果验证了 10% 返回 27、100% 返回 0。探针还观察到浮点误差，以及未校验单价时 `(Infinity, 3, 100)` 返回 `NaN`。这些边界没有被当成已经获准修复的新需求。

**B 只做静态检查。** 它逐项核对测试源代码，统计 11 项测试，认为已批准方案的必需场景都有覆盖。它建议可补充 `(0.125, 1, 50) → 0.0625`，更明确防止未来意外加入两位小数舍入；本次没有运行测试，也没有添加用例。

可分别查看 [A 的最终输出](../../evidence/desktop-lab/16-agent-a/03-request.output-items.json)和 [B 的最终输出](../../evidence/desktop-lab/16-agent-b/02-request.output-items.json)。A 的运行结果和 B 的静态判断应该保留各自标签，不能在汇总中统一写成“两者均已运行验证”。

## 独立任务，不等于独立工作区

本地会话元数据表明，父任务与两个子任务使用同一个 demo 目录。独立响应链只证明它们有各自的执行上下文，无法据此证明文件系统隔离。

本例采用只读分工。[文件状态核对](../../evidence/desktop-lab/16-multi-agent/file-state.json)将实施后的快照与子任务完成后的 13 个项目文件逐项比较，哈希均相同。这支持“这 13 个文件未变”，不扩大为整个系统从未发生写入。

以后若把可写任务交给多个 Agent，就需要明确各自修改范围及汇总方式。共享目录中的两个任务可能读写同一文件，“有两个 Agent”本身不会解决冲突。

## 统计也要分开汇总

父任务有 5 次正式模型请求、4 次工具调用；A 有 4 次请求、3 次工具调用；B 有 3 次请求、2 次工具调用。三者合计 12 次请求，不能只报告父任务的 5 次就代表整个协作过程。

这些统计只覆盖各自实际轮次，排除预热与复制的历史。工具调用包括父任务的委派、等待等操作，不只是 Shell 命令；请求更多也不自动意味着结果更可靠。

## 练习：判断一个并行结论

如果只看到两个 `spawn_agent` 调用，能否证明它们并行完成且没有改文件？请分别指出还需补查的时间证据和文件证据。

<details>
<summary>参考解释</summary>

需要检查两个实际子任务的起止时间，而不是复制到它们日志中的父历史时间；还需要前后文件状态对照。仅有委派调用只能证明发出了委派要求，不能证明并行、完成或未修改文件。本章分别用重叠区间、完成事件与 13 个文件哈希补齐这些判断。

</details>

[上一章：规则、模式和权限有什么不同？](15-permissions.md) · [下一章：任务什么时候应该停止？](17-goal.md)
