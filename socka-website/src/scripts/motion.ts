const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function animateCounter(counter: HTMLElement) {
  if (counter.dataset.countStarted === 'true') return;
  counter.dataset.countStarted = 'true';

  if (reduceMotion()) {
    counter.classList.add('is-counted');
    return;
  }

  const formatter = new Intl.NumberFormat('hr-HR');
  const target = Number(counter.dataset.countTo || '0');
  const suffix = counter.dataset.countSuffix || '';
  const plain = counter.dataset.countPlain === 'true';
  const duration = 900;
  const start = performance.now();

  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - start) / duration);
    const value = Math.round(target * easeOutCubic(elapsed));
    counter.textContent = `${plain ? String(value) : formatter.format(value)}${suffix}`;

    if (elapsed < 1) {
      requestAnimationFrame(tick);
    } else {
      counter.classList.add('is-counted');
    }
  };

  requestAnimationFrame(tick);
}

function updateScrollState() {
  const header = document.querySelector('[data-header]');

  if (header instanceof HTMLElement) {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  if (!reduceMotion()) {
    document.querySelectorAll<HTMLElement>('[data-scroll-story]').forEach((section) => {
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const range = viewport + rect.height;
      const value = Math.min(1, Math.max(0, (viewport - rect.top) / range));
      section.style.setProperty('--story-progress', value.toFixed(3));
    });
  }
}

function setupRevealObserver() {
  const items = [
    ...document.querySelectorAll('.reveal'),
    ...document.querySelectorAll('[data-count-to]'),
    ...document.querySelectorAll('[data-motion-section]')
  ];

  if (items.length === 0) return;

  if (reduceMotion() || !('IntersectionObserver' in window)) {
    items.forEach((item) => {
      item.classList.add('is-visible');
      if (item instanceof HTMLElement && item.matches('[data-count-to]')) animateCounter(item);
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        if (entry.target instanceof HTMLElement && entry.target.matches('[data-count-to]')) {
          animateCounter(entry.target);
        }
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((item) => {
    if (item instanceof HTMLElement && item.dataset.motionObserved === 'true') return;
    if (item instanceof HTMLElement) item.dataset.motionObserved = 'true';
    observer.observe(item);
  });
}

export function initSiteMotion() {
  updateScrollState();
  setupRevealObserver();

  if (document.documentElement.dataset.motionReady !== 'true') {
    document.documentElement.dataset.motionReady = 'true';
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });
    document.addEventListener('astro:page-load', () => {
      updateScrollState();
      setupRevealObserver();
    });
  }
}
