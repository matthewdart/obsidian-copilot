# AGENTS.md

This file provides guidance to any coding agent when working with code in this repository.

## Overview

Copilot for Obsidian is an AI-powered assistant plugin that integrates various LLM providers (OpenAI, Anthropic, Google, etc.) with Obsidian. It provides chat interfaces, autocomplete, semantic search, and various AI-powered commands for note-taking and knowledge management.

## Development Commands

### Build & Development

- **NEVER RUN `npm run dev`** - The user will handle all builds manually
- `npm run build` - Production build (TypeScript check + minified output)

### Code Quality

- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without changing files
- **Before PR:** Always run `npm run format && npm run lint`

### Testing

- `npm run test` - Run unit tests (excludes integration tests)
- `npm run test:integration` - Run integration tests (requires API keys)
- Run single test: `npm test -- -t "test name"`

## High-Level Architecture

### Core Systems

1. **LLM Provider System** (`src/LLMProviders/`)

   - Provider implementations for OpenAI, Anthropic, Google, Azure, local models
   - `LLMProviderManager` handles provider lifecycle and switching
   - Stream-based responses with error handling and rate limiting
   - Custom model configuration support

2. **Chain Factory Pattern** (`src/chainFactory.ts`)

   - Different chain types for various AI operations (chat, copilot, adhoc prompts)
   - LangChain integration for complex workflows
   - Memory management for conversation context
   - Tool integration (search, file operations, time queries)

3. **Vector Store & Search** (`src/search/`)

   - `VectorStoreManager` manages embeddings and semantic search
   - `ChunkedStorage` for efficient large document handling
   - Event-driven index updates via `IndexManager`
   - Multiple embedding providers support

4. **UI Component System** (`src/components/`)

   - React functional components with Radix UI primitives
   - Tailwind CSS with class variance authority (CVA)
   - Modal system for user interactions
   - Chat interface with streaming support
   - Settings UI with versioned components

5. **Message Management Architecture** (`src/core/`, `src/state/`)

   - **MessageRepository** (`src/core/MessageRepository.ts`): Single source of truth for all messages
     - Stores each message once with both `displayText` and `processedText`
     - Provides computed views for UI display and LLM processing
     - No complex dual-array synchronization
   - **ChatManager** (`src/core/ChatManager.ts`): Central business logic coordinator
     - Orchestrates MessageRepository, ContextManager, and LLM operations
     - Handles message sending, editing, regeneration, and deletion
     - Manages context processing and chain memory synchronization
     - **Project Chat Isolation**: Maintains separate MessageRepository per project
       - Automatically detects project switches via `getCurrentMessageRepo()`
       - Each project has its own isolated message history
       - Non-project chats use `defaultProjectKey` repository
   - **ChatUIState** (`src/state/ChatUIState.ts`): Clean UI-only state manager
     - Delegates all business logic to ChatManager
     - Provides React integration with subscription mechanism
     - Replaces legacy SharedState with minimal, focused approach
   - **ContextManager** (`src/core/ContextManager.ts`): Handles context processing
     - Processes message context (notes, URLs, selected text)
     - Reprocesses context when messages are edited

6. **Settings Management**

   - Jotai for atomic settings state management
   - React contexts for feature-specific state

7. **Plugin Integration**
   - Main entry: `src/main.ts` extends Obsidian Plugin
   - Command registration system
   - Event handling for Obsidian lifecycle
   - Settings persistence and migration
   - Chat history loading via pending message mechanism

### Key Patterns

- **Single Source of Truth**: MessageRepository stores each message once with computed views
- **Clean Architecture**: Repository → Manager → UIState → React Components
- **Context Reprocessing**: Automatic context updates when messages are edited
- **Computed Views**: Display messages for UI, LLM messages for AI processing
- **Project Isolation**: Each project maintains its own MessageRepository instance
- **Error Handling**: Custom error types with detailed interfaces
- **Async Operations**: Consistent async/await pattern with proper error boundaries
- **Caching**: Multi-layer caching for files, PDFs, and API responses
- **Streaming**: Real-time streaming for LLM responses
- **Testing**: Unit tests adjacent to implementation, integration tests for API calls

## Obsidian Plugin Development Conventions (Codex Contract)

Source: https://gist.github.com/matthewdart/d71c14ce36f26080c8b1c0c194c94695/raw/95749e11b38ad6116cf913a361915ac8a8d0f18a/20260106-221721.md

