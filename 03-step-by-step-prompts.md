# 阶段 1-4：分步 Prompt 实战手册

> **核心原则**：每一步只做一件事，每个 Prompt 都自包含设计约束。
> 
> 你可以把这份手册当作"食谱"——按顺序做，每步产出一个高质量组件，
> 最后拼装成完整应用。

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 阶段 1：主界面骨架
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Prompt 1.1 — 整体布局框架

### 教学要点
- **第一个 Prompt 只做布局骨架**，不要管细节
- 告诉 AI 精确的面板宽度和布局结构
- 使用真实的面板名称和示意内容

### 可直接使用的 Prompt ✂️

```
You are building "ChemLab Pro", a virtual chemistry laboratory simulator.

TECH STACK: React 18 + TypeScript + Tailwind CSS + shadcn/ui
VIEWPORT: 1440 x 900px (desktop first)

DESIGN SYSTEM:
- Background: #0a0e1a
- Glass panels: rgba(255,255,255,0.04) with backdrop-blur-[24px], 
  border 1px rgba(255,255,255,0.08), border-radius 16px
- Text primary: #e2e8f0, Text secondary: #94a3b8
- Accent: #22d3ee (cyan)
- Font: Inter for UI, JetBrains Mono for chemical formulas
- All spacing follows 8pt grid

STYLE KEYWORDS: dark glassmorphism, translucent surfaces, layered depth,
subtle cyan glow, premium, generous spacing, cinematic contrast

LAYOUT STRUCTURE:
┌─────────────────────────────────────────────────────┐
│  TOP BAR (h: 56px, full width)                      │
│  Logo "ChemLab Pro" | Mode: "Free Experiment" |     │
│  Safety: green dot "Safe" | Temp: 22°C             │
├──────────┬────────────────────────┬─────────────────┤
│ LEFT     │  CENTER WORKSPACE      │  RIGHT PANEL    │
│ SIDEBAR  │  (flex-1)              │  (w: 320px)     │
│ (w:260px)│                        │                 │
│          │  Main experiment       │  Top: Reagents  │
│ Equipment│  canvas area with      │  Bottom: Log    │
│ Inventory│  subtle grid dots      │                 │
│          │  (opacity 5%)          │                 │
├──────────┴────────────────────────┴─────────────────┤
│  BOTTOM STATUS BAR (h: 36px)                        │
│  "Lab Status: Active" | "Elements on bench: 0"      │
└─────────────────────────────────────────────────────┘

LEFT SIDEBAR content (equipment list):
- 🧪 Beaker 250ml
- 🧪 Erlenmeyer Flask 500ml
- 🔥 Bunsen Burner
- 🧫 Test Tube (×6 rack)
- 💉 Pipette 10ml
- 📊 pH Meter

RIGHT PANEL — Reagent Shelf:
- HCl (1M) — yellow indicator dot
- NaOH (1M) — blue dot
- CuSO₄ (0.5M) — cyan dot
- AgNO₃ (0.1M) — white dot
- H₂SO₄ (0.5M) — amber dot

RIGHT PANEL — Observation Log (initially):
- "Welcome to ChemLab Pro. Drag equipment to begin."

REQUIREMENTS:
- All panels are separate glass containers with 12px gap between them
- Center workspace has NO glass background — just the raw #0a0e1a 
  with faint grid dots
- Sidebar items should have hover: translateY(-1px) + border glow
- This is LAYOUT ONLY — no interactions yet, just the visual structure
- Make it feel like a premium developer tool, NOT an educational toy
```

### 为什么这样写？逐行解析

| Prompt 部分 | 为什么这样写 |
|------------|-------------|
| `TECH STACK` 放最前面 | AI 会根据技术栈选择合适的语法和组件 |
| `VIEWPORT: 1440x900` | 避免 AI 猜测屏幕尺寸 |
| `DESIGN SYSTEM` 精确色值 | 消除 AI 自由发挥空间 = 一致性 |
| `STYLE KEYWORDS` | 影响 AI 的排版、阴影、间距决策 |
| ASCII 布局图 | AI 看图比看文字理解布局更准确 |
| 真实内容（HCl, NaOH…） | AI 会根据真实文字长度调整卡片尺寸 |
| `LAYOUT ONLY` 明确边界 | 防止 AI 过度发挥，加入你没要求的东西 |
| 最后一句"NOT educational toy" | 风格锚点，AI 会避免卡通化 |

