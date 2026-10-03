# Hook 与运行状态练习

需要 Node.js 24 或更高版本，无需安装依赖。将 [start](start/) 复制到独立目录，在副本中运行：

```powershell
node --test .codex/hook-lab/pass.test.mjs
node --test .codex/hook-lab/fail.test.mjs
node --test lab/patch-recovery/price.test.mjs
node --test lab/plan-state/price.test.mjs
node lab/background-delay.mjs
```

第一条通过。`fail.test.mjs` 是故意错误的断言，始终保留为失败对照。另两份测试要求正确，起始函数的加法错误使它们以 `13 !== 30` 失败，换成乘法结果后通过。后台脚本等待 35 秒，输出 `BACKGROUND_TOTAL 27` 后退出。

[results](results/) 只包含三个发生变化的文件。把其中需要对照的文件覆盖到副本中的同一路径，再运行相应测试；不要覆盖测试文件。

[Hook 配置模板](start/.codex/hooks.example.json)不会自动生效。把 `<PROJECT_ROOT>` 替换为副本的绝对路径（用 `/` 分隔），核对所指向的脚本后，再自行保存为 `.codex/hooks.json` 并完成审阅与信任。模板产生的是新配置，不能沿用日志中的信任状态。脚本只检查指定补丁目标，不是通用写入防线。

[Hooks](../../course/10-hooks.md) · [后台命令与编辑恢复](../../course/13-autonomy.md) · [文字进度](../../course/11-plan.md) · [文件对应关系](SOURCE.md)
