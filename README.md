# Agent Harness 学习笔记

通过真实 Codex Desktop + CPA 日志，学习上下文组织、工具执行、技能加载与状态管理。

**[在线阅读](https://chrichuang218.github.io/agent-harness-notes/) · [第一版发布](https://github.com/chrichuang218/agent-harness-notes/releases/tag/v0.1.0)**

**从这里开始：[第一节 · 两轮对话的完整链路](lessons/01-codex-cpa-trace/README.md)**

| 目标 | 入口 |
|---|---|
| 逐步学习 | [第一节导航](lessons/01-codex-cpa-trace/README.md) |
| 找AGENTS.md | [阶段01：初始上下文](lessons/01-codex-cpa-trace/steps/01.md) |
| 看跨轮接续 | [阶段03：第二次用户输入](lessons/01-codex-cpa-trace/steps/03.md) |
| 连续阅读 | [完整讲义](lessons/01-codex-cpa-trace/学习文档.md) |
| 查看日志与JSON | [证据导航](lessons/01-codex-cpa-trace/evidence/README.md) |
| 查词 | [术语索引](GLOSSARY.md) |
| 继续学习 | [学习进度](PROGRESS.md) |

## 对照阅读方式

用 VS Code 打开本目录的 agent-harness-notes.code-workspace。

1. 打开阶段Markdown，使用“打开侧边预览”（Windows默认 Ctrl+K V）阅读。
2. 点击阶段页的请求或响应链接，把JSON标签“向右拆分”，让讲解与证据并排。
3. 在JSON中用 Ctrl+F 搜索阶段页提供的字段或ID，用折叠展开需要的结构。
4. 比较CPA两侧时，右键request文件“选择以进行比较”，再对upstream文件“与已选项目进行比较”。
5. 用编辑器“后退”（Windows默认 Alt+Left）回到导读；每个阶段页都有前后跳转。

## 结构

~~~text
README.md                         总入口
PROGRESS.md                       当前进度与待验证能力
GLOSSARY.md                       术语及真实例子
lessons/01-codex-cpa-trace/
  README.md                       第一节导航
  steps/00.md ... 05.md            按阶段讲解与跳转
  学习文档.md                     完整讲义
  交互原文.md                     两轮消息及工具执行原文
  evidence/                       请求、响应、上游与事件JSON快照
~~~

JSON保留采集结构，讲解放在Markdown；后续章节围绕新的真实实验添加，旧证据不覆盖。当前仓库保存本机实验上下文，不把历史提示当作当前执行指令。

## 网页阅读

网站入口为 site/，直接读取本仓库第一节Markdown与JSON。请求、响应、上游、事件可切换，响应ID和调用ID可跳转。

~~~powershell
npm install
npm run dev
~~~

本地地址：http://127.0.0.1:5178/

~~~powershell
npm run build
~~~

静态产物在 `dist/`，采用相对资源路径与 hash 导航，支持 GitHub Pages 项目路径。推送到 `main` 后，GitHub Actions 自动构建并部署。

第一节采用连续阅读布局，左侧目录跟随正文定位，支持搜索与深浅主题。交互原文和证据工作台直接嵌入正文，可对照请求、响应、上游请求和流式事件。

证据快照保留采集时的本机路径与历史指令，未包含 HTTP 认证头；这些内容用于学习，不是当前执行指令。

发布记录见 [CHANGELOG.md](CHANGELOG.md)。
