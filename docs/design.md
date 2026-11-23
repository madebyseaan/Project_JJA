# Design System — Service Ledger

**Status:** Approved direction for phase 1
**Applies to:** every screen in the shop app

---

## 1. Concept

A precision workshop instrument, not a SaaS dashboard.

The app should feel like the tools on a mechanic's bench: durable, legible, quick to read, and deliberately laid out. The visual language borrows from service manuals, job slips, machine plates, and workshop signage — not from startup landing pages.

Three ideas drive every screen:

1. **The day is a ledger.** Orders are rows on a dated sheet, not a grid of cards.
2. **Money, labor, and GCash are the hero numbers.** They are large, tabular, and easy to scan.
3. **One accent, used with intent.** Safety orange marks the action, the focus, and the thing that needs attention. Everything else is paper, ink, and steel.

**Brand:** J.J.A Motor Accessories and Motorcycle Repair Shop (Est. 2023). The logo is the circular gear badge in `public/brand/jja-logo.jpg`. The app keeps the Service Ledger palette; the logo's red, blue, and gold appear only as small identifiers — the capability icons, the blueprint-grid tint, and the footer stripe. They never become action colors.

---

## 2. Palette

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F1F2EE` | App background |
| `surface` | `#FFFFFF` | Sheets, inputs, receipt |
| `ink` | `#12181A` | Primary text, primary button text |
| `ink-soft` | `#3A4448` | Secondary text |
| `steel` | `#66727A` | Muted text, icons, meta |
| `line` | `#CDD2CC` | Borders, dividers |
| `line-strong` | `#A9B0A8` | Strong rules |
| `safety` | `#E84E1B` | Brand accent, focus, primary actions |
| `safety-dark` | `#B83A10` | Pressed primary |
| `blueprint` | `#245B78` | Informational links, in-progress |
| `ok` | `#2E7D4F` | Ready, success |
| `warn` | `#A66A00` | Verifying, warning |
| `danger` | `#B3261E` | Errors, void, cancel |
| `brand-red` | `#E21B1B` | Logo hint: Orders icon and footer stripe only |
| `brand-blue` | `#2647C9` | Logo hint: Items icon, blueprint-grid tint |
| `brand-gold` | `#F5B301` | Logo hint: Reports icon, footer stripe |

Rules:

- No gradients, glass effects, or soft grey card shadows. The logo may contain gradients; the UI does not.
- No second **action** accent. Safety orange is the only color used for primary actions and focus. The logo's red, blue, and gold are detail accents only.
- Status is always paired with a text label. Color alone never carries meaning.
- The receipt uses `surface` on a `paper` background, with a dashed perforation rule.

---

## 3. Typography

| Role | Family | Weights |
|---|---|---|
| Display, headings, order numbers | **Barlow Condensed** | 600, 700 |
| UI, body, labels | **Barlow** | 400, 500, 600, 700 |
| Receipt and order numbers | **IBM Plex Mono** | 500 |

Rules:

- Money uses tabular numerals: `font-variant-numeric: tabular-nums`.
- Base body: 16px / 1.55.
- Display: 1.0–1.1 line height, slight negative tracking (−0.01em to −0.02em).
- Scale: 12, 14, 16, 18, 20, 24, 28, 36, 48.
- Sentence case everywhere except codes and order numbers. No all-caps eyebrows.
- Avoid accenting a single word in a headline with italic, bold, or color.
- Maximum body line length: 70 characters.

---

## 4. Layout

### Mobile

```text
┌─────────────────────────────┐
│ SHOP NAME        ● online 🔒│  top bar
├─────────────────────────────┤
│                             │
│  SL-…   Jose        ₱600    │  order rows
│  Honda Click    Open        │
│                             │
│  SL-…   Walk-in     ₱1,250  │
│  Yamaha Mio     Open        │
│                             │
├─────────────────────────────┤
│  [   + New order   ]        │  primary action
├─────────────────────────────┤
│ Orders   Items  Reports  ⚙  │  bottom tabs
└─────────────────────────────┘
```

