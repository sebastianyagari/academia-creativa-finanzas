import { useState } from 'react';
import { formatPlain, parseMoney } from '../engine';
import s from './ui.module.css';

/**
 * Campo de monto en pesos: teclado numérico y puntos de miles mientras se
 * escribe (SPEC 8.3). Entrega siempre un entero; vacío = 0.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  onCommit,
  large,
  ariaLabel,
  placeholder = '$ 0',
  className,
}: {
  id?: string;
  value: number;
  onChange?: (value: number) => void;
  /** Se llama al salir del campo o al presionar Enter (para guardar al editar en línea). */
  onCommit?: (value: number) => void;
  large?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value ? formatPlain(value) : '');
  // Solo un cambio del valor que llega de afuera (otra pantalla, guardado) reemplaza
  // lo escrito. Se compara contra el valor anterior de afuera, no contra lo tecleado:
  // en los campos que guardan al salir (onCommit) el valor de afuera no cambia
  // mientras se escribe, y antes eso borraba cada tecla.
  const [outside, setOutside] = useState(value);
  if (value !== outside) {
    setOutside(value);
    setText(value ? formatPlain(value) : '');
  }
  return (
    <input
      id={id}
      className={`${s.input} ${large ? s.amount : ''} ${className ?? ''}`}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const n = parseMoney(e.target.value);
        setText(n ? formatPlain(n) : '');
        onChange?.(n);
      }}
      onBlur={() => onCommit?.(parseMoney(text))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
