export type LoopType = 'mirror' | 'jump';
export type AnimationType = 'fade' | 'zoomin' | 'zoomout' | 'flip' | 'slide';
export type DirectionType = 'u' | 'd' | 'l' | 'r' | 'ul' | 'ur' | 'dl' | 'dr';

export interface USALDefaults {
  animation?: AnimationType;
  direction?: DirectionType;
  duration?: number; // ms
  delay?: number; // ms
  threshold?: number; // %
  splitDelay?: number; // ms
  easing?: string;
  blur?: boolean | number; // rem
  forwards?: boolean;
  loop?: LoopType;
}

export interface USALConfig {
  defaults?: USALDefaults;
  observersDelay?: number; // ms
  once?: boolean;
}

export interface USALInstance {
  /** Shorthand for `usal.config(newConfig)`. Returns the USAL instance for chaining. */
  (newConfig: Partial<USALConfig>): USALInstance;
  /** Shorthand for `usal.config()`. Returns the current config. */
  (): USALConfig;
  config(): USALConfig;
  config(newConfig: Partial<USALConfig>): USALInstance;
  destroy(): Promise<void>; //use only extreme cases, the system is reactive even in shadowRoot
  restart(): Promise<USALInstance>; //use only extreme cases, the system is reactive even in shadowRoot
  initialized(): boolean;
  readonly version: string;
}

declare global {
  interface Window {
    USAL: USALInstance;
  }
  // Available after `import 'usal'` / `<script type="module">`; callable like the default export.
  var USAL: USALInstance | undefined;
}

declare const USAL: USALInstance;
export default USAL;
