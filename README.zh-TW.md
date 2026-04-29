# Hammas

[English](README.md) &nbsp;|&nbsp; **繁體中文**

> v1.0 by [Jung217](https://cjchien.com)
>
> 參考來源：[hammyhome.com](https://hammyhome.com/)（原作者 [aBowman](https://www.abowman.com)，著作權屬原作者）
>
> 本專案在原作 `ham.min.js` 之上，加掛 Gun Mod、重塑 UI/UX、改 Tab Icon、修物理飄移，**不改原始壓縮檔**。

## 目錄結構

```
Hammas/
├── README.md                 ← 英文版（GitHub 預設）
├── README.zh-TW.md           ← 本檔
├── LICENSE
├── docs/                     ← 實際 serve 的根目錄
│   ├── index.html            ← 入口 + 啟動 splash + Start 選單 + UI/UX polish 樣式
│   ├── favicon.svg           ← 自繪 SVG icon：倉鼠 + 手槍（v1.0 重畫）
│   ├── favicon.ico           ← 舊瀏覽器 fallback
│   ├── manifest.webmanifest  ← PWA 設定（已改名 Hammas）
│   ├── sw.js                 ← Service Worker（開發期已停用）
│   ├── robots.txt
│   ├── js/
│   │   ├── ham.min.js        ← 主程式（1.84 MB，第三方原檔不動）
│   │   ├── babylon.js        ← Babylon.js 3D 引擎
│   │   ├── libs.js           ← 工具函式庫
│   │   ├── pep.min.js        ← 指標事件填充
│   │   └── gun.js            ← Gun Mod v2（自製，約 1300 行）
│   ├── css/styles.min.css
│   ├── data/
│   │   ├── accessories.json  ← Babylon 場景：95 mesh / 51 material
│   │   ├── accessories2.json ← Babylon 場景：22 mesh / 11 material
│   │   └── shaders/ham/
│   │       ├── config.json
│   │       └── custom.fragment.fx  ← 倉鼠毛色著色器
│   ├── images/               ← 啟動圖、starter 縮圖、PWA icons
│   └── fonts/                ← Muli 字型 + 自製 ham-font 圖示字型
├── pretty/                   ← 反壓縮後可讀版（純參考，不會被 serve）
│   ├── ham.js                ← 49,198 行
│   └── styles.css            ← 1,914 行
└── analysis/
    ├── scene_inventory.txt   ← Babylon 場景物件清單
    └── all_meshes.txt        ← 所有 mesh / material 名稱（mod 物理排除規則的依據）
```

## 技術

| 層 | 採用 |
|----|------|
| 3D 繪圖 | **Babylon.js**（WebGL） |
| 物理 | **OIMO.js**（非 Babylon 內建 Cannon） |
| 場景建模 | Blender 2.76 → `.babylon` 匯出 |
| 倉鼠外觀 | 自訂 GLSL fragment shader（`custom.fragment.fx`） |
| 指標事件 | PEP polyfill |
| 離線 | Service Worker + manifest（dev 已停用） |
| 字型 | Muli（Google Fonts）+ 自製 ham-font 圖示字型 |
| Mod UI | 純 vanilla JS + CSS-in-JS（玻璃擬態 + 戰術 HUD），無外部 framework |

## 程式架構（原作 218 個頂層函式∕類別）

### 容器
- **Cage**：2×2、2×3、2×4、3×2、3×3、3×4、4×2、4×3、4×4（共 9 種尺寸）
- **House**：House1 / House2 / House3 / House4（4 款外屋）
- **Starter Homes**：starter1–4（4 款預設起始套裝）

### 管道系統
- `TubeStraight` 直管、`TubeCurved` / `TubeCurved2` 彎管、`TubeCross` 十字、`TubeTee` T 接頭
- `TubeCap` 端蓋、`TubeCover` 外殼
- `Connector`：`ConnectorCage`（接籠）、`ConnectorFloor`（接地板）、`ConnectorTube`（接管）、`ConnectorHidden`（隱藏銜接）

### 配件
| 類別 | 實體 |
|------|------|
| 運動滾輪 | `Wheel1a/b/c`、`Wheel2a/b/c`（6 款） |
| 食盆 | `Bowl1`、`Bowl2` |
| 水瓶 | `WaterBottle1`、`WaterBottle2` |
| 啃咬玩具 | `SimpleChew`、`SimpleChew2`、`StickChew`、`HangingChew`、`boxChew` |
| 家具 | `Platform1/2`、`Ramp1/2`、`Bridge`、`Swing`、`Bed` |
| 食物 | `Food`、`FoodMound`、`FoodTracker`（+ 視覺上：pumpkinSeed、corn、sunflowerSeed、disc、donut） |
| 墊料 | `Bedding2x4`、`Bedding3x4`、`Bedding4x4`、`BeddingParticle`、`BeddingSides` |

### 倉鼠本體
- 結構：`Body`、`Belly`、`Ears`、`Whiskers`、`PhysicsBody`
- 毛色著色器 **12 項花紋可開關**（詳見下）
- 動作：`HouseNavigator`、`TubeNavigator`、`WheelNavigator`、`RampNavigator`、`BowlNavigator`、`SwingNavigator`、`BridgeNavigator`

### 倉鼠外觀客製（自 `custom.fragment.fx` 萃取）
```glsl
// 顏色（vec3）
bodyColor, eyesColor, pawsColor, earsColor

// 花紋開關（0/1）
hasBelly, hasFU, hasRU, hasChin,
hasCheeks1, hasCheeks2, hasBlaze,
hasMiddleBand, hasSpots, hasCheekFlash, hasSnout

// 幾何 / 參數
cheekX, cheekY, cheekBlur, radius,
rand, noiseMult,
shaderTweak1..4
```
→ 理論組合數 ≈ 2¹¹ × 連續顏色空間 ≈ **接近無限的倉鼠造型**。

### OIMO Body 命名慣例（修物理飄移時用）
原作 OIMO body 採 `{Object}_{part}` 格式：
- `Wheel1a_wheel`、`Wheel1a_stand`、`Wheel1a_base`、`Wheel1a_wheelBumper1`
- `House1`、`house2_inside`、`house2_roof`、`House1_houseBumper1`
- `boxChew0`、`boxChew1`
- `*_holder`、`*_inside`、`*_button`、`*_saucer`、`*Bumper`

> Gun Mod 的 `STRUCTURE_RE` 結構物排除清單就是依此命名規則設計（見下）。

### 系統類
- `CleanController`（清潔控制）、`FoodManager`、`FoodBiteManager`、`BeddingSideHoleManager`
- 事件系統：各配件都有 `*Events` 和 `*Navigator` 對應

---

## Hammas 客製化（v1.0）

### 1. UI/UX 重塑（`docs/index.html` + `docs/js/gun.js`）

採用 **Glassmorphism + Tactical HUD** 設計語言（依 `ui-ux-pro-max` skill 推薦），所有覆蓋層皆 `backdrop-filter: blur(14px) saturate(140%)` + 1px 細邊 + 柔陰影 + 12px 圓角統一。

| 區塊 | 改動 |
|------|------|
| **Tab icon** | 重畫 `favicon.svg`：橘底圓角方塊 + 金色倉鼠（雙耳粉內耳、白嘴、粉腮、大黑眼、棕鼻、笑嘴）+ 雙金爪握中央黑色手槍 + 黃白星型 muzzle flash。所有現代瀏覽器支援 SVG favicon |
| **Splash 載入畫面** | 雙層徑向漸層加深景深、標題加粗 -0.02em letter-spacing、版本號改 uppercase tracking、icon drop-shadow |
| **Start 選單**（選 starter home） | 深色玻璃背板（雙色徑向漸層）、卡片改 16px 圓角＋hover 上浮 4px、選中以 inset 綠色光環取代會推位移的 10px 邊框、cage-name 改 pill 樣式、`.progress-bar` 直接隱藏 |
| **In-game header** | 左上 back-btn、右上工具列改玻璃底（`rgba(12,16,24,.55)` + blur），hover 變深、active scale(0.95)；連帶 `.drop-down-options` 也換成同色系玻璃選單 |
| **左上 3-dot 編輯選單** | `#more-edit-options-btn` + `#more-edit-options-menu` 整個 `display:none`（原本提供 Background Pattern / Color，目前不需要） |
| **右上 Delete** | 拆掉 3-dot wrapper（`#more-options-btn`），強制 `#more-options-menu { display: block }` 永遠顯示在原本 3-dot 位置；`#delete-cage-btn` 加 hover 紅色高亮 + active 更深紅 |

### 2. Gun Mod v2（`docs/js/gun.js`，約 1300 行）

附加於 `ham.min.js` 之上，**不修改原檔**。物理／射線／粒子邏輯保持不變，UI 全部重寫。

#### 操作

| 按鍵 | 動作 |
|------|------|
| **G** | 切換 STANDBY / ARMED |
| **Shift+G** | DEBUG console log 開關 |
| **滑鼠移動** | 準心跟隨游標 |
| **左鍵單擊** | 單發 |
| **左鍵按住** | 連射（約 11 發/秒，90ms 節流） |
| **Space** | 連射（鍵盤替代） |
| 右下徽章 | 點擊同 G |

#### UI 元件（v2 重設計）

| 元件 | 設計 |
|------|------|
| Status pill | 右下浮動玻璃膠囊：LED 燈（armed 時紅色脈動）+ STANDBY/ARMED 標籤 + 獨立 `G` 鍵帽 chip。位置 `bottom: 110px; right: 14px`（zoom 按鈕上方，避開所有 dropdown） |
| 準心 | SVG 戰術瞄具：白色圓環 + 4 個外圍紅色刻度 + 中心紅點，armed 時 2.4s 呼吸發光，每次開火觸發 `.fire` class 做 0.14s scale(1.22) 後座力動畫 |
| 螢幕邊框 | Armed 時 4 角戰術括號（`.corner.tl/tr/bl/br`，紅色 drop-shadow）+ inset 紅色 vignette |
| HUD 計分板 | 左下玻璃卡：分欄 `SHOTS` / `BONKED`，等寬 tabular-nums，每次命中數字 0.35s spring bump 放大到 1.22x 並閃紅 |
| 命中泡泡 | 加粗 system sans-serif，紅色（OUCH/EEK/SQUEAK）/ 黃色（BONK/OOF）兩款漸層，旋轉變化 |
| 命中環 | `Vector3.Project` 把 3D 命中點投影到 2D 螢幕，0.38s 從 8px 擴張到 64px 黃環，加擊打感 |
| 槍口閃光 | 全螢幕 radial gradient + `mix-blend-mode: screen` 自然疊加，0.12s |
| 噴血反饋 | 純 2D 邊緣 vignette（`.gun-blood-vignette`，FPS-style 受擊閃光），不碰 3D 場景 |
| 首次提示 | 第一次 arm 顯示鍵位 toast（`localStorage.hammas_gun_help_shown_v2`，永久只出現一次） |
| 無障礙 | `aria-pressed` / `aria-hidden` / `aria-live="polite"`、Tab 焦點環、Enter/Space 觸發、`@media (prefers-reduced-motion: reduce)` 全套停用動畫 |

#### 物理（OIMO 衝量）

- **直擊**：`scene.pick` 取 mesh → `findOwnerFromMesh` 沿 parent chain 找有 `applyImpulse` 的 owner（檢查 `owner.body / dynamicBody / bumper2 / draggerBody`）→ `KICK_DV=4.0` + `KICK_LIFT=0.4`
- **濺射**：以命中點為圓心 `KICK_RADIUS=1.8` 內所有動態 body，按距離 falloff × `SPLASH_MUL=0.35`
- **倉鼠特例**：直擊倉鼠時，用 `^hamster\d+(_|$)` 同步踢 4 節身體，`HAMSTER_DV=24` + `HAMSTER_LIFT=8`，蓋過 AI 位置覆寫才看得出被撞
- **質量上限** `MAX_EFF_MASS=10`，避免重物吃不到衝量
- **SPS 粒子**（食物、墊料）：用 `pickInfo.faceId` → `sps.pickedParticles[faceId].idx` 找精確粒子，retreat 用最近距離搜尋

#### 結構物保護（修飄移用）

`STRUCTURE_RE` 排除清單，**前綴 + 後綴雙重檢查**：

```js
/(^(cage|wall|floor|ceiling|background|wheel|w\d+[a-c]|house|tube|
   connector|cover|ramp|bridge|platform|suction|box|swing))
 |(_stand|_base|_holder|_inside|_button|_roof|_ears|_saucer|bumper)/i
```

| 行為 | 結果 |
|------|------|
| 直擊或濺射在以上 mesh / body | 跳過，**不施加衝量** |
| 仍可被打飛 | 碗、墊料粒子、食物（disc/donut/seed/corn）、倉鼠、`simpleChew`/`stickChew`/`hangingChew`、`swing` 主體 |

> 滾輪所有部位（`Wheel1a_wheel`、`_stand`、`_base`、`*Bumper`）、房子（含 `house*_inside/_roof/_houseBumper`）、`boxChew`、籠子、管道、坡道、橋、suction cup、水瓶座 → 全部釘住不動。

#### 房子釘位（碰撞飄移修正）

房子是 dynamic OIMO body，倉鼠撞到會慢慢推走它。`scene.onBeforeRenderObservable` 每幀執行：

1. 掃 `world.rigidBodies` 鏈，找 `^house` 的 dynamic body，記錄初始 `{x, y, z}`
2. 把 `linearVelocity` / `angularVelocity` 歸零，position 強制推回原位
3. 呼叫 `body.syncShapes()`
4. 偵測 `#main.build-mode` class 時跳過，保留建造模式拖拉小屋的能力
5. 已從 world 移除（刪除/換 starter）的 body 從 map 自動清掉

倉鼠撞小屋仍會自己彈開，但小屋永遠不動。

#### 視覺反饋（無物理時）

非黑名單的靜態 mesh 命中時觸發 `jiggleMesh`：往命中方向位移 0.08 單位，160ms 二次曲線回彈。**JIGGLE_BLACKLIST** 包含 hamster、SPS、bedding、wheel、chew、cage、wall、floor、ceiling、`waterLine`、`foodMound` —— 因為這些要嘛已經有真實物理（會雙重反應），要嘛是大結構（不該晃）。

#### 命中倉鼠類 mesh 額外效果

關鍵字配對 `/ham|belly|ears?|whisker|snout|paw|cheek|body|armature|fur/i`：
- 材質 `emissiveColor` 瞬間變紅（180ms）
- 漫畫擬聲詞泡泡（OUCH! / EEK! / !? / @#!\* / *BONK* / OOF / SQUEAK!）
- 螢幕邊緣紅色 vignette（FPS-style 受擊反饋）

#### 槍聲

Web Audio 合成：白噪 buffer × 指數衰減 envelope → biquad 低通 1600Hz Q=1.5 → exponentialRamp 至 0.001。0.12 秒、無外部音檔。

---

## 對原始程式碼的改動

| 檔案 | 改動 | 性質 |
|------|------|------|
| `docs/js/gun.js` | 新增約 1300 行 Gun Mod v2 | 純附加 |
| `docs/js/ham.min.js` | **零改動** | 第三方原檔 |
| `docs/index.html` | 改 title `Hammas` / appVersion `v1.0` / appInfo by Jung217；引入 `gun.js`、`favicon.svg`；splash 漸層；UI/UX polish stylesheet（玻璃擬態 / header / drop-down / 隱藏 progress bar / 隱藏左上 3-dot / 右上 Delete 直露）；`#share-btn` 與 `.share-dialog` 用 MutationObserver 移除；保留 `<div id="aBowman" hidden>`、`<span id="appVersion" hidden>` 隱藏 stub 防 `ham.min.js:4431/4968` null deref；停用 SW 並 unregister 既有 SW | 純附加 / 樣式覆蓋 |
| `docs/manifest.webmanifest` | `name` / `short_name` / `description` 改 `Hammas` | 文字替換 |
| `docs/favicon.svg` | 新建 64×64 viewBox SVG（倉鼠 + 手槍） | 純新增 |

> 第三方檔案（`ham.min.js`、`babylon.js`、`libs.js`、`pep.min.js`、`styles.min.css`、所有 `.json` 資料、`.fx` 著色器、字型、原 PNG icon）全部保持原狀。

## 本機執行

```bash
cd Hammas/docs
python -m http.server 8080
# 瀏覽器開 http://localhost:8080/
```

> 需用 HTTP Server（不能直接 `file://`）—— Service Worker 與相對路徑資源的限制。

## 路徑指引

- 改 Mod UI → `docs/js/gun.js`（CSS 在 `injectUI()` 內，HTML 結構在 overlay/toggle/hud/help element 建構處）
- 改 splash / start 選單 / in-game header → `docs/index.html` 內兩個 `<style>` 區塊
- 改物理排除規則 → `docs/js/gun.js` 的 `STRUCTURE_RE`（搭配 `analysis/all_meshes.txt` 找新增 mesh 名）
- 看原作做了什麼 → `pretty/ham.js`（已格式化，可讀）
