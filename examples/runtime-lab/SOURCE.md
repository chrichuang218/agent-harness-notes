# 文件对应关系

`start/` 保存起始文件，`results/` 只保存完成后变化的文件。下表中的字段路径位于所链接的文件快照中；代码与文本直接使用对应字段的内容。

| 文件 | 对应快照与字段 |
| --- | --- |
| [start/.codex/hooks/prompt-marker.mjs](start/.codex/hooks/prompt-marker.mjs) | [Hook 快照](../../evidence/desktop-lab/hook-pre-tool/file-observations.json)，`before.files[path=".codex/hooks/prompt-marker.mjs"].text` |
| [start/.codex/hooks/tool-experiment.mjs](start/.codex/hooks/tool-experiment.mjs) | 同一快照，`before.files[path=".codex/hooks/tool-experiment.mjs"].text` |
| [start/.codex/hooks.example.json](start/.codex/hooks.example.json) | 同一快照，`before.files[path=".codex/hooks.json"].text`；命令路径按下方说明适配 |
| [start/.codex/hook-lab/protected.txt](start/.codex/hook-lab/protected.txt) | 同一快照，`before.files[path=".codex/hook-lab/protected.txt"].text` |
| [start/.codex/hook-lab/allowed.txt](start/.codex/hook-lab/allowed.txt) | 同一快照，`before.files[path=".codex/hook-lab/allowed.txt"].text` |
| [start/.codex/hook-lab/pass.test.mjs](start/.codex/hook-lab/pass.test.mjs) | 同一快照，`before.files[path=".codex/hook-lab/pass.test.mjs"].text`；[PostToolUse 实验](../../evidence/desktop-lab/hook-post-tool/manifest.json)使用同一文件 |
| [start/.codex/hook-lab/fail.test.mjs](start/.codex/hook-lab/fail.test.mjs) | 同一快照，`before.files[path=".codex/hook-lab/fail.test.mjs"].text`；失败条件保留 |
| [results/.codex/hook-lab/allowed.txt](results/.codex/hook-lab/allowed.txt) | 同一快照，`after.files[path=".codex/hook-lab/allowed.txt"].text` |
| [start/lab/background-delay.mjs](start/lab/background-delay.mjs) | [后台命令快照](../../evidence/desktop-lab/background-return/file-observations.json)，`script.before.content` |
| [start/src/price.ts](start/src/price.ts) | 同一快照，`importedPriceSource.text`；后台脚本调用它计算九折后的 27 |
| [start/lab/patch-recovery/price.ts](start/lab/patch-recovery/price.ts) | [编辑恢复快照](../../evidence/desktop-lab/patch-recovery/file-observations.json)，对应文件的 `before.content` |
| [start/lab/patch-recovery/price.test.mjs](start/lab/patch-recovery/price.test.mjs) | 同一快照，对应文件的 `before.content` |
| [results/lab/patch-recovery/price.ts](results/lab/patch-recovery/price.ts) | 同一快照，对应文件的 `after.text` |
| [start/lab/plan-state/price.ts](start/lab/plan-state/price.ts) | [文字进度快照](../../evidence/desktop-lab/plan-status/file-observations.json)，对应文件的 `before.content` |
| [start/lab/plan-state/price.test.mjs](start/lab/plan-state/price.test.mjs) | 同一快照，对应文件的 `before.content` |
| [results/lab/plan-state/price.ts](results/lab/plan-state/price.ts) | 同一快照，对应文件的 `after.text` |
| [start/package.json](start/package.json) | 新增的运行元数据，仅声明 ESM 与 Node.js 24，无依赖 |
| [start/README.md](start/README.md) | 新增的独立副本运行说明；内容不同于历史后台实验读取的 demo README |

配置模板只将原命令中的固定 Node 可执行文件及项目目录替换为 `node "<PROJECT_ROOT>/…"`，并格式化 JSON；事件、matcher、超时和状态文字保持原值。它的文件名为 `hooks.example.json`，不会被作为项目 Hook 配置加载，也不等于当时已受信任的定义。

Hook 脚本及相对目录层次保持原样。脚本从自身位置向上两级定位项目根，只拦截 `.codex/hook-lab/protected.txt` 的补丁目标；路径比较保留原来的小写规范化，不能据此扩大成通用文件安全策略。

内容核对仅统一 Git 工作副本可能改变的 CRLF/LF 换行，不改命令、字段或表达式。

在仓库根目录运行 `node scripts/check-runtime-lab.mjs` 检查起始与结果状态；加 `--background` 再实际等待后台脚本完成。Hook 检查使用临时副本和合成事件，只验证本地脚本，不计作新的 Desktop 实验。原有实验的调用和返回仍以对应日志为准。
