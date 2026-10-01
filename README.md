# BAEMAR — Fase 1

Aplicación para procesar comunicaciones (email en esta fase), clasificarlas mediante IA, gestionar clientes, tareas y comunicaciones, sincronizar con Notion y almacenar adjuntos en Dropbox.

Stack: Next.js 16.3.5, React 19, Prisma 6 + SQLite, Tailwind CSS 4, Node 22.

## Requisitos

- Node.js 22+
- npm 10+
- Cuenta de Notion con 3 bases de datos (ver abajo).
- Cuenta de Dropbox con app y refresh token (ver abajo).
- Clave de API de OpenAI o Anthropic.

## Instalación

```bash
npm install
npx prisma migrate deploy
npm run seed
npm run build
npm run test
npm run dev
```

Accede a `http://localhost:3000`. Las credenciales por defecto están en `.env` (`AUTH_USER` / `AUTH_PASSWORD`). **Cámbialas antes de exponer la aplicación.**

## Variables de entorno

Copia `.env.example` a `.env` y completa:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | SQLite relativa a `prisma/` (`file:./dev.db`). |
| `NOTION_TOKEN` | Token de integración de Notion. |
| `NOTION_CLIENTS_DB_ID` | ID de la base de datos CLIENTES. |
| `NOTION_TASKS_DB_ID` | ID de la base de datos TAREAS. |
| `NOTION_COMMUNICATIONS_DB_ID` | ID de la base de datos COMUNICACIONES. |
| `NOTION_HISTORY_DB_ID` | Fallback legacy para COMUNICACIONES. |
| `AUTH_USER` / `AUTH_PASSWORD` | Credenciales Basic Auth del dashboard. |
| `INTERNAL_API_TOKEN` | Token para `POST /api/process` y otras APIs internas. |
| `INTEGRATIONS` | `erp` (Notion ya no se activa aquí; se configura vía env). |
| `AI_PROVIDER` | `openai` o `anthropic`. |
| `AI_API_KEY` | API key del proveedor de IA. |
| `AI_MODEL` | Modelo, p. ej. `gpt-4o-mini`. |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` / `DROPBOX_REFRESH_TOKEN` | OAuth de Dropbox. |
| `DROPBOX_ACCESS_TOKEN` | Alternativa de corta duración (no recomendado). |
| `DROPBOX_ROOT_FOLDER` | Carpeta raíz en Dropbox (`baemar`). |
| `NEXT_PUBLIC_APP_URL` | URL base de la app. |

**Nota de seguridad:** el repositorio actual tiene `.env` commiteado con valores de ejemplo/legacy. Antes de producción rota todos los tokens y añade `.env` a `.gitignore`.

## Configuración de Notion

Crea 3 bases de datos en una misma página/workspace. Comparte cada una con la integración y copia sus IDs a `.env`.

### CLIENTES

| Propiedad | Tipo | Opciones / notas |
|-----------|------|------------------|
| Nombre | Title | |
| NIF/CIF | Rich text | |
| Estado | Select | `Activo`, `Baja` |
| Áreas | Multi-select | `Fiscal`, `Laboral`, `Contable`, `Jurídico-Mercantil`, `Administración` |
| Emails | Rich text | |
| Teléfonos | Rich text | |
| Responsable | Rich text | |
| Tareas | Relation | → TAREAS (two-way recomendado) |
| Comunicaciones | Relation | → COMUNICACIONES (two-way recomendado) |
| External ID | Rich text | ID local del cliente |

### TAREAS

| Propiedad | Tipo | Opciones |
|-----------|------|----------|
| Nombre | Title | |
| Cliente | Relation | → CLIENTES |
| Área | Select | mismas áreas que CLIENTES |
| Responsable | Rich text | |
| Estado | Select | `Pendiente`, `En curso`, `Esperando cliente`, `Esperando tercero`, `Terminada` |
| Prioridad | Select | `Normal`, `Alta`, `Urgente` |
| Fecha de entrada | Date | |
| Vencimiento | Date | |
| Origen | Select | `Email`, `WhatsApp`, `Teléfono`, `Presencial`, `Interno` |
| Resumen IA | Rich text | |
| Comunicaciones | Relation | → COMUNICACIONES (two-way recomendado) |
| Valoración económica | Number | |
| External ID | Rich text | ID local de la tarea |

### COMUNICACIONES

| Propiedad | Tipo | Opciones |
|-----------|------|----------|
| Asunto | Title | |
| Cliente | Relation | → CLIENTES |
| Fecha | Date | con hora |
| Canal | Select | `Email`, `WhatsApp` |
| Dirección | Select | `Entrante`, `Saliente` |
| Remitente | Rich text | |
| Destinatario | Rich text | |
| Resumen IA | Rich text | |
| Referencia | Rich text | messageId / enlace original |
| Tarea | Relation | → TAREAS |
| Requiere actuación | Checkbox | |
| External ID | Rich text | ID local de la comunicación |

El código actualiza/crea páginas por `External ID`; si una página ya existe localmente (`notionPageId`) se actualiza, nunca se duplica.

## Configuración de Dropbox

1. Crea una app en https://www.dropbox.com/developers/apps.
2. Permisos: `files.content.write`, `files.content.read`, `sharing.write` si usas enlaces (el sistema no genera enlaces públicos por defecto).
3. Genera un refresh token OAuth 2.0 (flujo authorization code). Guarda `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` y `DROPBOX_REFRESH_TOKEN`.
4. Si prefieres usar un access token de 4h, define `DROPBOX_ACCESS_TOKEN` y deja vacíos los de refresh.

## Arquitectura de procesamiento

`POST /api/process` (token interno) ejecuta:

1. Validación y normalización.
2. Dedupe por `messageId` (idempotente).
3. Identificación de cliente por email.
4. Clasificación con IA (relevancia, área, prioridad, posible tarea).
5. Decisión validada: irrelevante / info / nueva acción / tarea existente / revisión humana.
6. Creación de adjuntos y subida a Dropbox (solo comunicaciones relevantes).
7. Sincronización con Notion (3 DBs relacionadas).
8. Registro de errores recuperables.

La IA **nunca** crea directamente tareas ni clientes; todas las decisiones se validan en el backend. No se inventan plazos, importes ni responsables.

## Endpoints principales

- `POST /api/process` — procesar comunicación (token interno).
- `GET /api/items` — comunicaciones.
- `GET /api/items/[id]` — detalle de comunicación.
- `POST /api/items/[id]/assign` — asignar cliente (y tarea opcional).
- `POST /api/items/[id]/link-task` — vincular a tarea existente.
- `POST /api/items/[id]/create-task` — crear tarea desde comunicación.
- `POST /api/items/[id]/retry-sync` — reintentar sync Notion.
- `POST /api/items/[id]/correct` — corrección manual.
- `POST /api/items/[id]/review` — marcar como revisado.
- `POST /api/items/[id]/reprocess` — reprocesar con IA.
- `GET/POST /api/clients` — CRUD clientes.
- `GET/PATCH /api/clients/[id]` — detalle/actualización.
- `GET/POST /api/tasks` — listar/crear tareas.
- `GET/PATCH /api/tasks/[id]` — detalle/actualización.
- `POST /api/attachments/[id]/retry` — reintentar subida Dropbox.

## Recuperación de errores

- Si Notion falla, la comunicación/tarea/cliente locales se conservan. Se registra un `ErrorLog` y se puede reintentar desde `/items/[id]` (Reintentar sync Notion) o desde `/tareas/[id]` (próximamente).
- Si Dropbox falla, el adjunto queda en estado `error` con `attempts`. Se reintenta desde `/items/[id]` o `/tareas/[id]`.
- Si la IA falla, la comunicación se marca como `error` y no se crean tareas.
- Reprocesar un mensaje ya exitoso es idempotente: devuelve el registro existente sin efectos externos.

## Comandos de utilidad

```bash
npm run dev        # desarrollo
npm run build      # producción
npm run lint       # linting
npm run test       # tests (node:test + tsx)
npm run seed       # categorías por defecto
npx prisma migrate dev --name <nombre>  # nueva migración
npx prisma generate  # regenerar cliente
```

## Limitaciones conocidas de la Fase 1

- WhatsApp está diseñado en el modelo (`Contact.channel`) pero no hay ingestión ni UI.
- La integración ERP sigue siendo polling vía `/api/outbox` (pendiente de middleware externo).
- No hay paginación en listados grandes.
- Los adjuntos se almacenan en base64 en SQLite hasta subirse; no está pensado para archivos grandes.
- No se ha verificado la sincronización real con Notion/Dropbox por falta de credenciales activas; el código está cubierto por tests con mocks.

## Decisiones técnicas

- `AiActivity` se renombró a `Communication` en Prisma pero mantiene la tabla `AiActivity` (`@@map`) para no perder datos.
- Las prioridades pasan de `Alta/Media/Baja` a `Normal/Alta/Urgente` según requerimiento del cliente.
- Las áreas canónicas son `Fiscal`, `Laboral`, `Contable`, `Jurídico-Mercantil`, `Administración`.
- `dueDate` y `economicValue` son manuales; la IA no los propone.
- Tests con `node:test` + `tsx` para no añadir dependencias de testing.