---

## Prompt 1.2 — 审查与修正

### 教学要点
- 第一轮输出 **一定有问题**，这很正常
- 关键是你要能 **精确描述问题**，而不是说"不好看"

### 常见问题与修正 Prompt 模板

**问题 1：间距太紧凑**
```
The current layout feels too cramped. Please:
- Increase gap between panels from 8px to 12px
- Add 20px padding inside each glass panel
- Increase line-height in the equipment list to 2.5rem
- The center workspace needs at least 16px margin from adjacent panels
Keep all other styles unchanged.
```

**问题 2：玻璃效果不明显**
```
The glass panels look too opaque / not glassy enough. Please adjust:
- Background: rgba(255, 255, 255, 0.04) → rgba(255, 255, 255, 0.06)
- Increase backdrop-filter blur from 16px to 24px
- Add a subtle top-edge highlight: 
  border-top: 1px solid rgba(255, 255, 255, 0.15)
- Ensure the #0a0e1a background gradient is visible THROUGH the panels
```

**问题 3：缺乏层次感**
```
The layout feels flat. Add depth:
- Top bar: add box-shadow: 0 1px 0 rgba(255,255,255,0.06)
- Left sidebar equipment items: add 1px border-bottom separator
- Right panel sections: add a subtle divider between Reagents and Log
- Center workspace: add very faint radial gradient from center 
  (rgba(34,211,238,0.02)) to create focal point
```

> **教学核心**：永远用具体的 CSS 属性值来描述你要的修改，
> 不要说"好看一点""更有质感"——这种话对 AI 没有信息量。

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 阶段 2：逐组件精修
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Prompt 2.1 — 器材卡片组件

### 教学要点
- 从整体布局中 **剥离出单个组件** 来精修
- 覆盖该组件的所有状态（default / hover / active / dragging / disabled）
- 提供真实的内容

```
Focus ONLY on the Equipment Card component used in the left sidebar.

DESIGN TOKENS: [粘贴 01-design-tokens.md 中的 COLOR + RADIUS + SPACING 部分]

COMPONENT SPEC:
- Size: 228px wide (sidebar 260px - 16px padding × 2)
- Height: auto, min 56px
- Layout: horizontal — [Icon 32×32] [gap 12px] [Name + Subtitle] [Drag Handle]
- Background: transparent (inherits sidebar glass)
- Border-bottom: 1px solid rgba(255,255,255,0.04)

CONTENT (6 cards):
1. Icon: beaker outline | Name: "Beaker" | Sub: "250ml borosilicate"
2. Icon: flask outline | Name: "Erlenmeyer Flask" | Sub: "500ml"
3. Icon: flame | Name: "Bunsen Burner" | Sub: "Gas-powered"
4. Icon: test-tubes | Name: "Test Tube Rack" | Sub: "6 slots"
5. Icon: pipette | Name: "Pipette" | Sub: "10ml graduated"
6. Icon: gauge | Name: "pH Meter" | Sub: "Digital, 0-14 range"

STATES:
- Default: icon #64748b, name #e2e8f0, subtitle #475569
- Hover: entire card background rgba(34,211,238,0.05), 
  icon color → #22d3ee, translateY(-1px), transition 150ms ease-out
- Active/Pressed: scale(0.98), background rgba(34,211,238,0.08)
- Dragging: card becomes semi-transparent (opacity 0.6), 
  with a "ghost" copy following cursor (opacity 0.3, blur 4px)
- Disabled (already placed): opacity 0.35, cursor not-allowed,
  show small "In use" badge

DRAG HANDLE: 
- Right side of card, 6 dots pattern (⠿), color #475569
- On hover: dots color → #94a3b8

ICONS: Use Lucide icons (lucide-react package).
```

---

## Prompt 2.2 — 试剂面板

