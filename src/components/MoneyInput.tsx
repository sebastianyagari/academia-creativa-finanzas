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
  const [lastValue, setLastValue] = useState(value);
  // Si el valor cambia desde afuera (otra pantalla, guardado), se refleja aquí.
  if (value !== lastValue) {
    setLastValue(value);
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
        setLastValue(n);
        onChange?.(n);
      }}
      onBlur={() => onCommit?.(parseMoney(text))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
