# Academia Creativa Finanzas — Documento base (SPEC)

Versión del documento: 1.1 · Fecha: 21 de octubre de 2026 (decisiones resueltas en el Anexo D) · Idioma de la app: español de Colombia

Este documento es la fuente de verdad para construir la versión vendible de la app. Se pasa a Claude Code junto con el prototipo de referencia (`finanzas-prototipo.html`). Si algo de este documento contradice al prototipo, **manda este documento**.

---

## 0. Objetivo y alcance

**Qué es.** Una app web instalable (PWA) de finanzas personales para personas en Colombia. Reemplaza la "Plantilla de Finanzas Personales" (Excel / Google Sheets) que hoy vende Academia Creativa por WhatsApp. Cada persona la usa en su celular, con sus propios datos, sin crear cuenta.

**Meta inmediata.** Tenerla lista para venderse. La prioridad es una v1 estable, bonita y fácil de entender, no una app con todas las funciones.

**Dentro de la v1**
1. Onboarding de 5 o 6 preguntas, saltable, y lista de "primeros pasos".
2. Registro de ingresos, facturas, gastos, inversiones, ahorros y pagos de deuda.
3. Editar y eliminar cualquier movimiento.
4. Transferencias entre cuentas.
5. Movimientos que se repiten, con un toque ("pendientes del mes").
6. Categorías precargadas para Colombia, categoría "Otros" por grupo y creación de categorías al registrar.
7. Tarjeta de crédito como cuenta de tipo deuda.
8. Presupuesto por categoría.
9. Metas de ahorro con aporte mensual sugerido.
10. Deudas con estrategia bola de nieve o avalancha, usando tasa efectiva anual (EA).
11. Dashboard por Mes, 6 meses y Año.
12. Ingresos programados de prima, cesantías y modo quincenal.
13. Búsqueda y filtros en movimientos.
14. Respaldo en archivo, restauración y exportación a Excel.
15. Instalable, funciona sin internet, aviso de actualización.
16. Modo claro y oscuro.
17. Aviso de herramienta educativa y nota de privacidad.

**Fuera de la v1 (no construir todavía)**
- Cuentas de usuario, sincronización entre dispositivos y servidor con datos de usuarios.
- Control de acceso por código de compra. En la v1 el acceso es un **link privado no indexado** (ver sección 12). Se deja un punto de enganche para agregarlo después sin tocar los datos.
- Compras diferidas a cuotas en tarjeta de crédito (v2).
- Notificaciones push.
- Conexión con bancos.

---

## 1. Contexto

| Tema | Detalle |
|---|---|
| Marca | Academia Creativa (marca comercial dentro del portafolio "Crecimiento Digital") |
| Público | Colombianos que hoy usan o quieren usar una plantilla de finanzas personales; compran por WhatsApp y pagan con Nequi, Daviplata o Bre-B |
| Producto actual | Plantilla de finanzas personales en Google Sheets / Excel, más guías en PDF y página de entrega |
| Producto nuevo | Esta app, como "versión app" del pack de finanzas personales |
| Prototipo de referencia | `finanzas-prototipo.html` (un solo archivo, JavaScript sin framework, datos en localStorage). También publicado como artifact |
| Idioma y moneda | Español de Colombia. Pesos colombianos (COP), formato `$ 1.234.567`, **sin decimales** |

**Qué hace bien el prototipo y se conserva:** estructura de seis cubos (ingresos, facturas, gastos, ahorros, deudas, inversiones), presupuesto contra real, donut "A dónde va mi dinero", barras mes a mes, selector Mes/6 meses/Año, edición de movimientos, metas con aporte sugerido, comparación bola de nieve vs avalancha.

**Qué hay que reconstruir bien:** el prototipo guarda todo en un único objeto en localStorage y calcula saldos sumando movimientos en cada render. Para la v1 se usa una capa de datos real (sección 3), pruebas automáticas y el modelo ampliado de la sección 4.

---

## 2. Principios de producto

1. **Privacidad primero.** Los datos viven solo en el dispositivo de la persona. No hay servidor con datos de usuarios en la v1. No se envían movimientos a ningún lado. Sin analítica en la v1 (si se agrega después, que sea sin datos financieros y con aviso).
2. **Los números nunca fallan.** Todo el cálculo vive en un módulo puro con pruebas. Dinero como **enteros en pesos**, nunca decimales de punto flotante.
3. **Rápido de registrar.** Registrar un gasto debe tomar 3 toques o menos desde Inicio.
4. **Nada se anota solo.** Los movimientos repetidos aparecen como pendientes y se registran con un toque. La app nunca inventa movimientos.
5. **Se puede corregir todo.** Cada dato ingresado se puede editar o eliminar, y los totales se recalculan.
6. **Primero el celular.** Diseñar para 360 a 430 px de ancho. En escritorio, columna central de hasta 980 px.
7. **Sin sorpresas de pérdida de datos.** Recordatorio de respaldo, almacenamiento persistente y migraciones probadas.
8. **Honestidad legal.** Es una herramienta educativa, no asesoría financiera ni tributaria. Cualquier cifra legal sale de un archivo de parámetros versionado y verificable (sección 7).

---

## 3. Stack recomendado

Es una recomendación. Si Claude Code ve una razón fuerte para cambiar algo, debe consultarlo antes.

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Vite + React + TypeScript | Estándar, rápido, mantenible por cualquier programador |
| Estilos | CSS con variables (tokens) y CSS Modules (decidido; sin Tailwind) | Los tokens de la sección 8 deben ser la única fuente de color |
| Datos locales | IndexedDB con Dexie | Más robusto y con más capacidad que localStorage; permite consultas y migraciones |
| Cálculo | Módulo `engine/` en TypeScript puro, sin dependencias de React | Probable con Vitest |
| Validación | Zod para validar respaldos importados | Evita cargar archivos corruptos |
| Gráficos | SVG propio (como en el prototipo) o Recharts | El prototipo ya tiene donut y barras; mantener ligereza |
| PWA | `vite-plugin-pwa` (Workbox) | Instalable, offline, aviso de actualización |
| Excel | ExcelJS o SheetJS cargado solo al exportar (carga diferida) | No pesa en el arranque |
| Pruebas | Vitest (engine y migraciones) + Playwright (flujos clave) | |
| Hosting | Cloudflare Pages o Netlify, con dominio propio | Gratis para este tamaño; la **dirección no debe cambiar nunca** (ver sección 11) |

Estructura sugerida:

