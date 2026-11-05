import USALLib from '../usal.js';

export const USALPlugin = {
  install(app, config = {}) {
    // Configure global instance if config provided
    if (config && Object.keys(config).length > 0) {
      USALLib.config(config);
    }

    // Add global property
    app.config.globalProperties.$usal = {
      config: (c) => (c === undefined ? USALLib.config() : USALLib.config(c)),
      destroy: () => USALLib.destroy(),
      restart: () => USALLib.restart(),
      initialized: () => USALLib.initialized(),
      version: USALLib.version,
    };

    // Add directive
    app.directive('usal', {
      mounted(el, binding) {
        const nextValue = binding.value || 'fade';
        if (el.getAttribute('data-usal') !== nextValue) {
          el.setAttribute('data-usal', nextValue);
        }
      },
      updated(el, binding) {
        const nextValue = binding.value || 'fade';
        if (el.getAttribute('data-usal') !== nextValue) {
          el.setAttribute('data-usal', nextValue);
        }
      },
      beforeMount(el, binding) {
        const nextValue = binding.value || 'fade';
        if (el.getAttribute('data-usal') !== nextValue) {
          el.setAttribute('data-usal', nextValue);
        }
      },
      getSSRProps(binding) {
        return {
          'data-usal': binding?.value || 'fade',
        };
      },
    });
  },
};

export const useUSAL = () => ({
  config: (config) => (config === undefined ? USALLib.config() : USALLib.config(config)),
  destroy: () => USALLib.destroy(),
  restart: () => USALLib.restart(),
  initialized: () => USALLib.initialized(),
  version: USALLib.version,
});

export default USALLib;
