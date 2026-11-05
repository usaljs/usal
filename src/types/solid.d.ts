import { Component, JSX } from 'solid-js';
import USAL, { USALConfig, USALInstance } from '../usal';

export const USALProvider: Component<{
  children: JSX.Element;
  config?: USALConfig;
}>;

export const useUSAL: () => {
  config(): USALConfig;
  config(config: Partial<USALConfig>): USALInstance;
  destroy: () => Promise<void>;
  restart: () => Promise<USALInstance>;
  initialized: () => boolean;
  readonly version: string;
};

export default USAL;
