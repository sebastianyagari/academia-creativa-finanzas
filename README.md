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

### Probar en tu celular

Con el celular y el computador en la misma red Wi-Fi:

```bash
npm run dev:celular
```

La terminal muestra una dirección "Network" (por ejemplo `http://192.168.1.20:5173`): ábrela en el navegador del celular. Si Windows pregunta por el firewall, permite el acceso en redes privadas. Los datos que registres ahí quedan en el celular, separados de los del computador.

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

Genera la carpeta `dist/`. Se publica en **Cloudflare Pages** conectado a este repositorio de GitHub: cada cambio en `main` se publica solo.

Configuración del proyecto en Cloudflare Pages:

- Framework preset: **None** (o Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Variable de entorno: `NODE_VERSION` = `24`

Dirección definitiva: **`app.academiacreativa.shop`** (subdominio con un registro `CNAME` en GoDaddy). La landing y la página de entrega siguen en Systeme en `academiacreativa.shop`. La dirección de la app no puede cambiar una vez haya clientes (SPEC sección 11). `public/_headers` evita que los buscadores la indexen y hace que las actualizaciones lleguen.

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
