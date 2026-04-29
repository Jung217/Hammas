# Hammas

> 參考來源：[hammyhome.com](https://hammyhome.com/)  版本 v1.4.0（更新於 2026-02-15）
> 
> 作者：[aBowman](https://www.abowman.com)
> 
> 著作權屬原作者

## 目錄結構

```
hama/
├── README.md                 ← 本檔：總覽與架構蒸餾
├── src/                      ← 原始抓取（直接可在瀏覽器開啟 index.html 執行）
│   ├── index.html
│   ├── manifest.webmanifest  ← PWA 設定
│   ├── sw.js                 ← Service Worker（離線快取）
│   ├── robots.txt
│   ├── favicon.ico
│   ├── js/
│   │   ├── ham.min.js        ← 主程式（1.84 MB 壓縮）
│   │   ├── babylon.js        ← Babylon.js 3D 引擎
│   │   ├── libs.js           ← 工具函式庫（172 KB）
│   │   └── pep.min.js        ← 指標事件填充
│   ├── css/styles.min.css
│   ├── data/
│   │   ├── accessories.json  ← Babylon 場景：95 mesh / 51 material
│   │   ├── accessories2.json ← Babylon 場景：22 mesh / 11 material
│   │   └── shaders/ham/
│   │       ├── config.json
│   │       └── custom.fragment.fx  ← 倉鼠毛色著色器
│   ├── images/               ← 啟動圖、starter 縮圖、PWA icons
│   └── fonts/                ← Muli 字型 + 自訂 ham-font 圖示字型
├── pretty/                   ← 反壓縮後可讀版
│   ├── ham.js                ← 49,198 行
│   └── styles.css            ← 1,914 行
└── analysis/
    ├── scene_inventory.txt   ← Babylon 場景物件清單
    └── all_meshes.txt        ← 所有 mesh / material 名稱
```

## 技術

| 層 | 採用 |
|----|------|
| 3D 繪圖 | **Babylon.js**（WebGL） |
| 場景建模 | Blender 2.76 → `.babylon` 匯出 |
| 倉鼠外觀 | 自訂 GLSL fragment shader（`custom.fragment.fx`） |
| 指標事件 | PEP polyfill |
| 離線 | Service Worker + manifest |
| 字型 | Muli（Google Fonts）+ 自製 ham-font 圖示字型 |
| 託管 | Cloudflare CDN → nginx origin |

## 程式架構（來自 218 個頂層函式∕類別）

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
→ 理論組合數 ≈ 2^11 × 連續顏色空間 ≈ **接近無限的倉鼠造型**。

### 系統類
- `CleanController`（清潔控制）、`FoodManager`、`FoodBiteManager`、`BeddingSideHoleManager`
- 事件系統：各配件都有 `*Events` 和 `*Navigator` 對應

### 指令常數（片段）
```
ADD_PART, DELETE_PART,
ALIGN_BACK, ALIGN_BOTTOM
```

## 離線快取策略（`sw.js`）

以 5 個快取群組分開管理（版本 `v461`）：
- `data-v461` — 場景資料 + 著色器
- `fonts-v461` — 字型
- `images-v461` — 圖片
- `jslibs-v461` — 第三方函式庫
- `ham-v461` — 主程式 + 樣式 + HTML

`fetch` 事件：**cache-first**，快取沒命中才上網。

## 本機執行

```bash
cd hama/src
python -m http.server 8080
# 瀏覽器開 http://localhost:8080/
```
> 需用 HTTP Server（不能直接 file://）因為有 Service Worker 與相對路徑資源。

## Gun Mod（自製模組）

於 `docs/js/gun.js` 注入，無修改原始 `ham.min.js`。

### 操作
| 按鍵 | 動作 |
|------|------|
| **G** | 切換機槍 開/關 |
| **左鍵單擊** | 單發 |
| **左鍵按住** | 連射（約 11 發/秒） |
| **Space** | 連射（鍵盤替代） |
| 點右上徽章 | 同 G |

### 功能
- 紅色十字準心 + HUD 計數器（命中 / BONKED）
- 攝影機正前方 **hitscan 射線**（Babylon `scene.pickWithRay`）
- 彈道線（`MeshBuilder.CreateTube`，45ms 自毀）
- 命中火花（`ParticleSystem` + 動態圓點貼圖）
- 槍口閃光（CSS radial gradient 動畫）
- **Web Audio 合成槍聲**（白噪爆破 + 低通）
- 命中倉鼠類 mesh（關鍵字配對 `ham|belly|ears?|whisker|snout|paw|cheek|body|armature|fur`）：
  - 材質 `emissiveColor` 瞬間變紅
  - 若有 `physicsImpostor` 會被擊退
  - 彈出漫畫擬聲詞泡泡（OUCH!、EEK!、SQUEAK!...）

### 對原碼的改動
1. `src/js/gun.js` — 新增（383 行，純附加）
2. `src/index.html` — 新增 `<script src="js/gun.js">`
