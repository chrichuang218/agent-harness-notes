# 目标、停止条件与续跑：下一步还需要做什么？

Agent Loop 能连续工作，但并非每次工具返回后都应再做一步。已有证据满足要求时可以结束；工具失败时要判断是否还有获准的路径；用户停止后，则要核对完成到哪里，再决定如何继续。

本章用同一个折扣项目的三组独立实验观察这些选择：原生 Goal 的完成、脚本失败后的恢复，以及中断后只执行剩余测试。它们并非同一个 Goal 连续运行的三个阶段。

## 先给目标一个可检查的终点

通过 Desktop `/` 菜单的 Goal 入口填写：

```text
检查当前总价实现是否满足 README 的折扣约定，运行 npm run typecheck 和 npm test，每项至多一次。两项通过且给出退出码与结论后完成目标；不修改文件，不创建子智能体，不扩展任务。若失败就报告具体失败。
```

目标给出了要核对的约定、必须取得的执行结果和范围。这次没有设置 token 预算。

[首请求](../evidence/desktop-lab/17-goal/00-request.request.json)中的 user 消息以 `<codex_internal_context source="goal">` 开头。里面既有 `<objective>` 中的要求，也有围绕目标继续工作和核查完成条件的说明。输入框里的短目标经过了应用包装，才进入模型。

Codex 读取 README、实现、测试和配置，核对折扣的默认值、整数范围、异常和精度行为。随后各运行一次类型检查和测试，两项退出码均为 0，11 项测试通过。结果到达后，模型调用：

```javascript
text(await tools.update_goal({status:"complete"}));
```

[工具真实返回](../evidence/desktop-lab/17-goal/goal-state.json)中的目标状态为 `complete`。完成状态位于验证之后，可以与此前的文件和命令结果相互核对。如果只留下状态变化，却没有目标要求的测试结果，仍然缺少业务验收证据。

<details>
<summary>深入核对：Goal 的五次请求与状态返回</summary>

| 阶段 | 模型新得到什么 | 输出动作 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/17-goal/00-request.output-items.json) | Goal 包装与前轮引用 | 读取 README、实现、测试和 package |
| [01](../evidence/desktop-lab/17-goal/01-request.output-items.json) | 文件内容 | 读取 `tsconfig.json` |
| [02](../evidence/desktop-lab/17-goal/02-request.output-items.json) | 类型检查配置 | 各运行一次 typecheck 与 test |
| [03](../evidence/desktop-lab/17-goal/03-request.output-items.json) | 两项实际结果 | 说明结论，调用 `update_goal` |
| [04](../evidence/desktop-lab/17-goal/04-request.output-items.json) | 状态更新结果 | 最终汇报 |

[阶段 03 请求](../evidence/desktop-lab/17-goal/03-request.request.json)保存两项命令结果；[阶段 04 请求](../evidence/desktop-lab/17-goal/04-request.request.json)保存目标工具返回。状态证据文件只是解析该历史返回，没有另行查询或修改任务状态。本次也没有 `get_goal` 调用。

整轮 5 次正式请求、4 次外层调用，后续各通过一个 `custom_tool_call_output` 与前一响应引用接续。目标工具返回的用量与耗时是独立统计，不与 CPA 的多次请求 token 求和混算。

本目标在一轮工作内完成。它没有触发后台多轮自动续跑、暂停恢复、预算耗尽或定时调度。目标要求的“每项至多一次”是工作范围约束，不是硬性的 token 或费用限制。

</details>

## 命令失败后，哪些继续动作仍然有意义？

另一轮实验故意要求先运行 `npm run lint`。项目没有该脚本，执行返回退出码 1：

```text
npm error Missing script: "lint"
```

错误进入[下一次请求](../evidence/desktop-lab/19-recovery/01-request.request.json)后，Codex 读取 `package.json` 和 `tsconfig.json`，找到了现有的 typecheck 与 test 脚本。用户已经允许在这种情况下改用现有检查，并明确不安装依赖、不新增脚本，因此模型接着运行这两项。

