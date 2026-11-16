# Searchdesk design system

Purpose: a calm, precise workspace for targeted LinkedIn job searches. Primary task: choose companies, choose one exact Boolean preset, then generate links.

Visual direction: flat professional dashboard; warm white surfaces, cool neutral canvas, blue actions, quiet violet/teal/amber accents. Manrope headings, DM Sans body, monospace for exact queries. Phosphor outline icons; filled icons only for selected navigation/favorites. No raster decoration required for this data tool.

Semantic tokens live in src/styles.css. Primary #2857da; background #f7f8fb; surface #fff; ink #192238. Border #e6e9f0. Consistent 4/8 based spacing, 7–12px control/card radii. Desktop sidebar and responsive content flow. Mobile navigation moves to the top, panels stack, targets expand.

Interactions: selected groups have checked controls and blue borders; original labels and counts remain visible. Generate is disabled until a group is selected. Copy feedback uses a polite live region. Dialogs use Radix focus management and Escape dismissal. Reduced motion disables transitions. Source IDs, exact query, and generated URL remain inspectable.

Design research: ui-ux-pro-max design-system query `job search productivity dashboard minimal professional blue`, plus UX query `animation accessibility z-index loading`. Adapted the tool's mobile suggestions to the requested desktop website.

User-directed update: retain the prior light UI, with high-contrast red-family action buttons. New grad and primary actions use #DC2626 with white text. Software uses a distinct burgundy #9F1239 with white text. Both have darker hover/pressed states and visible matching focus rings. All enabled text/background pairs reach WCAG AA 4.5:1 or better. Text-only actions use darker red. Navigation, panels, canvas, data, and layout retain their previous styling; disabled buttons remain subdued.
