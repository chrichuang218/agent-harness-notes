# Codex TS Demo

一个计算商品总价的极简 TypeScript 项目，用于在 Codex Desktop 中测试文件读取、代码修改和测试执行，并通过 CPA 日志观察过程。

## 环境

需要 Node.js 24 或更高版本。直接运行 TypeScript，使用 Node.js 内置测试工具；TypeScript 编译器用于类型检查。

```powershell
npm install
npm start
npm run typecheck
npm test
```

## 功能与当前问题

总价应等于单价乘以数量。本例仅使用整数单价和数量。

当前测试场景：单价为 10 元、数量为 3，预期总价为 30 元，程序实际输出 13 元。

这是供后续修复实验使用的初始状态：类型检查应通过，行为测试应失败。先保留这个问题，开始修复实验时再修改代码。

## 文件

- [src/index.ts](src/index.ts)：示例运行入口。
- [src/price.ts](src/price.ts)：总价计算函数。
- [tests/price.test.ts](tests/price.test.ts)：验证预期行为的测试。

在 Codex Desktop 中打开本项目目录，即可开始实验。
