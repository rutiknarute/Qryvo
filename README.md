# Searchdesk

A private, browser-based LinkedIn Boolean Search Dashboard built from the supplied PRD, JSON catalogue, and 32-link CSV fixture.

## Run locally

Requires Node 22.12 or newer.

```sh
npm install
npm run dev
```

Open the printed local URL. Production build: `npm run build`. Run the data and DOM interaction tests: `npm test`.

## Features

- All 16 original company groups, 980 company references, and 839 distinct IDs.
- Two exact original Boolean presets, including duplicate terms and punctuation.
- Separate batch searches by default; optional stable-deduplicated union mode.
- Date, United States/anywhere location, and recency/relevance filters.
- Per-search open, copy, full URL inspection, bulk copy, CSV export, and full group/preset matrix export.
- Add groups by parsing pasted HTTPS LinkedIn Jobs URLs; create separate custom query variants.
- Favorites, 20 recent searches, local persistence, and non-destructive versioned JSON import/export.
- Responsive navigation, native checkboxes/radios/selects, Radix dialogs, focus restoration, and reduced-motion support.

## Data and source preservation

The exact source data is in `src/data/seed.json`. To extend the library, use the application or add a new unique ID to this file. Each group needs a name, numeric string `company_ids`, and its unchanged original `source_url`. The ordered IDs must match the original URL's `f_C` parameter. Queries are plain strings: preserve their content exactly. The earlier 50-company reference remains outside the core groups.

Original built-in entries are protected from conflicting JSON imports. Imports validate completely before merging. They never replace an existing original query with an edited version; use a distinct preset ID for a variant. All custom data is local to the current browser and origin. Use JSON export to move or back up your library.

## Validation and limits

The tests compare all 32 generated searches against the independently provided CSV by decoded parameters, verify exact query/ID round trips and original source preservation, reject malformed imports, check stable unions and CSV escaping, and exercise the main UI flow in a DOM environment.

Production compilation and DOM interaction tests are automated. The native browser preview service was unavailable during this build, so visual checks at desktop/mobile sizes and live LinkedIn filter verification remain unverified. The CSS includes layouts for 375px, tablet, landscape, and desktop widths, plus reduced motion and touch-target rules, but these are not a substitute for visual browser QA.

Generated links are labeled **Not live verified**. No LinkedIn requests, scraping, or login are used by the generator. LinkedIn can change URL handling or ignore long queries/company filters. To verify manually, open groups 01 (25 IDs), 04 (60), 08 (100), and 13 (50) and check active company filters and keywords; try both Boolean presets for one group. Do not interpret URL format validation as proof that LinkedIn honored every filter.

## Implementation

React + TypeScript + Vite, Tailwind CSS, Radix Dialog, and Phosphor icons. Semantic colors and responsive styling live in `src/styles.css`; design decisions are in `design-system/MASTER.md`. Static hosting output is `dist/`; private Sites configuration is `.openai/hosting.json`.