类型检查成功，11 项测试通过。最终报告仍保留最初的 lint 失败。后续检查解决了可以执行哪些验证的问题，没有让那个不存在的 lint 脚本变成成功。

这次恢复发生在模型收到错误后的新决策中：下一份输出明确提出读取配置，再下一份输出提出替代检查。它没有表现为 CPA 自动重发网络请求，也没有反复运行同一条必然缺少脚本的命令。

<details>
<summary>深入核对：失败怎样影响后续动作</summary>

原始要求为：

```text
先实际运行一次 npm run lint，作为错误反馈实验。如果提示脚本不存在，不要安装依赖或新增脚本；读取 package.json 找出现有的类型检查和测试命令，改用它们检查，并报告最初失败以及后续结果。不要修改文件。
```

| 阶段 | 新信息 | 下一动作 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/19-recovery/00-request.output-items.json) | 用户要求 | 运行 lint |
| [01](../evidence/desktop-lab/19-recovery/01-request.output-items.json) | 缺少脚本，退出码 1 | 读取配置 |
| [02](../evidence/desktop-lab/19-recovery/02-request.output-items.json) | 真实脚本定义 | 运行已有 typecheck 与 test |
| [03](../evidence/desktop-lab/19-recovery/03-request.output-items.json) | 两项退出码 0，11 项测试通过 | 分别报告失败与成功 |

首个调用编号为 `call_Mlqrto9sxxi6WgYe0n7tE2ty`，读取配置为 `call_OchDQ0cGzHrbt3ceSdbM1CI1`，替代检查为 `call_4tMi1tCpS1AQfLCUS713w1zY`。各结果通过同一编号进入下一请求，四份请求均新增一项输入并引用前一响应。

最后一次外层调用用 `Promise.allSettled` 安排两条命令。结果包含 `command` 标签，可以分别核对退出码。解析[最后请求](../evidence/desktop-lab/19-recovery/03-request.request.json)中的类型检查内容块，可见以下字段节选：

```json
{
  "command": "npm run typecheck",
  "status": "fulfilled",
  "value": {
    "exit_code": 0
  }
}
```

外层 `Script completed` 和 `fulfilled` 表示编排或异步调用返回，具体命令是否成功仍看退出码及输出。npm 错误附带的一般提示也只是返回内容，不会自动改变用户限定的工作范围。

本实验 4 次正式请求、3 次外层调用，输入 token 合计 272,711，输出合计 397，排除预热。没有模拟网络超时、服务端重试或响应丢失。

</details>

## 用户停止时，已经做完的工作会丢吗？

中断实验要求先运行类型检查，等待 120 秒，等待结束后再运行测试。Codex 完成类型检查后发起第一段 60 秒的 `clock.sleep`，操作方在等待时点击停止。工具返回：

```text
aborted by user after 15.3s
```

[本地中断记录](../evidence/desktop-lab/20-interrupted/interruption.json)随后出现 `turn_aborted`，原因为 `interrupted`。这轮没有继续调用 `npm test`，也没有最终回答。此时三个动作的状态可以明确区分：

| 动作 | 中断时的状态 | 依据 |
| --- | --- | --- |
| 类型检查 | 已完成 | 返回退出码 0 |
| 等待 | 被取消 | 等待工具返回中断信息 |
| 测试 | 尚未执行 | 该轮没有测试调用 |

用户随后明确要求继续，只运行尚未执行的测试。恢复请求带回等待取消结果、运行环境的中断说明和新的继续要求，并引用此前发出等待调用的响应。模型可以同时看到先前的类型检查成功，以及等待未完成的事实。

[恢复阶段输出](../evidence/desktop-lab/20-resume/00-request.output-items.json)只提出 `npm test`，没有重跑类型检查或重启等待。工具返回退出码 0、11 项通过，模型再报告结果。原来的中断记录仍保留，恢复是新一轮中的两次模型请求。

