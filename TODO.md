# Development Session TODO

## Session Goal

Scope plugin CSS under the .copilot root class and remove legacy selectors to meet Obsidian UI conventions.

## Completed Tasks ✅

- [x] Reviewed chat input/control components and menu-related dependencies.
- [x] Moved chat actions, mode selection, model selection, and tool toggles into a single options menu.
- [x] Switched send control to icon-only up arrow and compacted the input height.
- [x] Enabled chat history popover to open from the options menu.
- [x] Identified the system menu API usage patterns for Obsidian.
- [x] Replaced the chat options dropdown with the Obsidian system menu.
- [x] Removed the context (@) row above the chat input.
- [x] Standardized chat text sizing to Obsidian font scale.
- [x] Set the chat view typography to use Obsidian's UI-small font size.
- [x] Updated the chat input placeholder copy.
- [x] Switched the prompt input to normal UI text sizing.
- [x] Increased the prompt input minimum height to fit the default placeholder.
- [x] Replaced arbitrary Tailwind text sizes with UI scale tokens in settings and project list.
- [x] Swapped custom CSS font-size values to Obsidian UI font variables.
- [x] Standardized inline chat summary font sizing to UI-smaller.
- [x] Replaced hard-coded warning, placeholder, and badge colors with Obsidian tokens.
- [x] Swapped custom shadows and focus rings to Obsidian shadow and border variables.
- [x] Updated shimmer and hover effects to use Obsidian theme colors/shadows.
- [x] Scoped custom CSS rules under the .copilot root class.
- [x] Removed legacy/unreferenced custom CSS selectors.
- [x] Added the .copilot class to the chat view root.
- [x] Replaced inline styles in SourcesModal with Tailwind classes and UI font tokens.

## Pending Tasks 📋

- [ ] Verify scoped styles still apply in chat view and image previews.
- [ ] Verify SourcesModal layout after class-based styling update.

## Architecture Summary

- Consolidate chat actions, mode selection, model selection, and tool toggles into one dropdown menu to reduce vertical space.
- Keep tool state within ChatInput while driving menu actions via optional props.
- Support controlled chat history popover anchored near the options menu trigger.
- Use Obsidian UI font variables for both Tailwind utilities and hand-written CSS to keep typography consistent.
- Prefer Obsidian theme tokens for backgrounds, borders, shadows, and warning styles.
- Keep custom CSS rules scoped under .copilot to avoid global overrides.

## Testing Checklist

- [ ] npm run format
- [ ] npm run lint
- [ ] Verify chat options menu actions (new chat, history, model switch, tool toggles)
- [ ] Verify input expands with typing and send/stop controls
- [ ] Verify chat view typography uses UI-small sizing
- [ ] Verify prompt input height fits the default placeholder
- [ ] Spot-check settings and project list typography for consistent sizing
- [ ] Spot-check warning banners, disabled controls, and hover shadows against Obsidian themes
- [ ] Spot-check chat view styling after CSS scoping changes
- [ ] Spot-check SourcesModal styling in light/dark themes
