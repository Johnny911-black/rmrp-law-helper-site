(function () {
  const SEARCH_OPTIONS = {
    keys: [
      { name: 'articleNumber', weight: 3 },
      { name: 'title', weight: 2 },
      { name: 'code', weight: 2 },
      { name: 'parts.text', weight: 1 },
      { name: 'parts.punishment', weight: 1.5 },
      { name: 'keywords', weight: 2 },
    ],
    threshold: 0.35,
    includeScore: true,
  };

  const state = {
    mode: 'laws',
    tabKey: '',
    viewMode: 'list',
    query: '',
    docFilter: '',
    dropdownOpen: false,
    selectedId: null,
    selectedChapterKey: null,
    expandedChapters: {},
    lawsRegistry: [],
    rulesRegistry: null,
    corpusCache: {
      laws: {},
      lawsFull: {},
      rules: {},
      rulesFull: {},
      lawsAll: null,
      lawsAllFull: null,
      rulesAll: null,
      rulesAllFull: null,
    },
    activeItems: [],
    fullItems: null,
    filtered: [],
    _manifest: null,
    refreshSeq: 0,
  };

  const bootstrap = { promise: null };

  function startBootstrap() {
    if (!bootstrap.promise) {
      bootstrap.promise = Promise.all([
        fetchJson('/data/laws.json'),
        fetchJson('/data/meta.json').catch(() => null),
      ]);
    }
    return bootstrap.promise;
  }

  let fuseLoader = null;
  function ensureFuse() {
    if (typeof Fuse !== 'undefined') return Promise.resolve();
    if (!fuseLoader) {
      fuseLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/fuse.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('fuse.min.js'));
        document.head.appendChild(script);
      });
    }
    return fuseLoader;
  }

  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }

  function setLoading(msg) {
    const list = $('laws-list');
    const status = $('laws-status');
    if (list) list.innerHTML = `<p class="laws-loading">${escapeHtml(msg)}</p>`;
    if (status) status.textContent = msg;
  }

  function defaultTabKey() {
    return 'ALL';
  }

  function highlightTextHtml(text, query) {
    const raw = String(text || '');
    const trimmed = String(query || '').trim();
    if (!trimmed || !raw) return escapeHtml(raw);

    const ss = window.SiteSmartSearch;
    if (!ss || typeof ss.getHighlightTerms !== 'function' || typeof ss.findTermIndex !== 'function') {
      return escapeHtml(raw);
    }

    const terms = ss.getHighlightTerms(trimmed);
    if (!terms.length) return escapeHtml(raw);

    let html = '';
    let remaining = raw;

    while (remaining.length > 0) {
      let bestIndex = -1;
      let bestTerm = null;

      for (const term of terms) {
        const index = ss.findTermIndex(remaining, term);
        if (index === -1) continue;
        if (
          bestIndex === -1 ||
          index < bestIndex ||
          (index === bestIndex && term.length > bestTerm.length)
        ) {
          bestIndex = index;
          bestTerm = term;
        }
      }

      if (bestIndex === -1) {
        html += escapeHtml(remaining);
        break;
      }

      if (bestIndex > 0) html += escapeHtml(remaining.slice(0, bestIndex));

      const matchLen = bestTerm.length;
      const matched = remaining.slice(bestIndex, bestIndex + matchLen);
      html += `<mark class="search-highlight">${escapeHtml(matched)}</mark>`;
      remaining = remaining.slice(bestIndex + matchLen);
    }

    return html;
  }

  function listDataFile(cacheFile) {
    if (/^all_(articles|rules)\.json$/i.test(cacheFile)) {
      return cacheFile.replace('.json', '_index.json');
    }
    return cacheFile.replace(/_(articles|rules)\.json$/i, '_index.json');
  }

  function itemHasFullText(item) {
    return !!(item?.parts || []).some((part) => part.text);
  }

  async function ensureListCorpus() {
    const isLaws = state.mode === 'laws';
    if (!state.tabKey) state.tabKey = defaultTabKey();

    if (state.tabKey === 'ALL') {
      if (isLaws) {
        if (!state.corpusCache.lawsAll) {
          setLoading('Загрузка списка законов…');
          state.corpusCache.lawsAll = await fetchJson('/data/all_articles_index.json').catch(() =>
            fetchJson('/data/all_articles.json')
          );
        }
        return state.corpusCache.lawsAll;
      }
      if (!state.corpusCache.rulesAll) {
        setLoading('Загрузка списка правил…');
        state.corpusCache.rulesAll = await fetchJson('/data/all_rules_index.json').catch(() =>
          fetchJson('/data/all_rules.json')
        );
      }
      return state.corpusCache.rulesAll;
    }

    const entry = findRegistryByKey(state.tabKey);
    if (!entry || !entry.cacheFile) {
      return [];
    }

    const bucket = isLaws ? state.corpusCache.laws : state.corpusCache.rules;
    if (!bucket[entry.key]) {
      setLoading(`Загрузка: ${tabLabel(entry)}…`);
      const listFile = listDataFile(entry.cacheFile);
      try {
        bucket[entry.key] = await fetchJson(`/data/${listFile}`);
      } catch {
        try {
          bucket[entry.key] = await fetchJson(`/data/${entry.cacheFile}`);
        } catch {
          throw new Error(
            `Нет файла data/${entry.cacheFile}. Выполните: npm run site:data`
          );
        }
      }
    }
    return Array.isArray(bucket[entry.key]) ? bucket[entry.key] : [];
  }

  async function ensureFullCorpus() {
    const isLaws = state.mode === 'laws';
    if (!state.tabKey) state.tabKey = defaultTabKey();

    if (state.tabKey === 'ALL') {
      if (isLaws) {
        if (!state.corpusCache.lawsAllFull) {
          $('laws-status').textContent = 'Загрузка полных текстов… (~6 МБ)';
          state.corpusCache.lawsAllFull = await fetchJson('/data/all_articles.json');
        }
        state.fullItems = state.corpusCache.lawsAllFull;
        return state.corpusCache.lawsAllFull;
      }
      if (!state.corpusCache.rulesAllFull) {
        $('laws-status').textContent = 'Загрузка полных текстов правил…';
        state.corpusCache.rulesAllFull = await fetchJson('/data/all_rules.json');
      }
      state.fullItems = state.corpusCache.rulesAllFull;
      return state.corpusCache.rulesAllFull;
    }

    const entry = findRegistryByKey(state.tabKey);
    if (!entry || !entry.cacheFile) {
      state.fullItems = [];
      return [];
    }

    const bucket = isLaws ? state.corpusCache.lawsFull : state.corpusCache.rulesFull;
    if (!bucket[entry.key]) {
      $('laws-status').textContent = `Загрузка текста: ${tabLabel(entry)}…`;
      bucket[entry.key] = await fetchJson(`/data/${entry.cacheFile}`);
    }
    state.fullItems = bucket[entry.key];
    return bucket[entry.key];
  }

  function registryEntries() {
    if (state.mode === 'laws') return state.lawsRegistry;
    return (state.rulesRegistry && state.rulesRegistry.documents) || [];
  }

  function findRegistryByKey(key) {
    return registryEntries().find((e) => e.key === key) || null;
  }

  function findRegistryEntry(item) {
    if (state.mode === 'laws') {
      return state.lawsRegistry.find((l) => l.key === item.lawKey) || null;
    }
    const docs = (state.rulesRegistry && state.rulesRegistry.documents) || [];
    return docs.find((d) => d.key === item.docKey) || null;
  }

  function tabLabel(entry) {
    if (!entry) return '';
    if (state.mode === 'laws') return entry.code;
    return entry.shortCode || entry.code;
  }

  function itemKey(item) {
    return state.mode === 'laws' ? item.lawKey : item.docKey;
  }

  function numberLabel(item) {
    const prefix = item.contentType === 'rule' ? 'п.' : 'ст.';
    return item.articleNumber ? `${prefix} ${item.articleNumber}` : '';
  }

  function displayTitle(item) {
    const title = (item.title || '').trim();
    if (title) return title;
    if (item.preview) return item.preview;
    const text =
      (item.parts && item.parts[0] && item.parts[0].text) ||
      item.fullText ||
      '';
    const compact = String(text).replace(/\s+/g, ' ').trim();
    if (compact.length > 78) return `${compact.slice(0, 76)}…`;
    if (compact) return compact;
    return numberLabel(item) || item.code || '';
  }

  function listLabel() {
    return state.mode === 'laws' ? 'Статьи' : 'Пункты';
  }

  function filterItems(items) {
    let list = items;
    if (state.tabKey !== 'ALL') {
      list = list.filter((item) => itemKey(item) === state.tabKey);
    }
    const q = state.query.trim();
    if (!q) return list;

    if (window.SiteSmartSearch && typeof window.SiteSmartSearch.search === 'function') {
      const result = window.SiteSmartSearch.search(list, q);
      if (result.length || typeof Fuse === 'undefined') return result;
      void ensureFuse().then(() => {
        if (state.query.trim() === q) refresh({ keepSelection: true });
      });
      return result;
    }

    const lower = q.toLowerCase();
    return list.filter((item) => {
      const hay = [
        item.articleNumber,
        item.title,
        item.code,
        item.chapter,
        item.preview,
        ...(item.keywords || []),
        ...(item.parts || []).map((p) => `${p.text || ''} ${p.punishment || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(lower);
    });
  }

  function groupItems(items) {
    const groups = new Map();
    for (const item of items) {
      const key = itemKey(item) || 'OTHER';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const order = registryEntries().map((e) => e.key);
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return sortedKeys.map((key) => {
      const entry = findRegistryByKey(key);
      const label = entry ? tabLabel(entry) : key;
      const list = groups.get(key);
      const byChapter = new Map();
      for (const item of list) {
        const ch = item.chapter || 'Без главы';
        if (!byChapter.has(ch)) byChapter.set(ch, []);
        byChapter.get(ch).push(item);
      }
      return { key, label, title: entry ? entry.title : label, chapters: [...byChapter.entries()] };
    });
  }

  function termTone(years) {
    const n = Number(years);
    if (n >= 7) return 'severe';
    if (n >= 4) return 'heavy';
    if (n >= 1) return 'medium';
    return 'light';
  }

  function sprpTone(sprp) {
    const stars = String(sprp || '').match(/★/g);
    const n = stars ? stars.length : 0;
    if (n >= 4) return 'severe';
    if (n >= 3) return 'heavy';
    if (n >= 2) return 'medium';
    return 'light';
  }

  function formatFineDisplay(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 ? 1 : 0)} млн`;
    if (n >= 1000) return `${Math.round(n / 1000)}к`;
    return String(n);
  }

  const CODE_TO_KEY = {
    ПДД: 'PDD',
    КоАП: 'KOAP',
    УК: 'UK',
    ПК: 'PK',
    ЗТ: 'ZT',
    ФЗО: 'FZO',
    ФЗП: 'FZP',
  };
  const CODE_TO_PREFIX = {
    ПДД: 'pdd',
    КоАП: 'koap',
    УК: 'uk',
    ПК: 'pk',
    ЗТ: 'zt',
    ФЗО: 'fzo',
    ФЗП: 'fzp',
  };
  const REF_REGEX =
    /\(см\.\s*(?:стать[яюи]\s+([\d.,\s]+[\d.])|глав[ауы]\s+([IVXLCDM]+))\s+(ПДД|КоАП|УК|ПК|ЗТ|ФЗО|ФЗП)\)/g;

  function linkifyText(text, query) {
    const raw = normalizeArticleText(text);
    if (!raw) return '';
    const q = String(query ?? state.query ?? '').trim();
    const textHtml = (segment) => (q ? highlightTextHtml(segment, q) : escapeHtml(segment));
    const re = new RegExp(REF_REGEX.source, REF_REGEX.flags);
    let html = '';
    let last = 0;
    let match;
    while ((match = re.exec(raw)) !== null) {
      html += textHtml(raw.slice(last, match.index));
      const nums = match[1] ? match[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean) : [];
      const chapter = match[2] || '';
      const code = match[3];
      const attrs = [
        `class="laws-ref-link"`,
        `href="#ref"`,
        `data-code="${escapeHtml(code)}"`,
        nums.length ? `data-nums="${escapeHtml(nums.join(','))}"` : '',
        chapter ? `data-chapter="${escapeHtml(chapter)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      html += `<a ${attrs}>${escapeHtml(match[0])}</a>`;
      last = re.lastIndex;
    }
    html += textHtml(raw.slice(last));
    return html;
  }

  function findRefArticle(items, code, num) {
    const prefix = CODE_TO_PREFIX[code];
    const id = prefix ? `${prefix}_${num}` : null;
    return (
      items.find((a) => id && a.id === id) ||
      items.find(
        (a) =>
          a.code === code &&
          (String(a.articleNumber) === num ||
            String(a.articleNumber).replace(/\s+\S+$/, '') === num)
      ) ||
      null
    );
  }

  function findChapterArticles(items, code, roman) {
    return items.filter(
      (a) =>
        a.code === code &&
        a.chapter &&
        new RegExp(`Глава\\s+${roman}\\b`, 'i').test(a.chapter)
    );
  }

  async function openReference({ code, nums, chapter }) {
    const key = CODE_TO_KEY[code];
    if (!key) return;
    state.mode = 'laws';
    state.tabKey = key;
    state.viewMode = 'list';
    state.query = '';
    state.docFilter = '';
    state.selectedChapterKey = null;
    state.expandedChapters = {};
    document.querySelectorAll('.laws-mode-btn').forEach((b) => {
      const on = b.dataset.mode === 'laws';
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    setDropdownOpen(false);
    await refresh({ keepSelection: false });

    let target = null;
    if (nums && nums.length) {
      for (const num of nums) {
        target = findRefArticle(state.activeItems, code, num);
        if (target) break;
      }
    } else if (chapter) {
      const list = findChapterArticles(state.activeItems, code, chapter);
      target = list[0] || null;
    }
    if (!target) {
      $('laws-status').textContent = `Ссылка не найдена: ${code}`;
      return;
    }
    if (target.chapter) {
      setChapterExpanded(itemKey(target) || key, target.chapter, true);
    }
    await selectItem(target.id);
  }

  function sanctionRowHtml(part, query) {
    const q = String(query ?? state.query ?? '').trim();
    const textHtml = (segment) => (q ? highlightTextHtml(segment, q) : escapeHtml(segment));
    const hasSanction =
      part.punishment || part.imprisonmentYears != null || part.fine || part.sprp;
    if (!hasSanction) return '';

    const chips = [];
    if (part.imprisonmentYears != null && part.imprisonmentYears !== '') {
      chips.push(
        `<span class="laws-sanction-chip laws-sanction-chip--${termTone(part.imprisonmentYears)}"><span class="laws-sanction-chip-label">Срок</span><span class="laws-sanction-chip-value">${escapeHtml(part.imprisonmentYears)} л.</span></span>`
      );
    }
    if (part.fine != null && part.fine !== '') {
      const fineVal =
        part.fineMax != null && part.fineMax !== ''
          ? `${formatFineDisplay(part.fine)}–${formatFineDisplay(part.fineMax)}`
          : formatFineDisplay(part.fine);
      chips.push(
        `<span class="laws-sanction-chip laws-sanction-chip--fine"><span class="laws-sanction-chip-label">Штраф</span><span class="laws-sanction-chip-value">${escapeHtml(fineVal)}</span></span>`
      );
    }
    if (part.sprp) {
      chips.push(
        `<span class="laws-sanction-chip laws-sanction-chip--sprp-${sprpTone(part.sprp)}"><span class="laws-sanction-chip-label">СПРП</span><span class="laws-sanction-chip-value">${escapeHtml(part.sprp)}</span></span>`
      );
    }

    const chipsHtml = chips.length
      ? `<span class="laws-sanction-chips">${chips.join('')}</span>`
      : '';
    const fullText = part.punishment
      ? `<span class="laws-part-punish">(${textHtml(part.punishment)})</span>`
      : '';

    return `<div class="laws-sanction-row"><span class="laws-sanction-tag">НАКАЗАНИЕ:</span>${chipsHtml}${fullText}</div>`;
  }

  function partsHtml(item, query) {
    const q = String(query ?? state.query ?? '').trim();
    return (item.parts || [])
      .map((part) => {
        const label = part.partNumber
          ? `<span class="laws-part-num">ч. ${escapeHtml(part.partNumber)}</span>`
          : '';
        return `
          <div class="laws-part">
            ${label}
            <p class="laws-part-text">${linkifyText(part.text || '', q)}</p>
            ${sanctionRowHtml(part, q)}
          </div>`;
      })
      .join('');
  }

  function setDropdownOpen(open) {
    state.dropdownOpen = open;
    const panel = $('laws-doc-panel');
    const trigger = $('laws-doc-trigger');
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      $('laws-doc-filter').value = state.docFilter;
      renderDocList();
      setTimeout(() => $('laws-doc-filter').focus(), 0);
    }
  }

  function docPickerPlaceholder() {
    return state.mode === 'laws' ? 'Выбрать кодекс…' : 'Выбрать правила…';
  }

  function docFilterPlaceholder() {
    return state.mode === 'laws' ? 'Найти кодекс…' : 'Найти правила…';
  }

  function renderScopeBar() {
    const entry = state.tabKey === 'ALL' ? null : findRegistryByKey(state.tabKey);
    $('laws-all-btn').classList.toggle('is-active', state.tabKey === 'ALL');

    const triggerLabel = entry
      ? `${tabLabel(entry)} — ${entry.title}`
      : docPickerPlaceholder();
    $('laws-doc-trigger-label').textContent = triggerLabel;
    $('laws-doc-trigger').classList.toggle('is-active', state.tabKey !== 'ALL');
    $('laws-doc-filter').placeholder = docFilterPlaceholder();

    $('laws-view-list').textContent = listLabel();
    $('laws-view-list').classList.toggle('is-active', state.viewMode === 'list');
    $('laws-view-fulltext').classList.toggle('is-active', state.viewMode === 'fulltext');

    const forum = $('laws-forum-btn');
    if (entry && entry.url) {
      forum.href = entry.url;
      forum.hidden = false;
      forum.textContent = 'На форум';
    } else {
      forum.hidden = true;
      forum.removeAttribute('href');
    }

    $('laws-workspace').dataset.view = state.viewMode;
  }

  function renderDocList() {
    const q = state.docFilter.trim().toLowerCase();
    const entries = registryEntries().filter((entry) => {
      if (!q) return true;
      const hay = `${tabLabel(entry)} ${entry.title} ${entry.code}`.toLowerCase();
      return hay.includes(q);
    });

    if (!entries.length) {
      $('laws-doc-list').innerHTML = '<p class="laws-doc-empty">Ничего не найдено</p>';
      return;
    }

    $('laws-doc-list').innerHTML = entries
      .map((entry) => {
        const active = entry.key === state.tabKey ? ' is-active' : '';
        return `
          <button type="button" class="laws-doc-item${active}" data-key="${escapeHtml(entry.key)}" role="option">
            <span class="laws-doc-code">${escapeHtml(tabLabel(entry))}</span>
            <span class="laws-doc-title">${escapeHtml(entry.title)}</span>
          </button>`;
      })
      .join('');
  }

  function chapterKey(groupKey, chapter) {
    return `${groupKey}::${chapter}`;
  }

  function isChapterExpanded(groupKey, chapter) {
    if (state.query.trim()) return true;
    return !!state.expandedChapters[chapterKey(groupKey, chapter)];
  }

  function setChapterExpanded(groupKey, chapter, open) {
    const key = chapterKey(groupKey, chapter);
    if (open) state.expandedChapters[key] = true;
    else delete state.expandedChapters[key];
  }

  function renderList() {
    const items = state.filtered;
    const q = state.query.trim();
    $('laws-status').textContent = q ? `Найдено: ${items.length}` : `${listLabel()}: ${items.length}`;

    if (!items.length) {
      $('laws-list').innerHTML = '<p class="laws-empty">Ничего не найдено</p>';
      return;
    }

    const groups = groupItems(items);
    $('laws-list').innerHTML = groups
      .map((group) => {
        const chapters = group.chapters
          .map(([chapter, chapterItems]) => {
            const open = isChapterExpanded(group.key, chapter);
            const chapterActive =
              state.selectedChapterKey === chapterKey(group.key, chapter) ? ' is-chapter-active' : '';
            const rows = open
              ? chapterItems
                  .map((item) => {
                    const num = numberLabel(item);
                    const title = displayTitle(item);
                    const active = item.id === state.selectedId ? ' is-active' : '';
                    return `
                      <button type="button" class="laws-row${active}" data-id="${escapeHtml(item.id)}">
                        <span class="laws-row-num">${highlightTextHtml(num || '—', q)}</span>
                        <span class="laws-row-title">${highlightTextHtml(title, q)}</span>
                      </button>`;
                  })
                  .join('')
              : '';
            return `
              <div class="laws-chapter-block${open ? ' is-open' : ''}${chapterActive}">
                <div class="laws-chapter-head">
                  <button type="button" class="laws-chapter-toggle" data-group="${escapeHtml(group.key)}" data-chapter="${escapeHtml(chapter)}" aria-expanded="${open}">
                    <span class="laws-chapter-chevron" aria-hidden="true">›</span>
                    <span class="laws-chapter-label">${escapeHtml(chapter)}</span>
                    <span class="laws-chapter-count">${chapterItems.length}</span>
                  </button>
                  <button type="button" class="laws-chapter-open" data-group="${escapeHtml(group.key)}" data-chapter="${escapeHtml(chapter)}" title="Читать всю главу" aria-label="Читать всю главу">📖</button>
                </div>
                <div class="laws-chapter-items"${open ? '' : ' hidden'}>${rows}</div>
              </div>`;
          })
          .join('');
        return `
          <section class="laws-group-block">
            <h3 class="laws-group-label">${escapeHtml(group.label)}</h3>
            ${chapters}
          </section>`;
      })
      .join('');
  }

  function resolveChapterItems(groupKey, chapter) {
    const groups = groupItems(state.filtered);
    for (const group of groups) {
      if (group.key !== groupKey) continue;
      for (const [ch, chapterItems] of group.chapters) {
        if (ch !== chapter) return chapterItems;
      }
    }
    return [];
  }

  function resolveChapterItemsFull(groupKey, chapter) {
    return resolveChapterItems(groupKey, chapter).map((item) => findItemById(item.id) || item);
  }

  function clearReaderPanes({ showEmpty = false, emptyText = 'Выберите статью или главу слева' } = {}) {
    const empty = $('laws-reader-empty');
    const article = $('laws-reader-article');
    const chapterView = $('laws-chapter-view');
    const fulltext = $('laws-fulltext');
    article.hidden = true;
    if (chapterView) chapterView.hidden = true;
    if (chapterView) chapterView.innerHTML = '';
    fulltext.hidden = true;
    fulltext.innerHTML = '';
    if (showEmpty) {
      empty.hidden = false;
      empty.querySelector('p').textContent = emptyText;
    } else {
      empty.hidden = true;
    }
  }

  function renderReader(item) {
    const empty = $('laws-reader-empty');
    const article = $('laws-reader-article');
    const chapterView = $('laws-chapter-view');
    const fulltext = $('laws-fulltext');
    fulltext.hidden = true;
    fulltext.innerHTML = '';
    if (chapterView) {
      chapterView.hidden = true;
      chapterView.innerHTML = '';
    }
    state.selectedChapterKey = null;

    if (!item) {
      clearReaderPanes({ showEmpty: true, emptyText: 'Выберите статью или главу слева' });
      return;
    }

    empty.hidden = true;
    article.hidden = false;

    const entry = findRegistryEntry(item);
    const q = state.query.trim();
    $('laws-reader-kicker').innerHTML = highlightTextHtml(
      [item.code, numberLabel(item)].filter(Boolean).join(' · '),
      q
    );
    $('laws-reader-title').innerHTML = highlightTextHtml(displayTitle(item), q);
    $('laws-reader-chapter').innerHTML = highlightTextHtml(item.chapter || '', q);
    $('laws-reader-chapter').hidden = !item.chapter;

    const forum = $('laws-reader-forum');
    if (entry && entry.url) {
      forum.href = entry.url;
      forum.hidden = false;
    } else {
      forum.hidden = true;
    }

    $('laws-reader-body').innerHTML = partsHtml(item) || '<p class="laws-empty">Нет текста.</p>';
    $('laws-reader').scrollTop = 0;

    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('laws-reading');
    }
  }

  function renderChapterReader(chapterTitle, items) {
    const empty = $('laws-reader-empty');
    const article = $('laws-reader-article');
    const chapterView = $('laws-chapter-view');
    const fulltext = $('laws-fulltext');
    const q = state.query.trim();

    if (!items?.length) {
      renderReader(null);
      return;
    }

    empty.hidden = true;
    article.hidden = true;
    fulltext.hidden = true;
    fulltext.innerHTML = '';
    chapterView.hidden = false;

    const body = items
      .map((item) => {
        const title = displayTitle(item);
        const num = numberLabel(item);
        const headLine = highlightTextHtml([item.code, num].filter(Boolean).join(' · '), q);
        const titleSuffix = title && title !== num ? ` — ${highlightTextHtml(title, q)}` : '';
        return `
          <article class="laws-chapter-article" id="ch-${escapeHtml(item.id)}">
            <h3 class="laws-chapter-article-title">${headLine}${titleSuffix}</h3>
            <div class="laws-chapter-article-parts">${partsHtml(item, q)}</div>
          </article>`;
      })
      .join('');

    chapterView.innerHTML = `
      <header class="laws-chapter-reader-head">
        <h2>${highlightTextHtml(chapterTitle, q)}</h2>
        <p>${items.length} ${listLabel().toLowerCase()}</p>
      </header>
      <div class="laws-chapter-reader-body">${body}</div>`;
    $('laws-reader').scrollTop = 0;

    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('laws-reading');
    }
  }

  async function selectChapter(groupKey, chapter) {
    state.selectedChapterKey = chapterKey(groupKey, chapter);
    state.selectedId = null;
    setViewMode('list');
    setChapterExpanded(groupKey, chapter, true);
    renderScopeBar();
    renderList();

    let items = resolveChapterItemsFull(groupKey, chapter);
    const needsFull = items.some((item) => !itemHasFullText(item));
    if (needsFull) {
      $('laws-reader-empty').hidden = true;
      $('laws-reader-article').hidden = true;
      $('laws-chapter-view').hidden = false;
      $('laws-chapter-view').innerHTML = '<p class="laws-loading">Загрузка текста главы…</p>';
      await ensureFullCorpus();
      items = resolveChapterItemsFull(groupKey, chapter);
    }

    renderChapterReader(chapter, items);
    const block = $('laws-list')?.querySelector(
      `.laws-chapter-block.is-chapter-active .laws-chapter-head`
    );
    block?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderFullText() {
    const empty = $('laws-reader-empty');
    const article = $('laws-reader-article');
    const chapterView = $('laws-chapter-view');
    const fulltext = $('laws-fulltext');
    article.hidden = true;
    if (chapterView) {
      chapterView.hidden = true;
      chapterView.innerHTML = '';
    }

    const items = state.filtered;
    if (!items.length) {
      clearReaderPanes({ showEmpty: true, emptyText: 'Нет текста для отображения' });
      return;
    }

    empty.hidden = true;
    fulltext.hidden = false;

    const groups = groupItems(items);
    const entry = state.tabKey === 'ALL' ? null : findRegistryByKey(state.tabKey);
    const q = state.query.trim();

    const head = entry
      ? `<header class="laws-fulltext-head">
           <h2>${escapeHtml(tabLabel(entry))}</h2>
           <p>${escapeHtml(entry.title)}</p>
           ${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">Тема на форуме →</a>` : ''}
         </header>`
      : `<header class="laws-fulltext-head">
           <h2>Полный текст</h2>
           <p>${state.query.trim() ? 'Результаты поиска' : 'Все выбранные документы'}</p>
         </header>`;

    const body = groups
      .map((group) => {
        const chapters = group.chapters
          .map(([chapter, chapterItems]) => {
            const arts = chapterItems
              .map((item) => {
                const title = displayTitle(item);
                const num = numberLabel(item);
                const headLine = highlightTextHtml([item.code, num].filter(Boolean).join(' · '), q);
                const titleSuffix =
                  title && title !== num ? ` — ${highlightTextHtml(title, q)}` : '';
                return `
                  <article class="laws-fulltext-article" id="ft-${escapeHtml(item.id)}">
                    <h4>${headLine}${titleSuffix}</h4>
                    <div class="laws-fulltext-parts">${partsHtml(item, q)}</div>
                  </article>`;
              })
              .join('');
            return `
              <section class="laws-fulltext-chapter">
                <h3>${escapeHtml(chapter)}</h3>
                ${arts}
              </section>`;
          })
          .join('');
        return `
          <section class="laws-fulltext-doc">
            <h2 class="laws-fulltext-doc-title">${escapeHtml(group.title || group.label)}</h2>
            ${chapters}
          </section>`;
      })
      .join('');

    fulltext.innerHTML = head + body;
    $('laws-reader').scrollTop = 0;
  }

  function findItemById(id) {
    const full = (state.fullItems || []).find((item) => item.id === id);
    if (full) return full;
    return (state.activeItems || []).find((item) => item.id === id) || null;
  }

  async function selectItem(id) {
    state.selectedChapterKey = null;
    state.selectedId = id;
    setViewMode('list');
    renderScopeBar();
    renderList();
    let item = findItemById(id);
    if (item && !itemHasFullText(item)) {
      $('laws-reader-empty').hidden = true;
      $('laws-reader-article').hidden = false;
      $('laws-reader-body').innerHTML = '<p class="laws-loading">Загрузка текста статьи…</p>';
      await ensureFullCorpus();
      item = findItemById(id);
    }
    renderReader(item);
    const row = $('laws-list')?.querySelector(`.laws-row[data-id="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateMeta() {
    const isLaws = state.mode === 'laws';
    const when = isLaws
      ? state._manifest && state._manifest.articles && state._manifest.articles.lastUpdated
      : state._manifest && state._manifest.rules && state._manifest.rules.lastUpdated;
    const count = isLaws
      ? state._manifest && state._manifest.articles && state._manifest.articles.totalArticles
      : state._manifest && state._manifest.rules && state._manifest.rules.totalPoints;
    const label = isLaws ? 'статей' : 'пунктов';
    $('laws-meta').textContent = when
      ? `Обновлено ${formatDate(when)}${count != null ? ` · ${count} ${label}` : ''}`
      : count != null
        ? `${count} ${label}`
        : 'Справочник RMRP';
  }

  function setViewMode(view) {
    state.viewMode = view;
    $('laws-workspace').dataset.view = view;
    $('laws-view-list').classList.toggle('is-active', view === 'list');
    $('laws-view-fulltext').classList.toggle('is-active', view === 'fulltext');
    if (view === 'list') {
      const fulltext = $('laws-fulltext');
      fulltext.hidden = true;
      fulltext.innerHTML = '';
    }
  }

  async function refresh({ keepSelection = true } = {}) {
    const seq = ++state.refreshSeq;
    try {
      const items = await ensureListCorpus();
      if (seq !== state.refreshSeq) return;
      state.activeItems = items;
      state.fullItems = null;
      state.filtered = filterItems(items);
      renderScopeBar();
      renderDocList();

      if (state.viewMode === 'fulltext') {
        await ensureFullCorpus();
        if (seq !== state.refreshSeq) return;
        state.filtered = filterItems(state.fullItems || items);
        renderFullText();
      } else {
        // страховка: полный текст не должен оставаться в DOM в режиме статей
        const fulltext = $('laws-fulltext');
        fulltext.hidden = true;
        fulltext.innerHTML = '';
        renderList();
        const q = state.query.trim();
        if (!q) {
          state.selectedId = null;
          state.selectedChapterKey = null;
          renderReader(null);
        } else {
          const selectedInResults =
            state.selectedId && state.filtered.some((item) => item.id === state.selectedId);

          if (state.filtered.length && !selectedInResults && !state.selectedChapterKey) {
            const best = state.filtered[0];
            state.selectedChapterKey = null;
            state.selectedId = best.id;
            if (best.chapter) {
              setChapterExpanded(itemKey(best), best.chapter, true);
            }
            renderList();
            let item = findItemById(best.id);
            if (item && !itemHasFullText(item)) {
              await ensureFullCorpus();
              if (seq !== state.refreshSeq) return;
              item = findItemById(best.id);
            }
            renderReader(item);
            const row = $('laws-list')?.querySelector(`.laws-row[data-id="${CSS.escape(best.id)}"]`);
            row?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          } else if (keepSelection && state.selectedChapterKey) {
            const sep = state.selectedChapterKey.indexOf('::');
            const groupKey = sep >= 0 ? state.selectedChapterKey.slice(0, sep) : '';
            const chapter = sep >= 0 ? state.selectedChapterKey.slice(sep + 2) : '';
            if (groupKey && chapter) {
              setChapterExpanded(groupKey, chapter, true);
              renderList();
              let chapterItems = resolveChapterItemsFull(groupKey, chapter);
              if (chapterItems.some((item) => !itemHasFullText(item))) {
                await ensureFullCorpus();
                if (seq !== state.refreshSeq) return;
                chapterItems = resolveChapterItemsFull(groupKey, chapter);
              }
              if (chapterItems.length) {
                renderChapterReader(chapter, chapterItems);
              } else {
                state.selectedChapterKey = null;
                renderReader(null);
              }
            } else {
              state.selectedChapterKey = null;
              renderReader(null);
            }
          } else if (keepSelection && state.selectedId) {
            let item = findItemById(state.selectedId);
            if (item && !itemHasFullText(item)) {
              await ensureFullCorpus();
              if (seq !== state.refreshSeq) return;
              item = findItemById(state.selectedId);
            }
            if (item) {
              renderReader(item);
            } else {
              state.selectedId = null;
              renderReader(null);
            }
          } else {
            state.selectedId = null;
            state.selectedChapterKey = null;
            renderReader(null);
          }
        }
      }
      updateMeta();
    } catch (err) {
      if (seq !== state.refreshSeq) return;
      console.error(err);
      $('laws-meta').textContent = 'Не удалось загрузить данные';
      $('laws-list').innerHTML =
        '<p class="laws-empty">Сначала выполните <code>npm run site:data</code>.</p>';
    }
  }

  function wireUi() {
    if (wireUi._done) return;
    wireUi._done = true;

    document.querySelectorAll('.laws-mode-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        if (mode === state.mode) return;
        if (mode === 'rules') await loadRulesRegistry();
        state.mode = mode;
        state.tabKey = defaultTabKey();
        state.corpusCache = {
          laws: {},
          lawsFull: {},
          rules: {},
          rulesFull: {},
          lawsAll: null,
          lawsAllFull: null,
          rulesAll: null,
          rulesAllFull: null,
        };
        state.selectedId = null;
        state.selectedChapterKey = null;
        setViewMode('list');
        state.docFilter = '';
        state.expandedChapters = {};
        setDropdownOpen(false);
        document.querySelectorAll('.laws-mode-btn').forEach((b) => {
          const on = b.dataset.mode === mode;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        document.body.classList.remove('laws-reading');
        await refresh({ keepSelection: false });
      });
    });

    $('laws-all-btn').addEventListener('click', () => {
      state.tabKey = 'ALL';
      state.selectedId = null;
      state.selectedChapterKey = null;
      state.expandedChapters = {};
      document.body.classList.remove('laws-reading');
      setDropdownOpen(false);
      refresh({ keepSelection: false });
    });

    $('laws-doc-trigger').addEventListener('click', (e) => {
      e.stopPropagation();
      setDropdownOpen(!state.dropdownOpen);
    });

    $('laws-doc-filter').addEventListener('input', () => {
      state.docFilter = $('laws-doc-filter').value;
      renderDocList();
    });

    $('laws-doc-list').addEventListener('click', (e) => {
      const item = e.target.closest('.laws-doc-item');
      if (!item) return;
      state.tabKey = item.dataset.key;
      state.selectedId = null;
      state.selectedChapterKey = null;
      state.expandedChapters = {};
      setDropdownOpen(false);
      refresh({ keepSelection: false });
    });

    document.addEventListener('click', (e) => {
      if (!state.dropdownOpen) return;
      if (!$('laws-doc-dropdown').contains(e.target)) setDropdownOpen(false);
    });

    document.querySelectorAll('.laws-view-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const view = btn.dataset.view;
        if (view === state.viewMode) return;
        setViewMode(view);
        document.body.classList.remove('laws-reading');
        await refresh({ keepSelection: true });
      });
    });

    let debounce;
    $('laws-search-input').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.query = $('laws-search-input').value;
        const hasQuery = !!state.query.trim();
        if (!hasQuery) {
          state.selectedId = null;
          state.selectedChapterKey = null;
        }
        refresh({ keepSelection: hasQuery });
      }, 160);
    });

    $('laws-list').addEventListener('click', (e) => {
      const openChapterBtn = e.target.closest('.laws-chapter-open');
      if (openChapterBtn) {
        e.stopPropagation();
        void selectChapter(openChapterBtn.dataset.group, openChapterBtn.dataset.chapter);
        return;
      }
      const toggle = e.target.closest('.laws-chapter-toggle');
      if (toggle) {
        const groupKey = toggle.dataset.group;
        const chapter = toggle.dataset.chapter;
        setChapterExpanded(groupKey, chapter, !isChapterExpanded(groupKey, chapter));
        renderList();
        return;
      }
      const row = e.target.closest('.laws-row');
      if (!row) return;
      void selectItem(row.dataset.id);
    });

    $('laws-reader').addEventListener('click', (e) => {
      const link = e.target.closest('.laws-ref-link');
      if (!link) return;
      e.preventDefault();
      openReference({
        code: link.dataset.code,
        nums: (link.dataset.nums || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        chapter: link.dataset.chapter || '',
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        document.body.classList.remove('laws-reading');
      }
    });
  }

  async function loadRulesRegistry() {
    if (state.rulesRegistry) return state.rulesRegistry;
    const [rules, rulesMeta] = await Promise.all([
      fetchJson('/data/rules.json'),
      fetchJson('/data/rules_meta.json').catch(() => null),
    ]);
    state.rulesRegistry = rules;
    if (rulesMeta && state._manifest) {
      state._manifest.rules = {
        lastUpdated: rulesMeta.lastUpdated,
        totalPoints: rulesMeta.totalPoints,
        parserVersion: rulesMeta.parserVersion,
      };
      updateMeta();
    }
    return state.rulesRegistry;
  }

  async function init() {
    if (!document.getElementById('laws-list')) {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }

    setLoading('Загрузка справочника…');
    const loadTimeout = setTimeout(() => {
      setLoading('Долгая загрузка… проверьте консоль (F12) или обновите Ctrl+F5');
    }, 8000);

    try {
      const [laws, meta] = await startBootstrap();
      state.lawsRegistry = Array.isArray(laws) ? laws : [];
      state._manifest = {
        articles: meta
          ? {
              lastUpdated: meta.lastUpdated,
              totalArticles: meta.totalArticles,
              parserVersion: meta.parserVersion,
            }
          : null,
        rules: null,
      };
      try {
        const manifest = await fetchJson('/data/manifest.json');
        if (manifest) state._manifest = { ...state._manifest, ...manifest };
      } catch {
        /* optional */
      }
    } catch (err) {
      clearTimeout(loadTimeout);
      console.error(err);
      $('laws-meta').textContent = 'Реестры не загружены';
      $('laws-list').innerHTML = '<p class="laws-empty">Сначала: <code>npm run site:data</code></p>';
      document.body.classList.add('page-loaded');
      return;
    }

    state.tabKey = defaultTabKey();
    wireUi();
    await refresh({ keepSelection: false });
    applyStaticVersion();
    document.body.classList.add('page-loaded');
    clearTimeout(loadTimeout);
    void loadRulesRegistry();
  }

  function applyStaticVersion() {
    const version = (window.SITE_CONFIG && window.SITE_CONFIG.appVersion) || '—';
    document.querySelectorAll('[data-version], #latest-version').forEach((el) => {
      el.textContent = version;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
