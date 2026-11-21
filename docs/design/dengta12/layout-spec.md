# `https://www.dengta12.com/` 页面布局与组件规格书

> 采集日期：2026-11-19 | 页面标题：`灯塔加速器 · 企业级跨境网络加速`
> 技术栈：Vue 3 SFC（Vite 打包 `/assets/app-fdX_CiBi.css` `49,738 B`、`/assets/app-CPChXnDg.js` `412,179 B`）+ 内置 D3-geo 正射投影地球 + Crisp 在线客服
> 数据来源标记：`CSS-rule`（完整样式表规则）、`computed-style`（真实浏览器 `getBoundingClientRect` / `getComputedStyle`）、`WAAPI`（`document.getAnimations({ subtree: true })`）、`frame-analysis`（带相对时间戳的帧采样与交互前后实测）
> 置信度标记：`measured`（直接实测）、`estimated`（基于实测推算）、`unknown`（未能直接测定）

---

## 1. 全局画布与网格框架

- **页面根容器 (`body`)**：
  - `background-color`: `#fff6e9` (`--paper`) [`CSS-rule`, `measured`, `all`]
  - `background-image`: `radial-gradient(#fbe8cd 1.6px, transparent 2px)` [`CSS-rule`, `measured`, `all`]
  - `background-size`: `26px 26px` [`CSS-rule`, `measured`, `all`]
  - `color`: `#1b2432` (`--ink`) [`CSS-rule`, `measured`, `all`]
  - `font-family`: `"Yuanti SC", "YouYuan", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif` [`CSS-rule`, `measured`, `all`]
  - `font-weight`: `500`，`line-height`: `1.7`，`overflow-x`: `hidden`，`min-height`: `100vh` [`CSS-rule`, `measured`, `all`]
- **内容壳宽**：`width: min(1120px, 100% - 40px)`，居中 `margin: 0 auto`（即左右各 `20px` 安全边距，内容最大宽度 `1120px`）[`CSS-rule`, `measured`, `all`]
- **全局页面总高度（实测，含 macOS `15px` 滚动条 / 无头 Chromium `0px` 滚动条）**：
  - `390×844`: `6787.26px`（实测实时页，`w=375px`） / `6770px`（无头 Chromium，`w=390px`）[`computed-style`, `measured`]
  - `768×1024`: `5643.2px`（实时页，`w=753px`） / `5551px`（无头 Chromium，`w=768px`）[`computed-style`, `measured`]
  - `1024×768`: `4418.9px`（实时页，`w=1009px`） / `4418px`（无头 Chromium，`w=1024px`）[`computed-style`, `measured`]
  - `1440×900`: `3903.3px`（实时页，`w=1425px`） / `3896px`（无头 Chromium，`w=1440px`）[`computed-style`, `measured`]
  - `1920×1080`: `3903.3px`（实时页，`w=1905px`） / `3896px`（无头 Chromium，`w=1920px`）[`computed-style`, `measured`]

---

## 2. 逐 Section 层级结构与尺寸明细（基准视口 `1440×900`）

### Section 0：顶部悬浮胶囊导航栏 `header.site-nav`
- **定位与尺寸**：`position: fixed; top: 14px; left: 0; right: 0; z-index: 50; padding: 0 20px`；实测外框 `1425×78.5px`（`y=14px`）[`computed-style`, `measured`, `1440x900`]
- **内部层级**：
  ```text
  header.site-nav (.is-scrolled when scrollY > 24px)
  └── div.site-nav__bar (flex, gap: 24px, width: min(1120px, 100%), h: 76px, padding: 10px 12px 10px 18px)
      ├── a.site-nav__brand (flex, gap: 10px)
      │   ├── img.site-nav__logo (34×34px, border: 2px solid #1b2432, border-radius: 9px, src="/logo.png")
      │   └── span.site-nav__name ("灯塔加速器", 17px, fw 800, ls 0.01em)
      ├── nav.site-nav__links (flex, gap: 22px, 14.5px, fw 700, 6 项: 首页 / 产品价格 / 下载客户端 / 公告中心 / 帮助中心 / 关注我们)
      │   └── a::after (height: 3px, bottom: -4px, bg: #ffc94d, border-radius: 2px, scaleX(0) -> scaleX(1))
      └── div.site-nav__actions (flex, gap: 12px)
          ├── div.site-nav__more (display: none on >640px; display: block on <=640px)
          │   ├── button.site-nav__more-btn (38×38px, border: 2.5px solid #1b2432, radius: 12px, 18×18px 汉堡 SVG)
          │   └── div.site-nav__menu (点击后展开: position: absolute, top: calc(100%+8px), right: 0, z-index: 30, min-width: 148px, 实测 148×289.78px @ 390×844)
          └── button.site-nav__cta-btn ("登录 / 注册", padding: 13px 26px, 16px, fw 800, bg: #ffc94d, border: 2.5px solid #1b2432, radius: 999px, shadow: 5px 5px 0 #1b2432, 实测 136.4×53.5px)
  ```
