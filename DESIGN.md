---
name: High-Density Developer Interface
colors:
  surface: '#101419'
  surface-dim: '#101419'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#181c21'
  surface-container: '#1c2025'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e0e2ea'
  on-surface-variant: '#c0c7d3'
  inverse-surface: '#e0e2ea'
  inverse-on-surface: '#2d3136'
  outline: '#8b919d'
  outline-variant: '#414751'
  surface-tint: '#a1c9ff'
  primary: '#a1c9ff'
  on-primary: '#00325a'
  primary-container: '#4494e7'
  on-primary-container: '#002b4f'
  inverse-primary: '#0060a8'
  secondary: '#f1c04c'
  on-secondary: '#3f2e00'
  secondary-container: '#b58a17'
  on-secondary-container: '#372700'
  tertiary: '#ffb86f'
  on-tertiary: '#492900'
  tertiary-container: '#cf7e11'
  on-tertiary-container: '#402300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a1c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004880'
  secondary-fixed: '#ffdf9e'
  secondary-fixed-dim: '#f1c04c'
  on-secondary-fixed: '#261a00'
  on-secondary-fixed-variant: '#5b4300'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#ffb86f'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#101419'
  on-background: '#e0e2ea'
  surface-variant: '#32353b'
typography:
  ui-label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  ui-label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  ui-label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  header-title:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  sidebar_width: 260px
  header_height: 48px
  tab_height: 36px
---

## Brand & Style

The design system is engineered for professional-grade developer tools, emphasizing speed, utility, and information density over decorative flair. It is a strictly utilitarian framework designed for environments where efficiency and precision are paramount.

The aesthetic is **Minimalist-Technical**, drawing heavy influence from modern IDEs (Integrated Development Environments) and terminal emulators. It utilizes a "chrome-first" philosophy where the interface recedes to let the data and code take center stage. Every element is intentional; there are no shadows, no gradients, and no rounded corners that aren't functional. The visual language conveys a sense of rigorous logic and reliability, essential for tools managing complex workflows, API testing, or systems administration.

## Colors

This is a **native dark-mode system**. The palette is optimized for long periods of high-focus work, reducing eye strain through low-frequency background tones.

- **Surface Logic:** `Background Primary` is reserved for the main editor or canvas. `Secondary` is used for sidebars and navigation, while `Tertiary` is used for active tabs, header bars, and modal overlays.
- **Borders:** A single, consistent `Border` color (#30363D) is used for all structural separation, ensuring the UI feels cohesive and rigid.
- **Interaction:** The `Accent Blue` is used sparingly for primary actions and focus states.
- **Semantic Badges:** Method colors (GET, POST, etc.) use a 12-20% opacity background of their respective hex code to ensure high legibility against the dark surfaces while maintaining a clear categorical distinction.

## Typography

The typography system prioritizes legibility and vertical alignment. 

- **UI Elements:** Use `Inter` for all labels, menus, and navigation. Sizes are kept small (11px–12px) to maximize the amount of information visible without scrolling.
- **Data & Code:** Use `JetBrains Mono` for all user-generated content, keys, values, URLs, and code blocks. The increased x-height and distinct character shapes of JetBrains Mono are critical for distinguishing similar characters (e.g., 0 and O).
- **Hierarchy:** Weight is used instead of size to denote hierarchy. High-level headers rarely exceed 14px.

## Layout & Spacing

This design system uses a **fixed-density grid** based on 4px increments. Layouts are strictly partitioned using 1px solid borders rather than whitespace to separate concerns.

- **Panels:** The interface follows a classic 3-pane IDE layout: Sidebar (navigation/tree), Main Stage (editor/workspace), and Bottom Panel (logs/terminal).
- **Density:** Padding within list items, table rows, and tree nodes is locked to `4px` vertical and `8px` horizontal.
- **Scrollbars:** Custom, thin (6px) scrollbars that appear on hover to minimize visual clutter.
- **Margins:** External margins are non-existent; the UI should sit flush against the window edges.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and **Borders**, never shadows.

- **Level 0 (Deepest):** Primary background (#0F1117) for the main workspace.
- **Level 1:** Secondary background (#161B22) for sidebars and inactive tabs.
- **Level 2:** Tertiary background (#1C2128) for active states, hover states, and input fields.
- **Level 3 (Highest):** Context menus and tooltips use Tertiary background with a slightly brighter border (#424D5B) to separate them from the underlying UI.

There is no "float" in this design system. Every element is physically part of the grid.

## Shapes

The shape language is rigid and architectural. 

- **Corner Radius:** A universal `2px` (Soft, level 1) radius is applied to buttons and inputs to prevent a "sharp" feel, but internal components like tabs, sidebars, and panels use `0px` radius to maintain the structural grid.
- **Interactive States:** Hover states on list items or tree nodes should be full-bleed rectangles with no border radius.

## Components

- **Tabs:** Square corners. Active tabs have a top 2px border in `Accent Blue`. Inactive tabs have a semi-transparent text color.
- **Tree View:** 16px indentation per level. Use a 12px chevron icon for expansion. Active file/node uses `Background Tertiary` and a left-accent 2px `Accent Blue` border.
- **Input Fields:** Background `Background Primary`, 1px border `Border`. On focus, the border changes to `Accent Blue`. No glow.
- **Buttons:** 
    - **Primary:** Background `Accent Blue`, Text `White`, 2px radius.
    - **Secondary:** Background `Background Tertiary`, Border `Border`, Text `Text Primary`.
- **Status Pills:** Small, 10px font-size, mono weight. Backgrounds use 20% opacity of the status color with a 100% opacity text color.
- **Key-Value Tables:** Alternating row highlights are not used; instead, use 1px horizontal dividers. Keys are `Text Secondary` in Mono, values are `Text Primary` in Mono.
- **Checkboxes:** Small (14px), square, with an `Accent Blue` fill when checked.