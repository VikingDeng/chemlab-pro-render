# ChemLab Pro — 视觉锚定 Mood Board

> 这份文档是阶段 0 的成果物。所有参考已按类别整理，
> 每个参考都标注了「借鉴什么」，直接指导后续 Prompt 编写。

---

## 一、整体风格锚点

### 风格定义
**Dark Glassmorphism + 科技感光效 + 化学反应霓虹色**

### 风格关键词（写 Prompt 时必须带上）
```
dark glassmorphism, translucent surfaces, layered depth,
subtle cyan glow, premium, generous spacing, cinematic contrast,
monospace data aesthetic, neon reaction highlights
```

### 对标产品
| 产品 | 借鉴什么 | 参考链接 |
|------|---------|---------|
| **Linear** | 暗色主题极致细节：超细 1px SVG 线条、HSL 主题系统、多层灰度层级、frosty-glass 效果 | https://linear.app |
| **Vercel Dashboard** | Geist Design System：10 级颜色比例尺、P3 广色域、半透明浮层、完整组件系统 | https://vercel.com/geist/introduction |

---

## 二、视觉参考分类索引

### A. 玻璃拟态 + 暗色主题（核心风格参考）

| # | 参考名称 | 借鉴什么 | 搜索/链接 |
|---|---------|---------|----------|
| A1 | **Animated Glassmorphism Glow Card** | 🔑 **最核心参考**：暗色背景 #0f172a + 渐变发光球体 + backdrop-blur(20px) 毛玻璃卡片 + 浮动动画。代码可直接复用 | https://codeshack.io/animated-glassmorphism-glow-card/ |
| A2 | **Nebulix - Futuristic Crypto Wallet** | 深色背景 + 紫色玻璃卡片 + 霓虹蓝绿光效 + 毛玻璃导航 → 用于侧边栏和导航设计 | Dribbble 搜索: glassmorphism-dark-mode |
| A3 | **Glassmorphism Dashboard (Dark Mode)** | 半透明侧边栏 + 渐变背景 + 数据面板 → 用于整体布局参考 | Dribbble 搜索: Glassmorphism-dashboard |
| A4 | **Smart Home TV Dashboard Glassmorphism** | 深色主题 + 玻璃控制面板 + 现代极简 → 参考控制面板和仪表盘 | Dribbble 搜索: Glassmorphism-dashboard |
| A5 | **Dark Mode Finance App** | 极简深色 + 玻璃态卡片 + 数据展示 → 参考数据卡片排列 | Dribbble 搜索: dark-theme-glassmorphism |

### B. 霓虹光效 + 暗色 Dashboard（反应光效参考）

| # | 参考名称 | 借鉴什么 | 搜索/链接 |
|---|---------|---------|----------|
| B1 | **Crypto Dashboard UI - Neon Glow** | 🔑 霓虹渐变高亮 + 深色背景的完美融合 → 化学反应激活时的发光效果 | https://dribbble.com/shots/25670242 |
| B2 | **Web3 Trading Dashboard - Neon Dark** | 霓虹暗色模式 + 实时数据 → 实验实时数据监控面板 | Dribbble 搜索: dashboard-neon |
| B3 | **Voxa - AI Voice Assistant Futuristic** | 深色未来主义 + 发光按钮效果 → 参考按钮和交互元素的发光设计 | Dribbble 搜索: neon-dark-mode |
| B4 | **Glowing Gradient Glassmorphism Cards** | CSS3 渐变发光 + 玻璃效果 + Hover 教程 → 器材卡片的发光交互 | https://medium.com/@codepicker57/illuminate-your-design |
| B5 | **Shiny Glass Hover Effect** | `::before` + `skew(45deg)` 闪光条纹扫过效果 → 按钮和导航的 hover 闪光 | https://dev.to/crayoncode/shiny-glass-hover-effect-glassmorphism-17n7 |

### C. 化学实验室 / 科学主题（功能参考）

