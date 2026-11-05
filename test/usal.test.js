import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const usalSource = fs.readFileSync(new URL('../src/usal.js', import.meta.url), 'utf-8');
// Transform ESM `export default USAL;` into returnable IIFE for isolated VM contexts
const executableSource = usalSource.replace(/export\s+default\s+USAL\s*;?\s*$/, 'USAL;');

function createBrowserEnv({ manualRAF = false } = {}) {
  const rafQueue = [];
  let now = 1000;
  const intersectionCallbacks = [];
  const mutationCallbacks = [];
  const resizeCallbacks = [];

  class MockNode {
    constructor(nodeType, text = '') {
      this.nodeType = nodeType;
      this._textContent = text;
      this.childNodes = [];
      this.parentNode = null;
      this.isConnected = false;
    }

    get textContent() {
      if (this.nodeType === 3) return this._textContent;
      return this.childNodes.map((c) => c.textContent).join('');
    }

    set textContent(val) {
      this._textContent = String(val ?? '');
      this.childNodes = [];
      if (this.nodeType === 1 && this._textContent) {
        const textNode = new MockNode(3, this._textContent);
        textNode.parentNode = this;
        textNode.isConnected = this.isConnected;
        this.childNodes.push(textNode);
      }
    }
  }

  class MockElement extends MockNode {
    constructor(tagName = 'DIV') {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.animations = [];
      this.rect = { left: 10, top: 10, right: 110, bottom: 60, width: 100, height: 50 };
      this.computedStyle = {
        opacity: '1',
        transform: 'none',
        filter: 'none',
        perspective: 'none',
        fontWeight: '400',
      };
      this.shadowRoot = null;
    }

    get children() {
      return this.childNodes.filter((n) => n.nodeType === 1);
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx !== -1) child.parentNode.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this._setConnectedRecursive(child, this.isConnected);
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) this.childNodes.splice(idx, 1);
      child.parentNode = null;
      this._setConnectedRecursive(child, false);
      return child;
    }

    replaceChild(newChild, oldChild) {
      const idx = this.childNodes.indexOf(oldChild);
      if (idx === -1) throw new Error('Node not found');
      oldChild.parentNode = null;
      this._setConnectedRecursive(oldChild, false);
      newChild.parentNode = this;
      this._setConnectedRecursive(newChild, this.isConnected);
      this.childNodes[idx] = newChild;
      return oldChild;
    }

    _setConnectedRecursive(node, connected) {
      node.isConnected = connected;
      if (node.childNodes) {
        for (const c of node.childNodes) {
          this._setConnectedRecursive(c, connected);
        }
      }
    }

    getBoundingClientRect() {
      return { ...this.rect };
    }

    animate(keyframes, options = {}) {
      const anim = {
        id: options.id || '',
        keyframes,
        options,
        playState: 'running',
        currentTime: 0,
        playbackRate: 1,
        effect: { getTiming: () => options },
        timeline: {},
        play() {
          this.playState = 'running';
        },
        pause() {
          this.playState = 'paused';
        },
        persist() {},
        cancel() {
          this.playState = 'idle';
          const i = self.animations.indexOf(this);
          if (i !== -1) self.animations.splice(i, 1);
        },
      };
      const self = this;
      this.animations.push(anim);
      return anim;
    }

    getAnimations() {
      return [...this.animations];
    }

    querySelectorAll(selector) {
      const results = [];
      const visit = (node) => {
        for (const child of node.childNodes || []) {
          if (child.nodeType === 1) {
            if (selector === '[data-usal]') {
              if (child.hasAttribute('data-usal')) results.push(child);
            } else {
              results.push(child);
            }
            visit(child);
          }
        }
      };
      visit(this);
      return results;
    }
  }

  const body = new MockElement('BODY');
  body.isConnected = true;

  const document = {
    readyState: 'complete',
    body,
    addEventListener() {},
    createElement(tag) {
      return new MockElement(tag);
    },
    createTextNode(text) {
      return new MockNode(3, text);
    },
    createTreeWalker(root) {
      const textNodes = [];
      const collect = (n) => {
        for (const child of n.childNodes || []) {
          if (child.nodeType === 3) textNodes.push(child);
          else if (child.nodeType === 1) collect(child);
        }
      };
      collect(root);
      let idx = -1;
      return {
        currentNode: null,
        nextNode() {
          idx++;
          if (idx < textNodes.length) {
            this.currentNode = textNodes[idx];
            return this.currentNode;
          }
          return null;
        },
      };
    },
  };

  function requestAnimationFrame(cb) {
    if (manualRAF) {
      rafQueue.push(cb);
      return rafQueue.length;
    }
    const id = setTimeout(() => cb(now), 0);
    return id;
  }

  function cancelAnimationFrame(id) {
    if (!manualRAF) clearTimeout(id);
  }

  function flushRAF(frames = 1) {
    for (let f = 0; f < frames; f++) {
      const batch = rafQueue.splice(0, rafQueue.length);
      now += 16;
      for (const fn of batch) {
        fn(now);
      }
    }
  }

  class IntersectionObserver {
    constructor(cb) {
      this.cb = cb;
      this.observed = new Set();
      intersectionCallbacks.push(this);
    }
    observe(el) {
      this.observed.add(el);
    }
    unobserve(el) {
      this.observed.delete(el);
    }
    disconnect() {
      this.observed.clear();
    }
  }

  class MutationObserver {
    constructor(cb) {
      this.cb = cb;
      mutationCallbacks.push(this);
    }
    observe() {}
    disconnect() {}
  }

  class ResizeObserver {
    constructor(cb) {
      this.cb = cb;
      resizeCallbacks.push(this);
    }
    observe() {}
    disconnect() {}
  }

  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle(el) {
      return (
        el.computedStyle || {
          opacity: '1',
          transform: 'none',
          filter: 'none',
          perspective: 'none',
          fontWeight: '400',
        }
      );
    },
    requestAnimationFrame,
    cancelAnimationFrame,
    IntersectionObserver,
    MutationObserver,
    ResizeObserver,
  };

  const context = vm.createContext({
    window,
    document,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4 },
    IntersectionObserver,
    MutationObserver,
    ResizeObserver,
    requestAnimationFrame,
    cancelAnimationFrame,
    performance: { now: () => now },
    Intl,
    setTimeout,
    clearTimeout,
    Math,
    Date,
    Map,
    Set,
    Array,
    Object,
    Promise,
    RegExp,
    Number,
    String,
    Boolean,
    parseFloat,
    parseInt,
    isNaN,
    Infinity,
    console,
  });
  context.globalThis = context;
  window.USAL = undefined;

  const usal = vm.runInContext(executableSource, context);

  return {
    usal,
    window,
    document,
    body,
    MockElement,
    flushRAF,
    advanceTime(ms) {
      now += ms;
    },
    triggerMutation(records) {
      for (const obs of mutationCallbacks) {
        obs.cb(records);
      }
    },
    triggerResize() {
      for (const obs of resizeCallbacks) {
        obs.cb([]);
      }
    },
  };
}

