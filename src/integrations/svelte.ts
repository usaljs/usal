import USALLib from '../usal.js';

export const usal = (node, value = 'fade') => {
  const initialValue = value || 'fade';
  if (node.getAttribute('data-usal') !== initialValue) {
    node.setAttribute('data-usal', initialValue);
  }

  return {
    update(newValue = 'fade') {
      const nextValue = newValue || 'fade';
      if (node.getAttribute('data-usal') !== nextValue) {
        node.setAttribute('data-usal', nextValue);
      }
    },
    destroy() {
      node.removeAttribute('data-usal');
    },
  };
};

export const useUSAL = () => ({
  config: (config) => (config === undefined ? USALLib.config() : USALLib.config(config)),
  destroy: () => USALLib.destroy(),
  restart: () => USALLib.restart(),
  initialized: () => USALLib.initialized(),
  version: USALLib.version,
});

export default USALLib;
