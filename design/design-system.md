# lặng — IELTS Practice Design System (Direction C · Calm minimal)

Version 1.0 · 29/10/2026
Stack: **Tailwind CSS + shadcn/ui (Radix) + Recharts** · Icons: **Lucide**
UI labels are in Vietnamese and exam content is in English. Desktop-first (1440px), adapts down to tablet (768–1024px).

The screens are on the Design canvas, in the row "C — Bộ màn hình hoàn chỉnh". The board **C · Design system & component states** shows every state described below.

---

## 1. Principles

1. **Quiet by default.** One accent (forest green). Everything else is ink, grey and white. Colour carries meaning (correct, wrong, warning) and is never decoration.
2. **Air over boxes.** Use generous spacing and 1px borders. A card has no shadow until it can be clicked.
3. **The exam is sacred.** Exam screens (Reading, Listening, Writing) have no animation, no gamification and no colour other than state colour. They follow the generic computer-delivered IELTS structure.
4. **Never rely on colour alone.** Every state also has a shape cue: an underline, a corner flag, a strikethrough, an icon or a text label.

---

## 2. Color tokens

Tokens are named by **role**. Every text/background pair below has been checked against WCAG 2.1 AA: text ≥ 4.5:1, and UI boundaries and large text ≥ 3:1.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--background` | Page canvas behind cards | `#F4F6F8` | `#0E1412` |
| `--surface` | Cards, panels, exam panes | `#FFFFFF` | `#151C19` |
| `--surface-muted` | Inset areas, segmented-control track, disabled fill | `#EEF1F3` | `#1B2420` |
| `--surface-raised` | Popovers, menus, dialogs | `#FFFFFF` | `#1F2925` |
| `--ink` | Primary text, icons | `#13201C` | `#E6ECE9` |
| `--ink-muted` | Secondary text, labels | `#5B6670` | `#9AA8A1` |
| `--ink-subtle` | Disabled text, placeholders (still ≥ 4.5:1) | `#6B757D` | `#7D8A84` |
| `--ink-inverse` | Text on `--ink` (tooltip, current question) | `#FFFFFF` | `#0E1412` |
| `--accent` | Primary action, selected, progress fill | `#1F5E4B` | `#5FBF9A` |
| `--accent-hover` | Primary hover/pressed | `#184C3C` | `#7ACFAE` |
| `--accent-soft` | Selected backgrounds, answered question, focus halo | `#E3EFEA` | `#183329` |
| `--accent-foreground` | Text on `--accent` | `#FFFFFF` | `#0E1412` |
| `--success` | Correct answer, goal reached | `#1F7A4D` | `#4CC38A` |
| `--success-soft` | Success background | `#E4F3EA` | `#15301F` |
| `--danger` | Wrong answer, destructive, error | `#B42318` | `#F2877E` |
| `--danger-soft` | Error background, "Again" button | `#FDECEA` | `#3A1A17` |
| `--warning` | Flags, low confidence, word-count shortfall (icons/bars) | `#A8551F` | `#E7A46B` |
| `--warning-ink` | Warning **text** on `--warning-soft` | `#8A4418` | `#E7A46B` |
| `--warning-soft` | Warning background | `#FBEBDD` | `#3A2716` |
| `--info` | OCR "Question" tag, neutral info | `#1E4E8C` | `#7FAEEA` |
| `--info-soft` | Info background | `#E4ECF7` | `#172638` |
| `--border` | Card and divider lines (decorative) | `#E3E7EB` | `#26312C` |
| `--border-strong` | Input, select and question-nav outlines (≥ 3:1 on surface) | `#8B959D` | `#6E7C75` |
| `--focus-ring` | Keyboard focus outline | `#1F5E4B` | `#7ACFAE` |
| `--highlight` | Exam text highlighter | `#FFE58A` | `#5C4A12` |
| `--highlight-ink` | Text on highlight | `#13201C` | `#E6ECE9` |

**Chart series** (Recharts): Overall `--accent`; Listening `#13201C` / `#E6ECE9`; Reading `--accent`; Writing `--warning`; Speaking `#1E4E8C` / `#7FAEEA`. The target line is a 1px dashed `--ink`. The heatmap uses 4 steps: `--surface-muted` → `#BFDCCF` → `#6FA690` → `--accent` (dark: `#1B2420` → `#1F4A3B` → `#3E8A6D` → `#5FBF9A`).

