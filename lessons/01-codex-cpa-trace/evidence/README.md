# 第一节证据目录

[第一节总览](../README.md) · [讲义](../学习文档.md) · [交互原文](../交互原文.md)

JSON保持采集结构。request是Codex→CPA，upstream是CPA→上游，response是response.completed中的完整响应对象，events是流式JSON事件序列。导出未包含HTTP认证头，正文仍保留当时的本机上下文。

| 导读 | 客户端请求 | 上游请求 | 完整响应 | 流式事件 |
|---|---|---|---|---|
| [00 导读](../steps/00.md) | [请求](00-prewarm-request.json) | [上游](00-prewarm-upstream.json) | [响应](00-prewarm-response.json) | [事件](00-prewarm-events.json) |
| [01 导读](../steps/01.md) | [请求](01-turn1-read-skill-request.json) | [上游](01-turn1-read-skill-upstream.json) | [响应](01-turn1-read-skill-response.json) | [事件](01-turn1-read-skill-events.json) |
| [02 导读](../steps/02.md) | [请求](02-turn1-final-request.json) | [上游](02-turn1-final-upstream.json) | [响应](02-turn1-final-response.json) | [事件](02-turn1-final-events.json) |
| [03 导读](../steps/03.md) | [请求](03-turn2-read-skill-request.json) | [上游](03-turn2-read-skill-upstream.json) | [响应](03-turn2-read-skill-response.json) | [事件](03-turn2-read-skill-events.json) |
| [04 导读](../steps/04.md) | [请求](04-turn2-find-context-request.json) | [上游](04-turn2-find-context-upstream.json) | [响应](04-turn2-find-context-response.json) | [事件](04-turn2-find-context-events.json) |
| [05 导读](../steps/05.md) | [请求](05-turn2-final-request.json) | [上游](05-turn2-final-upstream.json) | [响应](05-turn2-final-response.json) | [事件](05-turn2-final-events.json) |

## 原始位置

[精确文件与行号索引](source-index.json) · [rollout快照](rollout.json) · [AGENTS注入原文](AGENTS-injected.txt)

CPA日志根目录：E:\Develop\CPA-Stack\runtime\cli-proxy-api\auth\logs

采集时客户端临时目录：request-log-parts-websocket-timeline-2525274943

采集时上游临时目录：request-log-parts-api-websocket-timeline-2098804534

原始rollout：C:\Users\49522\.codex\sessions\2026\09\08\rollout-2026-09-08T00-13-01-01a07ca4-f7d5-75d1-b08b-c6f4eb165eaf.jsonl

临时文件可能随合并与清理失效；本仓库快照用于稳定阅读。

## 搜索字段

| 要找什么 | 搜索 |
|---|---|
| 新增输入 | input |
| 模型生成内容 | output |
| 真正提出的工具调用 | custom_tool_call |
| 执行结果 | custom_tool_call_output |
| 配对工具调用与结果 | call_id |
| 历史接续 | previous_response_id |
| 完整响应事件 | response.completed |
| 用户轮次 | turn_id |

[返回第一节](../README.md)
