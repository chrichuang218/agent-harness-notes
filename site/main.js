import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';

const files = import.meta.glob(['../course/**/*.md', '../course/**/*.json', '../evidence/desktop-lab/**/*.json', '../evidence/desktop-lab/**/*.jsonl', '../evidence/desktop-lab/**/*.md', '../evidence/desktop-lab/**/*.txt'], { query: '?raw', import: 'default' });
const repo = 'https://github.com/chrichuang218/agent-harness-notes';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.61-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03A9.58 9.58 0 0 1 12 6.85c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M12 4a8 8 0 0 1 0 16V4Z" fill="currentColor"/></svg>',
};
const href = id => '#/lesson/' + encodeURIComponent(id);
let catalog = { groups: [], lessons: [] };
let experiments = [];
let currentLesson = null;
let ticket = 0;
let searchTexts;
let evidenceState;
let downloadUrl;
const app = document.querySelector('#app');

async function loadFile(path) {
  const loader = files['../' + path.replace(/^\.\.\//, '')];
  if (!loader) throw new Error('找不到文件：' + path);
  return loader();
}
const status = lesson => lesson.status === 'verified'
  ? '<span class="status verified"><i></i>真实实验</span>'
  : '<span class="status partial"><i></i>含待验证项</span>';
const number = lesson => String(catalog.lessons.indexOf(lesson) + 1).padStart(2, '0');
const stageLabel = (stage, kind) => stage.title || `${stage.prewarm ? '预热请求' : kind === 'compaction' ? '压缩请求' : '正式请求'} · ${stage.id}`;

function shell() {
  app.innerHTML = `<a class="skip-link" href="#main">跳至正文</a><div class="reading-progress" aria-hidden="true"></div>
    <header class="site-header"><a class="brand" href="#/" aria-label="Agent Harness Notes 首页"><span class="brand-mark" aria-hidden="true">a<span>↗</span></span><span>Agent Harness<span class="brand-caption">NOTES / 实验手记</span></span></a>
    <nav class="top-nav" aria-label="主导航"><a href="#/" data-home-section>学习路线</a><button data-search>问题索引</button></nav><div class="header-actions"><button class="search-trigger" data-search aria-label="搜索教程">${icons.search}<span>搜索</span><kbd>/</kbd></button><a class="icon-button github-link" href="${repo}" target="_blank" rel="noopener" aria-label="GitHub 仓库">${icons.github}</a><button class="icon-button" id="theme-toggle" aria-label="切换深浅主题">${icons.theme}</button><button class="icon-button menu-toggle" aria-label="展开学习目录" aria-expanded="false">☰</button></div></header>
    <div class="mobile-shade" hidden></div><aside class="course-sidebar" aria-label="课程目录"></aside><main id="main" tabindex="-1"></main>
    <footer class="site-footer"><a class="footer-brand" href="#/">Agent Harness Notes<span>以真实项目为起点，以证据建立理解。</span></a><div><a href="${repo}" target="_blank" rel="noopener">源码与实验记录 ↗</a><span>Codex Desktop × TypeScript × CPA</span></div></footer>
    <dialog id="search-dialog" aria-labelledby="search-title"><div class="search-top">${icons.search}<label class="sr-only" id="search-title" for="search-input">搜索章节、概念或问题</label><input id="search-input" type="search" placeholder="搜索章节、概念或问题…" autocomplete="off"><button class="close-button" data-close aria-label="关闭搜索">×</button></div><div class="search-hint">从一个具体问题开始。试试「上下文」「工具」「记忆」。</div><div id="search-results" aria-live="polite"></div><div class="search-footer"><span>搜索全部章节正文</span><span><kbd>Esc</kbd> 关闭</span></div></dialog>
    <dialog id="evidence-dialog" aria-labelledby="evidence-title"><div class="evidence-top"><div><span class="eyebrow">SOURCE / 真实证据</span><h2 id="evidence-title">实验记录</h2></div><button class="close-button" data-close aria-label="关闭证据">×</button></div><div id="evidence-content"></div></dialog><div class="toast" role="status" aria-live="polite"></div>`;
  document.querySelector('#theme-toggle').onclick = () => {
    document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('ah-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); } catch { /* Theme remains usable without storage. */ }
  };
  document.querySelectorAll('[data-search]').forEach(button => button.onclick = openSearch);
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  document.querySelector('.menu-toggle').onclick = () => toggleMenu(!document.body.classList.contains('menu-open'));
  document.querySelector('.mobile-shade').onclick = () => toggleMenu(false);
  document.querySelector('.course-sidebar').onclick = event => {
    if (event.target.closest('a')) toggleMenu(false);
  };
  document.querySelector('.skip-link').onclick = event => {
    event.preventDefault(); document.querySelector('#main').focus(); document.querySelector('#main').scrollIntoView();
  };
  document.querySelector('[data-home-section]').onclick = event => {
    if (!currentLesson) { event.preventDefault(); document.querySelector('#curriculum')?.scrollIntoView({ behavior: 'smooth' }); }
    else sessionStorage.setItem('ah-home-anchor', 'curriculum');
  };
  document.querySelector('#search-input').addEventListener('input', showSearchResults);
  document.addEventListener('keydown', event => {
    if ((event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) || ((event.ctrlKey || event.metaKey) && event.key === 'k')) { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') toggleMenu(false);
  });
}

function toggleMenu(open) {
  document.body.classList.toggle('menu-open', open);
  document.querySelector('.mobile-shade').hidden = !open;
  document.querySelector('.menu-toggle').setAttribute('aria-expanded', String(open));
}

function renderSidebar() {
  document.querySelector('.course-sidebar').innerHTML = `<a class="sidebar-home" href="#/">← 教程首页</a><div class="sidebar-heading">循序渐进，理解 Agent</div><nav>${catalog.groups.map((group, index) => `<details class="nav-group" ${!currentLesson || currentLesson.group === group.id ? 'open' : ''}><summary><span>${String(index + 1).padStart(2, '0')} / ${esc(group.title)}</span><span class="chevron">⌄</span></summary>${catalog.lessons.filter(lesson => lesson.group === group.id).map(lesson => `<a class="chapter-link ${currentLesson?.id === lesson.id ? 'active' : ''}" ${currentLesson?.id === lesson.id ? 'aria-current="page"' : ''} href="${href(lesson.id)}"><span class="chapter-number">${number(lesson)}</span><span>${esc(lesson.title)}</span><i class="chapter-status ${lesson.status}" title="${lesson.status === 'verified' ? '有真实实验记录' : '含待验证项'}"></i></a>`).join('')}</details>`).join('')}</nav><div class="sidebar-note"><span class="tiny-cross">+</span> 每章一个问题<br>操作、证据、解释，再亲手验证。</div>`;
}

function renderHome() {
  const first = catalog.lessons[0];
  const bug = catalog.lessons.find(lesson => /修复|bug/i.test(lesson.title));
  const hello = experiments.find(experiment => /你好|问候/.test(experiment.prompt || experiment.title)) || experiments[0];
  const verified = catalog.lessons.filter(lesson => lesson.status === 'verified').length;
  document.querySelector('#main').innerHTML = `<div class="home-content">
    <section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> 一份可以跟着做的 Agent 实验手记</p><h1>从「你好」<br>到理解 <em>Agent<span class="title-dot">.</span></em></h1><p class="hero-description">在一个小小的 TypeScript 项目里，<br class="desktop-break">看懂 Codex 如何组织任务、使用工具，<br class="desktop-break">把一次对话变成真正完成的工作。</p><div class="hero-actions">${first ? `<a class="button button-primary" href="${href(first.id)}">开始第一章 ${icons.arrow}</a>` : '<span class="button button-primary">课程整理中</span>'}${bug ? `<a class="text-link" href="${href(bug.id)}">看一次完整修复 <span>↗</span></a>` : ''}</div><div class="hero-tools"><span>CODEX DESKTOP</span><i>×</i><span>TYPESCRIPT</span><i>×</i><span>CPA LOGS</span></div></div>
    <div class="hero-visual"><div class="visual-side-label">OBSERVE. TRACE. UNDERSTAND.</div><div class="trace-window"><div class="trace-title"><span><i></i><i></i><i></i></span><span>一次真实交互 / ${hello ? '已采集' : '等待记录'}</span><span>↗</span></div><div class="trace-body"><div class="trace-line"><span class="trace-role">YOU</span><p>${esc(hello?.prompt || '从第一句对话开始')}</p></div><div class="trace-connector"><span></span><small>Codex Desktop → CPA → 模型</small></div><div class="trace-line response"><span class="trace-role">CODEX</span><p>${esc(hello?.reply || '通过真实记录，观察一次任务如何完成。')}</p></div><div class="trace-divider"></div><div class="trace-summary"><span>沿着证据，打开黑盒</span><span class="trace-square">⌘</span></div><div class="trace-stats">${hello?.stats?.requests != null ? `<div><strong>${esc(hello.stats.requests)}</strong><span>模型请求</span></div>` : ''}${hello?.stats?.toolCalls != null ? `<div><strong>${esc(hello.stats.toolCalls)}</strong><span>工具调用</span></div>` : ''}<div><strong>TS</strong><span>真实项目</span></div></div></div></div><div class="visual-note"><span>↳</span><p>你看到一句回答，<br>我们一起看见它背后的过程。</p><span class="hand-star">✳</span></div></div></section>
    <div class="approach-strip"><p><strong>不只知道怎么用。<br>也知道为什么这样运行。</strong></p><div><span class="strip-number">01</span><p><b>一个项目贯穿</b><span>从读文件，到修 bug，再到协作。</span></p></div><div><span class="strip-number">02</span><p><b>每个结论有出处</b><span>界面行为、CPA 日志与本地结果。</span></p></div><div><span class="strip-number">03</span><p><b>每章一次小验证</b><span>从跟着看，走到能够独立解释。</span></p></div></div>
    <section class="curriculum" id="curriculum"><div class="section-heading"><div><p class="eyebrow">THE LEARNING PATH / 学习路线</p><h2>从一条消息，逐步向里走。</h2></div><p>${catalog.lessons.length} 个章节 · ${catalog.groups.length} 个阶段<br><span>${verified} 章有真实实验依据</span></p></div><div class="course-groups">${catalog.groups.map((group, index) => `<section class="course-group"><div class="group-intro"><span class="group-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p></div></div><div class="group-lessons">${catalog.lessons.filter(lesson => lesson.group === group.id).map(lesson => `<a class="lesson-row" href="${href(lesson.id)}"><span class="lesson-number">${number(lesson)}</span><div><h4>${esc(lesson.title)}</h4>${lesson.subtitle ? `<p>${esc(lesson.subtitle)}</p>` : ''}</div>${status(lesson)}<span class="row-arrow">↗</span></a>`).join('')}</div></section>`).join('') || '<p class="empty-state">新的实验与章节正在整理。</p>'}</div><p class="status-explanation"><i class="legend-dot"></i>真实实验：结论有对应记录。<i class="legend-dot partial"></i>含待验证项：明确标注观察边界，不将计划写成结果。</p></section>
    <section class="project-note"><div><p class="eyebrow">SMALL PROJECT, REAL QUESTIONS</p><h2>项目足够小，<br>问题足够真实。</h2><p>单价 10 元，数量 3，总价却算成了 13。<br>从这个显而易见的 bug 开始，逐步理解工具、规则、技能、上下文、记忆和 MCP。</p>${bug ? `<a class="text-link" href="${href(bug.id)}">走进这个 TypeScript 项目 ${icons.arrow}</a>` : ''}</div><div class="price-example" aria-label="教学项目初始 bug 示意"><div><span>修复前 / calculateTotal 返回语句</span><span>price.ts 节选</span></div><pre><code><span class="code-keyword">return</span> unitPrice <mark>+</mark> quantity;</code></pre><p><span>实际结果 <s>13</s></span><span class="example-arrow">→</span><span>预期结果 <b>30</b></span></p></div></section>
    <section class="contribute"><div><span class="eyebrow">LEARN IN THE OPEN</span><h2>把理解留下来，也让别人少走一步。</h2><p>如果这份教程帮助你看懂了一个机制，欢迎收藏、分享，或补充一次自己的实验。</p></div><a class="button button-outline" href="${repo}" target="_blank" rel="noopener">${icons.github} 在 GitHub 上一起完善 ↗</a></section></div>`;
  if (sessionStorage.getItem('ah-home-anchor')) { sessionStorage.removeItem('ah-home-anchor'); requestAnimationFrame(() => document.querySelector('#curriculum')?.scrollIntoView()); }
}

function decorateMarkdown(container, lesson) {
  const headings = [];
  container.querySelectorAll('h2,h3').forEach((heading, index) => { heading.id = 'section-' + index; headings.push({ id: heading.id, text: heading.textContent, level: heading.tagName }); });
  container.querySelectorAll('a').forEach(link => {
    const original = link.getAttribute('href') || '';
    if (/^https?:/.test(original)) { link.target = '_blank'; link.rel = 'noopener'; return; }
    if (original.startsWith('#')) {
      const wanted = decodeURIComponent(original.slice(1));
      const heading = headings.find(item => item.text.replace(/\s+/g, '-').toLowerCase() === wanted || item.id === wanted || item.text === wanted);
      if (heading) { link.href = '#'; link.onclick = event => { event.preventDefault(); document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' }); }; }
      return;
    }
    const path = new URL(original.split('#')[0], 'https://local.invalid/' + lesson.file).pathname.slice(1);
    const next = catalog.lessons.find(item => item.file === path);
    if (next) link.href = href(next.id);
    else if (path === 'README.md') link.href = '#/';
    else if (files['../' + path]) {
      link.classList.add('source-link');
      link.href = repo + '/blob/main/' + path;
      link.onclick = event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); openFile(path);
      };
    }
    else if (path && !original.startsWith('mailto:')) link.href = repo + '/blob/main/' + path;
  });
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('code.language-mermaid')) return;
    const wrapper = document.createElement('div'); wrapper.className = 'code-block'; pre.replaceWith(wrapper);
    const language = pre.querySelector('code')?.className.match(/language-(\S+)/)?.[1] || 'TEXT';
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar'; toolbar.innerHTML = `<span>${esc(language)}</span><button type="button">复制</button>`;
    toolbar.querySelector('button').onclick = () => copyText(pre.textContent); wrapper.append(toolbar, pre);
  });
  container.querySelectorAll('table').forEach(table => { const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0; table.replaceWith(wrapper); wrapper.append(table); });
  return headings;
}

function evidenceCard(experiment) {
  const stats = experiment.stats || {};
  const compaction = experiment.requestKind === 'compaction';
  const interrupted = experiment.status === 'interrupted';
  const reply = experiment.reply || (interrupted ? '本轮已中断，没有最终回复。' : '本记录没有最终回复。');
  const conversation = compaction
    ? '<p class="compaction-note">这是 Desktop 原生压缩操作，没有普通聊天输入和最终聊天回复。可分别核对压缩请求、模型输出，以及本地记录的替换历史。</p>'
    : `<div class="experiment-conversation"><div><span>输入</span><p>${esc(experiment.prompt)}</p></div><div><span>${interrupted ? (experiment.reply ? '中断前输出' : '回复状态') : '回复'}</span><p>${esc(reply)}</p></div></div>`;
  return `<details class="experiment"><summary><span class="experiment-icon">↳</span><span><strong>${esc(experiment.title)}${interrupted ? '<span class="interrupted-badge">已中断</span>' : ''}</strong><small>${stats.requests != null ? esc(stats.requests) + (compaction ? ' 次压缩请求' : ' 次正式请求') : '实验记录'}${stats.prewarms ? ' · ' + esc(stats.prewarms) + ' 次预热' : ''}${stats.toolCalls != null ? ' · ' + esc(stats.toolCalls) + ' 次工具调用' : ''}</small></span><span class="chevron">+</span></summary><div class="experiment-body">${interrupted ? '<p class="interruption-note">这次用户任务已中断。下列完成事件仅表示对应模型响应结束，不表示工具或整个任务成功完成。</p>' : ''}${conversation}${experiment.notes?.length ? `<ul class="experiment-notes">${experiment.notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}<div class="stage-list">${(experiment.stages || []).map((stage, index) => `<button data-experiment="${esc(experiment.id)}" data-stage="${index}"><span>${String(index + 1).padStart(2, '0')}</span><span>${esc(stageLabel(stage, experiment.requestKind))}</span><span>查看请求与响应 ↗</span></button>`).join('')}</div><p class="experiment-id">任务 ${esc(experiment.threadId || '未记录')}</p></div></details>`;
}

async function renderLesson(lesson, renderTicket) {
  const main = document.querySelector('#main');
  main.innerHTML = '<div class="loading-state">正在打开这一章…</div>';
  const markdown = await loadFile(lesson.file);
  if (renderTicket !== ticket) return;
  const index = catalog.lessons.indexOf(lesson);
  const group = catalog.groups.find(item => item.id === lesson.group);
  const evidence = (lesson.evidenceIds || []).map(id => experiments.find(item => item.id === id)).filter(Boolean);
  const minutes = lesson.minutes || Math.max(1, Math.ceil(markdown.replace(/```[\s\S]*?```/g, '').length / 500));
  main.innerHTML = `<div class="reader-layout"><div class="reader-column"><div class="breadcrumb"><a href="#/">学习路线</a><span>/</span><span>${esc(group?.title || '')}</span></div><header class="lesson-header"><div class="eyebrow">CHAPTER ${number(lesson)} <span>—</span> ${esc(group?.title || '实验手记')}</div><h1>${esc(lesson.title)}</h1>${lesson.subtitle ? `<p class="lesson-subtitle">${esc(lesson.subtitle)}</p>` : ''}<div class="lesson-meta">${status(lesson)}<span>阅读约 ${minutes} 分钟</span>${evidence.length ? `<button data-evidence-jump>${evidence.length} 份实验记录 ↓</button>` : ''}<a href="${repo}/blob/main/${lesson.file}" target="_blank" rel="noopener" aria-label="在 GitHub 查看本章 Markdown">查看原文 ↗</a></div></header><article class="prose">${DOMPurify.sanitize(marked.parse(markdown.replace(/^# [^\n]+\n/, '')))}</article>${evidence.length ? `<section class="lesson-evidence" id="chapter-evidence"><div class="eyebrow">FOLLOW THE EVIDENCE / 核对证据</div><h2>回到这一次真实实验</h2><p>展开对话，或逐次查看请求与响应。记录中的省略与脱敏以文件说明为准。</p>${evidence.map(evidenceCard).join('')}</section>` : ''}<nav class="lesson-pagination" aria-label="相邻章节">${catalog.lessons[index - 1] ? `<a href="${href(catalog.lessons[index - 1].id)}"><small>← 上一章</small><strong>${esc(catalog.lessons[index - 1].title)}</strong></a>` : '<a href="#/"><small>← 回到起点</small><strong>浏览完整学习路线</strong></a>'}${catalog.lessons[index + 1] ? `<a href="${href(catalog.lessons[index + 1].id)}"><small>下一章 →</small><strong>${esc(catalog.lessons[index + 1].title)}</strong></a>` : `<a href="${repo}" target="_blank" rel="noopener"><small>带着问题继续 →</small><strong>分享实验与改进建议</strong></a>`}</nav><p class="reader-note">读完是开始，能够用另一份证据独立解释，才是掌握。</p></div><aside class="page-toc" aria-label="本章目录"></aside></div>`;
  const headings = decorateMarkdown(main.querySelector('.prose'), lesson);
  main.querySelector('.page-toc').innerHTML = `<span class="eyebrow">在这一章</span>${headings.filter(heading => heading.level === 'H2').map(heading => `<a href="#" data-scroll="${heading.id}">${esc(heading.text)}</a>`).join('')}${evidence.length ? '<a href="#" data-scroll="chapter-evidence">核对实验记录</a>' : ''}<div class="toc-bottom">从界面到日志，<br>让每个判断都有出处。</div>`;
  main.querySelectorAll('[data-scroll]').forEach(link => link.onclick = event => { event.preventDefault(); document.getElementById(link.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }); });
  main.querySelector('[data-evidence-jump]')?.addEventListener('click', () => document.querySelector('#chapter-evidence').scrollIntoView({ behavior: 'smooth' }));
  main.querySelectorAll('[data-experiment]').forEach(button => button.onclick = () => openEvidence(button.dataset.experiment, Number(button.dataset.stage)));
  main.querySelectorAll('.experiment').forEach((card, index) => {
    const manifest = evidence[index].manifestFile;
    if (!manifest) return;
    const button = document.createElement('button');
    button.className = 'manifest-link'; button.textContent = '实验来源与脱敏说明 ↗';
    button.onclick = () => openFile(manifest);
    card.querySelector('.experiment-body').append(button);
  });
  const diagrams = main.querySelectorAll('code.language-mermaid');
  if (diagrams.length) {
    const { default: mermaid } = await import('mermaid');
    if (renderTicket !== ticket) return;
    diagrams.forEach(code => { const diagram = document.createElement('div'); diagram.className = 'mermaid'; diagram.textContent = code.textContent; code.parentElement.replaceWith(diagram); });
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral', fontFamily: 'sans-serif' });
    try { await mermaid.run({ nodes: main.querySelectorAll('.mermaid') }); }
    catch (error) { console.error('图表渲染失败', error); throw error; }
  }
}

async function renderRoute() {
  const renderTicket = ++ticket;
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  currentLesson = parts[0] === 'lesson' ? catalog.lessons.find(lesson => lesson.id === decodeURIComponent(parts[1] || '')) : null;
  document.body.classList.toggle('is-reader', Boolean(currentLesson)); toggleMenu(false); renderSidebar();
  document.title = currentLesson ? currentLesson.title + ' · Agent Harness Notes' : '从「你好」到理解 Agent · Agent Harness Notes';
  const main = document.querySelector('#main');
  main.dataset.lessonId = currentLesson?.id || '';
  main.setAttribute('aria-busy', 'true');
  window.scrollTo({ top: 0, behavior: 'instant' });
  try {
    if (parts[0] === 'lesson' && !currentLesson) document.querySelector('#main').innerHTML = '<div class="error-state"><span class="eyebrow">404 / CHAPTER NOT FOUND</span><h1>这一章暂时找不到。</h1><p>章节路径可能已更新，请从学习路线重新进入。</p><a class="button button-primary" href="#/">返回教程首页 →</a></div>';
    else if (currentLesson) await renderLesson(currentLesson, renderTicket);
    else renderHome();
  } catch (error) { if (renderTicket === ticket) document.querySelector('#main').innerHTML = `<div class="error-state"><h1>这一章没有成功加载。</h1><p>${esc(error.message)}</p><a class="button button-primary" href="#/">返回学习路线 →</a></div>`; }
  if (renderTicket === ticket) main.setAttribute('aria-busy', 'false');
  updateProgress();
}

async function openSearch() {
  const dialog = document.querySelector('#search-dialog'); if (!dialog.open) dialog.showModal();
  document.querySelector('#search-input').focus(); showSearchResults();
  if (!searchTexts) {
    searchTexts = await Promise.all(catalog.lessons.map(async lesson => {
      try { return { lesson, text: (await loadFile(lesson.file)).replace(/[#>*`|]/g, '').replace(/\n+/g, ' ') }; }
      catch { return { lesson, text: '' }; }
    }));
    showSearchResults();
  }
}

function showSearchResults() {
  const query = document.querySelector('#search-input').value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const source = searchTexts || catalog.lessons.map(lesson => ({ lesson, text: '' }));
  const results = source.filter(({ lesson, text }) => terms.every(term => `${lesson.title} ${lesson.subtitle || ''} ${text}`.toLowerCase().includes(term)));
  const target = document.querySelector('#search-results');
  target.innerHTML = `<p class="search-count">${query ? `找到 ${results.length} 个相关章节` : '全部章节 · 选择你的第一个问题'}</p>${results.length ? results.map(({ lesson, text }) => {
    const position = query ? text.toLowerCase().indexOf(terms[0]) : -1;
    const preview = position >= 0 ? (position > 22 ? '…' : '') + text.slice(Math.max(0, position - 22), position + 90) + '…' : lesson.subtitle;
    return `<a class="search-result" href="${href(lesson.id)}"><span>${number(lesson)}</span><div><strong>${esc(lesson.title)}</strong><p>${esc(preview || '')}</p></div><span>↗</span></a>`;
  }).join('') : '<div class="empty-state">还没有匹配的章节。试试更短的关键词。</div>'}`;
  target.querySelectorAll('a').forEach(link => link.onclick = () => document.querySelector('#search-dialog').close());
}

function showDialog() {
  const dialog = document.querySelector('#evidence-dialog'); if (!dialog.open) dialog.showModal();
  return document.querySelector('#evidence-content');
}

async function openEvidence(id, stageIndex) {
  const experiment = experiments.find(item => item.id === id); if (!experiment?.stages?.[stageIndex]) return;
  evidenceState = { experiment, stageIndex, kind: 'requestFile' };
  document.querySelector('#evidence-title').textContent = experiment.title; await renderEvidence();
}

async function renderEvidence() {
  const state = evidenceState;
  const stage = { ...state.experiment.stages[state.stageIndex], compactionFile: state.experiment.compactionFile, interruptionFile: state.experiment.interruptionFile };
  const kinds = [['requestFile', '请求'], ['outputItemsFile', '输出项'], ['responseFile', '完成事件'], ['eventsFile', '流式事件'], ['upstreamFile', 'CPA 上游'], ['compactionFile', '压缩记录'], ['interruptionFile', '中断记录']].filter(([key]) => stage[key]);
  if (!stage[state.kind]) state.kind = kinds[0]?.[0];
  const path = stage[state.kind];
  const content = showDialog();
  const provenance = state.kind === 'outputItemsFile' ? '由事件提取的输出项 · 非原始完成事件' : state.kind === 'compactionFile' ? '本地 rollout 压缩事件 · 已脱敏' : state.kind === 'interruptionFile' ? '本地 rollout 中断事件 · 已脱敏' : state.kind === 'responseFile' && state.experiment.status === 'interrupted' ? '单次模型完成事件 · 不代表用户任务完成' : '来源快照 · 已脱敏 · 保留原有结构';
  content.innerHTML = `<div class="evidence-controls"><label>请求 <select id="evidence-stage">${state.experiment.stages.map((item, index) => `<option value="${index}" ${index === state.stageIndex ? 'selected' : ''}>${index + 1}. ${esc(stageLabel(item, state.experiment.requestKind))}</option>`).join('')}</select></label><div class="evidence-tabs" role="tablist" aria-label="证据类型">${kinds.map(([key, label]) => `<button role="tab" aria-selected="${state.kind === key}" tabindex="${state.kind === key ? 0 : -1}" data-kind="${key}" class="${state.kind === key ? 'active' : ''}">${label}</button>`).join('')}</div></div><div class="evidence-file"><span>${esc(path || '没有可用记录')}</span><button id="copy-evidence">复制</button></div><pre class="evidence-code" tabindex="0">正在加载记录…</pre><div class="evidence-footer"><span>${provenance}</span><a id="download-evidence">下载文件 ↓</a></div>`;
  document.querySelector('#evidence-stage').onchange = event => { evidenceState = { ...state, stageIndex: Number(event.target.value) }; renderEvidence(); };
  content.querySelectorAll('[data-kind]').forEach(button => button.onclick = () => { evidenceState = { ...state, kind: button.dataset.kind }; renderEvidence(); });
  content.querySelector('.evidence-tabs').onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = kinds.findIndex(([key]) => key === state.kind);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? kinds.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + kinds.length) % kinds.length;
    evidenceState = { ...state, kind: kinds[next][0] };
    renderEvidence();
    content.querySelector(`[data-kind="${kinds[next][0]}"]`).focus();
  };
  try {
    if (!path) throw new Error('本次实验未提供请求快照。');
    const raw = await loadFile(path); if (state !== evidenceState) return;
    content.querySelector('.evidence-code').textContent = raw;
    content.querySelector('#copy-evidence').onclick = () => copyText(raw);
    setupDownload(content.querySelector('#download-evidence'), path, raw);
  } catch (error) { if (state === evidenceState) content.querySelector('.evidence-code').textContent = error.message; }
}

async function openFile(path) {
  const state = {}; evidenceState = state;
  document.querySelector('#evidence-title').textContent = path.split('/').at(-1);
  const content = showDialog();
  content.innerHTML = `<div class="evidence-file"><span>${esc(path)}</span><button id="copy-evidence">复制</button></div><pre class="evidence-code" tabindex="0">正在加载…</pre><div class="evidence-footer"><span>来源文件 · 保留原有结构</span><a id="download-evidence">下载文件 ↓</a></div>`;
  try {
    const raw = await loadFile(path); if (state !== evidenceState) return;
    content.querySelector('.evidence-code').textContent = raw;
    content.querySelector('#copy-evidence').onclick = () => copyText(raw);
    setupDownload(content.querySelector('#download-evidence'), path, raw);
  } catch (error) { if (state === evidenceState) content.querySelector('.evidence-code').textContent = error.message; }
}

function setupDownload(link, path, raw) {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(new Blob([raw], { type: path.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8' }));
  link.href = downloadUrl; link.download = path.split('/').at(-1);
}

let toastTimer;
async function copyText(text) {
  const toast = document.querySelector('.toast');
  try { await navigator.clipboard.writeText(text); toast.textContent = '已复制'; } catch { toast.textContent = '复制失败，请选中文字后手动复制。'; }
  toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function updateProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.querySelector('.reading-progress').style.width = currentLesson && max > 0 ? (scrollY / max * 100) + '%' : '0%';
  const active = [...document.querySelectorAll('.prose h2, #chapter-evidence')].filter(section => section.getBoundingClientRect().top < 160).at(-1);
  document.querySelectorAll('.page-toc a').forEach(link => link.classList.toggle('active', link.dataset.scroll === active?.id));
}

async function start() {
  try {
    if (files['../course/catalog.json']) catalog = JSON.parse(await loadFile('course/catalog.json'));
    if (files['../evidence/desktop-lab/index.json']) experiments = JSON.parse(await loadFile('evidence/desktop-lab/index.json')).experiments || [];
  } catch (error) { console.error('课程索引加载失败', error); }
  shell();
  addEventListener('hashchange', renderRoute);
  addEventListener('scroll', updateProgress, { passive: true });
  await renderRoute();
}
start();
