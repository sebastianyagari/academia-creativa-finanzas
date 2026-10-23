import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Card, ConfirmButton, Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import type { Profile, Settings } from '../../engine';
import { rulesFor } from '../../rules';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { Accounts } from './Accounts';
import { Backup } from './Backup';
import { InstallGuide } from '../instalar/InstallGuide';
import a from './Ajustes.module.css';
import { Recurrings } from './Recurrings';

const THEMES = [
  ['sistema', 'Sistema'],
  ['claro', 'Claro'],
  ['oscuro', 'Oscuro'],
] as const satisfies readonly (readonly [Settings['theme'], string])[];

/** Ajustes (SPEC 6.8). Respaldo y exportación llegan en la Fase 5. */
export function Ajustes() {
  const { data, actions } = useStore();
  const nav = useNav();
  return (
    <>
      <header className={a.top}>
        <button
          type="button"
          className={a.back}
          onClick={() => nav.setScreen('inicio')}
          aria-label="Volver"
        >
          <Icon name="back" size={22} />
        </button>
        <h1>Ajustes</h1>
      </header>
      <div className={`${s.grid} ${s.two}`}>
        <Card title="Perfil">
          <div className={s.stack}>
            <label className={s.field} htmlFor="f-uname">
              ¿Cómo te llamas?
              <input
                id="f-uname"
                className={s.input}
                maxLength={30}
                defaultValue={data.profile.name}
                placeholder="Tu nombre"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name !== data.profile.name) void actions.updateProfile({ name });
                }}
              />
            </label>
            <div className={s.pair}>
              <label className={s.field} htmlFor="f-itype">
                Tus ingresos
                <select
                  id="f-itype"
                  className={s.input}
                  value={data.profile.incomeType}
                  onChange={(e) =>
                    void actions.updateProfile({
                      incomeType: e.target.value as Profile['incomeType'],
                    })
                  }
                >
                  <option value="empleado">Empleado</option>
                  <option value="independiente">Independiente</option>
                  <option value="ambos">Ambos</option>
                </select>
              </label>
              <label className={s.field} htmlFor="f-freq">
                Te pagan
                <select
                  id="f-freq"
                  className={s.input}
                  value={data.profile.payFrequency}
                  onChange={(e) =>
                    void actions.updateProfile({
                      payFrequency: e.target.value as Profile['payFrequency'],
                    })
                  }
                >
                  <option value="mensual">Una vez al mes</option>
                  <option value="quincenal">Cada quincena</option>
                </select>
              </label>
            </div>
            <label className={s.field} htmlFor="f-goal">
              Lo que quieres lograr primero
              <select
                id="f-goal"
                className={s.input}
                value={data.profile.mainGoal}
                onChange={(e) =>
                  void actions.updateProfile({ mainGoal: e.target.value as Profile['mainGoal'] })
                }
              >
                <option value="ordenar">Ordenar mis gastos</option>
                <option value="ahorrar">Ahorrar para algo</option>
                <option value="deudas">Pagar mis deudas</option>
                <option value="emergencia">Fondo de emergencia</option>
              </select>
            </label>
            <p className={s.hint}>
              Cambiar la frecuencia solo cambia cómo ves Inicio. Para cambiar tus ingresos
              programados, repite la configuración o edítalos en “Movimientos que se repiten”.
            </p>
            <button
              type="button"
              className={`${s.btn} ${s.line}`}
              onClick={() => nav.setRepeatingOnboarding(true)}
            >
              Repetir la configuración inicial
            </button>
            <p className={s.hint}>No borra tus datos: actualiza cuentas, ingresos y metas.</p>
          </div>
        </Card>
        <Card title="Tema">
          <Segmented
            label="Tema"
            options={THEMES}
            value={data.settings.theme}
            onChange={(theme) => void actions.updateSettings({ theme })}
          />
        </Card>
        <InstallGuide />
        <Backup />
        <Accounts />
        <Recurrings />
        <DataCard />
        <About />
      </div>
    </>
  );
}

/** Datos de ejemplo y borrar todo, con doble confirmación (SPEC 6.8). */
function DataCard() {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const [wipe, setWipe] = useState(false);
  return (
    <Card title="Tus datos">
      <div className={s.stack}>
        {data.settings.isDemo ? (
          <ConfirmButton
            className={`${s.btn} ${s.ghost}`}
            label="Empezar con mis datos"
            confirmLabel="Sí, borrar el ejemplo"
            onConfirm={async () => {
              await actions.startFresh();
              toast('Listo. Empieza registrando tus ingresos.');
              nav.setScreen('inicio');
            }}
          />
        ) : wipe ? (
          <div className={a.danger}>
            <p>
              Se borran todos tus movimientos, cuentas, metas y deudas de este dispositivo. No se
              puede deshacer.
            </p>
            <div className={s.row}>
              <button type="button" className={`${s.btn} ${s.line}`} onClick={() => setWipe(false)}>
                Cancelar
              </button>
              <ConfirmButton
                className={`${s.btn} ${s.danger}`}
                label="Sí, borrar todo"
                confirmLabel="Toca otra vez para borrar"
                onConfirm={async () => {
                  await actions.startFresh();
                  setWipe(false);
                  toast('Todo borrado.');
                  nav.setScreen('inicio');
                }}
              />
            </div>
          </div>
        ) : (
          <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => setWipe(true)}>
            Borrar todo y empezar de cero
          </button>
        )}
        <ConfirmButton
          className={`${s.btn} ${s.line}`}
          label="Cargar datos de ejemplo"
          confirmLabel={
            data.settings.isDemo ? 'Recargar el ejemplo' : 'Esto reemplaza tus datos. ¿Seguro?'
          }
          onConfirm={async () => {
            await actions.loadDemo();
            toast('Datos de ejemplo cargados');
            nav.setScreen('inicio');
          }}
        />
      </div>
    </Card>
  );
}

function About() {
  const { today } = useStore();
  const { rules, isFallback } = rulesFor(Number(today.slice(0, 4)));
  return (
    <Card title="Acerca de">
      <div className={s.sumRow}>
        <span>Versión de la app</span>
        <b>{__APP_VERSION__}</b>
      </div>
      <div className={s.sumRow}>
        <span>Parámetros de Colombia</span>
        <b>{rules.version}</b>
      </div>
      {isFallback && (
        <p className={s.note}>
          Aún no hay parámetros de {today.slice(0, 4)}; se usan los de {rules.year}.
        </p>
      )}
      <p className={s.note}>
        Esta aplicación es una herramienta educativa para organizar tus finanzas. No constituye
        asesoría financiera, legal ni tributaria.
      </p>
      <p className={s.note}>
        Tus datos se guardan solo en este dispositivo. Academia Creativa no los recibe ni los
        almacena. Si borras los datos del navegador o cambias de dispositivo sin respaldo, los
        pierdes.
      </p>
    </Card>
  );
}
