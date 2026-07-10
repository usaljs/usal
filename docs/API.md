# 📖 API Documentation

### Framework Usage

```html
<!-- Vanilla JS -->
<div data-usal="fade duration-500">Content</div>

<!-- React/Next.js -->
<div data-usal="fade duration-500">Content</div>

<!-- Solid/SolidStart -->
<div data-usal="fade duration-500">Content</div>

<!-- Svelte/SvelteKit -->
<div use:usal={'fade duration-500'}>Content</div>

<!-- Vue/Nuxt -->
<div v-usal="'fade duration-500'">Content</div>

<!-- Lit -->
<div ${usal('fade duration-500')}>Content</div>

<!-- Angular -->
<div usal="fade duration-500">Content</div>
```

### 🎨 Available Animations

#### Fade Animations

```
fade        fade-u      fade-d      fade-l      fade-r
fade-ul     fade-ur     fade-dl     fade-dr
```

#### Slide Animations

```
slide       slide-u     slide-d     slide-l     slide-r
slide-ul    slide-ur    slide-dl    slide-dr
```

#### Zoom In Animations

```
zoomin      zoomin-u    zoomin-d    zoomin-l    zoomin-r
zoomin-ul   zoomin-ur   zoomin-dl   zoomin-dr
```

#### Zoom Out Animations

```
zoomout     zoomout-u   zoomout-d   zoomout-l   zoomout-r
zoomout-ul  zoomout-ur  zoomout-dl  zoomout-dr
```

#### Flip Animations

```
flip        flip-u      flip-d      flip-l      flip-r
flip-ul     flip-ur     flip-dl     flip-dr
```

### 📝 Split Animations

Split content into animated parts

```
split-word      // Split text by words
split-letter    // Split text by letters
split-item      // Split child elements
```

#### Split with Animation

Combine split with any animation type

```
split-fade-{direction}   // split-fade-u, split-fade-r
split-zoomin-{direction}  // split-zoomin, split-zoomin-l
split-flip-{direction}    // split-flip-d, split-flip-r
```

#### Split Delay

Control delay between split parts (milliseconds)

```
split-delay-{value}
split-delay-{value}-{stagger}
```

**Stagger types:**

- Default (by index): `split-delay-50`
- Linear: `split-delay-50-linear`
- Center (X/Y axes): `split-delay-50-center`
- Edges (X/Y axes): `split-delay-50-edges`
- Random: `split-delay-50-random`

**Examples:**

```
split-delay-30
split-delay-100-center
split-delay-75-edges
```

```html
<h1 data-usal="split-word fade-u">Hello World</h1>

<h1 data-usal="split-letter zoomin">USAL.js</h1>

<p data-usal="split-word fade-r split-delay-100">Animated paragraph</p>

<ul data-usal="split-item flip-l">
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
```

### 🔢 Count Animation

Animate numbers from 0 to target value (preserves formatting)

```
count-[{number}]
// Examples:
count-[100]       // Count to 100
count-[98.5]     // Count to 98.5
count-[1,000]     // Count to 1,000
count-[42,350]    // Count to 42,350
count-[1 000 000]  // Count to 1 000 000
```

```html
<!-- Count isolated negative -->
<span data-usal="count-[1000]">-1000</span>

<!-- Count in context -->
<span data-usal="count-[4.9]">Stars: 4.9/5</span>

<!-- Counting in a complex context -->
<span data-usal="count-[21 000 000.00]">
  In 2025, we will earn US$21 000 000.00 in the first quarter alone.
</span>
```

### ✨ Text Effects

Special effects for individual characters

```
text-shimmer    // Shimmering light sweep effect
text-fluid      // Morphing font weight animation
```

> **💡 Tip:** Must be combined with `split-letter`. For best results, use longer durations (1000-3000ms) and split delays between 50-100ms to create smooth, captivating animations.