- **材质与状态**：
  - 默认：`.site-nav__bar` `background: #fffdf8; border: 2.5px solid #1b2432; border-radius: 999px; box-shadow: 4px 4px 0 #1b2432` [`CSS-rule`, `measured`, `all`]
  - 滚动（`scrollY > 24px`）：`box-shadow: 6px 6px 0 #1b2432; transform: translateY(-2px)`，`transition: 300ms cubic-bezier(0.22, 1, 0.36, 1)` [`CSS-rule`, `measured`, `all`]

---

### Section 1：首屏 Hero `section#top.hero`
- **定位与尺寸**：`padding: 134px 0 40px`（`calc(var(--nav-h) + 66px)`）；实测 `1425×664.95px`（`y=0`）[`computed-style`, `measured`, `1440x900`]
- **内部层级与网格**：
  ```text
  section#top.hero
  └── div.hero__inner (grid: minmax(0,1.05fr) minmax(0,0.95fr) -> 实测 571.19px 516.80px, gap: 32px, align-items: center, width: 1120px)
      ├── div.hero__copy (grid, gap: 22px, justify-items: start)
      │   ├── h1.hero__title ("快得离谱\n稳得无聊", clamp(44px, 7.2vw, 84px) -> 84px @ 1440px, lh: 1.14, fw: 800, ls: -0.01em, 实测 346.08×191.52px)
      │   │   └── span.marker ("稳得无聊", padding: 0 0.08em, linear-gradient(transparent 58%, #ffc94d 58%, #ffc94d 94%, transparent 94%))
      │   ├── p.hero__subtitle (max-width: 460px, 17px, color: #556072)
      │   └── div.hero__actions (flex, wrap, gap: 14px, margin-top: 4px)
      │       ├── a.pop-btn.pop-btn--solid ("购买套餐", 121×58.2px, bg: #ffc94d, padding: 13px 26px, radius: 999px, shadow: 4px 4px 0 #1b2432)
      │       └── a.pop-btn.pop-btn--paper ("查看线路", 121×58.2px, bg: #fffdf8, padding: 13px 26px, radius: 999px, shadow: 4px 4px 0 #1b2432)
      └── div.hero__art (position: relative, 516.8×490.95px, 鼠标视差 translateX∈[-7,7]px, translateY∈[-5,5]px)
          ├── svg (viewBox="0 0 400 380", width: 100%, height: auto, 含背景双圆、.beam、3 颗 .star、2 朵 .cloud、.tower + 2 层 .lamp、礁石、2 条 .wave)
          ├── div.hero__sticker.hero__sticker--a ("99.9% / 服务可用性", top: 12%, right: 4%, 97×66.59px, padding: 10px 16px, radius: 16px, shadow: 4px 4px 0 #1b2432)
          ├── div.hero__sticker.hero__sticker--b ("45ms / 亚太平均时延", bottom: 16%, left: 0, 109×66.59px, animation-delay: 1.1s)
          └── div.hero__sticker.hero__sticker--c ("80+ / 全球加速节点", right: 3%, bottom: 5%, 109×66.59px, animation-delay: 2.2s)
  ```

---