test('SSR environment returns safe callable no-op stub', async () => {
  const ssrContext = vm.createContext({
    Math,
    Date,
    Object,
    Promise,
  });
  ssrContext.globalThis = ssrContext;
  const usalSSR = vm.runInContext(executableSource, ssrContext);

  assert.equal(typeof usalSSR, 'function');
  assert.equal(usalSSR.initialized(), false);
  assert.equal(Object.keys(usalSSR()).length, 0);
  assert.equal(usalSSR({ once: true }), usalSSR);
  assert.equal(usalSSR.config({ once: true }), usalSSR);
  await assert.doesNotReject(() => usalSSR.destroy());
  assert.equal(await usalSSR.restart(), usalSSR);
});

test('usal.config() returns defensive copy of defaults and supports callable shorthand', () => {
  const { usal } = createBrowserEnv({ manualRAF: true });

  const cfg1 = usal.config();
  cfg1.defaults.duration = 999999;
  cfg1.once = true;

  // Internal config must remain unmodified by external mutation of returned object
  const cfg2 = usal();
  assert.equal(cfg2.defaults.duration, 1000);
  assert.equal(cfg2.once, false);

  // Callable shorthand updates config and returns instance for chaining
  const chained = usal({ once: true, defaults: { duration: 1500, blur: 2 } });
  assert.equal(chained, usal);
  assert.equal(usal().once, true);
  assert.equal(usal().defaults.duration, 1500);
  assert.equal(usal().defaults.blur, 2);
  // Other defaults preserved
  assert.equal(usal().defaults.animation, 'fade');
});