```
/src
  /engine        # cálculo puro: totales, presupuesto, metas, deudas, quincena
  /db            # Dexie, esquema, migraciones, respaldo
  /rules         # parámetros de Colombia por año (JSON)
  /features      # onboarding, inicio, movimientos, presupuesto, metas, deudas, ajustes
  /components    # UI reutilizable
  /styles        # tokens
  /tests
```

---

## 4. Modelo de datos

Reglas generales:
- **Dinero:** entero en pesos (`number` entero). Nunca `float` para montos.
- **Fechas:** texto `YYYY-MM-DD` en hora local de Colombia. Meses como `YYYY-MM`.
- **IDs:** `crypto.randomUUID()`.
- **Versión de esquema:** número entero guardado en la base (`schemaVersion`, empieza en 1).

```ts
type Group = 'ingresos' | 'facturas' | 'gastos' | 'inversiones'; // grupos con categorías
type Kind = 'ingreso' | 'factura' | 'gasto' | 'inversion' | 'ahorro' | 'pago_deuda' | 'transferencia';

interface Account {
  id: string;
  name: string;                    // "Efectivo", "Nequi", "Daviplata", "Bancolombia ahorros", "Tarjeta Visa"
  type: 'efectivo' | 'billetera' | 'banco' | 'tarjeta_credito';
  openingBalance: number;          // saldo inicial; para tarjeta_credito = deuda inicial (>= 0)
  archived: boolean;
  debtId?: string;                 // solo tarjeta_credito: Debt asociada (tasa EA, cuota mínima)
  order: number;                   // posición en la lista de cuentas (Anexo D.23)
}

interface Category {
  id: string;
  group: Group;
  name: string;
  budget: number;                  // presupuesto mensual, 0 si no tiene
  dueDay?: number;                 // 1..31, solo facturas
  isOther: boolean;                // "Otros": no se puede borrar ni renombrar
  isSystem: boolean;               // p. ej. "Intereses y cuotas de manejo"
  archived: boolean;
  order: number;                   // posición dentro de su grupo; "Otros" siempre al final (Anexo D.23)
}

interface Transaction {
  id: string;
  kind: Kind;
  date: string;                    // YYYY-MM-DD
  amount: number;                  // siempre > 0
  accountId: string;               // cuenta que se afecta (para transferencia: origen)
  toAccountId?: string;            // solo transferencia
  categoryId?: string;             // ingreso, factura, gasto, inversion
  goalId?: string;                 // ahorro
  debtId?: string;                 // pago_deuda
  interestPart?: number;           // pago_deuda: parte del pago que fue interés (opcional, default 0)
  note?: string;
  fromRecurringId?: string;        // si se creó desde un pendiente
  scheduledDate?: string;          // YYYY-MM-DD programada del pendiente (aunque `date` real sea otra)
}

interface Recurring {              // plantilla de movimiento que se repite
  id: string;
  kind: Kind;
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string; goalId?: string; debtId?: string;
  note?: string;
  schedule:
    | { type: 'mensual'; day: number }                 // 1..31 (si el mes no tiene ese día, último día)
    | { type: 'quincenal'; days: [number, number] }    // normalmente [15, 31] (31 = último día del mes)
    | { type: 'anual'; month: number; day: number };   // p. ej. prima, cesantías
  active: boolean;
  startMonth: string;              // YYYY-MM
}

interface RecurringSkip { recurringId: string; month: string; day: number } // pendiente descartado

interface Goal {
  id: string; name: string; target: number;
  openingSaved: number;            // lo ya ahorrado al crear la meta
  deadline: string;                // YYYY-MM
  archived: boolean;
}

interface Debt {
  id: string; name: string;
  type: 'credito' | 'tarjeta_credito' | 'otro';
  openingBalance: number;          // saldo inicial; para tarjeta_credito siempre 0 (el saldo vive en la Account)
  rateEA: number;                  // % efectiva anual, 0..200
  minPayment: number;
  archived: boolean;
}

interface Profile {
  name: string;
  incomeType: 'empleado' | 'independiente' | 'ambos';
  payFrequency: 'mensual' | 'quincenal';
  mainGoal: 'ordenar' | 'ahorrar' | 'deudas' | 'emergencia';
  onboardingDone: boolean;
  firstStepsDone: string[];        // ids de pasos cumplidos
  firstStepsDismissed?: boolean;   // la persona cerró la tarjeta "Primeros pasos"
  startTab?: 'inicio' | 'movimientos' | 'presupuesto' | 'metas' | 'deudas'; // según objetivo del onboarding
}

interface Settings {
  strategy: 'bola' | 'avalancha';
  extraPayment: number;
  lastBackupAt?: string;           // YYYY-MM-DD
  schemaVersion: number;
  theme: 'sistema' | 'claro' | 'oscuro';
  isDemo?: boolean;                // los datos actuales son "Datos de ejemplo"
}
```

### 4.1 Derivados (nunca se guardan, se calculan)

| Dato | Fórmula |
|---|---|
| Saldo de cuenta (no tarjeta) | `openingBalance + Σ ingresos − Σ (factura, gasto, inversion, ahorro, pago_deuda) − Σ transferencias salientes + Σ transferencias entrantes` |
| Saldo (deuda) de tarjeta | `openingBalance + Σ gastos/facturas/inversiones pagados con esa cuenta − Σ transferencias entrantes a esa cuenta` |
| Ahorrado en una meta | `openingSaved + Σ movimientos kind='ahorro' con ese goalId` |
| Saldo de una deuda tipo crédito u otro | `max(0, openingBalance − Σ (amount − interestPart) de pagos con ese debtId)` |
| Patrimonio neto | `Σ saldos de cuentas (no tarjeta) − Σ saldos de deuda (tarjetas) − Σ saldos de deudas tipo crédito u otro` |

Restricción v1 de la tarjeta: una cuenta `tarjeta_credito` solo acepta como `accountId` movimientos `gasto`, `factura` e `inversion`, y solo puede ser **destino** de transferencias. No acepta ingresos, ahorros, pagos de deuda ni transferencias salientes (avances y devoluciones quedan para v2).

### 4.2 Qué cuenta en cada total (regla central)

| Kind | Entra a | Notas |
|---|---|---|
| `ingreso` | Ingresos del período | Suma el saldo de la cuenta |
| `factura` | Salidas: facturas | |
| `gasto` | Salidas: gastos | Si la cuenta es tarjeta, cuenta **en el momento de la compra** |
| `inversion` | Salidas: inversiones | |
| `ahorro` | Salidas: ahorros | Resta de la cuenta origen; suma a la meta |
| `pago_deuda` | Salidas: deudas por `amount − interestPart`; `interestPart` cuenta como **gasto** en la categoría de sistema "Intereses y cuotas de manejo" | |
| `transferencia` | **Ninguno.** No es ingreso ni gasto | Solo mueve saldo entre cuentas. Pagar una tarjeta es una transferencia banco → tarjeta |