Key contrast ratios: ink/surface 16.8:1 · ink-muted/surface 5.9:1 · ink-subtle/surface 4.7:1 · accent/white 7.6:1 · accent-ink/accent-soft 6.5:1 · warning-ink/warning-soft 6.2:1 · danger/danger-soft 5.8:1 · dark accent/surface 7.8:1 · border-strong/surface 3.05:1 (light) and 3.96:1 (dark).

### CSS variables

```css
/* app/globals.css */
@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&family=Lexend:wght@200;300;400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap&subset=vietnamese");

:root {
  /* surfaces */
  --background: #F4F6F8;
  --surface: #FFFFFF;
  --surface-muted: #EEF1F3;
  --surface-raised: #FFFFFF;
  /* text */
  --ink: #13201C;
  --ink-muted: #5B6670;
  --ink-subtle: #6B757D;
  --ink-inverse: #FFFFFF;
  /* accent */
  --accent: #1F5E4B;
  --accent-hover: #184C3C;
  --accent-soft: #E3EFEA;
  --accent-foreground: #FFFFFF;
  /* status */
  --success: #1F7A4D;
  --success-soft: #E4F3EA;
  --danger: #B42318;
  --danger-soft: #FDECEA;
  --warning: #A8551F;
  --warning-ink: #8A4418;
  --warning-soft: #FBEBDD;
  --info: #1E4E8C;
  --info-soft: #E4ECF7;
  /* lines */
  --border: #E3E7EB;
  --border-strong: #8B959D;
  --focus-ring: #1F5E4B;
  /* exam */
  --highlight: #FFE58A;
  --highlight-ink: #13201C;

  /* type */
  --font-sans: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Lexend", "Be Vietnam Pro", sans-serif;
  --font-reading: "Newsreader", Georgia, serif;

  /* shape */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 20px;
  --radius-full: 9999px;

  /* elevation */
  --shadow-none: none;
  --shadow-xs: 0 1px 2px rgb(19 32 28 / 0.06);
  --shadow-sm: 0 1px 2px rgb(19 32 28 / 0.06), 0 8px 24px -12px rgb(19 32 28 / 0.14);
  --shadow-md: 0 8px 24px -8px rgb(19 32 28 / 0.18);
  --ring-focus: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring);
  --ring-halo: 0 0 0 3px var(--accent-soft);

  /* motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 400ms;
  --dur-reveal: 800ms;

  /* shadcn/ui aliases (so stock components inherit the theme) */
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface-raised);
  --popover-foreground: var(--ink);
  --primary: var(--accent);
  --primary-foreground: var(--accent-foreground);
  --secondary: var(--surface-muted);
  --secondary-foreground: var(--ink);
  --muted: var(--surface-muted);
  --muted-foreground: var(--ink-muted);
  --destructive: var(--danger);
  --destructive-foreground: #FFFFFF;
  --input: var(--border-strong);
  --ring: var(--focus-ring);
  --radius: 10px;
}

.dark {
  --background: #0E1412;
  --surface: #151C19;
  --surface-muted: #1B2420;
  --surface-raised: #1F2925;
  --ink: #E6ECE9;
  --ink-muted: #9AA8A1;
  --ink-subtle: #7D8A84;
  --ink-inverse: #0E1412;
  --accent: #5FBF9A;
  --accent-hover: #7ACFAE;
  --accent-soft: #183329;
  --accent-foreground: #0E1412;
  --success: #4CC38A;
  --success-soft: #15301F;
  --danger: #F2877E;
  --danger-soft: #3A1A17;
  --warning: #E7A46B;
  --warning-ink: #E7A46B;
  --warning-soft: #3A2716;
  --info: #7FAEEA;
  --info-soft: #172638;
  --border: #26312C;
  --border-strong: #6E7C75;
  --focus-ring: #7ACFAE;
  --highlight: #5C4A12;
  --highlight-ink: #E6ECE9;
  --shadow-xs: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px -12px rgb(0 0 0 / 0.6);
  --shadow-md: 0 8px 24px -8px rgb(0 0 0 / 0.7);
  --destructive-foreground: #0E1412;
}

body {
  background: var(--background);
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

### Tailwind mapping

**Tailwind v4** (`@theme inline` in globals.css):

```css
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-surface-raised: var(--surface-raised);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-subtle: var(--ink-subtle);
  --color-ink-inverse: var(--ink-inverse);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-accent-foreground: var(--accent-foreground);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-warning: var(--warning);
  --color-warning-ink: var(--warning-ink);
  --color-warning-soft: var(--warning-soft);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-focus: var(--focus-ring);
  --color-highlight: var(--highlight);
  /* shadcn aliases */
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-card: var(--card);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --font-sans: var(--font-sans);
  --font-display: var(--font-display);
  --font-reading: var(--font-reading);
}
```

**Tailwind v3** (`tailwind.config.ts` → `theme.extend.colors`): map each token the same way, e.g. `accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)", foreground: "var(--accent-foreground)" }`, and set `darkMode: "class"`.

