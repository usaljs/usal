<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" 
            srcset="https://raw.githubusercontent.com/usaljs/usal/refs/heads/main/assets/brand/usal_logo_dark.svg">
    <img src="https://raw.githubusercontent.com/usaljs/usal/refs/heads/main/assets/brand/usal_logo.svg" alt="USAL.js">
  </picture>
  <picture>
    <img width="144" height="144" src="https://raw.githubusercontent.com/usaljs/usal/refs/heads/main/assets/brand/usal_icon_512.webp" alt="⚡">
  </picture>

**Ultimate Scroll Animation Library - Lightweight, powerful, wonderfully simple ✨**

**Works with React, Solid, Svelte, Vue, Lit, Angular, Vanilla JS and more**

**[> usal.dev/](https://usal.dev/)**

[![Available On NPM](https://badgers.space/badge/AVAILABLE%20ON/NPM/red?icon=cssgg-npm&theme=tailwind)](https://npmjs.com/package/usal) [![Join The Community](https://badgers.space/badge/JOIN%20THE%20COMMUNITY/DISCORD/black?icon=feather-message-circle&theme=tailwind)](https://discord.usal.dev/)

[![Powered by Cloudflare](https://badgers.space/badge/POWERED%20BY/CLOUDFLARE/orange?icon=feather-cloud-lightning&theme=tailwind)](https://www.cloudflare.com/) [![Delivered By JsDelivr](https://badgers.space/badge/DELIVERED%20BY/JSDELIVR/blue?icon=feather-download-cloud&theme=tailwind)](https://jsdelivr.com) [![Sponsor](https://badgers.space/badge/BECOMING%20A/SPONSOR/pink?icon=feather-heart&theme=tailwind)](https://github.com/sponsors/italoalmeida0)

</div>

## ✨ Features

- 🎯 **40+ animations** (fade, zoom, flip with all directions)
- 📝 **Text animations** (split by word/letter)
- 🔢 **Number counters**
- 🎨 **Text effects** (shimmer, fluid)
- 📦 **Only 8KB Gzipped**
- 🚀 **Zero dependencies**
- ♾ **60fps performance**
- 🪤 **Web components supported**
- 🔧 **Framework agnostic**
- ⚡ **CDN powered** by jsDelivr & Cloudflare

## 📦 Installation

### CDN (Quickstart)

```html
<script type="module" src="https://cdn.usal.dev/v2/latest"></script>
```

### NPM

```bash
npm install usal

# Framework-specific packages
npm install @usal/react   # For React/Next.js
npm install @usal/solid   # For Solid/SolidStart
npm install @usal/svelte   # For Svelte/SvelteKit
npm install @usal/vue   # For Vue/Nuxt
npm install @usal/lit   # For Lit
npm install @usal/angular   # For Angular
```

### ESM (Vite / bundlers)

```js
import usal from 'usal';

// usal() is callable — shorthand for usal.config()
usal({
  once: true,
  defaults: { duration: 900, delay: 200, easing: 'ease' },
});
```

USAL auto-initializes on import. The instance is also available on `globalThis.USAL` (CDN / `<script type="module">`): `globalThis.USAL.config(...)`.

## 🚀 Framework Setup

### ⬛ React (Next.js)

```jsx
import { USALProvider } from '@usal/react';
<USALProvider>{children}</USALProvider>;
```

### 🟦 Solid (SolidStart)

```jsx
import { USALProvider } from '@usal/solid';
<USALProvider>{props.children}</USALProvider>;
```

### 🟧 Svelte (SvelteKit)

```js
import { usal } from '@usal/svelte';
// USAL auto-initializes globally
```

### 🟩 Vue (Nuxt)

```js
import { USALPlugin } from '@usal/vue';
createApp(App).use(USALPlugin).mount('#app');
//for Nuxt
export default defineNuxtConfig({
modules: ['@usal/vue/nuxt']
//...
```

### 🟪 Lit

```js
import { usal } from '@usal/lit';
// USAL auto-initializes globally
```

### 🟥 Angular

```js
import { USALModule } from '@usal/angular';
@Component({imports: [USALModule]})
export class AppComponent
```

## 📐 Basic Usage

```html
<!-- Simple animation -->
<div data-usal="fade-u">Fade from bottom</div>

<!-- With modifiers -->
<div data-usal="zoomin duration-800 delay-200">Zoom in</div>

<!-- Complex animation -->
<div data-usal="flip-r delay-500 blur once">Flip from right</div>
```

## [📖 Complete API Documentation](https://github.com/usaljs/usal/wiki/API-Documentation) or https://usal.dev/#api

## 🎲 Demos

![Animations](https://github.com/usaljs/usal/raw/main/assets/all.gif)

![Text Animations](https://github.com/usaljs/usal/raw/main/assets/text.gif)

![Count Animations](https://github.com/usaljs/usal/raw/main/assets/count.gif)

![Split Animations](https://github.com/usaljs/usal/raw/main/assets/split.gif)

## 📊 Packages Overview

| Package         | Version                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `usal`          | ![npm](https://badge.usal.dev/?nn&ps=%40usal%2Freact%2C%40usal%2Fsolid%2C%40usal%2Fsvelte%2C%40usal%2Fvue%2C%40usal%2Flit%2C%40usal%2Fangular) |
| `@usal/react`   | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Freact&color=grey)                                                                                |
| `@usal/solid`   | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Fsolid&color=blue)                                                                                |
| `@usal/svelte`  | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Fsvelte&color=orange)                                                                             |
| `@usal/vue`     | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Fvue&color=green)                                                                                 |
| `@usal/lit`     | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Flit&color=cyan)                                                                                  |
| `@usal/angular` | ![npm](https://badge.usal.dev/?nn&p=%40usal%2Fangular&color=red)                                                                               |

## 📈 JavaScript Animation Frameworks Comparison (2025)

### Performance & Size Comparison

| Framework      | Bundle Size (gzip) | React     | Vue       | Angular   | Svelte    | Solid     | Lit       | Vanilla |
| -------------- | ------------------ | --------- | --------- | --------- | --------- | --------- | --------- | ------- |
| **🚀 USAL.js** | **~8KB**           | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅      |
| Motion One     | Variable (~small)  | ✅        | ✅        | ❌        | ❌        | ❌        | ❌        | ✅      |
| GSAP           | ~28KB              | ✅        | ✅        | ✅        | ✅        | ✅        | ✅        | ✅      |
| Anime.js v4    | ~27KB              | ✅        | ✅        | ✅        | ✅        | ✅        | ✅        | ✅      |
| Lottie         | ~60KB              | ⚠️        | ⚠️        | ⚠️        | ⚠️        | ⚠️        | ⚠️        | ✅      |
| AOS            | ~8KB               | ⚠️        | ⚠️        | ⚠️        | ❌        | ❌        | ❌        | ✅      |
| SAL.js         | ~2.7KB             | ❌        | ❌        | ❌        | ❌        | ❌        | ❌        | ✅      |

### Feature Comparison

| Framework   | Split (Letters/Words/Items) | Counters  | Scroll Trigger | Timeline    | SVG       | Learning      |
| ----------- | --------------------------- | --------- | -------------- | ----------- | --------- | ------------- |
| **USAL.js** | ✅ Core                     | ✅ Core   | ✅ Core        | ✅ Core     | ❌        | **Very Easy** |
| Motion      | ❌                          | ❌        | ✅ Core        | ⚠️ Variants | ✅ Core   | Medium        |
| GSAP        | ⚠️ Plugin                   | ⚠️ Plugin | ✅ Plugin      | ✅ Advanced | ⚠️ Plugin | Complex       |
| Anime.js v4 | ✅ Core                     | ✅ Core   | ✅ Core        | ✅ Core     | ✅ Core   | Medium        |
| Lottie      | ⚠️ via AE                   | ⚠️ via AE | ❌             | ✅ Core     | ✅ Core   | Complex       |
| AOS         | ❌                          | ❌        | ✅ Core        | ❌          | ❌        | Very Easy     |
| SAL.js      | ❌                          | ❌        | ✅ Core        | ❌          | ❌        | Very Easy     |

**Legend:**

- ✅ Native/Core support
- ⚠️ Plugin/Wrapper required
- ❌ Not supported

## 🙏 Acknowledgments

USAL.js was inspired by:

- **[AOS.js](https://github.com/michalsnik/aos)** - Pioneering attribute-based animations
- **[SAL.js](https://github.com/mciastek/sal)** - Lightweight performance optimization
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first naming conventions

---

## 📄 License

MIT License © 2025 Italo Almeida ([@italoalmeida0](https://github.com/italoalmeida0))