- Top bar: shop name, signed-in staff name (truncated), connection status, install, lock.
- Bottom tabs: Orders, Items, Reports, Settings.
- Primary actions are 56px tall; other targets are at least 48px.
- The daily orders screen shows summary numbers first, then the dated order list.
- The job form uses Customer, Items, and Labor with a prominent Job total. If labor is zero and there is an item, a **Payment now** box collects Cash or GCash and **Save & record payment** completes the sale; Pay later saves an open job. Otherwise, payment is a separate step with Payment date, Payments, automatic Change, then optional Extras.
- The phone shell is a `100dvh` flex column: safe-area top, fixed header, one scrollable main area, bottom tabs as the last flex child. The tabs are not a fixed overlay, so browser chrome changes cannot leave a gap or make them jump.
- Safe areas: header padding uses `env(safe-area-inset-top)`; the tab bar fills `env(safe-area-inset-bottom)` with its own background.
- Mobile form controls render at 16px to stop iOS focus zoom. Pinch zoom is never disabled.
- The installed app suppresses rubber-band overscroll and pull-to-refresh.

### Desktop

- Left rail: brand mark, nav, staff name, connection status, lock, sign out. Width 220px.
- Content max-width 1280px.
- Orders: Open jobs first, then paid sales with the payment-date picker and summary strip.
- Job form: form on the left, sticky Job total card on the right at `lg`; summary first on mobile.
- Order detail: Order and Payment tabs; the same total card in each.
- Reports: summary strip, paid-date table, and an optional labor breakdown.
- GCash: a two-up balance board on desktop, stacked cards on mobile.

### Key screens

- **Orders:** two clearly separate boxes. **Open jobs** is amber-accented with a count, unpaid total, Take payment, and a confirmed Delete. **Paid sales** is a separate neutral box with the payment-date picker, summary tiles, labor per person, and paid rows. Status is always a text badge.
- **Job form:** customer/date block; searchable items with per-order price; custom line dialog; labor split; **Job total card** (parts + labor) always visible. With no labor and at least one item, a **Payment now** card shows Cash pre-selected, the total prefilled, GCash, and Pay later; the card becomes **Payment total** and the primary action is **Save & record payment**.
- **Order detail:** Order and Payment tabs. Payment tab has payment date, mixed payments, automatic change, optional extras, and the total/balance card. An open job shows Delete job; a paid order shows a green **Receipt ready** banner with Share receipt. After a payment, a **Payment recorded** modal shows the amount, change, and receipt actions.
- **Items:** searchable catalog, right-aligned prices, no stock. Import dialog with a preview and skipped-row count.
- **Reports:** month picker, six paid summary tiles, paid-date table with a month total, and a full-breakdown labor panel.
- **GCash:** shop-held banner, per-person balances, transfer dialog, recent history.
- **Share receipt:** dialog fits the viewport, scrolls vertically, wraps the full link, and scales the QR code. On phones the footer buttons are full-width. Never clip the link or the description.
- **Digital receipt:** white sheet, shop header, order number, items, labor, optional tip, total charged, payments, change, net paid, QR. No internal split.
- **Legacy receipt and verify:** retained for old links only.
- **Login:** split at 768px. Left: the J.J.A badge at the top; a faint blue-tinted blueprint grid behind the panel; an intentional safety-orange block behind “The day,”; the headline scales with `clamp(3.25rem, 6vw, 7rem)`; the subtitle is at most 26rem wide; a capability row (Orders, Items, Reports) uses the logo's red, blue, and gold icons; the footer has a tri-color stripe, `J.J.A · Est. 2023`, and a live Manila clock. Right: a bordered staff sign-in sheet, centered, max-w-md and max-w-lg at `xl`; a lock header (“Staff portal”), a 48px employee ID field with a user icon, a password field with a lock icon and an eye toggle, a 56px primary button with a spinner state, an error row with an alert icon, and a “Need access?” footer. Below 768px: a compact brand header with the badge, the shop name, and the clock, then the same sheet in one column.
- **Lock:** large PIN pad, 64px keys, staff name, Manila time.

---

## 5. Components