### Section 2：倾斜跑马灯带 `div.marquee-wrap`
- **结构与尺寸**：
  - `div.marquee-wrap`: `padding: 12px 0; margin-top: 44px; overflow: hidden; aria-hidden="true"` [`CSS-rule`, `measured`, `all`]
  - `div.marquee`: `width: calc(100% + 24px); margin-left: -12px; background: #ffc94d; border-top & border-bottom: 2.5px solid #1b2432; transform: rotate(-1.2deg)` [`CSS-rule`, `measured`, `all`]
  - `div.marquee__track`: `display: flex; gap: 44px; width: max-content`（实测 `1859.73px`），`padding: 13px 22px`，内含 `12` 个 `.marquee__item`（`6` 条文案完整复制 2 遍无缝循环，每项含 `15×15px` 五角星 SVG + `15px` `fw 800` 文案，`gap: 12px`）[`computed-style`, `measured`, `1440x900`]
  - **6 条循环文案**：`80+ 全球加速节点`、`99.9% 服务可用性`、`智能选路`、`多入口容灾`、`全平台覆盖`、`专属客服支持`、`金融级专线`（注：实际截图中可见 7 项核心词条，DOM 节点总计 12 项或 14 项视 API/静态配置而定；本地实测快照为 `12` 个 `.marquee__item`，半程 `929.87px`）[`computed-style`, `measured`, `1440x900`]

---

### Section 3：最新动态轮播区 `section#news.news-home`
- **定位与尺寸**：`width: min(1120px, 100% - 40px); padding-top: 120px; margin: 0 auto`；实测 `1120×571.72px`（`y=789.45px`）[`computed-style`, `measured`, `1440x900`]
- **内部层级**：
  ```text
  section#news.news-home
  ├── header.news-home__head.reveal (flex, wrap, justify-content: space-between, align-items: flex-end, gap: 20px 32px, margin-bottom: 30px)
  │   ├── div.news-home__intro (grid, gap: 14px; h2.news-home__title "最新动态" 44px + p.news-home__sub 16px #556072)
  │   └── div.news-home__actions (flex, gap: 12px: a.nh-btn "更新日志" 44px高白底 + a.nh-btn.is-dark "全部公告 ↗" 44px高 #1b2432 底)
  └── div.news-home__track (grid, grid-auto-flow: column, gap: 20px, grid-auto-columns: calc((100% - 60px) / 4) -> 实测每卡 265px, overflow-x: auto, scroll-snap-type: x mandatory)
      └── div.news-home__slot × 6 (scroll-snap-align: start)
          └── a.ann-card (265×311.52px, bg: #fffdf8, border: 2px solid #1b2432, radius: 16px, shadow: 3px 3px 0 #1b2432)
              ├── div.cover.ann-card__cover (aspect-ratio: 2/1, 实测 261×128.5px, border-bottom: 2px solid #1b2432)
              └── div.ann-card__body (flex column, gap: 6px, padding: 12px 14px 14px)
                  ├── div.ann-card__meta (12px fw 700, 7×7px 状态圆点 .ann-card__dot + 分类与日期)
                  ├── h3/div.ann-card__title (15.5px, fw 800, lh 1.45, 2 行截断)
                  ├── p.ann-card__summary (13px, lh 1.6, #556072, 2 行截断)
                  └── span.ann-card__more ("阅读详情 →", 13px, fw 800, margin-top: auto, align-self: flex-end)
  ```
- **交互备注**：实测 `#news` 区域无左右翻页箭头按钮（`newsBtnCount = 0`），通过横向滚动 + `scroll-snap-type: x mandatory` 滑动浏览全部 `6` 张卡片；点击卡片打开 `.ann-overlay` + `.ann-dialog` 弹窗 [`computed-style`, `measured`, `1440x900`]。

---

### Section 4：双栏核心特性与全球线路 `div.home-duo`
- **定位与尺寸**：`display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 36px; width: 1120px; margin: 120px auto 0`；实测 `1120×441.42px`（`y=1467.17px`），左栏 `569.09px`，右栏 `514.89px` [`computed-style`, `measured`, `1440x900`]
- **左栏（企业级网络架构）**：
  - `section.pop-section.is-center.is-fluid`（`padding-top: 0`）
  - 标题 `44px` + 副标题 `16px`，`margin-bottom: 44px`
  - `div.points`：`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px`（实测 `569.09×299.19px`，每卡 `276.55×152.34px`）[`computed-style`, `measured`, `1440x900`]
  - `4` 张 `.point.pop-card.is-hoverable` 卡片（`padding: 16px 18px; gap: 10px; border: 2px solid #1b2432; radius: 16px; shadow: 3px 3px 0 #1b2432`）：
    1. `高速 / 金融级专线直连`：图标底色 `--sky-soft` (`#d3e5ff`)，火箭动态 SVG (`viewBox="0 0 140 140"`)
    2. `服务 / 「保姆级」服务支持`：图标底色 `--mint-soft` (`#d4f0dd`)，护盾脉冲动态 SVG
    3. `高性能 / 自研加速内核`：图标底色 `--sun-soft` (`#ffe9c0`)，仪表盘指针动态 SVG
    4. `高可用 / 99.9% 服务可用性`：图标底色 `--grape-soft` (`#e9dcfb`)，心跳线+船锚+气泡动态 SVG
    - 图标容器 `.point__art`：`42×42px`，`padding: 7px`，`border: 2px solid #1b2432`，`border-radius: 12px` [`CSS-rule`, `measured`, `all`]
