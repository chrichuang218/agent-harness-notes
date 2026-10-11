// Shared by the rendered lesson and its text-only search index, so a result
// always opens the same passage without loading any evidence files.
export function indexPassages(container, lesson, sectionIds) {
  const headings = [...container.querySelectorAll('h2,h3,h4,h5,h6,details > summary')]
    .filter(node => node.tagName !== 'SUMMARY' || node.textContent.trim().startsWith('深入'));
  const outline = headings.map((node, index) => {
    const text = node.textContent.trim();
    node.id = sectionIds[lesson.id]?.[text] || node.id || `${lesson.id}-section-${index}`;
    return { id: node.id, text, depth: node.tagName === 'SUMMARY' ? 1 : Number(node.tagName.slice(1)) - 2 };
  });
  let section = { id: '', text: '开篇' };
  let passageNumber = 0;
  const passages = [];
  for (const node of container.querySelectorAll('h2,h3,h4,h5,h6,p,li,pre,td,th,summary')) {
    if (headings.includes(node)) section = { id: node.id, text: node.textContent.trim() };
    if (node.matches('li') && node.querySelector('p,li,pre')) continue;
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    node.id ||= `${lesson.id}-passage-${passageNumber}`;
    passageNumber++;
    node.dataset.passage = node.id;
    // Mermaid source becomes a diagram, so its hidden code is not searchable.
    // Its stable passage ID still survives rendering for reading restoration.
    if (node.matches('pre') && node.querySelector('code.language-mermaid')) continue;
    passages.push({ lesson: lesson.id, title: lesson.title, section: section.id, sectionTitle: section.text, passage: node.id, text });
  }
  return { outline, passages };
}

export function searchPassages(passages, query) {
  const needle = query.toLocaleLowerCase();
  return passages.filter(item => item.text.toLocaleLowerCase().includes(needle) || (item.sectionTitle + ' ' + item.title).toLocaleLowerCase().includes(needle))
    .map(item => {
      const index = item.text.toLocaleLowerCase().indexOf(needle);
      const start = Math.max(0, index - 35);
      return { ...item, direct: index >= 0, excerpt: (start ? '…' : '') + item.text.slice(start, start + 135) + (item.text.length > start + 135 ? '…' : '') };
    }).filter((item, index, all) => item.direct || !all.slice(0, index).some(previous => previous.lesson === item.lesson && previous.section === item.section));
}

export function highlightPassage(element, query) {
  if (!query) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('.heading-anchor')) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.textContent;
    const lower = text.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    let index = lower.indexOf(needle);
    if (index < 0) continue;
    const fragment = document.createDocumentFragment();
    let position = 0;
    while (index >= 0) {
      fragment.append(text.slice(position, index));
      const mark = document.createElement('mark'); mark.className = 'search-highlight'; mark.textContent = text.slice(index, index + query.length); fragment.append(mark);
      position = index + query.length; index = lower.indexOf(needle, position);
    }
    fragment.append(text.slice(position)); node.replaceWith(fragment);
  }
}

export function glossaryEntries(html) {
  const container = document.createElement('div'); container.innerHTML = html;
  return [...container.querySelectorAll('tbody tr')].map(row => {
    const [term, meaning, source] = row.querySelectorAll('td');
    return { term: term.textContent.trim(), aliases: term.textContent.trim().split(/\s+\/\s+/), meaning: meaning.textContent.trim(), source: source.querySelector('a')?.getAttribute('href'), sourceLabel: source.querySelector('a')?.textContent };
  });
}

export function annotateTerms(container, glossary) {
  const names = new Map(glossary.flatMap((entry, index) => entry.aliases.map(alias => [alias.toLocaleLowerCase(), index])));
  const alternatives = [...names.keys()].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![a-zA-Z0-9_])(${alternatives.join('|')})(?![a-zA-Z0-9_])`, 'gi');
  const used = new Set();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('a,button,pre,h1,h2,h3,h4,h5,h6,summary')) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment(); let position = 0;
    for (const match of node.textContent.matchAll(pattern)) {
      const index = names.get(match[0].toLocaleLowerCase());
      if (used.has(index)) continue;
      used.add(index); fragment.append(node.textContent.slice(position, match.index));
      const button = document.createElement('button'); button.type = 'button'; button.className = 'term-trigger'; button.dataset.term = index; button.textContent = match[0]; button.setAttribute('aria-label', `解释术语：${match[0]}`); button.setAttribute('aria-controls', 'term-definition'); button.setAttribute('aria-expanded', 'false'); fragment.append(button);
      position = match.index + match[0].length;
    }
    if (position) { fragment.append(node.textContent.slice(position)); node.replaceWith(fragment); }
  }
}