test('applyStyles and cancelAllAnimations do not accumulate stale WAAPI animations', async () => {
  const { usal, body, MockElement, flushRAF, advanceTime } = createBrowserEnv({ manualRAF: true });

  const el = new MockElement('DIV');
  el.setAttribute('data-usal', 'fade-u duration-500');
  body.appendChild(el);

  // Run autoInit and initial element setup
  flushRAF(5);

  // Advance through animation completion + cleanup frames
  for (let i = 0; i < 60; i++) {
    advanceTime(16.67);
    flushRAF(1);
  }

  const activeStyleAnims = el.getAnimations().filter((a) => a.id && a.id.startsWith('__usal'));
  assert.ok(
    activeStyleAnims.length <= 1,
    `Expected at most 1 __usal animation after completion, got ${activeStyleAnims.length}`
  );

  // Destroy cleans up all __usal animations and fragment markers
  const destroyPromise = usal.destroy();
  await new Promise((r) => setTimeout(r, 70));
  flushRAF(4);
  await destroyPromise;

  assert.equal(el.getAnimations().length, 0);
  assert.equal(el.__usalFragment, undefined);
  assert.equal(el.__usalID, undefined);
});

test('count-[...] accurately parses thousand separators vs decimals (including 1,000 and 1,000,000)', async () => {
  const cases = [
    { attr: 'count-[1,000] duration-500', text: '1,000', expectedFinal: '1,000' },
    { attr: 'count-[42,350] duration-500', text: '42,350', expectedFinal: '42,350' },
    { attr: 'count-[1,000,000] duration-500', text: '1,000,000', expectedFinal: '1,000,000' },
    { attr: 'count-[1.000.000] duration-500', text: '1.000.000', expectedFinal: '1.000.000' },
    { attr: 'count-[98.5] duration-500', text: '98.5', expectedFinal: '98.5' },
    { attr: 'count-[0.125] duration-500', text: '0.125', expectedFinal: '0.125' },
    {
      attr: 'count-[1,234,567.89] duration-500',
      text: '$1,234,567.89',
      expectedFinal: '$1,234,567.89',
    },
    {
      attr: 'count-[1.234.567,89] duration-500',
      text: '€1.234.567,89',
      expectedFinal: '€1.234.567,89',
    },
    {
      attr: 'count-[21 000 000.00] duration-500 easing-[cubic-bezier(0.4, 0, 0.2, 1)]',
      text: 'US$21 000 000.00',
      expectedFinal: 'US$21 000 000.00',
    },
  ];

  for (const tc of cases) {
    const { body, MockElement, flushRAF, advanceTime } = createBrowserEnv({ manualRAF: true });
    const el = new MockElement('SPAN');
    el.textContent = tc.text;
    el.setAttribute('data-usal', tc.attr);
    body.appendChild(el);

    // Run autoInit + setupCount (2 rAFs) + start animation
    flushRAF(5);

    // Run animation to completion
    for (let i = 0; i < 60; i++) {
      advanceTime(16.67);
      flushRAF(1);
    }

    assert.equal(
      el.textContent,
      tc.expectedFinal,
      `Failed count for "${tc.attr}": got "${el.textContent}", expected "${tc.expectedFinal}"`
    );
  }
});

