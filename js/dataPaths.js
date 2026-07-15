/**
 * Resolve JSON paths under site/data/ (sharded for GitHub upload limits).
 * @param {string} filename
 * @param {'law'|'rule'|undefined} [kind] — required for *_index.json except all_*
 */
function rmrpDataUrl(filename, kind) {
  const CORE = new Set([
    'laws.json',
    'rules.json',
    'meta.json',
    'rules_meta.json',
    'manifest.json',
    'all_articles.json',
    'all_rules.json',
    'all_articles_index.json',
    'all_rules_index.json',
  ]);

  const name = String(filename || '').split('/').pop();
  if (CORE.has(name)) return `data/core/${name}`;
  if (/_articles\.json$/i.test(name) || kind === 'law') return `data/laws/${name}`;
  if (/_rules\.json$/i.test(name) || kind === 'rule') return `data/rules/${name}`;
  if (/_index\.json$/i.test(name)) {
    return (kind === 'rule' ? 'data/rules/' : 'data/laws/') + name;
  }
  return `data/core/${name}`;
}

if (typeof window !== 'undefined') {
  window.rmrpDataUrl = rmrpDataUrl;
}