```html
<!-- Shimmer effect -->
<h1 data-usal="text-shimmer split-letter duration-2000 split-delay-100">Shimmer Text</h1>

<!-- Fluid weight animation -->
<h1 data-usal="text-fluid split-letter duration-2000 split-delay-50">Fluid Text</h1>
```

### ⚙️ Modifiers

#### Duration

Control animation duration in milliseconds

```
duration-{value}
// Examples: duration-500, duration-1000, duration-2000
```

#### Delay

Add delay before animation starts (milliseconds)

```
delay-{value}
// Examples: delay-200, delay-500, delay-1000
```

#### Easing

```
linear | ease | ease-in | ease-out | ease-in-out | step-start | step-end
easing-[{value}] // Custom easing: easing-[cubic-bezier(0.4,0,0.2,1)]
// Other custom possibilities
linear(0, 0.25, 1)
steps(4, end)
```

#### Threshold

Control when animation triggers (percentage of element visible)

```
threshold-{value}
// Examples: threshold-10, threshold-30, threshold-50
```

> **💡 Tip:** For large elements (height > 100vh), use lower thresholds like `threshold-5` or `threshold-10` to ensure animations trigger properly.

#### Other Modifiers

```
blur / blur-{value}    // Add blur effect during animation (default: 0.625rem, custom: blur-2)
once                   // Run animation only once
loop / loop-{mirror/jump}   // Run animation continuously (overrides 'once') (default: mirror)
forwards               // Keep final animation state (don't reset to original)
```

### 🔧 JavaScript API

#### Configuration

```javascript
// ESM import — usal is callable (shorthand for usal.config())
import usal from 'usal';

usal({
  once: true,
  defaults: { duration: 900, delay: 200, easing: 'ease' },
});

// CDN (auto-initializes), instance on globalThis/window:
//   <script type="module" src="https://cdn.usal.dev/v2/latest"></script>
// globalThis.USAL.config({ once: true });

// Initialize with custom settings
window.USAL.config({
  defaults: {
    animation: 'fade', // Default animation type
    direction: 'u', // Default direction (u, d, l, r, ul, ur, dl, dr)
    duration: 1000, // Animation duration (ms)
    delay: 0, // Animation delay (ms)
    threshold: 10, // Viewport threshold for trigger (%)
    splitDelay: 30, // Delay between split items (ms)
    easing: 'ease-out', // CSS easing function
    blur: false, // Enable/disable blur effect (false, true, or numeric value in rem - default: 0.625rem when true)
    loop: 'mirror', // Default loop type (mirror, jump)
  },
  observersDelay: 50, // Delay for observers (ms)
  once: false, // Run animation only once
});

// Get current configuration
const currentConfig = window.USAL.config();

// Reconfigure at any time
window.USAL.config({
  defaults: {
    duration: 2000,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    blur: 0.8,
  },
  once: true,
});

// Partial updates work too
window.USAL.config({
  defaults: {
    animation: 'zoomin',
    direction: 'l',
  },
});
```

#### Control Methods

```javascript
// Check if initialized
if (window.USAL.initialized()) {
  console.log('USAL is running');
}

// Restart USAL (destroy + reinitialize)
window.USAL.restart();

// Completely shut down USAL
window.USAL.destroy();

// Get version
console.log(window.USAL.version);
```

#### Blur Effect

```javascript
// Blur can be boolean or numeric value in rem
window.USAL.config({
  defaults: {
    blur: false, // No blur effect
    // or
    blur: true, // Default blur (0.625rem)
    // or
    blur: 2, // Custom blur (2rem)
    // or
    blur: 0.5, // Custom blur (0.5rem)
  },
});
```

#### Easing Functions

```javascript
// Any valid CSS easing function
window.USAL.config({
  defaults: {
    easing: 'ease-in-out',
    // or
    easing: 'linear',
    // or custom cubic-bezier
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
});
```

#### Chaining

```javascript
// Methods return the instance for chaining
window.USAL.config({ defaults: { duration: 500 } })
  .restart()
  .config({ once: true });
```

### 🎯 Custom IDs

