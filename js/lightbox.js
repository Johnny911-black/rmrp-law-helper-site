(function () {
  const SELECTOR = '.gallery-item, .screenshot-frame';

  function getImage(host) {
    return host.querySelector('img');
  }

  function getCaption(host) {
    const cap = host.querySelector('figcaption, .screenshot-caption');
    return cap ? cap.textContent.trim() : '';
  }

  function openLightbox(img, caption) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Увеличенный скриншот');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lightbox-close';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.textContent = '×';

    const figure = document.createElement('figure');
    figure.className = 'lightbox-content';

    const fullImg = document.createElement('img');
    fullImg.src = img.currentSrc || img.src;
    fullImg.alt = img.alt || '';
    figure.appendChild(fullImg);

    if (caption) {
      const capEl = document.createElement('figcaption');
      capEl.textContent = caption;
      figure.appendChild(capEl);
    }

    overlay.append(closeBtn, figure);
    document.body.appendChild(overlay);
    document.body.classList.add('lightbox-open');
    closeBtn.focus();

    const close = () => {
      overlay.remove();
      document.body.classList.remove('lightbox-open');
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target === closeBtn) close();
    });
    document.addEventListener('keydown', onKey);
  }

  document.querySelectorAll(SELECTOR).forEach((host) => {
    const img = getImage(host);
    if (!img) return;

    host.classList.add('screenshot-expandable');
    host.setAttribute('tabindex', '0');
    host.setAttribute('role', 'button');
    host.setAttribute('aria-label', 'Открыть скриншот в полном размере');

    const activate = (e) => {
      e.preventDefault();
      openLightbox(img, getCaption(host));
    };

    host.addEventListener('click', activate);
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') activate(e);
    });
  });
})();
