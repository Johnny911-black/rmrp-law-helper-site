(function () {
  const page = document.body.dataset.page || 'home';
  const pages = [
    { id: 'home', href: 'index.html', label: 'Главная' },
    { id: 'features', href: 'features.html', label: 'Возможности' },
    { id: 'download', href: 'download.html', label: 'Скачать' },
    { id: 'faq', href: 'faq.html', label: 'FAQ' },
  ];

  const navLinks = pages
    .map((p) => `<a href="${p.href}" class="nav-link${p.id === page ? ' is-active' : ''}">${p.label}</a>`)
    .join('');

  const header = `
    <header class="site-header" id="top">
      <div class="container site-header-inner">
        <a class="logo" href="index.html">
          <span class="logo-mark" aria-hidden="true">⚖</span>
          <span>RMRP Law Helper</span>
        </a>
        <nav class="nav" aria-label="Навигация">${navLinks}</nav>
        <a class="btn btn-primary btn-sm download-link" href="download.html">Скачать</a>
        <button type="button" class="nav-toggle" aria-label="Меню" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="mobile-nav" hidden>
        <div class="container mobile-nav-inner">${navLinks}</div>
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

  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  toggle?.addEventListener('click', () => {
    const open = mobileNav.hidden;
    mobileNav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  const headerEl = document.querySelector('.site-header');
  const onScroll = () => {
    headerEl?.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