> Invariante que debe probarse: **crear, editar o borrar una transferencia no cambia ningún total de ingresos ni de salidas**, solo los saldos de las dos cuentas.

### 4.3 Tarjeta de crédito (decisión de diseño)

- Una tarjeta es una `Account` de tipo `tarjeta_credito` enlazada a una `Debt` (`type: 'tarjeta_credito'`) con su tasa EA y cuota mínima.
- Comprar con la tarjeta registra un `gasto` (o factura) con `accountId` = la tarjeta. Sube la deuda y cuenta como gasto ese día.
- Pagar la tarjeta es una `transferencia` desde una cuenta propia hacia la tarjeta. Baja la deuda y no cuenta como gasto.
- Intereses y cuota de manejo se registran como `gasto` en la categoría de sistema "Intereses y cuotas de manejo".
- La tarjeta aparece en la pestaña Deudas y entra a la simulación de estrategia con su saldo derivado.
- **v2:** compras diferidas a cuotas.

### 4.4 Categorías por defecto (editables)

Cada grupo tiene "Otros" (no se borra). Las demás se pueden renombrar, archivar o eliminar si no tienen movimientos.

- **Ingresos:** Salario, Honorarios o trabajo independiente, Ventas, Prima de servicios, Cesantías e intereses, Ingresos extra, Otros ingresos.
- **Facturas:** Arriendo o cuota de vivienda, Servicios públicos, Internet y celular, Suscripciones, Seguros, Educación, Administración, Otras facturas.
- **Gastos:** Vivienda o arriendo, Mercado, Transporte, Comida fuera, Salud, Ocio, Ropa, Mascotas, Gastos hormiga, Impuestos y GMF (4x1000), Intereses y cuotas de manejo (sistema), Otros gastos.
- **Inversiones:** CDT, Fondo de inversión, Acciones o ETF, Otras inversiones.

Ahorros y deudas no usan categorías: se manejan con metas y deudas.

---

## 5. Reglas de cálculo (módulo `engine/`)

### 5.1 Presupuesto y totales
- Totales del mes: suma de movimientos por `kind` en `YYYY-MM`.
- "Te queda en el mes" = ingresos − salidas (facturas + gastos + inversiones + ahorros + deudas), con la regla de la sección 4.2.
- Presupuesto por grupo: suma de `budget` de sus categorías. Ahorros: suma de aportes mensuales sugeridos de las metas. Deudas: suma de cuotas mínimas de deudas con saldo, más el abono extra.
- "Falta por presupuestar" = ingresos esperados − presupuesto asignado a los demás grupos. Si es negativo: "Te pasaste por".
- Alerta "Excediste tu presupuesto" cuando facturas + gastos del mes superan su presupuesto.
- En vistas de 6 meses y Año, el presupuesto se multiplica por el número de meses transcurridos (hasta el mes actual, mínimo 1).

### 5.2 Metas de ahorro
- `faltante = max(0, target − ahorrado)`.
- `meses = max(1, mesesEntre(mesActual, deadline))`.
- `aporteSugerido = ceil(faltante / meses / 1000) * 1000`. Si `faltante = 0`, el aporte es 0 y la meta se muestra como cumplida.

### 5.3 Deudas: tasa y simulación

**Conversión de tasa:** `tasaMensual = (1 + EA/100)^(1/12) − 1`. La app pide siempre EA (como la publica el banco). Nunca dividir la anual entre 12.

**Algoritmo (debe reproducirse exactamente):**
```
lista = deudas con saldo > 0.5  (saldo derivado, tasa mensual, cuota mínima)
presupuesto = Σ cuotas mínimas de la lista + abonoExtra   // fijo durante toda la simulación
mes = 0; interesTotal = 0
mientras haya deudas sin pagar y mes < 600:
  mes++
  activas = deudas sin pagar
  para cada activa: interes = saldo * tasaMensual; saldo += interes; interesTotal += interes
  restante = presupuesto
  para cada activa: pago = min(cuotaMinima, saldo); saldo -= pago; restante -= pago
  orden = activas ordenadas por:
     bola:      saldo ascendente
     avalancha: tasa descendente (desempate: saldo ascendente)
  para cada deuda en orden: si restante <= 0 romper; pago = min(restante, saldo); saldo -= pago; restante -= pago
  para cada activa: si saldo <= 0.5 → pagada en este mes, saldo = 0
resultado: { terminó (todas pagadas), meses, interesTotal, mesDePagoPorDeuda, primeraDeudaPagada }
```

**Advertencias obligatorias**
- Si la cuota mínima de una deuda es menor o igual al interés del mes (`saldo × tasaMensual`), mostrar: "La cuota no cubre ni los intereses del mes. La deuda no baja."
- Si la simulación llega a 600 meses sin terminar, mostrar "Sin fecha" y sugerir subir el abono extra.
- Mostrar "Abono extra aquí" en la deuda prioritaria según la estrategia.

**Caso de prueba de regresión** (salida del prototipo con este algoritmo; debe coincidir al peso):

| Deuda | Saldo | EA | Cuota mínima |
|---|---|---|---|
| Tarjeta de crédito | 3.200.000 | 27 % | 160.000 |
| Crédito de libre inversión | 4.500.000 | 22 % | 260.000 |
| Préstamo familiar | 800.000 | 0 % | 100.000 |

Con abono extra de 150.000:
- Avalancha: 15 meses, intereses ≈ 1.143.934; primera deuda pagada en el mes 8.
- Bola de nieve: 15 meses, intereses ≈ 1.190.228; primera deuda pagada en el mes 4.

(Redondeo: los intereses se acumulan en decimales internamente y solo se redondean al mostrar.)

### 5.4 Movimientos que se repiten (pendientes)
- Para cada `Recurring` activa y cada mes visible, se genera un **pendiente** por cada fecha de su `schedule`, desde `startMonth`.
- Un pendiente desaparece cuando existe un `Transaction` con `fromRecurringId` y esa fecha, o un `RecurringSkip`.
- Acciones del pendiente: **Registrar** (un toque; permite ajustar monto antes), **Omitir este mes**.
- Si el día no existe en el mes (31 en febrero), se usa el último día del mes.
- Los pendientes se muestran en Inicio ("Pendientes del mes") y en la vista del mes de Movimientos. No se contabilizan en ningún total hasta que se registran.
- Al registrar un movimiento nuevo, ofrecer el interruptor "Repetir cada mes" que crea la plantilla.

