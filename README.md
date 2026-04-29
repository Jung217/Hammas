# Hammas

**English** &nbsp;|&nbsp; [繁體中文](README.zh-TW.md)

> v1.0 by [Jung217](https://cjchien.com)
>
> Forked from [hammyhome.com](https://hammyhome.com/) (original by [aBowman](https://www.abowman.com), copyright remains with the original author)
>
> Hammas adds a Gun Mod, redesigns the UI/UX, repaints the tab icon, and patches physics drift on top of the original `ham.min.js` — **without touching the original minified bundle**.

## Directory

```
Hammas/
├── README.md                 ← This file (English)
├── README.zh-TW.md           ← Traditional Chinese version
├── LICENSE
├── docs/                     ← Web root that gets served
│   ├── index.html            ← Entry + splash + Start screen + UI/UX polish styles
│   ├── favicon.svg           ← Hand-drawn SVG icon: hamster + pistol (v1.0 redraw)
│   ├── favicon.ico           ← Legacy browser fallback
│   ├── manifest.webmanifest  ← PWA settings (renamed to Hammas)
│   ├── sw.js                 ← Service Worker (disabled in dev)
│   ├── robots.txt
│   ├── js/
│   │   ├── ham.min.js        ← Main app (1.84 MB, third-party, untouched)
│   │   ├── babylon.js        ← Babylon.js 3D engine
│   │   ├── libs.js           ← Utility lib
│   │   ├── pep.min.js        ← Pointer Events polyfill
│   │   └── gun.js            ← Gun Mod v2 (custom, ~1300 lines)
│   ├── css/styles.min.css
│   ├── data/
│   │   ├── accessories.json  ← Babylon scene: 95 meshes / 51 materials
│   │   ├── accessories2.json ← Babylon scene: 22 meshes / 11 materials
│   │   └── shaders/ham/
│   │       ├── config.json
│   │       └── custom.fragment.fx  ← Hamster fur shader
│   ├── images/               ← Splash, starter thumbs, PWA icons
│   └── fonts/                ← Muli + custom ham-font glyph font
├── pretty/                   ← Unminified reference copy (not served)
│   ├── ham.js                ← 49,198 lines
│   └── styles.css            ← 1,914 lines
└── analysis/
    ├── scene_inventory.txt   ← Babylon scene object inventory
    └── all_meshes.txt        ← All mesh / material names (basis for mod's exclusion regex)
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| 3D rendering | **Babylon.js** (WebGL) |
| Physics | **OIMO.js** (not Babylon's built-in Cannon) |
| Scene authoring | Blender 2.76 → `.babylon` export |
| Hamster appearance | Custom GLSL fragment shader (`custom.fragment.fx`) |
| Pointer events | PEP polyfill |
| Offline | Service Worker + manifest (disabled in dev) |
| Fonts | Muli (Google Fonts) + custom `ham-font` icon font |
| Mod UI | Pure vanilla JS + CSS-in-JS (glassmorphism + tactical HUD), no framework |

## Original Architecture (218 top-level functions/classes)

### Containers
- **Cage**: 2×2, 2×3, 2×4, 3×2, 3×3, 3×4, 4×2, 4×3, 4×4 (9 sizes)
- **House**: House1 / House2 / House3 / House4
- **Starter Homes**: starter1–4

### Tube system
- `TubeStraight`, `TubeCurved` / `TubeCurved2`, `TubeCross`, `TubeTee`
- `TubeCap`, `TubeCover`
- `Connector`: `ConnectorCage`, `ConnectorFloor`, `ConnectorTube`, `ConnectorHidden`

### Accessories
| Type | Entities |
|------|----------|
| Exercise wheels | `Wheel1a/b/c`, `Wheel2a/b/c` |
| Bowls | `Bowl1`, `Bowl2` |
| Water bottles | `WaterBottle1`, `WaterBottle2` |
| Chew toys | `SimpleChew`, `SimpleChew2`, `StickChew`, `HangingChew`, `boxChew` |
| Furniture | `Platform1/2`, `Ramp1/2`, `Bridge`, `Swing`, `Bed` |
| Food | `Food`, `FoodMound`, `FoodTracker` (visual: pumpkinSeed, corn, sunflowerSeed, disc, donut) |
| Bedding | `Bedding2x4`, `Bedding3x4`, `Bedding4x4`, `BeddingParticle`, `BeddingSides` |

### Hamster
- Anatomy: `Body`, `Belly`, `Ears`, `Whiskers`, `PhysicsBody`
- Fur shader: **12 toggleable patterns**
- AI: `HouseNavigator`, `TubeNavigator`, `WheelNavigator`, `RampNavigator`, `BowlNavigator`, `SwingNavigator`, `BridgeNavigator`

### Hamster customization (extracted from `custom.fragment.fx`)
```glsl
// Colors (vec3)
bodyColor, eyesColor, pawsColor, earsColor

// Pattern toggles (0/1)
hasBelly, hasFU, hasRU, hasChin,
hasCheeks1, hasCheeks2, hasBlaze,
hasMiddleBand, hasSpots, hasCheekFlash, hasSnout

// Geometry / parameters
cheekX, cheekY, cheekBlur, radius,
rand, noiseMult,
shaderTweak1..4
```
→ Combinatorial space ≈ 2¹¹ × continuous color space ≈ **practically infinite hamster looks**.

### OIMO body naming convention (relevant when patching physics drift)
The original uses `{Object}_{part}` for OIMO body names:
- `Wheel1a_wheel`, `Wheel1a_stand`, `Wheel1a_base`, `Wheel1a_wheelBumper1`
- `House1`, `house2_inside`, `house2_roof`, `House1_houseBumper1`
- `boxChew0`, `boxChew1`
- `*_holder`, `*_inside`, `*_button`, `*_saucer`, `*Bumper`

> The Gun Mod's `STRUCTURE_RE` exclusion list is built around this convention.

### System classes
- `CleanController`, `FoodManager`, `FoodBiteManager`, `BeddingSideHoleManager`
- Event system: every accessory has matching `*Events` and `*Navigator`

---

## Hammas Customization (v1.0)

### 1. UI/UX redesign (`docs/index.html` + `docs/js/gun.js`)

Design language: **Glassmorphism + Tactical HUD** (recommended by the `ui-ux-pro-max` skill). Every overlay shares the same `backdrop-filter: blur(14px) saturate(140%)` + 1px hairline border + soft shadow + 12px radius.

| Surface | Change |
|---------|--------|
| **Tab icon** | Hand-drawn `favicon.svg`: orange rounded square + golden hamster (pink inner ears, white snout, pink cheek blush, big black eyes, brown nose, smile) + two paws holding a black pistol + yellow-and-white star muzzle flash. SVG favicons work in all modern browsers. |
| **Splash** | Two-layer radial gradient for depth, bolder title with -0.02em tracking, version badge → uppercase letterspacing, icon drop-shadow |
| **Start screen** (starter home picker) | Dark glass backdrop (dual radial gradient), cards → 16px radius + hover lift 4px, selected state uses inset green ring (no more 10px border that shifted layout), cage-name → pill style, `.progress-bar` hidden |
| **In-game header** | Top-left back button + top-right toolbar → glass background (`rgba(12,16,24,.55)` + blur), hover deepens, active scale(0.95); `.drop-down-options` switched to matching glass menu |
| **Top-left 3-dot edit menu** | `#more-edit-options-btn` + `#more-edit-options-menu` `display:none` (originally exposed Background Pattern / Color, not needed) |
| **Top-right Delete** | 3-dot wrapper (`#more-options-btn`) hidden; `#more-options-menu { display: block }` forced visible at the original 3-dot slot; `#delete-cage-btn` gets red hover + deeper-red active |

### 2. Gun Mod v2 (`docs/js/gun.js`, ~1300 lines)

Layered on top of `ham.min.js`, **without modifying the original**. Physics / raycast / particle logic preserved; UI fully rewritten.

#### Controls

| Key | Action |
|-----|--------|
| **G** | Toggle STANDBY / ARMED |
| **Shift+G** | Toggle DEBUG console logs |
| Mouse move | Crosshair tracks cursor |
| Left click | Single shot |
| Left hold | Auto-fire (~11 rounds/s, 90 ms throttle) |
| **Space** | Auto-fire (keyboard alt) |
| Bottom-right pill | Click = same as G |

#### UI Elements (v2 redesign)

| Element | Design |
|---------|--------|
| Status pill | Floating bottom-right glass capsule: LED dot (red pulse when armed) + STANDBY/ARMED label + standalone `G` keycap chip. Anchored at `bottom: 110px; right: 14px` (above zoom buttons, clear of every dropdown) |
| Crosshair | SVG tactical reticle: white ring + 4 outer red ticks + center red dot; 2.4 s breathing glow when armed; each shot triggers a 0.14 s scale(1.22) recoil pulse |
| Screen frame | When armed: 4 corner brackets (`.corner.tl/tr/bl/br`, red drop-shadow) + inset red vignette |
| HUD board | Bottom-left glass card: `SHOTS` / `BONKED` columns, monospace tabular-nums, every hit triggers a 0.35 s spring bump scale(1.22) + red flash on the number |
| Hit bubbles | Bold system sans-serif, red (OUCH/EEK/SQUEAK) / yellow (BONK/OOF) gradient variants, randomized rotation |
| Hit ring | `Vector3.Project` projects the 3D hit point to 2D, expanding 8px → 64px yellow ring over 0.38 s |
| Muzzle flash | Full-viewport radial gradient + `mix-blend-mode: screen` for natural light addition, 0.12 s |
| Blood feedback | Pure 2D edge vignette (`.gun-blood-vignette`, FPS-style hit indicator) — does not touch the 3D scene |
| First-arm hint | Keybind toast on first arm (`localStorage.hammas_gun_help_shown_v2`, fires once per browser) |
| A11y | `aria-pressed` / `aria-hidden` / `aria-live="polite"`, focus ring, Enter/Space activation, full `prefers-reduced-motion` support |

#### Physics (OIMO impulses)

- **Direct hit**: `scene.pick` → `findOwnerFromMesh` walks up the parent chain looking for `applyImpulse` (checks `owner.body / dynamicBody / bumper2 / draggerBody`) → `KICK_DV=4.0` + `KICK_LIFT=0.4`
- **Splash**: every dynamic body within `KICK_RADIUS=1.8`, distance falloff × `SPLASH_MUL=0.35`
- **Hamster special case**: when shot directly, kick all 4 segments via `^hamster\d+(_|$)`, `HAMSTER_DV=24` + `HAMSTER_LIFT=8` (must overpower the AI's position writeback to be visible)
- **Effective mass cap** `MAX_EFF_MASS=10` so heavy objects still react
- **SPS particles** (food, bedding): `pickInfo.faceId` → `sps.pickedParticles[faceId].idx` for exact-particle hit, falls back to nearest-distance scan

#### Structure protection (drift fix)

`STRUCTURE_RE` exclusion list — **prefix + suffix double check**:

```js
/(^(cage|wall|floor|ceiling|background|wheel|w\d+[a-c]|house|tube|
   connector|cover|ramp|bridge|platform|suction|box|swing))
 |(_stand|_base|_holder|_inside|_button|_roof|_ears|_saucer|bumper)/i
```

| Behavior | Result |
|----------|--------|
| Direct or splash hit on any matched mesh / body | **Skip impulse** |
| Still launchable | bowls, bedding particles, food (disc/donut/seed/corn), hamsters, `simpleChew`/`stickChew`/`hangingChew`, `swing` body |

> All wheel parts (`Wheel1a_wheel`, `_stand`, `_base`, `*Bumper`), houses (incl. `house*_inside/_roof/_houseBumper`), `boxChew`, cages, tubes, ramps, bridges, suction cups, water-bottle holders → all pinned.

#### House pinning (collision drift fix)

Houses are dynamic OIMO bodies, so a hamster bumping into them slowly drifts them out of place. `scene.onBeforeRenderObservable` runs every frame:

1. Walks `world.rigidBodies`, finds all `^house` dynamic bodies, snapshots their initial `{x, y, z}`
2. Zeros `linearVelocity` / `angularVelocity` and resets `position` to the snapshot
3. Calls `body.syncShapes()`
4. Skips entirely when `#main.build-mode` is set, so houses can still be dragged in build mode
5. Clears the snapshot map when the body leaves the world (deleted/replaced)

Hamster collisions still feel responsive (the hamster bounces off), but the house never moves.

#### Visual feedback (when no physics)

For static, non-blacklisted meshes, `jiggleMesh` shifts the mesh 0.08 units toward the impact then quadratic-eases back over 160 ms. **JIGGLE_BLACKLIST** covers hamster, SPS, bedding, wheel, chew, cage, wall, floor, ceiling, `waterLine`, `foodMound` — these either have real physics (would double-react) or are large structural pieces (shouldn't shake).

#### Hamster-specific hit effects

When the picked mesh matches `/ham|belly|ears?|whisker|snout|paw|cheek|body|armature|fur/i`:
- Material `emissiveColor` flashes red for 180 ms
- Comic onomatopoeia bubble (OUCH! / EEK! / !? / @#!\* / *BONK* / OOF / SQUEAK!)
- Edge red vignette (FPS-style screen feedback)

#### Gun sound

Web Audio synthesis: white-noise buffer × exponential-decay envelope → biquad lowpass 1600 Hz Q=1.5 → exponentialRamp to 0.001. 0.12 s, no audio asset needed.

---

## Changes vs Upstream

| File | Change | Type |
|------|--------|------|
| `docs/js/gun.js` | New — ~1300 lines, Gun Mod v2 | Pure addition |
| `docs/js/ham.min.js` | **Zero changes** | Third-party original |
| `docs/index.html` | Title `Hammas` / appVersion `v1.0` / appInfo by Jung217; loads `gun.js`, `favicon.svg`; splash gradient; UI/UX polish stylesheet (glass / header / drop-down / hide progress bar / hide top-left 3-dot / top-right Delete direct); `#share-btn` & `.share-dialog` removed via MutationObserver; hidden stubs `<div id="aBowman">` / `<span id="appVersion">` to prevent `ham.min.js:4431/4968` null deref; SW disabled and existing SWs unregistered | Addition / style override |
| `docs/manifest.webmanifest` | `name` / `short_name` / `description` → `Hammas` | Text replacement |
| `docs/favicon.svg` | New — 64×64 viewBox SVG (hamster + pistol) | Pure addition |

> All third-party files (`ham.min.js`, `babylon.js`, `libs.js`, `pep.min.js`, `styles.min.css`, every `.json`, `.fx`, font, original PNG icons) are kept verbatim.

## Local Run

```bash
cd Hammas/docs
python -m http.server 8080
# open http://localhost:8080/
```

> Has to be served over HTTP (not `file://`) — Service Worker and relative-path resources need it.

## Where to Edit What

- Mod UI → `docs/js/gun.js` (CSS lives inside `injectUI()`; HTML structure lives where the overlay/toggle/hud/help elements are constructed)
- Splash / start screen / in-game header → the two `<style>` blocks inside `docs/index.html`
- Physics exclusion rules → `STRUCTURE_RE` in `docs/js/gun.js` (cross-reference `analysis/all_meshes.txt` for new mesh names)
- See what the original does → `pretty/ham.js` (formatted, readable)
