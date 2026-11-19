# 高保真前端复刻提示词（目标站点：`https://www.dengta12.com/`）

> 本提示词全部数值均来自真实浏览器实测（`CSS-rule`、`computed-style`、`WAAPI`、`frame-analysis`），不含主观描述。配合同目录下 `design-tokens.json`、`animations.json`、`layout-spec.md` 可直接交给编程 Agent 执行复刻。

---

## 任务目标

构建一个与目标网站视觉结构、色板、排版、描边硬阴影材质、SVG 动效、交互状态及 7 档响应式断点数值一致的单页落地页（中文界面）。不使用第三方动画库（GSAP / Framer Motion / AOS / Anime.js / Lottie 均为 `none`），全部动画仅使用原生 CSS `@keyframes`、CSS `transition`、`IntersectionObserver`、Pointer Events 与 `requestAnimationFrame`。

---

## 1. 全局设计令牌（`:root` CSS 变量，禁止修改数值）

```css
:root {
  --paper: #fff6e9;
  --paper-dim: #fbe8cd;
  --card: #fffdf8;
  --ink: #1b2432;
  --ink-soft: #556072;
  --sun: #ffc94d;
  --sun-soft: #ffe9c0;
  --coral: #ff6b6b;
  --coral-soft: #ffd9d4;
  --sky: #4d96ff;
  --sky-soft: #d3e5ff;
  --mint: #54c07a;
  --mint-soft: #d4f0dd;
  --grape: #9b5de5;
  --grape-soft: #e9dcfb;
  --leaf: #7cb342;
  --leaf-soft: #e3f0d2;
  --line: 2.5px solid var(--ink);
  --radius: 20px;
  --radius-lg: 28px;
  --shadow-pop: 5px 5px 0 var(--ink);
  --shadow-pop-lg: 8px 8px 0 var(--ink);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --font-round: "Yuanti SC", "YouYuan", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  --shell: 1120px;
  --nav-h: 68px;
}
```

### 全局画布与基础排版规则
- `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`
- `html { scroll-behavior: smooth; }`
- `body`:
  - `min-height: 100vh; overflow-x: hidden;`
  - `font-family: var(--font-round); font-weight: 500; font-size: 16px; line-height: 1.7; color: var(--ink);`
  - `background-color: var(--paper);`
  - `background-image: radial-gradient(var(--paper-dim) 1.6px, transparent 2px);`
  - `background-size: 26px 26px;`
  - `-webkit-font-smoothing: antialiased;`
- `::selection { color: var(--ink); background: var(--sun); }`
- `h1, h2, h3 { font-weight: 800; line-height: 1.25; letter-spacing: -0.01em; }`
- 高亮底纹 `.marker`：`padding: 0 0.08em; border-radius: 0.1em; background: linear-gradient(transparent 58%, var(--sun) 58%, var(--sun) 94%, transparent 94%);`
- 主内容容器宽度公式：`width: min(var(--shell), 100% - 40px); margin: 0 auto;`（桌面最大 `1120px`，左右固定 `20px` 安全边距）。

---

## 2. 按 Section 实现精确布局与材质

