// ============================================================
//  Hammas Gun Mod  —  純學習/本機遊玩用
//  作者：玩家自製；附加於 ham.min.js 之上，不修改原檔
//
//  v2 UI/UX 重塑：tactical HUD + glassmorphism，邏輯保持不變
//
//  操作：
//    G          切換開關（STANDBY / ARMED）
//    Shift+G    DEBUG 開關
//    滑鼠移動    準心跟著游標
//    左鍵單擊    單發
//    左鍵按住    連射（約 11 發/秒）
//    Space      連射（鍵盤替代）
//
//  物理：命中點以 OIMO.js 套用衝量（本遊戲用 OIMO，非 Babylon 內建）
// ============================================================

(function () {
    'use strict';

    const HAM_REGEX = /ham|belly|ears?|whisker|snout|paw|cheek|body|armature|fur/i;
    const HELP_KEY  = 'hammas_gun_help_shown_v2';

    function waitForScene(callback) {
        let tries = 0;
        const tick = () => {
            const ok =
                typeof BABYLON !== 'undefined' &&
                BABYLON.Engine &&
                BABYLON.Engine.LastCreatedScene &&
                BABYLON.Engine.LastCreatedScene.activeCamera &&
                BABYLON.Engine.LastCreatedScene.meshes.length > 5;
            if (ok) return callback(BABYLON.Engine.LastCreatedScene);
            if (++tries > 200) return console.warn('[gun] scene 等太久放棄');
            setTimeout(tick, 300);
        };
        tick();
    }

    // ============================================================
    //  UI Injection — 完整重設計
    // ============================================================
    function injectUI() {
        if (document.getElementById('gunOverlay')) return;

        const style = document.createElement('style');
        style.textContent = `
            /* ---------- Design tokens ---------- */
            #gunOverlay, #gunToggle, #gunHud, #gunHelp, .gun-bubble, .gun-muzzle, .gun-hit-ring {
                --gun-bg:          rgba(12, 16, 24, 0.62);
                --gun-bg-strong:   rgba(12, 16, 24, 0.86);
                --gun-border:      rgba(255, 255, 255, 0.10);
                --gun-border-hi:   rgba(255, 255, 255, 0.20);
                --gun-fg:          #f5f7fb;
                --gun-fg-dim:      rgba(245, 247, 251, 0.62);
                --gun-accent:      #ff3a4f;
                --gun-accent-soft: rgba(255, 58, 79, 0.22);
                --gun-cyan:        #38bdf8;
                --gun-warn:        #fbbf24;
                --gun-radius:      14px;
                --gun-shadow:      0 10px 32px rgba(0, 0, 0, 0.45);
                --gun-mono:        ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
                --gun-sans:        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
            }

            /* ---------- Overlay frame ---------- */
            #gunOverlay {
                position: fixed; inset: 0;
                pointer-events: none;
                z-index: 99998;
                opacity: 0;
                transition: opacity .25s ease;
            }
            #gunOverlay.on { opacity: 1; }

            #gunOverlay::before {
                content: "";
                position: absolute; inset: 0;
                box-shadow:
                    inset 0 0 0 1px rgba(255, 58, 79, 0.10),
                    inset 0 0 80px rgba(255, 58, 79, 0.12);
                opacity: 0;
                transition: opacity .35s ease;
                pointer-events: none;
            }
            #gunOverlay.on::before { opacity: 1; }

            /* Tactical corner brackets */
            #gunOverlay .corner {
                position: absolute;
                width: 22px; height: 22px;
                border: 2px solid rgba(255, 58, 79, 0.85);
                pointer-events: none;
                opacity: 0;
                transition: opacity .35s ease;
                filter: drop-shadow(0 0 4px rgba(255, 58, 79, 0.55));
            }
            #gunOverlay.on .corner { opacity: .9; }
            #gunOverlay .corner.tl { top: 18px; left:  18px; border-right: 0; border-bottom: 0; }
            #gunOverlay .corner.tr { top: 18px; right: 18px; border-left:  0; border-bottom: 0; }
            #gunOverlay .corner.bl { bottom: 18px; left:  18px; border-right: 0; border-top: 0; }
            #gunOverlay .corner.br { bottom: 18px; right: 18px; border-left:  0; border-top: 0; }

            /* ---------- Crosshair ---------- */
            #gunCrosshair {
                position: absolute;
                width: 60px; height: 60px;
                left: 50%; top: 50%;
                transform: translate(-50%, -50%);
                will-change: left, top;
                pointer-events: none;
            }
            #gunCrosshair svg {
                width: 100%; height: 100%;
                overflow: visible;
                filter: drop-shadow(0 0 6px rgba(255, 58, 79, 0.55));
                transition: transform .25s cubic-bezier(.2,.7,.3,1);
            }
            #gunCrosshair .ring {
                fill: none;
                stroke: rgba(255, 255, 255, 0.85);
                stroke-width: 1.4;
            }
            #gunCrosshair .tick {
                stroke: var(--gun-accent);
                stroke-width: 2;
                stroke-linecap: round;
            }
            #gunCrosshair .dot { fill: var(--gun-accent); }
            @keyframes gun-crosshair-pulse {
                0%, 100% { opacity: 1; }
                50%      { opacity: .55; }
            }
            #gunOverlay.on #gunCrosshair .ring {
                animation: gun-crosshair-pulse 2.4s ease-in-out infinite;
            }
            #gunCrosshair.fire svg {
                animation: gun-crosshair-recoil .14s ease-out;
            }
            @keyframes gun-crosshair-recoil {
                0%   { transform: scale(1); }
                45%  { transform: scale(1.22); }
                100% { transform: scale(1); }
            }

            /* ---------- Status pill (bottom-right; 不擋 header dropdown) ---------- */
            #gunToggle {
                position: fixed;
                bottom: 110px; right: 14px;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 8px 10px 8px 12px;
                min-height: 36px;
                box-sizing: border-box;
                background: var(--gun-bg);
                backdrop-filter: blur(14px) saturate(140%);
                -webkit-backdrop-filter: blur(14px) saturate(140%);
                color: var(--gun-fg);
                font: 600 12px/1 var(--gun-mono);
                letter-spacing: 0.10em;
                text-transform: uppercase;
                border: 1px solid var(--gun-border);
                border-radius: 999px;
                box-shadow: var(--gun-shadow);
                cursor: pointer;
                user-select: none;
                pointer-events: auto;
                z-index: 99999;
                transition: background .2s ease, border-color .2s ease, transform .12s ease, color .2s ease;
            }
            #gunToggle:hover {
                background: var(--gun-bg-strong);
                border-color: var(--gun-border-hi);
            }
            #gunToggle:active   { transform: scale(0.97); }
            #gunToggle:focus-visible {
                outline: 2px solid var(--gun-accent);
                outline-offset: 3px;
            }
            #gunToggle .led {
                width: 8px; height: 8px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.30);
                flex-shrink: 0;
                transition: background .2s ease, box-shadow .25s ease;
            }
            #gunToggle .label { color: var(--gun-fg-dim); transition: color .2s ease; }
            #gunToggle .kbd {
                padding: 3px 6px;
                font: 700 10px/1 var(--gun-mono);
                color: var(--gun-fg-dim);
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid var(--gun-border);
                border-radius: 5px;
                letter-spacing: 0;
            }
            #gunToggle.armed {
                background: linear-gradient(135deg, rgba(255,58,79,0.26), rgba(255,58,79,0.10));
                border-color: rgba(255, 58, 79, 0.50);
            }
            #gunToggle.armed .label {
                color: #fff;
                text-shadow: 0 0 8px rgba(255, 58, 79, 0.7);
            }
            #gunToggle.armed .led {
                background: var(--gun-accent);
                box-shadow: 0 0 10px var(--gun-accent), 0 0 22px var(--gun-accent);
                animation: gun-led-blink 1.2s ease-in-out infinite;
            }
            @keyframes gun-led-blink {
                0%, 100% { opacity: 1; }
                50%      { opacity: .35; }
            }

            /* ---------- HUD ---------- */
            #gunHud {
                position: fixed;
                bottom: 14px; left: 14px;
                display: flex;
                gap: 14px;
                padding: 10px 16px;
                background: var(--gun-bg);
                backdrop-filter: blur(14px) saturate(140%);
                -webkit-backdrop-filter: blur(14px) saturate(140%);
                border: 1px solid var(--gun-border);
                border-radius: var(--gun-radius);
                box-shadow: var(--gun-shadow);
                z-index: 99999;
                pointer-events: none;
                align-items: center;
                font-family: var(--gun-mono);
                opacity: 0;
                transform: translateY(8px);
                transition: opacity .25s ease, transform .25s ease;
            }
            #gunOverlay.on ~ #gunHud {
                opacity: 1;
                transform: translateY(0);
            }
            #gunHud .stat {
                display: flex;
                flex-direction: column;
                gap: 3px;
                min-width: 56px;
            }
            #gunHud .stat-label {
                font: 700 9px/1 var(--gun-mono);
                letter-spacing: 0.16em;
                color: var(--gun-fg-dim);
            }
            #gunHud .stat-value {
                font: 700 22px/1 var(--gun-mono);
                font-variant-numeric: tabular-nums;
                color: var(--gun-fg);
                text-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
                transform-origin: left center;
                transition: transform .12s ease, color .2s ease;
            }
            #gunHud .stat.ham .stat-value {
                color: var(--gun-warn);
                text-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
            }
            #gunHud .stat-value.bump {
                animation: gun-stat-bump .35s cubic-bezier(.34,1.56,.64,1);
            }
            @keyframes gun-stat-bump {
                0%   { transform: scale(1); }
                40%  { transform: scale(1.22); color: var(--gun-accent); }
                100% { transform: scale(1); }
            }
            #gunHud .divider {
                width: 1px;
                align-self: stretch;
                background: linear-gradient(to bottom, transparent, var(--gun-border-hi) 30%, var(--gun-border-hi) 70%, transparent);
            }

            /* ---------- Hit ring (3D-projected) ---------- */
            .gun-hit-ring {
                position: fixed;
                transform: translate(-50%, -50%);
                width: 8px; height: 8px;
                border: 2px solid rgba(255, 220, 100, 0.95);
                border-radius: 50%;
                pointer-events: none;
                z-index: 99996;
                animation: gun-hit-ring .38s ease-out forwards;
                box-shadow: 0 0 14px rgba(255, 200, 80, 0.6);
            }
            @keyframes gun-hit-ring {
                0%   { width: 8px;  height: 8px;  opacity: 1; border-width: 3px; }
                100% { width: 64px; height: 64px; opacity: 0; border-width: 1px; }
            }

            /* ---------- Blood vignette (邊緣紅色閃光，命中瞬間整螢幕反饋) ---------- */
            .gun-blood-vignette {
                position: fixed; inset: 0;
                pointer-events: none;
                z-index: 99996;
                background: radial-gradient(ellipse at center,
                    transparent 35%,
                    rgba(180, 0, 8, 0.10) 65%,
                    rgba(140, 0, 6, 0.32) 90%,
                    rgba(110, 0, 4, 0.42) 100%);
                animation: gun-blood-vignette .55s ease-out forwards;
            }
            @keyframes gun-blood-vignette {
                0%   { opacity: 0; }
                15%  { opacity: 1; }
                100% { opacity: 0; }
            }


            /* ---------- Hit bubble ---------- */
            .gun-bubble {
                position: fixed;
                transform: translate(-50%, -100%);
                font: 800 20px/1 var(--gun-sans);
                letter-spacing: 0.04em;
                color: #fff;
                padding: 6px 14px;
                border-radius: 12px;
                background: linear-gradient(180deg, rgba(255, 58, 79, 0.96), rgba(220, 38, 38, 0.96));
                box-shadow: 0 6px 20px rgba(255, 58, 79, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.30);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
                pointer-events: none;
                z-index: 99999;
                white-space: nowrap;
                animation: gun-bubble-fly .9s cubic-bezier(.2, .7, .2, 1) forwards;
            }
            .gun-bubble.warn {
                background: linear-gradient(180deg, rgba(251, 191, 36, 0.97), rgba(217, 119, 6, 0.97));
                box-shadow: 0 6px 20px rgba(251, 191, 36, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.30);
                color: #1a1208;
                text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
            }
            @keyframes gun-bubble-fly {
                0%   { opacity: 0; transform: translate(-50%, -60%)  scale(.45) rotate(-3deg); }
                18%  { opacity: 1; transform: translate(-50%, -110%) scale(1.18) rotate(2deg);  }
                40%  { opacity: 1; transform: translate(-50%, -135%) scale(1)    rotate(-1deg); }
                100% { opacity: 0; transform: translate(-50%, -200%) scale(.92)  rotate(0deg);  }
            }

            /* ---------- Muzzle flash ---------- */
            .gun-muzzle {
                position: fixed; inset: 0;
                background: radial-gradient(circle at center,
                    rgba(255, 220, 140, 0.55) 0%,
                    rgba(255, 140, 80, 0.18) 30%,
                    transparent 55%);
                mix-blend-mode: screen;
                pointer-events: none;
                z-index: 99997;
                animation: gun-muzzle .12s ease-out;
            }
            @keyframes gun-muzzle {
                from { opacity: 1; }
                to   { opacity: 0; }
            }

            /* ---------- Help toast (隨 toggle 顯示在右下方) ---------- */
            #gunHelp {
                position: fixed;
                bottom: 156px; right: 14px;
                transform: translateY(6px);
                padding: 10px 14px;
                background: var(--gun-bg-strong);
                backdrop-filter: blur(14px) saturate(140%);
                -webkit-backdrop-filter: blur(14px) saturate(140%);
                border: 1px solid var(--gun-border);
                border-radius: 10px;
                box-shadow: var(--gun-shadow);
                color: var(--gun-fg);
                font: 500 12px/1.55 var(--gun-sans);
                letter-spacing: 0.02em;
                opacity: 0;
                pointer-events: none;
                z-index: 99999;
                white-space: nowrap;
                transition: opacity .3s ease, transform .3s ease;
            }
            #gunHelp.show {
                opacity: 1;
                transform: translateY(0);
            }
            #gunHelp .row { display: flex; align-items: center; gap: 8px; }
            #gunHelp .row + .row { margin-top: 4px; }
            #gunHelp .row .desc { color: var(--gun-fg-dim); }
            #gunHelp .kbd {
                display: inline-block;
                padding: 2px 6px;
                min-width: 14px;
                font: 700 10px/1 var(--gun-mono);
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid var(--gun-border);
                border-radius: 4px;
                color: var(--gun-fg);
                text-align: center;
            }

            /* ---------- Cursor ---------- */
            body.gun-armed, body.gun-armed * { cursor: none !important; }
            body.gun-armed #gunToggle, body.gun-armed #gunToggle * { cursor: pointer !important; }

            /* ---------- Reduced motion ---------- */
            @media (prefers-reduced-motion: reduce) {
                #gunOverlay, #gunHud, .gun-bubble, .gun-muzzle, #gunHelp,
                #gunToggle.armed .led, #gunOverlay.on #gunCrosshair .ring,
                #gunHud .stat-value.bump, .gun-hit-ring, #gunCrosshair.fire svg {
                    animation: none !important;
                    transition: opacity .15s linear !important;
                }
            }

            /* ---------- Small screens ---------- */
            @media (max-width: 420px) {
                #gunHud { gap: 10px; padding: 8px 12px; }
                #gunHud .stat-value { font-size: 18px; }
                #gunToggle { font-size: 11px; }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'gunOverlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div id="gunCrosshair">
                <svg viewBox="0 0 60 60" aria-hidden="true">
                    <circle class="ring" cx="30" cy="30" r="20"></circle>
                    <line class="tick" x1="30" y1="3"  x2="30" y2="11"></line>
                    <line class="tick" x1="30" y1="49" x2="30" y2="57"></line>
                    <line class="tick" x1="3"  y1="30" x2="11" y2="30"></line>
                    <line class="tick" x1="49" y1="30" x2="57" y2="30"></line>
                    <circle class="dot" cx="30" cy="30" r="2.2"></circle>
                </svg>
            </div>
        `;
        document.body.appendChild(overlay);

        const toggle = document.createElement('div');
        toggle.id = 'gunToggle';
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Toggle gun mode (G)');
        toggle.innerHTML = `
            <span class="led" aria-hidden="true"></span>
            <span class="label">STANDBY</span>
            <span class="kbd" aria-hidden="true">G</span>
        `;
        document.body.appendChild(toggle);

        const hud = document.createElement('div');
        hud.id = 'gunHud';
        hud.setAttribute('aria-hidden', 'true');
        hud.innerHTML = `
            <div class="stat shots">
                <span class="stat-label">SHOTS</span>
                <span class="stat-value" id="hitCount">0</span>
            </div>
            <div class="divider" aria-hidden="true"></div>
            <div class="stat ham">
                <span class="stat-label">BONKED</span>
                <span class="stat-value" id="hamCount">0</span>
            </div>
        `;
        document.body.appendChild(hud);

        const help = document.createElement('div');
        help.id = 'gunHelp';
        help.setAttribute('role', 'status');
        help.setAttribute('aria-live', 'polite');
        help.innerHTML = `
            <div class="row"><span class="kbd">G</span><span class="desc">arm / disarm</span></div>
            <div class="row"><span class="kbd">click</span><span class="desc">fire (hold for auto)</span></div>
            <div class="row"><span class="kbd">space</span><span class="desc">auto fire</span></div>
        `;
        document.body.appendChild(help);
    }

    // ============================================================
    //  Init — 行為邏輯與舊版相同，只更新 UI 控制
    // ============================================================
    function initGun(scene) {
        injectUI();

        const engine = scene.getEngine();
        const canvas = engine.getRenderingCanvas();

        let gunOn = false;
        let hits = 0;
        let hamHits = 0;
        let pointerX = window.innerWidth / 2;
        let pointerY = window.innerHeight / 2;
        let armedOnce = false;

        const overlay     = document.getElementById('gunOverlay');
        const crosshair   = document.getElementById('gunCrosshair');
        const toggleBtn   = document.getElementById('gunToggle');
        const labelEl     = toggleBtn.querySelector('.label');
        const hitCounter  = document.getElementById('hitCount');
        const hamCounter  = document.getElementById('hamCount');
        const helpEl      = document.getElementById('gunHelp');

        const updateCrosshair = () => {
            crosshair.style.left = pointerX + 'px';
            crosshair.style.top  = pointerY + 'px';
        };

        const bumpStat = (el) => {
            el.classList.remove('bump');
            // 強制 reflow 以重啟動畫
            void el.offsetWidth;
            el.classList.add('bump');
        };

        const showHelp = () => {
            helpEl.classList.add('show');
            const dismiss = () => {
                helpEl.classList.remove('show');
                try { localStorage.setItem(HELP_KEY, '1'); } catch (e) {}
                window.removeEventListener('pointerdown', dismiss, true);
            };
            setTimeout(dismiss, 4500);
            window.addEventListener('pointerdown', dismiss, true);
        };

        const setGunOn = (on) => {
            gunOn = on;
            overlay.classList.toggle('on', on);
            toggleBtn.classList.toggle('armed', on);
            toggleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
            overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
            labelEl.textContent = on ? 'ARMED' : 'STANDBY';
            document.body.classList.toggle('gun-armed', on);
            if (on) {
                updateCrosshair();
                if (!armedOnce) {
                    armedOnce = true;
                    let seen = false;
                    try { seen = !!localStorage.getItem(HELP_KEY); } catch (e) {}
                    if (!seen) showHelp();
                }
            } else {
                stopFire();
            }
        };

        // ------- 輸入事件 -------
        // pointermove：更新準心位置（不攔截，相機仍可拖曳）
        window.addEventListener('pointermove', (e) => {
            pointerX = e.clientX;
            pointerY = e.clientY;
            if (gunOn) updateCrosshair();
        }, true);

        // pointerdown：僅在 gun ON + 左鍵 + 目標是 3D canvas 時開火
        window.addEventListener('pointerdown', (e) => {
            if (!gunOn || e.button !== 0) return;
            if (e.target && e.target.closest && e.target.closest('#gunToggle')) return;
            if (e.target !== canvas) return;
            pointerX = e.clientX;
            pointerY = e.clientY;
            startFire();
        }, true);

        const onUp = () => stopFire();
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
        window.addEventListener('blur', onUp);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopFire(); });

        // 鍵盤
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.shiftKey) {
                    DEBUG = !DEBUG;
                    console.log('[gun] DEBUG =', DEBUG);
                    if (DEBUG) {
                        __spsCache = null;
                        const list = getSPSList();
                        console.log('[gun] SPS found:', list.length,
                            list.map(x => ({
                                mesh: x.mesh && x.mesh.name,
                                particles: x.sps.particles && x.sps.particles.length,
                                hasPickedParticles: !!x.sps.pickedParticles,
                            })));
                        try {
                            const z = (typeof z0 !== 'undefined') ? z0 : window.z0;
                            const mm = z.app.graphicsHelper.spsManagerManager;
                            console.log('[gun] mm.keys=', Object.keys(mm));
                            const sm = mm.spsManagers || [];
                            console.log('[gun] spsManagers len=', sm.length);
                            if (sm[0]) {
                                console.log('[gun] spsManagers[0] keys=', Object.keys(sm[0]));
                                console.log('[gun] spsManagers[0].mesh?', !!sm[0].mesh,
                                    'name=', sm[0].mesh && sm[0].mesh.name,
                                    '.sps?', !!sm[0].sps,
                                    '.particles?', !!sm[0].particles);
                            }
                            const pk = mm.pickablez1080s || [];
                            console.log('[gun] pickablez1080s len=', pk.length,
                                'meshes=', pk.map(x => x && x.mesh && x.mesh.name));
                        } catch (e) { console.warn('[gun] mm inspect failed', e); }
                        const spsMeshes = scene.meshes.filter(m => /SPS/i.test(m.name || ''));
                        console.log('[gun] meshes named SPS:', spsMeshes.length,
                            spsMeshes.map(m => ({
                                name: m.name, uid: m.uniqueId,
                                pick: m.isPickable, vis: m.isVisible,
                                hasSps: !!(m._sps || m.solidParticleSystem || m.sps)
                            })));
                        const foodMeshes = scene.meshes.filter(m =>
                            /food|seed|corn|pumpkin|sunflower|disc|donut/i.test(m.name || '')
                        ).map(m => ({
                            name: m.name, pick: m.isPickable, vis: m.isVisible,
                            enabled: m.isEnabled(),
                        }));
                        console.log('[gun] food-like meshes:', foodMeshes);
                    }
                } else {
                    setGunOn(!gunOn);
                }
            }
            if (gunOn && e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                startFire();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') stopFire();
        });

        // 徽章：只消化在自己身上的 click（避免傳到 canvas 多開一槍）
        toggleBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setGunOn(!gunOn);
        });
        toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setGunOn(!gunOn);
            }
        });

        // ------- 連射迴圈：rAF + 時間節流 -------
        let firing = false;
        let lastFireAt = 0;
        const FIRE_INTERVAL_MS = 90;

        function startFire() {
            if (!gunOn || firing) return;
            firing = true;
            lastFireAt = 0;
            fireLoop();
        }
        function stopFire() { firing = false; }

        function fireLoop() {
            if (!firing || !gunOn) return;
            const now = performance.now();
            if (now - lastFireAt >= FIRE_INTERVAL_MS) {
                try { fire(); } catch (e) { console.warn('[gun] fire() threw', e); }
                lastFireAt = now;
            }
            requestAnimationFrame(fireLoop);
        }

        // ------- OIMO 物理互動 -------
        function findWorld() {
            try {
                const z = (typeof z0 !== 'undefined') ? z0 : window.z0;
                if (z && z.app && z.app.world) return z.app.world;
            } catch (e) {}
            return null;
        }

        const KICK_RADIUS    = 1.8;
        const KICK_DV        = 4.0;
        const KICK_LIFT      = 0.4;
        const SPLASH_MUL     = 0.35;
        const MAX_EFF_MASS   = 10;

        const HAMSTER_DV     = 24;
        const HAMSTER_LIFT   = 8;
        const HAMSTER_PART_RE = /^hamster\d*(_|$)/i;

        // OIMO body 命名是 {Object}_{part}：例如 Wheel1a_stand、Wheel1a_base、
        // House1_houseBumper1、boxChew0。除前綴外，也要擋住結構性後綴 (_stand/_base/
        // _holder/_inside/_button/_roof/_ears/_saucer) 與所有 *Bumper 觸發體。
        const STRUCTURE_RE   = /(^(cage|wall|floor|ceiling|background|wheel|w\d+[a-c]|house|tube|connector|cover|ramp|bridge|platform|suction|box|swing))|(_stand|_base|_holder|_inside|_button|_roof|_ears|_saucer|bumper)/i;

        const JIGGLE_BLACKLIST = /^(Background|SPS|bedding|cage|wall|floor|ceiling|hamster|simpleChew|stickChew|boxChew|hangingChew|wheel|w\d+a|waterLine|foodMound)/i;
        const JIGGLE_DIST      = 0.08;
        const JIGGLE_MS        = 160;

        let DEBUG = false;

        // ------- 結構釘位：house body 是 dynamic，倉鼠一撞就飄走，
        //         在 play mode 每幀把它的速度歸零並推回原位；build mode 不釘（保留拖拉）
        const PINNED_RE = /^house/i;   // 哪些前綴要釘住
        const housePins = new Map();   // body → { x, y, z }
        const isBuildMode = () => {
            const m = document.getElementById('main');
            return !!(m && m.classList && m.classList.contains('build-mode'));
        };
        scene.onBeforeRenderObservable.add(() => {
            const world = findWorld();
            if (!world) return;
            // 編輯模式：清掉記錄並放生（不然拖不動）
            if (isBuildMode()) {
                if (housePins.size) housePins.clear();
                return;
            }
            // 掃 world 的 body 鏈，新增 / 移除的 house body 都要追上
            const seen = new Set();
            let body = world.rigidBodies;
            while (body) {
                const name = body.name || '';
                if (PINNED_RE.test(name) && body.isDynamic && body.inverseMass > 0) {
                    seen.add(body);
                    if (!housePins.has(body)) {
                        housePins.set(body, {
                            x: body.position.x,
                            y: body.position.y,
                            z: body.position.z,
                        });
                    }
                }
                body = body.next;
            }
            // 已不在 world 的就清掉
            for (const b of housePins.keys()) if (!seen.has(b)) housePins.delete(b);
            // 推回原位 + 速度歸零
            for (const [b, p] of housePins) {
                if (b.linearVelocity)  { b.linearVelocity.x  = 0; b.linearVelocity.y  = 0; b.linearVelocity.z  = 0; }
                if (b.angularVelocity) { b.angularVelocity.x = 0; b.angularVelocity.y = 0; b.angularVelocity.z = 0; }
                b.position.x = p.x;
                b.position.y = p.y;
                b.position.z = p.z;
                b.syncShapes && b.syncShapes();
            }
        });

        const OWNER_KEYS = ['owner', 'gameObject', 'entity', '_owner', '_entity',
                            '__obj', 'accessory', 'parent3d'];
        const BODY_KEYS  = ['body', 'dynamicBody', 'bumper2', 'draggerBody'];

        function findOwnerFromMesh(mesh) {
            let m = mesh;
            let depth = 0;
            while (m && depth < 8) {
                for (const k of BODY_KEYS) {
                    if (m[k] && typeof m[k].applyImpulse === 'function') return m;
                }
                for (const k of OWNER_KEYS) {
                    const o = m[k];
                    if (o) {
                        for (const bk of BODY_KEYS) {
                            if (o[bk] && typeof o[bk].applyImpulse === 'function') return o;
                        }
                    }
                }
                if (m.metadata && m.metadata.owner) {
                    const o = m.metadata.owner;
                    for (const bk of BODY_KEYS) {
                        if (o[bk] && typeof o[bk].applyImpulse === 'function') return o;
                    }
                }
                m = m.parent;
                depth++;
            }
            return null;
        }

        function applyOimoKick(hitPoint, dir, pickedMesh) {
            const world = findWorld();
            if (!world || typeof OIMO === 'undefined') {
                if (DEBUG) console.log('[gun] no world / OIMO');
                return 0;
            }

            const dn = dir.normalizeToNew ? dir.normalizeToNew() : dir;
            const hx = hitPoint.x, hy = hitPoint.y, hz = hitPoint.z;
            const kicked = new Set();

            const kickBody = (body, strength, label) => {
                if (!body) return false;
                if (kicked.has(body)) return false;
                if (!body.isDynamic || body.inverseMass <= 0) {
                    if (DEBUG) console.log('[gun] skip static:', label, body.name);
                    return false;
                }
                try {
                    const mass = 1 / body.inverseMass;
                    const effMass = Math.min(mass, MAX_EFF_MASS);
                    const dv = KICK_DV * strength;
                    const liftDv = KICK_LIFT * strength;
                    const f = new OIMO.Vec3(
                        dn.x * dv * effMass,
                        (dn.y * dv + liftDv) * effMass,
                        dn.z * dv * effMass
                    );
                    const p = new OIMO.Vec3(hx, hy, hz);
                    body.awake && body.awake();
                    body.applyImpulse(p, f);
                    kicked.add(body);
                    if (DEBUG) console.log('[gun]', label, body.name,
                        'm=', mass.toFixed(2), 'eff=', effMass.toFixed(2),
                        'dv=', dv.toFixed(2));
                    return true;
                } catch (e) {
                    if (DEBUG) console.warn('[gun] kick failed', e);
                    return false;
                }
            };

            // 0) 倉鼠特例
            let targetHamsterRe = null;
            if (pickedMesh) {
                const m = (pickedMesh.name || '').match(/^hamster(\d+)/i);
                if (m) {
                    targetHamsterRe = new RegExp('^hamster' + m[1] + '(_|$)', 'i');
                }
            }
            if (targetHamsterRe) {
                let b = world.rigidBodies;
                let parts = 0;
                while (b) {
                    if (targetHamsterRe.test(b.name || '') &&
                        b.isDynamic && b.inverseMass > 0 && !kicked.has(b)) {
                        try {
                            const mass = 1 / b.inverseMass;
                            const effMass = Math.min(mass, MAX_EFF_MASS);
                            const f = new OIMO.Vec3(
                                dn.x * HAMSTER_DV * effMass,
                                (dn.y * HAMSTER_DV + HAMSTER_LIFT) * effMass,
                                dn.z * HAMSTER_DV * effMass
                            );
                            const p = new OIMO.Vec3(hx, hy, hz);
                            b.awake && b.awake();
                            b.applyImpulse(p, f);
                            kicked.add(b);
                            parts++;
                        } catch (e) {}
                    }
                    b = b.next;
                }
                if (DEBUG) console.log('[gun] HAMSTER', targetHamsterRe, '→', parts, 'parts');
            }

            // 1) Direct hit
            if (pickedMesh && !STRUCTURE_RE.test(pickedMesh.name || '')) {
                const owner = findOwnerFromMesh(pickedMesh);
                if (owner) {
                    if (DEBUG) console.log('[gun] owner:',
                        owner.constructor && owner.constructor.name,
                        '_physicsEnabled=', owner._physicsEnabled);
                    if (typeof owner.enablePhysics === 'function' &&
                        owner._physicsEnabled === false) {
                        try { owner.enablePhysics(); } catch (e) {}
                    }
                    for (const bk of BODY_KEYS) {
                        const b = owner[bk];
                        if (!b) continue;
                        if (b.parent == null) {
                            if (DEBUG) console.log('[gun]', bk, '未在 world，跳過');
                            continue;
                        }
                        kickBody(b, 1.0, 'direct:' + bk);
                    }
                } else if (DEBUG && !targetHamsterRe) {
                    console.log('[gun] no owner for mesh', pickedMesh.name);
                }
            }

            // 2) 空間濺射
            let body = world.rigidBodies;
            let scanned = 0, inRange = 0;
            while (body) {
                scanned++;
                if (body.isDynamic && body.inverseMass > 0 && !kicked.has(body) &&
                    !HAMSTER_PART_RE.test(body.name || '') &&
                    !STRUCTURE_RE.test(body.name || '')) {
                    const bp = body.position;
                    const dx = bp.x - hx, dy = bp.y - hy, dz = bp.z - hz;
                    const dSq = dx * dx + dy * dy + dz * dz;
                    if (dSq < KICK_RADIUS * KICK_RADIUS) {
                        inRange++;
                        const falloff = 1 - Math.sqrt(dSq) / KICK_RADIUS;
                        kickBody(body, SPLASH_MUL * falloff, 'splash');
                    }
                }
                body = body.next;
            }
            if (DEBUG) console.log('[gun] scanned', scanned,
                'splash=', inRange, 'total kicked=', kicked.size);
            return kicked.size;
        }

        // SPS 查找
        function findAllSPS() {
            const list = [];
            const push = (mesh, sps) => {
                if (!sps || !sps.particles || !sps.mesh) return;
                if (!list.find(x => x.sps === sps)) list.push({ mesh: mesh || sps.mesh, sps });
            };
            try {
                const z = (typeof z0 !== 'undefined') ? z0 : window.z0;
                const gh = z && z.app && z.app.graphicsHelper;
                const mm = gh && gh.spsManagerManager;
                if (mm) {
                    const pools = [mm.spsManagers, mm.pickablez1080s, mm.spsMansToBuild];
                    for (const pool of pools) {
                        if (!pool) continue;
                        for (const o of pool) {
                            if (!o) continue;
                            if (o.sps && o.sps.particles) push(o.sps.mesh, o.sps);
                            if (o.particles && o.mesh) push(o.mesh, o);
                            if (o.mesh && o.mesh.sps) push(o.mesh, o.mesh.sps);
                        }
                    }
                }
            } catch (e) {}
            const arr = scene._solidParticleSystems || [];
            for (const sps of arr) push(sps.mesh, sps);
            for (const m of scene.meshes) {
                const cand = m._sps || m.solidParticleSystem || m.sps;
                if (cand && cand.particles) push(m, cand);
            }
            return list;
        }
        let __spsCache = null;
        function getSPSList() {
            if (!__spsCache || !__spsCache.length) __spsCache = findAllSPS();
            return __spsCache;
        }

        function kickSPSParticle(hitInfo, dn) {
            if (!hitInfo || !hitInfo.pickedPoint) return false;
            const point = hitInfo.pickedPoint;
            const hitMesh = hitInfo.pickedMesh;
            const spsList = getSPSList();
            if (!spsList.length) {
                if (DEBUG) console.log('[gun] SPS list empty');
                return false;
            }

            let particle = null;
            let entry = null;

            const fId = hitInfo.faceId;
            if (fId != null) {
                let tryE = spsList.find(x => x.mesh === hitMesh);
                if (!tryE && hitMesh) tryE = spsList.find(x => x.mesh && x.mesh.name === hitMesh.name);
                if (tryE && tryE.sps.pickedParticles && tryE.sps.pickedParticles[fId]) {
                    const idx = tryE.sps.pickedParticles[fId].idx;
                    const p = tryE.sps.particles && tryE.sps.particles[idx];
                    if (p) { particle = p; entry = tryE; }
                }
                if (!particle) {
                    for (const e of spsList) {
                        if (e.sps.pickedParticles && e.sps.pickedParticles[fId]) {
                            const idx = e.sps.pickedParticles[fId].idx;
                            const p = e.sps.particles && e.sps.particles[idx];
                            if (!p || !p.position) continue;
                            const dx = p.position.x - point.x;
                            const dy = p.position.y - point.y;
                            const dz = p.position.z - point.z;
                            if (dx*dx + dy*dy + dz*dz < 1.0) {
                                particle = p; entry = e; break;
                            }
                        }
                    }
                }
                if (DEBUG && particle) console.log('[gun] SPS hit faceId', fId,
                    'on', entry.mesh && entry.mesh.name);
            }

            if (!particle) {
                let bestDist = 0.7 * 0.7;
                for (const e of spsList) {
                    const parts = e.sps.particles;
                    if (!parts) continue;
                    for (let i = 0; i < parts.length; i++) {
                        const p = parts[i];
                        if (!p || !p.position) continue;
                        const dx = p.position.x - point.x;
                        const dy = p.position.y - point.y;
                        const dz = p.position.z - point.z;
                        const d = dx * dx + dy * dy + dz * dz;
                        if (d < bestDist) { bestDist = d; particle = p; entry = e; }
                    }
                }
                if (DEBUG && particle) console.log('[gun] SPS hit by distance',
                    Math.sqrt(bestDist).toFixed(2), 'on', entry.mesh && entry.mesh.name);
            }

            if (!particle || !entry) {
                if (DEBUG) console.log('[gun] SPS no particle matched');
                return false;
            }

            try {
                if (!particle.velocity) particle.velocity = new BABYLON.Vector3(0, 0, 0);
                particle.velocity.x += dn.x * 0.6;
                particle.velocity.y += Math.max(dn.y, 0) * 0.6 + 0.4;
                particle.velocity.z += dn.z * 0.6;
                particle.position.x += dn.x * 0.12;
                particle.position.y += 0.08;
                particle.position.z += dn.z * 0.12;
                if (particle.rotation) {
                    particle.rotation.x += (Math.random() - 0.5) * 0.6;
                    particle.rotation.y += (Math.random() - 0.5) * 0.6;
                    particle.rotation.z += (Math.random() - 0.5) * 0.6;
                }
                if (entry.sps.setParticles) entry.sps.setParticles();
                if (DEBUG) console.log('[gun] kicked SPS particle @',
                    particle.position.x.toFixed(2), particle.position.y.toFixed(2));
                return true;
            } catch (e) {
                if (DEBUG) console.warn('[gun] SPS kick exception', e);
                return false;
            }
        }

        // 自家 raycast
        const PASSTHROUGH_RE = /^(Background|SPS|bedding|__gun_)/i;
        function customPick(ray) {
            let best = null;
            let bestD = Infinity;
            const meshes = scene.meshes;
            for (let i = 0; i < meshes.length; i++) {
                const m = meshes[i];
                try {
                    if (!m || !m.isEnabled()) continue;
                    if (m.isVisible === false) continue;
                    const n = m.name || '';
                    if (n.startsWith('__gun_')) continue;
                    const r = ray.intersectsMesh(m, false);
                    if (r && r.hit && r.distance < bestD) {
                        bestD = r.distance;
                        best = r;
                    }
                } catch (e) {}
            }
            return best;
        }

        // ------- 實際開火 -------
        function fire() {
            const cam = scene.activeCamera;
            if (!cam) return;

            const rect = canvas.getBoundingClientRect();
            const cx = pointerX - rect.left;
            const cy = pointerY - rect.top;

            let info = null;
            let ray = null;
            try {
                ray = scene.createPickingRay(cx, cy, BABYLON.Matrix.Identity(), cam);
                info = scene.pick(cx, cy, (m) =>
                    m &&
                    m.isEnabled() &&
                    m.isVisible !== false &&
                    !String(m.name || '').startsWith('__gun_')
                );
                if (info && info.hit && PASSTHROUGH_RE.test(info.pickedMesh && info.pickedMesh.name || '')) {
                    const deep = customPick(ray);
                    if (deep && deep.hit && deep.distance < info.distance + 0.01) {
                        if (DEBUG) console.log('[gun] bypass isPickable:',
                            info.pickedMesh.name, '→', deep.pickedMesh.name);
                        info = deep;
                    }
                }
            } catch (e) {}

            flashMuzzle();
            bang();
            // 視覺後座力：準心輕微縮放
            crosshair.classList.remove('fire');
            void crosshair.offsetWidth;
            crosshair.classList.add('fire');

            let end;
            try {
                if (info && info.hit) {
                    end = info.pickedPoint;
                } else {
                    end = ray.origin.add(ray.direction.scale(80));
                }
                const muzzleOffset = cam.getDirection(new BABYLON.Vector3(0.35, -0.45, 1)).scale(1.5);
                const start = cam.position.add(muzzleOffset);
                spawnTracer(start, end);
            } catch (e) {}

            if (info && info.hit) {
                const dir = ray ? ray.direction : cam.getForwardRay().direction;
                registerHit(info.pickedPoint, info.pickedMesh, dir, info);
            }
        }

        function spawnTracer(a, b) {
            try {
                const tr = BABYLON.MeshBuilder.CreateTube(
                    '__gun_tracer',
                    { path: [a, b], radius: 0.04, tessellation: 5, updatable: false },
                    scene
                );
                const mat = new BABYLON.StandardMaterial('__gun_tracer_m', scene);
                mat.emissiveColor = new BABYLON.Color3(1, 0.85, 0.1);
                mat.disableLighting = true;
                tr.material = mat;
                setTimeout(() => { try { tr.dispose(); mat.dispose(); } catch (e) {} }, 45);
            } catch (e) {}
        }

        function flashMuzzle() {
            const el = document.createElement('div');
            el.className = 'gun-muzzle';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 90);
        }

        function registerHit(point, mesh, dir, pickInfo) {
            hits++;
            hitCounter.textContent = hits;
            bumpStat(hitCounter);
            spawnSparks(point);
            popHitRing(point);

            const kicked = applyOimoKick(point, dir || new BABYLON.Vector3(0, 0, 1), mesh);
            if (DEBUG) console.log('[gun] hit mesh:', (mesh && mesh.name) || '(none)',
                'at', point.x.toFixed(2), point.y.toFixed(2), point.z.toFixed(2),
                '→ kicked', kicked, 'bodies');

            const meshName = (mesh && mesh.name) || '';
            let spsHit = false;
            if (/^(SPS|bedding|food|particle)/i.test(meshName)) {
                const dn = (dir && dir.normalizeToNew) ? dir.normalizeToNew()
                                                       : new BABYLON.Vector3(0, 0, 1);
                spsHit = kickSPSParticle(pickInfo || { pickedMesh: mesh, pickedPoint: point }, dn);
            }

            if (!spsHit && mesh && !JIGGLE_BLACKLIST.test(meshName)) {
                jiggleMesh(mesh, dir || new BABYLON.Vector3(0, 0, 1));
            }

            const name = (mesh && mesh.name) || '';
            if (HAM_REGEX.test(name)) {
                hamHits++;
                hamCounter.textContent = hamHits;
                bumpStat(hamCounter);
                hamsterFlash(mesh);
                popBloodSplatter(point);
                const cries = [
                    ['OUCH!',  ''],
                    ['EEK!',   ''],
                    ['!?',     ''],
                    ['@#!*',   ''],
                    ['*BONK*', 'warn'],
                    ['OOF',    'warn'],
                    ['SQUEAK!',''],
                ];
                const c = cries[Math.floor(Math.random() * cries.length)];
                popBubble(point, c[0], c[1]);
            }
        }

        // ------- 粒子：火花 -------
        let dotTex = null;
        function getDotTex() {
            if (dotTex) return dotTex;
            const t = new BABYLON.DynamicTexture('__gun_dot', 16, scene, false);
            const ctx = t.getContext();
            const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            g.addColorStop(0, '#fff');
            g.addColorStop(0.6, '#ff9');
            g.addColorStop(1, 'rgba(255,180,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 16, 16);
            t.update();
            dotTex = t;
            return t;
        }

        function spawnSparks(point) {
            try {
                const ps = new BABYLON.ParticleSystem('__gun_sparks', 80, scene);
                ps.particleTexture = getDotTex();
                ps.emitter = point.clone();
                ps.minEmitBox = new BABYLON.Vector3(-0.05, -0.05, -0.05);
                ps.maxEmitBox = new BABYLON.Vector3(0.05, 0.05, 0.05);
                ps.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1);
                ps.color2 = new BABYLON.Color4(1, 0.3, 0, 1);
                ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
                ps.minSize = 0.05; ps.maxSize = 0.18;
                ps.minLifeTime = 0.15; ps.maxLifeTime = 0.5;
                ps.emitRate = 0;
                ps.manualEmitCount = 35;
                ps.direction1 = new BABYLON.Vector3(-1, -0.5, -1);
                ps.direction2 = new BABYLON.Vector3(1, 2, 1);
                ps.minEmitPower = 1; ps.maxEmitPower = 5;
                ps.gravity = new BABYLON.Vector3(0, -6, 0);
                ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                ps.start();
                setTimeout(() => {
                    ps.stop();
                    setTimeout(() => { try { ps.dispose(); } catch (e) {} }, 800);
                }, 60);
            } catch (e) {}
        }

        // 純螢幕邊緣紅色暈影（FPS-style 受擊閃光），不在命中點貼任何貼圖
        function popBloodSplatter(/* point3d unused */) {
            try {
                const vig = document.createElement('div');
                vig.className = 'gun-blood-vignette';
                document.body.appendChild(vig);
                setTimeout(() => vig.remove(), 600);
            } catch (e) {}
        }

        // 命中環（2D 投影 → 螢幕）
        function popHitRing(point3d) {
            try {
                const cam = scene.activeCamera;
                const coords = BABYLON.Vector3.Project(
                    point3d,
                    BABYLON.Matrix.Identity(),
                    scene.getTransformMatrix(),
                    cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
                );
                const dpr = window.devicePixelRatio || 1;
                const ring = document.createElement('div');
                ring.className = 'gun-hit-ring';
                ring.style.left = (coords.x / dpr) + 'px';
                ring.style.top  = (coords.y / dpr) + 'px';
                document.body.appendChild(ring);
                setTimeout(() => ring.remove(), 400);
            } catch (e) {}
        }

        // 靜態 mesh 視覺位移
        const jiggling = new WeakSet();
        function jiggleMesh(mesh, dir) {
            if (!mesh) return;
            if (!mesh.position || typeof mesh.position.clone !== 'function') {
                if (DEBUG) console.log('[gun] jiggle skip (no position):', mesh.name);
                return;
            }
            if (jiggling.has(mesh)) return;
            jiggling.add(mesh);

            try { mesh.unfreezeWorldMatrix && mesh.unfreezeWorldMatrix(); } catch (e) {}

            const dn = dir.normalizeToNew ? dir.normalizeToNew() : dir;
            const offset = new BABYLON.Vector3(
                dn.x * JIGGLE_DIST,
                Math.max(dn.y, 0) * JIGGLE_DIST + JIGGLE_DIST * 0.3,
                dn.z * JIGGLE_DIST
            );
            const orig = mesh.position.clone();
            mesh.position.addInPlace(offset);

            if (DEBUG) console.log('[gun] jiggle', mesh.name,
                'Δ=', offset.x.toFixed(2), offset.y.toFixed(2), offset.z.toFixed(2));

            const start = performance.now();
            const step = () => {
                const t = (performance.now() - start) / JIGGLE_MS;
                if (t >= 1) {
                    mesh.position.copyFrom(orig);
                    jiggling.delete(mesh);
                    return;
                }
                const e = 1 - Math.pow(1 - t, 2);
                const back = offset.scale(1 - e);
                mesh.position.copyFrom(orig.add(back));
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        function hamsterFlash(mesh) {
            try {
                const mat = mesh.material;
                if (!mat || !('emissiveColor' in mat)) return;
                const saved = mat.emissiveColor ? mat.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);
                mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
                setTimeout(() => { try { mat.emissiveColor = saved; } catch (e) {} }, 180);
            } catch (e) {}
        }

        function popBubble(point3d, text, variant) {
            try {
                const cam = scene.activeCamera;
                const coords = BABYLON.Vector3.Project(
                    point3d,
                    BABYLON.Matrix.Identity(),
                    scene.getTransformMatrix(),
                    cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
                );
                const dpr = window.devicePixelRatio || 1;
                const el = document.createElement('div');
                el.className = 'gun-bubble' + (variant ? ' ' + variant : '');
                el.textContent = text;
                el.style.left = (coords.x / dpr) + 'px';
                el.style.top  = (coords.y / dpr) + 'px';
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 920);
            } catch (e) {}
        }

        // ------- Web Audio 合成槍聲 -------
        let audioCtx = null;
        function bang() {
            try {
                audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                const ctx = audioCtx;
                if (ctx.state === 'suspended') ctx.resume();
                const now = ctx.currentTime;

                const buf = ctx.createBuffer(1, (ctx.sampleRate * 0.12) | 0, ctx.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < data.length; i++) {
                    const env = Math.exp(-i / (data.length * 0.18));
                    data[i] = (Math.random() * 2 - 1) * env;
                }
                const src = ctx.createBufferSource();
                src.buffer = buf;

                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.value = 1600;
                lp.Q.value = 1.5;

                const gain = ctx.createGain();
                gain.gain.value = 0.22;
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                src.connect(lp).connect(gain).connect(ctx.destination);
                src.start(now);
                src.stop(now + 0.12);
            } catch (e) {}
        }

        console.log('Gun mod ready (UI v2). Press G to arm, click/hold to fire.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForScene(initGun));
    } else {
        waitForScene(initGun);
    }
})();
