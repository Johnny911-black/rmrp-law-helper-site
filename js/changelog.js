(function () {
  const cfg = window.SITE_CONFIG || {};
  const user = cfg.githubUser || 'YOUR_GITHUB_USERNAME';
  const repo = cfg.githubRepo || 'rmrp-law-helper';
  const fallback = Array.isArray(cfg.changelogFallback) ? cfg.changelogFallback : [];

  const root = document.getElementById('changelog-root');
  if (!root) return;

  const releasesLink = document.querySelector('.github-releases-link');
  const repoUrl = `https://github.com/${user}/${repo}`;
  if (releasesLink) releasesLink.href = `${repoUrl}/releases`;

  const isConfigured = user !== 'YOUR_GITHUB_USERNAME';
  if (!isConfigured) {
    renderEntries(fallback.length ? fallback : [{
      version: cfg.appVersion || '1.0',
      date: '',
      title: 'RMRP Law Helper',
      body: 'Настройте githubUser и githubRepo в config.js или добавьте changelogFallback.',
    }]);
    return;
  }

  fetch(`https://api.github.com/repos/${user}/${repo}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('fetch failed'))))
    .then((releases) => {
      const entries = releases
        .filter((r) => !r.draft && !r.prerelease)
        .map((r) => ({
          version: normalizeVersion(r.tag_name),
          date: r.published_at,
          title: r.name || r.tag_name,
          body: r.body || '',
          url: r.html_url,
        }));
      if (!entries.length && fallback.length) {
        renderEntries(fallback);
        return;
      }
      renderEntries(entries);
    })
    .catch(() => {
      if (fallback.length) {
        renderEntries(fallback);
        return;
      }
      root.innerHTML = '<p class="changelog-status">Не удалось загрузить список версий. Откройте <a href="' + repoUrl + '/releases">GitHub Releases</a>.</p>';
    });

  function normalizeVersion(tag) {
    return String(tag || '').replace(/^v/i, '');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatBody(body) {
    if (!body || !String(body).trim()) {
      return '<p class="changelog-empty">Без описания изменений.</p>';
    }
    return '<div class="changelog-body">' + escapeHtml(body.trim()) + '</div>';
  }

  function renderEntries(entries) {
    if (!entries.length) {
      root.innerHTML = '<p class="changelog-status">Пока нет опубликованных релизов.</p>';
      return;
    }

    root.innerHTML = entries.map((entry, index) => {
      const date = formatDate(entry.date);
      const latest = index === 0 ? '<span class="changelog-badge">Последняя</span>' : '';
      const link = entry.url
        ? `<a class="changelog-release-link" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener">Релиз на GitHub</a>`
        : '';
      return `
        <article class="changelog-item reveal">
          <header class="changelog-item-head">
            <div>
              <h2 class="changelog-version">v${escapeHtml(entry.version)} ${latest}</h2>
              ${entry.title ? `<p class="changelog-title">${escapeHtml(entry.title)}</p>` : ''}
            </div>
            ${date ? `<time class="changelog-date" datetime="${escapeHtml(entry.date || '')}">${date}</time>` : ''}
          </header>
          ${formatBody(entry.body)}
          ${link}
        </article>
      `;
    }).join('');

    window.observeReveals?.(root);
  }
})();