### Section 0：顶部悬浮胶囊导航（`header.site-nav`）
- `position: fixed; top: 14px; left: 0; right: 0; z-index: 50; display: flex; justify-content: center; padding: 0 20px;`
- 内层 `.site-nav__bar`：`display: flex; align-items: center; justify-content: space-between; gap: 24px; width: min(var(--shell), 100%); padding: 10px 12px 10px 18px; background: var(--card); border: var(--line); border-radius: 999px; box-shadow: 4px 4px 0 var(--ink); transition: box-shadow 300ms var(--ease-out), transform 300ms var(--ease-out);`
- 滚动态：监听 `window.scrollY > 24` 时在 `<header>` 添加 `.is-scrolled`，使 `.site-nav__bar` 变为 `box-shadow: 6px 6px 0 var(--ink); transform: translateY(-2px);`。
- 左侧品牌 `.site-nav__brand`：`gap: 10px`，Logo `34×34px`（`border: 2px solid var(--ink); border-radius: 9px;`）+ 品牌名 `17px / fw 800 / ls 0.01em`。
- 中间导航 `.site-nav__links`：`display: flex; gap: 22px; font-size: 14.5px; font-weight: 700; white-space: nowrap;`（6 个链接）。悬停下划线使用 `a::after`：`position: absolute; left: 0; right: 0; bottom: -4px; height: 3px; background: var(--sun); border-radius: 2px; transform: scaleX(0); transform-origin: left; transition: transform 250ms var(--spring);`，`:hover::after` 切换为 `transform: scaleX(1)`。
- 右侧操作区 `.site-nav__actions`（`gap: 12px`）：
  - 主按钮 `.site-nav__cta-btn`：`padding: 13px 26px; font-size: 16px; font-weight: 800; background: var(--sun); border: var(--line); border-radius: 999px; box-shadow: var(--shadow-pop); transition: transform 200ms var(--spring), box-shadow 200ms var(--spring);`。无 `:hover` 位移；`:active` 为 `transform: translate(3px, 3px); box-shadow: 2px 2px 0 var(--ink);`。
  - 移动端菜单按钮 `.site-nav__more-btn`：默认隐藏，`<=640px` 显示，`38×38px`，`border: var(--line); border-radius: 12px; background: var(--card);`，内部 `18×18px` 三横线 SVG。点击展开 `.site-nav__menu`：`position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; min-width: 148px; background: var(--card); border: var(--line); border-radius: 16px; box-shadow: var(--shadow-pop);`，菜单项 `padding: 11px 16px; font-size: 14px; font-weight: 700;`，相邻项 `border-top: 2px solid var(--ink);`，`:hover` 背景 `var(--sun-soft)`。

### Section 1：首屏 Hero（`section#top.hero`）
- `padding: calc(var(--nav-h) + 66px) 0 40px;`（即顶部 `134px`、底部 `40px`）。
- `.hero__inner`：`display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 32px; align-items: center; width: min(var(--shell), 100% - 40px); margin: 0 auto;`
- 左栏 `.hero__copy`：`display: grid; gap: 22px; justify-items: start;`
  - `h1.hero__title`：`font-size: clamp(44px, 7.2vw, 84px); line-height: 1.14; font-weight: 800; letter-spacing: -0.01em;`（第二行包裹 `<span class="marker">`）。
  - `p.hero__subtitle`：`max-width: 460px; font-size: 17px; color: var(--ink-soft);`
  - `.hero__actions`：`display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px;`
  - 胶囊按钮 `.pop-btn`：`padding: 13px 26px; font-size: 16px; font-weight: 800; border: var(--line); border-radius: 999px; box-shadow: 4px 4px 0 var(--ink); transition: transform 180ms var(--spring), box-shadow 180ms var(--spring);`。实心 `.pop-btn--solid` 背景 `var(--sun)`；纸白 `.pop-btn--paper` 背景 `var(--card)`。`:hover` 为 `transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--ink);`；`:active` 为 `transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--ink);`。
