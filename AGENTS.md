# AGENTS.md

This file provides guidance for AI coding agents working in the **USAL.js** (`usal`) monorepo.

## Project Overview

**USAL.js** (Ultimate Scroll Animation Library) is a lightweight (~6KB gzipped), zero-dependency scroll animation library powered by the Web Animations API (WAAPI), `IntersectionObserver`, `MutationObserver`, and `ResizeObserver`. It supports declarative `data-usal` attributes for entrance animations (`fade`, `slide`, `zoomin`, `zoomout`, `flip`), text/element splitting (`split-word`, `split-letter`, `split-item`), spatial stagger (`linear`, `center`, `edges`, `random`), animated counters (`count-[...]`), custom keyframe timelines (`line-[...]`), Shadow DOM traversal, and SSR safety across Vanilla JS, React, Solid, Svelte, Vue/Nuxt, Lit, and Angular.

---

## Repository Structure

- `src/usal.js` — Core vanilla runtime engine, parser, WAAPI keyframe generator, observer orchestration, and SSR fallback stub.
- `src/usal.d.ts` — Core TypeScript declarations.
- `src/integrations/` — Framework wrappers:
  - `react.tsx` (`@usal/react`)
  - `solid.ts` (`@usal/solid`)
  - `svelte.ts` (`@usal/svelte`)
  - `vue.ts` (`@usal/vue`)
  - `lit.ts` (`@usal/lit`)
  - `angular.ts` (`@usal/angular`, compiled with `ng-packagr` for Ivy compatibility)
- `src/plugins/` — Nuxt module (`nuxt.js`, `nuxt-plugin.js`) copied into `@usal/vue`.
- `src/types/` — Per-framework `.d.ts` files copied into `packages/*` during build.
- `packages/` — **Generated** build output for all published npm packages (`vanilla`, `react`, `solid`, `svelte`, `vue`, `lit`, `angular`). **Do not edit files in `packages/` directly.**
- `docs/` — Public website (`docs/index.html`, `docs/style.css`), interactive studio (`docs/playground.html`, `docs/playground.css`, `docs/playground.js`), and API reference (`docs/API.md`).
- `dev/` — Local visual & stress-testing suite (`dev/debug.html`, `dev/debug.js`, `dev/debug.css`).
- `test/usal.test.js` — Automated Node test suite covering core engine behavior, edge cases, and framework integrations.
- `scripts/` — Build (`build.js`), documentation sync (`postbuild.js`), language linter (`lint-texts.js`), and release utilities (`publish.js`, `release-gh.js`).

---

## Key Commands

- **Run tests:**
  ```bash
  npm test
  ```
- **Lint source files:**
  ```bash
  npm run lint
  ```
- **Format codebase & docs:**
  ```bash
  npm run format
  ```
- **Build all packages (runs lint, language check, package builds, and doc sync):**
  ```bash
  npm run build
  ```
- **Build a single package (e.g., vanilla):**
  ```bash
  node scripts/build.js --package=vanilla
  ```
- **Start local server (Playground at `/docs/playground.html`, Debug suite at `/dev/debug.html`):**
  ```bash
  npm run dev:serve
  ```

---

## Engineering Conventions & Guardrails

1. **English-Only Repository Content (`scripts/lint-texts.js`):**
   - Every comment, string literal, HTML text node, and Markdown document in the repository **must be written in English**. The build pipeline runs `scripts/lint-texts.js` and will fail if non-English text is detected.

2. **Never Edit Generated Artifacts Directly:**
   - Always modify source files in `src/` and run `npm run build` to regenerate `packages/*`.
   - `scripts/postbuild.js` automatically synchronizes installation and usage sections from `README.md` into `docs/index.html`, `docs/API.md`, and `packages/vanilla/README.md`. Update `README.md` first when changing shared documentation snippets.

3. **Core Engine (`src/usal.js`) Invariants:**
   - **Zero Dependencies & SSR Safety:** `src/usal.js` must have zero runtime imports and must safely return the no-op callable stub when `typeof window === 'undefined'`.
   - **WAAPI Animation Cleanup (`applyStyles` & `cancelAllAnimations`):** Always cancel previous `__usal_s_*` style animations before creating a new one so WAAPI animations do not accumulate on long-lived elements.
   - **MutationObserver Fragment Tracking (`__usalFragment`):** Only mark internal text/count wrapper spans created by `setupSplit`, `setupCount`, and `cleanupElement` with `__usalFragment = 1`. Never set `__usalFragment = 1` on the user's `[data-usal]` root element, or replacing a `[data-usal]` element in a container will be mistaken for an internal mutation.
   - **Lazy Spatial Stagger (`getStaggerFunction`):** `split-word` and `split-letter` spans are inserted into the DOM asynchronously after two `requestAnimationFrame` ticks. Spatial stagger calculations (`center`, `edges`, `linear`) must read `getBoundingClientRect()` lazily when `targets(splitDelay)` is invoked by `AnimationController.letsGo()`, not synchronously during `setupSplit`.
   - **Bracket-Balanced Tokenization (`tokenizeClasses`):** `data-usal` class strings may contain spaces inside bracketed tokens (`count-[21 000 000]`, `line-[o+0 | 50 o+100]`, `split-line-[...]`). Always tokenize with bracket depth tracking rather than raw `.split(/\s+/)`.

4. **Code Quality & Linting:**
   - `eslint.config.js` enforces `eslint-plugin-sonarjs` rules (including cognitive complexity <= 15, no unused variables, and safe regular expressions). Always run `npm run lint` and `npm test` before finalizing changes.