| # | 参考名称 | 借鉴什么 | 搜索/链接 |
|---|---------|---------|----------|
| C1 | **ChemVerse AI** | 🔑 **最相关产品**：50+ 实验、AI 导师 Dr. Nova、XP 成就系统、22 种器材、PWA、游戏化进阶 | https://chemverse.vercel.app/ |
| C2 | **PhET Molarity Simulation** | 极简直觉式 UI：最少按钮、拖拽滑块即时反馈、颜色实时映射浓度 | https://phet.colorado.edu/sims/html/molarity/latest/molarity_all.html |
| C3 | **Labster 虚拟实验室** | 分学科入口、视频引导 onboarding、自动评分、300+ 模拟、数据驱动信任 | https://www.labster.com/ |
| C4 | **3D Science Lab (Rudra Sarker)** | 🔑 **技术栈最吻合**：Next.js 15 + Three.js + R3F + Framer Motion + Leva；40+ 实验，60fps | https://dev.to/rudra_sarker/3d-science-lab-interactive-3d-stem-education-with-40-experiments |
| C5 | **PraxiLabs 化学模拟** | 分析化学/无机/有机/物理化学五大领域分类 + 安全培训模块 | https://praxilabs.com/ |
| C6 | **Chemistry Learning App** | 元素周期表色彩编码 + 卡片式学习模块 + 实验模拟区 | Dribbble 搜索: chemistry-app |

### D. 液体模拟 / 流体动效（反应动画参考）

| # | 参考名称 | 借鉴什么 | 链接 |
|---|---------|---------|------|
| D1 | **WebGL Fluid Simulation (PavelDoGreat)** | 🔑 **最佳流体参考**：高性能 WebGL 流体，鼠标驱动，色彩混合极逼真 → 液体倾倒/混合效果 | https://codepen.io/PavelDoGreat/pen/zdWzEL |
| D2 | **Fluid Simulation (ishibashijun)** | 纯 Canvas 轻量流体模拟 → 性能受限时的降级方案 | https://codepen.io/ishibashijun/pen/AezYoa |
| D3 | **WebGL Fluid + dat.gui** | WebGL 2.0 流体 + GUI 控制面板 → 参考实验参数调节 UI | https://codepen.io/RunicFreak/pen/abKPYJa |
| D4 | **CSS Liquid Shape** | 纯 CSS border-radius 动画模拟液面晃动 → 轻量液面装饰效果 | https://codepen.io/syohei-yamaki/pen/PoNKwGG |

### E. 粒子动画 / UI 动效（交互动效参考）

| # | 参考名称 | 借鉴什么 | 链接 |
|---|---------|---------|------|
| E1 | **Motion (Framer Motion v12)** | React 动画引擎首选：手势、布局动画、AnimatePresence | https://motion.dev/ |
| E2 | **Advanced Framer Motion Patterns** | 变体传播、布局动画深度教程 + 交互式 Playground → hover 联动效果 | https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/ |
| E3 | **Framer Marketplace Particles** | 即用型粒子组件库 → 气泡/烟雾/沉淀粒子效果 | https://www.framer.com/marketplace/components/tags/particles/ |
| E4 | **Animated UI Components (React)** | React + Tailwind + Shadcn + Framer Motion 暗色动画组件合集 | https://www.reddit.com/r/reactjs/comments/1rh0qpy/ |

### F. 3D 器材渲染（可选 3D 方向参考）

| # | 参考名称 | 借鉴什么 | 链接 |
|---|---------|---------|------|
| F1 | **3D Data Visualization (8-step Tutorial)** | R3F 从基础到 InstancedMesh(10万点) 到 Bloom 发光，每步有 CodeSandbox → 反应发光效果 | https://medium.com/cortico/3d-data-visualization-with-react-and-three-js-7272fb6de432 |
| F2 | **React Three Fiber 官方文档** | R3F 声明式 3D 开发范式 + 完整 API | https://r3f.docs.pmnd.rs/ |
| F3 | **R3F 官方示例集** | 光照、材质、相机控制最佳实践 | https://r3f.docs.pmnd.rs/getting-started/examples |
| F4 | **Vercel: v0 + React Three Fiber 指南** | 用 AI (v0) 生成 3D 场景的 Prompt 示例和方法论 | https://vercel.com/blog/add-3d-to-your-web-projects-with-v0-and-react-three-fiber |

