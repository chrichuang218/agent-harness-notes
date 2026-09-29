# 先计划，再实施，边界在哪里？

给商品总价增加折扣，会同时影响接口、测试、文档与项目决定。本章使用 Desktop 原生计划模式：先调查和澄清，再提交可执行方案，最后通过界面选择开始实施。

## 从原生计划模式开始

在 Desktop 输入框的 `/` 菜单中选择“计划模式”，界面菜单实际显示“开启计划模式”。然后发送：

```text
先调查并制定方案：为 calculateTotal 增加可选参数 discountPercent，默认 0，只允许 0 到 100 的整数；单价 10 元、数量 3、折扣 10% 应返回 27 元，折扣 100% 应返回 0。保留旧调用兼容，并考虑测试、README 和项目决定的更新。现在只给计划，不修改文件、不实施。
```

这次不只是输入框里写了“计划”二字。[本地模式记录](../evidence/desktop-lab/14-plan/plan.json)中的 `turn_context` 明确显示 `collaboration_mode.mode` 为 `plan`；[界面观察](../evidence/desktop-lab/ui-observations.json)也记录了原生菜单操作。

## 切换模式怎样进入模型请求？

打开[计划阶段首请求](../evidence/desktop-lab/14-plan/00-request.request.json)，新 `input` 只有两项：`input[0]` 是以 `<collaboration_mode># Plan Mode (Conversational)` 开头的 developer 消息，`input[1]` 是用户的折扣要求；`previous_response_id` 接上上一章的响应。模式变化作为新的运行指令进入上下文，而不是要求模型从用户的一句“计划”自行猜测当前产品模式。

之后的五次请求各只有一项工具结果。沿整个过程看：

| 阶段 | 新输入/返回 | 模型输出与接下来执行的动作 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/14-plan/00-request.output-items.json) | 模式指令与用户要求 | 读取本机 Skill、列文件并尝试 `git status` |
| [01](../evidence/desktop-lab/14-plan/01-request.output-items.json) | 文件清单与 Git 错误 | 读取项目文件并搜索折扣相关实现 |
| [02](../evidence/desktop-lab/14-plan/02-request.output-items.json) | 读取命令的 `ParserError` 及搜索结果 | 修正 PowerShell 组织方式，重新读文件并查 Node 环境 |
| [03](../evidence/desktop-lab/14-plan/03-request.output-items.json) | 真实文件内容和环境结果 | 用 `request_user_input` 询问金额精度 |
| [04](../evidence/desktop-lab/14-plan/04-request.output-items.json) | 用户选择的精度策略 | 运行现有 test、typecheck、start 基线 |
| [05](../evidence/desktop-lab/14-plan/05-request.output-items.json) | 三条命令真实结果 | 生成 `<proposed_plan>`，本地记录为 `Plan` |

这张表链接的是每次模型输出；同目录同编号的 `request.json` 给出该次新输入。每次后续请求的 `previous_response_id` 都引用前一模型响应，每个结果的 `call_id` 都对应前一次调用。出错的读取没有被删掉，精度问题也不是在计划已经定好后才形式化地询问。

## 先调查，再问真正影响结果的问题

Codex 读取实现、调用位置、测试和文档，发现旧函数只有两个参数，项目决定仍写着“暂不支持折扣”。这些都可以直接查文件，无需先让用户复述。

调查后，它通过 `request_user_input` 提出了一个不能仅靠现有文件确定的问题：折扣产生小数时，要保留现有数值精度，还是统一四舍五入到分？

界面选择了“保持现有数值精度 (Recommended)”。[下一阶段请求](../evidence/desktop-lab/14-plan/04-request.request.json)中的 `function_call_output.output` 是 JSON 字符串，解析后完整内容为：

```json
{
  "answers": {
    "rounding_policy": {
      "answers": ["保持现有数值精度 (Recommended)"]
    }
  }
}
```

这个返回的 `call_id` 是 `call_9f8LTJWOrmPRVjiloSJ9B6EL`，与阶段 03 的 `request_user_input` 调用一致。它使用 `function_call_output`，不是之前 Shell 命令的 `custom_tool_call_output`；内容也不是终端输出，而是用户选择。两者都能作为下一次模型请求的输入，说明工具闭环不只处理文件或命令，也能把一个必要的人类决定接回规划过程。

这个选择随后写入计划：保留 JavaScript `number` 行为，不额外增加舍入规则。模型拿到决定后先验证基线，再整理可执行方案，保证方案里的“当前状态”和“准备改变什么”分别有依据。

## 计划模式也执行了命令

模型在计划阶段运行了 `npm test`、`npm run typecheck` 和 `npm start`，确认已有基线通过、示例仍输出 30。这些操作用于调查当前状态，没有实施折扣功能。

