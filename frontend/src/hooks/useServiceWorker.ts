import { useEffect, useState, useRef, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker(): ServiceWorkerState & {
  updateServiceWorker: () => void;
  clearCache: () => void;
} {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isUpdateAvailable: false,
    registration: null,
  });

  // Store interval ID so it can be cleared on unmount (task #13 — memory leak fix).
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store the controllerchange handler so it can be removed on unmount.
  const controllerChangeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!state.isSupported) return;

    let isMounted = true;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        if (!isMounted) return;

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Store the interval ID so clearInterval can be called in the cleanup.
        updateIntervalRef.current = setInterval(() => {
          registration.update();
        }, 60000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (isMounted) {
                setState((prev) => ({
                  ...prev,
                  isUpdateAvailable: true,
                }));
              }
            }
          });
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerServiceWorker();

    return () => {
      isMounted = false;
      // Clear the periodic update polling to avoid it outliving this component.
      if (updateIntervalRef.current !== null) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      // Remove any controllerchange listener that was attached by updateServiceWorker.
      if (controllerChangeRef.current) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeRef.current);
        controllerChangeRef.current = null;
      }
    };
  }, [state.isSupported]);

  const updateServiceWorker = useCallback(() => {
    if (!state.registration?.waiting) return;

    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Remove any previously attached handler before registering a new one
    // so multiple calls to updateServiceWorker don't stack listeners.
    if (controllerChangeRef.current) {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeRef.current);
    }
    const handler = () => {
      window.location.reload();
    };
    controllerChangeRef.current = handler;
    navigator.serviceWorker.addEventListener('controllerchange', handler);
  }, [state.registration]);

  const clearCache = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      }

      setState((prev) => ({
        ...prev,
        isUpdateAvailable: false,
      }));
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [state.isSupported]);

  return {
    ...state,
    updateServiceWorker,
    clearCache,
  };
}