```
Focus ONLY on the Reagent Shelf panel (right sidebar, top section).

DESIGN TOKENS: [粘贴相关部分]

PANEL SPEC:
- Title: "Reagent Shelf" with flask icon, #e2e8f0, 16px semibold
- Panel uses .glass-panel style
- Max height: 50% of right panel, scrollable if overflow

REAGENT LIST ITEMS:
Each item layout: [Color Dot 8px] [gap 8px] [Name] [Concentration badge]

Items:
1. Dot: #facc15 (yellow) | "Hydrochloric Acid" | badge: "HCl · 1M"
2. Dot: #3b82f6 (blue) | "Sodium Hydroxide" | badge: "NaOH · 1M"
3. Dot: #22d3ee (cyan) | "Copper Sulfate" | badge: "CuSO₄ · 0.5M"
4. Dot: #e2e8f0 (white) | "Silver Nitrate" | badge: "AgNO₃ · 0.1M"
5. Dot: #f59e0b (amber) | "Sulfuric Acid" | badge: "H₂SO₄ · 0.5M"
6. Dot: #a855f7 (purple) | "Potassium Permanganate" | badge: "KMnO₄ · 0.01M"

BADGE STYLE:
- Background: same as dot color but 15% opacity
- Text: same dot color, JetBrains Mono, 12px
- Border-radius: 9999px (pill shape)
- Subscript numbers (₄, ₃, etc.) must render correctly

HOVER STATE:
- Background: dot color at 8% opacity fills entire row
- Dot: subtle pulse animation (scale 1 → 1.3 → 1, 600ms)
- Cursor: grab (indicates draggable)

INTERACTION HINT:
- At bottom of list, muted text: "Drag reagent to equipment"
- Color: #475569, italic, 13px
```

---

## Prompt 2.3 — 实验台画布（中央工作区）

```
Focus ONLY on the Center Workspace (main experiment canvas).

DESIGN TOKENS: [粘贴相关部分]

CANVAS SPEC:
- Background: #0a0e1a (NO glass effect — raw background)
- Grid: dot pattern, spacing 32px, dot size 1px, color rgba(255,255,255,0.05)
- Full height between top bar and bottom status bar

EMPTY STATE (nothing placed yet):
- Center of canvas: large, very subtle beaker outline (stroke only)
  Color: rgba(255,255,255,0.03), size about 200px
- Below it: "Drag equipment here to set up your experiment"
  Color: #475569, 16px, Inter
- Below text: three small suggestion chips:
  "Quick Start: Acid-Base Titration" | "Salt Formation" | "Redox Reaction"
  Chip style: glass-panel mini, 12px, on click loads preset experiment

DROP ZONE FEEDBACK:
- When user drags equipment OVER the canvas:
  - Canvas border becomes dashed 2px #22d3ee at 30% opacity
  - Subtle radial gradient appears at cursor position:
    radial-gradient(circle 100px, rgba(34,211,238,0.06), transparent)
  - Grid dots near cursor brighten to rgba(255,255,255,0.15)

PLACED EQUIPMENT (example state with 2 items):
- Beaker at position (400, 300): 
  Show realistic beaker SVG/illustration, ~120px tall
  Inside: blue liquid (CuSO₄) filling 60% height
  Liquid color: rgba(59,130,246,0.6) with subtle wave animation at top
  Below: label "Beaker A" + "CuSO₄ (0.5M, 150ml)", JetBrains Mono 12px
  
- Empty Flask at position (650, 280):
  Show flask SVG, ~100px tall
  Empty state: faint inner gradient
  Below: label "Flask B" + "Empty"

CONNECTION HINT:
- When two equipment items are within 200px of each other,
  show a faint dashed curve line between them (potential pour path)
  Color: rgba(34,211,238,0.15)
```

---

## Prompt 2.4 — 观察日志

