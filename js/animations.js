(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function observeReveals(root) {
    const scope = root || document;
    const targets = scope.querySelectorAll('.reveal:not(.is-visible)');
    if (!targets.length) return;

    if (prefersReduced) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    targets.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i % 6, 5) * 70}ms`);
      observer.observe(el);
    });
  }

  window.observeReveals = observeReveals;
  observeReveals(document);
  document.body.classList.add('page-loaded');
})();