Usage: `bg-surface text-ink border-border`, `text-ink-muted`, `bg-accent text-accent-foreground hover:bg-accent-hover`.

---

## 3. Typography

All three families are on Google Fonts and include the **Vietnamese** subset (full support for stacked diacritics such as ệ, ữ, ặ).

| Family | Role | Weights |
|---|---|---|
| **Be Vietnam Pro** | All UI: labels, buttons, body, navigation | 300, 400, 500, 600 |
| **Lexend** | Display numbers and headings: band scores, countdown, H1/H2 | 200, 300, 400 |
| **Newsreader** | Exam content: passages, questions, essay editor, word examples | 400, 500, 600, italic 400 |

Use `font-variant-numeric: tabular-nums` on timers, counters and scores.

| Token | Font | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-2xl` | Lexend | 168 / 0.95 | 200 | −0.05em | Band on Result screen |
| `display-xl` | Lexend | 64 / 1.0 | 200 | −0.03em | Band in tiles / flashcard word (56) |
| `display-lg` | Lexend | 40 / 1.0 | 300 | −0.02em | Countdown, target |
| `h1` | Lexend | 48 / 1.1 | 200 | −0.03em | Page greeting |
| `h2` | Lexend | 28–36 / 1.2 | 300 | −0.02em | Card hero titles |
| `h3` | Be Vietnam Pro | 16 / 1.4 | 600 | 0 | Section titles, "Questions 1–5" |
| `body-lg` | Be Vietnam Pro | 16 / 1.6 | 400 | 0 | Default body |
| `body` | Be Vietnam Pro | 14 / 1.5 | 400 | 0 | Dense UI, tables |
| `label` | Be Vietnam Pro | 14 / 1.4 | 500 | 0 | Card headers (in `ink-muted`), form labels (13) |
| `caption` | Be Vietnam Pro | 12 / 1.45 | 400 | 0 | Helper text, chart axes |
| `overline` | Be Vietnam Pro | 12 / 1.3 | 600 | 0.06em uppercase | Rarely; e.g. "Mặt trước" |
| `reading` | Newsreader | 18 / 1.7 (passage), 17 / 1.55 (questions) | 400 | 0 | Exam text; user-scalable |
| `reading-title` | Newsreader | 28 / 1.25 | 600 | 0 | Passage title |
| `editor` | Newsreader | 18 / 1.75 | 400 | 0 | Writing editor |

**Exam font-size control** (`A / A / A`) scales only the reading tokens: small 16/1.65, medium 18/1.7 (default), large 21/1.7. Store the choice in user settings. It never scales the UI chrome.

Line length: passages max 640px (≈ 70ch); body copy max 520–600px.

---

## 4. Spacing, layout, radius, elevation

**Spacing scale** (4px base, matches Tailwind's default):

| Token | px | Tailwind | Typical use |
|---|---|---|---|
| `space-1` | 4 | `1` | Icon gaps in tight chips |
| `space-2` | 8 | `2` | Button icon gap, tag gaps |
| `space-3` | 12 | `3` | Inline groups, list row padding |
| `space-4` | 16 | `4` | Form field gap, small card padding |
| `space-5` | 20 | `5` | Exam pane padding (min) |
| `space-6` | 24 | `6` | Grid gap between cards, page gutter on tablet |
| `space-8` | 32 | `8` | Card padding (desktop), page gutter |
| `space-10` | 40 | `10` | Exam pane padding (desktop) |
| `space-14` | 56 | `14` | Top of page to greeting |
| `space-24` | 96 | `24` | Hero column gaps (Login) |

**Layout**
- Content max-width is 1280px (dashboard) or 1120px (result) with 32px gutters.
- Dashboard: a bento layout built with `flex flex-wrap gap-6`. Children use weighted `flex` + `basis` (e.g. `flex-[7_1_520px]`, `flex-[5_1_380px]`) so tiles reflow without breakpoints.
- Exam screens use the full viewport (`h-dvh flex flex-col`) with a fixed top bar, a scrolling split body and a fixed bottom nav. Each pane scrolls on its own.

**Breakpoints and tablet behaviour**

| Width | Behaviour |
|---|---|
| ≥ 1280 | As designed. |
| 1024–1279 (tablet landscape) | Dashboard tiles fall to 2 columns. The exam split stays side by side at 50/50 with a draggable divider. Card padding 24. |
| 768–1023 (tablet portrait) | Dashboard 1 column, with the Continue card first. Reading exam: the panes stack, and a segmented toggle "Bài đọc / Câu hỏi" in the top bar switches between them (both keep their scroll position). The question nav stays fixed at the bottom; only the current part is expanded. Writing: the prompt collapses to a 30%-height drawer above the editor. All targets are ≥ 44px. |
| < 768 | Not a target for exams. Dashboard, Result and Flashcard still work in 1 column. |

**Radius**

| Token | px | Use |
|---|---|---|
| `radius-sm` | 6 | Tags, inline exam inputs, kbd |
| `radius-md` | 8 | Question-nav buttons, radio pills, menu items |
| `radius-lg` | 10 | Buttons, inputs, selects (shadcn `--radius`) |
| `radius-xl` | 12 | Exam question cards, editor, popover |
| `radius-2xl` | 16 | Dashboard / result cards |
| `radius-3xl` | 20 | Flashcards |
| `radius-full` | 9999 | Avatars, progress bars, dots |

**Elevation.** Use borders first and shadows only where something floats.

| Token | Use |
|---|---|
| `shadow-none` + 1px `border` | All cards at rest, all exam panes |
| `shadow-xs` | Selected segment in segmented controls |
| `shadow-sm` | Clickable card on hover, flashcards |
| `shadow-md` | Popovers, select menus, highlight popup, toasts |

---

## 5. Icons

- **Lucide** (`lucide-react`) with `strokeWidth={1.75}`, `strokeLinecap="round"` and `strokeLinejoin="round"`. Use 2 for small chevrons and arrows inside filled buttons.
- Sizes: 14 (inline with 12–13px text), 16 (buttons, menus), 18 (toolbar), 20 (feature).
- Colour is `currentColor`, usually `ink` or `ink-muted`. The accent is used only on interactive or selected icons.
- Icon-only buttons always have an `aria-label`. Decorative icons get `aria-hidden`.
- Common set: `ChevronLeft/Right`, `ArrowRight`, `Clock`, `Flag`, `Volume2`, `Lock`, `HelpCircle`, `Info`, `Check`, `Highlighter`, `StickyNote`, `RotateCw`, `ZoomIn/Out`, `SlidersHorizontal`, `Flame`, `BarChart3`, `BookOpen`, `Layers`.
- No emoji anywhere in the UI.

---

## 6. Component states

Notation: `bg / text / border`. The focus-visible state is always `--ring-focus` (2px surface gap + 2px focus colour) through `focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface`, applied to every interactive element.

### Button (shadcn `Button`, variants added via `cva`)

Sizes: `sm` h32 px12 text-13 · `md` h40 px16 text-14 (default) · `lg` h48 px20 text-15 · `icon` 40×40 (44×44 on tablet).

| Variant | Default | Hover | Active | Focus-visible | Disabled | Loading |
|---|---|---|---|---|---|---|
| **primary** | accent / accent-foreground / none | accent-hover | accent-hover + translateY(0) | + ring | surface-muted / ink-subtle | spinner 16px + "Đang lưu…", `aria-busy`, width locked |
| **secondary** | surface / ink / 1px `#C9D1D8` | background / ink / border-strong | surface-muted | + ring | surface / ink-subtle / border | same |
| **ghost** | transparent / accent | accent-soft | accent-soft | + ring | transparent / ink-subtle | same |
| **danger** | danger / white | `#912018` (dark: danger at 85%) | same | + ring | surface-muted / ink-subtle | same |

