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

## 功能与当前状态

总价应等于单价乘以数量。本例仅使用整数单价和数量。

当前测试场景：单价为 10 元、数量为 3，预期总价为 30 元，程序实际输出 30 元。

已修复总价计算误用加法的问题，现按单价乘以数量计算。类型检查和行为测试均通过，示例程序输出总价 30 元。

## 文件

- [src/index.ts](src/index.ts)：示例运行入口。
- [src/price.ts](src/price.ts)：总价计算函数。
- [tests/price.test.ts](tests/price.test.ts)：验证预期行为的测试。

在 Codex Desktop 中打开本项目目录，即可开始实验。
