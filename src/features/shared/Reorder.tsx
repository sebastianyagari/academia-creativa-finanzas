import { Icon } from '../../components/Icon';
import s from '../../components/ui.module.css';
import r from './Reorder.module.css';

/**
 * Lista para ordenar con botones subir/bajar (Anexo D.23). Funciona con teclado
 * y lector de pantalla, sin arrastrar.
 */
export function Reorder({
  items,
  onMove,
}: {
  items: readonly { id: string; name: string }[];
  onMove: (id: string, toIndex: number) => void;
}) {
  return (
    <ol className={r.list}>
      {items.map((item, i) => (
        <li key={item.id} className={r.item}>
          <span className={r.name}>{item.name}</span>
          <button
            type="button"
            className={s.iconBtn}
            disabled={i === 0}
            aria-label={`Subir ${item.name}`}
            onClick={() => onMove(item.id, i - 1)}
          >
            <Icon name="up" size={20} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            disabled={i === items.length - 1}
            aria-label={`Bajar ${item.name}`}
            onClick={() => onMove(item.id, i + 1)}
          >
            <Icon name="down" size={20} />
          </button>
        </li>
      ))}
    </ol>
  );
}