Disabled buttons keep `cursor-not-allowed` and `aria-disabled`, and are never hidden.

### Input / Textarea (shadcn `Input`, `Textarea`)

| State | Style |
|---|---|
| default | h44, px14, radius-lg, bg surface, 1px `border-strong`, text ink, placeholder ink-subtle |
| hover | border `ink-muted` |
| focus | border accent + `--ring-halo` (3px accent-soft). Keyboard focus also gets `--ring-focus`. |
| error | border danger + 3px danger-soft halo. Message below in 12px danger with `aria-describedby` and `aria-invalid="true"`. |
| disabled | bg surface-muted, border `border`, text ink-subtle |
| read-only | bg surface-muted, border none |

Exam blank inputs: h34, radius-sm, width 160 (grows to fit), `font-sans` 15px inside `reading` text, `vertical-align: middle`. An answered blank has an accent border. No halo in the exam except on focus.

### Select (shadcn `Select` on Radix)

| State | Style |
|---|---|
| trigger default | Same as input, with a chevron-down 16px in ink-muted |
| trigger open | accent border + halo, chevron-up |
| menu | surface-raised, radius-lg, 1px border, shadow-md, padding 4 |
| item default / hover(highlighted) | transparent / surface-muted |
| item selected | accent-soft bg, accent text, 500 weight, `Check` icon on the right |
| item disabled | ink-subtle, strikethrough (used for headings already chosen in Matching Headings) |