### 5.5 Modo quincenal
- `Profile.payFrequency = 'quincenal'` precarga ingresos programados los días 15 y 30 (último día del mes) con la mitad del ingreso mensual declarado en el onboarding.
- La vista de Inicio ofrece un filtro adicional **Quincena 1 (1 a 15) / Quincena 2 (16 a fin de mes) / Mes completo** dentro del período Mes. Solo afecta lo que se muestra, no los datos.
- Las facturas con `dueDay` se asignan a la quincena según su día.
- El presupuesto sigue siendo mensual; la vista por quincena muestra lo real de esa quincena frente al presupuesto mensual.

### 5.6 Período de dashboard
- **Mes:** el mes seleccionado.
- **6 meses:** el mes seleccionado y los 5 anteriores (ventana móvil). Es la vista por defecto al abrir la app una vez hay datos de más de un mes.
- **Año:** enero a diciembre del año del mes seleccionado. Las flechas mueven 1 mes (Mes y 6 meses) o 12 meses (Año).
- Contenido por período: balance, entró, salió, % de ahorro e inversión sobre lo que entró, promedio mensual, barras por mes, donut de salidas, categorías donde más se gastó (top 8), presupuesto contra real, tabla de detalle por mes con total.

---

## 6. Pantallas y flujos

Navegación inferior con 5 pestañas: **Inicio, Movimientos, Presupuesto, Metas, Deudas**. Botón flotante **+** para registrar. Engranaje de **Ajustes** en la cabecera.

### 6.1 Onboarding (primera vez)
Pantallas cortas, todas con "Saltar" y con la frase "Lo ajustas después":
1. Nombre.
2. Cómo recibes ingresos (empleado, independiente, ambos) y frecuencia (mensual o quincenal).
3. Ingreso mensual aproximado. Crea el ingreso programado (y la prima y cesantías si es empleado; ver 7).
4. Dónde guardas tu plata: efectivo, Nequi, Daviplata, banco; con saldo de cada una (opcional).
5. ¿Tienes deudas? Agregar nombre, saldo, EA, cuota mínima (opcional, repetible). Pregunta si alguna es tarjeta de crédito.
6. ¿Qué quieres lograr primero? (ordenar gastos, ahorrar para algo, pagar deudas, fondo de emergencia). Crea la primera meta si aplica y define la pestaña inicial.
7. Frase de privacidad: "Tus datos se quedan en tu dispositivo."

Después: tarjeta **Primeros pasos** en Inicio (registra tu primer gasto, define tu presupuesto, activa un movimiento que se repite, haz tu respaldo). Desaparece al completarse o al descartarla.

**Aceptación:** el onboarding se puede saltar entero y la app queda usable con cuentas y categorías por defecto; se puede repetir desde Ajustes sin borrar datos.

### 6.2 Inicio
- Selector Mes | 6 meses | Año (sección 5.6).
- Tarjeta principal: "Te queda en <mes>" (o "Balance" en 6 meses y Año), entró, salió, avance contra presupuesto, alerta de exceso, sin asignar.
- **Pendientes del mes** (sección 5.4).
- Facturas del mes con estado (pagada, vence hoy, vence en N días, vencida) y botón Pagar.
- A dónde va mi dinero (donut con leyenda y porcentajes).
- Presupuesto contra real por grupo.
- Cuentas y patrimonio neto (tarjetas se restan).
- Metas y Deudas resumidas con acceso rápido.
- Últimos 6 meses (en vista Mes).
- Aviso de respaldo si pasaron 30 días o nunca se ha hecho (sección 9).

### 6.3 Registrar (hoja inferior)
- Tipos: Gasto, Ingreso, Factura, Inversión, **Transferencia**. Ahorro y pago de deuda se registran desde Metas y Deudas.
- Campos: monto (teclado numérico, formato con puntos), categoría con **"+ Crear categoría"** inline (si no hay, o para una nueva), cuenta, fecha (hoy por defecto), nota, interruptor **"Repetir cada mes"**.
- Transferencia: cuenta origen, cuenta destino (distinta), monto, fecha, nota. Si el destino es tarjeta de crédito se muestra "Pago de tarjeta".
- Pago de deuda: monto, cuenta, fecha, campo opcional "De este pago, intereses".
- Validaciones con mensajes claros (monto mayor a 0, fecha válida, origen distinto de destino).

### 6.4 Movimientos
- Lista por día del período, con filtro por tipo, **búsqueda por texto** (nota, categoría, cuenta), filtro por cuenta, categoría y rango de monto.
- Tocar un movimiento abre el formulario de edición con todo prellenado, más "Eliminar" con confirmación en la misma pantalla (sin diálogos del navegador).
- Editar o eliminar recalcula todos los totales y saldos.

### 6.5 Presupuesto
- Resumen: ingresos esperados, asignado por grupo, falta por presupuestar.
- Categorías por grupo con monto presupuestado editable, real del mes, barra de avance, día de vencimiento en facturas.
- Gestión de categorías: crear, renombrar, archivar; eliminar solo si no tienen movimientos. "Otros" no se elimina ni se renombra.
- Ahorros y deudas se muestran en solo lectura (vienen de Metas y Deudas).

### 6.6 Metas
- Tarjeta por meta: ahorrado, objetivo, porcentaje, meses restantes, aporte sugerido, **Aportar** (elige cuenta origen), **Editar**, **Quitar** (con confirmación; archiva si tiene aportes, o elimina con sus aportes tras confirmar).

### 6.7 Deudas
- Cabecera: "Libre de deudas en <mes año>", meses, total que debes, intereses estimados.
- Plan: estrategia (bola/avalancha), abono extra, comparación de las dos estrategias (tabla con meses, intereses, primera deuda pagada) y mensaje con el ahorro en intereses.
- Tarjeta por deuda: saldo, EA, cuota mínima, progreso, fecha estimada de pago, advertencia de cuota insuficiente, **Registrar pago**, **Editar**, **Quitar**.
- Las tarjetas de crédito se muestran aquí con su saldo derivado de la cuenta.

### 6.8 Ajustes
- Perfil (nombre, tipo de ingreso, frecuencia, objetivo principal), repetir onboarding.
- Cuentas: crear, renombrar, archivar, saldo actual (ajustar saldo crea un movimiento de ajuste o modifica el saldo inicial; ver nota abajo), tipo (incluye tarjeta de crédito).
- Movimientos que se repiten: lista, pausar, editar, borrar.
- Respaldo y restauración, exportar a Excel (sección 9).
- Tema (sistema, claro, oscuro).
- Acerca de: versión de la app, versión de parámetros de Colombia, aviso educativo, política de privacidad corta.
- Cargar datos de ejemplo / borrar todo (con doble confirmación).

