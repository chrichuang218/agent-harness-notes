# 第一节 · Codex + CPA 两轮真实对话

> 历史研究案例（2026-09-08）。此材料及原始 JSON 保留用于追溯，不再作为当前教程入口。新版从[第一章](../../course/01-hello.md)开始。

[仓库首页](../../README.md) · [进度](../../PROGRESS.md) · [术语](../../GLOSSARY.md)

两次用户输入 → 五次正式请求 → 三次工具调用；另有一次预热。

**开始：[阶段01 · 初始上下文](steps/01.md)**。预热可稍后回看。

[完整讲义](学习文档.md) · [交互原文](交互原文.md) · [证据导航](evidence/README.md)

~~~mermaid
flowchart LR
 A[用户输入1] --> B[01 初始请求与读取技能]
 B --> C[02 工具结果与最终回答]
 C --> D[用户输入2]
 D --> E[03 接续历史与读取技能]
 E --> F[04 技能结果与搜索文件]
 F --> G[05 搜索结果与最终回答]
~~~

## 阶段导航

| 导读 | 输入 | 输出 |
|---|---|---|
| [00 · 预热](steps/00.md) | [请求](evidence/00-prewarm-request.json) | [响应](evidence/00-prewarm-response.json) |
| [01 · 初始上下文与读取技能](steps/01.md) | [请求](evidence/01-turn1-read-skill-request.json) | [响应](evidence/01-turn1-read-skill-response.json) |
| [02 · 工具结果与第一轮回答](steps/02.md) | [请求](evidence/02-turn1-final-request.json) | [响应](evidence/02-turn1-final-response.json) |
| [03 · 跨轮接续与显式技能](steps/03.md) | [请求](evidence/03-turn2-read-skill-request.json) | [响应](evidence/03-turn2-read-skill-response.json) |
| [04 · 技能结果与搜索背景](steps/04.md) | [请求](evidence/04-turn2-find-context-request.json) | [响应](evidence/04-turn2-find-context-response.json) |
| [05 · 搜索结果与第二轮回答](steps/05.md) | [请求](evidence/05-turn2-final-request.json) | [响应](evidence/05-turn2-final-response.json) |

## 三条对照路线

- 规则注入：[阶段01](steps/01.md) → [AGENTS原文](evidence/AGENTS-injected.txt) → [阶段03](steps/03.md)。
- 工具闭环：[阶段01响应](evidence/01-turn1-read-skill-response.json) → [阶段02请求](evidence/02-turn1-final-request.json)，搜索同一call_id。
- 跨轮接续：[阶段02响应](evidence/02-turn1-final-response.json) → [阶段03请求](evidence/03-turn2-read-skill-request.json)，比较id与previous_response_id。

本次没有展示压缩、断线恢复或子智能体执行。实验回答不自动构成已核验的模型身份或学习建议。