```html
<!-- Auto-generated ID (re-animates on re-render) -->
<div data-usal="fade-u">Auto ID</div>

<!-- Fixed ID (prevents re-animation) -->
<div data-usal="fade-u" data-usal-id="hero-section">Fixed ID</div>
```

# 🚀 Advanced Options

#### Custom Timeline Animation

Create precise keyframe animations using the `line-[{value}]` syntax. This overrides standard animations with custom timeline definitions.

```
line-[{timeline}]
```

**Timeline Syntax:**

- Properties (case-insensitive): `o` (opacity), `s/sx/sy/sz` (scale), `t/tx/ty/tz` (translate), `r/rx/ry/rz` (rotate), `b` (blur), `g` (glow), `w` (font weight), `p` (perspective)
- Values: `+` or `-` followed by number
- Keyframes: Use `|` to separate, with optional percentage prefix
- Formatting: Spaces and line breaks are allowed for better organization

**Property Reference:**

- `o±value`: Opacity (0-100, auto-clamped, divided by 100)
- `s±value`: Scale (X and Y axes)
- `sx±value`: ScaleX only
- `sy±value`: ScaleY only
- `sz±value`: ScaleZ only
- `t±value`: Translate (X only, %)
- `tx±value`: TranslateX (%)
- `ty±value`: TranslateY (%)
- `tz±value`: TranslateZ (%)
- `r±value`: Rotate (Z-axis, degrees)
- `rx±value`: RotateX (degrees)
- `ry±value`: RotateY (degrees)
- `rz±value`: RotateZ (degrees)
- `b±value`: Blur (rem, negatives become 0)
- `g±value`: Glow (brightness) (%, negatives become 0)
- `w±value`: Weight (font weight) (100-900, negatives become 0)
- `p±value`: Perspective (rem)

**⚠️ Important Notes:**

**Order Matters:** Transforms are applied in the order they appear

```html
<!-- Different results! -->
<div data-usal="line-[r+45tx+50]">Rotate then translate</div>
<div data-usal="line-[tx+50r+45]">Translate then rotate</div>
```

**Avoid Conflicts:** Don't mix general and axis-specific properties

```html
<!-- ❌ Conflict: s and sx both affect X scale -->
<div data-usal="line-[s+0.5sx+0.8]">Conflicting scales</div>

<!-- ✅ Better: use specific axes -->
<div data-usal="line-[sx+0.5sy+0.8]">Clear intent</div>
```

**Duplicate Properties:** Last value wins

```html
<!-- Final opacity will be 0.8 -->
<div data-usal="line-[o+50o+80]">Duplicate opacity</div>

<!-- Use pipes for multiple keyframes instead -->
<div data-usal="line-[|50o+50|o+80]">Proper keyframes</div>
```

**Keyframe Rules:**

1. **No pipes:** Animates FROM specified value TO original state

   ```html
   <!-- 0%: opacity 0, 100%: original -->
   <div data-usal="line-[o+0]">Fade in</div>

   <!-- 0%: scale 0.3 (X and Y), 100%: original -->
   <div data-usal="line-[s+0.3]">Scale up</div>
   ```

2. **One pipe:** Animates FROM original state TO specified value

   ```html
   <!-- 0%: original, 100%: opacity 0.2 -->
   <div data-usal="line-[|o+20]">Fade to 20%</div>

   <!-- With percentage: 0%: original, 60%: opacity 0.4, 100%: opacity 0.4 -->
   <div data-usal="line-[|60o+40]">Fade at 60%</div>
   ```

3. **Multiple pipes (2+):** Multi-step animation with auto-copy behavior

   ```html
   <!-- 0%: opacity 0.3 (copy of 40%), 40%: opacity 0.3, 100%: opacity 0.7 -->
   <div data-usal="line-[|40o+30|o+70]">Two pipes</div>

   <!-- 0%: opacity 0.1 (copy of 20%), 20%: opacity 0.1, 50%: opacity 0.6, 70%: opacity 0.8, 100%: opacity 0.8 (copy of 70%) -->
   <div data-usal="line-[|20o+10|50o+60|70o+80]">Multi-step fade</div>
   ```

