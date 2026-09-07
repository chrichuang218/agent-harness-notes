import {marked} from 'marked';
import DOMPurify from 'dompurify';
import './style.css';
const raw=import.meta.glob('../lessons/01-codex-cpa-trace/**/*.json',{query:'?raw',import:'default',eager:true});
const docs=import.meta.glob('../lessons/01-codex-cpa-trace/**/*.md',{query:'?raw',import:'default',eager:true});
const prefix='../lessons/01-codex-cpa-trace/';
const names=['00-prewarm','01-turn1-read-skill','02-turn1-final','03-turn2-read-skill','04-turn2-find-context','05-turn2-final'];
const titles=['预热与准备','初始上下文与技能发现','工具结果与第一轮回答','跨轮接续与显式技能','技能正文与背景搜索','搜索结果与最终回答'];
const subtitles=['先准备好工具与指令，再等待用户输入。','你的一句话，如何成为一次完整的模型请求。','把真实执行结果交回模型，完成第一轮对话。','新问题如何引用历史，而不是从空白开始。','加载技能说明之后，Agent 如何寻找真实背景。','一次没有匹配结果的搜索，怎样影响最终回答。'];
const kinds=['request','response','upstream','events'];
const labels={request:'请求',response:'响应',upstream:'上游',events:'事件'};
let step=1,tab='request',compare=false,view='lesson';
let workbenchFull=false,workbenchScroll=0;
let renderId=0;
let readerHeadings=[],scrollSpyQueued=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function data(i,k){return JSON.parse(raw[prefix+'evidence/'+names[i]+'-'+k+'.json']);}
function href(i,k='request'){return '#step/'+i+'/'+k;}
const app=document.querySelector('#app');
app.innerHTML='<header><a class="brand" href="#step/1/request"><span class="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M10 9h7a6 6 0 0 1 6 6v8M9 9v14h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="5" width="8" height="8" rx="2" fill="var(--brand-node-fill)" stroke="currentColor" stroke-width="2"/><rect x="19" y="19" width="8" height="8" rx="2" fill="var(--brand-node-fill)" stroke="currentColor" stroke-width="2"/></svg></span><span class="brand-title">Agent Harness<span class="brand-light">学习笔记</span></span></a><a class="header-link" href="#guide">完整讲义 <span>↗</span></a><button id="menu" aria-label="展开课程导航">☰</button></header><aside class="sidebar"><div class="side-label">学习路径 <span>01</span></div><a class="overview" href="#guide">◈ &nbsp; 两轮对话，看懂运行机制</a><div class="course-label">第一节 · CODEX × CPA</div><nav id="steps"></nav></aside><div class="layout"><main id="main"></main><aside id="toc"></aside></div>';
document.querySelector('#steps').innerHTML=titles.map((t,i)=>'<a class="step-link" data-step="'+i+'" href="'+href(i)+'"><span class="step-no">'+String(i).padStart(2,'0')+'</span><span>'+t+'</span><span class="step-arrow">›</span></a>').join('');
document.querySelector('#menu').onclick=()=>toggleSidebar();
function jsonHtml(obj){
 const str=JSON.stringify(obj,null,2);
 return esc(str).replace(/(&quot;.*?&quot;)(\s*:)?|\b(true|false|null)\b|\b(\d+)\b/g,(m,s,colon,b,n)=>{
 if(s){const value=s.slice(6,-6);if(!colon&&(value.startsWith('resp_')||value.startsWith('call_'))){let target=-1;for(let i=0;i<6;i++){const r=data(i,'response');if(r.id===value||(r.output||[]).some(x=>x.call_id===value)){target=i;break;}}if(target>=0)return '<a class="json-id" href="'+href(target,'response')+'" title="跳到对应响应">'+s+'</a>';}
 return '<span class="'+(colon?'json-key':'json-string')+'">'+s+'</span>'+(colon||'');}
 return '<span class="json-value">'+m+'</span>';});
}
function focus(obj,k){
 if(k==='events')return obj.filter(x=>['response.create','response.completed'].includes(x.type)).map(x=>x.type==='response.create'?{type:x.type,previous_response_id:x.previous_response_id,input:x.input.map(y=>({type:y.type,role:y.role,call_id:y.call_id}))}:{type:x.type,id:x.response.id,status:x.response.status});
 if(k==='response')return {id:obj.id,status:obj.status,output:(obj.output||[]).map(x=>x.type==='reasoning'?{type:x.type,summary:x.summary}:x),usage:{input_tokens:obj.usage?.input_tokens,cached_tokens:obj.usage?.input_tokens_details?.cached_tokens,output_tokens:obj.usage?.output_tokens}};
 return {type:obj.type,model:obj.model,previous_response_id:obj.previous_response_id,...(obj.generate===false?{generate:false}:{}),input:obj.input.map(x=>x.type==='additional_tools'?{type:x.type,role:x.role,note:'工具定义已折叠；切换「完整 JSON」查看'}:x.type==='message'?(step===1&&x!==obj.input.at(-1)?{type:x.type,role:x.role,content:x.content.map(c=>({type:c.type,text:(c.text||'').slice(0,160)+' …'}))}:x):x)};
}
function panel(){
 const obj=data(step,tab),full=document.querySelector('#full')?.checked;
 const shown=full?obj:focus(obj,tab);
 document.querySelector('#filename').textContent=names[step]+'-'+tab+'.json';
 document.querySelector('#code').innerHTML=jsonHtml(shown);
 document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',b.dataset.tab===tab);});
 const box=document.querySelector('#compare-code');box.hidden=!compare;
 if(compare)box.innerHTML='<div class="compare-label">CPA → 上游 · '+(full?'完整 JSON':'重点字段')+'</div><pre>'+jsonHtml(full?data(step,'upstream'):focus(data(step,'upstream'),'upstream'))+'</pre>';
 document.querySelector('#code-grid').classList.toggle('comparing',compare);
 document.querySelector('#compare').classList.toggle('enabled',compare);
 document.querySelector('#json-note').textContent=full?'完整请求或响应快照。ID 链接可跳到对应响应。':'重点视图：省略部分字段，长指令仅展示开头。完整数据请切换「完整 JSON」。';
}
function handleDocLinks(container){
 container.querySelectorAll('a').forEach(a=>{
 let h=a.getAttribute('href')||'';try{h=decodeURI(h)}catch{}
 if(h.startsWith('http')){a.target='_blank';a.rel='noopener';return;}
 const match=names.findIndex(n=>h.includes(n));
 if(match>=0){a.href=href(match,kinds.find(k=>h.includes('-'+k+'.json'))||'request');return;}
 const st=h.match(/steps\/(\d+)\.md/);if(st){a.href=href(Number(st[1]));return;}
 if(h.endsWith('.json')){const key=Object.keys(raw).find(k=>k.endsWith('/'+h.split('/').pop()));if(key){a.href=URL.createObjectURL(new Blob([raw[key]],{type:'application/json'}));a.target='_blank';return;}}
 if(h.endsWith('学习文档.md'))a.href='#guide';else if(h.endsWith('交互原文.md'))a.href='#transcript';else if(h.endsWith('README.md'))a.href='#step/1/request';else if(h.endsWith('AGENTS-injected.txt'))a.href=href(1);
 });
}
async function render(){
 const ticket=++renderId;
 document.body.classList.remove('menu-open');
 document.querySelectorAll('.step-link').forEach(x=>x.classList.toggle('selected',view==='lesson'&&Number(x.dataset.step)===step));
 const main=document.querySelector('#main');
 if(view!=='lesson'){
 const file=view==='guide'?'学习文档.md':'交互原文.md';
 main.innerHTML='<div class="breadcrumb">学习手册 <span>/</span> 第一节 <span>/</span> '+(view==='guide'?'完整讲义':'交互原文')+'</div><article class="prose">'+DOMPurify.sanitize(marked.parse(docs[prefix+file]))+'</article>';
 handleDocLinks(main);
 const headings=[...main.querySelectorAll('h2')];headings.forEach((h,i)=>h.id='section-'+i);
 document.querySelector('#toc').innerHTML='';
 main.querySelectorAll('code.language-mermaid').forEach(c=>{const p=document.createElement('div');p.className='mermaid';p.textContent=c.textContent;c.parentElement.replaceWith(p)});
 if(main.querySelector('.mermaid')){const {default:mermaid}=await import('mermaid');if(ticket!==renderId)return;mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',fontFamily:'Arial, Microsoft YaHei, sans-serif'});try{await mermaid.run({nodes:main.querySelectorAll('.mermaid')});}catch(e){console.error(e);}}
 return;
 }
 const req=data(step,'request'),res=data(step,'response');
 const rawMd=docs[prefix+'steps/'+String(step).padStart(2,'0')+'.md'];
 const point=rawMd.split('## 观察重点')[1].split('## 并排打开')[0].trim();
 main.innerHTML='<div class="breadcrumb">学习手册 <span>/</span> Codex × CPA <span>/</span> 阶段 '+String(step).padStart(2,'0')+'</div><div class="eyebrow">LESSON 01 <span>真实链路拆解</span></div><h1>'+titles[step]+'</h1><p class="lede">'+subtitles[step]+'</p><div class="meta"><span>阶段 '+step+' / 5</span><span>'+ (step<=2?'第一轮对话':'第二轮对话')+'</span></div><section id="understand"><h2><span class="section-mark">01</span> 这一阶段，发生了什么</h2><p>'+esc(point)+'</p><div class="flow"><div><span class="node-icon">⌘</span><strong>Codex App Server</strong><small>组织上下文 · 调度工具</small></div><span class="flow-arrow">→</span><div><span class="node-icon">⇄</span><strong>本地 CPA</strong><small>转发请求与响应</small></div><span class="flow-arrow">→</span><div><span class="node-icon">✳</span><strong>上游服务与模型</strong><small>接续历史 · 生成输出</small></div></div><div class="callout"><span>↳</span><p><strong>'+(req.previous_response_id?'上下文接续，而不是重新开始':'从初始上下文开始')+'</strong><br>'+(req.previous_response_id?'这次仅新增 '+req.input.length+' 项输入，通过 previous_response_id 关联之前的上下文。':'请求中包含 '+req.input.length+' 项输入。工具定义、规则与用户问题各有自己的位置。')+'</p></div></section><section id="evidence"><div class="section-row"><h2><span class="section-mark">02</span> 对照真实数据</h2></div><div class="inspector"><div class="tabs" role="tablist">'+kinds.map(k=>'<button class="tab" role="tab" data-tab="'+k+'">'+labels[k]+'</button>').join('')+'<button id="compare">⇄ 对比上游</button></div><div class="code-toolbar"><span id="filename"></span><div><label><input type="checkbox" id="full"> 完整 JSON</label><button id="copy" aria-label="复制JSON">复制</button></div></div><div class="code-search"><input id="find" placeholder="搜索字段或 ID，例如 call_id" aria-label="搜索JSON"><button id="find-next">查找</button><span id="find-status"></span></div><div id="code-grid"><pre id="code" tabindex="0"></pre><div id="compare-code" hidden></div></div><div id="json-note"></div></div></section>';
 document.querySelector('#toc').innerHTML='';
 const fullState=workbenchFull;
 document.querySelector('#full').checked=fullState;
 document.querySelector('#evidence').insertAdjacentHTML('afterbegin','<div class="request-navigation"><button id="request-prev" '+(step===0?'disabled':'')+'>← 上一次请求</button><label>当前请求 <select id="request-stage">'+titles.map((t,i)=>'<option value="'+i+'" '+(i===step?'selected':'')+'>'+String(i).padStart(2,'0')+' · '+t+'</option>').join('')+'</select></label><button id="request-next" '+(step===5?'disabled':'')+'>下一次请求 →</button></div>');
 const changeRequest=i=>{workbenchFull=document.querySelector('#full').checked;workbenchScroll=scrollY;location.hash=href(i,tab);};
 document.querySelector('#request-prev').onclick=()=>changeRequest(step-1);
 document.querySelector('#request-next').onclick=()=>changeRequest(step+1);
 document.querySelector('#request-stage').onchange=e=>changeRequest(+e.target.value);
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;history.replaceState(null,'',href(step,tab));panel()});
 document.querySelector('#full').onchange=()=>{workbenchFull=document.querySelector('#full').checked;panel()};
 document.querySelector('#compare').onclick=()=>{compare=!compare;panel()};
 document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(data(step,tab),null,2));document.querySelector('#copy').textContent='已复制';}catch{document.querySelector('#copy').textContent='复制失败';}};
 document.querySelector('#find-next').onclick=()=>{const term=document.querySelector('#find').value.trim();panel();if(!term)return;const pre=document.querySelector('#code');const walker=document.createTreeWalker(pre,NodeFilter.SHOW_TEXT);let node,count=0,first;const hits=[];while(node=walker.nextNode()){let pos=node.textContent.toLowerCase().indexOf(term.toLowerCase());if(pos>=0)hits.push([node,pos]);}for(const [n,pos] of hits){const range=document.createRange();range.setStart(n,pos);range.setEnd(n,pos+term.length);const mark=document.createElement('mark');range.surroundContents(mark);first ||=mark;count++;}document.querySelector('#find-status').textContent=count?'找到 '+count+' 处':'当前视图无匹配';first?.scrollIntoView({block:'nearest'});};
 document.querySelector('#find').onkeydown=e=>{if(e.key==='Enter')document.querySelector('#find-next').click()};
 panel();
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-scroll]');if(a){e.preventDefault();document.getElementById(a.dataset.scroll)?.scrollIntoView({behavior:'smooth'});}});
function route(){
 const hash=location.hash;
 const ch=hash.match(/^#chapter\/(\d+)/);
 const oldStep=hash.match(/^#step\/([0-5])(?:\/(request|response|upstream|events))?/);
 if(hash.startsWith('#reader-section-')||hash.startsWith('#section-'))return;
 if(oldStep){openEvidence(+oldStep[1],oldStep[2]||'request');return;}
 if(hash==='#transcript'){
  history.replaceState(null,'',chapterHref(chapter));
  renderReader().then(()=>oldStep?openEvidence(+oldStep[1],oldStep[2]||'request'):openTranscript());
  return;
 }
 document.querySelector('#evidence-dialog')?.close();
 chapter=ch?Math.min(+ch[1],chapters.length-1):0;
 renderReader();window.scrollTo(0,0);
}
const chapterSource=docs[prefix+'学习文档.md'];
const sourceChapters=chapterSource.split(/(?=^## \d+\.)/m).slice(1);
const lessonSections=[
 {title:'认识运行架构',sources:[1,0]},
 {title:'查看请求与日志',sources:[8,7,2]},
 {title:'跟踪工具与技能调用',sources:[3,4,5]},
 {title:'理解上下文接续',sources:[6,10]},
 {title:'回顾完整执行流程',sources:[9]}
];
const readingOrder=[{source:8,title:'Codex 的一次完整运行'}];
const chapterTitles=['Codex 的一次完整运行'];
const chapters=['## 1. Codex 的一次完整运行\n\n'+lessonSections.map(group=>
 '## '+group.title+'\n\n'+group.sources.map(n=>sourceChapters[n]
 .replace(/^### /gm,'#### ')
 .replace(/^## \d+\.[^\n]*/,'')
 .trim()).join('\n\n')).join('\n\n')];
let chapter=0,dialogStage=1,dialogTab='request',dialogFull=false;
function chapterHref(i){return '#chapter/'+i;}
function readerChrome(){
 document.body.classList.add('reading');
 document.querySelector('.brand').href='#chapter/0';

 document.querySelector('.header-link').outerHTML='<button class="header-link theme-toggle" aria-label="切换深浅色">◐ 阅读主题</button>';
 document.querySelector('.theme-toggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('harness-theme',document.body.classList.contains('dark')?'dark':'light');};
 document.body.classList.toggle('dark',localStorage.getItem('harness-theme')==='dark');
 document.querySelector('.sidebar').innerHTML='<div class="directory-search"><span aria-hidden="true">⌕</span><input id="chapter-search" aria-label="搜索文档" placeholder="搜索文档…"></div><div class="chapter-group">基础入门</div><nav id="chapter-nav">'+chapterTitles.map((t,i)=>(readingOrder[i].group?'<div class=\"reading-group">'+esc(readingOrder[i].group)+'</div>':'')+'<a class="chapter-link" href="'+chapterHref(i)+'" data-chapter="'+i+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+esc(t)+'</a>').join('')+'</nav>';
 installSidebarToggle();
 document.querySelector('#chapter-search').oninput=e=>{const q=e.target.value.trim().toLowerCase();if(q){const outline=document.querySelector('.chapter-outline');if(outline)outline.hidden=false;document.querySelector('.chapter-link')?.setAttribute('aria-expanded','true');document.body.classList.remove('lesson-outline-closed');}document.querySelectorAll('.chapter-outline a').forEach(a=>{let h=document.getElementById(a.dataset.scroll),text=h?.textContent||'';for(let n=h?.nextElementSibling;n&&n.tagName!=='H2';n=n.nextElementSibling)text+=' '+n.textContent;a.hidden=!!q&&!text.toLowerCase().includes(q);});};
 if(!document.querySelector('#back-top'))document.body.insertAdjacentHTML('beforeend','<button id="back-top" aria-label="回到顶部">↑</button><dialog id="evidence-dialog" aria-labelledby="evidence-title"></dialog>');
 document.querySelector('#back-top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
 const d=document.querySelector('#evidence-dialog');d.onclick=e=>{if(e.target===d)d.close()};
}
function formatHarnessCode(root){
 root.querySelectorAll('pre > code.language-harness').forEach(code=>{
  const lines=code.textContent.trimEnd().split('\n');
  const panel=document.createElement('section');
  panel.className='harness-code';
  panel.setAttribute('aria-label','Agent 循环伪代码');
  panel.innerHTML='<div class="harness-code-header"><span>Agent 循环</span><span>伪代码</span></div><pre><code>'+lines.map((line,index)=>{
   const indent=line.match(/^ */)[0].length;
   const text=esc(line.slice(indent)).replace(/\b(while|if|else|break|True)\b/g,'<span class="pseudo-keyword">$1</span>').replace(/AGENTS\.md|call_id/g,'<span class="pseudo-symbol">$&</span>').replace(/（.*?）/g,'<span class="pseudo-comment">$&</span>');
   const guides='<span class="pseudo-indent" aria-hidden="true"></span>'.repeat(Math.floor(indent/4));
   return '<span class="pseudo-line"><span class="pseudo-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span><span class="pseudo-source">'+guides+text+'</span></span>';
  }).join('')+'</code></pre>';
  code.parentElement.replaceWith(panel);
 });
}

async function renderReader(){
 const ticket=++renderId;
 if(!document.querySelector('#chapter-nav'))readerChrome();
 document.body.classList.add('reading');document.body.classList.remove('menu-open');
 document.querySelectorAll('.chapter-link').forEach((a,i)=>a.classList.toggle('active',i===chapter));
 const main=document.querySelector('#main');
 main.innerHTML='<div class="reader-crumb">第一节 <span>/</span> Codex + CPA 实测</div><article class="prose reader-article">'+DOMPurify.sanitize(marked.parse(chapters[chapter].replace(/^## (\d+)\.\s*(.+)/,'# $1. $2')) )+'</article>';
 formatHarnessCode(main);
 if(readingOrder[chapter].source===8){
 const article=main.querySelector('.reader-article');
 article.insertAdjacentHTML('beforeend','<section id="inline-transcript"><h2>交互原文</h2><div class="inline-conversation" tabindex="0" role="region" aria-label="交互原文，可滚动查看"></div></section><section id="inline-workbench"><h2>证据工作台</h2><div id="inline-inspector"></div></section>');
 }
 if(readingOrder[chapter].source===8){
  main.querySelector('.inline-conversation').innerHTML=transcriptMarkup();
  main.querySelectorAll('.conversation-tool').forEach(d=>d.open=false);
  main.querySelectorAll('[data-trace]').forEach(b=>b.onclick=e=>{e.preventDefault();openEvidence(Math.max(0,+b.dataset.trace),'response')});
  inlineWorkbench();
 }
 main.querySelectorAll('a').forEach(a=>{
 let h=a.getAttribute('href')||'';try{h=decodeURI(h)}catch{}
 if(h.startsWith('#'))return;
 if(h.startsWith('http')){a.target='_blank';a.rel='noopener';return;}
 const stage=names.findIndex(n=>h.includes(n));
 if(stage>=0){const k=kinds.find(x=>h.includes('-'+x+'.json'))||'request';a.href=href(stage,k);a.classList.add('evidence-link');a.onclick=e=>{e.preventDefault();openEvidence(stage,k)};return;}
 if(h.endsWith('交互原文.md')){a.href='#transcript';a.onclick=e=>{e.preventDefault();openTranscript()};return;}
 if(h.endsWith('.json')||h.endsWith('.txt')){
 a.href='#';a.onclick=e=>{e.preventDefault();const key=Object.keys(raw).find(k=>k.endsWith('/'+h.split('/').pop()));if(key)openRaw(h.split('/').pop(),raw[key]);else openEvidence(1,'request');};return;
 }
 if(h.endsWith('README.md')){a.href='#chapter/0';return;}
 a.title='打开原始链接';
 });
 const heads=[...main.querySelectorAll('.reader-article > h2')];heads.forEach((h,i)=>h.id='reader-section-'+i);
 syncChapterOutline(heads);
 document.querySelector('#toc').innerHTML='';
 main.querySelectorAll('code.language-mermaid').forEach(c=>{const d=document.createElement('div');d.className='mermaid';d.textContent=c.textContent;c.parentElement.replaceWith(d)});
 if(main.querySelector('.mermaid')){const {default:mermaid}=await import('mermaid');if(ticket!==renderId)return;mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',fontFamily:'Arial, Microsoft YaHei, sans-serif'});try{await mermaid.run({nodes:main.querySelectorAll('.mermaid')})}catch(e){console.error(e)}}
}
function openRaw(name,text){
 const d=document.querySelector('#evidence-dialog');
 d.innerHTML='<div class="dialog-heading"><div><small>原始证据</small><h2 id="evidence-title">'+esc(name)+'</h2></div><button class="dialog-close" aria-label="关闭证据">✕</button></div><pre class="dialog-code">'+esc(text)+'</pre>';
 d.querySelector('.dialog-close').onclick=()=>d.close();if(!d.open)d.showModal();
}
function unusedEvidenceModal(i,k){
 dialogStage=i;dialogTab=k;
 const d=document.querySelector('#evidence-dialog');
 const obj=data(i,k),old=step;step=i;const chosen=dialogFull?obj:focus(obj,k);step=old;
 d.innerHTML='<div class="dialog-heading"><div><small>第一节 / 阶段 '+String(i).padStart(2,'0')+'</small><h2 id="evidence-title">'+titles[i]+'</h2></div><button class="dialog-close" aria-label="关闭证据">✕</button></div><div class="dialog-controls"><select aria-label="选择阶段" id="dialog-stage">'+titles.map((t,n)=>'<option value="'+n+'" '+(n===i?'selected':'')+'>'+String(n).padStart(2,'0')+' '+t+'</option>').join('')+'</select><div>'+kinds.map(x=>'<button data-evidence-tab="'+x+'" class="'+(x===k?'active':'')+'">'+labels[x]+'</button>').join('')+'</div><label><input type="checkbox" id="dialog-full" '+(dialogFull?'checked':'')+'> 完整 JSON</label></div><div class="dialog-file">'+names[i]+'-'+k+'.json <span>'+(dialogFull?'完整快照':'重点字段 · 部分内容省略')+'</span></div><pre class="dialog-code">'+jsonHtml(chosen)+'</pre><div class="dialog-footer"><button type="button" id="show-conversation">查看对应对话</button><button type="button" id="return-reading">返回正文</button></div>';
 d.querySelector('.dialog-close').onclick=()=>d.close();
 d.querySelector('#dialog-stage').onchange=e=>openEvidence(+e.target.value,dialogTab);
 d.querySelector('#dialog-full').onchange=e=>{dialogFull=e.target.checked;openEvidence(dialogStage,dialogTab)};
 d.querySelectorAll('[data-evidence-tab]').forEach(b=>b.onclick=()=>openEvidence(i,b.dataset.evidenceTab));
 d.querySelectorAll('.json-id').forEach(a=>a.onclick=e=>{e.preventDefault();const m=a.hash.match(/step\/(\d+)\/(\w+)/);openEvidence(+m[1],m[2])});
 d.querySelector('#show-conversation').onclick=()=>openTranscript(i);
 d.querySelector('#return-reading').onclick=()=>d.close();
 if(!d.open)d.showModal();
}
window.addEventListener('scroll',()=>{document.querySelector('#back-top')?.classList.toggle('visible',scrollY>350)},{passive:true});

function userMessageMarkup(text){
 const skillLink = /\[\$([^\]\r\n]+)\]\(([^)\r\n]*SKILL\.md)\)/gi;
 let html='', offset=0;
 // Format skill mentions for reading; keep the source trace unchanged.
 text=text.replace(/&#(?:x20|32);/gi,' ');
 for(const match of text.matchAll(skillLink)){
  html+=esc(text.slice(offset,match.index));
  html+='<span class="skill-mention"><span class="skill-mention-kind">Skill</span>'+esc(match[1])+'</span>';
  offset=match.index+match[0].length;
 }
 return html+esc(text.slice(offset));
}

function transcriptMarkup(){
 const records=JSON.parse(raw[prefix+'evidence/rollout.json']);
 let turn=0;
 const rows=records.map((e,index)=>{
  const p=e.payload;
  if(e.type!=='response_item')return '';
  if(p.type==='message'&&p.role==='user'&&[8,27].includes(index)){
   turn++;return '<section class="conversation-turn" id="conversation-turn-'+turn+'"><h3>第'+turn+'轮</h3><div class="conversation-message user-message"><span>你</span><p>'+userMessageMarkup((p.content||[]).map(c=>c.text||'').join('\n'))+'</p></div></section>';
  }
  if(!turn)return '';
  if(p.type==='message'&&p.role==='assistant')return '<div class="conversation-message"><span>Codex</span><div>'+DOMPurify.sanitize(marked.parse((p.content||[]).map(c=>c.text||'').join('\n')))+'</div></div>';
  if(p.type==='custom_tool_call'){
   return '<details class="conversation-tool"><summary>工具调用 · '+esc(p.name)+' </summary><pre>'+esc(p.input||'')+'</pre></details>';
  }
  if(p.type==='custom_tool_call_output')return '<details class="conversation-tool"><summary>工具执行结果</summary><pre>'+esc(JSON.stringify(p.output,null,2))+'</pre></details>';
  return '';
 }).join('');
 return rows;
}
document.addEventListener('click',e=>{
 const workbench=e.target.closest('[data-open-workbench]');
 if(workbench){location.hash=href(1,'request');return;}
 const button=e.target.closest('[data-open-transcript],[data-open-evidence]');
 if(button){button.hasAttribute('data-open-transcript')?openTranscript():openEvidence(1,'request');return;}
 const a=e.target.closest('a');
 if(!a||e.defaultPrevented||!document.querySelector('.reader-article'))return;
 if(a.getAttribute('href')==='#transcript'){e.preventDefault();openTranscript();return;}
 const m=(a.getAttribute('href')||'').match(/^#step\/([0-5])\/(\w+)/);
 if(m){e.preventDefault();openEvidence(+m[1],m[2]);}
});
function inlineWorkbench(){
 const host=document.querySelector('#inline-inspector');if(!host)return;
 host.innerHTML='<div class="request-navigation"><button id="request-prev" '+(step===0?'disabled':'')+'>← 上一次请求</button><select id="request-stage" aria-label="选择请求">'+titles.map((t,i)=>'<option value="'+i+'" '+(i===step?'selected':'')+'>'+String(i).padStart(2,'0')+' · '+t+'</option>').join('')+'</select><button id="request-next" '+(step===5?'disabled':'')+'>下一次请求 →</button></div><div class="inspector"><div class="tabs" role="tablist">'+kinds.map(k=>'<button class="tab" role="tab" data-tab="'+k+'">'+labels[k]+'</button>').join('')+'<button id="compare">⇄ 对比上游</button></div><div class="code-toolbar"><span id="filename"></span><div><label><input id="full" type="checkbox"> 完整 JSON</label><button id="copy">复制</button></div></div><div class="code-search"><input id="find" aria-label="搜索JSON" placeholder="搜索字段或 ID"><button id="find-next">查找</button><span id="find-status"></span></div><div id="code-grid"><pre id="code" tabindex="0"></pre><div id="compare-code" hidden></div></div><div id="json-note"></div></div>';
 const change=i=>{step=i;inlineWorkbench()};
 host.querySelector('#request-prev').onclick=()=>change(step-1);
 host.querySelector('#request-next').onclick=()=>change(step+1);
 host.querySelector('#request-stage').onchange=e=>change(+e.target.value);
 host.querySelector('#full').checked=workbenchFull;
 host.querySelector('#full').onchange=e=>{workbenchFull=e.target.checked;panel()};
 host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;panel()});
 host.querySelector('#compare').onclick=()=>{compare=!compare;panel()};
 host.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(data(step,tab),null,2));host.querySelector('#copy').textContent='已复制'}catch{host.querySelector('#copy').textContent='复制失败'}};
 const find=()=>{panel();const word=host.querySelector('#find').value.trim();if(!word)return;const walker=document.createTreeWalker(host.querySelector('#code'),NodeFilter.SHOW_TEXT);let node;const hits=[];while(node=walker.nextNode()){const pos=node.textContent.toLowerCase().indexOf(word.toLowerCase());if(pos>=0)hits.push([node,pos])}for(const [n,p] of hits){const range=document.createRange();range.setStart(n,p);range.setEnd(n,p+word.length);const m=document.createElement('mark');range.surroundContents(m)}host.querySelector('#find-status').textContent=hits.length?'找到 '+hits.length+' 处':'当前视图无匹配';host.querySelector('mark')?.scrollIntoView({block:'nearest'});};
 host.querySelector('#find-next').onclick=find;
 host.querySelector('#find').onkeydown=e=>{if(e.key==='Enter')find()};
 panel();
}
async function showMaterials(target){
 if(!document.querySelector('#inline-inspector')){
  chapter=0;
  history.pushState(null,'',chapterHref(chapter));
  await renderReader();
 }
 document.querySelector(target)?.scrollIntoView({block:'start',behavior:'smooth'});
}
async function openTranscript(){await showMaterials('#inline-transcript')}
async function openEvidence(i,k){step=i;tab=k;await showMaterials('#inline-workbench');inlineWorkbench()}
function sidebarExpanded(){
 return innerWidth<=650?document.body.classList.contains('menu-open'):!document.body.classList.contains('sidebar-collapsed');
}
function updateSidebarToggle(){
 const b=document.querySelector('#sidebar-toggle');if(!b)return;
 const expanded=sidebarExpanded();b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'收起目录':'展开目录');b.title=expanded?'收起目录':'展开目录';
}
function toggleSidebar(){
 if(innerWidth<=650)document.body.classList.toggle('menu-open');
 else{document.body.classList.toggle('sidebar-collapsed');localStorage.setItem('harness-sidebar-collapsed',String(document.body.classList.contains('sidebar-collapsed')));}
 updateSidebarToggle();
}
function installSidebarToggle(){
 const side=document.querySelector('.sidebar');side.id='course-sidebar';
 if(!document.querySelector('#sidebar-toggle')){
  document.body.insertAdjacentHTML('beforeend','<button id="sidebar-toggle" type="button" aria-controls="course-sidebar" aria-label="收起目录"><span></span><span></span><span></span></button>');
  document.querySelector('#sidebar-toggle').onclick=toggleSidebar;
  document.body.classList.toggle('sidebar-collapsed',localStorage.getItem('harness-sidebar-collapsed')==='true');
 }
 updateSidebarToggle();
}
function keepInSidebar(el){
 const side=document.querySelector('.sidebar');if(!el||!side||!sidebarExpanded())return;
 const a=el.getBoundingClientRect(),b=side.getBoundingClientRect();
 if(a.top<b.top+20)side.scrollTop-=b.top+20-a.top;
 else if(a.bottom>b.bottom-25)side.scrollTop+=a.bottom-b.bottom+25;
}
function syncChapterOutline(heads){
 document.querySelectorAll('.chapter-outline').forEach(x=>x.remove());readerHeadings=heads;
 const active=document.querySelector('.chapter-link.active');
 if(active&&heads.length){
  const list=document.createElement('div');list.className='chapter-outline';
  list.id='lesson-outline';
  list.innerHTML=heads.map((h,i)=>'<a href="#'+h.id+'" data-scroll="'+h.id+'"><span class="outline-number">1.'+(i+1)+'</span><span class="outline-text">'+esc(h.textContent)+'</span></a>').join('');
  list.hidden=document.body.classList.contains('lesson-outline-closed');
  active.innerHTML='<span class="tree-chevron" aria-hidden="true"></span><span>1. Codex 的一次完整运行</span>';
  active.setAttribute('aria-expanded',String(!list.hidden));
  active.setAttribute('aria-controls','lesson-outline');
  active.onclick=e=>{e.preventDefault();list.hidden=!list.hidden;document.body.classList.toggle('lesson-outline-closed',list.hidden);active.setAttribute('aria-expanded',String(!list.hidden));};
  active.after(list);
 }
 updateSidebarToggle();keepInSidebar(active);updateReadingPosition();
}
function updateReadingPosition(){
 scrollSpyQueued=false;
 if(!readerHeadings.length)return;
 let current=readerHeadings[0];for(const h of readerHeadings){if(h.getBoundingClientRect().top<=125)current=h;else break;}
 let changed=false,selected;
 document.querySelectorAll('.chapter-outline a').forEach(a=>{
  const hit=a.dataset.scroll===current.id;if(hit&&!a.classList.contains('current'))changed=true;
  a.classList.toggle('current',hit);
  if(hit){a.setAttribute('aria-current','location');selected=a}else a.removeAttribute('aria-current');
 });
 if(changed)keepInSidebar(selected);
}
window.addEventListener('scroll',()=>{if(!scrollSpyQueued){scrollSpyQueued=true;requestAnimationFrame(updateReadingPosition)}},{passive:true});
window.addEventListener('resize',updateSidebarToggle);
window.addEventListener('hashchange',route);route();