### Tag (shadcn `Badge`, variants)

h24, px8, radius-sm, 12px/600.

| Variant | Style | Use |
|---|---|---|
| `source-cam` | accent / accent-foreground | CAM |
| `source-vol` | accent-soft / accent | VOL |
| `source-pre` | surface / `#3B464F` / 1px `#C9D1D8` | Pre-IELTS |
| `neutral` | surface-muted / ink | Skill names |
| `success` | success-soft / success | "Đã đạt" |
| `warning` | warning-soft / warning-ink | "Cần luyện", "Chờ duyệt" |
| `danger` | danger-soft / danger | "Sai" |
| OCR tags | Bài đọc: accent-soft/accent · Câu hỏi: info-soft/info · Đáp án: warning-soft/warning-ink · Hướng dẫn: surface-muted/ink-muted · Bỏ qua: surface + strikethrough | Always show the text label and a coloured square |

### Tooltip (shadcn `Tooltip`)

bg `ink`, text `ink-inverse`, 12px/1.45, radius-md, padding 8×10, max-width 240, no arrow or a 6px arrow. Open delay 400ms, close 0ms. It opens on focus as well as hover. Never put essential information only in a tooltip. Not used inside exam screens, except on icon buttons in the top bar.

### Progress bar (shadcn `Progress`)

| Variant | Track | Fill | Height |
|---|---|---|---|
| default | surface-muted | accent | 4px |
| large | surface-muted | accent | 8px |
| success (goal reached) | surface-muted | success | 4px |
| warning (under word count) | surface-muted | warning | 4px |
| on-accent (inside accent card) | white 20% | white | 4px |

Optional target marker: a 1px × 14px `ink` tick at the target position. Always set `role="progressbar"` with `aria-valuenow/min/max` and `aria-label`.

### Question-nav button (custom, built on `Button` / Radix `ToggleGroup` semantics)

40×40, radius-md, 14px. States combine. For example, answered + flagged shows both cues.

| State | Background | Text | Border | Extra cue |
|---|---|---|---|---|
| **unanswered** | surface | ink, 400 | 1px border-strong | — |
| **answered** | accent-soft | accent, 600 | 1px accent-soft | 3px inset bottom bar in accent (`shadow-[inset_0_-3px_0_var(--accent)]`) |
| **flagged** (combines with either) | — | — | — | 12px warning corner triangle top-right |
| **current** | ink | ink-inverse, 600 | 2px ink | `aria-current="true"`, no underline |
| **focus-visible** | as state | as state | as state | + `--ring-focus` |
| **collapsed part** | surface-muted | ink | 1px border | Label "Part 2 · 0/13". Click expands that part. |

