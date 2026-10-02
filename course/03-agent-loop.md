# Agent Loop：一次修复怎样完成？

读 README 只经过了一次工具往返。现在让 Codex 修复总价计算错误，看看它拿到结果之后，为什么还会继续调用工具。

起始项目将单价 `10` 和数量 `3` 相加，得到 `13`，测试要求得到 `30`。这是[故障快照](../examples/01-baseline/README.md)中的真实状态。先前的[检查实验](../evidence/desktop-lab/06-tests/manifest.json)已经留下结果：类型检查通过，行为测试失败，报错包含 `13 !== 30`。两个变量的类型都是 `number`，所以类型检查没有发现运算规则写错。

用户随后提出：

```text
请修复商品总价计算错误：单价 10 元、数量 3 应返回 30 元。修改必要代码，运行 npm run typecheck、npm test 和 npm start 验证，并把 README 的当前问题说明更新为修复后的状态。
```

这次工作需要留下几个可检查的结果：函数算对总价，原测试通过，示例输出 30，README 与修复后的状态一致。

## 五次请求怎样接在一起？

这轮记录有五次正式模型请求。下表中的 R0 至 R4 是阅读代号，分别对应证据文件的 `00-request` 至 `04-request`。

| 请求 | 模型这次新收到什么 | 接下来输出什么 |
| --- | --- | --- |
| R0 | 用户修复要求 | 提出一批文件读取 |
| R1 | 读到的规则、说明、实现和测试等 | 提出搜索，确认函数定义与调用位置 |
| R2 | 搜索结果 | 提出补丁，修改函数与 README |
| R3 | 修改工具的返回 | 提出验证命令，并重读修改后的文件 |
| R4 | 命令结果与最终文件内容 | 汇报完成，没有新的工具调用 |

每次工具执行完，运行程序把实际结果交回模型。模型据此生成下一步动作。这里经历了四次工具往返，直到最后一次响应给出完成说明。这就是本章沿日志观察的 Agent Loop。

修复记录发生在已经加载项目规则和技能的任务中。第一批读取还包括这台机器上的一份技能说明。这里先把它视为文件读取；规则与技能怎样参与任务，分别在第 6、7 章展开。学习顺序与实验采集时的操作顺序不同。

## 读到实现之后，先确认改哪里

[R0 输出](../evidence/desktop-lab/07-fix/00-request.output-items.json)安排读取项目文件。返回结果进入 [R1 请求](../evidence/desktop-lab/07-fix/01-request.request.json)，模型这时才取得本次读取的函数和测试内容。

下一次调用搜索 `calculateTotal`，结果同时找到了实现、示例入口和测试中的调用。这解释了为什么日志里多了一次搜索：共享函数的一处修改会影响这些调用位置。

随后模型提出补丁。下面是根据修复前后文件整理的代码差异：

```diff
 export function calculateTotal(unitPrice: number, quantity: number): number {
-  return unitPrice + quantity;
+  return unitPrice * quantity;
 }
```

原测试仍然要求 `calculateTotal(10, 3)` 等于 30，没有为了通过检查而更改预期值。README 中关于故障状态的说明也随之更新。完整补丁在 [R2 输出](../evidence/desktop-lab/07-fix/02-request.output-items.json)。

## 修改返回以后，还需要检查什么？

[R3 请求](../evidence/desktop-lab/07-fix/03-request.request.json)收到了修改工具的返回，其中没有完整的最终文件正文。Codex 接着重读函数和 README，并执行用户指定的三条命令。

| 检查 | 实际结果 | 它核对的内容 |
| --- | --- | --- |
| `npm run typecheck` | 退出码 0 | TypeScript 类型检查通过 |
| `npm test` | 退出码 0，1 项测试通过 | 现有总价测试得到预期结果 |
| `npm start` | 退出码 0，输出“总价：30 元” | 示例程序实际运行的结果 |

这些结果一起进入 [R4 请求](../evidence/desktop-lab/07-fix/04-request.request.json)。重读结果还显示函数已经使用乘法，README 已描述修复后的状态。模型随后给出[最终说明](../evidence/desktop-lab/07-fix/04-request.output-items.json)，结束本轮。

因此，完成判断可以沿记录复核：补丁提出了什么修改，文件实际变成什么，检查返回了什么。这个案例只验证了已提出的总价场景；折扣功能是在后续实验中另外设计、实施和测试的。

## 循环为什么没有停在第一次输出？

第一次响应包含工具调用，运行程序还需要执行它。执行结果又成为下一次请求的输入，模型才有依据继续处理。读取、搜索、修改和验证分别产生了新的信息，也分别推动了下一次生成。

五次请求是本次实际发生的数量。读取 README 的案例只需要两次；如果工具失败，下一步也可能是处理错误或报告无法继续。决定下一步时，要看任务要求和已经返回的结果。

