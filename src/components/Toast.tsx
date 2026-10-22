import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Aviso corto en la parte de abajo ("Guardado", "Movimiento eliminado"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`${styles.toast} ${visible ? styles.on : ''}`} role="status">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
