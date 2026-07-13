(function () {
  const page = document.body.dataset.page || 'home';
  const pages = [
    { id: 'home', href: 'index.html', label: 'Главная' },
    { id: 'features', href: 'features.html', label: 'Возможности' },
    { id: 'updates', href: 'updates.html', label: 'Обновления' },
    { id: 'faq', href: 'faq.html', label: 'FAQ' },
  ];

  const navLinks = pages
    .map((p) => `<a href="${p.href}" class="nav-link${p.id === page ? ' is-active' : ''}">${p.label}</a>`)
    .join('');

  const mobileNavLinks = pages
    .map((p) => `
      <a href="${p.href}" class="mobile-nav-link${p.id === page ? ' is-active' : ''}">
        <span class="mobile-nav-link-label">${p.label}</span>
        <span class="mobile-nav-link-arrow" aria-hidden="true">›</span>
      </a>
    `)
    .join('');

  const header = `
    <header class="site-header" id="top">
      <div class="container site-header-inner">
        <a class="logo" href="index.html">
          <span class="logo-mark" aria-hidden="true">⚖</span>
          <span>RMRP Law Helper</span>
        </a>
        <nav class="nav" aria-label="Навигация">${navLinks}</nav>
        <a class="btn btn-primary btn-sm header-download download-link" href="download.html">Скачать</a>
        <button type="button" class="nav-toggle" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-nav-panel">
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
        </button>
      </div>
      <div class="mobile-nav" id="mobile-nav" hidden>
        <button type="button" class="mobile-nav-backdrop" aria-label="Закрыть меню" tabindex="-1"></button>
        <div class="mobile-nav-panel" id="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Меню сайта">
          <div class="mobile-nav-panel-head">
            <div>
              <p class="mobile-nav-kicker">RMRP Law Helper</p>
              <p class="mobile-nav-title">Навигация</p>
            </div>
            <button type="button" class="mobile-nav-close" aria-label="Закрыть меню">×</button>
          </div>
          <nav class="mobile-nav-inner" aria-label="Мобильная навигация">${mobileNavLinks}</nav>
          <div class="mobile-nav-footer">
            <a class="btn btn-primary download-link mobile-nav-download" href="download.html">Скачать для Windows</a>
            <p class="mobile-nav-version">Версия: <strong data-version>…</strong></p>
          </div>
        </div>
      </div>
    </header>
  `;

  const footer = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="footer-brand">RMRP Law Helper</div>
          <p class="footer-desc">Неофициальный overlay-помощник для игроков RMRP. Без регистрации и аналитики.</p>
        </div>
        <div class="footer-links">
          <a href="features.html">Возможности</a>
          <a href="download.html">Скачать</a>
          <a href="updates.html">Обновления</a>
          <a href="faq.html">FAQ</a>
          <a class="github-link" href="#" rel="noopener noreferrer" target="_blank">GitHub</a>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>Windows 10/11 · Open source · <span data-hotkey>F9</span> overlay</span>
        <span>Версия: <strong id="latest-version">…</strong></span>
      </div>
    </footer>
  `;

  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);

  const headerEl = document.querySelector('.site-header');
  const mobileNav = document.querySelector('.mobile-nav');
  const toggle = document.querySelector('.nav-toggle');
  const closeBtn = document.querySelector('.mobile-nav-close');
  const backdrop = document.querySelector('.mobile-nav-backdrop');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  function setMobileNavOpen(open) {
    if (!mobileNav || !toggle) return;
    mobileNav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    headerEl?.classList.toggle('mobile-nav-open', open);
    document.body.classList.toggle('mobile-nav-lock', open);
    if (open) closeBtn?.focus();
  }

  toggle?.addEventListener('click', () => {
    const willOpen = mobileNav.hidden;
    setMobileNavOpen(willOpen);
  });

  closeBtn?.addEventListener('click', () => setMobileNavOpen(false));
  backdrop?.addEventListener('click', () => setMobileNavOpen(false));
  mobileLinks.forEach((link) => link.addEventListener('click', () => setMobileNavOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobileNav.hidden) setMobileNavOpen(false);
  });

  const onScroll = () => {
    headerEl?.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
