import { ReactiveController, ReactiveControllerHost, DirectiveResult } from 'lit';
import USAL, { USALConfig, USALInstance } from '../usal';

export class USALController implements ReactiveController {
  constructor(host: ReactiveControllerHost, config?: Partial<USALConfig>);
  config(): USALConfig;
  config(config: Partial<USALConfig>): USALInstance;
  destroy(): Promise<void>;
  restart(): Promise<USALInstance>;
  initialized(): boolean;
  readonly version: string;
  hostConnected(): void;
  hostDisconnected(): void;
}

export const useUSAL: () => {
  config(): USALConfig;
  config(config: Partial<USALConfig>): USALInstance;
  destroy: () => Promise<void>;
  restart: () => Promise<USALInstance>;
  initialized: () => boolean;
  readonly version: string;
};

export const useUSALController: (
  host: ReactiveControllerHost,
  config?: Partial<USALConfig>
) => USALController;

export const usal: (value?: string) => DirectiveResult;

export default USAL;
