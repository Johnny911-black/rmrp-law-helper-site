(function () {
  const cfg = window.SITE_CONFIG || {};
  const user = cfg.githubUser || 'YOUR_GITHUB_USERNAME';
  const repo = cfg.githubRepo || 'rmrp-law-helper';
  const hotkey = cfg.defaultHotkey || 'F9';
  const fallbackVersion = String(cfg.appVersion || '').trim();
  const fallbackSetupName = String(cfg.setupFileName || '').trim();

  const repoUrl = `https://github.com/${user}/${repo}`;
  const releasesUrl = `${repoUrl}/releases`;
  const apiUrl = `https://api.github.com/repos/${user}/${repo}/releases/latest`;

  document.querySelectorAll('[data-hotkey]').forEach((el) => {
    el.textContent = hotkey;
  });

  const isConfigured = user !== 'YOUR_GITHUB_USERNAME';

  let setupDownloadUrl = releasesUrl;

  document.querySelectorAll('.setup-download-link, #download-setup-btn').forEach((el) => {
    el.href = setupDownloadUrl;
  });

  document.querySelectorAll('.download-link, #download-btn-footer').forEach((el) => {
    const href = (el.getAttribute('href') || '').trim();
    if (href.endsWith('download.html')) {
      return;
    }
    el.href = setupDownloadUrl;
  });

  document.querySelectorAll('.github-link').forEach((el) => {
    el.href = repoUrl;
  });

  document.querySelectorAll('#github-btn, .github-releases-link').forEach((el) => {
    el.href = isConfigured ? releasesUrl : repoUrl;
  });

  const mirrors = cfg.downloadMirrors && typeof cfg.downloadMirrors === 'object'
    ? cfg.downloadMirrors
    : {};
  const mirrorEntries = [
    { id: 'download-mirror-yandex', url: String(mirrors.yandex || '').trim() },
    { id: 'download-mirror-google', url: String(mirrors.google || '').trim() },
  ];
  const mirrorsBlock = document.getElementById('download-mirrors');
  let mirrorsVisible = 0;
  mirrorEntries.forEach(({ id, url }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!url) {
      el.hidden = true;
      return;
    }
    el.href = url;
    el.hidden = false;
    mirrorsVisible += 1;
  });
  if (mirrorsBlock) {
    mirrorsBlock.hidden = mirrorsVisible === 0;
  }

  const versionEl = document.getElementById('latest-version');
  const filenameBlock = document.getElementById('download-setup-filename');
  const filenameCode = filenameBlock?.querySelector('code');

  const cached = tryReadVersionCache();
  if (fallbackVersion) applyVersion(fallbackVersion);
  else if (cached) applyVersion(cached);

  if (!isConfigured) {
    if (versionEl && !fallbackVersion) versionEl.textContent = '—';
    return;
  }

  const releaseTag = cached || (fallbackVersion ? formatReleaseTag(fallbackVersion) : 'latest');
  if (fallbackSetupName) {
    applySetupDownload(
      buildReleaseDownloadUrl(releaseTag, fallbackSetupName),
      toGitHubAssetName(fallbackSetupName),
    );
  }

  fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) {
        applyFallbackDownload(releaseTag);
        return;
      }

      if (data.tag_name) {
        writeVersionCache(data.tag_name);
        applyVersion(normalizeVersion(data.tag_name));
      }

      const asset = findSetupAsset(data.assets);
      if (asset?.browser_download_url) {
        applySetupDownload(asset.browser_download_url, asset.name);
        return;
      }

      applyFallbackDownload(data.tag_name || releaseTag);
    })
    .catch(() => {
      if (!fallbackVersion && !cached && versionEl) versionEl.textContent = 'Releases';
      applyFallbackDownload(releaseTag);
    });

  function findSetupAsset(assets) {
    if (!Array.isArray(assets) || !assets.length) return null;

    const sorted = [...assets].sort((a, b) => {
      const aSetup = /setup/i.test(a.name);
      const bSetup = /setup/i.test(b.name);
      if (aSetup !== bSetup) return aSetup ? -1 : 1;
      return 0;
    });

    return sorted.find((asset) => (
      /\.exe$/i.test(asset.name)
      && !/uninstall/i.test(asset.name)
      && !/blockmap/i.test(asset.name)
    )) || null;
  }

  function applySetupDownload(url, filename) {
    setupDownloadUrl = url;

    document.querySelectorAll('.setup-download-link, #download-setup-btn').forEach((el) => {
      el.href = url;
    });

    document.querySelectorAll('.download-link, #download-btn-footer').forEach((el) => {
      const href = (el.getAttribute('href') || '').trim();
      if (href.endsWith('download.html')) return;
      el.href = url;
    });

    if (filename && filenameBlock && filenameCode) {
      filenameCode.textContent = filename;
      filenameBlock.hidden = false;
    }
  }

  function applyFallbackDownload(tag) {
    if (!fallbackSetupName) return;
    applySetupDownload(
      buildReleaseDownloadUrl(tag, fallbackSetupName),
      toGitHubAssetName(fallbackSetupName),
    );
  }

  /** GitHub заменяет пробелы в имени файла на точки при загрузке в Release. */
  function toGitHubAssetName(filename) {
    return String(filename).replace(/\s+/g, '.');
  }

  function formatReleaseTag(version) {
    const value = String(version).trim();
    if (!value) return 'latest';
    return /^v/i.test(value) ? value : `v${value}`;
  }

  function buildReleaseDownloadUrl(tag, filename) {
    const assetName = toGitHubAssetName(filename);
    const urlTag = formatReleaseTag(tag);
    return `${repoUrl}/releases/download/${urlTag}/${encodeURIComponent(assetName)}`;
  }

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
