import { AppHeader } from '../../components/AppHeader';
import { useToast } from '../../components/Toast';
import { ConfirmButton } from '../../components/ui';
import s from '../../components/ui.module.css';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';

/** Cabecera de cada pestaña más el aviso de "Datos de ejemplo" (SPEC 6.9). */
export function ScreenTop({ title }: { title: string }) {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  return (
    <>
      <AppHeader title={title} onSettings={() => nav.setScreen('ajustes')} />
      {data.settings.isDemo && (
        <div className={s.banner}>
          <span>
            <b>Datos de ejemplo.</b> Prueba la app con ellos o empieza con los tuyos.
          </span>
          <ConfirmButton
            className={`${s.btn} ${s.sm}`}
            label="Empezar con mis datos"
            confirmLabel="Sí, borrar el ejemplo"
            onConfirm={async () => {
              await actions.startFresh();
              nav.setMonth(nav.month);
              toast('Listo. Empieza registrando tus ingresos.');
            }}
          />
        </div>
      )}
    </>
  );
}
