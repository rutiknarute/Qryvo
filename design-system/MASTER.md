# Searchdesk design system

Purpose: a calm, precise workspace for targeted LinkedIn job searches. Primary task: choose companies, choose one exact Boolean preset, then generate links.

Visual direction: flat professional dashboard; warm white surfaces, cool neutral canvas, blue actions, quiet violet/teal/amber accents. Manrope headings, DM Sans body, monospace for exact queries. Phosphor outline icons; filled icons only for selected navigation/favorites. No raster decoration required for this data tool.

Semantic tokens live in src/styles.css. Primary #2857da; background #f7f8fb; surface #fff; ink #192238. Border #e6e9f0. Consistent 4/8 based spacing, 7–12px control/card radii. Desktop sidebar and responsive content flow. Mobile navigation moves to the top, panels stack, targets expand.

Interactions: selected groups have checked controls and blue borders; original labels and counts remain visible. Generate is disabled until a group is selected. Copy feedback uses a polite live region. Dialogs use Radix focus management and Escape dismissal. Reduced motion disables transitions. Source IDs, exact query, and generated URL remain inspectable.

Design research: ui-ux-pro-max design-system query `job search productivity dashboard minimal professional blue`, plus UX query `animation accessibility z-index loading`. Adapted the tool's mobile suggestions to the requested desktop website.

User-directed update: retain the light UI and its original blue palette. New grad and primary actions use the brand blue #2857DA with white text. Software uses the deeper blue #1E40AF with white text. Both have darker hover/pressed shades and matching visible focus rings. All enabled button text/background pairs exceed WCAG AA 4.5:1. Text-only actions use darker blue. Disabled buttons remain subdued.

Buttons keep the user's reference pill shape: fully rounded ends and a subtle inset highlight/lower edge, with pressed inset feedback. Sizes, labels, layout, company data, and exact queries remain unchanged.
