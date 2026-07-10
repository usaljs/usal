// noinspection JSBitwiseOperatorUsage

const USAL = (() => {
  // Return existing instance (re-imports / HMR / multiple module instances)
  if (typeof globalThis !== 'undefined' && globalThis.USAL) {
    return globalThis.USAL;
  }

  // SSR safety: no browser environment available. The stub is callable too,
  // so `import usal from 'usal'; usal({...})` is a safe no-op on the server.
  if (typeof window === 'undefined') {
    const noop = function usalSSR() {
      return arguments.length === 0 ? noop.config() : noop.config(arguments[0]);
    };
    noop.config = function () {
      return arguments.length === 0 ? {} : noop;
    };
    noop.destroy = async () => {};
    noop.restart = async function () {
      return noop;
    };
    noop.initialized = () => false;
    noop.version = '{%%VERSION%%}';
    return noop;
  }

  // ============================================================================
  // Configuration & State
  // ============================================================================

  const defaultConfig = {
    defaults: {
      animation: 'fade',
      direction: 'u',
      duration: 1000,
      delay: 0,
      threshold: 10,
      splitDelay: 30,
      forwards: false,
      easing: 'ease-out',
      blur: false,
      loop: 'mirror',
    },
    observersDelay: 50,
    once: false,
  };

  const instance = {
    destroying: null,
    restarting: null,
    initialized: false,
    observers: () => {},
    elements: new Map(),
    config: { ...defaultConfig },
  };

  // ============================================================================
  // Constants
  // ============================================================================

  const SHADOW_CAPABLE_SELECTOR =
    '*:not(:is(area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr,textarea,select,option,optgroup,script,style,title,iframe,object,video,audio,canvas,map,svg,math))';

  const DATA_USAL_ATTRIBUTE = 'data-usal';
  const DATA_USAL_ID = `${DATA_USAL_ATTRIBUTE}-id`;
  const DATA_USAL_SELECTOR = `[${DATA_USAL_ATTRIBUTE}]`;

  const CONFIG_ANIMATION = 0;
  const CONFIG_DIRECTION = 1;
  const CONFIG_DURATION = 2;
  const CONFIG_DELAY = 3;
  const CONFIG_THRESHOLD = 4;
  const CONFIG_EASING = 5;
  const CONFIG_BLUR = 6;
  const CONFIG_ONCE = 7;
  const CONFIG_SPLIT = 8;
  const CONFIG_COUNT = 9;
  const CONFIG_TEXT = 10;
  const CONFIG_LOOP = 11;
  const CONFIG_FORWARDS = 12;
  const CONFIG_TUNING = 13;
  const CONFIG_LINE = 14;
  const CONFIG_STAGGER = 15;

  const DIRECTION_UP = 1;
  const DIRECTION_DOWN = 2;
  const DIRECTION_LEFT = 4;
  const DIRECTION_RIGHT = 8;

  const STYLE_OPACITY = 'opacity';
  const STYLE_TRANSFORM = 'transform';
  const STYLE_FILTER = 'filter';
  const STYLE_PERSPECTIVE = 'perspective';
  const STYLE_DISPLAY = 'display';
  const STYLE_FONT_WEIGHT = 'fontWeight';
  const CSS_NONE = 'none';
  const CSS_INLINE_BLOCK = 'inline-block';

  const INTERSECTION_THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  // Animation Types
  // ⚠️ WARNING: Order MUST match array below! ⚠️
  const ANIMATION_FADE = 0;
  const ANIMATION_ZOOMIN = 1;
  const ANIMATION_ZOOMOUT = 2;
  const ANIMATION_FLIP = 3;
  const ANIMATION_SLIDE = 4;
  // ⚠️ WARNING: Order MUST match constants above! ⚠️
  const ANIMATION_TYPES = ['fade', 'zoomin', 'zoomout', 'flip', 'slide'];

  // ============================================================================
  // Utilities
  // ============================================================================

  const genTmpId = () => `__usal${Date.now()}_${Math.random().toString(36).slice(2)}`;

  function calculateVisibilityRatio(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    if (
      rect.bottom <= 0 ||
      rect.top >= windowHeight ||
      rect.right <= 0 ||
      rect.left >= windowWidth
    ) {
      return 0;
    }

    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
    return (visibleHeight / rect.height) * (visibleWidth / rect.width);
  }

  function captureComputedStyle(element) {
    const computedStyle = window.getComputedStyle(element);
    return {
      [STYLE_OPACITY]: computedStyle[STYLE_OPACITY] || '1',
      [STYLE_TRANSFORM]: computedStyle[STYLE_TRANSFORM] || CSS_NONE,
      [STYLE_FILTER]: computedStyle[STYLE_FILTER] || CSS_NONE,
      [STYLE_PERSPECTIVE]: computedStyle[STYLE_PERSPECTIVE] || CSS_NONE,
      [STYLE_FONT_WEIGHT]: computedStyle[STYLE_FONT_WEIGHT] || '400',
    };
  }

  // ============================================================================
  // Style Management
  // ============================================================================

  function applyStyles(element, styles, clean = false) {
    if (!element) return;

    // eslint-disable-next-line no-unused-vars
    const { offset, composite, easing, ...cleanedStyles } = styles;

    element.animate([cleanedStyles], {
      duration: 0,
      fill: 'forwards',
      iterations: 1,
      id: genTmpId(),
    });

    if (instance.destroying == null && !clean) {
      element.__usalFragment = 1;
    } else {
      delete element.__usalFragment;
      delete element.__usalOGStyle;
      delete element.__usalID;
    }
  }

  const cancelAllAnimations = (data, element, originalStyle) =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (!element) {
          resolve();
          return;
        }
        element
          .getAnimations()
          .filter((animation) => animation.id && animation.id.startsWith('__usal'))
          .forEach((animation) => {
            animation.cancel();
            animation.effect = null;
            animation.timeline = null;
            if (originalStyle) {
              if (data?.config?.[CONFIG_SPLIT] && !data.config[CONFIG_SPLIT].includes('item'))
                originalStyle = {
                  ...originalStyle,
                  [STYLE_DISPLAY]: CSS_INLINE_BLOCK,
                };
              applyStyles(element, originalStyle);
            }
          });
        resolve();
      });
    });

  function resetStyle(data) {
    if (data.config[CONFIG_LOOP]) return;
    const originalStyle = data.element.__usalOGStyle;
    if (data.countData) {
      const span = data.countData.span;
      applyStyles(span, {
        [STYLE_DISPLAY]: 'inline',
      });
    } else if (data.config[CONFIG_SPLIT]) {
      if (data.targets) {
        data.targets().forEach(([target]) => {
          applyStyles(
            target,
            createKeyframes(
              data.splitConfig || data.config,
              target.__usalOGStyle || originalStyle
            )[0]
          );
        });
      }
    } else {
      applyStyles(data.element, createKeyframes(data.config, originalStyle)[0]);
    }
    data.stop = false;
  }
  // ============================================================================
  // Configuration Parsing
  // ============================================================================

  function extractAndSetConfig(prefix, config, configKey, classString) {
    const pattern = new RegExp(`${prefix}-\\[[^\\]]+\\]`);
    const match = classString.match(pattern);
    if (match) {
      config[configKey] = match[0].slice(prefix.length + 2, -1);
      return classString.replace(match[0], '');
    }
    return classString;
  }

  const extractAnimation = (firstPart, fallback = null) => {
    const animationIndex = ANIMATION_TYPES.indexOf(firstPart);
    return animationIndex !== -1 ? animationIndex : fallback;
  };

  const extractDirection = (secondPart, fallback = null) => {
    if (!secondPart) return fallback;

    let direction = 0;
    for (const char of secondPart) {
      switch (char) {
        case 'u':
          direction |= DIRECTION_UP;
          break;
        case 'd':
          direction |= DIRECTION_DOWN;
          break;
        case 'l':
          direction |= DIRECTION_LEFT;
          break;
        case 'r':
          direction |= DIRECTION_RIGHT;
          break;
      }
    }
    return direction > 0 ? direction : fallback;
  };

  function genEmptyConfig() {
    const config = new Array(16).fill(null);
    config[CONFIG_TUNING] = [];
    config[CONFIG_STAGGER] = 'index';
    return config;
  }

  function parseClasses(classString) {
    const config = genEmptyConfig();

    classString = extractAndSetConfig('count', config, CONFIG_COUNT, classString);
    classString = extractAndSetConfig('easing', config, CONFIG_EASING, classString);
    classString = extractAndSetConfig('line', config, CONFIG_LINE, classString);

    const tokens = classString.split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      const parts = token.split('-');
      const firstPart = parts[0];

      if (config[CONFIG_ANIMATION] === null) {
        config[CONFIG_ANIMATION] = extractAnimation(firstPart);
        if (config[CONFIG_ANIMATION] !== null) {
          config[CONFIG_DIRECTION] = extractDirection(parts[1]);
          config[CONFIG_TUNING] = parts
            .slice(1 + (config[CONFIG_DIRECTION] ? 1 : 0))
            .filter((item) => !isNaN(item) && item !== '')
            .map((item) => +item);
          continue;
        }
      }

      switch (token) {
        case 'once':
          config[CONFIG_ONCE] = true;
          break;
        case 'forwards':
          config[CONFIG_FORWARDS] = true;
          break;
        case 'linear':
        case 'ease':
        case 'ease-in':
        case 'ease-out':
        case 'ease-in-out':
        case 'step-start':
        case 'step-end':
          config[CONFIG_EASING] = token;
          break;
        default:
          switch (firstPart) {
            case 'split':
              if (parts[1])
                config[CONFIG_SPLIT] = (config[CONFIG_SPLIT] ?? '') + ' ' + token.slice(6);
              break;
            case 'blur':
              if (parts[1]) config[CONFIG_BLUR] = +parts[1];
              else config[CONFIG_BLUR] = true;
              break;
            case 'loop':
              if (parts[1] === 'mirror' || parts[1] === 'jump') {
                config[CONFIG_LOOP] = parts[1];
              } else config[CONFIG_LOOP] = true;
              break;
            case 'text':
              if (parts[1] === 'shimmer' || parts[1] === 'fluid') config[CONFIG_TEXT] = parts[1];
              break;
            case 'duration':
              if (parts[1]) config[CONFIG_DURATION] = +parts[1];
              break;
            case 'delay':
              if (parts[1]) config[CONFIG_DELAY] = +parts[1];
              if (parts[2]) config[CONFIG_STAGGER] = parts[2];
              break;
            case 'threshold':
              if (parts[1]) config[CONFIG_THRESHOLD] = +parts[1];
              break;
          }
      }
    }

    return config;
  }

  // ============================================================================
  // Animation Keyframes
  // ============================================================================

  function parseTimeline(content, originalStyle, inlineBlock = false) {
    const clean = content.replace(/\s/g, '').toLowerCase();

    function buildTransform(type, axis, value, unit) {
      const axisStr =
        axis && ['x', 'y', 'z'].includes(axis) ? axis.toUpperCase() : type === 'rotate' ? 'Z' : '';
      return `${type}${axisStr}(${value}${unit})`;
    }

    function parseTransforms(str) {
      const regex = /(\w|\w\w)([+-]\d+(?:\.\d+)?)/g;

      let transforms = '';
      let opacity = null;
      let blur = null;
      let perspective = null;
      let glow = null;
      let fontWeight = null;

      let match;
      while ((match = regex.exec(str)) !== null) {
        const [, prop, value] = match;
        const num = parseFloat(value);
        const first = prop[0];
        const second = prop[1];

        switch (first) {
          case 't':
            transforms += ' ' + buildTransform('translate', second, num, '%');
            break;
          case 'r':
            transforms += ' ' + buildTransform('rotate', second, num, 'deg');
            break;
          case 's':
            transforms += ' ' + buildTransform('scale', second, num, '');
            break;
          case 'o':
            opacity = Math.max(0, Math.min(100, num)) / 100;
            break;
          case 'b':
            blur = `blur(${Math.max(0, num)}rem)`;
            break;
          case 'g':
            glow = `brightness(${Math.max(0, num) / 100})`;
            break;
          case 'w':
            fontWeight = Math.max(0, num).toString();
            break;
          case 'p':
            perspective = `${num}rem`;
            break;
        }
      }

      const result = {};
      if (transforms) result[STYLE_TRANSFORM] = transforms.trim();
      if (opacity !== null) result[STYLE_OPACITY] = opacity;
      if (blur || glow) {
        result[STYLE_FILTER] = [blur, glow].filter(Boolean).join(' ');
      }
      if (fontWeight) result[STYLE_FONT_WEIGHT] = fontWeight;
      if (perspective) result[STYLE_PERSPECTIVE] = perspective;
      return result;
    }

    const keyframes = new Map();
    clean.split('|').forEach((frame, index) => {
      const percentMatch = frame.match(/^(\d+)/);
      const percent =
        index === 0
          ? 0
          : percentMatch
            ? Math.max(0, Math.min(100, parseInt(percentMatch[1])))
            : 100;
      keyframes.set(percent, parseTransforms(frame.replace(/^\d+/, '')));
    });

    if (Object.keys(keyframes.get(0)).length === 0) {
      keyframes.set(0, originalStyle);
    }
    if (keyframes.size === 1) {
      keyframes.set(100, originalStyle);
    } else {
      const allKeys = [...keyframes.keys()];
      if (keyframes.size >= 3) {
        const minKey = Math.min(...allKeys);
        keyframes.set(0, keyframes.get(minKey));
      }
      const maxKey = Math.max(...allKeys);
      keyframes.set(100, keyframes.get(maxKey));
    }

    const sorted = Array.from(keyframes.entries())
      .filter(([_, frame]) => Object.keys(frame).length > 0)
      .sort((a, b) => a[0] - b[0]);

    const compressed = sorted.map(([percent, frame]) => ({
      offset: (5 + percent * 0.9) / 100,
      ...frame,
      ...(inlineBlock && { display: 'inline-block' }),
    }));

    const first = { ...sorted[0][1], ...(inlineBlock && { display: 'inline-block' }) };
    const last = {
      ...sorted[sorted.length - 1][1],
      ...(inlineBlock && { display: 'inline-block' }),
    };

    return [{ offset: 0, ...first }, ...compressed, { offset: 1, ...last }];
  }

  function createKeyframes(config, originalStyle) {
    if (!originalStyle) return;
    const isSplitText = config[CONFIG_SPLIT] && !config[CONFIG_SPLIT]?.includes('item');

    if (config[CONFIG_TEXT] === 'shimmer') config[CONFIG_LINE] = 'o+50g+100|50o+100g+130|o+50g+100';
    else if (config[CONFIG_TEXT] === 'fluid') config[CONFIG_LINE] = 'w+100|50w+900|w+100';

    if (config[CONFIG_LINE]) return parseTimeline(config[CONFIG_LINE], originalStyle, isSplitText);

    const animationType =
      config[CONFIG_ANIMATION] ??
      extractAnimation(instance.config.defaults.animation, ANIMATION_FADE);
    const direction =
      config[CONFIG_DIRECTION] ?? extractDirection(instance.config.defaults.direction, 1);
    const blur = config[CONFIG_BLUR] ?? instance.config.defaults.blur;

    const tuning = config[CONFIG_TUNING];

    let firstTuning = tuning?.at(0);
    const lastTuning = tuning?.at(-1);
    let secondTuning = tuning?.at(1);

    let fromTimeline = 'o+0';
    if (animationType === ANIMATION_SLIDE)
      fromTimeline = `o+${parseFloat(originalStyle[STYLE_OPACITY]) * 100}`;

    const defaultDelta = isSplitText ? 50 : 15;
    const intensity = (lastTuning ?? defaultDelta) / 100;

    if (animationType === ANIMATION_ZOOMIN || animationType === ANIMATION_ZOOMOUT) {
      // Zoom
      fromTimeline += `s+${1 + (animationType === ANIMATION_ZOOMIN ? -intensity : intensity)}`;
      firstTuning = null;
      secondTuning = tuning?.length === 2 ? null : secondTuning;
    } else if (animationType === ANIMATION_FLIP) {
      // Flip
      const angle = firstTuning ?? 90;
      if (direction & (DIRECTION_UP | DIRECTION_DOWN)) {
        const rotX = direction & DIRECTION_UP ? angle : -angle;
        fromTimeline += `rx${rotX > 0 ? '+' : ''}${rotX}`;
      }
      if (direction & (DIRECTION_LEFT | DIRECTION_RIGHT)) {
        const rotY = direction & DIRECTION_LEFT ? -angle : angle;
        fromTimeline += `ry${rotY > 0 ? '+' : ''}${rotY}`;
      }
      if (!(direction & (DIRECTION_UP | DIRECTION_DOWN | DIRECTION_LEFT | DIRECTION_RIGHT))) {
        fromTimeline += `ry+${angle}`;
      }
      const perspectiveValue = tuning?.length === 2 ? lastTuning : 25;
      fromTimeline += `p+${perspectiveValue ?? 25}`;
    }

    if (animationType !== ANIMATION_FLIP && direction) {
      if (direction & DIRECTION_RIGHT) {
        fromTimeline += `tx-${firstTuning ?? defaultDelta}`;
      } else if (direction & DIRECTION_LEFT) {
        fromTimeline += `tx+${firstTuning ?? defaultDelta}`;
      }

      if (direction & DIRECTION_DOWN) {
        fromTimeline += `ty-${secondTuning ?? firstTuning ?? defaultDelta}`;
      } else if (direction & DIRECTION_UP) {
        fromTimeline += `ty+${secondTuning ?? firstTuning ?? defaultDelta}`;
      }
    }

    if (blur) {
      const blurValue =
        blur === true
          ? 0.625
          : typeof blur === 'number' && !isNaN(blur)
            ? Math.max(0, blur)
            : 0.625;
      fromTimeline += `b+${blurValue}`;
    }

    return parseTimeline(fromTimeline, originalStyle, isSplitText);
  }

  // ============================================================================
  // Split Animation Setup
  // ============================================================================
  function getStaggerFunction(targets, strategy = 'index') {
    const targetsData = targets.map((target) => {
      const rect = target.getBoundingClientRect();
      return {
        target,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });

    const bounds = targetsData.reduce(
      (acc, item) => ({
        minX: Math.min(acc.minX, item.x),
        maxX: Math.max(acc.maxX, item.x),
        minY: Math.min(acc.minY, item.y),
        maxY: Math.max(acc.maxY, item.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const metrics = targetsData.map((item, index) => {
      let value;
      switch (strategy) {
        case 'linear':
          value = Math.hypot(item.x, item.y);
          break;
        case 'center':
          value = Math.hypot(item.x - centerX, item.y - centerY);
          break;
        case 'edges':
          value = Math.min(
            Math.abs(item.x - bounds.minX),
            Math.abs(item.x - bounds.maxX),
            Math.abs(item.y - bounds.minY),
            Math.abs(item.y - bounds.maxY)
          );
          break;
        case 'random':
          value = Math.random();
          break;
        default: // index
          value = index;
      }
      return value;
    });

    const min = Math.min(...metrics);
    const max = Math.max(...metrics);
    const range = max - min || 1;

    return (splitDelay = 50) =>
      targetsData.map((item, index) => {
        const normalizedValue = (metrics[index] - min) / range;

        let delay;
        if (strategy === 'index') {
          delay = index * splitDelay;
        } else {
          delay = normalizedValue * (targets.length - 1) * splitDelay;
        }

        return [item.target, delay];
      });
  }

  function setupSplit(element, splitBy, strategy, resolve) {
    const targets = [];

    // Split by child elements
    if (splitBy === 'item') {
      Array.from(element.children).forEach((child) => {
        child.__usalOGStyle = captureComputedStyle(child);
        targets.push(child);
      });
      return [getStaggerFunction(targets, strategy), null];
    }

    // Split by text
    function createSpan(content) {
      const span = document.createElement('span');
      span.textContent = content;
      return span;
    }

    function processTextContent(text) {
      if (!text?.trim()) return text ? document.createTextNode(text) : null;

      const wrapper = document.createElement('span');
      const words = text.split(/(\s+)/);

      words.forEach((word) => {
        if (!word) return;

        if (/\s/.test(word)) {
          wrapper.appendChild(document.createTextNode(word));
          return;
        }

        // Split Word
        if (splitBy === 'word') {
          const span = createSpan(word);
          applyStyles(span, { [STYLE_DISPLAY]: CSS_INLINE_BLOCK });
          wrapper.appendChild(span);
          targets.push(span);
          return;
        }

        // Split letter
        const container = document.createElement('span');
        applyStyles(container, { [STYLE_DISPLAY]: CSS_INLINE_BLOCK, whiteSpace: 'nowrap' });

        let chars;
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
          chars = Array.from(segmenter.segment(word), (s) => s.segment);
        } else {
          chars = word.match(
            /\p{RI}\p{RI}|(?:\p{Emoji}(?:\u200D\p{Emoji})*)|(?:\P{M}\p{M}*)|./gsu
          ) || [word];
        }

        chars.forEach((char) => {
          const span = createSpan(char);
          container.appendChild(span);
          targets.push(span);
        });

        wrapper.appendChild(container);
      });

      return wrapper;
    }

    const textNodes = [];
    let countTextNodes = 0;
    let wrappers = null;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) {
        textNodes.push(walker.currentNode);
        countTextNodes++;
      }
    }

    if (textNodes.length) wrappers = [];
    textNodes.forEach((textNode) => {
      if (!textNode.parentNode || !textNode.isConnected) {
        countTextNodes--;
        if (countTextNodes === 0) resolve();
        return;
      }

      const processed = processTextContent(textNode.textContent);
      wrappers.push(processed);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            if (textNode.parentNode) {
              textNode.parentNode.replaceChild(processed, textNode);
            }
          } finally {
            countTextNodes--;
            if (countTextNodes === 0) resolve();
          }
        });
      });
    });

    return [getStaggerFunction(targets, strategy), wrappers];
  }

  // ============================================================================
  // Count Animation Setup
  // ============================================================================

  function setupCount(element, config, data, resolve) {
    const original = config[CONFIG_COUNT].trim();
    const clean = original.replace(/[^\d\s,.]/g, '');

    const separators = [',', '.', ' '].filter((s) => clean.includes(s));
    const sepPositions = separators
      .map((s) => ({ s, p: clean.lastIndexOf(s) }))
      .sort((a, b) => b.p - a.p);

    let value,
      decimals = 0,
      thousandSep = '',
      decimalSep = '';

    if (separators.length === 0) {
      value = parseFloat(clean);
    } else if (separators.length === 1) {
      const sep = separators[0];
      const afterSep = clean.substring(clean.lastIndexOf(sep) + 1);

      if (afterSep.length <= 3 && afterSep.length > 0 && sep !== ' ') {
        decimalSep = sep;
        decimals = afterSep.length;
        value = parseFloat(clean.replace(sep, '.'));
      } else {
        thousandSep = sep;
        value = parseFloat(clean.replace(new RegExp(`\\${thousandSep}`, 'g'), ''));
      }
    } else {
      decimalSep = sepPositions[0].s;
      thousandSep = sepPositions[1].s;
      const processed = clean
        .replace(new RegExp(`\\${thousandSep}`, 'g'), '')
        .replace(decimalSep, '.');
      value = parseFloat(processed);
      decimals = clean.substring(sepPositions[0].p + 1).replace(/\D/g, '').length;
    }

    let span = null;
    let wrapper = null;

    function findAndReplace(node) {
      if (span) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const index = text.indexOf(config[CONFIG_COUNT]);

        if (index !== -1) {
          const before = text.substring(0, index);
          const after = text.substring(index + config[CONFIG_COUNT].length);

          wrapper = document.createElement('span');

          if (before) wrapper.appendChild(document.createTextNode(before));

          span = document.createElement('span');
          span.textContent = original;
          wrapper.appendChild(span);

          if (after) wrapper.appendChild(document.createTextNode(after));

          data.textWrappers = [wrapper];
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                if (node.parentNode) {
                  node.parentNode.replaceChild(wrapper, node);
                }
              } finally {
                resolve();
              }
            });
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(findAndReplace);
      }
    }

    findAndReplace(element);

    if (!span) {
      resolve();
      return false;
    }

    data.countData = { value, decimals, span, thousandSep, decimalSep };
    return true;
  }

  // ============================================================================
  // Count Animation
  // ============================================================================

  function animateCount(countData, options) {
    const { duration, easing } = options;
    const { value, decimals, span, thousandSep, decimalSep } = countData;

    let currentTime = 0;
    let playState = 'idle';
    let playbackRate = 1;

    function getEasingFunction(easingType) {
      switch (easingType) {
        case 'linear':
          return (t) => t;

        case 'ease':
          return (t) => {
            if (t === 0) return 0;
            if (t === 1) return 1;
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          };

        case 'ease-in':
          return (t) => t * t * t;

        case 'ease-out':
          return (t) => 1 - Math.pow(1 - t, 3);

        case 'ease-in-out':
          return (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

        default:
          return (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      }
    }

    const easingFunction = getEasingFunction(easing);

    function formatNumber(val) {
      const parts = (decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toString()).split('.');
      if (thousandSep && parts[0].length > 3) {
        const reversed = parts[0].split('').reverse();
        parts[0] = reversed.reduce(
          (acc, digit, i) => (i > 0 && i % 3 === 0 ? digit + thousandSep + acc : digit + acc),
          ''
        );
      }
      return parts.length > 1 && decimalSep ? parts[0] + decimalSep + parts[1] : parts[0];
    }

    function updateValue(time) {
      const progress = Math.max(0, Math.min(1, time / duration));

      if (progress <= 0.06) {
        span.textContent = formatNumber(0);
      } else if (progress >= 0.94) {
        span.textContent = formatNumber(value);
      } else {
        const adjustedProgress = (progress - 0.05) / 0.9;
        const easedProgress = easingFunction(adjustedProgress);
        const currentValue = value * easedProgress;
        span.textContent = formatNumber(currentValue);
      }

      if ((progress >= 1 && playbackRate > 0) || (progress <= 0 && playbackRate < 0)) {
        playState = 'finished';
      }
    }

    return {
      tick(elapsed, loop = false) {
        if ((loop && playState !== 'paused') || playState === 'running') {
          playState = 'running';

          currentTime = currentTime + (playbackRate > 0 ? elapsed : -elapsed);
          currentTime = Math.max(0, Math.min(duration, currentTime));

          updateValue(currentTime);
        }
      },

      play() {
        if (playState === 'finished' || playState === 'running') return;
        playState = 'running';
      },

      pause() {
        if (playState === 'running') {
          playState = 'paused';
        }
      },

      cancel() {
        currentTime = duration * 0.95;
        updateValue(currentTime);
        playState = 'finished';
      },

      persist() {},

      get playState() {
        return playState;
      },

      get currentTime() {
        return currentTime;
      },

      set currentTime(time) {
        currentTime = Math.max(0, Math.min(duration, time));
        updateValue(currentTime);
      },

      get playbackRate() {
        return playbackRate;
      },

      set playbackRate(rate) {
        playbackRate = rate;
      },
    };
  }
  // ============================================================================
  // Animation Controller
  // ============================================================================

  class AnimationController {
    reset() {
      this.rafId = null;
      this.lastTickTime = null;
      this.virtualTime = 0;
      this.animations = new Map();
    }

    constructor(data) {
      this.data = data;
      this.reset();
    }

    timeToSayGoodbye() {
      if (this.animations.size !== 0) return false;
      cancelAnimationFrame(this.rafId);
      this.reset();
      this.data.resolve();
      return true;
    }

    cleanupAnimation(toCleanup) {
      toCleanup.forEach(([animation, info]) => {
        const clean = () => {
          this.animations.delete(animation);
          this.timeToSayGoodbye();
        };
        if (this.data.countData) {
          animation.cancel();
          clean();
        } else
          cancelAllAnimations(this.data, info.element, info.originalStyle).then(() => {
            clean();
          });
      });
    }

    prepare(elapsed) {
      const toCleanup = [];
      const toAnimate = [];

      for (const [animation, info] of this.animations) {
        if (this.data.stop) {
          toCleanup.push([animation, info]);
          continue;
        }

        animation.tick?.(elapsed, info.loop);

        const progress = animation.currentTime / info.duration;

        if (!info.loop && (progress >= 0.95 || animation.playState === 'finished')) {
          toCleanup.push([animation, info]);
          continue;
        } else if (
          !info.waiting &&
          !info.pendingPlay &&
          ((progress >= 0.95 && info.playbackRate > 0) ||
            (progress <= 0.05 && info.playbackRate < 0))
        ) {
          if (info.playbackRate < 0) animation.currentTime = info.duration * 0.03;
          else animation.currentTime = info.duration * 0.97;
          animation.pause();
          info.waiting = true;
        }

        if (info.pendingPlay && this.virtualTime >= info.playAt) {
          info.pendingPlay = false;
          animation.play();
        }

        toAnimate.push(info);
      }

      return { toCleanup, toAnimate };
    }

    animate(toAnimate) {
      if (toAnimate.length > 0 && toAnimate.every((info) => info.waiting)) {
        const isJump = toAnimate[0].loop === 'jump';
        const newPlaybackRate = isJump ? 1 : -toAnimate[0].playbackRate;

        const delays = toAnimate.map((info) => info.staggerDelay);
        const maxDelay = Math.max(...delays);

        toAnimate.forEach((next) => {
          if (isJump) next.animation.currentTime = next.duration * 0.03;
          next.animation.playbackRate = newPlaybackRate;
          next.playbackRate = newPlaybackRate;
          next.waiting = false;

          let delay = next.staggerDelay;
          if (newPlaybackRate < 0) {
            delay = maxDelay - next.staggerDelay;
          }

          if (!next.hasStarted && next.initialDelay > 0) {
            next.hasStarted = true;
            delay += next.initialDelay;
          }

          if (delay === 0) {
            next.animation.play();
          } else {
            next.playAt = this.virtualTime + delay;
            next.pendingPlay = true;
          }
        });
      }
    }

    tick() {
      const now = performance.now();
      const elapsed = Math.min(now - (this.lastTickTime ?? now), 16.67);
      this.virtualTime += elapsed;
      this.lastTickTime = now;

      const { toCleanup, toAnimate } = this.prepare(elapsed);

      this.cleanupAnimation(toCleanup);

      this.animate(toAnimate);

      if (!this.timeToSayGoodbye()) {
        this.rafId = requestAnimationFrame(() => this.tick());
      }
    }

    add(element, config, originalStyle, initialDelay = 0, staggerDelay = 0) {
      const duration = Math.max(
        0,
        ((this.data.config[CONFIG_DURATION] ?? instance.config.defaults.duration ?? 1000) + 1) / 0.9
      );
      const easing = this.data.config[CONFIG_EASING] ?? instance.config.defaults.easing;
      const forwards =
        this.data.config[CONFIG_FORWARDS] ?? instance.config.defaults.forwards ?? false;
      const loopDefaults = instance.config.defaults.loop ?? 'mirror';
      let loop =
        this.data.config[CONFIG_LOOP] === true ? loopDefaults : this.data.config[CONFIG_LOOP];

      let options = {
        duration,
        easing,
        fill: 'forwards',
      };

      let keyframes = [];

      if (this.data.config[CONFIG_TEXT]) {
        loop = loop ?? loopDefaults;
        options.easing = this.data.config[CONFIG_EASING] ?? 'linear';
      }

      keyframes = createKeyframes(config, originalStyle);
      if (forwards) originalStyle = keyframes[keyframes.length - 1];

      options = {
        ...options,
        delay: 0,
        id: genTmpId(),
      };
      const animation = this.data.countData
        ? animateCount(this.data.countData, options)
        : element.animate(keyframes, options);

      animation.persist();
      animation.currentTime = duration * 0.03;
      animation.pause();

      this.animations.set(animation, {
        animation,
        element,
        duration,
        staggerDelay,
        initialDelay,
        originalStyle,
        loop,
        playbackRate: -1,
        waiting: true,
        hasStarted: false,
      });
    }

    letsGo() {
      const { element, config, targets, splitConfig } = this.data;
      const initialDelay = Math.max(0, config[CONFIG_DELAY] ?? instance.config.defaults.delay ?? 0);
      const originalStyle = element.__usalOGStyle;
      const splitDelay = Math.max(
        0,
        splitConfig[CONFIG_DELAY] ?? instance.config.defaults.splitDelay ?? 0
      );

      let notReadYet = targets?.()?.length || (originalStyle ? 0 : 1);

      if (targets) {
        targets(splitDelay).forEach(([target, staggerDelay]) => {
          const targetOriginalStyle = target.__usalOGStyle || originalStyle;
          if (!targetOriginalStyle) return;
          notReadYet--;
          this.add(
            target,
            this.data.splitConfig,
            targetOriginalStyle,
            initialDelay,
            parseInt(staggerDelay)
          );
        });
      } else if (originalStyle) {
        this.add(element, config, originalStyle, initialDelay);
      }

      if (notReadYet === 0 && !this.rafId) {
        this.tick();
      }
    }
  }

  // ============================================================================
  // Main Animation Controller
  // ============================================================================

  function tryAnimate(data) {
    if (data.stop) return;
    data.hasAnimated = true;

    data.processing = new Promise((resolve) => {
      data.resolve = resolve;
      data.controller.letsGo();
    }).then(() => {
      data.onfinish();
      data.processing = null;
      data.stop = true;
    });
  }

  function tryAnimateIfVisible(data, ratio = null) {
    if (
      data.config[CONFIG_LOOP] ||
      data.processing !== null ||
      (data.hasAnimated && (data.config[CONFIG_ONCE] ?? instance.config.once))
    )
      return;

    const _ratio = ratio ?? calculateVisibilityRatio(data.element);

    if (data.stop && _ratio < 0.01) {
      resetStyle(data);
      return;
    }

    const threshold = Math.max(
      0,
      Math.min(1, (data.config[CONFIG_THRESHOLD] ?? instance.config.defaults.threshold) / 100)
    );

    if (_ratio >= threshold) {
      tryAnimate(data);
    }
  }

  // ============================================================================
  // Element Processing & Cleanup
  // ============================================================================

  const cleanupElement = (data) =>
    new Promise((resolve) => {
      data.onfinish = () => {
        data.onfinish = () => {};

        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (data.targets) {
              data.targets().forEach(([target]) => {
                if (target.__usalOGStyle) {
                  applyStyles(target, target.__usalOGStyle, true);
                }
              });
            }

            if (data.textWrappers) {
              data.textWrappers.forEach((wrapper) => {
                if (wrapper?.parentNode) {
                  wrapper.parentNode.replaceChild(
                    document.createTextNode(wrapper.textContent),
                    wrapper
                  );
                }
              });
            }

            if (data.element.__usalOGStyle) {
              applyStyles(data.element, data.element.__usalOGStyle, true);
            }

            resolve();
          })
        );
      };

      if (data.processing === null) data.onfinish();
      else data.stop = true;
    });

  function processElement(element, elementObserver) {
    if (element.__usalProcessing) return;

    let classes = element.getAttribute(DATA_USAL_ATTRIBUTE) || '';
    classes = classes
      .replace(/\/\/[^\n\r]*/g, '')
      .replace(/\/\*.*?\*\//gs, '')
      .trim()
      .toLowerCase();

    if (!element.__usalID && classes !== '') {
      element.__usalOGStyle = captureComputedStyle(element);
      element.__usalID = element.getAttribute(DATA_USAL_ID) ?? genTmpId();
    }

    const existingData = instance.elements.get(element.__usalID);
    if (existingData) {
      if (classes !== existingData.configString) {
        element.__usalProcessing = true;
        instance.elements.delete(element.__usalID);
        elementObserver.unobserve(element);
        cleanupElement(existingData).then(() => {
          delete element.__usalProcessing;
          processElement(element, elementObserver);
        });
      }
      return;
    }

    if (classes === '') return;

    element.__usalFragment = 1;
    const config = parseClasses(classes);

    const data = {
      element,
      config,
      splitConfig: [...config],
      configString: classes,
      targets: null,
      state: null,
      stop: false,
      hasAnimated: false,
      processing: null,
      countData: null,
      onfinish: () => {},
      controller: null,
      resolve: () => {},
      textWrappers: null,
    };

    instance.elements.set(element.__usalID, {
      configString: classes,
    });

    const splitBy = config[CONFIG_SPLIT]?.split(' ').find((item) =>
      ['word', 'letter', 'item'].includes(item)
    );

    data.processing = new Promise((resolve) => {
      let resolveNow = false;
      if (config[CONFIG_COUNT]) {
        setupCount(element, config, data, resolve);
      } else if (splitBy) {
        const splitOverrides = parseClasses(config[CONFIG_SPLIT]);
        const emptyConfig = genEmptyConfig();
        data.splitConfig = config.map((value, index) => {
          const override = splitOverrides[index];
          const empty = emptyConfig[index];
          if (Array.isArray(override) && Array.isArray(empty)) {
            return override.length > 0 ? override : value;
          }
          return override !== empty ? override : value;
        });
        const [targets, textWrappers] = setupSplit(
          element,
          splitBy,
          data.splitConfig[CONFIG_STAGGER],
          resolve
        );
        data.targets = targets;
        data.textWrappers = textWrappers;
        resolveNow = textWrappers === null;
      } else resolveNow = true;
      if (resolveNow) resolve();
    }).then(() => {
      if (data.stop) data.onfinish();
      else {
        instance.elements.set(element.__usalID, data);
        data.controller = new AnimationController(data);
        resetStyle(data);
        requestAnimationFrame(async () => {
          if (config[CONFIG_LOOP]) {
            tryAnimate(data);
          } else {
            tryAnimateIfVisible(data);
            elementObserver.observe(element);
          }
        });
      }
      data.processing = null;
    });
  }

  // ============================================================================
  // Observers Setup
  // ============================================================================

  function setupObservers() {
    const domObservers = new Set();
    const resizeObservers = new Set();
    const observedDOMs = new Set();
    let lastScan = 0;
    let throttleOnTailTimer = null;

    const elementObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const data = instance.elements.get(
            entry.target.__usalID || entry.target.getAttribute(DATA_USAL_ID)
          );
          if (data) {
            tryAnimateIfVisible(data, entry.intersectionRatio);
          }
        }
      },
      { threshold: INTERSECTION_THRESHOLDS }
    );

    function collectAllDOMs(root = document.body, collected = new Set()) {
      if (collected.has(root)) return collected;
      collected.add(root);

      for (const el of root.querySelectorAll(SHADOW_CAPABLE_SELECTOR)) {
        if (el.shadowRoot && !collected.has(el.shadowRoot)) {
          // noinspection JSCheckFunctionSignatures
          collectAllDOMs(el.shadowRoot, collected);
        }
      }

      return collected;
    }

    function observeDOM(dom) {
      const mutationObs = new MutationObserver(handleObserverEvents);
      mutationObs.observe(dom, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      domObservers.add(mutationObs);

      const resizeObs = new ResizeObserver(handleObserverEvents);
      if (dom === document.body || dom.host) {
        resizeObs.observe(dom === document.body ? dom : dom.host);
        resizeObservers.add(resizeObs);
      }
    }

    function scanAllDOMs() {
      // Clean disconnected elements
      for (const [id, data] of instance.elements) {
        if (!data || !data.element) {
          instance.elements.delete(id);
          continue;
        }
        if (!data.element.isConnected) {
          elementObserver.unobserve(data.element);
          cleanupElement(data).then(() => {
            instance.elements.delete(id);
          });
        } else {
          tryAnimateIfVisible(data);
        }
      }

      // Process new elements
      const allDOMs = collectAllDOMs();
      for (const dom of allDOMs) {
        if (!observedDOMs.has(dom)) {
          observeDOM(dom);
          observedDOMs.add(dom);
        }
        const elements = dom.querySelectorAll?.(DATA_USAL_SELECTOR);
        for (const element of elements) {
          processElement(element, elementObserver);
        }
      }
      lastScan = Date.now();
    }

    function handleObserverEvents(events) {
      const items = Array.isArray(events) ? events : [events];
      const hasUsalFragment = (target) => !!target.__usalFragment;

      let cancel = null;
      for (const item of items) {
        if (item.type === 'attributes') {
          const attrName = item.attributeName;
          if (attrName === DATA_USAL_ATTRIBUTE || attrName === DATA_USAL_ID) {
            processElement(item.target, elementObserver);
            cancel = true;
          }
        }
        if (cancel === null) {
          if (hasUsalFragment(item.target)) cancel = true;
          if (item.type === 'childList') {
            const hasUsalFragmentChild = [...item.addedNodes, ...item.removedNodes].some(
              hasUsalFragment
            );
            if (hasUsalFragmentChild) cancel = true;
          }
        }
      }

      if (cancel) return;

      const timeSinceLastScan = Date.now() - lastScan;
      if (timeSinceLastScan >= instance.config.observersDelay) {
        scanAllDOMs();
      } else {
        if (throttleOnTailTimer) clearTimeout(throttleOnTailTimer);
        throttleOnTailTimer = setTimeout(
          () => {
            scanAllDOMs();
          },
          Math.max(0, instance.config.observersDelay - timeSinceLastScan)
        );
      }
    }

    scanAllDOMs();

    return () => {
      clearTimeout(throttleOnTailTimer);
      domObservers.forEach((obs) => obs.disconnect());
      resizeObservers.forEach((obs) => obs.disconnect());
      elementObserver.disconnect();
      domObservers.clear();
      resizeObservers.clear();
      observedDOMs.clear();
    };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function autoInit() {
    if (!instance.initialized) {
      instance.initialized = true;
      instance.observers = setupObservers();
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  const api = {
    config(newConfig = {}) {
      if (arguments.length === 0) return { ...instance.config };

      if (newConfig.defaults) {
        newConfig.defaults = {
          ...instance.config.defaults,
          ...newConfig.defaults,
        };
      }

      Object.assign(instance.config, newConfig);
      return publicAPI;
    },
    async destroy() {
      if (!instance.initialized) return Promise.resolve();
      if (instance.destroying != null) return instance.destroying;
      if (instance.destroyTimer) {
        clearTimeout(instance.destroyTimer);
      }

      instance.destroying = new Promise((resolve) => {
        instance.destroyTimer = setTimeout(async () => {
          instance.destroyTimer = null;

          instance.observers();
          const elements = Array.from(instance.elements.values());

          await Promise.all(elements.map((data) => cleanupElement(data)));

          instance.elements.clear();
          instance.observers = () => {};
          instance.initialized = false;
          instance.destroying = null;
          resolve();
        }, 50);
      });

      return instance.destroying;
    },

    async restart() {
      if (instance.restarting != null) return instance.restarting;

      if (instance.destroyTimer) {
        clearTimeout(instance.destroyTimer);
        instance.destroyTimer = null;
      }
      if (instance.restartTimer) {
        clearTimeout(instance.restartTimer);
      }

      instance.restarting = new Promise((resolve) => {
        instance.restartTimer = setTimeout(() => {
          instance.restartTimer = null;

          publicAPI
            .destroy()
            .then(
              () =>
                new Promise((resolveInit) => {
                  requestAnimationFrame(() => {
                    if (document.readyState === 'loading') {
                      document.addEventListener(
                        'DOMContentLoaded',
                        () => {
                          autoInit();
                          resolveInit(publicAPI);
                        },
                        { once: true }
                      );
                    } else {
                      autoInit();
                      resolveInit(publicAPI);
                    }
                  });
                })
            )
            .then(resolve)
            .finally(() => {
              instance.restarting = null;
            });
        }, 50);
      });

      return instance.restarting;
    },

    initialized: () => instance.initialized,
    version: '{%%VERSION%%}',
  };

  // Make the public API callable so `import usal from 'usal'; usal({...})`
  // works as a shorthand for `usal.config({...})`, while keeping the
  // method-based API (usal.config(), usal.destroy(), ...) intact. The same
  // callable is exposed on globalThis.USAL for CDN <script type="module"> use.
  const publicAPI = function usal(config) {
    return arguments.length === 0 ? api.config() : api.config(config);
  };
  Object.assign(publicAPI, api);

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    requestAnimationFrame(autoInit);
  }

  return publicAPI;
})();

// Expose on globalThis (browser `window`, Node `global`, workers) so CDN
// <script type="module"> usage keeps working: globalThis.USAL.config(...)
if (typeof globalThis !== 'undefined' && !globalThis.USAL) {
  globalThis.USAL = USAL;
}

export default USAL;
