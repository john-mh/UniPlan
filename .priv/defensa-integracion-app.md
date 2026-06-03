# UniPlan — Integración entre Bases de Datos (Criterios 3 y 5 — 30%)

> Explica cómo la aplicación conecta MongoDB y PostgreSQL, manteniendo coherencia sin transacciones distribuidas.

---

## 1. Arquitectura de conexión

**Archivo**: `server/src/app.ts:22-24` (Prisma/PostgreSQL), `server/src/app.ts:82-92` (Mongoose/MongoDB)

```
┌──────────────────────────────────────────┐
│              Express Server               │
│                                           │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Mongoose │  │  Prisma  │  │  Raw   │  │
│  │ (MongoDB)│  │(Postgres)│  │  SQL   │  │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │            │       │
│  ┌────▼────┐    ┌────▼────────────▼───┐  │
│  │ MongoDB │    │   PostgreSQL/Supabase│  │
│  │ (local) │    │   (cloud)           │  │
│  └─────────┘    └─────────────────────┘  │
└──────────────────────────────────────────┘
```

- **Mongoose**: conexión a MongoDB local (`mongodb://localhost:27017/uniplan`). Modelos: Event, Organizer.
- **Prisma + raw SQL**: conexión a Supabase PostgreSQL. Prisma modela solo `uniplan_statistics`. Las tablas institucionales se acceden con `prisma.$queryRawUnsafe()`.

---

## 2. Flujo completo de una inscripción (el camino crítico)

```
POST /api/registrations { eventId }
│
├─ 1. Validación (Strategy Pattern)
│   ├── BaseValidator.checkSpotsAvailable()
│   │   └── Event.findById(eventId) → compara registrations.length con maxAttendees
│   ├── BaseValidator.checkNotAlreadyRegistered()
│   │   └── Event.findOne({ 'registrations.studentId': studentId, status: 'REGISTERED' })
│   └── [Tipo]Validator.additionalChecks()
│       ├── WorkshopValidator → consulta enrollments en PostgreSQL
│       ├── VolunteeringValidator → consulta eventos en MongoDB
│       └── SportsTournamentValidator → consulta eventos en MongoDB
│
├─ 2. Resolución de identidad
│   └── resolveStudentInfo(studentId)
│       └── prisma.$queryRawUnsafe('SELECT ... FROM public.students ...')
│           → retorna { name, campus }
│
├─ 3. Inserción atómica (MongoDB)
│   └── Event.findOneAndUpdate(
│         { _id: eventId, 'registrations.studentId': { $ne: studentId } },
│         { $push: { registrations: { ... } } }
│       )
│
├─ 4. Emisión de evento (EventBus)
│   └── emitRegistrationEvent(REGISTRATION_CREATED, { studentId, eventId })
│
└─ 5. Actualización de estadísticas (Observer, async)
    ├── UPDATE uniplan_statistics SET total_registered = total_registered + 1
    └── UPDATE uniplan_statistics SET demographics = <JSONB calculado desde MongoDB>
```

**Código**: `server/src/controllers/registrationController.ts:7-80`

---

## 3. Validación cross-DB: Strategy Pattern

**Archivos**: `server/src/strategies/`

### 3.1 Estructura

```
IRegistrationValidator (interfaz)
  └── BaseValidator (Template Method)
        ├── checkSpotsAvailable()      → MongoDB
        ├── checkNotAlreadyRegistered() → MongoDB
        └── additionalChecks()          → subclases
              ├── WorkshopValidator       → MongoDB + PostgreSQL
              ├── VolunteeringValidator   → MongoDB
              ├── SportsTournamentValidator → MongoDB
              └── TalkValidator           → (sin checks extra)
```

**Registry**: `server/src/strategies/ValidatorRegistry.ts:7-18`

El controller obtiene el validator por tipo de evento: `ValidatorRegistry.getValidator(eventType)`. Si el tipo no existe, usa `TalkValidator` (sin validaciones extra).

### 3.2 WorkshopValidator — Prerrequisitos (cross-DB)

`server/src/strategies/WorkshopValidator.ts:6-44`

- **MongoDB**: `Event.findById(eventId)` → obtiene `typeDetails.prerequisiteSubjectCode` y `prerequisiteSemester`
- **PostgreSQL**: `prisma.$queryRawUnsafe('SELECT ... FROM public.enrollments JOIN public.groups ...')` → verifica que el estudiante tenga el curso prerequisite
- **PostgreSQL**: `prisma.$queryRawUnsafe('SELECT DISTINCT g.semester ...')` → verifica semestre mínimo

**Aquí se ve la integración**: datos de negocio flexibles (prerrequisitos) en MongoDB, validación académica (enrollments) en PostgreSQL.

### 3.3 VolunteeringValidator — Horas acumuladas

`server/src/strategies/VolunteeringValidator.ts:6-30`

- **MongoDB**: `Event.findById(eventId)` → `typeDetails.hoursRequired`
- **MongoDB**: `Event.find({ eventType: 'VOLUNTEERING', 'registrations.studentId': studentId, status: 'REGISTERED' })` → busca TODOS los eventos de voluntariado del estudiante
- Suma `typeDetails.hoursRequired` de cada evento encontrado

**Antes de la migración**: Este validator consultaba PostgreSQL (`uniplan_registrations`) para los registros y luego MongoDB (`event_details`) para las horas de cada uno. Ahora es todo MongoDB en 2 queries.

### 3.4 SportsTournamentValidator — Solapamiento

`server/src/strategies/SportsTournamentValidator.ts:6-25`

- **MongoDB**: `Event.find()` con filtro compuesto por fecha, rango horario y `$or` de 3 casos de solapamiento

