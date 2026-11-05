import { onMount } from 'solid-js';

import USALLib from '../usal.js';

export const USALProvider = (props) => {
  onMount(() => {
    if (props.config && Object.keys(props.config).length > 0) {
      USALLib.config(props.config);
    }
  });

  return props.children;
};

export const useUSAL = () => ({
  config: (config) => (config === undefined ? USALLib.config() : USALLib.config(config)),
  destroy: () => USALLib.destroy(),
  restart: () => USALLib.restart(),
  initialized: () => USALLib.initialized(),
  version: USALLib.version,
});

export default USALLib;
