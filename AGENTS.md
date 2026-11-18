# Codex Project Notes

## Architecture

This is a vanilla multi-page static website. Keep the current HTML, CSS, and browser JavaScript architecture unless the user explicitly asks for a migration. Do not convert the project to React, Next.js, Astro, or another framework during routine edits.

Vite is used only as the local development server and production static build tool. The site entry points are root-level HTML files configured in `vite.config.js`.

## Directory Structure

- `index.html` - home page.
- `projects.html`, `about.html`, `experience.html`, `interests.html`, `contact.html` - primary content pages.
- `amazon.html`, `portfolio.html`, `intelligence.html` - project detail pages.
- `first.css` - primary stylesheet used by current pages.
- `site.js` - browser interaction and animation layer.
- `market.js` - live stock model (stock of the day + any-stock checker) mirroring the trading workbook.
- `api/stock.js` - market-data proxy; Vercel serverless function in production, Vite middleware in dev/preview.
- `interests.js` - Interests page: live F1 and India/IPL cricket (via `api/sports.js`), heads-up hold'em with chips, Bollywood movie picker.
- `api/sports.js` - F1 (Jolpica, OpenF1) and cricket (ESPN) proxy; same serverless/middleware setup as `api/stock.js`.
- `logos/` - school and Amber logos.
- `chat.js` - "Ask about Meet" assistant; answers only from the facts in its `TOPICS` list (no API).
- `vendor/framer-motion.dom.js` - existing vendored Framer Motion DOM runtime loaded by the pages.
- `Meet-Bhojani-Resume.pdf` - resume download asset.
- `meet-bhojani.jpg`, `meet-bhojani-portrait.jpg` - image assets.
- `glass.css`, `motion.css`, `refinement.css` - existing stylesheet assets; preserve unless proven unused and removal is requested.

## Development Commands

- `npm run dev` - start the Vite development server.
- `npm run build` - create the production build in `dist/`.
- `npm run preview` - preview the production build locally.
- `npm run check` - run the current lightweight JavaScript syntax check.

## Coding Conventions

- Preserve existing page content, visual design, animation behavior, and navigation unless the user asks for a change.
- Keep changes small and localized to the requested page, style rule, or interaction.
- Use plain HTML, CSS, and JavaScript for new work unless there is a clear project-approved reason to add tooling.
- Avoid unnecessary dependencies. Prefer platform APIs and the existing Vite setup.
- Keep asset paths relative and compatible with Vite static builds.
- Do not remove existing files or assets without verifying they are unused and confirming the cleanup is in scope.

## Responsive Design Expectations

- Verify changes on desktop and mobile viewport sizes.
- Preserve the existing responsive breakpoints and mobile navigation behavior.
- Ensure text does not overlap, overflow awkwardly, or become unreadable on small screens.
- Check all affected pages, not only the page edited.

## Accessibility Expectations

- Preserve semantic HTML landmarks, heading order, alt text, skip links, and focusable controls.
- Maintain keyboard accessibility for navigation, links, buttons, and menus.
- Respect `prefers-reduced-motion` behavior.
- Do not rely on animation, hover, or color alone to communicate essential information.

## Performance Requirements

- Keep the site static and lightweight.
- Avoid adding large libraries, heavy images, or runtime work unless required.
- Preserve the vendored Framer Motion DOM runtime unless a deliberate dependency strategy change is requested.
- Prefer CSS and small vanilla JavaScript enhancements over larger abstractions.

## Animation Guidelines

- Existing animations are powered by `site.js` and `vendor/framer-motion.dom.js`.
- Preserve existing motion timing, reveal behavior, reduced-motion fallback, and page-transition behavior unless explicitly changing animation design.
- Test pages with normal motion and consider reduced-motion behavior after significant animation changes.

## Verification

After significant changes, run:

1. `npm run check`
2. `npm run build`
3. `npm run dev` or `npm run preview` and verify affected pages.

For visual or layout changes, test desktop and mobile layouts before reporting completion.
