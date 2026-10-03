# 第三方来源与许可

## Learn Claude Code

本项目的首页与章节界面参考了 [Learn Claude Code](https://learn.shareai.run/) 的公开界面及 [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 源码。

核对版本：`ce8f9f186058939da54c9d6fead78dfb5d0fd6c3`，获取日期：2026-10-02。上游采用 MIT License，版权归属为 `Copyright (c) 2024 shareAI Lab`。完整声明保存在 [learn-claude-code.txt](site/public/licenses/learn-claude-code.txt)，随网站发布。

参考和适配的部分包括首页标题与开始入口、响应式学习卡片、分组侧栏、章节标题层级及上下章导航。对应源码为：

- `web/src/app/[locale]/page.tsx`
- `web/src/components/ui/card.tsx`
- `web/src/components/layout/header.tsx`
- `web/src/components/layout/sidebar.tsx`
- `web/src/app/[locale]/(learn)/[version]/page.tsx`
- `web/src/app/globals.css`

本项目是独立的 Codex Desktop 与 CPA 实验教程，正文、实验顺序、TS 项目和证据来自本仓库。时间线依据本项目 `07-fix` 的五次真实请求制作。参考站的教学正文、模拟运行数据、品牌标识与媒体资源没有作为本项目内容发布。

页面保留本项目的紫色主题，并沿用现有 Vite 与证据阅读功能。上游使用的 Next.js、React 与 Tailwind 没有因此成为本项目的新依赖。已有依赖继续适用各自软件包附带的许可。

## How Claude Code Works

2026-10-03 的章节阅读调整参考了 [How Claude Code Works](https://diwang.info/how-claude-code-works/) 的两栏布局、当前章节内的小节导航、浅色代码块和排版层级。公开源码为 [Windy3f3f3f3f/how-claude-code-works](https://github.com/Windy3f3f3f3f/how-claude-code-works/tree/f4d6505ed9162a0ee6be089190f74c419ecacb19)，核对版本为 `f4d6505ed9162a0ee6be089190f74c419ecacb19`。

参考位置为 `index.html` 中的 Docsify 配置（`loadSidebar`、`subMaxLevel`）、主题变量和它引用的 `docsify-themeable` 样式。上游为 MIT License，版权声明为 `Copyright (c) 2025 Windy3f3f3f3f`，全文保存在 [how-claude-code-works.txt](site/public/licenses/how-claude-code-works.txt) 并随网站发布。

本项目保留已有首页、框架与紫色主题，章节导航由本项目的目录和正文生成。未复制参考站的品牌、图片、文章或 Claude Code 内部机制结论，也未引入 Docsify 作为依赖。
