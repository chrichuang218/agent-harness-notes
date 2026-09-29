# 学习进度

[首页](README.md)

当前主线：围绕 TypeScript 商品总价项目，通过 Codex Desktop 普通输入与 CPA 日志学习 Agent 机制。新版为四阶段、20 章；旧网页正文不再进入新版构建。

## 教程制作现场（2026-09-30）

- 已通过 Computer Use 完成问候、上下文接续、读文件、项目规则、Skill、失败测试、修复、跨任务对照、原生压缩和项目笔记实验。
- 已实测商品目录 MCP、原生计划到实施、受限写入、两个子 Agent、原生目标完成、错误恢复及真实中断后的续跑。
- 实验事实与来源见 [证据索引](evidence/desktop-lab/index.json)，已完成正文与顺序见 [课程目录](course/catalog.json)。
- 保存了 [初始故障版](examples/01-baseline/README.md)、[修复版](examples/07-fixed/README.md)、[MCP 版](examples/13-mcp/README.md) 和 [折扣版](examples/14-discount/README.md) 四套项目快照。
- 20 章通过三种屏宽的浏览器检查；链接、JSON、证据关联、预期故障与修复后的运行测试均有自动检查。
- 原生 Memories 在本机全局关闭；仅观察设置，没有改变开关。文件笔记已实测，原生自动生成及召回未实测，第 12 章保持“含待验证项”。

发布通过 main 分支的 [GitHub Pages 工作流](https://github.com/chrichuang218/agent-harness-notes/actions/workflows/pages.yml) 执行。线上发布结果以对应提交的工作流记录为准。

## 个人掌握记录

旧案例已讨论 AGENTS 注入、技能加载、工具调用与上下文引用；尚未按用户独立实践评定掌握程度。自动采集实验或写完章节不改变下列掌握状态。

学习入口：[第一章](course/01-hello.md)。历史复习材料仍保留在 [旧案例](lessons/01-codex-cpa-trace/README.md)。

- [ ] 独立定位用户输入与客户端注入内容。
- [ ] 用call_id对应工具调用和结果。
- [ ] 用previous_response_id追踪跨轮上下文。
- [ ] 比较CPA两侧请求。
- [ ] 区分完整响应、流式片段和rollout。

勾选时补充日期及实际证据。后续章节根据本节实践暴露的需要确定。