- **右栏（全球线路 `#nodes`）**：
  - 在 `>960px` 下：`#nodes` 为 `display: flex; flex-direction: column`，`.pop-section__body` 为 `position: relative; flex: 1`，内部 `.globe` 绝对居中并按 `height: calc(100% * 600 / 456); aspect-ratio: 1` 缩放（实测 `393.72×393.72px` @ `1440px`）[`CSS-rule` & `computed-style`, `measured`, `1440x900`]
  - `.globe__glow`：`inset: 8%; radial-gradient(circle, #ffe9c0 0%, transparent 65%); border-radius: 50%`
  - `svg.globe__svg`：`viewBox="0 0 600 600"`，`cursor: grab`（拖拽时 `.is-dragging` 切 `cursor: grabbing`），球体半径 `228`（中心 `300,300`），球面填充 `#f7faff` 描边 `3px #1b2432`，陆地填充 `#b9d9c8` 描边 `1.2px #8fbfa8`，航线 `.arc` 虚线 `stroke: #4d96ff; stroke-width: 2.2; stroke-dasharray: 5 7`，`14` 个节点标记（香港 Hub 金色圆点 `r=9` + 脉冲环 `r=15` + 白色描边标签 `14px fw 800`）[`CSS-rule` & `computed-style`, `measured`, `1440x900`]

---

### Section 5：套餐价格 `section#plans.pop-section.is-center`
- **定位与尺寸**：`width: 1120px; padding-top: 120px`；实测 `1120×943.45px`（`y=1908.59px`）[`computed-style`, `measured`, `1440x900`]
- **切换栏 `.kind-tabs`**：
  - 外框：`display: inline-flex; padding: 4px; bg: #fffdf8; border: 2.5px solid #1b2432; radius: 999px; shadow: 3px 3px 0 #1b2432`，实测 `213×50px` [`computed-style`, `measured`, `1440x900`]
  - 按钮 `.kind-tab`：`订阅套餐`（默认激活 `.kind-tab--on`，`bg: #ffc94d; color: #1b2432; box-shadow: inset 0 0 0 2px #1b2432`）与 `按量付费`（`padding: 8px 20px; 15px; fw 800`）
- **订阅模式（默认）**：
  - `ul.plans`：`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px` -> `1440px` 实测 4 列等宽 `266.5px`，高 `563.16px` [`computed-style`, `measured`, `1440x900`]
  - 单卡 `.plan`：`padding: 20px; gap: 12px; bg: #fffdf8; border: 2.5px solid #1b2432; radius: 28px; shadow: 5px 5px 0 #1b2432`
    - 头部 `.plan__head`：`36×36px` 图标（`bg: #ffe9c0; border: 2.5px solid #1b2432; radius: 10px`）+ `19px` 名称（`入门套餐` / `轻量套餐` / `VIP套餐` / `SVIP套餐`）
    - 流量额度 `.plan__quota`：`21px fw 800`（`60 / 120 / 300 / 800 GB / 30天`）
    - 规格胶囊 `.plan__specs`：`.pop-badge`（`padding: 4px 10px; 12px; shadow: 2px 2px 0 #1b2432`）
    - 周期价格网格 `.plan__prices`：`2` 列 `gap: 12px 8px`，顶部分割线 `2px dashed #fbe8cd`；单项 `.price`（`radius: 10px; bg: #fff6e9`），最优项 `.price.is-best`（`bg: #d4f0dd; border: 2px solid #1b2432`）配右上角旋转 `4deg` 的红色折扣角标 `.price__tag.is-off`（`bg: #ff6b6b; color: #fffdf8; 10px; radius: 999px`）；仅 1 项时 `:only-child` 跨满 2 列
    - 权益列表 `.plan-desc`：`12.5px; lh 1.65`，每条 `li::before` 渲染金色 `✦`（`#ffc94d`）
    - 底部按钮 `.plan__cta`：`margin-top: auto; padding: 9px 14px; 14px fw 700; bg: #ffc94d; border: 2.5px solid #1b2432; radius: 14px; shadow: 3.5px 3.5px 0 #1b2432`