**Complex Examples:**

```html
<!-- Text Effects -->
<div data-usal="line-[w+100|50w+900|w+100] loop linear split-letter">Fluid Text</div>
<div data-usal="line-[o+50g+100|50o+100g+130|o+50g+100] loop linear split-letter">Shimmer Text</div>

<!-- Multi-line formatting for readability -->
<div
  data-usal="line-[
  O+0 SX+0.2 SY+0.2 TX+70 |
  40 O+50 SX+0.8 SY+0.8 TX+35 |
  70 O+90 SX+0.95 SY+0.95 TX+5 |
  O+100 SX+1 SY+1 TX+0
]"
>
  Complex entrance (case-insensitive)
</div>

<!-- 3D transformation with order consideration -->
<div
  data-usal="line-[
  p+100 rx+0 ry+0 sx+0.3 sy+0.3 |
  25 rx+90 sx+0.6 sy+0.6 |
  50 rx+180 ry+90 sx+1 sy+1 |
  75 rx+270 ry+180 |
  rx+360 ry+360
]"
>
  3D flip sequence
</div>

<!-- Combine with other modifiers -->
<div data-usal="line-[o+0s+0.5|50s+1.2|o+100s+1] duration-2000 easing-[cubic-bezier(0.4,0,0.2,1)]">
  Custom timeline with duration and easing
</div>

<!-- Opacity auto-clamping examples -->
<div data-usal="line-[o-50]">Same as o+0 (negative becomes 0)</div>
<div data-usal="line-[o+150]">Same as o+100 (clamped to max)</div>
```

> **⚠️ Important:** When `line-[{value}]` is defined, standard animation classes (fade, zoomin, etc.) are ignored. The custom timeline takes complete control of the animation.

#### Animation Tuning

Fine-tune standard animations with numeric parameters.

```
{animation}-{direction}-{value1}-{value2}-{value3}
```

**Default Values:**

- **Normal animations:**
  - Fade/Zoom movement: 15%
  - Zoom intensity: 15%
- **Split animations (word/letter):**
  - Fade/Zoom movement: 50%
  - Zoom intensity: 50%
- **Flip (both):**
  - Angle: 90°
  - Perspective: 25rem

**Parameter Interpretation:**

**Fade:** Controls movement distance

- 1 value: `fade-40` → 40% distance (default: 25%)
- 2 values: `fade-30-60` → X: 30%, Y: 60%

**Zoom:** Controls scale and movement

- 1 value: `zoomin-30` → 30% intensity (default: 25%)
- 2 values: `zoomin-40-60` → movement: 40%, intensity: 60%
- 3 values: `zoomin-30-50-80` → X: 30%, Y: 50%, intensity: 80%

**Flip:** Controls rotation and 3D depth

- 1 value: `flip-120` → 120° angle (default: 90°)
- 2 values: `flip-90-60` → angle: 90°, perspective: 60rem (default: 25rem)

```html
<!-- Subtle animations -->
<div data-usal="fade">Default 25% movement</div>
<div data-usal="fade-10">Subtle 10% movement</div>

<!-- Dramatic animations -->
<div data-usal="zoomin">Default 25% intensity</div>
<div data-usal="zoomin-75">Dramatic 75% intensity</div>

<!-- Complex multi-value tuning -->
<div data-usal="fade-dr-60-40">Diagonal fade (X: 60%, Y: 40%)</div>
<div data-usal="zoomout-20-30-70">Complex zoom (X: 20%, Y: 30%, intensity: 70%)</div>

<!-- Flip variations -->
<div data-usal="flip">Default 90° angle, 25rem perspective</div>
<div data-usal="flip-180-50">Full flip, deeper perspective</div>
<div data-usal="flip-udlr-120-80">Multi-direction flip, custom angle and perspective</div>
```