```
Focus ONLY on the Observation Log panel (right sidebar, bottom section).

DESIGN TOKENS: [粘贴相关部分]

PANEL SPEC:
- Title: "Observation Log" with scroll-text icon, same title style
- Takes remaining 50% of right panel height
- Scrollable, newest entry at bottom (chat-style)

LOG ENTRIES (example data):
1. time: "14:20" | event: "Experiment started" | type: system
2. time: "14:21" | event: "Placed Beaker A on workspace" | type: action
3. time: "14:22" | event: "Added 150ml CuSO₄ (0.5M) to Beaker A" | type: action
4. time: "14:23" | event: "Solution temperature: 22°C" | type: measurement
5. time: "14:24" | event: "Added 50ml NaOH (1M) to Beaker A" | type: action  
6. time: "14:24" | event: "⚠ Reaction detected: Cu(OH)₂ precipitate forming" | type: reaction
7. time: "14:25" | event: "Solution turned light blue → cloudy" | type: observation

ENTRY STYLES BY TYPE:
- system:      icon: terminal | time: #475569 | text: #64748b (italic)
- action:      icon: hand    | time: #475569 | text: #94a3b8
- measurement: icon: gauge   | time: #475569 | text: #22d3ee (mono font)
- reaction:    icon: zap     | time: #475569 | text: #f59e0b (with glow background)
- observation: icon: eye     | time: #475569 | text: #e2e8f0

NEW ENTRY ANIMATION:
- Slide in from bottom, 250ms ease-out
- Slight fade-in from opacity 0 to 1
- "reaction" type entries: brief amber border flash

FOOTER:
- Input area at bottom: "Add manual note..."
- Glass input style, 36px height, with send button (arrow-up icon)
```

---

## Prompt 2.5 — 温度 / pH 仪表盘

```
Focus ONLY on a compact instrument readout bar that sits at the 
top of the center workspace.

DESIGN TOKENS: [粘贴相关部分]

LAYOUT: Horizontal bar, glass-panel style, h: 48px, positioned at 
top of center workspace with 12px margin.

Contains 3 readouts side by side:

READOUT 1 — Temperature:
- Icon: thermometer (Lucide)
- Label: "TEMP" (10px, uppercase, #475569, letter-spacing 1px)
- Value: "22.4°C" (JetBrains Mono, 18px, #e2e8f0)
- Color coding: < 30°C = #22d3ee, 30-60°C = #f59e0b, > 60°C = #f43f5e
- Tiny trend indicator: ↗ or ↘ or → with color

READOUT 2 — pH Level:
- Icon: droplets (Lucide)
- Label: "pH"
- Value: "7.0" (mono, 18px)
- Color: follows pH scale gradient
  pH < 3: #f43f5e (strong acid, red)
  pH 3-6: #f59e0b (weak acid, amber)
  pH 6-8: #10b981 (neutral, green)  
  pH 8-11: #3b82f6 (weak base, blue)
  pH > 11: #8b5cf6 (strong base, violet)
- Mini bar below value: 60px wide, 3px tall, gradient from red→green→violet
  with a small marker dot at current pH position

READOUT 3 — Pressure:
- Icon: gauge (Lucide)
- Label: "PRESS"
- Value: "1.0 atm"
- Always #94a3b8 unless abnormal (> 2 atm → amber, > 5 atm → red)

DIVIDERS: Thin vertical line rgba(255,255,255,0.06) between readouts.
Each readout section ~140px wide.
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 阶段 3：注入灵魂
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Prompt 3.1 — 化学反应动画

### 教学要点
- 这是让项目从"能用"升级到"想用"的关键
- 动画必须有物理逻辑，不是随机炫技

```
Add chemical reaction animations to the workspace.

SCENARIO: User pours NaOH (blue) into Beaker containing CuSO₄ (cyan).

ANIMATION SEQUENCE (triggered on drop):

Step 1 — Pour Animation (0-800ms):
- A stream of blue liquid flows from the NaOH source to the beaker
- Stream: 3px wide bezier curve, color rgba(59,130,246,0.8)
- Droplets: small circles (4px) breaking off the stream end
- Use Framer Motion for the path animation

Step 2 — Mixing (800ms-1600ms):
- Beaker liquid color transitions:
  From: rgba(34,211,238,0.6) (original CuSO₄ cyan)
  To: rgba(96,165,250,0.5) (mixed blue)
- Turbulence effect: liquid surface becomes wavy (sine wave, amplitude 3px)
- Small bubbles (2-4px circles) rise from bottom, varying speeds
  bubble color: rgba(255,255,255,0.15)

Step 3 — Precipitate Formation (1600ms-3000ms):
- Cu(OH)₂ precipitate appears: 
  Light blue particles (3-6px, rgba(147,197,253,0.8)) 
  generate at random positions in liquid
- Particles slowly sink to bottom (gravity simulation)
  y-velocity: random 0.5-2px/frame, slight x-wobble