Purpose: A normative set of conventions for developing Obsidian plugins so UI/UX is consistent, accessible, and mobile-friendly. Follow unless an explicit requirement overrides it.

### 0) Scope and assumptions

- Applies to: plugin UI in Obsidian desktop and mobile, settings tabs, views/panes, modals/popovers/menus.
- Non-goals: defining features; branding beyond Obsidian theme variables.

### 1) High-level principles

1. Respect Obsidian native UI patterns; prefer built-in components.
2. Mobile-first layout; assume narrow width (approx 320-420px) and maximize the primary area.
3. Theme compatibility by default; use Obsidian CSS variables and avoid hardcoded colors/font sizes.
4. Performance and responsiveness; avoid expensive DOM work per keystroke, debounce as needed.
5. Accessibility; labels, focus management, keyboard navigation, adequate tap targets.

### 2) UI architecture conventions

#### 2.1 Use the right surface

- Settings: `PluginSettingTab` with `Setting` rows.
- Quick actions: commands (and optional ribbon icons).
- Transient input: `Modal`.
- Persistent content: custom `View`/`ItemView` with consistent header/content area.
- Contextual actions: `Menu` and file/folder menus.

#### 2.2 Single-responsibility UI components

- Split large views into components: `HeaderBar`, `Toolbar`, `ListPane`/`DetailPane` (desktop), `Composer`, `Timeline`/`MessageList`.
- Keep state in a single controller (e.g. ViewModel), not scattered in DOM.

#### 2.3 State management

- Persist only what must survive reloads in plugin settings.
- Keep ephemeral UI state in-memory.
- Restore UI state only when it improves UX and does not surprise users.

### 3) Layout and spacing rules

#### 3.1 General layout

- Single-column layout for mobile and narrow panes.
- For wide desktop views, optionally support split layouts.
- Clear hierarchy: view header, main content, optional footer/composer.

#### 3.2 Spacing and density

- Prefer Obsidian defaults: `.setting-item`, `.setting-item-control`, `.setting-item-info`, `.mod-cta`.
- Avoid cramming; minimum 12-16px padding around primary blocks.
- Touch targets >= 44px height where feasible.

#### 3.3 Scrolling

- Only one primary scroll container per view.
- Avoid nested scroll regions unless unavoidable.
- Composer/input should be sticky/anchored without blocking content.

### 4) Typography and theming

#### 4.1 Typography

- Use Obsidian defaults; do not hardcode fonts.
- Use semantic headings where appropriate.
- Keep text readable in side panes; use max-width when practical.

#### 4.2 Theming

- Use CSS variables: `--text-normal`, `--text-muted`, `--background-primary`, `--background-secondary`, `--interactive-accent`, `--interactive-accent-hover`, `--divider-color`.
- Avoid hardcoded hex colors and fixed light/dark assumptions.

#### 4.3 CSS scoping

- All plugin CSS must be scoped to a root class (e.g. `.my-plugin`).
- Never globally override Obsidian or theme CSS.

### 5) Controls and interaction patterns

#### 5.1 Buttons

- One primary action per surface.
- Secondary actions as icon buttons with tooltips.
- Use `aria-label` for icon-only buttons.
- Disable buttons when invalid; provide hint text.

#### 5.2 Inputs

- Always label inputs.
- Placeholders are examples, not labels.
- Multiline text uses a growing `textarea` with max height.

#### 5.3 Feedback

- Use `Notice` for transient success/error.
- Inline validation for settings.
- Loading states: skeletons or subtle spinners; do not block UI unless required.

#### 5.4 Focus management

- Focus the first meaningful control when opening a modal.
- Support keyboard shortcuts; do not steal common shortcuts.

### 6) Mobile-specific conventions

#### 6.1 Pane constraints

- Assume limited height and on-screen keyboard.
- Keep the primary content visible when keyboard is open.
- Use a sticky composer above the keyboard where possible.

#### 6.2 Gesture and tap targets

- Avoid tiny icon clusters.
- Prefer a single overflow menu (`...`) for secondary actions.

#### 6.3 Navigation

- For multi-step flows, prefer single-screen progressive disclosure.
- If multiple screens are required, provide a simple back navigation affordance.

#### 6.4 Orientation

- Support portrait-first; landscape must not break layout.

### 7) Settings tab conventions

- Use `Setting` rows (name/description left, control right).
- Group related settings with headings and subtle dividers.
- Provide defaults and "Reset to defaults".
- Avoid requiring restarts; apply changes live when safe.