因此不能把计划模式理解为“绝不调用工具或执行命令”。本次[计划前文件清单](../evidence/desktop-lab/14-plan/files-before.json)与[计划后清单](../evidence/desktop-lab/14-plan/files-after-plan.json)记录的 14 个项目文件哈希完全相同。这支持“监测的项目文件未变”，不把它扩大成整个操作系统完全没有任何写入。

调查也出现过两个失败：demo 未初始化 Git，`git status` 返回错误；一条 PowerShell `foreach` 直接接管道的写法产生解析错误。后续模型调整命令，重新读取成功。这些真实结果保留在网络证据中，没有用一次错误否定全部调查，也没有把失败步骤改写成成功。

## 什么让计划可以直接实施？

最终模型输出 `<proposed_plan>`，本地 rollout 将它记录为原生 `Plan` 项。完整内容保存在[计划证据](../evidence/desktop-lab/14-plan/plan.json)，涵盖接口、非法参数行为、精度选择、测试场景和文档更新。

其中关键决定是：第三个参数默认 0，只接受 0～100 的整数，非法值抛出 `RangeError`；旧两参数调用保持兼容。计划同时列出 10% 返回 27、100% 返回 0、25% 返回 22.5，以及越界、小数、`NaN` 和无限值的测试。

这让实施阶段能依据明确的完成条件工作，而不必一边改代码一边猜测金额精度或异常策略。

## 点击实施后，模式与动作一起变化

Desktop 显示“实施此计划？”，选择“是，实施此计划”后，新一轮输入包含 `PLEASE IMPLEMENT THIS PLAN:` 和完整计划。本地记录显示模式从 `plan` 切换为 `default`，随后才发生项目修改。

在[实施首请求](../evidence/desktop-lab/14-plan-implement/00-request.request.json)中也有两项新输入：一项 developer 消息切回 `Default`，一项 user 消息携带 `PLEASE IMPLEMENT THIS PLAN:` 与完整计划。其 `previous_response_id` 对应计划的最终响应，所以“开始实施”既是模式变更，也是用户提供了明确的新执行要求。

实施并不是把计划文字当作已完成修改，而是重新走四次请求：

| 阶段 | 模型新得到什么 | 本次输出 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/14-plan-implement/00-request.output-items.json) | 切回默认模式、完整获准计划 | 重读当前源码、测试、文档和规则 |
| [01](../evidence/desktop-lab/14-plan-implement/01-request.output-items.json) | 文件当前内容 | 对四个文件调用 `apply_patch` |
| [02](../evidence/desktop-lab/14-plan-implement/02-request.output-items.json) | 修改工具返回 | 运行 test、typecheck、start |
| [03](../evidence/desktop-lab/14-plan-implement/03-request.output-items.json) | 三项执行结果 | 汇报修改和验证 |

重新读取有实际意义：计划只是基于此前观察的方案，不能替代实施时的文件状态。补丁成功返回也不能替代运行验证，因此第 02 阶段之后还必须有第 03 请求带回检查结果。

实际修改了四个文件：计算函数、测试、README 和 `docs/DECISIONS.md`。[实施后快照](../examples/14-discount/README.md)保留完整结果，函数使用以下表达式：

```typescript
return (unitPrice * quantity) * ((100 - discountPercent) / 100);
```

实施后的[验证结果](../evidence/desktop-lab/14-plan-implement/03-request.request.json)显示：11 项测试全部通过，类型检查通过，三条命令退出码均为 0；旧示例仍输出 30 元。文档和项目决定也同步更新为支持折扣。

## 模式约束与系统权限分开看

本地记录中，计划阶段和实施阶段的 `sandbox_policy.type` 都是 `danger-full-access`，改变的是协作模式与当前授权的工作阶段。因此本实验不能用来宣称计划模式在操作系统层面阻止了一切文件写入。

计划阶段有 6 次正式请求、5 次工具调用，其中一次是澄清工具；实施阶段有 4 次正式请求、3 次外层工具调用。计划阶段较长，包含调查、失败修正和基线验证，不能只按最终修改行数判断过程。统计排除预热，也不等于费用。

## 练习：检查阶段边界

只看“Codex 说没有修改文件”够不够？请找出一份独立文件证据、一份模式证据，以及从计划进入实施的界面证据，再说明运行基线测试为什么不等于已经实现折扣。

<details>
<summary>参考解释</summary>

前后哈希支持被监测的项目文件未变；`turn_context` 记录原生 `plan` 模式；界面记录“实施此计划”选择，并由下一轮 `default` 模式及实际补丁补齐链路。基线测试只验证原有功能，折扣实现和新增测试发生在实施阶段。

</details>

[上一章：外部工具怎样接入项目？](13-mcp.md) · [下一章：规则、模式和权限有什么不同？](15-permissions.md)
