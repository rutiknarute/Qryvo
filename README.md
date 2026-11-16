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

- All 16 company groups in a vertical list of full-width LinkedIn buttons, with accurate labels and unchanged counts: 980 company references and 839 distinct IDs. Each row shows its name and company count in parentheses, followed by New grad and Software buttons for the two exact queries. Both buttons use the current filters; use checkboxes for batches.
- Only the two exact supplied Boolean queries: New Graduate (default) and Software & Development. Retired or custom queries are removed from saved configuration on load; saved company groups are retained.
- Separate batch searches by default; optional stable-deduplicated union mode.
- Date, United States/anywhere location, and recency/relevance filters.
- Per-search open, copy, full URL inspection, bulk copy, CSV export, and full group/preset matrix export.
- Add groups by parsing pasted HTTPS LinkedIn Jobs URLs.
- Local persistence, saved searches, and non-destructive versioned JSON import/export.
- Responsive navigation, native checkboxes/radios/selects, Radix dialogs, focus restoration, and reduced-motion support.

## Data and source preservation

The exact source data is in `src/data/seed.json`. To extend the library, use the application or add a new unique ID to this file. Each group needs a name, numeric string `company_ids`, and its unchanged original `source_url`. The ordered IDs must match the original URL's `f_C` parameter. Built-in display names use the actual ID count; their original saved names remain in the seed and JSON configuration. Queries are plain strings: preserve their content exactly. The earlier 50-company reference remains outside the core groups. The fixed two-preset catalogue and saved-data migration live in `src/catalogue.ts`.

Original built-in entries are protected from conflicting JSON imports. Imports validate completely before merging. They never replace an original query with an edited version, and additional presets are not imported. All custom data is local to the current browser and origin. Use JSON export to move or back up your library.

## Validation and limits

Generated links use `/jobs/search-results/`, with `%20`-encoded spaces, the selected exact query in `keywords`, and the selected group IDs in `f_C`. Date, location, and sort come from the builder controls. Source job IDs and tracking parameters are excluded.

The tests compare the original 32 group/query combinations against the independently provided CSV by decoded parameters, and verify that saved data restores only the two original exact queries. They verify exact query/ID round trips and original source preservation, reject malformed imports, check stable unions and CSV escaping, and exercise the main UI flow in a DOM environment.

Production compilation and DOM interaction tests are automated. The native browser preview service was unavailable during this build, so visual checks at desktop/mobile sizes and live LinkedIn filter verification remain unverified. The CSS includes layouts for 375px, tablet, landscape, and desktop widths, plus reduced motion and touch-target rules, but these are not a substitute for visual browser QA.

Generated links are labeled **Not live verified**. No LinkedIn requests, scraping, or login are used by the generator. LinkedIn can change URL handling or ignore long queries/company filters. To verify manually, open groups 01 (25 IDs), 04 (60), 08 (100), and 13 (50) and check active company filters and keywords; try both Boolean presets for one group. Do not interpret URL format validation as proof that LinkedIn honored every filter.

## Implementation

React + TypeScript + Vite, Tailwind CSS, Radix Dialog, and Phosphor icons. Semantic colors and responsive styling live in `src/styles.css`; design decisions are in `design-system/MASTER.md`. Static hosting output is `dist/`; private Sites configuration is `.openai/hosting.json`.