- Liquid above precipitate gradually becomes clearer
- Solution color: mixed blue → semi-transparent

Step 4 — Settled State (after 3000ms):
- Bottom 20% of beaker: light blue sediment layer
- Above: slightly cloudy but mostly clear liquid
- Occasional single bubble rises (every 3-5 seconds)
- Observation Log auto-adds:
  "⚡ Cu(OH)₂ precipitate formed (light blue solid)"

INTERACTION:
- User can click the beaker to see a detail popup:
  "Cu²⁺ + 2OH⁻ → Cu(OH)₂↓"
  Formatted in JetBrains Mono with #22d3ee color
  Glass popup with subtle entrance animation (scale 0.95→1, fade in)

USE: Framer Motion for all animations. 
CSS custom properties for colors so they can be themed.
```

---

## Prompt 3.2 — 个性化空状态 & 微文案

```
Add personality to all empty/error/success states in ChemLab Pro.

EMPTY STATES:

1. Workspace (no equipment):
   Illustration: A subtle line-art beaker with a "+" symbol inside
   (stroke: rgba(255,255,255,0.06), 160px)
   Headline: "Your lab bench is empty"
   Subtitle: "Drag equipment from the sidebar to get started"
   Quick actions: 3 pill buttons —
     "🧪 Try: Acid-Base Titration"
     "🔬 Try: Precipitation Reaction"  
     "⚗️ Try: Redox Experiment"
   Button style: glass-panel, #94a3b8 text, on hover → #22d3ee

2. Observation Log (no entries):
   Icon: tiny notepad, 32px, rgba(255,255,255,0.1)
   Text: "No observations yet. Start an experiment to see the magic unfold."
   Style: centered, italic, #475569

3. Reagent Shelf (all used up):
   Text: "All reagents deployed! 🎯"
   Sub: "Reset experiment to restock"

ERROR STATES:

1. Dangerous mix warning:
   Toast notification from top, amber style:
   Background: rgba(245,158,11,0.1)
   Border-left: 3px solid #f59e0b
   Icon: alert-triangle (Lucide), color #f59e0b
   Title: "Safety Warning"
   Message: "Mixing [X] with [Y] could produce [hazard]. 
   Try a different combination? 🧑‍🔬"
   Actions: "Learn Why" (link) | "Dismiss" (ghost button)
   Auto-dismiss: 8 seconds with progress bar at bottom

2. Equipment collision:
   Subtle red outline pulse on both items
   Tooltip: "These can't be placed here — too close to [item]"

SUCCESS STATES:

1. Experiment complete:
   Confetti: 20 small cyan/emerald particles burst from center
   (Framer Motion, 800ms, gravity fall-off)
   Banner: glass-elevated panel slides down from top
   "🎉 Experiment Complete!"
   "You successfully produced [product name]"
   Buttons: "View Equation" | "Try Another" | "Save to Lab Notes"
   Banner auto-collapses to a small badge after 5 seconds

LOADING STATE:
   When calculating reaction:
   Skeleton: pulse animation on result areas
   Text: "Computing reaction..." with animated dots (... → . → .. → ...)
   Small atom icon spinning slowly (rotate 360deg, 2s, infinite)
```

---

## Prompt 3.3 — 安全警告系统

```
Design a comprehensive safety warning system for ChemLab Pro.

SAFETY INDICATOR (top bar):
- Default: green dot (pulse subtle) + "Safe" in #10b981
- Warning: amber dot (faster pulse) + "Caution" in #f59e0b
- Danger: red dot (rapid pulse + glow) + "Danger" in #f43f5e

WHEN triggered (examples):
- Mixing strong acid + strong base → Caution
  Message: "Exothermic reaction expected. Monitor temperature."
- Producing toxic gas (e.g., Cl₂) → Danger
  Message: "⚠ This would produce chlorine gas. In a real lab, 
  use a fume hood."
- Heating flammable near open flame → Danger

WARNING MODAL (for Danger level):
- Centered glass-elevated modal with red glow border
- Header: "⚠ Safety Alert" in #f43f5e, 20px semibold
- Body explains the hazard in plain language
- Chemical equation shown in mono font
- "What would happen in a real lab:" section (educational)
- Actions: 
  "Proceed Anyway (Simulation)" — ghost button, requires 
    3-second hold (progress ring around button)
  "Choose Different Reagent" — primary cyan button
  "Learn More" — text link to safety info