- 右栏 `.hero__art`：`position: relative; transition: transform 250ms var(--ease-out); will-change: transform;`
  - **鼠标视差**：在非触控设备上监听鼠标坐标 `(x, y)`，应用 `transform: translate(${((x / innerWidth - 0.5) * 14).toFixed(1)}px, ${((y / innerHeight - 0.5) * 10).toFixed(1)}px)`（水平范围 `[-7px, +7px]`，垂直范围 `[-5px, +5px]`）。
  - **主灯塔 SVG**：`viewBox="0 0 400 380"`，`width: 100%; height: auto;`。内部包含：
    - 背景双圆：`(200,180) r=158 fill=var(--sun-soft)` 与 `r=118 fill=var(--paper) opacity=0.6`
    - 旋转光束 `g.beam`：`transform-origin: 200px 106px`，`animation: beam-sweep 5000ms ease-in-out infinite`（`-14deg` ↔ `+14deg`）
    - 3 颗四角星 `path.star`（颜色 `--sun` / `--sky` / `--coral`，描边 `2.5px --ink`）：`animation: twinkle 2600ms ease-in-out infinite`，延迟分别为 `0ms`、`900ms`、`1700ms`（`opacity: 0.25 -> 1; scale(0.75) rotate(0) -> scale(1.1) rotate(12deg)`）
    - 2 朵云 `g.cloud`：`animation: drift 7000ms ease-in-out 400ms infinite` 与 `.cloud--slow` `9500ms ease-in-out 0ms infinite`（`translate(0) -> translate(16px)`）
    - 灯塔主体 `g.tower`：`animation: float-y 6000ms ease-in-out infinite`（`translateY(0) -> translateY(-10px)`）；内部 2 层 `circle.lamp`（`r=11 #fff` 与 `r=20 --sun opacity=0.35`）执行 `glow-pulse 2400ms ease-in-out infinite`（`opacity: 0.45 -> 1`）
    - 礁石底座（`fill: #9aa7bd; stroke: var(--ink); stroke-width: 4`）与 2 条波浪 `path.wave`（`stroke-dasharray: 26 14`），`dash-shift` `3200ms linear infinite` 与 `.wave--late` `4600ms linear infinite`（`stroke-dashoffset: 0 -> -40`）
  - **3 张悬浮指标贴纸 `.hero__sticker`**：`position: absolute; padding: 10px 16px; line-height: 1.3; text-align: center; background: var(--card); border: var(--line); border-radius: 16px; box-shadow: 4px 4px 0 var(--ink); animation: float-y 4200ms ease-in-out infinite;`。数值 `strong` `20px / fw 800`，说明 `span` `12px / --ink-soft`。
    - `--a`：`top: 12%; right: 4%; animation-delay: 0ms;`
    - `--b`：`bottom: 16%; left: 0; animation-delay: 1100ms;`
    - `--c`：`right: 3%; bottom: 5%; animation-delay: 2200ms;`

### Section 2：倾斜无限跑马灯（`.marquee-wrap`）
- `.marquee-wrap`：`padding: 12px 0; margin-top: 44px; overflow: hidden;`
- `.marquee`：`width: calc(100% + 24px); margin-left: -12px; overflow: hidden; background: var(--sun); border-top: var(--line); border-bottom: var(--line); transform: rotate(-1.2deg);`
- `.marquee__track`：`display: flex; gap: 44px; align-items: center; width: max-content; padding: 13px 22px; animation: marquee 22000ms linear infinite;`（`@keyframes marquee { 0% { transform: translate(0); } to { transform: translate(-50%); } }`）。将词条数组完整复制 2 份实现无缝循环；单条 `.marquee__item` 为 `display: inline-flex; gap: 12px; align-items: center; font-size: 15px; font-weight: 800; white-space: nowrap;`，前导五角星 SVG `15×15px`。