`aria-label` pattern: `"Câu 4, chưa trả lời, đã đánh dấu"`. Keyboard: ←/→ moves between questions; Enter jumps to the question.

### Card (shadcn `Card`)

| State | Style |
|---|---|
| rest | surface, 1px border, radius-2xl, padding 32 (24 tablet), no shadow |
| hover (only if the whole card is a link) | border `#C9D1D8`, shadow-sm, cursor pointer |
| selected | 2px accent border |
| focus-visible (link card) | `--ring-focus` |
| emphasis | accent bg, accent-foreground text (one per screen max: "Tiếp tục bài đang làm") |

Card headers use `label` 14/500 in ink-muted. The key number in a card uses Lexend 300.

### Exam-specific components

- **Top bar** (h60): left shows source tag + test title + candidate name. Centre shows the timer ("38 phút còn lại", Lexend tabular) with a "Ẩn" toggle; at ≤ 5 minutes it turns `warning` and adds a `Clock` icon, with no blinking. Right holds the font-size segmented control, Help and "Nộp bài" (primary).
- **Instruction strip**: background colour, 14px, e.g. "Part 1 — Read the text and answer questions 1–13."
- **Split view**: passage | 1px divider with a 17×44 drag handle (`cursor: col-resize`, keyboard ←/→ resizes in 5% steps) | questions. Each pane scrolls independently.
- **Paragraph labels**: A, B, C… in Be Vietnam Pro 15/600, set in a 28px gutter beside each paragraph.
- **Highlight popup** (Radix `Popover` anchored to the selection): bg ink, radius-lg, padding 4, shadow-md. Three 36px buttons: "Tô sáng" (with a highlight swatch), "Xóa", "Thêm ghi chú". It appears instantly with no animation. Highlights use `--highlight` with a 2px spread. A note marker is a dotted `warning` underline plus a superscript "ghi chú".
- **T/F/NG**: a fieldset with three radio pills (h36, radius-md). Selected = accent-soft bg, accent border, accent 600 text.
- **Matching Headings**: a "List of Headings" panel on surface-muted. Each paragraph row has a Select (w200). Headings already used are struck through in the list and the menu.
- **Listening audio strip**: In exam mode the play/pause icon is display only, the progress cannot be seeked, part ticks sit at 25/50/75%, the volume slider is enabled, and a lock badge reads "Chế độ thi". Practice mode (outside exams) adds pause, ±5s, speed 0.75–1.25×.
- **Writing editor**: Newsreader 18/1.75 with autosave every 10s ("Đã lưu nháp · 21:42"). The live counter (Lexend tabular) has a progress bar against 150/250 and turns `warning` with "Cần thêm N từ" under the minimum. There is a "Ẩn bộ đếm" toggle. No spell check, no formatting.

---

## 7. Charts (Recharts)

- `LineChart` for band trend: `strokeWidth={2}`, `type="linear"` (no smoothing, so band steps read honestly), dots r=0 except the last point (r=5, accent). Add `ReferenceLine y={7}` with `strokeDasharray="2 5"` in ink. Y domain is `[5, 7.5]` with ticks every 0.5.
- Area fill is accent-soft at 60%, only for the single-series Overall chart.
- Grid: horizontal lines only, colour `#EEF1F3` (dark `#1B2420`). No vertical grid. Axis text is 12px ink-muted; no axis lines.
- Tooltip: the shadcn `ChartTooltip` look (surface-raised, border, shadow-md, radius-lg).
- Heatmap: a CSS grid (`grid-rows-7 grid-flow-col auto-cols-[13px] gap-1`). Recharts isn't needed. Each cell has a `title`/`aria-label` with the date and minutes.
- Bars (accuracy by type): plain `div` progress bars. `BarChart` is only for more than 8 categories.
- Every chart has a text alternative: an `aria-label` with the key takeaway, plus a visually hidden data table.

---

## 8. Motion

Durations: fast 120ms (hover colour), base 200ms (popover, tab), slow 400ms (flip, bars), reveal 800ms (band count-up).
Easing: `--ease-out` for entering; `--ease-in-out` for state changes.

### Allowed (study and dashboard screens only)