- **按量付费模式（点击 `按量付费` 实测）**：
  - 副标题文案切换为 `"流量不限时，用完再买"`
  - `ul.plans.is-few` 居中显示 `1` 张卡片（实测 `360×420.25px`）：`按量付费`、`¥0.85 / GB`，含 `.rcpt` 虚线明细表（有效期/流量用完/开通门槛/同时在线/速率，右列 `font-variant-numeric: tabular-nums`）与「立即购买」按钮 [`computed-style`, `measured`, `1440x900`]

---

### Section 6：全平台客户端下载 `section#download.pop-section.is-center`
- **定位与尺寸**：`width: 1120px; padding-top: 120px`；实测 `1120×641.88px`（`y=2852.04px`）[`computed-style`, `measured`, `1440x900`]
- **内部容器 `.dl`**：`max-width: 640px; margin: 0 auto; display: grid; gap: 18px`
- **7 平台选项卡 `.dl-tabs`**（实测 `640×56px`）：`iOS`、`Android`、`Mac`（默认激活）、`Windows`、`Linux`、`软路由`、`TV`
- **内容面板 `.dl-panel`**（`.pop-card` 变体，`padding: 22px; gap: 6px; text-align: center`），点击各平台实测面板高度（宽度恒为 `640px` @ `>=768px`）：
  - `iOS` / `Android` / `Windows` / `TV`：`244.88px`（图标 chip `50×50px` + 平台名 + 说明 + 胶囊主下载按钮 `.dl-main`）
  - `Mac`（默认）：`305.68px`（含 2 列 `.dl-options`：`Apple Silicon` 与 `Intel` 下载卡片）
  - `Linux`：`443.23px`（含发行版图标行 `.dl-distros` + 深色命令块 `.dl-cmd__code` `#1f2937` + 黄色复制按钮 `.dl-cmd__copy` + 折叠 `<details class="dl-body--fold">`）
  - `软路由`：`492.53px`（含 2 列路由器系统单选卡 `.dl-sys` OpenWrt/梅林 + `wget` 一键命令块 + 折叠手动下载）[`computed-style`, `measured`, `1440x900`]

---

### Section 7：深色页脚 `footer.site-footer` 与悬浮客服 `button.support-bubble`
- **页脚 `footer.site-footer`**：
  - `margin-top: 96px; background: #1b2432; color: #fff6e9; border-top: 2.5px solid #1b2432`；实测 `1425×313.39px`（`y=3589.91px`）[`computed-style`, `measured`, `1440x900`]
  - `.site-footer__inner`：`width: min(1120px, 100% - 40px); padding: 56px 0 28px`
  - `.site-footer__top`：`grid-template-columns: 2fr 1fr 1fr 1.6fr; gap: 32px`（实测 `365.7px / 182.86px / 182.86px / 292.58px`）
  - `.site-footer__bottom`：`margin-top: 40px; padding-top: 22px; border-top: 1px solid rgb(255 255 255 / 12%); font-size: 12.5px; opacity: 0.6`
- **悬浮客服按钮 `button.support-bubble`**：
  - `position: fixed; right: 22px; bottom: 22px; z-index: 60; padding: 12px 20px 12px 16px; gap: 8px; bg: #ffc94d; border: 2.5px solid #1b2432; radius: 999px; shadow: 5px 5px 0 #1b2432`；实测 `131×51px`（桌面端），`<=560px` 隐藏文字收敛为 `53×53px` 圆形图标按钮（`right: 16px; bottom: 16px; padding: 13px`）[`computed-style`, `measured`, `1440x900` & `390x844`]

---

## 3. 五视口响应式布局变化总表（实测对比）

