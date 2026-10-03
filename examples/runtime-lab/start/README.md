# Runtime Lab

需要 Node.js 24 或更高版本，无需安装依赖。

## 测试

```powershell
node --test .codex/hook-lab/pass.test.mjs
node --test .codex/hook-lab/fail.test.mjs
node --test lab/patch-recovery/price.test.mjs
node --test lab/plan-state/price.test.mjs
```

第一条通过，后三条起初会以 `13 !== 30` 失败。`fail.test.mjs` 是故意失败的对照，不要修复它。

## 后台命令

`node lab/background-delay.mjs` 等待 35 秒，随后输出总价 `27`。等待期间可以另行读取本文件，再用原会话句柄回收输出与退出码。

## Hook 模板

`.codex/hooks.example.json` 默认不生效。将 `<PROJECT_ROOT>` 替换为此目录的绝对路径，检查脚本后再保存为 `.codex/hooks.json` 并完成审阅信任。它只检查指定的补丁目标；被拒绝后不要换方法写入受保护文件。
