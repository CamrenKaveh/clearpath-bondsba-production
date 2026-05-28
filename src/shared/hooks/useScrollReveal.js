import { useEffect, useRef } from 'react';

/**
 * Adds `.is-visible` to any element with class `.reveal` once it enters the viewport.
 * One-shot — does not un-reveal on scroll up. Respects prefers-reduced-motion via CSS.
 *
 * Usage:
 *   useScrollReveal();
 *   <section className="reveal">…</section>
 *   <section className="reveal reveal-delay-2">…</section>
 */
export function useScrollReveal({ rootMargin = '0px 0px -10% 0px', threshold = 0.1 } = {}) {
  const observerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin, threshold }
    );
    observerRef.current = observer;
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el));
    // Re-scan after any later DOM additions
    const rescan = () => {
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
        if (!el.dataset.bondsbaObserved) {
          observer.observe(el);
          el.dataset.bondsbaObserved = '1';
        }
      });
    };
    const mo = new MutationObserver(rescan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, [rootMargin, threshold]);
}