> Nota sobre "ajustar saldo": al corregir el saldo de una cuenta, la v1 modifica `openingBalance` para que el saldo derivado coincida con lo que la persona indica. Mostrar el aviso: "Esto corrige tu saldo de partida; tus movimientos no cambian."

### 6.9 Modo ejemplo
Un conjunto de datos de ejemplo claramente marcado como tal ("Datos de ejemplo") para explorar la app y para las capturas de venta. Se parte del generador del prototipo (`demo()`), ampliado con una transferencia, una tarjeta de crédito y movimientos repetidos. Al "Empezar con mis datos" se borra el ejemplo con confirmación.

---

## 7. Parámetros y reglas de Colombia

### 7.1 Archivo de parámetros por año
`/src/rules/co/AAAA.json`, **separado de los datos del usuario**. Estructura:

```json
{
  "year": 2026,
  "version": "2026.0",
  "verifiedAt": null,
  "sources": [],
  "smmlv": null,
  "auxilioTransporte": null,
  "uvt": null,
  "usuraEA": null,
  "primaFechas": { "semestre1": "06-30", "semestre2": "12-20" },
  "cesantias": { "consignacionFondo": "02-14", "interesesAnuales": 0.12, "pagoIntereses": "01-31" }
}
```

> **Instrucción para Claude Code:** no inventar ni recordar cifras. Los valores `null` se completan con Sebastián a partir de fuentes oficiales (decreto del salario mínimo, Ministerio del Trabajo, DIAN para la UVT, Superintendencia Financiera para la usura) y se registran en `sources` y `verifiedAt`. Las fechas de prima y cesantías de la tabla son las reglas generales para empleados dependientes; **verificar antes de lanzar**.
> La tasa de usura cambia cada trimestre: debe poder actualizarse sin tocar el código.

### 7.2 Uso en la app
- **Prima de servicios** (empleados): ingreso programado anual en junio y diciembre. Monto sugerido aproximado = medio mes de salario (más auxilio de transporte si aplica) por semestre completo trabajado; siempre editable y marcado "aproximado".
- **Cesantías** (empleados): ingreso programado anual cerca de febrero, e intereses de cesantías en enero. Se sugiere monto aproximado, editable. Ojo: muchas personas reciben cesantías en un fondo y no en su cuenta; ofrecer "Esto lo recibo / esto lo consigna mi empleador al fondo" y solo programar lo primero.
- **Independientes:** no aplican prima ni cesantías; no se crean. Ofrecer recordatorio opcional de apartar para seguridad social e impuestos como categoría propia (sin calcular montos legales).
- **GMF (4x1000):** solo como categoría "Impuestos y GMF (4x1000)". No se calcula automáticamente en la v1.
- **Usura:** si la persona ingresa una EA superior a la usura vigente del archivo de parámetros, mostrar una nota informativa (no bloquear). Si `usuraEA` es `null`, no mostrar nada.
- Todo cálculo legal muestra la etiqueta "Aproximado. Verifica con tu empleador o contador."

### 7.3 Actualización anual (cada enero)
1. Agregar `AAAA.json` nuevo con valores verificados.
2. La app carga el archivo del año en curso; si no existe, usa el último disponible y lo indica en Ajustes > Acerca de.
3. Los movimientos de años anteriores **no se modifican**.
4. Publicar nueva versión en la misma dirección; los usuarios reciben el aviso de actualización y conservan sus datos.

---

## 8. Interfaz: tokens de diseño

El prototipo ya define casi todos los tokens; llevarlos tal cual y aplicar los ajustes de la sección 8.2.

### 8.1 Base de marca
| Token | Valor | Uso |
|---|---|---|
| Morado de marca | `#6A1B9A` | Tarjeta principal, botones, acentos |
| Amarillo de marca | `#FFEB3B` | **Solo acento pequeño** (puntos, subrayados, texto sobre morado). **Nunca como fondo** |
| Fuente de títulos | Baloo Bhaina 2 | Títulos y cifras grandes |
| Fuente de texto | Roboto | Cuerpo y UI |
| Fondo claro | neutro con matiz lila (`#F6F2F9`) | |
| Fondo oscuro | `#140D1B` | Modo oscuro automático según el sistema |

Logos de marca: el manual de marca (PDF en el proyecto) manda. Se necesitan los archivos locales (SVG o PNG) para incluirlos en la app; no depender de enlaces externos (la app debe funcionar sin internet). Referencia de los logos alojados hoy: horizontal `r1Fw8LB`, vertical `VUI0xSu`, isotipo `cGAOMsW`, logotipo `zMRFNKl` (Imgur).

### 8.2 Ajustes de color respecto al prototipo
1. Bajar un poco la saturación de los colores de categorías para una lectura más sobria.
2. **Rojo solo para alertas y deudas; verde solo para ingresos y "pagada".** Cada color significa una sola cosa.
3. Verificar contraste de texto pequeño sobre chips y etiquetas (meta: WCAG AA).
4. Nunca depender solo del color: toda leyenda y estado lleva texto.

### 8.3 Reglas de interfaz
- Mínimo 44 px de alto en elementos tocables.
- Teclado numérico para montos, con formato de miles con puntos mientras se escribe.
- Sin `alert`, `confirm` ni `prompt`; las confirmaciones van dentro de la página.
- Respetar áreas seguras del celular (notch, barra inferior) y `prefers-reduced-motion`.
- Estados vacíos con una frase útil y una acción, nunca una pantalla en blanco.

---

## 9. Respaldo, restauración, exportación y persistencia

### 9.1 Respaldo
- Botón **Descargar respaldo** → archivo `academia-finanzas-AAAA-MM-DD.json`.
- Formato:
```json
{ "app": "academia-creativa-finanzas", "schemaVersion": 1, "exportedAt": "2026-10-21T18:00:00-05:00", "data": { ... todas las tablas ... } }
```
- Tras descargar, guardar `lastBackupAt`.
- **Recordatorio:** si pasaron 30 días sin respaldo (o nunca, teniendo movimientos), mostrar aviso en Inicio con botón "Respaldar".

### 9.2 Restauración
1. La persona elige el archivo.
2. Se valida con Zod y se migra si el `schemaVersion` es anterior.
3. Vista previa: "Este respaldo trae N movimientos, hasta <fecha>. Reemplazará tus datos actuales."
4. Confirmación explícita. Antes de reemplazar, guardar una copia automática de los datos actuales (disponible para deshacer durante la sesión).
5. Archivos de una versión **más nueva** que la app: rechazar con "Actualiza la app para abrir este respaldo".