### Section 3：最新动态横向滚动区（`section#news.news-home`）
- `width: min(var(--shell), 100% - 40px); padding: 120px 0 0; margin: 0 auto;`
- 头部 `.news-home__head`：`display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px 32px; margin-bottom: 30px;`。标题 `clamp(28px, 4.4vw, 44px)`，副标题 `16px / --ink-soft`；右侧操作按钮 `.nh-btn` 高 `44px`，`padding: 0 20px; font-size: 15px; font-weight: 800; border: var(--line); border-radius: 999px; box-shadow: 3px 3px 0 var(--ink); transition: transform 180ms var(--spring), box-shadow 180ms var(--spring);`（`.is-dark` 为背景 `var(--ink)` 文字 `var(--card)`；`:hover` 为 `translate(-2px, -2px)` + `box-shadow: 5px 5px 0 var(--ink)`）。
- 轨道 `.news-home__track`：`--gap: 20px; display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - 3 * var(--gap)) / 4); gap: var(--gap); padding: 6px 12px 14px 6px; margin: -6px -12px -14px -6px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none;`
- 公告卡片 `.ann-card`：`display: flex; flex-direction: column; background: var(--card); border: 2px solid var(--ink); border-radius: 16px; box-shadow: 3px 3px 0 var(--ink); overflow: hidden; transition: transform 250ms var(--spring), box-shadow 250ms var(--spring);`
  - 封面 `.cover`：`aspect-ratio: 2 / 1; border-bottom: 2px solid var(--ink);`，内部 `img` 设 `transition: transform 600ms var(--ease-out);`，卡片 `:hover` 时 `img` `transform: scale(1.04)`。
  - 内容区 `.ann-card__body`：`padding: 12px 14px 14px; gap: 6px;`；元信息 `12px fw 700` + `7×7px` 彩色圆点；标题 `15.5px fw 800 lh 1.45`（2 行截断，`transition: color 150ms`，`:hover` 变 `var(--sky)`）；摘要 `13px lh 1.6 --ink-soft`（2 行截断）；右下角「阅读详情 →」箭头 `span` 在 `:hover` 时 `transform: translate(4px)`（`200ms var(--spring)`）。
  - 卡片 `:hover`：`transform: translate(-2px, -2px); box-shadow: 5px 5px 0 var(--ink);`；`:focus-visible` 加 `outline: 3px solid var(--sky); outline-offset: 3px;`。
  - 点击卡片弹窗 `.ann-overlay`：`background: #1b243257; backdrop-filter: blur(3px); z-index: 80; animation: ann-fade 250ms var(--ease-out);`；对话框 `.ann-dialog`：`width: min(680px, 100%); border: var(--line); border-radius: var(--radius-lg); box-shadow: 10px 10px 0 var(--ink); animation: ann-pop 360ms var(--spring);`（从 `opacity: 0; transform: translateY(22px) scale(0.94)` 进入）；关闭按钮 `32×32px` `:hover` `transform: rotate(90deg)`（`180ms var(--spring)`）。

### Section 4：双栏架构优势 + 交互式 3D 地球（`div.home-duo`）
- `display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 36px; align-items: stretch; width: min(var(--shell), 100% - 40px); margin: 120px auto 0;`
- 左栏特性网格 `.points`：`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;`
  - 卡片 `.point`（继承 `.pop-card.is-hoverable`）：`padding: 16px 18px; gap: 10px; background: var(--card); border: 2px solid var(--ink); border-radius: 16px; box-shadow: 3px 3px 0 var(--ink); transition: transform 400ms var(--spring), box-shadow 400ms var(--spring);`。`:hover`：`z-index: 2; transform: rotate(0) translate(-2px, -2px); box-shadow: 5px 5px 0 var(--ink);`。
  - 图标盒 `.point__art`：`42×42px; padding: 7px; border: 2px solid var(--ink); border-radius: 12px;`（4 张卡依次使用 `--sky-soft`、`--mint-soft`、`--sun-soft`、`--grape-soft`），内部 `viewBox="0 0 140 140"` 动态 SVG：
    1. 火箭：`.ship` `bob 3400ms ease-in-out infinite` (`-4deg,0` ↔ `4deg,-7px`)；`.flame` `flame 500ms ease-in-out infinite` (`scaleY 1 -> 0.68`)；3 条 `.speed` `speed-line 1100ms ease-out infinite`（延迟 `0/350/700ms`）
    2. 护盾：`.ring` `pulse-ring 2200ms ease-out infinite` (`scale 0.62 -> 1.5, opacity 0.7 -> 0`)；`.keyhole` `glow-pulse 2200ms ease-in-out infinite`
    3. 仪表盘：`.needle` `needle 2600ms var(--spring) infinite` (`rotate(-42deg)` ↔ `rotate(46deg)`)
    4. 心跳与船锚：`.pulse-line` `stroke-dasharray: 160; dash-draw 2800ms var(--ease-out) infinite`；`.anchor` `bob 4000ms ease-in-out infinite`；2 颗 `.bubble` `float-y 3000ms ease-in-out infinite`（延迟 `0/600ms`）
