import { useEffect, useRef, useState } from 'react';
import { dayLabel } from '../../components/format';
import { useToast } from '../../components/Toast';
import { Card, ConfirmButton } from '../../components/ui';
import s from '../../components/ui.module.css';
import { backupFileName, createBackup, parseBackup, serializeBackup } from '../../db';
import type { AppData } from '../../engine';
import { useStore } from '../../state/store';
import a from './Ajustes.module.css';

/** Descarga un archivo generado en el navegador (no sale del dispositivo). */
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fullDate(date: string): string {
  return `${dayLabel(date)} de ${date.slice(0, 4)}`;
}

/** ¿El navegador prometió no borrar los datos por falta de espacio? (SPEC 9.4) */
function usePersisted(): boolean | null {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);
  return persisted;
}

interface Preview {
  data: AppData;
  transactions: number;
  lastDate: string | null;
  fileName: string;
}

/** Respaldo, restauración y exportación a Excel (SPEC 9). Nada sale del dispositivo. */
export function Backup() {
  const { data, today, currentMonth, actions, canUndoRestore } = useStore();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const persisted = usePersisted();
  const last = data.settings.lastBackupAt;

  async function saveBackup() {
    const file = serializeBackup(createBackup(data));
    download(backupFileName(), new Blob([file], { type: 'application/json' }));
    await actions.updateSettings({ lastBackupAt: today });
    toast('Respaldo descargado. Guárdalo en un lugar seguro.');
  }

  async function pickFile(file: File) {
    setError('');
    setPreview(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview({
      data: result.data,
      transactions: result.summary.transactions,
      lastDate: result.summary.lastDate,
      fileName: file.name,
    });
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const [{ buildSheets, excelFileName }, { workbookBuffer }] = await Promise.all([
        import('./excelSheets'),
        import('./exportExcel'),
      ]);
      const buffer = await workbookBuffer(buildSheets(data, currentMonth));
      download(
        excelFileName(today),
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      toast('Archivo de Excel descargado');
    } catch (e) {
      console.error(e);
      toast('No se pudo crear el archivo. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card title="Respaldo de tus datos" span2>
      <div className={s.stack}>
        <p className={s.hint}>
          Tus datos viven solo en este dispositivo. Descarga un respaldo de vez en cuando y guárdalo
          en un lugar seguro (Drive, tu correo o un chat contigo en WhatsApp). Con él recuperas todo
          si cambias de celular o borras el navegador.
        </p>
        <div className={s.sumRow}>
          <span>Último respaldo</span>
          <b>{last ? fullDate(last) : 'Aún no has hecho uno'}</b>
        </div>
        {persisted !== null && (
          <div className={s.sumRow}>
            <span>Almacenamiento protegido</span>
            <b>{persisted ? 'Sí' : 'No'}</b>
          </div>
        )}
        {persisted === false && (
          <p className={s.hint}>
            Tu navegador podría borrar los datos si le falta espacio o si no usas la app en semanas.
            Por eso es importante tener un respaldo reciente.
          </p>
        )}

        <button type="button" className={s.btn} onClick={() => void saveBackup()}>
          Descargar respaldo
        </button>

        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-label="Archivo de respaldo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pickFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className={`${s.btn} ${s.ghost}`}
          onClick={() => fileInput.current?.click()}
        >
          Restaurar un respaldo
        </button>

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        {preview && (
          <div className={a.restore} role="region" aria-label="Restaurar respaldo">
            <p>
              Este respaldo trae <b>{preview.transactions}</b>{' '}
              {preview.transactions === 1 ? 'movimiento' : 'movimientos'}
              {preview.lastDate ? <>, hasta el {fullDate(preview.lastDate)}</> : null}.{' '}
              <b>Reemplazará tus datos actuales.</b>
            </p>
            <p className={s.hint}>Archivo: {preview.fileName}</p>
            <div className={s.row}>
              <button
                type="button"
                className={`${s.btn} ${s.line}`}
                onClick={() => setPreview(null)}
              >
                Cancelar
              </button>
              <ConfirmButton
                className={`${s.btn} ${s.danger}`}
                label="Restaurar"
                confirmLabel="Toca otra vez para restaurar"
                onConfirm={async () => {
                  await actions.restoreBackup(preview.data);
                  setPreview(null);
                  toast('Respaldo restaurado');
                }}
              />
            </div>
          </div>
        )}

        {canUndoRestore && (
          <div className={a.restore}>
            <p>Restauraste un respaldo. Si fue un error, puedes volver a tus datos de antes.</p>
            <button
              type="button"
              className={`${s.btn} ${s.line}`}
              onClick={async () => {
                await actions.undoRestore();
                toast('Volviste a tus datos de antes');
              }}
            >
              Deshacer la restauración
            </button>
          </div>
        )}

        <button
          type="button"
          className={`${s.btn} ${s.line}`}
          disabled={exporting}
          onClick={() => void exportExcel()}
        >
          {exporting ? 'Preparando el archivo…' : 'Exportar a Excel'}
        </button>
        <p className={s.hint}>
          El Excel es para ver o compartir tus números: movimientos, resumen por mes, presupuesto,
          metas, deudas y cuentas. Para recuperar tus datos usa el respaldo.
        </p>
      </div>
    </Card>
  );
}
