import { useState } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { useToast } from '../../components/Toast';
import { Card, Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import { useInstall, type Platform } from './useInstall';
import g from './InstallGuide.module.css';

/** Ícono de "Compartir" de Safari, para que la persona lo reconozca. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Steps({ platform }: { platform: Exclude<Platform, 'otro'> }) {
  if (platform === 'ios') {
    return (
      <ol className={g.steps}>
        <li>
          <span className={g.num}>1</span>
          <span>
            Abre esta página en <b>Safari</b> y toca el botón <b>Compartir</b>{' '}
            <span className={g.icon}>
              <ShareIcon />
            </span>{' '}
            (abajo en el centro, o arriba en iPad).
          </span>
        </li>
        <li>
          <span className={g.num}>2</span>
          <span>
            Baja y toca <b>“Agregar a inicio”</b>. Luego toca <b>“Agregar”</b>.
          </span>
        </li>
      </ol>
    );
  }
  return (
    <ol className={g.steps}>
      <li>
        <span className={g.num}>1</span>
        <span>
          En <b>Chrome</b>, toca el menú <b className={g.dots}>⋮</b> (arriba a la derecha).
        </span>
      </li>
      <li>
        <span className={g.num}>2</span>
        <span>
          Toca <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b> y confirma.
        </span>
      </li>
    </ol>
  );
}

/**
 * Guía de instalación (SPEC 9.4 y 10): con la app en la pantalla de inicio se
 * abre como cualquier app, funciona sin internet y el navegador cuida mejor los datos.
 */
export function InstallGuide() {
  const { installed, canPrompt, platform, install } = useInstall();
  const toast = useToast();
  const [shown, setShown] = useState<Exclude<Platform, 'otro'>>(
    platform === 'ios' ? 'ios' : 'android',
  );

  return (
    <Card title="Instala la app" span2>
      {installed ? (
        <div className={g.done}>
          <BrandMark height={28} />
          <p>
            <b>Ya la tienes instalada.</b> Ábrela desde su ícono “Finanzas” en tu pantalla de
            inicio.
          </p>
        </div>
      ) : (
        <div className={s.stack}>
          <p className={s.hint}>
            Tenla en tu pantalla de inicio: se abre como cualquier app, funciona sin internet y tu
            celular cuida mejor tus datos.
          </p>
          {canPrompt ? (
            <button
              type="button"
              className={s.btn}
              onClick={async () => {
                if (await install())
                  toast('¡Listo! Búscala como “Finanzas” en tu pantalla de inicio.');
              }}
            >
              Instalar la app
            </button>
          ) : (
            <>
              {platform === 'otro' && (
                <Segmented
                  label="Tu celular"
                  options={[
                    ['android', 'Android'],
                    ['ios', 'iPhone'],
                  ]}
                  value={shown}
                  onChange={setShown}
                />
              )}
              <Steps platform={platform === 'otro' ? shown : platform} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}
