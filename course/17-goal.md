# 目标有了完成条件，怎样停下来？

持续推进需要明确的终点，否则“再检查一下”可能无限延长。本章通过 Desktop 原生 Goal 功能设定一个很小的目标：核对现有折扣实现，执行两项检查，满足条件后把目标状态更新为完成。

## 在原生入口填写可验收的目标

通过 `/` 菜单选择“Goal 设置要持续追求的目标”，填写：

```text
检查当前总价实现是否满足 README 的折扣约定，运行 npm run typecheck 和 npm test，每项至多一次。两项通过且给出退出码与结论后完成目标；不修改文件，不创建子智能体，不扩展任务。若失败就报告具体失败。
```

[界面观察](../evidence/desktop-lab/ui-observations.json)的 `goal-compose` 项记录了入口。这次是 Goal 控件承载的目标，不是把一句普通聊天里的“目标”当作原生状态。

这里同时给出了检查对象、完成条件和范围：README 与实现一致，两条命令通过，报告退出码；不修改代码，不把工作再分给子智能体。没有设置 token 预算。

## Goal 入口怎样改变这次输入？

[首请求](../evidence/desktop-lab/17-goal/00-request.request.json)通过 `previous_response_id` 接上此前任务，新 `input` 只有一个 user 消息。但它不是未经包装的短提示：正文以 `<codex_internal_context source="goal">` 开头，包含 `<objective>` 中的目标，以及目标继续、完成核查等运行说明。这里的用户角色与输入框中的裸文字仍然不是一一对应关系。

这份包装告诉模型“持续围绕什么目标工作，以及何时才可更新完成状态”。它不意味着模型已经完成目标，也不替代随后各项检查。目标文字进上下文和本地目标状态更新，是两个时刻。

## 执行过程围绕完成条件展开

Codex 先读取 README、计算函数、测试、`package.json`，再查看 `tsconfig.json`。它据此核对默认折扣、整数范围、异常类型和消息、公式以及“不额外舍入”的约定。

之后通过一次外层 `exec` 安排两条检查命令，各执行一次：

| 检查 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run typecheck` | 0 | 类型检查通过 |
| `npm test` | 0 | 11 项测试通过，0 失败 |

按请求逐步观察，目标达成并不是只发生在最后一次工具调用：

| 阶段 | 本次模型获得的信息 | 输出动作 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/17-goal/00-request.output-items.json) | Goal 包装、明确完成条件、此前历史引用 | 读取 README、实现、测试和 package |
| [01](../evidence/desktop-lab/17-goal/01-request.output-items.json) | 文件正文 | 继续读取 `tsconfig.json` |
| [02](../evidence/desktop-lab/17-goal/02-request.output-items.json) | 类型检查配置 | 一次 `exec` 安排 typecheck 与 test |
| [03](../evidence/desktop-lab/17-goal/03-request.output-items.json) | 两项命令实际结果 | 说明检查结论，调用 `update_goal` |
| [04](../evidence/desktop-lab/17-goal/04-request.output-items.json) | 更新目标工具的返回 | 最终汇报完成 |

完整命令结果在[阶段 03 请求](../evidence/desktop-lab/17-goal/03-request.request.json)中。01—04 都以一个新的 `custom_tool_call_output` 和前一响应引用接续。前面的读取和验证与普通 Agent Loop 一样；Goal 额外引入的是持续目标及其状态，而不是用“目标模式”替代工具执行。

没有新增修复、再次运行检查或创建子智能体的调用。目标中的“每项至多一次”限制了本次工作范围，但它不是操作系统锁，也不是硬性的 token 或费用预算。

## “说完成”与“状态完成”分别核对

在获得检查结果之后，模型实际调用了目标状态工具。外层代码如下，来自[阶段 03 输出项](../evidence/desktop-lab/17-goal/03-request.output-items.json)：

```javascript
text(await tools.update_goal({status:"complete"}));
```

工具结果随后进入下一次模型请求。下面是其中 `goal` 对象的字段节选，省略用量与时间字段：

```json
{
  "threadId": "01a0edfd-0bdc-7042-985c-5c6a957c6895",
  "objective": "检查当前总价实现是否满足 README 的折扣约定，运行 npm run typecheck 和 npm test，每项至多一次。两项通过且给出退出码与结论后完成目标；不修改文件，不创建子智能体，不扩展任务。若失败就报告具体失败。",
  "status": "complete"
}
```

[目标状态证据](../evidence/desktop-lab/17-goal/goal-state.json)保留了解析后的精确结果、所属任务 ID、调用编号和源 JSON 位置。它证明这次目标工具返回了 `complete`，证据强于仅引用助手最终说的“目标已完成”。

本次没有观察到单独的 `get_goal` 调用，不为让流程更整齐而补写一个未发生的查询。状态以这次 `update_goal` 的真实返回为依据。

## 完成判断为什么可信？

完成状态本身也不是业务正确性的证明。这里还需要它之前的证据：模型读到了实际文件，两项检查返回成功，结论说明了与 README 的对应关系。顺序是“检查完成条件 → 获取结果 → 更新状态 → 汇报”。

如果测试失败，不能只把状态改为 `complete` 来结束任务。这个目标已经要求报告具体失败；是否继续修复，还取决于当时的授权与范围。本轮两项检查实际通过，因此没有发生失败分支。

## 这次没有验证哪些能力？

这个小目标在一轮工作中就完成了。它没有证明后台自动续跑多少轮、暂停后如何恢复，或额度耗尽时怎样处理。那些能力需要单独触发和观察，不能由“存在 Goal 入口”直接推出。

本次有 5 次正式模型请求、4 次外层工具调用，最后一次外层调用执行 `update_goal`。统计排除预热。目标工具还返回自己的用量和耗时字段，与 CPA 多次请求的 token 求和属于不同统计，不将两者混算成费用。

## 练习：怎样识别提前完成？

假设日志中存在 `status: "complete"`，但没有 `npm test` 的执行结果，你能否断言这个目标完成？需要补查哪些证据？

<details>
<summary>参考解释</summary>

不能。状态工具返回只证明状态被更新，还需要逐项对照目标要求：实现与 README 的核对、两条命令的真实结果、退出码与最终结论。缺少必要执行结果时，应标为未验证，而不是用状态代替验收。

</details>

[上一章：两个子智能体，怎样分工与汇总？](16-multi-agent.md) · [下一章：逐渐出现的文字，怎样组成一次响应？](18-streaming.md)
