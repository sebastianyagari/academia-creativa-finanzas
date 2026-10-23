import { useState } from 'react';
import s from '../../components/ui.module.css';
import { useNav } from '../../state/nav';
import { useInstall } from './useInstall';

const DISMISSED_KEY = 'ac-instalar-oculto';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Invitación a instalar en Inicio (SPEC 9.4), solo en celulares donde la app
 * aún no está instalada. Se puede cerrar; esa preferencia vive en este navegador.
 */
export function InstallBanner() {
  const { installed, platform } = useInstall();
  const nav = useNav();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (installed || dismissed || platform === 'otro') return null;
  return (
    <div className={s.banner}>
      <span>
        <b>Instala la app</b> en tu pantalla de inicio para usarla sin internet.
      </span>
      <span className={s.row}>
        <button
          type="button"
          className={`${s.btn} ${s.line} ${s.sm}`}
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_KEY, '1');
            } catch {
              // Sin almacenamiento: se oculta solo en esta visita.
            }
            setDismissed(true);
          }}
        >
          Ahora no
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.sm}`}
          onClick={() => nav.setScreen('ajustes')}
        >
          Ver cómo
        </button>
      </span>
    </div>
  );
}
