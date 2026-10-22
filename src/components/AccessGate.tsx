import type { ReactNode } from 'react';

/**
 * Punto de enganche para el control de acceso (SPEC sección 12).
 * En la v1 deja pasar siempre: el acceso es un link privado no indexado.
 * Más adelante aquí podrá ir un código de compra sin tocar el modelo de datos.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  return children;
}