test('split-word and split-letter compute spatial stagger (center/edges/linear) after DOM mount', async () => {
  const { body, MockElement, flushRAF } = createBrowserEnv({ manualRAF: true });

  const el = new MockElement('H1');
  el.textContent = 'ABCDE';
  el.setAttribute('data-usal', 'split-letter fade-u split-delay-100-center duration-1000');
  body.appendChild(el);

  // First flush runs autoInit + setupSplit creation
  flushRAF(1);

  // Assign distinct horizontal positions to the created letter spans before the 2nd rAF resolves
  const assignRects = (node) => {
    let x = 0;
    const visit = (n) => {
      for (const c of n.childNodes || []) {
        if (c.nodeType === 1) {
          c.rect = { left: x, top: 10, right: x + 20, bottom: 30, width: 20, height: 20 };
          x += 30;
          visit(c);
        }
      }
    };
    visit(node);
  };

  // Flush the 2nd rAF where replaceChild mounts the wrapper into `el`
  flushRAF(2);
  assignRects(el);

  // Let `data.processing` Promise.then() microtask run and schedule tryAnimateIfVisible
  await Promise.resolve();
  await Promise.resolve();

  // Flush the animation start frame (`letsGo` + first tick)
  flushRAF(1);

  // Collect all animated letter spans and verify they have staggered delays from center
  const letterSpans = [];
  const collectLeafSpans = (n) => {
    for (const c of n.childNodes || []) {
      if (c.nodeType === 1) {
        if (c.children.length === 0 && c.textContent.trim().length === 1) {
          letterSpans.push(c);
        }
        collectLeafSpans(c);
      }
    }
  };
  collectLeafSpans(el);

  assert.equal(letterSpans.length, 5);

  const playStates = letterSpans.map(
    (s) => s.getAnimations().find((a) => a.options.duration > 0)?.playState
  );
  // Center letter 'C' (index 2) has 0 distance from center -> delay 0 -> running immediately!
  // Edge letters 'A' (index 0) and 'E' (index 4) have max distance -> paused waiting for stagger delay!
  assert.equal(playStates[2], 'running', 'Center letter should start running first');
  assert.equal(
    playStates[0],
    'paused',
    'Left edge letter should still be waiting for stagger delay'
  );
  assert.equal(
    playStates[4],
    'paused',
    'Right edge letter should still be waiting for stagger delay'
  );
});

test('scanAllDOMs during 2-frame async setupSplit does not drop element from tracking', () => {
  const { body, MockElement, flushRAF, triggerResize } = createBrowserEnv({ manualRAF: true });

  const el = new MockElement('P');
  el.textContent = 'Hello World';
  el.setAttribute('data-usal', 'split-word fade-u');
  body.appendChild(el);

  // Trigger autoInit (starts processElement -> setupSplit waits 2 rAFs)
  flushRAF(1);
  assert.ok(el.__usalID, 'Element should have a __usalID assigned');

  // Trigger resize observer event mid-setup (before 2 rAFs complete)
  triggerResize();

  // Complete remaining rAFs
  flushRAF(5);

  // Verify word spans were mounted and animated
  const spans = el.querySelectorAll('*');
  assert.ok(spans.length >= 3, 'Expected wrapper and word spans to be mounted and animated');
});

