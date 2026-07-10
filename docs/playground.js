const Playground = (() => {
  const state = {
    editor: null,
    centralHTML: '<div>Hello USAL!</div>',
    config: {
      animationType: '',
      splitType: '',
      textEffect: '',
      countTarget: '',
      duration: '1000',
      delay: '0',
      threshold: '10',
      splitDelay: '50',
      splitDelayStagger: '',
      easing: '',
      blur: '',
      once: false,
      fontFamily: '',
      fontWeight: '',
      fontSize: '',
      tuning1: '',
      tuning2: '',
      tuning3: '',
      timeline: '',
      loop: false,
      loopType: 'mirror',
      forwards: false,
    },
  };

  const DEFAULTS = {
    duration: '1000',
    delay: '0',
    threshold: '10',
    splitDelay: '50',
    loopType: 'mirror',
  };

  const presets = {
    hero: {
      html: '<h1 data-usal="fade-d duration-1000 blur">Welcome to USAL</h1>',
      animationType: 'fade-d',
      duration: '1000',
      blur: 'blur',
    },
    cards: {
      html: `<div class="cards" style="display: flex" data-usal="split-item fade-u split-delay-100 duration-800">
    <div class="card">
        <h3>Card 1</h3>
        <p>Description text</p>
    </div>
    <div class="card">
        <h3>Card 2</h3>
        <p>Description text</p>
    </div>
    <div class="card">
        <h3>Card 3</h3>
        <p>Description text</p>
    </div>
</div>`,
      splitType: 'split-item',
      animationType: 'fade-u',
      splitDelay: '100',
      duration: '800',
    },
    counter: {
      html: '<p data-usal="count-[21 000 000.00] duration-5000" style="font-family: \'Montserrat\', sans-serif">In 2025, we will earn US$21 000 000.00 in the first quarter alone.</p>',
      countTarget: '21 000 000.00',
      duration: '5000',
      fontFamily: "'Montserrat', sans-serif",
    },
    shimmer: {
      html: '<h1 data-usal="split-letter text-shimmer duration-2000 split-delay-50" style="font-family: \'Montserrat\', sans-serif; font-weight: 700">SHIMMER EFFECT</h1>',
      textEffect: 'text-shimmer',
      splitType: 'split-letter',
      duration: '2000',
      splitDelay: '50',
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: '700',
    },
    fluid: {
      html: '<h1 data-usal="split-letter text-fluid duration-2000 split-delay-50" style="font-family: \'Montserrat\', sans-serif; font-weight: 100">Fluid Weight Animation</h1>',
      textEffect: 'text-fluid',
      splitType: 'split-letter',
      duration: '2000',
      splitDelay: '50',
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: '100',
    },
    paragraph: {
      html: '<p data-usal="split-word fade-u split-delay-50 duration-800">Modern web development is all about creating smooth, engaging user experiences that delight visitors.</p>',
      splitType: 'split-word',
      animationType: 'fade-u',
      splitDelay: '50',
      duration: '800',
    },
    tuning: {
      html: '<h1 data-usal="zoomin-30-50-80 duration-1500">Tuned Animation</h1>',
      animationType: 'zoomin',
      tuning1: '30',
      tuning2: '50',
      tuning3: '80',
      duration: '1500',
    },
    timeline: {
      html: `<div style="
    width: 100px;
    height: 100px;
    background: #bebebe12;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 18px;
    border: 1px solid;
    box-shadow: 0 10px 30px rgb(91 91 91 / 50%);
  " data-usal="line-[p+150 ry+0 | 20 ry+1440 | 50 ry+2160 | 80 ry+2340 | 95 ry+2430 rx+30 | ry+2440 rx+90] duration-5000 forwards">BANG!</div>`,
      timeline:
        'p+150 ry+0 | 20 ry+1440 | 50 ry+2160 | 80 ry+2340 | 95 ry+2430 rx+30 | ry+2440 rx+90',
      duration: '5000',
      forwards: true,
    },
    loop: {
      html: '<div class="pulse" data-usal="fade loop duration-1000">Continuous Loop</div>',
      animationType: 'fade',
      loop: true,
      loopType: 'mirror',
      duration: '1000',
    },
    stagger: {
      html: `<ul data-usal="split-item zoomin split-delay-100-center duration-800">
    <li>First item</li>
    <li>Second item</li>
    <li>Third item</li>
    <li>Fourth item</li>
    <li>Fifth item</li>
</ul>`,
      splitType: 'split-item',
      animationType: 'zoomin',
      splitDelay: '100',
      splitDelayStagger: 'center',
      duration: '800',
    },
  };

  // ============================================================================
  // Toast / status feedback
  // ============================================================================
  let toastEl = null;
  let toastTimer = null;

  function showToast(message, type = 'info') {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pg-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.className = `pg-toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2200);
  }

  // ============================================================================
  // Update queue (coalesced + serialized)
  // ============================================================================
  let updating = false;
  let pending = null;

  async function requestUpdate(source) {
    pending = source;
    if (updating) return;
    updating = true;
    try {
      while (pending !== null) {
        const src = pending;
        pending = null;
        // Drop stale queued sources: only the latest matters since each run
        // recomputes the full state from the live editor/controls.
        await processUpdate(src);
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast(`Update failed: ${error.message}`, 'error');
    } finally {
      updating = false;
    }
  }

  function processUpdate(source) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        try {
          if (source === 'editor') {
            state.centralHTML = state.editor.getValue();
            parseHTMLToConfig();
            syncControlsFromConfig();
          } else if (source === 'controls') {
            readControlsToConfig();
            updateCentralHTML();
            syncEditorFromHTML();
          } else if (source === 'preset' || source === 'init' || source === 'reset') {
            parseHTMLToConfig();
            syncEditorFromHTML();
            syncControlsFromConfig();
          }

          updateGeneratedCode();
          renderPreview();
        } catch (error) {
          console.error('Error in processUpdate:', error);
        } finally {
          resolve();
        }
      });
    });
  }

  function init() {
    try {
      initEditor();
      attachEventListeners();
      const loaded = loadFromURL();
      if (!loaded) requestUpdate('init');
    } catch (error) {
      console.error('Playground init error:', error);
      showToast(`Failed to start playground: ${error.message}`, 'error');
    }
  }

  function initEditor() {
    if (typeof CodeMirror === 'undefined') {
      throw new Error('CodeMirror failed to load (CDN blocked?).');
    }
    state.editor = CodeMirror(document.getElementById('editor'), {
      value: state.centralHTML,
      mode: 'xml',
      theme: 'yonce',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentWithTabs: false,
    });

    // Guard synchronously: change fires during setValue while the flag is
    // still true, so programmatic updates never re-trigger the editor source.
    let programmaticChange = false;
    const debouncedEditorUpdate = debounce(() => requestUpdate('editor'), 500);

    state.editor.on('change', () => {
      if (programmaticChange) return;
      debouncedEditorUpdate();
    });

    state.editor.setValueSilently = function (value) {
      programmaticChange = true;
      this.operation(() => this.setValue(value));
      programmaticChange = false;
    };
  }

  function attachEventListeners() {
    Object.keys(state.config).forEach((key) => {
      const element = document.getElementById(key);
      if (!element) return;
      const eventType = element.type === 'checkbox' ? 'change' : 'input';
      element.addEventListener(
        eventType,
        debounce(() => requestUpdate('controls'), 300)
      );
    });

    document.getElementById('replayBtn')?.addEventListener('click', replay);
    document.getElementById('resetBtn')?.addEventListener('click', reset);
    document.getElementById('shareBtn')?.addEventListener('click', share);
    document.getElementById('copyBtn')?.addEventListener('click', copyCode);

    document.getElementById('easing')?.addEventListener('change', (e) => {
      const customField = document.getElementById('easingCustom');
      if (customField) customField.style.display = e.target.value === 'custom' ? 'block' : 'none';
      requestUpdate('controls');
    });

    document.getElementById('easingCustom')?.addEventListener(
      'input',
      debounce(() => requestUpdate('controls'), 300)
    );

    document.getElementById('animationType')?.addEventListener('change', (e) => {
      const timelineSection = document.getElementById('customTimelineSection');
      if (timelineSection) {
        timelineSection.style.display = e.target.value === 'custom-timeline' ? 'block' : 'none';
      }
      requestUpdate('controls');
    });

    document.getElementById('splitType')?.addEventListener('change', (e) => {
      const staggerSection = document.getElementById('splitDelayStaggerSection');
      if (staggerSection) staggerSection.style.display = e.target.value ? 'block' : 'none';
      requestUpdate('controls');
    });

    document.getElementById('loop')?.addEventListener('change', (e) => {
      const loopTypeSection = document.getElementById('loopTypeSection');
      if (loopTypeSection) loopTypeSection.style.display = e.target.checked ? 'block' : 'none';
      requestUpdate('controls');
    });

    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    // Replay shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        replay();
      }
    });

    // Replay when the preview enters the viewport again is unnecessary; the
    // explicit button + shortcut covers the "re-trigger" use case.
    window.addEventListener('hashchange', () => loadFromURL());
  }

  // ============================================================================
  // HTML <-> Config parsing (scoped to the first [data-usal] tag)
  // ============================================================================

  function findTagStart(html, fromIdx) {
    let i = fromIdx;
    while (i > 0) {
      const lt = html.lastIndexOf('<', i);
      if (lt === -1) return -1;
      const next = html[lt + 1];
      if (next && /[a-zA-Z]/.test(next)) return lt; // a real tag opener
      i = lt - 1; // skip comments / stray '<'
    }
    return -1;
  }

  // Returns the opening tag string + span for the first element carrying
  // data-usal; falls back to the first tag if none has it.
  function getTargetTag(html) {
    const usalIdx = html.search(/data-usal="[^"]*"/);
    let start;
    if (usalIdx !== -1) {
      start = findTagStart(html, usalIdx);
      if (start === -1) return null;
    } else {
      const m = html.match(/<[a-zA-Z][^>]*>/);
      if (!m) return null;
      start = m.index;
    }
    const end = html.indexOf('>', start) + 1;
    if (end <= 0) return null;
    return { open: html.slice(start, end), start, end };
  }

  function resetConfig() {
    Object.keys(state.config).forEach((key) => {
      if (typeof state.config[key] === 'boolean') {
        state.config[key] = false;
      } else {
        state.config[key] = '';
      }
    });
    Object.assign(state.config, DEFAULTS);
  }

  function parseHTMLToConfig() {
    const target = getTargetTag(state.centralHTML);
    resetConfig();

    if (!target) return;

    const usalMatch = target.open.match(/data-usal="([^"]*)"/);
    if (!usalMatch) return;

    parseDataUsalToConfig(usalMatch[1]);

    const styleMatch = target.open.match(/style="([^"]*)"/);
    if (styleMatch) {
      const styles = styleMatch[1];
      const fontFamilyMatch = styles.match(/font-family:\s*([^;]+)/);
      if (fontFamilyMatch) state.config.fontFamily = fontFamilyMatch[1].trim();
      const fontWeightMatch = styles.match(/font-weight:\s*([^;]+)/);
      if (fontWeightMatch) state.config.fontWeight = fontWeightMatch[1].trim();
      const fontSizeMatch = styles.match(/font-size:\s*(\d+)px/);
      if (fontSizeMatch) state.config.fontSize = fontSizeMatch[1];
    }
  }

  // Split a data-usal value into tokens, keeping bracketed spans (count-[...],
  // line-[...], easing-[...]) intact even when they contain spaces.
  function tokenizeDataUsal(value) {
    const tokens = [];
    let cur = '';
    let depth = 0;
    for (const ch of value.trim()) {
      if (ch === '[') {
        depth++;
        cur += ch;
      } else if (ch === ']') {
        depth = Math.max(0, depth - 1);
        cur += ch;
      } else if (/\s/.test(ch) && depth === 0) {
        if (cur) {
          tokens.push(cur);
          cur = '';
        }
      } else {
        cur += ch;
      }
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  function parseDataUsalToConfig(dataUsal) {
    if (!dataUsal) return;

    const tokens = tokenizeDataUsal(dataUsal);
    const newConfig = { ...state.config };
    resetConfigInto(newConfig);

    let hasSplitAnimation = false;

    for (const token of tokens) {
      if (token.startsWith('split-')) {
        const splitPart = token.replace('split-', '');

        if (['word', 'letter', 'item'].includes(splitPart)) {
          newConfig.splitType = token;
        } else if (splitPart.startsWith('delay-')) {
          const delayParts = splitPart.replace('delay-', '').split('-');
          newConfig.splitDelay = delayParts[0];
          if (delayParts[1] && ['linear', 'center', 'edges', 'random'].includes(delayParts[1])) {
            newConfig.splitDelayStagger = delayParts[1];
          }
        } else if (splitPart.match(/^(fade|zoomin|zoomout|flip)/)) {
          hasSplitAnimation = true;
          applyAnimationToken(newConfig, splitPart);
        }
        continue;
      }

      if (
        !hasSplitAnimation &&
        token.match(/^(fade|zoomin|zoomout|flip|slide)(-[udlr]{1,2})?(-\d+)?(-\d+)?(-\d+)?$/)
      ) {
        applyAnimationToken(newConfig, token);
        continue;
      }

      if (token.startsWith('line-[') && token.endsWith(']')) {
        newConfig.timeline = token.slice(6, -1);
        newConfig.animationType = 'custom-timeline';
        continue;
      }

      if (token === 'loop' || token === 'loop-mirror') {
        newConfig.loop = true;
        newConfig.loopType = 'mirror';
        continue;
      }
      if (token === 'loop-jump') {
        newConfig.loop = true;
        newConfig.loopType = 'jump';
        continue;
      }
      if (token === 'forwards') {
        newConfig.forwards = true;
        continue;
      }
      if (token === 'text-shimmer' || token === 'text-fluid') {
        newConfig.textEffect = token;
        continue;
      }
      if (token.startsWith('count-[') && token.endsWith(']')) {
        newConfig.countTarget = token.slice(7, -1);
        continue;
      }
      if (token.startsWith('duration-')) {
        newConfig.duration = token.replace('duration-', '');
        continue;
      }
      if (token.startsWith('delay-')) {
        newConfig.delay = token.replace('delay-', '').split('-')[0];
        continue;
      }
      if (token.startsWith('threshold-')) {
        newConfig.threshold = token.replace('threshold-', '');
        continue;
      }
      if (token.startsWith('easing-[') && token.endsWith(']')) {
        newConfig.easing = token;
        const easingCustomEl = document.getElementById('easingCustom');
        const easingEl = document.getElementById('easing');
        if (easingCustomEl) easingCustomEl.value = token.slice(8, -1);
        if (easingEl) easingEl.value = 'custom';
        continue;
      }
      if (
        ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].includes(
          token
        )
      ) {
        newConfig.easing = token;
        continue;
      }
      if (token === 'blur') {
        newConfig.blur = 'blur';
        continue;
      }
      if (token.match(/^blur-(\d+(\.\d+)?)$/)) {
        newConfig.blur = token;
        continue;
      }
      if (token === 'once') {
        newConfig.once = true;
      }
    }

    state.config = newConfig;
  }

  function resetConfigInto(cfg) {
    Object.keys(cfg).forEach((key) => {
      if (typeof cfg[key] === 'boolean') {
        cfg[key] = false;
      } else if (!Object.keys(DEFAULTS).includes(key)) {
        cfg[key] = '';
      }
    });
    Object.assign(cfg, DEFAULTS);
  }

  function applyAnimationToken(cfg, token) {
    const parts = token.split('-');
    const baseAnim = parts[0];
    let direction = '';
    let tuningStartIndex = 1;

    if (parts[1] && /^[udlr]{1,2}$/.test(parts[1])) {
      direction = '-' + parts[1];
      tuningStartIndex = 2;
    }

    cfg.animationType = baseAnim + direction;
    cfg.tuning1 = '';
    cfg.tuning2 = '';
    cfg.tuning3 = '';

    const numbers = parts.slice(tuningStartIndex).filter((p) => /^\d+$/.test(p));
    if (numbers[0]) cfg.tuning1 = numbers[0];
    if (numbers[1]) cfg.tuning2 = numbers[1];
    if (numbers[2]) cfg.tuning3 = numbers[2];
  }

  function readControlsToConfig() {
    Object.keys(state.config).forEach((key) => {
      const element = document.getElementById(key);
      if (!element) return;
      if (element.type === 'checkbox') {
        state.config[key] = element.checked;
      } else {
        state.config[key] = element.value;
      }
    });

    const easingSelect = document.getElementById('easing');
    if (easingSelect?.value === 'custom') {
      const customValue = document.getElementById('easingCustom')?.value;
      state.config.easing = customValue ? `easing-[${customValue}]` : '';
    } else if (easingSelect?.value) {
      state.config.easing = easingSelect.value;
    }

    const loopTypeSelect = document.getElementById('loopType');
    if (loopTypeSelect) state.config.loopType = loopTypeSelect.value || 'mirror';

    const splitDelayStaggerSelect = document.getElementById('splitDelayStagger');
    if (splitDelayStaggerSelect)
      state.config.splitDelayStagger = splitDelayStaggerSelect.value || '';
  }

  function parseStyleString(s) {
    const obj = {};
    (s || '').split(';').forEach((decl) => {
      const [prop, value] = decl.split(':').map((x) => x?.trim());
      if (prop && value) obj[prop] = value;
    });
    return obj;
  }

  function styleToString(obj) {
    return Object.entries(obj)
      .map(([prop, value]) => `${prop}: ${value}`)
      .join('; ');
  }

  function injectAttrs(tag, attrs) {
    const selfClose = tag.endsWith('/>');
    const closer = selfClose ? '/>' : '>';
    let core = tag.replace(/\/?>$/, '').replace(/\s+$/, '');
    if (attrs.length) core += ' ' + attrs.join(' ');
    return core + closer;
  }

  function updateCentralHTML() {
    const dataUsal = generateDataUsal();
    const target = getTargetTag(state.centralHTML);

    if (!target) {
      // Plain text with no tag — wrap it so we can attach attributes.
      const attrs = [];
      if (dataUsal) attrs.push(`data-usal="${dataUsal}"`);
      const styles = generateStyles();
      if (styles) attrs.push(`style="${styles}"`);
      if (attrs.length) state.centralHTML = `<div ${attrs.join(' ')}>${state.centralHTML}</div>`;
      return;
    }

    let tag = target.open;
    const styleMatch = tag.match(/style="([^"]*)"/);
    const styleObj = styleMatch ? parseStyleString(styleMatch[1]) : {};

    if (state.config.fontFamily) styleObj['font-family'] = state.config.fontFamily;
    else delete styleObj['font-family'];
    if (state.config.fontWeight) styleObj['font-weight'] = state.config.fontWeight;
    else delete styleObj['font-weight'];
    if (state.config.fontSize) styleObj['font-size'] = `${state.config.fontSize}px`;
    else delete styleObj['font-size'];

    const styleStr = styleToString(styleObj);

    // Remove existing data-usal + style from this tag only.
    tag = tag.replace(/\s*data-usal="[^"]*"/, '').replace(/\s*style="[^"]*"/, '');

    const attrs = [];
    if (dataUsal) attrs.push(`data-usal="${dataUsal}"`);
    if (styleStr) attrs.push(`style="${styleStr}"`);

    const newTag = injectAttrs(tag, attrs);
    state.centralHTML =
      state.centralHTML.slice(0, target.start) + newTag + state.centralHTML.slice(target.end);
  }

  function syncEditorFromHTML() {
    if (!state.editor || state.editor.getValue() === state.centralHTML) return;
    const cursor = state.editor.getCursor();
    const scrollInfo = state.editor.getScrollInfo();
    state.editor.setValueSilently(state.centralHTML);
    state.editor.setCursor(cursor);
    state.editor.scrollTo(scrollInfo.left, scrollInfo.top);
  }

  function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    // Keep the current selection when value is empty, and only update when
    // the option actually exists (avoid silently resetting to the first option).
    if (value && [...el.options].some((opt) => opt.value === value)) {
      el.value = value;
    } else if (!value) {
      el.value = '';
    }
  }

  function syncControlsFromConfig() {
    Object.keys(state.config).forEach((key) => {
      const element = document.getElementById(key);
      if (!element) return;
      if (element.type === 'checkbox') {
        element.checked = !!state.config[key];
      } else if (element.tagName === 'SELECT') {
        setSelectValue(key, state.config[key]);
      } else {
        element.value = state.config[key];
      }
    });

    const easingSelect = document.getElementById('easing');
    const customField = document.getElementById('easingCustom');
    if (easingSelect && customField) {
      if (state.config.easing?.startsWith('easing-[')) {
        const presetMatch = [...easingSelect.options].some(
          (opt) => opt.value === state.config.easing
        );
        if (presetMatch) {
          easingSelect.value = state.config.easing;
          customField.style.display = 'none';
        } else {
          easingSelect.value = 'custom';
          customField.value = state.config.easing.slice(8, -1);
          customField.style.display = 'block';
        }
      } else {
        easingSelect.value = state.config.easing || '';
        customField.style.display = 'none';
      }
    }

    const timelineSection = document.getElementById('customTimelineSection');
    if (timelineSection) {
      timelineSection.style.display =
        state.config.animationType === 'custom-timeline' || state.config.timeline
          ? 'block'
          : 'none';
    }

    const staggerSection = document.getElementById('splitDelayStaggerSection');
    if (staggerSection) {
      staggerSection.style.display = state.config.splitType ? 'block' : 'none';
    }

    const loopTypeSection = document.getElementById('loopTypeSection');
    if (loopTypeSection) {
      loopTypeSection.style.display = state.config.loop ? 'block' : 'none';
    }
  }

  // ============================================================================
  // Code generation
  // ============================================================================

  function animationWithTuning(animationType) {
    if (!animationType || animationType === 'custom-timeline') return '';
    let animation = animationType;
    const tuningParts = [];
    if (state.config.tuning1) tuningParts.push(state.config.tuning1);
    if (state.config.tuning2) tuningParts.push(state.config.tuning2);
    if (state.config.tuning3) tuningParts.push(state.config.tuning3);
    if (tuningParts.length) animation += '-' + tuningParts.join('-');
    return animation;
  }

  function generateDataUsal() {
    const parts = [];
    const { config } = state;

    if (config.splitType) {
      parts.push(config.splitType);
      // USAL's canonical split syntax uses the bare animation name alongside
      // the split type (e.g. "split-item zoomin"), not a "split-<anim>" token.
      const anim = animationWithTuning(config.animationType);
      if (anim) parts.push(anim);

      if (config.splitDelay || config.splitDelayStagger) {
        let splitDelayStr = `split-delay-${config.splitDelay || '50'}`;
        if (config.splitDelayStagger) splitDelayStr += `-${config.splitDelayStagger}`;
        parts.push(splitDelayStr);
      }
    } else if (config.animationType && config.animationType !== 'custom-timeline') {
      const anim = animationWithTuning(config.animationType);
      if (anim) parts.push(anim);
    }

    if (config.timeline) parts.push(`line-[${config.timeline}]`);
    if (config.textEffect) parts.push(config.textEffect);
    if (config.countTarget) parts.push(`count-[${config.countTarget}]`);

    if (config.duration && config.duration !== '1000') parts.push(`duration-${config.duration}`);
    if (config.delay && config.delay !== '0') parts.push(`delay-${config.delay}`);
    if (config.threshold && config.threshold !== '10') parts.push(`threshold-${config.threshold}`);

    if (config.easing) {
      if (config.easing.startsWith('easing-[')) {
        parts.push(config.easing);
      } else if (!['', 'ease-out'].includes(config.easing)) {
        parts.push(config.easing);
      }
    }

    if (config.blur) parts.push(config.blur);
    if (config.once) parts.push('once');
    if (config.loop) {
      parts.push(config.loopType === 'jump' ? 'loop-jump' : 'loop');
    }
    if (config.forwards) parts.push('forwards');

    return parts.join(' ').trim();
  }

  function generateStyles() {
    const styles = [];
    if (state.config.fontFamily) styles.push(`font-family: ${state.config.fontFamily}`);
    if (state.config.fontWeight) styles.push(`font-weight: ${state.config.fontWeight}`);
    if (state.config.fontSize) styles.push(`font-size: ${state.config.fontSize}px`);
    return styles.join('; ');
  }

  function updateGeneratedCode() {
    const dataUsal = generateDataUsal();
    const codeElement = document.getElementById('generatedCode');
    if (codeElement) {
      codeElement.textContent = dataUsal ? `data-usal="${dataUsal}"` : 'No animation configured';
    }
  }

  // ============================================================================
  // Preview / replay
  // ============================================================================

  function renderPreview() {
    const preview = document.getElementById('preview');
    if (!preview) return;

    const temp = document.createElement('div');
    temp.innerHTML = DOMPurify.sanitize(state.centralHTML);

    const newContent = temp.innerHTML;
    if (preview.innerHTML === newContent) return;

    preview.innerHTML = '';
    while (temp.firstChild) {
      preview.appendChild(temp.firstChild);
    }
    applyTypography();
  }

  function applyTypography() {
    const preview = document.getElementById('preview');
    if (!preview) return;
    const { fontFamily, fontWeight, fontSize } = state.config;
    preview.style.fontFamily = fontFamily || '';
    preview.style.fontWeight = fontWeight || '';
    preview.style.fontSize = fontSize ? `${fontSize}px` : '';
  }

  function replay() {
    const U = globalThis.USAL;
    if (U && typeof U.restart === 'function') {
      try {
        U.restart();
        return;
      } catch (e) {
        console.warn('USAL restart failed, re-rendering instead:', e);
      }
    }
    // Fallback: re-render so the MutationObserver re-observes fresh nodes.
    const preview = document.getElementById('preview');
    if (preview) {
      const snapshot = preview.innerHTML;
      preview.innerHTML = '';
      preview.innerHTML = snapshot;
    }
  }

  // ============================================================================
  // Presets / reset
  // ============================================================================

  function reset() {
    state.centralHTML = '<div>Hello USAL!</div>';
    resetConfig();
    requestUpdate('reset');
    showToast('Reset to defaults', 'info');
  }

  function loadPreset(name) {
    const preset = presets[name];
    if (!preset) return;

    state.centralHTML = preset.html;
    resetConfig();
    Object.keys(preset).forEach((key) => {
      if (key !== 'html' && key in state.config) {
        state.config[key] = preset[key];
      }
    });

    requestUpdate('preset');
  }

  // ============================================================================
  // Share / clipboard
  // ============================================================================

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy path
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function share() {
    const config = { html: state.centralHTML, ...state.config };
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(config));
    const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
    window.history.replaceState(null, '', url);
    const ok = await copyToClipboard(url);
    showToast(
      ok ? 'Share link copied!' : 'Could not copy — URL set in address bar',
      ok ? 'success' : 'error'
    );
  }

  async function copyCode() {
    const code = document.getElementById('generatedCode')?.textContent || '';
    const ok = await copyToClipboard(code);
    showToast(ok ? 'Copied!' : 'Copy failed', ok ? 'success' : 'error');
  }

  // ============================================================================
  // URL load (with validation + sanitization)
  // ============================================================================

  const configSchema =
    typeof joi !== 'undefined' && joi
      ? joi.object({
          html: joi.string().max(50000),
          animationType: joi
            .string()
            .pattern(/^[a-zA-Z-]*$/)
            .allow(''),
          splitType: joi
            .string()
            .pattern(/^[a-zA-Z-]*$/)
            .allow(''),
          textEffect: joi
            .string()
            .pattern(/^[a-zA-Z-]*$/)
            .allow(''),
          countTarget: joi
            .string()
            .pattern(/^[0-9.,\s]*$/)
            .allow(''),
          fontFamily: joi
            .string()
            .pattern(/^('[^']+',\s*[a-zA-Z-]+)?$/)
            .allow(''),
          duration: joi.string().pattern(/^\d*$/).allow(''),
          delay: joi.string().pattern(/^\d*$/).allow(''),
          threshold: joi.string().pattern(/^\d*$/).allow(''),
          splitDelay: joi.string().pattern(/^\d*$/).allow(''),
          splitDelayStagger: joi
            .string()
            .pattern(/^[a-z]*$/i)
            .allow(''),
          fontWeight: joi.string().pattern(/^\d*$/).allow(''),
          fontSize: joi.string().pattern(/^\d*$/).allow(''),
          easing: joi.string().allow(''),
          blur: joi
            .string()
            .pattern(/^(blur(-\d+(\.\d+)?)?)?$/)
            .allow(''),
          once: joi.boolean(),
          tuning1: joi.string().pattern(/^\d*$/).allow(''),
          tuning2: joi.string().pattern(/^\d*$/).allow(''),
          tuning3: joi.string().pattern(/^\d*$/).allow(''),
          timeline: joi
            .string()
            .pattern(/^[a-z0-9\s+\-.|]*$/i)
            .allow(''),
          loop: joi.boolean(),
          loopType: joi
            .string()
            .pattern(/^(mirror|jump)$/)
            .allow(''),
          forwards: joi.boolean(),
        })
      : null;

  function validateAndSanitize(config) {
    if (!configSchema) {
      // joi didn't load — be conservative and only copy known primitive keys.
      const allowed = {};
      Object.keys(state.config).forEach((key) => {
        if (key in config) allowed[key] = config[key];
      });
      if (typeof config.html === 'string') allowed.html = config.html;
      return allowed;
    }

    const { error, value } = configSchema.validate(config, { stripUnknown: true });
    if (error) throw new Error('Invalid configuration');

    if (value.html) {
      value.html = DOMPurify.sanitize(value.html, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'ul', 'li'],
        ALLOWED_ATTR: ['class', 'id', 'data-usal', 'style'],
      });
    }
    return value;
  }

  function loadFromURL() {
    if (!window.location.hash) return false;

    try {
      const compressed = window.location.hash.slice(1);
      const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      if (!decompressed) return false;
      const rawConfig = JSON.parse(decompressed);
      const safeConfig = validateAndSanitize(rawConfig);

      if (safeConfig.html) state.centralHTML = safeConfig.html;

      Object.keys(safeConfig).forEach((key) => {
        if (key !== 'html' && key in state.config) state.config[key] = safeConfig[key];
      });

      requestUpdate('init');
      return true;
    } catch (e) {
      console.error('Failed to load configuration:', e.message);
      showToast('Could not load shared link', 'error');
      return false;
    }
  }

  // ============================================================================
  // Utils
  // ============================================================================

  function debounce(func, wait) {
    let timeout;
    return function executed(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  return {
    init,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Playground.init();
});