### 9.3 Exportar a Excel
Archivo `.xlsx` con hojas: **Movimientos**, **Resumen por mes**, **Presupuesto**, **Metas**, **Deudas**, **Cuentas**. Formato de moneda `"$ "#,##0`, fechas legibles, encabezados claros. Es solo lectura para el usuario (no se importa de vuelta en la v1).

### 9.4 Persistencia
- Solicitar almacenamiento persistente (`navigator.storage.persist()`) al terminar el onboarding.
- En iPhone, Safari puede borrar datos de sitios que no se usan en semanas; mitigar con: pedir instalar la app en la pantalla de inicio (guía de dos pasos con capturas), y mostrar el recordatorio de respaldo.
- Mostrar en Ajustes el estado: "Almacenamiento protegido: sí/no".

### 9.5 Migraciones
- Cada cambio de estructura sube `schemaVersion` y agrega una función `migrate_vN_to_vN+1` en `/db/migrations`.
- Las migraciones corren al abrir la app y al restaurar un respaldo.
- Cada migración tiene una prueba con un respaldo de la versión anterior.
- Nunca borrar campos sin migrar.

---

## 10. PWA y publicación

- `manifest.webmanifest`: nombre, nombre corto, íconos (maskable), colores de la marca, `display: standalone`, `lang: es-CO`.
- Service worker con estrategia de caché de la app completa (funciona sin internet).
- **Aviso de actualización:** "Hay una versión nueva. Toca para actualizar." Al actualizar se conservan los datos.
- Guía de instalación breve dentro de la app para Android (Chrome) e iPhone (Safari > Compartir > Añadir a pantalla de inicio).
- Etiqueta `noindex` y `robots.txt` que bloquee buscadores en la v1 (ver sección 12).
- Despliegue en Cloudflare Pages o Netlify, con dominio propio y HTTPS.

---

## 11. Regla de la dirección

> **La dirección web de la app no puede cambiar una vez que haya clientes.** Los datos de cada persona están guardados bajo esa dirección; si cambia, pierden todo salvo que restauren un respaldo.

Antes del primer cliente, definir y comprar el dominio definitivo. Si en el futuro hay que migrar de dominio: el dominio viejo muestra una pantalla de "Descarga tu respaldo y ábrelo en la nueva dirección" con los dos pasos.

---

## 12. Acceso y seguridad

**v1:** link privado, no indexado, que se entrega en la página de entrega que ya existe. Cualquiera con el link puede abrir la app; esto es aceptable para empezar a vender.

**Enganche futuro:** el arranque de la app pasa por un componente `AccessGate` que hoy deja pasar siempre. Más adelante se podrá poner ahí un código de acceso por compra (con validación mínima en el hosting) **sin tocar el modelo de datos**. No implementar nada de eso ahora.

Pendiente de negocio (no bloquea la construcción): acceso de por vida con actualizaciones incluidas o versiones pagas aparte.

---

## 13. Textos legales y de privacidad

- **Aviso educativo** (Ajustes > Acerca de y pie del onboarding): "Esta aplicación es una herramienta educativa para organizar tus finanzas. No constituye asesoría financiera, legal ni tributaria."
- **Privacidad:** "Tus datos se guardan solo en este dispositivo. Academia Creativa no los recibe ni los almacena. Si borras los datos del navegador o cambias de dispositivo sin respaldo, los pierdes."
- Cifras legales siempre etiquetadas "Aproximado. Verifica con tu empleador o contador."
- Revisar el texto final con Sebastián antes de publicar.

---

## 14. Calidad y pruebas

**Pruebas automáticas del `engine/` (Vitest), mínimas:**
1. Saldos de cuentas con ingresos, gastos y transferencias.
2. **Invariante de transferencias** (sección 4.2).
3. Tarjeta de crédito: compra sube la deuda y cuenta como gasto; pago por transferencia baja la deuda y no cuenta como gasto; patrimonio neto correcto.
4. Pago de deuda con `interestPart`: el interés cuenta como gasto y el resto baja el saldo.
5. Simulación de deudas: el **caso de regresión de la sección 5.3**, deuda con cuota menor al interés, tope de 600 meses, deuda a 0 % EA, una sola deuda, ninguna deuda.
6. Metas: aporte sugerido, meta cumplida, fecha pasada.
7. Pendientes: generación mensual, quincenal, anual, día 31 en febrero, omitir, registrar, no duplicar.
8. Períodos: Mes, 6 meses y Año, incluyendo cambio de año.
9. Presupuesto multiplicado por meses transcurridos.
10. Respaldo: ida y vuelta (exportar y restaurar da los mismos datos); archivo corrupto; archivo de versión más nueva.
11. Migraciones: un respaldo de cada versión anterior migra y pasa las demás pruebas.
12. Formato COP: `1234567` → `$ 1.234.567`; negativos; cero.

**Pruebas de flujo (Playwright), mínimas:** onboarding completo y saltado; registrar, editar y eliminar un gasto; transferencia; registrar un pendiente; crear categoría al registrar; cambiar de período; respaldar y restaurar; modo oscuro.

**Compatibilidad:** Chrome y Edge recientes, Safari de iOS 16 o superior, Chrome en Android, Safari de macOS, Firefox. Anchos de 360 a 430 px sin scroll horizontal.

**Accesibilidad:** navegación por teclado, etiquetas en controles, contraste AA, no depender solo del color.

**Rendimiento:** primera carga bajo 2 segundos en 4G, app usable sin internet después de la primera visita. Probar con 5.000 movimientos.

---

## 15. Fases de construcción

| Fase | Entregable | Cómo se sabe que terminó |
|---|---|---|
| 0 | Proyecto, estructura, tokens, CI con pruebas | `npm test` y `npm run build` pasan |
| 1 | `engine/` y `db/` con esquema, migraciones y respaldo | Pruebas de la sección 14 (puntos 1 a 12) en verde |
| 2 | Pantallas base: Inicio, Movimientos (con edición), Presupuesto, Metas, Deudas, Ajustes | El prototipo queda replicado con datos reales |
| 3 | Transferencias, tarjeta de crédito, movimientos repetidos, categoría "Otros" y crear al registrar, búsqueda y filtros | Invariantes y flujos Playwright en verde |
| 4 | Onboarding, primeros pasos, prima, cesantías y quincena, períodos 6 meses y Año completos | Flujo completo probado en un celular real |
| 5 | Respaldo en archivo, exportar a Excel, persistencia, PWA, aviso de actualización, textos legales | Instalable en Android e iPhone, funciona sin internet |
| 6 | Pruebas con 3 a 5 clientes reales durante una semana; corregir | Lista de problemas cerrada o priorizada |
| 7 | Publicación en dominio propio y entrega a clientes | Link definitivo, página de entrega actualizada |