<details>
<summary>深入核对：中断前、取消结果与恢复输入</summary>

实际中断要求为：

```text
再做一次中断实验，把观察窗口延长：先单独运行 npm run typecheck 并报告退出码；随后单独等待 120 秒，等待完整结束后才运行 npm test。不要修改文件。我会在等待时点击停止；被停止后不要自行重试。
```

[阶段 00](../evidence/desktop-lab/20-interrupted/00-request.output-items.json)提出类型检查，调用编号为 `call_6VrFE3R2Sx87HEfZFkHQ77bZ`，结果进入[阶段 01 请求](../evidence/desktop-lab/20-interrupted/01-request.request.json)。下一响应计划分两段等待，但只实际发出了第一段；等待调用字段节选为：

```json
{
  "type": "function_call",
  "name": "sleep",
  "namespace": "clock",
  "arguments": "{\"duration_ms\":60000}",
  "call_id": "call_MgxCc9ZeSdtTTeTO6HqupFTC"
}
```

15.3 秒是工具返回的已等待时长；整个中断轮次约 27.714 秒，还包含类型检查和模型处理，不能混用。公开索引保留 `status: "interrupted"` 和空回复，没有补造最终回答。

继续要求为：

```text
继续刚才中断的检查。先根据已返回的工具结果核对哪些动作确已完成，不要把中断当作成功；不要重跑已通过的类型检查，也不要重启等待。只运行尚未执行的 npm test，并报告退出码和测试结果。不要修改文件。
```

[恢复首请求](../evidence/desktop-lab/20-resume/00-request.request.json)的三项输入分别是：

| 位置 | 内容 |
| --- | --- |
| `input[0]` | 等待的 `function_call_output`，`call_id` 与原调用相同，结果为取消 |
| `input[1]` | developer 中断说明 |
| `input[2]` | 用户继续要求 |

测试调用编号为 `call_PuqMbofyzZ4XDvPgK9HcuHGn`，结果在[恢复阶段 01 请求](../evidence/desktop-lab/20-resume/01-request.request.json)，最终说明见[对应输出](../evidence/desktop-lab/20-resume/01-request.output-items.json)。真正中断轮次有 2 次正式请求、2 次工具调用；恢复有 2 次请求、1 次调用。

此前还做过一次等待 30 秒的[正常完成对照](../evidence/desktop-lab/20-uninterrupted-control/manifest.json)。它有 4 次请求，等待实际完成约 30.0257 秒，随后执行测试。那次在停止操作前已结束，不能算作中断成功。

</details>

## 继续之前，依据实际状态

本例取消的是等待工具，返回清楚，也没有文件修改。若停止时正在写文件或运行后台进程，就需要先检查文件、进程或工具句柄；不能仅凭停止按钮推断所有动作都没有发生。

模型响应完成也不足以判断整个任务完成。中断前，两次模型生成都已有 `response.completed`，其中第二次完整生成了等待调用，但等待随后被用户取消。模型生成、工具执行和用户任务分别有自己的结束状态，下一章会从流式事件继续拆解。

## 为下一步写出依据

只看中断与恢复的输入输出，列出“已完成、被取消、尚未执行”三类动作，并为每类标一份证据。然后判断：假如中断的是修改文件工具，还需要先检查什么，才能决定是否执行剩余测试？

<details>
<summary>参考解释</summary>

类型检查的退出码 0 在中断阶段 01 请求中；等待取消在本地事件和恢复首请求中；测试只在恢复轮次发出并返回成功。如果被中断的是修改工具，要先核对实际文件是否未改、已改或部分改动，以及工具是否仍在运行，再选择补做、继续或报告问题。原计划中的顺序不能替代这些状态。

</details>

[上一章：多 Agent](12-multi-agent.md) · [下一章：流式输出与协议细节](14-streaming.md)