读这类日志时，可以先沿 `call_id` 配对动作与结果，再看下一次输出选择了什么。上一章的文件读取往返在这里重复了多次。如何接续历史、如何处理中断，后面还有对应实验。

<details>
<summary>深入核对：四次调用与五份请求的完整对应</summary>

下面的 C1 至 C4 也是阅读代号。四次外层调用的真实类型都是 `custom_tool_call`，结果通过 `custom_tool_call_output` 回传。

| 调用 | 实际 call_id | 调用输出 | 结果请求 |
| --- | --- | --- | --- |
| C1，读取 | `call_cJsfAlSozeFn4AYEwMQ8jCMX` | [R0 输出](../evidence/desktop-lab/07-fix/00-request.output-items.json) | [R1 请求](../evidence/desktop-lab/07-fix/01-request.request.json) |
| C2，搜索 | `call_7FgPlfDNwHrla7MfaxQ2IviI` | [R1 输出](../evidence/desktop-lab/07-fix/01-request.output-items.json) | [R2 请求](../evidence/desktop-lab/07-fix/02-request.request.json) |
| C3，修改 | `call_GpRIplrClvzLfrtkkMHGVzEA` | [R2 输出](../evidence/desktop-lab/07-fix/02-request.output-items.json) | [R3 请求](../evidence/desktop-lab/07-fix/03-request.request.json) |
| C4，验证 | `call_6YUxjdksnb3eIeh5ySJjO2p8` | [R3 输出](../evidence/desktop-lab/07-fix/03-request.output-items.json) | [R4 请求](../evidence/desktop-lab/07-fix/04-request.request.json) |

[R0 请求](../evidence/desktop-lab/07-fix/00-request.request.json)只有一项新的用户输入，并引用此前失败测试轮次的最终响应。R1 至 R4 也各新增一项工具结果，通过 `previous_response_id` 接续前一响应。工具往返与历史接续使用不同的编号。

C1 的结果有四个输出块：执行包装、本机 `ponytail` 技能、文件清单与 Git 状态、项目文件。Git 状态检查因 demo 没有初始化仓库而返回退出码 1，其他读取结果仍然可用。该技能属于当时的机器环境，复现这个计算错误不要求读者安装它。

C2 返回函数的定义和调用位置。C3 调用外层 `exec` 中的 `tools.apply_patch`，其回传除执行包装外只有字符串 `"{}"`，因此不能仅靠这份返回复述最终文件正文。

C4 一次安排了三条验证命令及文件重读。R4 的 `input[0].output[0]` 是执行包装，`output[1]` 至 `output[4]` 依次对应类型检查、测试、示例运行和文件重读。各块 `text` 解析后可查看 `value.exit_code` 与 `value.output`。外层的 `fulfilled` 表示这项异步操作返回，具体命令是否成功仍要看退出码。

原始完成事件和流式事件都可通过[实验清单](../evidence/desktop-lab/07-fix/manifest.json)及工作台查看。五份完成事件的 `output` 均为空，工作台中的输出项来自各自的 `response.output_item.done`，没有回填原文件。

</details>

<details>
<summary>深入核对：修复前后的检查与用量</summary>

在[修复前的检查](../evidence/desktop-lab/06-tests/01-request.request.json)中，类型检查退出码是 0，测试退出码是 1，并报告 `13 !== 30`。本轮没有把类型正确当作计算规则正确。

[故障快照](../examples/01-baseline/README.md)与[修复快照](../examples/07-fixed/README.md)可以独立运行。复现时先复制故障版到自己的目录，保留测试的预期值。已经修好的目录无法重新产生原来的故障。

以下用量来自本轮各阶段的 `response.usage`，不包含预热：

| 请求 | 输入 token | 其中缓存输入 | 输出 token |
| --- | ---: | ---: | ---: |
| R0 | 35,472 | 35,072 | 291 |
| R1 | 38,485 | 35,328 | 162 |
| R2 | 38,822 | 38,272 | 255 |
| R3 | 39,101 | 38,656 | 197 |
| R4 | 39,982 | 38,912 | 151 |

输入合计 191,862，输出合计 1,056。多次请求反复使用已有上下文，求和不能理解为新增了这么多互不重复的项目内容；缓存计数属于输入的一部分。第 5 章会结合历史和压缩继续解释这些数字。

</details>

## 先判断，再打开最终回答

只查看 R3 与 R4 的记录：R3 刚收到修改返回时，还缺哪些完成证据？R4 收到结果后，能否确认用户要求已经满足？分别指出文件和测试结果的位置，再对照模型的最终说明。

<details>
<summary>核对答案</summary>

R3 的简短修改返回没有证明最终函数、README 和三条验证命令的结果。R4 补齐这些内容：函数使用乘法，README 已更新，类型检查和测试退出码均为 0，示例输出 30。它们支持本轮约定范围内的修复完成。

</details>

[上一章：工具系统](02-tools.md) · [下一章：任务与会话](04-session.md)