### 8) Commands, menus, and discoverability

- Every major action should have a command.
- Ribbon icons are optional and should be sparse.
- Context menus must include only relevant actions.
- All icon actions must have tooltips.

### 9) Error handling and resilience

- Fail safe with a minimal error panel: summary, "Copy diagnostics", "Open plugin settings".
- Do not throw uncaught errors; log with context.
- Provide non-destructive defaults.

### 10) Performance guidelines

- Avoid rendering huge lists without virtualization.
- Debounce expensive operations (search/filter).
- Use `requestAnimationFrame` for layout-dependent UI updates.
- Avoid blocking UI thread with large JSON parsing; chunk if needed.

### 11) Security and privacy

- Do not exfiltrate vault content without clear user intent.
- External services require explicit toggles and disclosure of sent data.
- Store secrets using Obsidian patterns; never log secrets.

### 12) Codex checklist contract (must pass)

#### 12.1 UI consistency

- [ ] Uses native Obsidian components/patterns where applicable.
- [ ] Uses Obsidian theme variables (no hardcoded colors/fonts).
- [ ] Plugin CSS scoped under a root class (no global overrides).

#### 12.2 Mobile support

- [ ] Mobile layout works at 320px width.
- [ ] No essential action requires hover.
- [ ] Tap targets are comfortably sized.
- [ ] Only one primary scroll container.
- [ ] Composer/input not hidden by on-screen keyboard.

#### 12.3 Accessibility

- [ ] All inputs have labels.
- [ ] Icon-only buttons have `aria-label`.
- [ ] Keyboard navigation works for primary flows.

#### 12.4 Performance

- [ ] No expensive re-render on every keystroke (debounced where needed).
- [ ] Large lists are virtualized or paginated.

#### 12.5 Reliability

- [ ] Errors show user-visible message + diagnostics.
- [ ] No secrets in logs.

### 13) Implementation notes (recommended patterns)

- Prefer `this.registerEvent(...)`, `this.registerDomEvent(...)`, `this.registerInterval(...)`.
- Use `onload`/`onunload` cleanup discipline.
- View root: single root element with class `.my-plugin`, render into `contentEl` child.
- Styling: keep CSS minimal; rely on Obsidian classes and variables.

### 14) Quick reference: Good defaults

- One primary CTA per screen.
- Secondary actions behind `...` menu on mobile.
- Progressive disclosure over multi-pane complexity.
- Prefer commands for power users.
- Respect theme variables.

## Message Management Architecture

For detailed architecture diagrams and documentation, see [`MESSAGE_ARCHITECTURE.md`](./docs/MESSAGE_ARCHITECTURE.md).

### Core Classes and Flow

1. **MessageRepository** (`src/core/MessageRepository.ts`)

   - Single source of truth for all messages
   - Stores `StoredMessage` objects with both `displayText` and `processedText`
   - Provides computed views via `getDisplayMessages()` and `getLLMMessages()`
   - No complex dual-array synchronization or ID matching

2. **ChatManager** (`src/core/ChatManager.ts`)

   - Central business logic coordinator
   - Orchestrates MessageRepository, ContextManager, and LLM operations
   - Handles all message CRUD operations with proper error handling
   - Synchronizes with chain memory for conversation history
   - **Project Chat Isolation Implementation**:
     - Maintains `projectMessageRepos: Map<string, MessageRepository>` for project-specific storage
     - `getCurrentMessageRepo()` automatically detects current project and returns correct repository
     - Seamlessly switches between project repositories when project changes
     - Creates new empty repository for each project (no message caching)

3. **ChatUIState** (`src/state/ChatUIState.ts`)

   - Clean UI-only state manager
   - Delegates all business logic to ChatManager
   - Provides React integration with subscription mechanism
   - Replaces legacy SharedState with minimal, focused approach

4. **ContextManager** (`src/core/ContextManager.ts`)

   - Handles context processing (notes, URLs, selected text)
   - Reprocesses context when messages are edited
   - Ensures fresh context for LLM processing

5. **ChatPersistenceManager** (`src/core/ChatPersistenceManager.ts`)
   - Handles saving and loading chat history to/from markdown files
   - Project-aware file naming (prefixes with project ID)
   - Parses and formats chat content for storage
   - Integrated with ChatManager for seamless persistence

## Code Style Guidelines

### MAJOR PRINCIPLES

