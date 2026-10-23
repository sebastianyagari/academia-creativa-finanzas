import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdatePrompt.module.css';

/** Cada cuánto se revisa si hay una versión nueva mientras la app está abierta. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registra el service worker (app sin internet) y muestra el aviso
 * "Hay una versión nueva. Toca para actualizar." (SPEC 10). Actualizar solo
 * cambia la app: los datos en IndexedDB se conservan.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className={styles.bar} role="status">
      <button
        type="button"
        className={styles.button}
        onClick={() => void updateServiceWorker(true)}
      >
        <b>Hay una versión nueva.</b> Toca para actualizar.
      </button>
    </div>
  );
}
