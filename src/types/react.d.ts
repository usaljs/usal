import React, { ReactNode } from 'react';
import USAL, { USALConfig, USALInstance } from '../usal';

export const USALProvider: React.FC<{
  children: ReactNode;
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