- 右栏全球线路 `#nodes`：
  - `>960px`：`#nodes` 为纵向 flex，`.pop-section__body` `position: relative; flex: 1;`，`.globe` 绝对定位 `top: 50%; left: 50%; translate: -50% -50%; height: calc(100% * 600 / 456); aspect-ratio: 1;`。
  - 背景光晕 `.globe__glow`：`position: absolute; inset: 8%; border-radius: 50%; background: radial-gradient(circle, var(--sun-soft) 0%, transparent 65%);`
  - `svg.globe__svg`：`viewBox="0 0 600 600"; cursor: grab; touch-action: none; user-select: none;`（拖拽时 `.is-dragging` 为 `cursor: grabbing`）。
  - **地球正射投影与 `requestAnimationFrame` 参数**：
    - 中心 `(300, 300)`，半径 `228`，球面 `fill: #f7faff; stroke: var(--ink); stroke-width: 3;`；陆地 `fill: #b9d9c8; stroke: #8fbfa8; stroke-width: 1.2;`；初始旋转 `yaw = -116°`, `pitch = -22°`，俯仰限幅 `[-35°, +35°]`。
    - 航线 `.arc`：以香港节点 (`22.32°N, 114.17°E`) 为 Hub，球面大圆 40 段插值抬升弧线，`stroke: var(--sky); stroke-width: 2.2; stroke-dasharray: 5 7; animation: arc-flow 1600ms linear infinite`（`stroke-dashoffset: 0 -> -12`）。
    - 节点圆点 `.dot`：半径 `max(4.5, min(11, 3.2 + sqrt(count) * 1.9))`，普通节点 `fill: var(--coral); stroke: var(--ink); stroke-width: 2.5`，Hub 节点 `r=9; fill: var(--sun); stroke-width: 3`，叠加 `.hub-pulse`（`r=15; stroke: var(--sun); stroke-width: 2.5; animation: hub-ring 2000ms ease-out infinite`，`scale 0.5->1.5, opacity 0.9->0`）。背面节点 (`z <= 0.06`) 隐藏且 `pointer-events: none`。
    - 拖拽与惯性：指针移动 `yaw += dx * 0.35`、`pitch = clamp(pitch - dy * 0.25, -35, 35)`，记录角速度 `v = dx * 0.35`；松手后每帧按 `dt = min(50, now - prev) / 16.7` 更新：当 `|v| > 0.02` 时 `yaw += v; v *= 0.94`；静置超过 `1600ms` 且非 `prefers-reduced-motion: reduce` 时，执行自动自转 `yaw += 0.055 * dt`（折合 `3.29°/s`，即 `0.055° / 16.7ms`）。

### Section 5：套餐价格（`section#plans.pop-section.is-center`）
- `width: min(var(--shell), 100% - 40px); padding-top: 120px; margin: 0 auto;`
- 顶部双模式切换 `.kind-tabs`：`display: inline-flex; padding: 4px; background: var(--card); border: var(--line); border-radius: 999px; box-shadow: 3px 3px 0 var(--ink); margin-bottom: 24px;`；选项 `.kind-tab` `padding: 8px 20px; font-size: 15px; font-weight: 800; color: var(--ink-soft); border-radius: 999px; transition: background 200ms, color 200ms;`，激活态 `.kind-tab--on` 为 `color: var(--ink); background: var(--sun); box-shadow: inset 0 0 0 2px var(--ink);`。
- 订阅卡片网格 `.plans`：`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px;`（当切换为「按量付费」仅 1 张卡时加 `.is-few`：`grid-template-columns: repeat(auto-fit, minmax(240px, 360px)); justify-content: center;`）。
- 单卡 `.plan`：`display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--card); border: var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-pop); transition: transform 350ms var(--spring), box-shadow 300ms var(--spring), opacity 350ms var(--ease-out);`
  - `:hover`：`box-shadow: var(--shadow-pop-lg); transform: translate(-3px, -3px) rotate(-0.6deg);`
  - 内部价格区 `.plan__prices`：2 列网格 `gap: 12px 8px; padding-top: 12px; border-top: 2px dashed var(--paper-dim);`；最优价 `.price.is-best`：`background: var(--mint-soft); border: 2px solid var(--ink); border-radius: 10px;`，右上角折扣徽标 `.price__tag.is-off`：`top: -9px; right: -3px; padding: 1px 6px; font-size: 10px; font-weight: 700; color: var(--card); background: var(--coral); border-radius: 999px; transform: rotate(4deg);`。
  - 权益列表 `.plan-desc ul > li`：`padding-left: 15px; font-size: 12.5px; line-height: 1.65;`，`::before { content: "✦"; color: var(--sun); position: absolute; left: 0; }`。
  - 底部按钮 `.plan__cta`：`margin-top: auto; padding: 9px 14px; font-size: 14px; font-weight: 700; background: var(--sun); border: var(--line); border-radius: 14px; box-shadow: 3.5px 3.5px 0 var(--ink); transition: transform 200ms var(--spring), box-shadow 200ms var(--spring);`，`:hover` `translate(-1.5px, -1.5px)` + `5px 5px 0`，`:active` `translate(2.5px, 2.5px)` + `1px 1px 0`。

