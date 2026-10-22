# Academia Creativa Finanzas

App web instalable (PWA) de finanzas personales para Colombia. Lee docs/SPEC.md antes de tocar código (el Anexo D tiene las decisiones que mandan sobre el resto).

- Dinero: enteros en pesos COP. Nunca floats. Formato `$ 1.234.567`.
- Datos solo en el dispositivo (IndexedDB/Dexie). Sin servidor, sin analítica.
- Todo cálculo vive en /src/engine con pruebas (Vitest). Las transferencias no cuentan como ingreso ni gasto.
- Cifras legales solo desde /src/rules/co/AAAA.json; si falta un valor, dejar null y avisar.
- Textos en español de Colombia, tuteo. Marca: morado #6A1B9A; amarillo #FFEB3B solo como acento pequeño.
- Consultar antes de cambiar el modelo de datos. Cada cambio de esquema = migración con prueba.
- Colores solo desde /src/styles/tokens.css. Estilos con CSS Modules.
- "Hoy" se calcula en America/Bogota.
- Antes de cerrar un cambio: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