- **ALWAYS WRITE GENERALIZABLE SOLUTIONS**: Never add edge-case handling or hardcoded logic for specific scenarios (like "piano notes" or "daily notes"). Solutions must work for all cases.
- **NEVER MODIFY AI PROMPT CONTENT**: Do not update, edit, or change any AI prompts, system prompts, or model adapter prompts unless explicitly asked to do so by the user
- **Avoid hardcoding**: No hardcoded folder names, file patterns, or special-case logic
- **Configuration over convention**: If behavior needs to vary, make it configurable, not hardcoded
- **Universal patterns**: Solutions should work equally well for any folder structure, naming convention, or content type

### TypeScript

- Strict mode enabled (no implicit any, strict null checks)
- Use absolute imports with `@/` prefix: `import { ChainType } from "@/chainFactory"`
- Prefer const assertions and type inference where appropriate
- Use interface for object shapes, type for unions/aliases

### React

- Functional components only (no class components)
- Custom hooks for reusable logic
- Props interfaces defined above components
- Avoid inline styles, use Tailwind classes

### General

- File naming: PascalCase for components, camelCase for utilities
- Async/await over promises
- Early returns for error conditions
- **Always add JSDoc comments** for all functions and methods
- Organize imports: React → external → internal
- **Avoid language-specific lists** (like stopwords or action verbs) - use language-agnostic approaches instead

### Logging

- **NEVER use console.log** - Use the logging utilities instead:
  - `logInfo()` for informational messages
  - `logWarn()` for warnings
  - `logError()` for errors
- Import from logger: `import { logInfo, logWarn, logError } from "@/logger"`

## Testing Guidelines

- Unit tests use Jest with TypeScript support
- Mock Obsidian API for plugin testing
- Integration tests require API keys in `.env.test`
- Test files adjacent to implementation (`.test.ts`)
- Use `@testing-library/react` for component testing

## Development Session Planning

### Using TODO.md for Session Management

**IMPORTANT**: When working on a development session, maintain a comprehensive `TODO.md` file that serves as the central plan and tracker:

1. **Session Goal**: Define the high-level objective at the start
2. **Task Tracking**:
   - List all completed tasks with [x] checkboxes
   - Track pending tasks with [ ] checkboxes
   - Group related tasks into logical sections
3. **Architecture Decisions**: Document key design choices and rationale
4. **Progress Updates**: Keep the TODO.md updated as tasks complete
5. **Testing Checklist**: Include verification steps for the session

The TODO.md should be:

- The single source of truth for session progress
- Updated frequently as work progresses
- Clear enough that another developer can understand what was done
- Comprehensive enough to serve as a migration guide

### Structure Example:

```markdown
# Development Session TODO

## Session Goal

[Clear statement of what this session aims to achieve]

## Completed Tasks ✅

- [x] Task description with key details
- [x] Another completed task

## Pending Tasks 📋

- [ ] Next task to work on
- [ ] Future enhancement

## Architecture Summary

[Key design decisions and rationale]

## Testing Checklist

- [ ] Functionality verification
- [ ] Performance checks
```

## Important Notes

- The plugin supports multiple LLM providers with custom endpoints
- Vector store requires rebuilding when switching embedding providers
- Settings are versioned - migrations may be needed
- Local model support available via Ollama/LM Studio
- Rate limiting is implemented for all API calls
- For technical debt and known issues, see [`TECHDEBT.md`](./docs/TECHDEBT.md)
- For current development session planning, see [`TODO.md`](./TODO.md)

### Obsidian Plugin Environment

- **Global `app` variable**: In Obsidian plugins, `app` is a globally available variable that provides access to the Obsidian API. It's automatically available in all files without needing to import or declare it.

### Architecture Migration Notes

- **SharedState Removed**: The legacy `src/sharedState.ts` has been completely removed
- **Clean Architecture**: New architecture follows Repository → Manager → UIState → UI pattern
- **Single Source of Truth**: All messages stored once in MessageRepository with computed views
- **Context Always Fresh**: Context is reprocessed when messages are edited to ensure accuracy
- **Chat History Loading**: Uses pending message mechanism through CopilotView → Chat component props
- **Project Chat Isolation**: Each project now has completely isolated chat history
  - Automatic detection of project switches via `ProjectManager.getCurrentProjectId()`
  - Separate MessageRepository instances per project ID
  - Non-project chats stored in default repository
  - Backwards compatible - loads existing messages from ProjectManager cache
  - Zero configuration required - works automatically
