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
