# 工具失败后，怎样继续工作？

一次命令失败，不一定需要修改项目。重要的是把错误当作证据，核对原因，再在当前任务范围内选择下一步。本章故意调用不存在的脚本，观察 Codex 如何读取真实配置并继续检查。

## 给出失败后的处理边界

在 Desktop 中发送：

```text
先实际运行一次 npm run lint，作为错误反馈实验。如果提示脚本不存在，不要安装依赖或新增脚本；读取 package.json 找出现有的类型检查和测试命令，改用它们检查，并报告最初失败以及后续结果。不要修改文件。
```

这里已经明确授权了后续调查与替代检查。实验关注怎样使用失败信息，不要求为项目补一个 lint 功能。

## 四次请求中，模型的判断怎样变化？

错误不是只展示在一个终端窗口里。它返回到模型上下文之后，才参与下一步动作选择：

| 阶段 | 本次请求新增的信息 | 模型产生的调用或回答 |
| --- | --- | --- |
| [00](../evidence/desktop-lab/19-recovery/00-request.output-items.json) | 用户要求先试 lint，并限定失败处理范围 | 执行 `npm run lint` |
| [01](../evidence/desktop-lab/19-recovery/01-request.output-items.json) | 退出码 1、Missing script 错误 | 读取 `package.json` 和 `tsconfig.json` |
| [02](../evidence/desktop-lab/19-recovery/02-request.output-items.json) | 真实脚本定义和类型检查配置 | 执行已有 typecheck 与 test |
| [03](../evidence/desktop-lab/19-recovery/03-request.output-items.json) | 两项检查结果 | 同时报告最初失败与后续成功 |

四份请求都只有一个新增 `input` 项，并通过 `previous_response_id` 接上前一响应：00 的新增项是用户消息，01—03 是工具结果。请求体很短并不表示模型每次都忘了用户的“不新增脚本”约束。

## 第一条命令确实失败了

Codex 实际执行 `npm run lint`，退出码为 1。日志包含：

```text
npm error Missing script: "lint"
```

可以在[阶段 01 请求](../evidence/desktop-lab/19-recovery/01-request.request.json)的工具结果中核对。它说明 `package.json` 没有可运行的 `lint` 脚本，不表示 TypeScript 源码已经被 lint 检出错误。

这条调用的编号是 `call_Mlqrto9sxxi6WgYe0n7tE2ty`。下一请求的 `custom_tool_call_output.call_id` 与它相同，内容块里包含序列化的执行结果；解析后才得到 `exit_code: 1` 和错误字符串。外层 `Script completed` 表示 JavaScript 编排已返回，不能据此把内部 npm 命令判为成功。

记录还包含 npm 提供的一般提示，但这些提示不是用户的新要求。模型没有按提示转去执行无关命令，也没有安装工具或添加脚本来抹掉这次失败。失败信息是需要解释的数据，不会自动获得高于任务约束的权限。

## 读取配置，选择已有路径

收到错误之后，模型读取了 `package.json` 与 `tsconfig.json`。这次调用的编号是 `call_OchDQ0cGzHrbt3ceSdbM1CI1`，其结果进入[阶段 02 请求](../evidence/desktop-lab/19-recovery/02-request.request.json)。实际脚本配置中包含 `typecheck: "tsc"` 和 `test: "node --test tests/price.test.ts"`。读取这份文件把“猜一个可能可用的命令”变成“依据当前项目定义选择命令”。

随后运行了这两个已有命令。下表同时保留最初失败和后续成功，避免把整个过程压成一句含糊的“检查通过”：

| 动作 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run lint` | 1 | 脚本不存在 |
| 读取项目配置 | 0 | 找到类型检查与测试脚本 |
| `npm run typecheck` | 0 | 类型检查通过 |
| `npm test` | 0 | 11 项测试通过，0 失败 |

后两项结果见[阶段 03 请求](../evidence/desktop-lab/19-recovery/03-request.request.json)。下面是其中类型检查内容块的 JSON 字符串解析后的字段节选：

```json
{
  "command": "npm run typecheck",
  "status": "fulfilled",
  "value": {
    "exit_code": 0
  }
}
```

`fulfilled` 表示工具返回了结果，`exit_code: 0` 与命令输出共同支持成功判断。第六章中相同的 `fulfilled` 也可以包装退出码 1，因此不能只看外层状态。

## 恢复的是任务进度，不是让错误消失

本次恢复链路是：失败结果 → 读取配置 → 找到已存在的命令 → 执行 → 分别报告。第三个外层调用 `call_4tMi1tCpS1AQfLCUS713w1zY` 内部用 `Promise.allSettled` 安排两条检查，再分别带上 `command` 标签返回，所以最后请求虽然只有一个输入项，仍能区分哪份退出码属于哪条命令。

`npm run lint` 仍然是一次真实失败，原始证据保留，最终回答也明确说明了它。这里看到的是模型收到工具错误后选择了新的动作，不是 npm 自己自动修复了脚本，也不是 CPA 重试网络请求。新的工具调用出现在后一次模型输出里，是区分这些机制的直接证据。

类型检查和行为测试通过，不等于 lint 通过。我们没有定义 lint 规则，也没有运行一个实际 lint 脚本，所以报告应分别列出能证明的范围。

与之相对，直接重试同一个不存在的脚本，通常不会改变结果；擅自添加脚本则超出本次只读检查范围。这次动作依据的是具体错误和项目配置，不是看到任何非零退出码都重复运行。

## 模型怎样获得失败信息？

第一阶段模型输出运行 lint 的工具调用；执行器把退出码和错误文字装入 `custom_tool_call_output`，进入第二次模型请求。模型此后选择读取配置，并继续产生新的工具调用。

整轮共有 4 次正式模型请求、3 次外层工具调用。最后一轮外层调用内部安排了类型检查和测试两条命令，所以外层工具数与 Shell 命令数不同。正式输入 token 合计 272,711、输出 token 合计 397，排除预热，不直接换算成费用。

本例没有模拟网络超时、丢失响应或服务端重试，也没有测试失败后修改业务代码。那些情况需要不同证据，不能由这次脚本不存在的错误一概推断。

## 练习：怎样诚实地报告恢复结果？

如果 lint 脚本不存在，但类型检查与测试成功，你会怎样写两句话，让读者同时知道最初失败、替代检查结果和未验证范围？

<details>
<summary>参考解释</summary>

“`npm run lint` 退出码 1，因为项目未定义该脚本，本次没有完成 lint。读取配置后运行已有的类型检查与测试，两者退出码均为 0，11 项测试通过；未新增脚本或修改项目。”后续成功不应覆盖最初失败，也不应冒充未执行过的检查。

</details>

[上一章：逐渐出现的文字，怎样组成一次响应？](18-streaming.md) · [下一章：点击停止后，怎样安全继续？](20-interruption.md)
