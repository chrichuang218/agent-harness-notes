# 新版阅读站设计记录

2026-09-30 重建。用户授权废弃旧网页内容，自主设计新的 Codex Desktop × TypeScript × CPA 实战教程；本版不再沿用旧站参考布局，也不声称复刻其他网站。

## 阅读结构

首页说明学习目标、真实项目和四阶段路线。章节使用连续正文，按需展开实验对话和证据，提供相邻章节、问题搜索及来源链接。纸色背景、深绿强调与宽松行距服务长文阅读；移动端将目录收起。

正文是理解入口，JSON 是核对依据。原始完成事件、衍生输出项、原生压缩、中断记录和界面观察分别标注。verified 表示本章结论有实验依据，partial 表示存在明确写出的未实测范围；阅读位置不等于掌握程度。

## 内容来源

- course/catalog.json：阶段、章节顺序、状态与实验关联。
- course/*.md：真实操作、机制解释、来源和折叠练习。
- evidence/desktop-lab/index.json：实验摘要；完整来源及脱敏路径位于各实验 manifest。
- examples/：故障、修复、MCP、折扣四套可复现快照。

沿用 Vite、Markdown 与 JSON；正文由 marked 解析后经 DOMPurify 清理。证据文件按需加载，历史 lessons/01-codex-cpa-trace 不编入新站。历史 JSON 未重写。

## 验证

npm run check 检查课程、链接、JSON、证据关联和示例行为。npm run build 后执行 npm run check:site，覆盖 20 章在 1440、768、390 像素宽度下的阅读、搜索、证据、主题和目录交互，并检查浏览器异常及页面溢出。

原生 Memories 的自动生成与召回未在本机开启实验，第 12 章明确保留此边界。其他实验的具体证据范围以每章正文与 manifest 为准。