Al terminar cada fase, Claude Code resume qué quedó hecho, qué decisiones tomó y qué quedó pendiente.

---

## 16. Decisiones pendientes (de Sebastián)

1. Nombre final del producto y dominio.
2. Modelo de acceso y de actualizaciones (de por vida o versiones pagas). El control de acceso queda para después de empezar a vender.
3. Valores legales de cada año (salario mínimo, auxilio de transporte, UVT, usura) con sus fuentes.
4. Archivos de logo (SVG o PNG) y revisión del manual de marca.
5. Texto final de aviso educativo y privacidad.
6. Quiénes harán la prueba de la fase 6.
7. Compras diferidas a cuotas (v2): ¿cuándo?

---

## 17. Cómo debe trabajar Claude Code

1. Leer este documento completo y el prototipo antes de escribir código. Si algo no está claro, preguntar.
2. **Consultar antes de cambiar el modelo de datos** de la sección 4 o las reglas de la sección 4.2.
3. Todo el texto visible va en español de Colombia, tono claro y cercano (tú, no usted), sin jerga financiera innecesaria.
4. No inventar cifras legales ni fechas: usar el archivo de parámetros y dejar `null` donde falte.
5. Cada regla de cálculo nueva lleva su prueba.
6. No agregar dependencias pesadas sin justificarlo; cargar de forma diferida lo que no se use al arrancar (Excel).
7. Mantener la app funcionando sin internet después de la primera carga.
8. No enviar datos del usuario a ningún servidor.
9. Commits pequeños con mensajes claros; un README corto con cómo correr, probar y publicar.
10. Al cierre de cada fase, entregar un resumen: hecho, decisiones, pendientes.

**Bloque sugerido para `CLAUDE.md` en la raíz del repositorio:**

```md
# Academia Creativa Finanzas
App web instalable (PWA) de finanzas personales para Colombia. Lee SPEC.md antes de tocar código.
- Dinero: enteros en pesos COP. Nunca floats. Formato `$ 1.234.567`.
- Datos solo en el dispositivo (IndexedDB/Dexie). Sin servidor, sin analítica.
- Todo cálculo vive en /src/engine con pruebas (Vitest). Las transferencias no cuentan como ingreso ni gasto.
- Cifras legales solo desde /src/rules/co/AAAA.json; si falta un valor, dejar null y avisar.
- Textos en español de Colombia, tuteo. Marca: morado #6A1B9A; amarillo #FFEB3B solo como acento pequeño.
- Consultar antes de cambiar el modelo de datos. Cada cambio de esquema = migración con prueba.
```

---

## Anexo A. De la plantilla a la app

| Plantilla (Google Sheets) | En la app | Mejora |
|---|---|---|
| Inicio: año, moneda, catálogo de hasta 75 nombres | Onboarding, Ajustes y categorías editables sin tope | Sin catálogo previo obligatorio; COP fijo sin decimales |
| 12 hojas mensuales (calendario de pagos, ingresos, facturas, gastos, deudas, ahorros, inversiones, notas) | Movimientos y Presupuesto con selector de mes | Sin límite de 100 movimientos por mes; sin hojas duplicadas |
| Facturas con día de vencimiento y casilla de pagado | Facturas del mes con estado y botón Pagar | Pendientes que se repiten con un toque |
| "A dónde va mi dinero" y alerta de exceso | Donut y alerta en Inicio | Igual, más porcentajes y leyenda |
| Resumen Anual con 7 gráficos | Dashboard de 6 meses y Año | Detalle mes a mes y categorías principales |
| Deudas: 10 deudas, 500 meses, bola de nieve o avalancha, tabla ordenada con `QUERY` | Pestaña Deudas con simulación en código | Sin dependencia de funciones solo de Sheets; EA correcta; comparación de estrategias; avisos |
| Ahorros: 10 metas, fecha objetivo, aporte mensual | Metas sin tope | Aporte sugerido y avance claros |
| "Patrimonio" como flujo mensual | Patrimonio neto real (cuentas menos deudas) | Cuentas con saldos |
| No existían: cuentas, transferencias, tarjeta, repetidos, prima, cesantías, quincena, respaldo, Excel | Todos nuevos | Cubren los vacíos detectados en la revisión |

**Problemas de la plantilla que la app resuelve:** funciones que no existen en Excel (`IFS`, `CONCAT`, `FILTER`/`TRANSPOSE`, `QUERY`), interés mal calculado para Colombia (tasa anual dividida entre 12), cronogramas de deuda de hasta 500 meses sin avisar cuando la deuda no baja, límites fijos, formato de fechas mezclado, instrucción de "hacer una copia" para empezar.

## Anexo B. Qué reutilizar del prototipo

- `sim()` (simulación de deudas): reproducir el algoritmo de la sección 5.3 en TypeScript.
- `demo()` (datos de ejemplo): base del modo ejemplo.
- `donut()` y `bars()` (gráficos SVG).
- Formato de dinero (`money`, `plain`), conversión de meses (`addM`, `diffM`).
- Estructura visual, textos y tokens de color.

No reutilizar: el estado único en memoria, el cálculo en cada render, el guardado en localStorage ni el respaldo por texto copiado.

## Anexo C. Glosario

- **EA:** tasa efectiva anual, la que publican los bancos.
- **Bola de nieve:** pagar primero la deuda de menor saldo.
- **Avalancha:** pagar primero la deuda de mayor tasa.
- **GMF (4x1000):** gravamen a los movimientos financieros.
- **Pendiente:** movimiento repetido que aún no se ha registrado en el mes.
- **Patrimonio neto:** lo que tienes en cuentas menos lo que debes.

## Anexo D. Decisiones resueltas (21 de octubre de 2026)

Tomadas con Sebastián antes de la Fase 0. Cuando una decisión cambia una sección anterior, manda este anexo.

**Tarjeta de crédito y deudas**
1. En Deudas, "Registrar pago" de una tarjeta abre una **transferencia** hacia la tarjeta (solo pide cuenta de origen, monto, fecha). Nunca crea `pago_deuda` para tarjetas.
2. La cuota mínima de las tarjetas **no entra** al presupuesto del grupo Deudas (sección 5.1), porque las compras ya cuentan en gastos y facturas. En Deudas se muestra como dato informativo. Sí sigue entrando a la simulación de estrategia (sección 5.3).
3. Una cuenta tarjeta solo acepta compras (gasto, factura, inversión) y transferencias entrantes (pagos). Avances y devoluciones: v2. Ver restricción en 4.1.
4. Las deudas tipo `otro` se calculan igual que `credito`: saldo, patrimonio neto y simulación.
5. El saldo inicial de una tarjeta vive solo en `Account.openingBalance`; `Debt.openingBalance` de una tarjeta es siempre 0 y no se usa.
6. Quitar una meta o una deuda **con** movimientos la archiva por defecto (sus movimientos quedan y siguen contando). Eliminarla junto con sus movimientos es una segunda opción con confirmación. Sin movimientos, se elimina directo.

