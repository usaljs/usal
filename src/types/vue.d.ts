import { App } from 'vue';
import USAL, { USALConfig, USALInstance } from '../usal';

export const USALPlugin: {
  install(app: App, config?: USALConfig): void;
};

export const useUSAL: () => {
  config(): USALConfig;
  config(config: Partial<USALConfig>): USALInstance;
  destroy: () => Promise<void>;
  restart: () => Promise<USALInstance>;
  initialized: () => boolean;
  readonly version: string;
};

declare module '@vue/runtime-core' {
  export interface GlobalProperties {
    $usal: {
      config(): USALConfig;
      config(config: Partial<USALConfig>): USALInstance;
      destroy: () => Promise<void>;
      restart: () => Promise<USALInstance>;
      initialized: () => boolean;
      readonly version: string;
    };
  }
}

export default USAL;