---

## 三、视觉模式提取

基于以上参考，提取出 ChemLab Pro 的共同视觉模式：

### 配色系统（已确认）

```
BACKGROUND
  bgBase:        #0a0e1a   (深墨蓝 — 匹配 A1 的 #0f172a 方向)
  bgElevated:    #111827   (面板底色)
  bgGlass:       rgba(255, 255, 255, 0.04)

ACCENT（化学反应色）
  酸性反应:      #22d3ee   (氰蓝 — 对应 B1 的霓虹色调)
  碱性反应:      #8b5cf6   (紫色)
  放热反应:      #f59e0b   (琥珀)
  成功/安全:     #10b981   (翠绿)
  危险/错误:     #f43f5e   (玫红)
```

### 布局模式（已确认）
```
三栏布局（参考 A3 + C4）:
├── 左侧栏 260px — 器材库（参考 A2 的毛玻璃侧边栏）
├── 中央区 flex-1 — 实验台画布（参考 C2 的极简直觉式交互）
└── 右侧栏 320px — 试剂 + 日志（参考 A5 的数据卡片排列）

顶栏 56px — 状态信息（参考 B2 的实时数据面板）
底栏 36px — 实验室状态
```

### 质感关键参数（已确认）
```
玻璃面板:  backdrop-filter: blur(24px)
           background: rgba(255,255,255,0.04)
           border: 1px solid rgba(255,255,255,0.08)
           border-radius: 16px

发光效果:  box-shadow: 0 0 20px rgba(34,211,238,0.15)
           多层叠加实现霓虹感（参考 B1）

hover:     translateY(-2px) + 边框发光渐现 150ms
```

### 动效策略（已确认）
```
UI 层:     Framer Motion（面板过渡、卡片动画、手势） — 参考 E1/E2
液体层:    WebGL Shader 或 CSS 动画 — 参考 D1 (WebGL) / D4 (CSS 轻量)
粒子层:    Three.js Points 或 Framer Motion — 参考 E3
3D 层:     React Three Fiber + Bloom 后处理 — 参考 F1/F2（可选）
```

---

## 四、关键参考速查（Top 5 必看）

| 优先级 | 参考 | 为什么必看 | 花多久看 |
|--------|------|----------|---------|
| ⭐⭐⭐ | **A1 - Glassmorphism Glow Card** | 玻璃拟态 + 发光的完整代码实现，风格最吻合 | 10 min |
| ⭐⭐⭐ | **C4 - 3D Science Lab** | 技术栈完全一致的 40+ 实验项目，直接参考架构 | 20 min |
| ⭐⭐⭐ | **D1 - WebGL Fluid Simulation** | 液体混合的视觉效果标杆 | 5 min |
| ⭐⭐ | **C1 - ChemVerse AI** | 最相关的化学模拟产品，参考功能设计和游戏化 | 15 min |
| ⭐⭐ | **B1 - Crypto Dashboard Neon Glow** | 霓虹光效 + 暗色背景的最佳配色参考 | 5 min |

> 总计约 55 分钟。看完这 5 个，你对 ChemLab Pro 的视觉方向会非常清晰。

---

## 五、阶段 0 完成清单

- [x] 视觉参考收集（6 大类、30+ 参考）
- [x] 共同模式提取（配色/布局/质感/动效）
- [x] 风格关键词确定（9 个关键词）
- [x] 对标产品确认（Linear + Vercel）
- [x] 核心技术栈确认（React + Tailwind + shadcn/ui + Framer Motion + R3F）

**✅ 阶段 0 完成。你现在可以打开 `03-step-by-step-prompts.md`，从 Prompt 1.1 开始执行了。**