EDUCATIONAL OVERLAY:
- After a dangerous reaction is simulated, show a slide-up panel:
  "🧑‍🔬 Lab Safety Note"
  Explains PPE requirements, proper procedure, emergency steps
  Can be dismissed, saved to notes, or expanded
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 阶段 4：质检与打磨
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Prompt 4.1 — 一致性检查

```
Review the entire ChemLab Pro interface for consistency issues.

CHECK AND FIX:
1. COLORS: Ensure every color used exists in the design token system.
   No arbitrary grays or blues — everything maps to a named token.

2. SPACING: Verify all gaps/paddings are multiples of 4px.
   Common violations: 5px, 10px, 15px → fix to 4, 8, 12, 16px

3. BORDER RADIUS: Only use 6/8/12/16/20/9999px — no other values.

4. FONT SIZES: Only use the defined scale (12/13/14/16/18/20/24px).
   No 11px, 17px, 22px etc.

5. GLASS PANELS: All must have identical backdrop-blur (24px), 
   background opacity (0.04), and border opacity (0.08).

6. HOVER STATES: Every interactive element must have a hover state.
   Standard: translateY(-1px) or -2px + subtle glow.

7. TRANSITIONS: All transitions use 150ms ease-out for hover,
   250ms ease-out for panel animations.

8. CHEMICAL FORMULAS: All must use JetBrains Mono.
   Subscripts must render correctly (H₂O not H2O).

List every inconsistency found and fix them all.
```

## Prompt 4.2 — 响应式适配

```
Add responsive behavior for tablet (1024px) and large tablet (1280px).

BREAKPOINTS:
- ≥ 1440px: Full 3-column layout (as designed)
- 1024-1439px: 
  - Left sidebar collapses to icon-only mode (56px wide)
  - Click icon to expand sidebar as floating overlay
  - Right panel: collapses to a bottom sheet (swipe up to open)
  - Center workspace: full width
- < 1024px: 
  - Show message: "ChemLab Pro works best on larger screens. 
    Please use a tablet in landscape mode or a desktop browser."
  - Do NOT try to cram everything into phone layout

COLLAPSED SIDEBAR:
- Only show equipment icons (32px), vertically stacked
- Tooltip on hover showing equipment name
- Click to expand full sidebar as glass overlay (280px)
  - With backdrop: rgba(0,0,0,0.5)
  - Slide in from left, 250ms ease-out
```

---

# 附录：Prompt 编写速查表

## 万能结构模板

```
[1. CONTEXT] — 这是什么项目，当前在做哪个组件
[2. DESIGN TOKENS] — 粘贴颜色/间距/圆角系统
[3. STYLE KEYWORDS] — 5-8 个风格关键词
[4. COMPONENT SPEC] — 尺寸、布局、层级
[5. REAL CONTENT] — 真实文字和数据
[6. ALL STATES] — default / hover / active / disabled / loading / empty / error
[7. ANIMATION] — 具体的动效参数（duration, easing, transform）
[8. BOUNDARY] — 明确告诉 AI "只做这个，不做那个"
```

## 修正 Prompt 公式

```
❌ "This doesn't look right, make it better"
✅ "Change [具体属性] from [当前值] to [目标值] because [原因]"

例：
✅ "Change card padding from 12px to 20px — current spacing feels cramped"
✅ "Change text color from #94a3b8 to #e2e8f0 — subtitle is too dim"
✅ "Add box-shadow: 0 0 20px rgba(34,211,238,0.1) on card hover — needs glow"
```

## 风格关键词备忘

| 你想要的感觉 | 写在 Prompt 里的词 |
|-------------|------------------|
| 高端感 | premium, refined, sophisticated |
| 科技感 | futuristic, tech-forward, data-driven |
| 沉浸感 | immersive, cinematic, atmospheric |
| 玻璃感 | glassmorphism, translucent, frosted, backdrop-blur |
| 发光感 | glow, neon accent, luminescent borders |
| 呼吸感 | generous spacing, airy, breathing room |
| 专业感 | precise, utility-first, no-nonsense |
| 流畅感 | fluid transitions, spring animation, butter-smooth |
