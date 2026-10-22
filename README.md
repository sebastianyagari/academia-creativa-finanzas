# Academia Creativa Finanzas

App web instalable (PWA) de finanzas personales para Colombia. Los datos viven solo en el dispositivo de cada persona.

- Especificación: [docs/SPEC.md](docs/SPEC.md) (fuente de verdad; las decisiones están en el Anexo D).
- Prototipo de referencia: [docs/finanzas-prototipo.html](docs/finanzas-prototipo.html).
- Archivos de marca originales: [assets/](assets). Las versiones que usa la app están en `public/brand/`.

## Requisitos

- Node.js 22 o superior (el proyecto usa la versión de `.nvmrc`).
- Git.

## Correr en tu equipo

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

## Probar

```bash
npm test              # pruebas del engine y reglas (Vitest)
npx playwright install chromium   # solo la primera vez
npm run test:e2e      # pruebas de flujo en navegador (Playwright)
npm run lint          # revisión de código
npm run typecheck     # revisión de tipos
```

La CI de GitHub Actions (`.github/workflows/ci.yml`) corre todo esto en cada cambio que se sube a `main` o en cada pull request.

## Publicar

```bash
npm run build
```

Genera la carpeta `dist/`, que se publica en Cloudflare Pages o Netlify. La dirección web no puede cambiar una vez haya clientes (SPEC sección 11). La configuración de publicación se completa en la Fase 7.

## Estructura

```
src/
  engine/      cálculo puro: dinero, totales, presupuesto, metas, deudas
  db/          base de datos local, esquema, migraciones, respaldo
  rules/co/    parámetros legales de Colombia por año (JSON)
  features/    pantallas por sección
  components/  piezas de interfaz reutilizables
  styles/      tokens de diseño (única fuente de color)
  tests/       pruebas de Vitest
e2e/           pruebas de Playwright
```
