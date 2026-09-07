# 文档阅读布局调整

参考：https://diwang.info/how-claude-code-works/#/

此次按用户确认的方向适配现有站点，不是逐字节镜像或1:1复刻。参考依据为公开index.html、README.md和_sidebar.md：260px侧栏、紫色强调色、章节导航、深浅主题、阅读进度、Mermaid与上下篇链接。

保留既有Vite、Markdown与JSON数据源，不引入Docsify，不复制源站文章、品牌或图标。

有意差异：
- 第一节采用连续正文与五个目录锚点，不复制源站的21章结构。
- 交互原文与证据工作台内嵌在正文，关联链接定位对应材料。
- 延用当前本机日志及关联ID跳转。
- 样式参照紫色文档主题，不声明像素级还原。
- 通过 GitHub Pages 发布；main 分支推送后自动部署。

验证：生产构建、JavaScript语法和本地HTTP检查。浏览器自动化运行环境此前缺失，未据此宣称完成视觉或交互验收。

## 字体参数核对

依据源站index.html及实际引用的docsify-themeable@0/theme-simple.css：
- 正文系统字体栈：-apple-system、BlinkMacSystemFont、Segoe UI、Helvetica、Arial、sans-serif及emoji回退。
- 源站覆盖基础字号为15px，正文行高1.7，常规字重400，strong为600。
- 标题使用1.333模块比例：H1约35.53px/400，H2约26.65px/400，H3约20px/600。
- 代码字体使用主题原始Inconsolata/Consolas/Menlo等回退栈，字号0.95rem。
- 移除此前的Google Fonts Inter导入。中文由相同系统字体回退机制选择，未额外指定微软雅黑。

已对齐CSS声明；不同系统的字体安装、浏览器渲染可能不同，未声称像素级验证。