- **Radius:** 4px for labels/inputs, 8px for buttons/sheets. Do not pill everything.
- **Borders:** 1px `line`. No soft shadows. The primary button uses a 2px hard offset shadow in `safety-dark` and translates 2px on press.
- **Primary button:** `safety` background, `ink` text, 48px minimum (56px for the main action).
- **Secondary button:** `surface` background, 1px `line`, `ink` text.
- **Destructive action:** `danger` text/border; confirm through an alert dialog.
- **Status badge:** small 4px radius, 1px border, 6px dot, sentence-case label. Open steel, exported ok, warning/difference danger outline.
- **Inputs:** 48px tall, 1px `line`, 4px radius. Focus: 2px `safety` ring, 2px offset.
- **Tables:** 1px rules, no zebra stripes. Header 13px medium steel. Money right-aligned, tabular.
- **Sheets/dialogs:** white surface, 8px radius, 1px border, no backdrop blur.
- **Empty state:** short text plus the next action. Never a decorative illustration that pushes the action below the fold.
- **Loading:** skeletons shaped like the content. Not a centered spinner.
- **Icons:** lucide, 20px; 24px in navigation. 2px stroke.
- **Brand mark:** the J.J.A circular gear badge from `public/brand/jja-logo.jpg`, clipped to a circle on paper. One mark, used in the rail, login, loading, and setup screens.

---

## 6. Motion

- One orchestrated moment per screen at most.
- Order rows and report rows slide/fade in at 120ms when the date changes.
- Status changes animate the progress rule, not the whole page.
- Primary buttons press down 2px and drop their hard shadow.
- Respect `prefers-reduced-motion`; disable transforms and transitions.
- No fade-up entrances on every section; no hover animation on every card.

---

## 7. Copy

- Verbs, sentence case: "New order", "Add item", "Custom line", "Add payment", "Delete job", "Take payment", "Record payment", "Record transfer", "Save order", "Save & record payment", "Pay now", "Pay later", "Done", "Import item list".
- A button and its result use the same verb: “Save order” → “Order saved.”, “Import item list” → “Item list imported.”
- Errors say what happened and what to do: “Payment is short by ₱20.00.”, “Choose who received each GCash payment.”
- Empty states invite action: “No jobs waiting for payment.” and “No paid sales on this date.”
- No “Submit”, “OK”, “An error occurred”, or exclamation marks.
- Receipt language: “Sales receipt”, not “Official Receipt”, unless the BIR registration exists.

---

## 8. Accessibility

- Contrast: body text at least 4.5:1; large text at least 3:1.
- Focus ring: 2px `safety`, 2px offset, visible on every interactive element.
- Every input has a label. Errors are inline and announced with `aria-live`.
- Touch targets at least 48px; 8px minimum spacing between adjacent targets.
- No color-only status. No icon-only primary actions.
- Keyboard: the PIN pad, dialogs, sheets, and tables are fully operable.
- Test at 360px width and at 200% zoom.

---

## 9. Why this is not the default generated look

- The palette is cool paper, blue-black ink, steel, and safety orange — not cream and terracotta, not near-black and acid green.
- The layout is a dispatch board and a work-order sheet, not a grid of identical rounded cards.
- The type is condensed industrial signage, not a high-contrast serif or a generic SaaS sans.
- There are no all-caps eyebrow labels, no meta strings joined by middle dots, no monospace labels, and no arrow appended to every link.
- The receipt is a trust artifact with a perforation rule and a clear “not a BIR Official Receipt” line, not a decorative card.
- The one bold element is the safety-orange action; everything around it stays quiet.

---

## 10. Implementation notes

- Tokens live in `src/styles/globals.css` under `@theme`.
- Fonts are self-hosted through `@fontsource/barlow`, `@fontsource/barlow-condensed`, and `@fontsource/ibm-plex-mono`.
- shadcn/ui primitives live in `src/components/ui`; do not hand-roll buttons, dialogs, sheets, or inputs.
- The `Button` primitive has a `size="touch"` variant (48px).
- `StatusBadge` is the only place that maps order status to a label and color.
- `BrandMark` is the only brand illustration.
- Never use hardcoded hex values in a component; use the CSS variables.