test('custom timeline line-[...] and animation tuning generate expected keyframes', async () => {
  const { body, MockElement, flushRAF } = createBrowserEnv({ manualRAF: true });

  const elTimeline = new MockElement('DIV');
  elTimeline.setAttribute(
    'data-usal',
    'line-[o-50 sx+0.5 | 50 o+50 g+130 b+2 | o+150 sx+1 w+700] duration-1000'
  );
  body.appendChild(elTimeline);

  const elTuning = new MockElement('DIV');
  elTuning.setAttribute('data-usal', 'zoomout-20-30-70 duration-800');
  body.appendChild(elTuning);

  flushRAF(2);
  await Promise.resolve();
  await Promise.resolve();
  flushRAF(2);

  const timelineAnim = elTimeline.getAnimations().find((a) => a.options.duration > 0);
  assert.ok(timelineAnim, 'Timeline animation should be created');
  // Opacity clamped between 0 and 1
  assert.equal(timelineAnim.keyframes[0].opacity, 0);
  assert.equal(timelineAnim.keyframes[timelineAnim.keyframes.length - 1].opacity, 1);
  assert.equal(timelineAnim.keyframes[timelineAnim.keyframes.length - 1].fontWeight, '700');

  const tuningAnim = elTuning.getAnimations().find((a) => a.options.duration > 0);
  assert.ok(tuningAnim, 'Tuning animation should be created');
  assert.ok(
    tuningAnim.keyframes[0].transform.includes('scale(1.7)'),
    `Expected scale(1.7) from 70% zoomout intensity, got ${tuningAnim.keyframes[0].transform}`
  );
});

test('split-line-[...] with internal spaces is tokenized and applied to split children', async () => {
  const { body, MockElement, flushRAF } = createBrowserEnv({ manualRAF: true });

  const el = new MockElement('DIV');
  const child1 = new MockElement('SPAN');
  child1.textContent = 'Item 1';
  const child2 = new MockElement('SPAN');
  child2.textContent = 'Item 2';
  el.appendChild(child1);
  el.appendChild(child2);

  el.setAttribute('data-usal', 'split-item split-line-[o+0 s+0.5 | 50 o+80 s+1.2 | o+100 s+1]');
  body.appendChild(el);

  flushRAF(2);
  await Promise.resolve();
  await Promise.resolve();
  flushRAF(2);

  const childAnim = child1.getAnimations().find((a) => a.options.duration > 0);
  assert.ok(childAnim, 'Split child should receive custom split-line animation');
  assert.ok(
    childAnim.keyframes.some((kf) => kf.transform && kf.transform.includes('scale(1.2)')),
    'Split child keyframes should include middle keyframe scale(1.2)'
  );
});

