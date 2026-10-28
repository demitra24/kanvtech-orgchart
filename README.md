# KanvTech · Organization Chart

An interactive employee organization chart for **KanvTech**, built as a static
website with plain **HTML, CSS and JavaScript** — no frameworks, no build step,
no backend server required.

It renders all **125 employees** across **5 reporting levels** from the official
employee list (`OrgChartFile.xls`) as a collapsible tree diagram, with search,
filters, a sortable directory, and print-ready output for every view.

---

## Features

| Area | What it does |
|------|--------------|
| **Org Chart** | Full reporting tree with connector lines. Press a `+N` badge to open/close any team. Zoom 50–150 %, expand/collapse all. |
| **Directory** | Sortable table of every employee (code, name, reports-to, level, branch, team sizes). Click a row for the full profile. |
| **Employee profile** | Click any card/row — details, clickable reporting chain, direct reports, and a **Print Profile** button that outputs a clean one-page A4 sheet. |
| **Search** | Live search by name or employee code — matching cards are highlighted and their managers auto-expand. |
| **Filters** | Branch filter (level-2 branches) and level filter (1–5), combinable. |
| **Print ▾** | Print the whole organization chart (A4 landscape) or the full employee directory (A4 portrait). |
| **About** | In-app guide for reviewers. |
| **Responsive** | Works on desktop, tablet and mobile (hamburger menu on small screens). |

---

## Folder structure

```
kanvtech-orgchart/
├── index.html          ← page structure (navbar, views, modals)
├── css/
│   └── style.css       ← all styling incl. print stylesheets
├── js/
│   ├── data.js         ← employee data (generated from OrgChartFile.xls)
│   └── app.js          ← rendering, search, filters, printing logic
└── data-preview.json   ← same data in JSON form (for reference)
```

## Run it in VS Code

1. Open the `kanvtech-orgchart` folder in VS Code (**File → Open Folder**).
2. Pick any one of these ways to preview:
   - **Live Server extension** (recommended): install *Live Server* from the
     Extensions marketplace → right-click `index.html` → **Open with Live Server**.
   - **Terminal**: `npx serve .`  (then open the shown URL, e.g. `http://localhost:3000`)
   - **Python**: `python -m http.server 8000` → open `http://localhost:8000`
3. Edit any file, save, refresh. There is nothing to install or compile.

> Opening `index.html` directly by double-clicking also works — the site has no
> server-side dependencies.

## Editing the data

All employees live in `js/data.js` as one JavaScript object:

```js
{
  "id": "347",                       // employee code (unique)
  "name": "Pratik Janardan Patil",
  "headId": "M01",                   // code of the reporting head ("M01" = top head)
  "level": 2,                        // hierarchy level 1–5
  ...
}
```

- To add a person, append an object with a unique `id` and the correct `headId`.
- `directReports`, `teamSize`, `branchId`, `branchIdx` and `chain` are
  pre-computed values used by the UI — update them to match, or keep additions
  consistent with the surrounding entries.
- Colour of each branch is picked automatically from the palette at the top of
  `js/app.js` (`PALETTE`).

---

## Deploy it live (recommended: Netlify Drop)

Because this is a **100 % static site**, free static hosts serve it instantly —
**no cold starts, no "Render spinning screen", ever**. The link opens fast even
if nobody has visited it for weeks.

### Option A — Netlify Drop (fastest, ~2 minutes, no Git needed)

1. Go to <https://app.netlify.com/drop> (free sign-up).
2. Drag the whole `kanvtech-orgchart` folder onto the page.
3. Done — you get a live link like `https://your-name.netlify.app`.
   You can rename it under *Site settings → Change site name*.

### Option B — GitHub Pages

1. Create a repository on GitHub and upload the folder contents.
2. Repo **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. Your link: `https://<username>.github.io/<repo-name>/`

### Option C — Vercel

1. <https://vercel.com> → *Add New → Project* → import the Git repo
   (or use `npx vercel` inside the folder).
2. Framework preset: **Other**. Deploy — instant link.

### ⚠️ Why NOT Render / Railway free tier for this project

Those platforms host *server processes* and put them to sleep when idle; the
next visitor waits ~30–60 s on a boot screen (the cold-start problem you saw).
This site needs **no server at all** — static hosts keep it warm permanently.

---

## Why there is no backend (by design)

The assignment data is a fixed employee list, so the data is embedded in
`js/data.js` and served as a static file. That removes the entire class of
problems a backend brings on free hosting: cold starts, uptime limits, database
configuration — while keeping the site fully interactive (search, filters and
printing all run client-side). If KanvTech later wants live HR data, the same
UI can be pointed at a real API by replacing the `ORG_DATA` constant with a
`fetch()` call — nothing else in the code needs to change.

---

## Printing — real paper from a real printer

The site prints through your **browser's native print dialog** — the same
mechanism every website uses for physical printing (railway tickets, airline
boarding passes, bank statements). The full flow:

1. Open any employee → **Print Profile** → a **Print Preview** opens showing
   the exact A4 sheet that will be printed (letterhead, details table,
   reporting chain, direct reports).
2. Press **Send to Printer** → the browser's print dialog opens.
3. In **Destination**, select your **physical printer** (HP, Canon, Epson,
   office network printer…) → click **Print** → the page comes out of the
   printer on real paper.

Good to know:

- **"Save as PDF" is not the feature** — it is only the *default destination*
  on many devices. One click on the Destination dropdown switches it to your
  real printer. Browsers always show this dialog for security; a website is
  never allowed to silently grab a printer, which is exactly why this flow is
  trustworthy enough to be the universal standard.
- **Print ▾ → Organization chart / Employee directory** also send real print
  jobs (A4 landscape / portrait). For a very large wall chart, "Save as PDF"
  plus a print shop is still the best route.
- **Printer not listed in the dialog?** Connect it (USB / Wi-Fi) and make sure
  it is set up in your OS first — Windows: *Settings → Bluetooth & devices →
  Printers & scanners*; macOS: *System Settings → Printers & scanners* — then
  reopen the dialog.
- **Colours look missing in the print?** In the dialog open *More settings*
  and tick **"Background graphics"**.
- Bonus: pressing **Ctrl+P / Cmd+P** anywhere on the site also produces a
  clean, formatted sheet instead of a raw page dump.

---

## Tech notes

- Pure HTML5 / CSS3 / ES6 JavaScript — zero dependencies, zero build step.
- Tree connectors are pure CSS (`::before` / `::after`), so the chart stays
  crisp at any zoom level.
- Fonts: Fraunces (headings) + Manrope (body) from Google Fonts, with system
  fallbacks so the site still looks right fully offline.
- Accessible: keyboard navigable cards, ARIA roles/labels, Escape closes dialogs.

Data source: `OrgChartFile.xls` (125 employees, 5 levels, 13 branches) —
validated: no duplicate codes, no missing managers, levels verified against the
actual hierarchy depth.
