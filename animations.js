/*! springhouse-site-animations v0.1.0
 * GSAP + ScrollTrigger (+ SplitText) driven by data-* hooks on v2-* elements.
 * Hooks: data-parallax, data-float, data-fan, data-reveal (lines|fade|rise|pop, add data-scrub to tie it to scroll), data-mask, data-draw, data-clip, data-scrub-video.
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

  // data-scrub on a reveal element ties it to scroll position instead of firing once.
  function revealTrigger(el, onceStart, scrubStart, scrubEnd) {
    return el.hasAttribute('data-scrub')
      ? { trigger: el, start: scrubStart || 'top 95%', end: scrubEnd || 'top 62%', scrub: true }
      : { trigger: el, start: onceStart, once: true };
  }

  var FLOAT_SCALE = 2.2; // multiplies every data-float-w

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  /* Scroll-scrubbed video: <video data-scrub-video>. Scroll position drives currentTime,
   * so scrolling down plays forward and scrolling up plays in reverse. The file must be encoded
   * with every frame a keyframe (ffmpeg -g 1) or reverse seeking will stutter.
   * wide: the host section pins for 1.5 viewports of scroll. Otherwise it scrubs while passing.
   * Reduced motion: no scrub, shows the final frame. */
  function scrubVideos(motion, wide) {
    var cleanups = [];

    all('video[data-scrub-video]').forEach(function (v) {
      var host = v.closest('section') || v.parentElement;
      v.muted = true;
      v.pause();

      // Feather the edges into the page background (Webflow's style panel has no CSS mask support).
      var feather =
        'linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%), ' +
        'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';
      v.style.webkitMaskImage = feather;
      v.style.maskImage = feather;
      v.style.webkitMaskComposite = 'source-in';
      v.style.maskComposite = 'intersect';

      var started = false;
      var target = 0;
      var current = 0;
      var tick;
      var st;

      function show() {
        v.style.opacity = '1';
      }

      function start() {
        if (started || !v.duration) return;
        started = true;

        if (!motion) {
          v.currentTime = Math.max(0, v.duration - 0.05);
          show();
          return;
        }

        // iOS only decodes a paused video after it has played once.
        var p = v.play();
        if (p && p.then) {
          p.then(function () {
            v.pause();
            v.currentTime = current;
          }).catch(function () {});
        }

        tick = function () {
          var d = target - current;
          if (Math.abs(d) < 0.002) return;
          current += d * 0.2;
          if (!v.seeking) v.currentTime = current;
        };
        gsap.ticker.add(tick);

        st = ScrollTrigger.create(
          wide
            ? {
                trigger: host,
                // Pin when the section fills the viewport: bottom-aligned on tall screens, top-aligned on short ones.
                start: function () {
                  return window.innerHeight >= host.offsetHeight ? 'bottom bottom' : 'top top';
                },
                end: function () {
                  return '+=' + Math.round(window.innerHeight * 1.5);
                },
                pin: true,
                anticipatePin: 1,
                refreshPriority: 1,
                invalidateOnRefresh: true,
                onUpdate: function (self) {
                  target = self.progress * v.duration;
                }
              }
            : {
                trigger: host,
                start: 'top 70%',
                end: 'bottom 40%',
                onUpdate: function (self) {
                  target = self.progress * v.duration;
                }
              }
        );
        show();
      }

      if (v.readyState >= 1) start();
      else v.addEventListener('loadedmetadata', start, { once: true });

      cleanups.push(function () {
        if (tick) gsap.ticker.remove(tick);
        if (st) st.kill();
        v.style.opacity = '';
      });
    });

    return function () {
      cleanups.forEach(function (fn) {
        fn();
      });
    };
  }

  /* Pinned multi-scene sequence: <section data-stage> with these roles inside it:
   *   data-stage-el="head"   title and subtitle (first = title, second = subtitle)
   *   data-stage-el="cards"  row of [data-fan] cards
   *   data-stage-el="link"   dot, [data-draw] wire and the [data-reveal="rise"] chips
   *   [data-float] images     drift through the whole sequence (data-float-x / -w / -r as usual)
   * Scenes: 1 head holds while food drifts behind, 2 head exits, 3 cards arrive and hold while the
   * food keeps moving, 4 cards fan, 5 dot and wire draw, chips stack and the group rises.
   * Layout is applied with gsap.set, so leaving desktop (matchMedia revert) restores the normal flow. */
  function buildStage(sec) {
    var heads = all('[data-stage-el="head"]', sec);
    var cardsWrap = sec.querySelector('[data-stage-el="cards"]');
    var link = sec.querySelector('[data-stage-el="link"]');
    if (!heads.length || !cardsWrap || !link) return;

    var title = heads[0];
    var sub = heads[1];
    var cards = all('[data-fan]', cardsWrap);
    var dot = link.querySelector('.v2-sm-dot');
    var wire = link.querySelector('[data-draw]');
    var chips = all('[data-reveal="rise"]', link);
    var floats = all('[data-float]', sec);
    var ch = cardsWrap.offsetHeight || 400;
    var GAP = 36;

    function vh() {
      return window.innerHeight;
    }

    gsap.set(sec, { height: '100vh', minHeight: 0, paddingTop: 0, paddingBottom: 0 });
    gsap.set(title, { position: 'absolute', left: 0, right: 0, top: 'calc(50% - 110px)', margin: 0, autoAlpha: 1 });
    if (sub) {
      gsap.set(sub, {
        position: 'absolute',
        left: 0,
        right: 0,
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 0,
        marginBottom: 0,
        top: 'calc(50% - 20px)',
        autoAlpha: 1
      });
    }
    gsap.set(cardsWrap, {
      position: 'absolute',
      left: 0,
      right: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: 0,
      top: 'calc(50% - ' + ch / 2 + 'px)',
      autoAlpha: 0
    });
    gsap.set(cards, { autoAlpha: 1, yPercent: 0 });
    gsap.set(link, { position: 'absolute', left: 0, right: 0, marginTop: 0, top: 'calc(50% + ' + (ch / 2 + GAP) + 'px)' });
    gsap.set(chips, { autoAlpha: 0, y: 40, yPercent: 0 });
    if (dot) gsap.set(dot, { scale: 0 });
    if (wire) gsap.set(wire, { scaleY: 0, transformOrigin: 'center top' });

    var T = 13;
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: function () {
          return '+=' + Math.round(vh() * 4.6);
        },
        pin: true,
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    // food drifting behind everything, staggered so there is always some on screen
    floats.forEach(function (el, i) {
      var sp = num(el.getAttribute('data-float'), 1);
      var w = num(el.getAttribute('data-float-w'), 100) * FLOAT_SCALE;
      var r0 = num(el.getAttribute('data-float-r'), 0);
      var spin = (i % 2 ? 1 : -1) * 40 * sp;
      var start = (i * 0.8) % 6;
      gsap.set(el, { left: num(el.getAttribute('data-float-x'), 50) + '%', width: w, xPercent: -50, autoAlpha: 1 });
      tl.fromTo(
        el,
        { y: -w * 1.3, rotation: r0 },
        {
          y: function () {
            return (vh() + w) * (0.55 + 0.5 * sp);
          },
          rotation: r0 + spin,
          duration: T - start
        },
        start
      );
    });

    // scene 2: header and subheader leave
    tl.to(title, { y: function () { return -vh() * 0.65; }, autoAlpha: 0, duration: 1.1, ease: 'power2.in' }, 3.4);
    if (sub) tl.to(sub, { y: function () { return -vh() * 0.65; }, autoAlpha: 0, duration: 1.1, ease: 'power2.in' }, 3.55);

    // scene 3: cards arrive, then hold while the food keeps moving
    tl.fromTo(
      cardsWrap,
      { autoAlpha: 0, y: function () { return vh() * 0.5; } },
      { autoAlpha: 1, y: 0, duration: 1.3, ease: 'power2.out' },
      4.2
    );

    // scene 4: fan
    cards.forEach(function (card) {
      var p = card.getAttribute('data-fan').split(',').map(parseFloat);
      if (!isNaN(p[3])) gsap.set(card, { zIndex: p[3] });
      tl.to(card, { rotation: p[0] || 0, xPercent: p[1] || 0, scale: p[2] || 1, duration: 1.4, ease: 'power2.inOut' }, 7.0);
    });

    // scene 5: dot, wire, chips; the group rises so the chips fit
    if (dot) tl.to(dot, { scale: 1, duration: 0.4, ease: 'back.out(2)' }, 8.5);
    if (wire) tl.to(wire, { scaleY: 1, duration: 0.7 }, 8.7);
    var chipTimes = [9.3, 10.0, 10.8];
    chips.forEach(function (chip, i) {
      tl.to(chip, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, chipTimes[i] || 10.8 + i * 0.7);
    });
    tl.to(
      [cardsWrap, link],
      {
        y: function () {
          var h = vh();
          var group = ch + GAP + link.offsetHeight;
          return h - 70 - group - (h / 2 - ch / 2);
        },
        duration: 2.4,
        ease: 'power1.inOut'
      },
      9.6
    );
    tl.to({}, { duration: 0.1 }, T - 0.1);
  }

  function init(conditions) {
    var motion = conditions.motion;
    var wide = conditions.wide;
    // [data-stage] sections become one pinned, choreographed sequence on desktop (see buildStage).
    var stageEl = wide && window.innerHeight >= 620 ? document.querySelector('[data-stage]') : null;
    function inStage(el) {
      return !!(stageEl && stageEl.contains(el));
    }

    if (!motion) {
      gsap.set('[data-reveal]', { autoAlpha: 1 });
      release();
      return scrubVideos(false, wide);
    }

    /* ---------- reveals ---------- */

    // lines (headings)
    all('[data-reveal="lines"]').forEach(function (el) {
      if (inStage(el)) return;
      if (!hasSplit) {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: revealTrigger(el, 'top 88%')
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
            scrollTrigger: revealTrigger(el, 'top 88%')
          });
        }
      });
    });

    // fade
    all('[data-reveal="fade"]').forEach(function (el) {
      if (inStage(el)) return;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: el.hasAttribute('data-scrub') ? 'none' : 'power2.out',
          scrollTrigger: revealTrigger(el, 'top 90%', 'top 98%', 'top 70%')
        }
      );
    });

    // rise (uses yPercent so it never fights data-parallax, which uses y)
    // data-scrub items slide up from below in step with the scroll (e.g. the inventory chips).
    all('[data-reveal="rise"][data-scrub]').forEach(function (el) {
      if (inStage(el)) return;
      gsap.fromTo(
        el,
        { autoAlpha: 0, yPercent: 70 },
        {
          autoAlpha: 1,
          yPercent: 0,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 66%', scrub: true }
        }
      );
    });

    var rise = all('[data-reveal="rise"]:not([data-scrub])').filter(function (el) {
      return !inStage(el);
    });
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
            overwrite: 'auto'
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
      if (!f || inStage(el)) return;
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

    /* ---------- floaters: <img data-float="speed" data-float-x="%" data-float-w="px" data-float-r="deg"> ----------
     * Absolutely positioned decorations that drift down through their section at different speeds
     * (higher speed = faster and deeper) while rotating. Hidden by CSS until this runs, so reduced
     * motion simply never shows them. */

    all('[data-float]').forEach(function (el, i) {
      if (inStage(el)) return;
      var sp = num(el.getAttribute('data-float'), 1);
      var w = num(el.getAttribute('data-float-w'), 100) * FLOAT_SCALE * (wide ? 1 : 0.6);
      var r0 = num(el.getAttribute('data-float-r'), 0);
      var spin = (i % 2 ? 1 : -1) * 30 * sp;
      var trigger = el.closest('section') || el.parentElement;
      gsap.set(el, { left: num(el.getAttribute('data-float-x'), 50) + '%', width: w, xPercent: -50, autoAlpha: 1 });
      gsap.fromTo(
        el,
        { y: -w * 1.2, rotation: r0 },
        {
          y: function () {
            return trigger.offsetHeight * 0.9 * sp;
          },
          rotation: r0 + spin,
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

    /* ---------- fan: data-fan="rotateDeg,xPercent,scale,zIndex" ----------
     * Cards start flat and spread into an overlapping fan as the row scrolls into view. */

    all('[data-fan]').forEach(function (el) {
      if (inStage(el)) return;
      var p = el.getAttribute('data-fan').split(',').map(parseFloat);
      var k = wide ? 1 : 0.5;
      if (!isNaN(p[3])) gsap.set(el, { zIndex: p[3] });
      gsap.fromTo(
        el,
        { rotation: 0, xPercent: 0, scale: 1 },
        {
          rotation: (p[0] || 0) * k,
          xPercent: wide ? p[1] || 0 : 0,
          scale: 1 + ((p[2] || 1) - 1) * k,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'top 85%',
            end: 'top 30%',
            scrub: true
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

    /* ---------- scrubbed video ---------- */

    // Created before the slider so the pin spacing is in place when later triggers measure.
    var stopVideos = scrubVideos(true, wide);

    // Created after the video pin so spacing is measured in page order.
    if (stageEl) buildStage(stageEl);

    /* ---------- draw ---------- */

    all('[data-draw]').forEach(function (el) {
      if (inStage(el)) return;
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
          stopVideos();
          medias.forEach(function (m) {
            if (m) m.style.clipPath = '';
          });
        };
      }
    }
    return stopVideos;
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
