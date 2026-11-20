/*! springhouse-site-animations v0.1.0
 * GSAP + ScrollTrigger (+ SplitText) driven by data-* hooks on v2-* elements.
 * Hooks: data-parallax, data-reveal (lines|fade|rise|pop), data-mask, data-draw, data-clip.
 * data-slider="pin" is owned by the vanilla slider script on the Refrigerator page; this file only
 * adds the data-clip wipes inside it and never touches slide transforms.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function release() {
    root.classList.remove('v2-js');
    root.classList.add('v2-ready');
  }

  if (!window.gsap || !window.ScrollTrigger) {
    release();
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = !!window.SplitText;
  if (hasSplit) gsap.registerPlugin(window.SplitText);

  function all(sel) {
    return gsap.utils.toArray(sel);
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function init(conditions) {
    var motion = conditions.motion;
    var wide = conditions.wide;

    if (!motion) {
      gsap.set('[data-reveal]', { autoAlpha: 1 });
      release();
      return;
    }

    /* ---------- reveals ---------- */

    // lines (headings)
    all('[data-reveal="lines"]').forEach(function (el) {
      if (!hasSplit) {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          }
        );
        return;
      }
      window.SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: function (self) {
          gsap.set(el, { autoAlpha: 1 });
          return gsap.from(self.lines, {
            yPercent: 110,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          });
        }
      });
    });

    // fade
    all('[data-reveal="fade"]').forEach(function (el) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        }
      );
    });

    // rise (uses yPercent so it never fights data-parallax, which uses y)
    var rise = all('[data-reveal="rise"]');
    if (rise.length) {
      gsap.set(rise, { autoAlpha: 0, yPercent: 8 });
      ScrollTrigger.batch(rise, {
        start: 'top 90%',
        once: true,
        interval: 0.1,
        batchMax: 4,
        onEnter: function (batch) {
          gsap.to(batch, {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.1,
            overwrite: true
          });
        }
      });
    }

    // pop
    all('[data-reveal="pop"]').forEach(function (el) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, scale: 0.85 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.6,
          ease: 'back.out(1.6)',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        }
      );
    });

    /* ---------- parallax ---------- */

    all('[data-parallax]').forEach(function (el) {
      var f = num(el.getAttribute('data-parallax'), 0);
      if (!f) return;
      var k = wide ? 1 : 0.5;
      var trigger = el.closest('section') || el.parentElement || el;
      gsap.fromTo(
        el,
        {
          y: function () {
            return -f * k * window.innerHeight * 0.5;
          }
        },
        {
          y: function () {
            return f * k * window.innerHeight * 0.5;
          },
          ease: 'none',
          scrollTrigger: {
            trigger: trigger,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true
          }
        }
      );
    });

    /* ---------- mask (ellipse) ---------- */

    all('[data-mask="ellipse"]').forEach(function (el) {
      gsap.fromTo(
        el,
        { clipPath: 'ellipse(32% 24% at 50% 50%)' },
        {
          clipPath: 'ellipse(75% 75% at 50% 50%)',
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            end: 'top 25%',
            scrub: true
          }
        }
      );
    });

    /* ---------- draw ---------- */

    all('[data-draw]').forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      var st = { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: true };
      if (tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'circle') {
        var len = el.getTotalLength ? el.getTotalLength() : 0;
        gsap.fromTo(
          el,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, ease: 'none', scrollTrigger: st }
        );
        return;
      }
      // plain div used as a line: grow along its long axis
      var horizontal = el.offsetWidth >= el.offsetHeight;
      gsap.fromTo(
        el,
        horizontal
          ? { scaleX: 0, transformOrigin: 'left center' }
          : { scaleY: 0, transformOrigin: 'center top' },
        horizontal
          ? { scaleX: 1, ease: 'none', scrollTrigger: st }
          : { scaleY: 1, ease: 'none', scrollTrigger: st }
      );
    });

    /* ---------- slider clip wipes (desktop only) ---------- */

    var slider = document.querySelector('[data-slider="pin"]');
    if (slider && wide) {
      var slides = all('.v2-slide', slider);
      var n = slides.length;
      if (n > 1) {
        var medias = slides.map(function (s) {
          return s.querySelector('[data-clip]');
        });
        var update = function (self) {
          var p = self.progress * (n - 1);
          for (var i = 0; i < n; i++) {
            var m = medias[i];
            if (!m) continue;
            var d = Math.min(1, Math.abs(i - p));
            m.style.clipPath = d === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% ' + d * 45 + '% 0%)';
          }
        };
        ScrollTrigger.create({
          trigger: slider,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: update,
          onRefresh: update
        });
        return function () {
          medias.forEach(function (m) {
            if (m) m.style.clipPath = '';
          });
        };
      }
    }
  }

  var mm = gsap.matchMedia();
  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      wide: '(min-width: 992px)'
    },
    function (ctx) {
      var cleanup = init(ctx.conditions);
      release();
      return cleanup;
    }
  );

  window.addEventListener('load', function () {
    ScrollTrigger.refresh();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      ScrollTrigger.refresh();
    });
  }
})();