---

## 4. Observer Pattern: Estadísticas sincronizadas

**Archivos**: `server/src/observers/EventBus.ts`, `server/src/observers/StatisticsObserver.ts`

### 4.1 EventBus

`EventBus.ts:1-21` — EventEmitter con 3 topics:
- `REGISTRATION_CREATED`
- `REGISTRATION_CANCELLED`
- `REGISTRATION_STATUS_CHANGED`

El controller emite eventos después de operaciones exitosas:
```typescript
// registrationController.ts:72
emitRegistrationEvent(EventTopic.REGISTRATION_CREATED, {
  studentId, eventId, newStatus: RegistrationStatus.REGISTERED,
});
```

### 4.2 StatisticsObserver

`StatisticsObserver.ts:7-68`

Escucha los 3 topics y actualiza PostgreSQL:

**REGISTRATION_CREATED** (línea 46):
1. `updateStat(eventId, 'total_registered', 1)` — UPDATE atómico en PG
2. `updateDemographics(eventId)` — lee el evento de MongoDB, calcula distribución por facultad/programa/campus, escribe JSONB en PG

**REGISTRATION_CANCELLED** (línea 54):
1. `updateStat(eventId, 'total_registered', -1)`
2. `updateStat(eventId, 'total_cancelled', 1)`
3. `updateDemographics(eventId)`

**Cálculo de demographics** (línea 19-36):
```typescript
for (const reg of event.registrations || []) {
  if (reg.status === 'REGISTERED' || reg.status === 'ATTENDED') {
    if (reg.faculty) byFaculty[reg.faculty] = (byFaculty[reg.faculty] || 0) + 1;
    if (reg.program) byProgram[reg.program] = (byProgram[reg.program] || 0) + 1;
    if (reg.campus) byCampus[reg.campus] = (byCampus[reg.campus] || 0) + 1;
  }
}
```

El Observer se importa como side-effect en `server/src/app.ts:20`:
```typescript
import './observers/StatisticsObserver.js';
```

### 4.3 Garantía de consistencia

- **Escritura principal (MongoDB) es atómica** — el `$push` / `$set` ocurre en una sola operación
- **Estadísticas (PostgreSQL) son eventualmente consistentes** — se actualizan async después de la escritura principal
- **Si PostgreSQL falla**: el error se loguea (`console.error`), la estadística queda desactualizada temporalmente, pero el dato de negocio en MongoDB es correcto
- **No hay transacciones distribuidas**: no son necesarias porque las escrituras de negocio van solo a MongoDB

---

## 5. Separación de responsabilidades en PostgreSQL

### 5.1 Tablas institucionales (read-only)

15 tablas en Supabase, accedidas exclusivamente vía `prisma.$queryRawUnsafe()`:
- `students`, `employees` — identidad
- `enrollments`, `groups`, `subjects`, `programs`, `areas`, `faculties` — validación académica
- `campuses`, `cities`, `departments`, `countries` — ubicación
- `contract_types`, `employee_types` — clasificación laboral

**¿Por qué raw SQL y no Prisma models?** Las tablas institucionales no están en `schema.prisma`. Esto:
1. Evita que Prisma genere migraciones sobre tablas externas
2. Hace explícito en el código que son datos de solo lectura
3. Permite queries SQL complejas (JOINs, subconsultas) que Prisma no soporta bien

### 5.2 users (lectura/escritura limitada)

Única tabla institucional que la app modifica:
- `POST /api/auth/register` → INSERT en users
- `POST /api/admin/organizers/:id/approve` → UPDATE users.role = 'ORGANIZER'

**Código**: `server/src/controllers/authController.ts:23-27`, `server/src/controllers/adminController.ts:63-66`

### 5.3 uniplan_statistics (app-owned)

Creada por la app, mantenida por el Observer:
- `server/prisma/schema.prisma:5-16` — modelo Prisma
- `server/src/observers/StatisticsObserver.ts` — actualización vía Observer

---

## 6. Reportes: aggregation pipelines vs SQL

Los reportes ahora usan MongoDB aggregation pipelines directamente sobre los arrays embebidos:

| Reporte | Fuente | Archivo |
|---|---|---|
| Ocupación por tipo | MongoDB `$group` + `$avg` | `reportController.ts:5-54` |
| Engagement (facultad/programa/campus) | MongoDB iteración sobre `registrations[]` | `reportController.ts:58-106` |
| Participación (top students, por tipo) | MongoDB `$unwind` + `$group` + `$sort` | `reportController.ts:107-165` |
| Estadísticas por evento | PostgreSQL `uniplan_statistics` | `statisticsController.ts:5-27` |

**Ventaja**: Los reportes de engagement y participación se calculan directamente desde los datos embebidos en MongoDB, sin necesidad de JOINs con las tablas institucionales. La demografía (facultad, programa, campus) ya está capturada en cada registro.

---

## 7. Resumen: ¿Por qué esta arquitectura es correcta?

| Principio | Cómo se cumple |
|---|---|
| **Separación de responsabilidades** | MongoDB para datos de aplicación, PostgreSQL para institucionales + estadísticas |
| **Consistencia eventual** | Observer actualiza PG después de escrituras en MongoDB |
| **Atomicidad** | Operaciones `$push`/`$set` en MongoDB son atómicas por documento |
| **Sin transacciones distribuidas** | Las escrituras de negocio solo tocan MongoDB |
| **Rendimiento** | Sin JOINs para queries principales. Una consulta = un documento. |
| **Integridad institucional** | Tablas externas nunca modificadas. Raw SQL explícito. |
