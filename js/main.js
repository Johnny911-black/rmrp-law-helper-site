(function () {
  const cfg = window.SITE_CONFIG || {};
  const user = cfg.githubUser || 'YOUR_GITHUB_USERNAME';
  const repo = cfg.githubRepo || 'rmrp-law-helper';
  const setup = encodeURIComponent(cfg.setupFileName || 'RMRP Law Helper-Setup.exe');
  const hotkey = cfg.defaultHotkey || 'F9';
  const fallbackVersion = String(cfg.appVersion || '').trim();

  const repoUrl = `https://github.com/${user}/${repo}`;
  const releasesUrl = `${repoUrl}/releases`;
  const setupDownloadUrl = `${repoUrl}/releases/latest/download/${setup}`;
  const apiUrl = `https://api.github.com/repos/${user}/${repo}/releases/latest`;

  document.querySelectorAll('[data-hotkey]').forEach((el) => {
    el.textContent = hotkey;
  });

  const isConfigured = user !== 'YOUR_GITHUB_USERNAME';

  document.querySelectorAll('.setup-download-link, #download-setup-btn').forEach((el) => {
    el.href = isConfigured ? setupDownloadUrl : releasesUrl;
  });

  document.querySelectorAll('.download-link, #download-btn-footer').forEach((el) => {
    const href = (el.getAttribute('href') || '').trim();
    if (href.endsWith('download.html')) {
      return;
    }
    el.href = isConfigured ? setupDownloadUrl : releasesUrl;
  });

  const setupLabel = document.querySelector('.setup-file-label');
  if (setupLabel && cfg.setupFileName) {
    setupLabel.textContent = cfg.setupFileName;
  }

  document.querySelectorAll('.github-link').forEach((el) => {
    el.href = repoUrl;
  });

  document.querySelectorAll('#github-btn, .github-releases-link').forEach((el) => {
    el.href = isConfigured ? releasesUrl : repoUrl;
  });

  const versionEl = document.getElementById('latest-version');
  const cached = tryReadVersionCache();
  if (fallbackVersion) applyVersion(fallbackVersion);
  else if (cached) applyVersion(cached);

  if (!isConfigured) {
    if (versionEl && !fallbackVersion) versionEl.textContent = '—';
    return;
  }

  fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data?.tag_name) return;
      writeVersionCache(data.tag_name);
      applyVersion(normalizeVersion(data.tag_name));
    })
    .catch(() => {
      if (!fallbackVersion && !cached && versionEl) versionEl.textContent = 'Releases';
    });

  function normalizeVersion(tag) {
    return String(tag).replace(/^v/i, '');
  }

  function applyVersion(tag) {
    const version = normalizeVersion(tag);
    if (versionEl) versionEl.textContent = version;
    document.querySelectorAll('[data-version]').forEach((el) => {
      el.textContent = version;
    });
  }

  function tryReadVersionCache() {
    try {
      const raw = localStorage.getItem('rlh_latest_version');
      if (!raw) return null;
      const { tag, at } = JSON.parse(raw);
      if (Date.now() - at > 3600000) return null;
      return tag;
    } catch {
      return null;
    }
  }

  function writeVersionCache(tag) {
    try {
      localStorage.setItem('rlh_latest_version', JSON.stringify({ tag, at: Date.now() }));
    } catch { /* ignore */ }
  }

  const videoId = String(cfg.youtubeVideoId || '').trim();
  const videoSection = document.getElementById('video-review');
  const videoWrap = document.querySelector('[data-youtube-wrap]');
  const videoIframe = document.querySelector('[data-youtube-iframe]');

  if (videoId && videoWrap && videoIframe) {
    videoIframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    videoWrap.hidden = false;
  } else if (videoSection) {
    videoSection.hidden = true;
  }
})();