| Where | What | Spec |
|---|---|---|
| Result | Band score count-up | 0 → 7.0 in 0.5 steps over 800ms ease-out, then a 1px scale settle (1.02 → 1) over 200ms. `aria-live` announces the final value only. |
| Result / Dashboard | Progress bars fill | width 0 → value, 400ms ease-out, staggered 40ms, maximum 6 bars |
| Flashcard | Card flip | `rotateY` 180°, 400ms ease-in-out, `backface-visibility: hidden`. The grade buttons fade in after the flip (120ms). |
| Flashcard | Next card | Outgoing card translates 16px and fades over 200ms; the incoming card fades in |
| Pages (non-exam) | Page reveal | Content opacity 0 → 1 + translateY 8px → 0, 200ms. Each card staggered 30ms, capped at 6. |
| Global | Hover / press colour | 120ms colour/background transitions only |
| Popovers / menus | Open | Radix data-state: fade + scale 0.98 → 1, 120ms |

### Forbidden

- **Everything inside Reading, Listening and Writing exam screens:** no page transitions, no fades, no count-ups, no hover lifts, no skeleton shimmer, no timer pulse. State changes (answered, flagged, current, highlight) apply **instantly**. The only allowed visual change over time is the timer text itself.
- Admin OCR: no decorative motion, because it is a productivity tool. Allowed: instant scroll-into-view of the linked block, without smooth scroll.
- Never anywhere: confetti, bouncing, parallax, looping animations, auto-playing anything, shake on wrong answers.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

In JS, the count-up renders the final value immediately and the flashcard swaps faces with a 120ms cross-fade (opacity only) instead of a 3D rotation. Add an exam wrapper class that hard-disables motion regardless of OS setting:

```css
.exam-mode *, .exam-mode *::before, .exam-mode *::after {
  transition: none !important;
  animation: none !important;
}
```

---

## 9. Accessibility checklist

- All text pairs ≥ 4.5:1. Input, select and question-nav outlines ≥ 3:1 (`--border-strong`). `--border` is decorative only.
- A visible `:focus-visible` ring on every interactive element. Never use `outline: none` without a replacement.
- Touch targets ≥ 44×44 on tablet. Question-nav is 40×40 on desktop and 44×44 below 1024px.
- States are never shown by colour alone (underline, corner flag, strikethrough, icon, text).
- Exam: the timer uses `role="timer"` with `aria-live="off"`; announce only at 10 and 5 minutes with a polite live region. Radio groups use `fieldset`/`legend`. Blanks have `aria-label="Question 12"`.
- Keyboard: `Tab` order is top bar → passage → questions → nav. Shortcuts (single keys) are active only when focus isn't in a text field: `F` flag, `N`/`P` next/previous, `Space` flip card, `1–4` grade card, `J/K` OCR blocks.
- `lang="vi"` on the document and `lang="en"` on exam content containers, so screen readers switch pronunciation.
- Font sizes in `rem`. The exam font control plus browser zoom up to 200% keeps the layout usable (the panes stack).

---

## 10. Screen inventory (Design canvas)

| Board | Notes |
|---|---|
| C · Login | No card; two-column welcome + form; stats strip |
| C · Dashboard | Greeting + target/countdown, Continue (accent), band per skill with target tick, trend, weak types, heatmap, suggested tests (CAM / VOL / Pre-IELTS) |
| C · Result | Band 7.0 (count-up), 31/40, time, accuracy by type, time per passage vs recommended, wrong answers (yours → correct) |
| C · Reading exam | Split view, T/F/NG + Matching Headings + Sentence completion, highlight popup, nav 1–13 expanded + Parts 2–3 collapsed |
| C · Listening exam | Locked exam-mode audio strip, notes completion + MCQ, nav for Part 2 |
| C · Writing | Prompt + chart placeholder left; editor, live word count, timer, autosave |
| C · Vocabulary flashcard | Front/back, review buttons Lại / Khó / Được / Dễ with intervals and 1–4 keys |
| C · Admin OCR review | Original scan with tagged regions; editable blocks with tags, confidence and low-confidence words; tag / merge / split tools |
| C · Design system & component states | Visual reference for everything in this file |

The exam passages and questions on the boards are original placeholder content written for the mockups. They are not copied from any published test.
