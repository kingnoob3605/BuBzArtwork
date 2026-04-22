/* =============================================
   MOBILE/DESKTOP UX ENHANCEMENTS
   Adds: tap-to-reveal NSFW on touch, nav auto-scroll
   to active pill, swipe-down-to-close on mobile sheets,
   and double-tap-protection for rapid closes.
   Pure additive — does not touch existing handlers.
   ============================================= */
(function () {
    'use strict';

    const isTouch = window.matchMedia('(hover: none)').matches ||
                    ('ontouchstart' in window);
    const isSmall = () => window.innerWidth <= 600;

    // ── 1. Tap-to-reveal for NSFW art cards on touch devices ──
    //    The existing CSS reveals on :hover. On touch, a tap opens
    //    the lightbox immediately — the blur never gets a moment.
    //    Wrap each NSFW card's onclick so the first tap reveals and
    //    a second tap (within 6s) opens the lightbox.
    function wrapCardOnclick(card) {
        if (card.__tapWrapped) return;
        card.__tapWrapped = true;
        const original = card.onclick;
        if (typeof original !== 'function') return;
        card.onclick = function (ev) {
            if (!card.classList.contains('tapped')) {
                ev.preventDefault();
                ev.stopPropagation();
                card.classList.add('tapped');
                setTimeout(() => card.classList.remove('tapped'), 6000);
                return false;
            }
            return original.call(this, ev);
        };
    }

    function initTapReveal() {
        if (!isTouch) return;
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;

        // Wrap existing NSFW cards + fix hint text
        const wrapAll = () => {
            grid.querySelectorAll('.art-card').forEach(card => {
                if (card.querySelector('.is-nsfw')) {
                    wrapCardOnclick(card);
                    const hint = card.querySelector('.nsfw-blur-hint');
                    if (hint && hint.textContent.toLowerCase().includes('hover')) {
                        hint.textContent = 'Tap to preview';
                    }
                }
            });
        };
        wrapAll();

        // New cards are added after filter changes — watch the grid
        const mo = new MutationObserver(wrapAll);
        mo.observe(grid, { childList: true });
    }

    // ── 2. Auto-scroll active nav-btn into view on mobile ─────
    function initNavAutoScroll() {
        const nav = document.querySelector('#header nav');
        if (!nav) return;

        // Observe nav-btn class changes
        const syncActive = () => {
            if (!isSmall()) return;
            const active = nav.querySelector('.nav-btn.active');
            if (!active) return;
            const navRect = nav.getBoundingClientRect();
            const btnRect = active.getBoundingClientRect();
            if (btnRect.left < navRect.left || btnRect.right > navRect.right) {
                const offset = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
                nav.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
            }
        };

        // Initial + after every showPage call via MutationObserver
        const mo = new MutationObserver(syncActive);
        nav.querySelectorAll('.nav-btn').forEach(btn => {
            mo.observe(btn, { attributes: true, attributeFilter: ['class'] });
        });
        syncActive();
    }

    // ── 3. Swipe-down-to-close on mobile sheets ───────────────
    function initSheetSwipe(sheetEl, closeFn) {
        if (!sheetEl) return;
        let startY = null, startT = 0, dragging = false, deltaY = 0;

        sheetEl.addEventListener('touchstart', function (e) {
            if (!isSmall()) return;
            // Only start drag if the touch is near the top of the sheet
            // (top 80px ≈ header/drag-handle zone). Otherwise let scroll work.
            const rect = sheetEl.getBoundingClientRect();
            const t = e.touches[0];
            if (t.clientY - rect.top > 80) return;
            startY = t.clientY;
            startT = Date.now();
            dragging = true;
            deltaY = 0;
            sheetEl.style.transition = 'none';
        }, { passive: true });

        sheetEl.addEventListener('touchmove', function (e) {
            if (!dragging) return;
            const t = e.touches[0];
            deltaY = Math.max(0, t.clientY - startY);
            sheetEl.style.transform = 'translateY(' + deltaY + 'px)';
            sheetEl.style.opacity = String(Math.max(0.4, 1 - deltaY / 600));
        }, { passive: true });

        sheetEl.addEventListener('touchend', function () {
            if (!dragging) return;
            dragging = false;
            sheetEl.style.transition = '';
            const dt = Date.now() - startT;
            const vy = deltaY / Math.max(dt, 1);
            const shouldClose = deltaY > 140 || vy > 0.5;
            if (shouldClose) {
                closeFn();
            }
            // Reset transform/opacity on next frame (or after close anim)
            setTimeout(() => {
                sheetEl.style.transform = '';
                sheetEl.style.opacity = '';
            }, 50);
            deltaY = 0;
        });
    }

    function initMobileSheets() {
        const lbInner = document.querySelector('#lightbox .lightbox-inner');
        const adminInner = document.querySelector('#admin-panel .admin-inner');
        if (typeof closeLightbox === 'function') initSheetSwipe(lbInner, closeLightbox);
        if (typeof closeAdmin === 'function') initSheetSwipe(adminInner, closeAdmin);
    }

    // ── 4. Body modal-open class (supplement to overflow:hidden) ─
    //    Adds the class so CSS (body.modal-open) can also disable
    //    touch-action. The app already sets body.style.overflow.
    function initBodyLockObserver() {
        const targets = [
            document.getElementById('lightbox'),
            document.getElementById('admin-panel'),
            document.getElementById('mobile-draw-panel')
        ].filter(Boolean);
        const age = document.getElementById('age-gate');
        if (age) targets.push(age);

        const update = () => {
            const anyOpen = targets.some(el => {
                if (!el) return false;
                if (el.id === 'age-gate') return !el.classList.contains('hidden');
                if (el.id === 'mobile-draw-panel') return !el.classList.contains('hidden');
                return el.classList.contains('open');
            });
            document.body.classList.toggle('modal-open', anyOpen);
        };

        const mo = new MutationObserver(update);
        targets.forEach(t => mo.observe(t, { attributes: true, attributeFilter: ['class'] }));
        update();
    }

    // ── 5. Viewport height fix for mobile browsers (--vh) ─────
    //    100vh on iOS Safari includes the URL bar — use --vh instead
    //    where needed. (Current CSS uses vh freely; this sets a CSS
    //    variable sites can opt into.)
    function initVhFix() {
        const setVh = () => {
            document.documentElement.style.setProperty(
                '--vh', (window.innerHeight * 0.01) + 'px'
            );
        };
        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
    }

    // ── 6. Eager brush-size dot sync (mobile draw panel) ──────
    //    Ensures the preview dot matches the slider on first open.
    function initBrushDotSync() {
        const size = document.getElementById('mdb-size');
        const dot  = document.getElementById('mdb-size-dot');
        if (!size || !dot) return;
        const sync = () => {
            const v = parseInt(size.value, 10) || 6;
            const px = Math.max(4, Math.min(36, v));
            dot.style.width = px + 'px';
            dot.style.height = px + 'px';
        };
        size.addEventListener('input', sync);
        sync();
    }

    // ── 7. Haptic feedback on key actions (if supported) ──────
    function buzz(ms) {
        if (!isTouch) return;
        if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} }
    }
    function initHaptics() {
        if (!isTouch) return;
        const sel = '.filter-chip, .wall-chip, .tag-chip, .nav-btn, .send-tab-btn, .admin-tab-btn, .identity-btn, .vis-btn, .reaction-btn';
        document.addEventListener('click', e => {
            if (e.target.closest(sel)) buzz(6);
        });
    }

    // ── 8. Init on DOM ready ──────────────────────────────────
    function start() {
        initTapReveal();
        initNavAutoScroll();
        initMobileSheets();
        initBodyLockObserver();
        initVhFix();
        initBrushDotSync();
        initHaptics();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
