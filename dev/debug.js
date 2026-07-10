const Debug = (() => {
  // ============================================================================
  // State Management
  // ============================================================================

  let lastTime = performance.now();
  let frames = 0;
  let fps = 0;

  // ============================================================================
  // Core Functions
  // ============================================================================

  async function loadUSALVersion() {
    let versionInput = document.getElementById('usal-version-input').value.trim();

    if (!versionInput) {
      document.getElementById('usal-version-input').value = '../src/usal.js';
      versionInput = '../src/usal.js';
    }

    if (window.USAL?.destroy) {
      window.USAL.destroy();
    }
    delete window.USAL;

    let scriptUrl;
    if (
      versionInput.startsWith('http') ||
      versionInput.startsWith('../') ||
      versionInput.startsWith('./')
    ) {
      scriptUrl = versionInput;
    } else if (versionInput === 'latest') {
      scriptUrl = 'https://cdn.jsdelivr.net/npm/usal@latest/usal.min.js';
    } else {
      scriptUrl = `https://cdn.jsdelivr.net/npm/usal@${versionInput}/usal.min.js`;
    }

    // USAL is ESM-only on v2+ (loaded via import). Legacy v1 builds were IIFE/UMD
    // that only set window.USAL as a side effect with no exports, so fall back to
    // the global set by the side effect when there is no `default`/named export.
    try {
      const module = await import(scriptUrl);
      window.USAL = module.default || module.USAL || window.USAL || module;
      log(`✓ USAL module loaded: ${scriptUrl}`, 'pass');
      log(`Version: ${window.USAL.version || 'Unknown'}`, 'pass');
    } catch (error) {
      log(`✗ Error loading module: ${scriptUrl} - ${error.message}`, 'fail');
    }
  }

  function forceConfig() {
    if (!window.USAL) {
      log('USAL not loaded', 'fail');
      return;
    }

    try {
      USAL.config({
        defaults: {
          animation: 'flip',
          direction: 'ur',
          duration: 2000,
          delay: 100,
          threshold: 20,
          splitDelay: 50,
          easing: 'ease-in-out',
          blur: true,
        },
        observersDelay: 100,
        once: false,
      });
      log('Config forced', 'pass');
    } catch (error) {
      log(`Failed to force config: ${error.message}`, 'fail');
    }
  }

  function applyConfig() {
    if (!window.USAL) {
      log('USAL not loaded', 'fail');
      return;
    }

    try {
      const config = {
        defaults: {
          duration: parseInt(document.getElementById('duration').value) || 1000,
          delay: parseInt(document.getElementById('delay').value) || 0,
          threshold: parseInt(document.getElementById('threshold').value) || 10,
          splitDelay: parseInt(document.getElementById('splitDelay').value) || 30,
          easing: document.getElementById('easing').value,
        },
        once: document.getElementById('once').value === 'true',
      };

      USAL.config(config);
      log('Config applied', 'pass');
    } catch (error) {
      log(`Failed to apply config: ${error.message}`, 'fail');
    }
  }

  function clearAll() {
    document.getElementById('dynamic-container').innerHTML = '';
    document.getElementById('shadow-container').innerHTML = '';
    document.getElementById('stress-container').innerHTML = '';
    log('All containers cleared', 'pass');
  }

  // ============================================================================
  // Observer Tests
  // ============================================================================

  function testObservers() {
    const container = document.getElementById('dynamic-container');
    const el = document.createElement('div');
    el.className = 'test-box';
    el.textContent = 'Mutation Test';
    container.appendChild(el);

    setTimeout(() => {
      el.setAttribute('data-usal', 'fade-u duration-500');
      log('Mutation observer test: attribute added', 'pass');
    }, 100);

    setTimeout(() => {
      el.setAttribute('data-usal', 'zoomin duration-800');
      log('Mutation observer test: attribute changed', 'pass');
    }, 500);
  }

  function testResize() {
    const container = document.getElementById('dynamic-container');
    const el = document.createElement('div');
    el.className = 'test-box';
    el.style.width = '100px';
    el.style.height = '100px';
    el.setAttribute('data-usal', 'zoomin');
    el.textContent = 'Resize Test';
    container.appendChild(el);

    setTimeout(() => {
      el.style.width = '200px';
      el.style.height = '200px';
      log('Resize observer test triggered', 'pass');
    }, 100);
  }

  function testIntersection() {
    const container = document.getElementById('dynamic-container');
    container.style.height = '200px';
    container.style.overflow = 'auto';

    const spacer = document.createElement('div');
    spacer.style.height = '500px';
    container.appendChild(spacer);

    const el = document.createElement('div');
    el.className = 'test-box';
    el.setAttribute('data-usal', 'flip-l');
    el.textContent = 'Scroll to see';
    container.appendChild(el);

    log('Intersection observer test: scroll container to test', 'warn');
  }

  function testObserverCleanup() {
    if (!window.USAL) {
      log('USAL not loaded', 'fail');
      return;
    }

    const count = document.querySelectorAll('[data-usal]').length;

    USAL.destroy?.().then(() => {
      log(`Destroyed ${count} elements`, 'pass');

      setTimeout(() => {
        USAL.restart?.().then(() => {
          log(`Restarted with ${count} elements`, 'pass');
        });
      }, 100);
    });
  }

  // ============================================================================
  // Animation State Tests
  // ============================================================================

  function inspectStates() {
    const elements = document.querySelectorAll('[data-usal]');
    const report = [];

    elements.forEach((el, i) => {
      if (i >= 10) return;
      report.push({
        element: el.tagName,
        usal: el.getAttribute('data-usal'),
        __usalID: el.__usalID ? 'present' : 'missing',
        __usalFragment: el.__usalFragment ? 'present' : 'missing',
        __usalOriginals: el.__usalOriginals ? 'present' : 'missing',
        animations: el.getAnimations ? el.getAnimations().length : 0,
      });
    });

    console.table(report);
    log(`State inspection: ${elements.length} elements inspected (see console)`, 'pass');
  }

  function forceAnimateAll() {
    document.querySelectorAll('[data-usal]').forEach((el) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    log('Forced all elements into view', 'pass');
  }

  function resetAll() {
    document.querySelectorAll('[data-usal]').forEach((el) => {
      if (el.__usalOriginals?.style) {
        Object.assign(el.style, el.__usalOriginals.style);
      }
    });
    log('Reset all elements', 'pass');
  }

  function testStateTransitions() {
    const el = document.createElement('div');
    el.className = 'test-box';
    el.textContent = 'State Test';
    el.setAttribute('data-usal', 'fade-u once');
    document.getElementById('dynamic-container').appendChild(el);

    const checkState = () => {
      const animations = el.getAnimations ? el.getAnimations() : [];
      console.log('State check:', {
        animations: animations.length,
        playState: animations[0]?.playState,
        opacity: getComputedStyle(el).opacity,
        __usalID: el.__usalID,
      });
    };

    setTimeout(checkState, 100);
    setTimeout(checkState, 500);
    setTimeout(checkState, 1500);

    log('State transition test started (see console)', 'warn');
  }

  // ============================================================================
  // Shadow DOM Tests
  // ============================================================================

  function createShadowTree() {
    const container = document.getElementById('shadow-container');
    const host = document.createElement('div');
    host.className = 'shadow-host';
    container.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .shadow-content { padding: 20px; background: #111; }
        .shadow-item { margin: 10px 0; padding: 10px; background: #1a1a1a; color: #888; }
      </style>
      <div class="shadow-content">
        <div class="shadow-item" data-usal="fade-u">Shadow Item 1</div>
        <div class="shadow-item" data-usal="zoomin delay-200">Shadow Item 2</div>
        <div class="shadow-item" data-usal="flip-r delay-400">Shadow Item 3</div>
        <p data-usal="split-word fade-l split-delay-100">Split in shadow DOM</p>
        <div data-usal="count-[999] duration-2000">Count: 999</div>
      </div>
    `;

    log('Shadow DOM tree created', 'pass');
  }

  function createNestedShadows() {
    const container = document.getElementById('shadow-container');
    const level1 = document.createElement('div');
    level1.className = 'shadow-host';
    container.appendChild(level1);

    const shadow1 = level1.attachShadow({ mode: 'open' });
    shadow1.innerHTML = `
      <div style="padding: 10px; border: 1px solid #333;">
        <div data-usal="fade-d">Level 1</div>
        <div id="level2"></div>
      </div>
    `;

    const level2 = shadow1.getElementById('level2');
    const shadow2 = level2.attachShadow({ mode: 'open' });
    shadow2.innerHTML = `
      <div style="padding: 10px; border: 1px solid #444;">
        <div data-usal="zoomin">Level 2</div>
        <div id="level3"></div>
      </div>
    `;

    const level3 = shadow2.getElementById('level3');
    const shadow3 = level3.attachShadow({ mode: 'open' });
    shadow3.innerHTML = `
      <div style="padding: 10px; border: 1px solid #555;">
        <div data-usal="flip-l">Level 3 (deepest)</div>
      </div>
    `;

    log('3-level nested shadow DOM created', 'pass');
  }

  class TestComponent extends HTMLElement {
    connectedCallback() {
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { display: block; padding: 20px; background: #111; margin: 10px 0; }
        </style>
        <div data-usal="fade-u">Web Component Content</div>
        <div data-usal="count-[42] duration-1500">Answer: 42</div>
      `;
    }
  }

  function createWebComponent() {
    if (!customElements.get('test-component')) {
      customElements.define('test-component', TestComponent);
    }
    const component = document.createElement('test-component');
    document.getElementById('shadow-container').appendChild(component);
    log('Web component created', 'pass');
  }

  function testShadowMutations() {
    const hosts = document.querySelectorAll('.shadow-host');
    hosts.forEach((host) => {
      if (host.shadowRoot) {
        const newEl = document.createElement('div');
        newEl.textContent = 'Dynamic Shadow Element';
        newEl.setAttribute('data-usal', 'fade-u duration-500');
        newEl.style.padding = '10px';
        newEl.style.background = '#222';
        newEl.style.margin = '10px 0';
        host.shadowRoot.appendChild(newEl);
      }
    });
    log(`Shadow mutations: ${hosts.length} shadow roots updated`, 'pass');
  }

  // ============================================================================
  // Performance Tests
  // ============================================================================

  function stressTest(count) {
    const container = document.getElementById('stress-container');
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'stress-grid';

    const animations = ['fade', 'zoomin', 'zoomout', 'flip'];
    const directions = ['', '-u', '-d', '-l', '-r'];

    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'stress-item';
      const anim = animations[i % animations.length];
      const dir = directions[i % directions.length];
      const delay = Math.min(i * 2, 2000);
      item.setAttribute('data-usal', `${anim}${dir} delay-${delay}`);
      grid.appendChild(item);
    }

    container.appendChild(grid);
    log(`Stress test: ${count} elements created`, 'pass');
  }

  function rapidToggle() {
    let count = 0;
    const interval = setInterval(() => {
      const elements = document.querySelectorAll('[data-usal]');
      elements.forEach((el) => {
        const current = el.getAttribute('data-usal');
        el.setAttribute('data-usal', current.includes('fade') ? 'zoomin' : 'fade');
      });
      count++;
      if (count >= 10) {
        clearInterval(interval);
        log('Rapid toggle test completed (10 cycles)', 'pass');
      }
    }, 200);
  }

  // ============================================================================
  // Memory & Cleanup Tests
  // ============================================================================

  function checkMemoryLeaks() {
    if (!performance.memory) {
      log('Memory API not available', 'warn');
      return;
    }

    const before = performance.memory.usedJSHeapSize;
    const elements = [];

    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div');
      el.setAttribute('data-usal', 'fade-u');
      document.body.appendChild(el);
      elements.push(el);
    }

    setTimeout(() => {
      elements.forEach((el) => el.remove());

      if (window.gc) {
        window.gc();
      }

      setTimeout(() => {
        const after = performance.memory.usedJSHeapSize;
        const diff = Math.round((after - before) / 1024);
        log(`Memory test: ${diff}KB difference`, diff > 1000 ? 'warn' : 'pass');
      }, 1000);
    }, 100);
  }

  function testFragmentCleanup() {
    const elementsBefore = document.querySelectorAll('[__usalFragment]').length;
    log(`Fragment cleanup: ${elementsBefore} fragments found`, 'pass');

    if (window.USAL?.destroy) {
      USAL.destroy().then(() => {
        setTimeout(() => {
          const elementsAfter = document.querySelectorAll('[__usalFragment]').length;
          log(
            `After destroy: ${elementsAfter} fragments remaining`,
            elementsAfter === 0 ? 'pass' : 'fail'
          );
        }, 100);
      });
    }
  }

  function testElementRemoval() {
    const container = document.getElementById('dynamic-container');
    const el = document.createElement('div');
    el.className = 'test-box';
    el.setAttribute('data-usal', 'fade-u');
    el.textContent = 'Will be removed';
    container.appendChild(el);

    setTimeout(() => {
      const id = el.__usalID;
      el.remove();
      setTimeout(() => {
        log(`Element removal: ID ${id} cleaned up`, 'pass');
      }, 100);
    }, 500);
  }

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  function testUnicodeHandling() {
    const container = document.getElementById('dynamic-container');
    const tests = [
      '👨‍👩‍👧‍👦 Family Emoji',
      '🏳️‍🌈 Flag',
      '한글 Korean',
      'العربية Arabic',
      '🧑🏾‍🤝‍🧑🏻 Complex',
      '𝓣𝓮𝓼𝓽 Math',
    ];

    tests.forEach((text) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = text;
      el.setAttribute('data-usal', 'split-letter fade-u split-delay-50');
      container.appendChild(el);
    });

    log('Unicode handling test: various scripts added', 'pass');
  }

  function testComplexCounts() {
    const container = document.getElementById('dynamic-container');
    const tests = [
      ['1,234,567.89', 'count-[1,234,567.89]'],
      ['€1.234.567,89', 'count-[1.234.567,89]'],
      ['1 234 567.89', 'count-[1 234 567.89]'],
      ['Score: 99.99%', 'count-[99.99]'],
      ['$42', 'count-[42]'],
    ];

    tests.forEach(([text, usal]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = text;
      el.setAttribute('data-usal', `${usal} duration-2000`);
      container.appendChild(el);
    });

    log('Complex count formats test added', 'pass');
  }

  function testCustomEasing() {
    const container = document.getElementById('dynamic-container');
    const easings = [
      'cubic-bezier(0.68,-0.55,0.265,1.55)',
      'cubic-bezier(0.25,0.46,0.45,0.94)',
      'cubic-bezier(0.86,0,0.07,1)',
      'steps(10)',
      'steps(5, jump-both)',
    ];

    easings.forEach((easing) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = easing.substring(0, 20);
      el.setAttribute('data-usal', `fade-u easing-[${easing}] duration-2000`);
      container.appendChild(el);
    });

    log('Custom easing functions test added', 'pass');
  }

  function testThresholds() {
    const container = document.getElementById('dynamic-container');
    container.style.height = '200px';
    container.style.overflow = 'auto';

    for (let i = 0; i <= 100; i += 10) {
      const spacer = document.createElement('div');
      spacer.style.height = '150px';
      container.appendChild(spacer);

      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = `Threshold ${i}%`;
      el.setAttribute('data-usal', `fade-u threshold-${i}`);
      container.appendChild(el);
    }

    log('Threshold test: scroll container to test all thresholds', 'warn');
  }

  // ============================================================================
  // Monitoring Functions
  // ============================================================================

  function updateFPS() {
    frames++;
    const currentTime = performance.now();
    if (currentTime >= lastTime + 1000) {
      fps = Math.round((frames * 1000) / (currentTime - lastTime));
      frames = 0;
      lastTime = currentTime;
      document.getElementById('fps-count').textContent = fps;
      document.getElementById('perf-fps').textContent = fps;
    }
    requestAnimationFrame(updateFPS);
  }

  function monitorInstance() {
    if (!window.USAL) return;

    const monitor = document.getElementById('instance-monitor');
    const configDisplay = document.getElementById('config-display');

    const isActive = USAL.initialized ? USAL.initialized() : false;
    document.getElementById('usal-status').textContent = isActive ? 'Active' : 'Inactive';
    document.getElementById('usal-status').className = isActive
      ? 'status-value active'
      : 'status-value inactive';
    document.getElementById('usal-version').textContent = USAL.version || 'Unknown';

    const usalElements = document.querySelectorAll('[data-usal]');
    const totalElements = usalElements.length;
    let processedElements = 0;

    usalElements.forEach((el) => {
      if (el.__usalID) {
        processedElements++;
      }
    });

    document.getElementById('element-count').textContent = `${processedElements}/${totalElements}`;
    document.getElementById('perf-elements').textContent = `${processedElements}/${totalElements}`;

    let animationCount = 0;
    const stateInfo = { idle: 0, animating: 0, completed: 0 };

    const fragmentElements = document.querySelectorAll('*');
    fragmentElements.forEach((el) => {
      if (el.__usalFragment) {
        const animations = el.getAnimations ? el.getAnimations() : [];
        const usalAnimations = animations.filter((anim) => anim.id && anim.id.startsWith('__usal'));

        animationCount += usalAnimations.length;

        if (el.__usalID) {
          const hasActiveAnimation = usalAnimations.some((anim) => anim.playState === 'running');

          if (hasActiveAnimation) {
            stateInfo.animating++;
          } else if (usalAnimations.length > 0) {
            stateInfo.completed++;
          } else {
            stateInfo.idle++;
          }
        }
      }
    });

    document.getElementById('animation-count').textContent = animationCount;

    monitor.innerHTML = `
      <div class="monitor-item">Elements tracked: ${processedElements}/${totalElements}</div>
      <div class="monitor-item">Active animations: ${animationCount}</div>
      <div class="monitor-item idle">Idle: ${stateInfo.idle}</div>
      <div class="monitor-item active">Animating: ${stateInfo.animating}</div>
      <div class="monitor-item pending">Completed: ${stateInfo.completed}</div>
    `;

    try {
      const config = USAL.config();
      configDisplay.textContent = JSON.stringify(config, null, 2);
    } catch (error) {
      configDisplay.textContent = 'Unable to retrieve config';
    }

    if (performance.memory) {
      const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      document.getElementById('perf-memory').textContent = memoryMB;
    }
  }

  function updateAnimationStates() {
    document.querySelectorAll('.test-box').forEach((el) => {
      const allElements = [el, ...el.querySelectorAll('*')];

      const hasWAAPIAnimation = allElements.some((element) => {
        const animations = element.getAnimations?.() || [];
        return animations.some((anim) => {
          const duration = anim.effect?.getTiming()?.duration;
          return anim.id?.startsWith('__usal') && duration > 1 && anim.playState === 'running';
        });
      });

      let isCountAnimating = false;
      if (el.getAttribute('data-usal')?.includes('count-')) {
        const currentText = el.textContent;
        const lastText = el.dataset.lastText;

        if (lastText && currentText !== lastText) {
          isCountAnimating = true;
        }

        el.dataset.lastText = currentText;
      }

      const hasAnimation = hasWAAPIAnimation || isCountAnimating;
      const hasFragment = allElements.some((element) => !!element.__usalFragment);

      el.classList.toggle('has-animation', hasAnimation);
      el.classList.toggle('has-fragment', hasFragment);
    });
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function log(message, type = 'pass') {
    const runner = document.getElementById('test-runner');
    const item = document.createElement('div');
    item.className = `test-result test-${type}`;
    item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    runner.insertBefore(item, runner.firstChild);

    if (runner.children.length > 10) {
      runner.removeChild(runner.lastChild);
    }

    console.log(`[${type.toUpperCase()}]`, message);
  }

  // ============================================================================
  // Loop & Blur Tests
  // ============================================================================

  function testLoopAnimations() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['fade loop', 'Continuous fade'],
      ['zoomin loop blur', 'Loop with blur'],
      ['flip-r loop duration-500', 'Fast loop'],
      ['text-shimmer split-letter', 'Auto-loop shimmer'],
      ['text-fluid split-letter', 'Auto-loop fluid'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('Loop animations test added', 'pass');
  }

  function testBlurVariations() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['fade blur', 'Default blur (0.625rem)'],
      ['fade blur-1', 'Blur 1rem'],
      ['fade blur-2', 'Blur 2rem'],
      ['fade blur-0.5', 'Blur 0.5rem'],
      ['zoomin-50 blur-3', 'Heavy blur'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('Blur variations test added', 'pass');
  }

  // ============================================================================
  // Timeline Tests
  // ============================================================================

  function testBasicTimelines() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['line-[o+0]', 'Fade in'],
      ['line-[s+0.5]', 'Scale from 0.5'],
      ['line-[tx+50]', 'Slide from right'],
      ['line-[r+360]', 'Full rotation'],
      ['line-[o+0s+0.5tx+30]', 'Complex start'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('Basic timeline tests added', 'pass');
  }

  function testKeyframeTimelines() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['line-[|o+50]', 'Fade to 50%'],
      ['line-[|50s+1.5]', 'Scale at 50%'],
      ['line-[|25o+30|50o+60|75o+90]', 'Multi-step fade'],
      ['line-[o+0|50s+1.5o+50|o+100s+1]', 'Complex sequence'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('Keyframe timeline tests added', 'pass');
  }

  function test3DTimelines() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['line-[rx+90p+50]', '3D flip X'],
      ['line-[ry+180p+100]', '3D flip Y'],
      ['line-[sx+0.5sy+2sz+1]', '3D scale'],
      ['line-[tz+100p+80]', 'Z-axis translate'],
      ['line-[rx+0ry+0|25rx+90|50ry+90|75rx+180|rx+360ry+360]', '3D spin'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('3D timeline tests added', 'pass');
  }

  function testComplexTimelines() {
    const container = document.getElementById('dynamic-container');

    // Multi-line timeline test
    const multiline = document.createElement('div');
    multiline.className = 'test-box';
    multiline.textContent = 'Multi-line timeline';
    multiline.setAttribute(
      'data-usal',
      `line-[
    o+0 sx+0.2 sy+0.2 tx+70 |
    40 o+50 sx+0.8 sy+0.8 tx+35 |
    70 o+90 sx+0.95 sy+0.95 tx+5 |
    o+100 sx+1 sy+1 tx+0
  ]`
    );
    container.appendChild(multiline);

    // Timeline with other modifiers
    const withModifiers = document.createElement('div');
    withModifiers.className = 'test-box';
    withModifiers.textContent = 'Timeline + modifiers';
    withModifiers.setAttribute(
      'data-usal',
      'line-[o+0s+0.5|50s+1.2|o+100s+1] duration-3000 easing-[cubic-bezier(0.4,0,0.2,1)]'
    );
    container.appendChild(withModifiers);

    log('Complex timeline tests added', 'pass');
  }

  // ============================================================================
  // Animation Tuning Tests
  // ============================================================================

  function testAnimationTuning() {
    const container = document.getElementById('dynamic-container');

    const tests = [
      ['fade-10', 'Subtle fade 10%'],
      ['fade-60', 'Strong fade 60%'],
      ['fade-30-50', 'Fade X:30% Y:50%'],
      ['zoomin-15', 'Gentle zoom 15%'],
      ['zoomin-80', 'Dramatic zoom 80%'],
      ['zoomin-40-60', 'Zoom move:40% scale:60%'],
      ['zoomin-30-50-80', 'Zoom X:30% Y:50% scale:80%'],
      ['flip-120', 'Flip 120°'],
      ['flip-180-60', 'Flip 180° persp:60rem'],
    ];

    tests.forEach(([usal, label]) => {
      const el = document.createElement('div');
      el.className = 'test-box';
      el.textContent = label;
      el.setAttribute('data-usal', usal);
      container.appendChild(el);
    });

    log('Animation tuning tests added', 'pass');
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    updateFPS();
    setInterval(monitorInstance, 100);
    setInterval(updateAnimationStates, 100);

    document.getElementById('usal-version-input').value = '../src/usal.js';
    loadUSALVersion();
    log('Debug panel initialized', 'pass');

    document.addEventListener('mouseover', (e) => {
      if (e.target.hasAttribute?.('data-usal')) {
        console.log('USAL Debug:', {
          element: e.target,
          'data-usal': e.target.getAttribute('data-usal'),
          __usalID: e.target.__usalID,
          __usalFragment: e.target.__usalFragment,
          __usalOriginals: e.target.__usalOriginals,
          animations: e.target.getAnimations ? e.target.getAnimations() : [],
          computedStyle: {
            opacity: getComputedStyle(e.target).opacity,
            transform: getComputedStyle(e.target).transform,
            filter: getComputedStyle(e.target).filter,
          },
        });
      }
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    loadUSALVersion,
    forceConfig,
    applyConfig,
    clearAll,
    testObservers,
    testResize,
    testIntersection,
    testObserverCleanup,
    inspectStates,
    forceAnimateAll,
    resetAll,
    testStateTransitions,
    createShadowTree,
    createNestedShadows,
    createWebComponent,
    testShadowMutations,
    stressTest,
    rapidToggle,
    checkMemoryLeaks,
    testFragmentCleanup,
    testElementRemoval,
    testUnicodeHandling,
    testComplexCounts,
    testCustomEasing,
    testThresholds,
    testLoopAnimations,
    testBlurVariations,
    testBasicTimelines,
    testKeyframeTimelines,
    test3DTimelines,
    testComplexTimelines,
    testAnimationTuning,
    init,
  };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Debug.init);
} else {
  Debug.init();
}