### Section 6：全平台客户端下载（`section#download.pop-section.is-center`）
- 内容容器 `.dl`：`max-width: 640px; margin: 0 auto; display: grid; gap: 18px;`
- 7 平台标签条 `.dl-tabs`：`display: flex; padding: 5px; background: var(--card); border: var(--line); border-radius: 999px; box-shadow: 3px 3px 0 var(--ink);`；按钮 `.dl-tab` `flex: 1 1 auto; gap: 6px; padding: 10px 4px; font-size: 15px; font-weight: 800;`，激活态 `.dl-tab--on` 同 `.kind-tab--on`。
- 面板 `.dl-panel`（`.pop-card`）：`padding: 22px; gap: 6px; text-align: center; justify-items: center;`；图标块 `.dl-chip` `50×50px; border: 2px solid var(--ink); border-radius: 14px; box-shadow: 2px 2px 0 var(--ink);`；双列下载选项 `.dl-options` `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px;`；选项卡片 `.dl-option` `padding: 14px 16px; background: var(--paper); border: var(--line); border-radius: 16px; box-shadow: 3px 3px 0 var(--ink);`，`:hover` 切换背景为 `var(--sun-soft)` 并 `translate(-2px, -2px)` + `5px 5px 0`（`200ms var(--spring)`）；Linux/软路由终端命令框 `.dl-cmd__code` 背景 `#1f2937`、文字 `#e5e7eb`、`font-size: 12.5px`、`border-radius: 12px`。

### Section 7：页脚与悬浮客服
- `footer.site-footer`：`margin-top: 96px; background: var(--ink); color: var(--paper); border-top: var(--line);`；内容器 `padding: 56px 0 28px;`，上方 4 列网格 `.site-footer__top` `grid-template-columns: 2fr 1fr 1fr 1.6fr; gap: 32px;`，栏标题 `13px fw 700 ls 0.06em opacity 0.55`，链接 `14px opacity 0.85` 悬停变 `var(--sun) opacity 1`；底部版权条 `.site-footer__bottom` `margin-top: 40px; padding-top: 22px; border-top: 1px solid rgb(255 255 255 / 12%); font-size: 12.5px; opacity: 0.6;`。
- `button.support-bubble`：`position: fixed; right: 22px; bottom: 22px; z-index: 60; padding: 12px 20px 12px 16px; gap: 8px; font-size: 15px; font-weight: 800; background: var(--sun); border: var(--line); border-radius: 999px; box-shadow: var(--shadow-pop); animation: support-bubble-in 280ms ease-out both; transition: transform 180ms var(--spring), box-shadow 180ms var(--spring), opacity 180ms var(--ease-out);`。`:hover` `translate(-2px, -2px)` + `var(--shadow-pop-lg)`；`:active` `translate(3px, 3px)` + `2px 2px 0 var(--ink)`。

---