**Movimientos que se repiten**
7. La prima se crea como **dos** plantillas anuales ("Prima de junio" y "Prima de diciembre"). El modelo de `schedule` no cambia.
8. El segundo pago quincenal es el **último día del mes**; se guarda como `days: [15, 31]` y la regla de "si el día no existe, último día" lo resuelve.
9. Un pendiente se considera registrado cuando existe un `Transaction` con su `fromRecurringId` y `scheduledDate` igual a la fecha programada, aunque `date` sea otra. `RecurringSkip` usa la misma fecha programada.
10. Inicio muestra solo los pendientes del mes actual. En Movimientos, cada mes muestra sus propios pendientes (también meses pasados), que se pueden registrar u omitir. No se acumulan atrasados en Inicio.

**Modelo y onboarding**
11. Campos nuevos opcionales: `Settings.isDemo`, `Profile.firstStepsDismissed`, `Profile.startTab`, `Transaction.scheduledDate`. Como se agregan antes de la primera versión publicada, entran en `schemaVersion` 1.
12. "Ingresos esperados" = suma del presupuesto de las categorías de Ingresos. El onboarding pone el ingreso declarado como presupuesto de "Salario" (empleado) o "Honorarios o trabajo independiente" (independiente; si es "ambos", en Salario).
13. La respuesta de cesantías ("las recibo / van al fondo") no se guarda: solo decide si se crea el ingreso programado.
14. Para independientes se ofrece la categoría **"Seguridad social e impuestos"** en el grupo **Facturas**, con día de vencimiento opcional. Sin calcular montos.

**Interfaz y comportamiento**
15. Meta con fecha vencida y sin cumplir: etiqueta "Fecha vencida", lo que falta y acceso a cambiar la fecha. Su aporte sugerido es 0 y no suma al presupuesto de Ahorros.
16. "Hoy" y el mes actual se calculan siempre en la zona horaria `America/Bogota`, sin importar la del dispositivo.
17. Al abrir: la pestaña de `Profile.startTab` (Inicio si no hay). Inicio arranca en "6 meses" si hay datos en más de un mes; si no, en "Mes".
18. Estilos con CSS Modules y variables CSS. Fuentes (Baloo Bhaina 2 y Roboto) incluidas en la app, no desde Google Fonts, para funcionar sin internet.

**Proyecto**
19. CI en GitHub Actions; Sebastián ya tiene cuenta. El repositorio será privado.
20. Commits firmados como `sebastianyagari` <sebastianyagari@gmail.com> (configuración local del repositorio).
21. Logos: se usan los PNG de `/assets` (vertical, isotipo, horizontal, logotipo; todos #6A1B9A con fondo transparente). Mientras llegan los oficiales en blanco, se genera una versión blanca provisional para modo oscuro y fondos morados, marcada como provisional.
22. El caso de regresión de 5.3 se verifica en la Fase 1 ejecutando el `sim()` del prototipo; si los intereses no coinciden al peso con los valores escritos, se corrige el documento con la salida real y se avisa antes. *(Verificado en la Fase 1: coincide al peso.)*

**Agregado en la Fase 1**

23. `Account` y `Category` tienen un campo `order` (entero) para respetar el orden de la sección 4.4 y permitir reordenar. Las cuentas forman una lista; las categorías se ordenan dentro de su grupo. "Otros" va siempre al final de su grupo y no se mueve; una categoría nueva entra justo antes de "Otros". Como la v1 aún no se publica, entra en `schemaVersion` 1.
24. Reglas de cálculo interpretadas en la Fase 1: las cuentas archivadas siguen sumando al patrimonio (la plata existe) y las deudas archivadas no; el abono extra solo entra al presupuesto si hay un crédito u otro con saldo; un saldo a favor en la tarjeta suma al patrimonio y la deuda se muestra en 0; un interés registrado mayor que el pago se limita al monto del pago.

**Agregado en la Fase 4**

25. Primer uso: bienvenida con "Empezar" (onboarding), "Ver con datos de ejemplo" y "Saltar y empezar sin configurar". Desde el ejemplo, "Empezar con mis datos" lleva al onboarding.
26. Montos sugeridos (siempre editables y marcados "Aproximado. Verifica con tu empleador o contador."): prima por semestre = medio mes de ingreso, más medio auxilio de transporte solo si `smmlv` y `auxilioTransporte` del archivo de parámetros no son `null` y el ingreso es de hasta 2 SMMLV; intereses de cesantías = `interesesAnuales` × un mes de ingreso, programados siempre para empleados (los paga el empleador aunque las cesantías vayan al fondo); cesantías = un mes de ingreso, solo si la persona las recibe. Fondo de emergencia sugerido: tres meses de ingreso.
27. El onboarding es idempotente: repetirlo actualiza la misma cuenta (por id), el mismo ingreso programado, la misma prima o cesantía (por categoría y mes) y la misma meta (por nombre); nunca borra movimientos. Las cuentas por defecto que la persona desmarca se archivan solo si no tienen saldo ni movimientos.
28. Primeros pasos se calculan desde los datos (primer gasto o factura, algún presupuesto de salidas, algún movimiento repetido que no sea ingreso). El paso "haz tu respaldo" se agrega en la Fase 5. `Profile.firstStepsDone` queda reservado y no se usa.
29. El almacenamiento persistente (`navigator.storage.persist()`) se pide al terminar el onboarding (SPEC 9.4); el estado se mostrará en Ajustes en la Fase 5.
30. A partir de la prueba en celular: la categoría "Vivienda o arriendo" se agrega también en Gastos (primera de la lista), además de "Arriendo o cuota de vivienda" en Facturas, para quien registra el arriendo como gasto. La de Facturas sigue siendo la que tiene día de vencimiento y aparece en "Facturas del mes".
31. Respaldo adelantado de la Fase 5 a pedido de Sebastián: en Ajustes, "Respaldo de tus datos" con Descargar respaldo (JSON de la SPEC 9.1), Restaurar (vista previa, doble confirmación y "Deshacer la restauración" mientras la app siga abierta) y Exportar a Excel (ExcelJS, cargado solo al exportar). El aviso "Haz tu respaldo" en Inicio no se muestra mientras se vea la tarjeta de Primeros pasos, que ya incluye ese paso.