test('framework integrations (Svelte action, Vue directive, Angular directive) preserve and update attributes cleanly', async () => {
  // 1. Svelte action test
  const { usal: svelteAction, useUSAL: useSvelteUSAL } = await import('../src/integrations/svelte.ts');
  let attrValue = null;
  let setCalls = 0;
  const mockNode = {
    getAttribute: (k) => (k === 'data-usal' ? attrValue : null),
    setAttribute: (k, v) => {
      if (k === 'data-usal') {
        attrValue = v;
        setCalls++;
      }
    },
    removeAttribute: (k) => {
      if (k === 'data-usal') attrValue = null;
    },
  };

  const action = svelteAction(mockNode, 'zoomin');
  assert.equal(attrValue, 'zoomin');
  assert.equal(setCalls, 1);

  // Calling update with the same value should not trigger redundant setAttribute
  action.update('zoomin');
  assert.equal(setCalls, 1);

  // Calling update with new value updates attribute
  action.update('flip-r');
  assert.equal(attrValue, 'flip-r');
  assert.equal(setCalls, 2);

  action.destroy();
  assert.equal(attrValue, null);

  // Method chaining on useUSAL().config(...)
  const svelteHook = useSvelteUSAL();
  assert.ok(svelteHook.config({ once: true }), 'useUSAL().config(...) should return instance for chaining');
  assert.equal(typeof svelteHook.initialized(), 'boolean');

  // 2. Vue plugin & directive test
  const { USALPlugin } = await import('../src/integrations/vue.ts');
  let registeredDirective = null;
  const mockVueApp = {
    config: { globalProperties: {} },
    directive(name, dir) {
      if (name === 'usal') registeredDirective = dir;
    },
  };
  USALPlugin.install(mockVueApp, { once: true });
  assert.ok(registeredDirective, 'Vue v-usal directive should be registered');
  assert.deepEqual(registeredDirective.getSSRProps({ value: 'fade-u' }), { 'data-usal': 'fade-u' });

  let vueAttr = 'fade-u';
  let vueSetCalls = 0;
  const mockVueEl = {
    getAttribute: () => vueAttr,
    setAttribute: (_k, v) => {
      vueAttr = v;
      vueSetCalls++;
    },
  };
  // Updating with identical value should not call setAttribute
  registeredDirective.updated(mockVueEl, { value: 'fade-u' });
  assert.equal(vueSetCalls, 0);
  // Updating with changed value should call setAttribute
  registeredDirective.updated(mockVueEl, { value: 'zoomin-d' });
  assert.equal(vueSetCalls, 1);
  assert.equal(vueAttr, 'zoomin-d');

  // 3. Angular USALDirective & USALService test (via compiled package)
  if (fs.existsSync(new URL('../packages/angular/fesm2022/usal.mjs', import.meta.url))) {
    await import('@angular/compiler');
    const { USALDirective, USALService } = await import('../packages/angular/fesm2022/usal.mjs');

    // Case A: Element has `data-usal="zoomin-u duration-800"` and `@Input() usal` was NOT bound
    let ngAttr = 'zoomin-u duration-800';
    const mockElementRef = {
      nativeElement: {
        getAttribute: (k) => (k === 'data-usal' ? ngAttr : null),
      },
    };
    const mockRenderer = {
      setAttribute: (_el, k, v) => {
        if (k === 'data-usal') ngAttr = v;
      },
    };
    // Angular's isPlatformBrowser('browser') returns true for PLATFORM_BROWSER_ID ('browser')
    const dirPreserved = new USALDirective(mockElementRef, mockRenderer, 'browser');
    dirPreserved.ngOnInit();
    assert.equal(
      ngAttr,
      'zoomin-u duration-800',
      'Angular directive must NOT overwrite existing data-usal with default "fade" when [usal] input is not set'
    );

    // Case B: Dynamic [usal] change via ngOnChanges updates attribute
    dirPreserved.usal = 'flip-l delay-200';
    dirPreserved.ngOnChanges({ usal: { currentValue: 'flip-l delay-200' } });
    assert.equal(ngAttr, 'flip-l delay-200');

    const service = new USALService();
    assert.ok(service.config({ once: true }));
    assert.equal(typeof service.version, 'string');
  }
});

test('replacing [data-usal] element in container within same MutationObserver batch animates on every replacement', async () => {
  const { body, MockElement, flushRAF, triggerMutation } = createBrowserEnv({ manualRAF: true });

  const container = new MockElement('DIV');
  body.appendChild(container);

  const el1 = new MockElement('H1');
  el1.setAttribute('data-usal', 'fade-d duration-800');
  container.appendChild(el1);

  flushRAF(5);
  assert.ok(el1.__usalID, 'First element should be processed');

  await new Promise((r) => setTimeout(r, 60));

  // Replace el1 with el2 in the same MutationObserver batch (remove + add)
  container.removeChild(el1);
  const el2 = new MockElement('DIV');
  el2.setAttribute('data-usal', 'zoomin duration-800');
  container.appendChild(el2);

  triggerMutation([
    { type: 'childList', target: container, addedNodes: [], removedNodes: [el1] },
    { type: 'childList', target: container, addedNodes: [el2], removedNodes: [] },
  ]);

  flushRAF(5);
  assert.ok(
    el2.__usalID,
    'Second element replaced in same mutation batch must be processed on the 1st replacement'
  );
});