| 元素 / 指标 | `390×844` | `768×1024` | `1024×768` | `1440×900` | `1920×1080` | 来源 / 置信度 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 页面总高 (实时页) | `6787.3px` | `5643.2px` | `4418.9px` | `3903.3px` | `3903.3px` | `computed-style` / `measured` |
| 导航胶囊 `.site-nav__bar` 宽×高 | `350×66px` | `728×76px` | `984×76px` | `1120×76px` | `1120×76px` | `computed-style` / `measured` |
| 导航链接 `.site-nav__links` | `display: none` (隐藏) | `flex`, `14px`, `gap: 14px` (5 项，隐藏产品价格) | `flex`, `14.5px`, `gap: 22px` (6 项) | `flex`, `14.5px`, `gap: 22px` (6 项) | `flex`, `14.5px`, `gap: 22px` (6 项) | `computed-style` / `measured` |
| 移动端汉堡按钮 `.site-nav__more-btn` | 可见 (`38×38px`)，展开菜单 `148×289.8px` | 隐藏 (`display: none`) | 隐藏 | 隐藏 | 隐藏 | `computed-style` / `measured` |
| Hero 网格 `.hero__inner` | `1` 列 (`350px`) | `1` 列 (`728px`) | `2` 列 (`499.8px` + `452.2px`) | `2` 列 (`571.2px` + `516.8px`) | `2` 列 (`571.2px` + `516.8px`) | `computed-style` / `measured` |
| Hero 标题 `.hero__title` 字号 | `44px` | `55.296px` | `73.728px` | `84px` | `84px` | `computed-style` / `measured` |
| Section 顶距 `.pop-section` / `.news-home` | `88px` | `120px` | `120px` | `120px` | `120px` | `CSS-rule` / `measured` |
| 动态卡片列宽 `.news-home__track` | `84%` (`281.4px` 实时 / `294px` 无头), `gap: 16px` | `calc(50% - 10px)` (`346.5px` 实时 / `354px` 无头), `gap: 20px` | `calc(25% - 15px)` (`227.3px` 实时 / `231px` 无头), `gap: 20px` | `calc(25% - 15px)` (`265px`), `gap: 20px` | `calc(25% - 15px)` (`265px`), `gap: 20px` | `computed-style` / `measured` |
| 双栏区 `.home-duo` | `1` 列 (`gap: 88px`) | `1` 列 (`gap: 88px`) | `2` 列 (`497.7px` + `450.3px`, `gap: 36px`) | `2` 列 (`569.1px` + `514.9px`, `gap: 36px`) | `2` 列 (`569.1px` + `514.9px`, `gap: 36px`) | `computed-style` / `measured` |
| 特性卡片 `.points` | `1` 列 (`350px`) | `2` 列 (`356px × 2`) | `2` 列 (`240.8px × 2`) | `2` 列 (`276.5px × 2`) | `2` 列 (`276.5px × 2`) | `computed-style` / `measured` |
| 地球容器 `.globe` | `335×335px` (实时) / `350×350px` | `620×620px` | `421.9×421.9px` | `393.7×393.7px` | `393.7×393.7px` | `computed-style` / `measured` |
| 套餐卡片网格 `.plans` | `1` 列 (`335px` 实时 / `350px`) | `2` 列 (`347.5px` 实时 / `355px`) | `3` 列 + 折行 `1` 张 (`311px` 实时 / `316px`) | `4` 列 (`266.5px × 4`) | `4` 列 (`266.5px × 4`) | `computed-style` / `measured` |
| 下载选项 `.dl-options` & 标签 `.dl-tabs` | 1 列选项 (`302px`), 竖排标签 (`11.5px`, `radius: 22px`) | 2 列选项 (`290px × 2`), 横排标签 (`640×56px`) | 2 列选项, 横排标签 (`640×56px`) | 2 列选项, 横排标签 (`640×56px`) | 2 列选项, 横排标签 (`640×56px`) | `computed-style` / `measured` |
| 页脚网格 `.site-footer__top` | `2` 列 (`1fr 1fr`, 品牌与联系跨满行) | `2` 列 (`1fr 1fr`, 品牌与联系跨满行) | `4` 列 (`2fr 1fr 1fr 1.6fr`) | `4` 列 (`2fr 1fr 1fr 1.6fr`) | `4` 列 (`2fr 1fr 1fr 1.6fr`) | `computed-style` / `measured` |
| 悬浮客服 `.support-bubble` | `53×53px` 纯图标 (`right/bottom: 16px`) | `131×51px` 图标+文字 (`right/bottom: 22px`) | `131×51px` | `131×51px` | `131×51px` | `computed-style` / `measured` |
