// ============================================================
//  HammyHome Gun Mod  —  純學習/本機遊玩用
//  作者：玩家自製；附加於 ham.min.js 之上，不修改原檔
//
//  操作：
//    G          切換開關（OFF / ON）
//    滑鼠移動    準心跟著游標
//    左鍵單擊    單發（游標指到哪射到哪）
//    左鍵按住    連射（約 11 發/秒）
//    Space      連射（鍵盤替代）
//    按住拖曳    仍可旋轉場景（相機操作未被攔截）
//
//  物理：命中點以 OIMO.js 套用衝量（本遊戲用 OIMO，非 Babylon 內建）
// ============================================================

(function () {
    'use strict';

    const HAM_REGEX = /ham|belly|ears?|whisker|snout|paw|cheek|body|armature|fur/i;

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

    function injectUI() {
        if (document.getElementById('gunOverlay')) return;

        const style = document.createElement('style');
        style.textContent = `
            #gunOverlay { position:fixed; inset:0; pointer-events:none; z-index:99998; display:none; }
            #gunOverlay.on { display:block; }
            #gunCrosshair {
                position:absolute; width:40px; height:40px;
                transform:translate(-50%,-50%);
                left:50%; top:50%;
                will-change: left, top;
            }
            #gunCrosshair::before, #gunCrosshair::after {
                content:''; position:absolute; left:50%; top:50%;
                background:#ff2020; box-shadow:0 0 4px #ff0;
            }
            #gunCrosshair::before { width:2px; height:26px; transform:translate(-50%,-50%); }
            #gunCrosshair::after  { width:26px; height:2px; transform:translate(-50%,-50%); }
            #gunCrosshair > .dot {
                position:absolute; left:50%; top:50%;
                width:6px; height:6px; border-radius:50%;
                background:#ff2020; transform:translate(-50%,-50%);
                box-shadow:0 0 6px #f00;
            }
            #gunToggle {
                position:fixed; top:10px; left:50%; transform:translateX(-50%);
                padding:6px 14px; background:rgba(0,0,0,.75); color:#fff;
                border-radius:18px; font:bold 13px/1 monospace;
                cursor:pointer; user-select:none; pointer-events:auto;
                z-index:99999; border:2px solid #444;
            }
            #gunToggle.armed {
                background:rgba(180,20,20,.9); border-color:#ff0;
                animation: gun-pulse 1s infinite;
            }
            @keyframes gun-pulse {
                0%,100% { box-shadow:0 0 6px #f00; }
                50%     { box-shadow:0 0 18px #f00; }
            }
            #gunHud {
                position:fixed; bottom:10px; left:10px;
                padding:6px 12px; background:rgba(0,0,0,.7); color:#0f0;
                font:bold 12px/1.4 monospace; border-radius:4px;
                z-index:99999; pointer-events:none; display:none;
            }
            #gunOverlay.on ~ #gunHud { display:block; }
            body.gun-armed, body.gun-armed * { cursor:none !important; }
            .gun-muzzle {
                position:fixed; inset:0;
                background:radial-gradient(circle at center, rgba(255,220,100,.55), transparent 45%);
                pointer-events:none; z-index:99997;
                animation: gun-muzzle .08s ease-out;
            }
            @keyframes gun-muzzle { from { opacity:1; } to { opacity:0; } }
            .gun-bubble {
                position:fixed; transform:translate(-50%,-100%);
                background:#fff; color:#c00;
                font:bold 20px 'Comic Sans MS', monospace;
                padding:4px 12px; border-radius:14px; border:3px solid #000;
                pointer-events:none; z-index:99999;
                animation: gun-bubble .9s ease-out forwards;
                white-space:nowrap;
            }
            @keyframes gun-bubble {
                0%   { opacity:0; transform:translate(-50%,-60%)  scale(.6); }
                20%  { opacity:1; transform:translate(-50%,-100%) scale(1.3); }
                80%  { opacity:1; transform:translate(-50%,-150%) scale(1); }
                100% { opacity:0; transform:translate(-50%,-200%) scale(.9); }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'gunOverlay';
        overlay.innerHTML = '<div id="gunCrosshair"><div class="dot"></div></div>';
        document.body.appendChild(overlay);

        const toggle = document.createElement('div');
        toggle.id = 'gunToggle';
        toggle.textContent = 'GUN OFF (press G)';
        document.body.appendChild(toggle);

        const hud = document.createElement('div');
        hud.id = 'gunHud';
        hud.innerHTML =
            'Shots Hit: <span id="hitCount">0</span> &nbsp;|&nbsp; BONKED: <span id="hamCount">0</span>';
        document.body.appendChild(hud);
    }

    function initGun(scene) {
        injectUI();

        const engine = scene.getEngine();
        const canvas = engine.getRenderingCanvas();

        let gunOn = false;
        let hits = 0;
        let hamHits = 0;
        let pointerX = window.innerWidth / 2;
        let pointerY = window.innerHeight / 2;

        const crosshair = document.getElementById('gunCrosshair');
        const toggleBtn = document.getElementById('gunToggle');
        const hitCounter = document.getElementById('hitCount');
        const hamCounter = document.getElementById('hamCount');
        const overlay = document.getElementById('gunOverlay');

        const updateCrosshair = () => {
            crosshair.style.left = pointerX + 'px';
            crosshair.style.top = pointerY + 'px';
        };

        const setGunOn = (on) => {
            gunOn = on;
            overlay.classList.toggle('on', on);
            toggleBtn.textContent = on ? 'GUN ON (press G)' : 'GUN OFF (press G)';
            toggleBtn.classList.toggle('armed', on);
            document.body.classList.toggle('gun-armed', on);
            if (on) updateCrosshair(); else stopFire();
        };

        // ------- 輸入事件 -------
        // pointermove：更新準心位置（不攔截，相機仍可拖曳）
        window.addEventListener('pointermove', (e) => {
            pointerX = e.clientX;
            pointerY = e.clientY;
            if (gunOn) updateCrosshair();
        }, true);

        // pointerdown：僅在 gun ON + 左鍵 + 目標是 3D canvas 時開火
        // 不呼叫 stopPropagation，讓相機拖曳仍可運作（單純點擊不會拖到相機）
        window.addEventListener('pointerdown', (e) => {
            if (!gunOn || e.button !== 0) return;
            if (e.target && e.target.closest && e.target.closest('#gunToggle')) return;
            // 只攔截在 canvas 上的點擊
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
                        // spsManagerManager 內部結構偵察
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
                        // 所有名字有 SPS 的 mesh
                        const spsMeshes = scene.meshes.filter(m => /SPS/i.test(m.name || ''));
                        console.log('[gun] meshes named SPS:', spsMeshes.length,
                            spsMeshes.map(m => ({
                                name: m.name, uid: m.uniqueId,
                                pick: m.isPickable, vis: m.isVisible,
                                hasSps: !!(m._sps || m.solidParticleSystem || m.sps)
                            })));
                        // 食物類 mesh
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

        // ------- 連射迴圈：rAF + 時間節流 -------
        let firing = false;
        let lastFireAt = 0;
        const FIRE_INTERVAL_MS = 90;

        function startFire() {
            if (!gunOn || firing) return;
            firing = true;
            lastFireAt = 0;          // 立即射第一發
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

        const KICK_RADIUS    = 1.8;   // 空間濺射搜尋半徑
        const KICK_DV        = 4.0;   // 命中目標增加多少速度 (units/sec)
        const KICK_LIFT      = 0.4;   // 向上附加速度
        const SPLASH_MUL     = 0.35;  // 濺射相較直擊的強度
        const MAX_EFF_MASS   = 10;    // 質量上限：>此值的物件吃到的脈衝被壓下來

        // 倉鼠專用加強（4 節身體同步，要蓋過 AI 位置覆寫）
        const HAMSTER_DV     = 24;    // 超大 DV 才看得出被撞
        const HAMSTER_LIFT   = 8;     // 往上噴一點
        const HAMSTER_PART_RE = /^hamster\d*(_|$)/i;

        // 結構性物件（籠子、牆、地板、天花板、背景）不接受物理衝擊，
        // 否則打中旁邊配件就會把整個籠子推位移。
        const STRUCTURE_RE   = /^(cage|wall|floor|ceiling|background)/i;

        // 視覺 jiggle 黑名單：有真實物理的東西不晃（避免雙重反應），以及大結構
        const JIGGLE_BLACKLIST = /^(Background|SPS|bedding|cage|wall|floor|ceiling|hamster|simpleChew|stickChew|boxChew|hangingChew|wheel|w\d+a|waterLine|foodMound)/i;
        const JIGGLE_DIST      = 0.08;  // 位移距離
        const JIGGLE_MS        = 160;   // 回彈時間

        let   DEBUG          = false; // Shift+G 切換

        // 從打到的 mesh 往上找所屬遊戲物件（Bowl, Food, SimpleChew …）
        // 這些物件常有 body / dynamicBody / bumper2 等 OIMO body 屬性
        const OWNER_KEYS = ['owner', 'gameObject', 'entity', '_owner', '_entity',
                            '__obj', 'accessory', 'parent3d'];
        const BODY_KEYS  = ['body', 'dynamicBody', 'bumper2', 'draggerBody'];

        function findOwnerFromMesh(mesh) {
            let m = mesh;
            let depth = 0;
            while (m && depth < 8) {
                // 先檢查 mesh 自己有沒有直接連到的 body
                for (const k of BODY_KEYS) {
                    if (m[k] && typeof m[k].applyImpulse === 'function') return m;
                }
                // 再檢查有沒有 owner-like 屬性
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
            const kicked = new Set();   // 已踢過的 body（避免雙重觸發）

            // strength = 1.0 直擊 / 0~SPLASH_MUL 濺射
            const kickBody = (body, strength, label) => {
                if (!body) return false;
                if (kicked.has(body)) return false;  // 不重複踢
                if (!body.isDynamic || body.inverseMass <= 0) {
                    if (DEBUG) console.log('[gun] skip static:', label, body.name);
                    return false;
                }
                try {
                    const mass = 1 / body.inverseMass;
                    const effMass = Math.min(mass, MAX_EFF_MASS);
                    const dv = KICK_DV * strength;
                    const liftDv = KICK_LIFT * strength;
                    // 脈衝 = delta-v × 質量（OIMO 會除回 mass，實際 delta-v ≈ dv）
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

            // 0) 倉鼠特例：只踢「被命中那隻」的 4 節身體（不要波及其他倉鼠）
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

            // 1) Direct hit：從 mesh 追 owner，踢其 body（全力）
            //    結構物（籠子等）跳過，避免擊中籠壁就把籠子推走
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

            // 2) 空間濺射：半徑內其他動態 body（弱化）
            //    排除所有 hamster* body（只打到一隻時不該連帶噴飛其他倉鼠）
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

        // SPS 查找：多管道、多結構，把能抓到的都塞進 list
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
                            // Pattern A: o.sps = Babylon SPS
                            if (o.sps && o.sps.particles) push(o.sps.mesh, o.sps);
                            // Pattern B: o 本身就是 Babylon SPS
                            if (o.particles && o.mesh) push(o.mesh, o);
                            // Pattern C: o.mesh 的自我 reference
                            if (o.mesh && o.mesh.sps) push(o.mesh, o.mesh.sps);
                        }
                    }
                }
            } catch (e) {}
            // 備援：Babylon 內建清單
            const arr = scene._solidParticleSystems || [];
            for (const sps of arr) push(sps.mesh, sps);
            // 備援：mesh 上直接掛的
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
        // 精準：用 pickInfo.faceId → sps.pickedParticles[faceId].idx 找到那顆粒子
        // 退而求其次用 nearest point
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

            // Method 1：faceId 精準（若 mesh 能對上就試，否則掃全部）
            const fId = hitInfo.faceId;
            if (fId != null) {
                let tryE = spsList.find(x => x.mesh === hitMesh);
                if (!tryE && hitMesh) tryE = spsList.find(x => x.mesh && x.mesh.name === hitMesh.name);
                if (tryE && tryE.sps.pickedParticles && tryE.sps.pickedParticles[fId]) {
                    const idx = tryE.sps.pickedParticles[fId].idx;
                    const p = tryE.sps.particles && tryE.sps.particles[idx];
                    if (p) { particle = p; entry = tryE; }
                }
                // 沒找到 → 掃全部 SPS 的 pickedParticles[fId]，驗證距離合理
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

            // Method 2：空間搜尋 — 掃所有 SPS 所有粒子（最穩當的後路）
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
                // 隨機角速度
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

        // 自家 raycast：繞過 isPickable（食物、食物顆粒等常被設成不可 pick）
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

        // ------- 實際開火：以游標位置做 scene.pick -------
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
                // 若 scene.pick 打到「穿透用」的背板（表示前面有 isPickable=false 的東西被忽略），
                // 退而求其次自己 iterate 所有 mesh 找最近交點
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

            // 彈道線：從「攝影機前方偏下、偏右」到命中點
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
                // 子彈方向 = 射線方向（水平成分為主）
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
            setTimeout(() => el.remove(), 70);
        }

        function registerHit(point, mesh, dir, pickInfo) {
            hits++;
            hitCounter.textContent = hits;
            spawnSparks(point);

            // 對命中點周圍的 OIMO 動態物件施加衝量（配件、食物、碗、chew 等）
            const kicked = applyOimoKick(point, dir || new BABYLON.Vector3(0, 0, 1), mesh);
            if (DEBUG) console.log('[gun] hit mesh:', (mesh && mesh.name) || '(none)',
                'at', point.x.toFixed(2), point.y.toFixed(2), point.z.toFixed(2),
                '→ kicked', kicked, 'bodies');

            // 命中 SPS（食物粒子系統）→ 用 faceId 找那顆粒子推
            const meshName = (mesh && mesh.name) || '';
            let spsHit = false;
            if (/^(SPS|bedding|food|particle)/i.test(meshName)) {
                const dn = (dir && dir.normalizeToNew) ? dir.normalizeToNew()
                                                       : new BABYLON.Vector3(0, 0, 1);
                spsHit = kickSPSParticle(pickInfo || { pickedMesh: mesh, pickedPoint: point }, dn);
            }

            // 視覺 jiggle：沒命中 SPS 粒子、非黑名單
            if (!spsHit && mesh && !JIGGLE_BLACKLIST.test(meshName)) {
                jiggleMesh(mesh, dir || new BABYLON.Vector3(0, 0, 1));
            }

            const name = (mesh && mesh.name) || '';
            if (HAM_REGEX.test(name)) {
                hamHits++;
                hamCounter.textContent = hamHits;
                hamsterFlash(mesh);
                const cries = ['OUCH!', 'EEK!', '!?', '@#!*', '*BONK*', 'OOF', 'SQUEAK!'];
                popBubble(point, cries[Math.floor(Math.random() * cries.length)]);
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

        // 靜態 mesh 的視覺位移（不透過物理，直接位移再彈回）
        const jiggling = new WeakSet();
        function jiggleMesh(mesh, dir) {
            if (!mesh) return;
            if (!mesh.position || typeof mesh.position.clone !== 'function') {
                if (DEBUG) console.log('[gun] jiggle skip (no position):', mesh.name);
                return;
            }
            if (jiggling.has(mesh)) return;
            jiggling.add(mesh);

            // 防止 Babylon worldMatrix 被 freeze 導致改 position 沒用
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
            // 倉鼠本身通常不是 OIMO 動態 body（由 AI 控制），視覺上紅閃
            try {
                const mat = mesh.material;
                if (!mat || !('emissiveColor' in mat)) return;
                const saved = mat.emissiveColor ? mat.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);
                mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
                setTimeout(() => { try { mat.emissiveColor = saved; } catch (e) {} }, 180);
            } catch (e) {}
        }

        function popBubble(point3d, text) {
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
                el.className = 'gun-bubble';
                el.textContent = text;
                el.style.left = (coords.x / dpr) + 'px';
                el.style.top = (coords.y / dpr) + 'px';
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 900);
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

        console.log('Gun mod ready. Press G to arm, move mouse to aim, click/hold to fire.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForScene(initGun));
    } else {
        waitForScene(initGun);
    }
})();
