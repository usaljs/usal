import { ActionReturn } from 'svelte/action';
import USAL, { USALConfig, USALInstance } from '../usal';

export interface USALAction {
  (node: HTMLElement, params?: string): ActionReturn<string>;
}

export const usal: USALAction;

export const useUSAL: () => {
  config(): USALConfig;
  config(config: Partial<USALConfig>): USALInstance;
  destroy: () => Promise<void>;
  restart: () => Promise<USALInstance>;
  initialized: () => boolean;
  readonly version: string;
};

export default USAL;