## 3. 滚动显现与无障碍动效规范

- **滚动显现 `.reveal`**：
  - 初始态：`opacity: 0; transform: translateY(26px) scale(0.985); transition: opacity 650ms var(--ease-out), transform 650ms var(--ease-out); transition-delay: var(--reveal-delay, 0ms);`
  - 触发器：`new IntersectionObserver(cb, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })`，首次 `isIntersecting === true` 时添加 `.is-revealed`（`opacity: 1; transform: none;`）并立即 `unobserve`。
- **减弱动效 `@media (prefers-reduced-motion: reduce)`**：
  - `html { scroll-behavior: auto; }`
  - `*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }`
  - `.reveal { opacity: 1; transform: none; }`
  - 禁用地球自动旋转。

---

## 4. 7 档响应式断点规则（按从宽到窄顺序实现）

1. **`<= 960px`**：`.home-duo` 切换 `grid-template-columns: 1fr; gap: 88px;`，`#nodes .globe` 解除绝对定位，改为常规文档流 `width: min(620px, 100%); margin: 0 auto;`。
2. **`<= 900px`**：`.hero__inner` 切换 `grid-template-columns: 1fr;`，`.hero__art` 设 `max-width: 440px; margin: 0 auto;`；`.site-nav__links` 设为 `gap: 14px; font-size: 14px;` 并隐藏「产品价格」链接；`.news-home__track` 改为 `grid-auto-columns: calc((100% - var(--gap)) / 2)`（2 列视窗）。
3. **`<= 860px`**：`.site-footer__top` 切换 `grid-template-columns: 1fr 1fr;`，品牌列与联系列设 `grid-column: 1 / -1`。
4. **`<= 720px`**：`.plans:not(.is-carousel)` 切换 `grid-template-columns: 1fr;`。
5. **`<= 640px`**：隐藏 `.site-nav__links`，显示 `.site-nav__more` 汉堡菜单；`.site-nav__bar` 改为 `gap: 10px; padding: 10px 10px 10px 14px;`，品牌字号 `15px`，CTA 按钮 `padding: 9px 16px; font-size: 14px; box-shadow: 3px 3px 0 var(--ink);`；`.news-home` 与 `.pop-section` 顶距从 `120px` 降至 `88px`，`.pop-section__head` 底距从 `44px` 降至 `32px`；`.news-home__track` 设 `--gap: 16px; grid-auto-columns: 84%;`。
6. **`<= 560px`**：`.points` 与 `.dl-options` 切换为 `1fr` 单列；`.dl-tab` 改为 `flex-direction: column; gap: 3px; padding: 7px 2px; font-size: 11.5px; border-radius: 16px;`，`.dl-tabs` `border-radius: 22px;`；`.support-bubble` 隐藏文字 `.support-bubble__label`，改为 `right: 16px; bottom: 16px; padding: 13px;`（`53×53px` 圆形图标）。
7. **`<= 340px`**：隐藏 `.site-nav__name`。

---

## 5. 验收检查清单（须在 5 个视口验证）

- 在 `390×844`、`768×1024`、`1024×768`、`1440×900`、`1920×1080` 下无横向溢出（`document.documentElement.scrollWidth <= window.innerWidth`）。
- 在 `1440×900` 下验证：`h1.hero__title` 计算字号为 `84px`；`.plans` 呈 4 列等宽 `266.5px`；`.marquee__track` 以 `-42.27px/s ± 2px/s` 恒速向左无缝滚动。
- 验证悬停偏移：`.pop-btn` 与 `.ann-card` 悬停时 `dx = -2px, dy = -2px`；`.plan` 悬停时 `translate(-3px, -3px) rotate(-0.6deg)`；`.site-nav__cta-btn` 悬停无偏移、按压 `translate(3px, 3px)`。
- 验证交互切换：点击「按量付费」切换为居中 `360px` 单卡与 `.rcpt` 虚线表；依次点击 7 个下载平台标签面板内容完整切换；`390px` 视口点击汉堡按钮弹出 `148px` 宽下拉菜单。
