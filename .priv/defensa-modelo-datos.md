# UniPlan — Modelo de Datos: Decisiones de Diseño (Criterios 2 y 4 — 30%)

> Explica el diseño del modelo de datos: qué se embebe, qué se referencia, por qué, y cómo se implementó.

---

## 1. Visión general del modelo

```
┌───────────── MongoDB ─────────────┐     ┌────── PostgreSQL ──────┐
│                                    │     │                        │
│  events                            │     │  users (auth)          │
│   ├── registrations[] (embebido)   │◄────│  uniplan_statistics    │
│   ├── messages[]      (embebido)   │     │                        │
│   ├── organizer{}     (embebido)   │     │  Tablas institucionales│
│   └── typeDetails     (Mixto)      │     │  (solo lectura)        │
│                                    │     │                        │
│  organizers                        │     └────────────────────────┘
└────────────────────────────────────┘

Referencias cross-DB (lógicas, no enforced):
  organizers.userId       → users.student_id / users.employee_id
  uniplan_statistics.event_id → events._id
```

Modelo completo en DBML: `.priv/data-model.dbml` — pegar en dbdiagram.io para visualizar.

---

## 2. ¿Qué está embebido vs referenciado?

### Embebido en events

| Subdocumento | Schema | Justificación |
|---|---|---|
| `registrations[]` | `{studentId, studentName, faculty, program, campus, registrationDate, status, cancellationDate}` | Acceso 1:1 con el evento. Nunca se consultan "todos los registros sin sus eventos". Atomicidad: $push y $set sobre el mismo documento. |
| `messages[]` | `{text, sentAt, sentBy, senderName}` | Similar a registrations. El senderName se resuelve al insertar (desde PostgreSQL) para evitar consultas posteriores. |
| `organizer{}` | `{userId, name, type}` | Subdocumento pequeño (3 campos). Suficiente para mostrar el nombre del organizador en el catálogo sin JOIN. |
| `typeDetails` | Varía por tipo (Mixed) | Campos específicos del tipo de evento. Se acceden junto con el evento siempre. |

### Referenciado (colección separada)

| Colección | Schema | Justificación |
|---|---|---|
| `organizers` | `{userId, name, email, type, profile, approvedByAdmin, isActive}` | Entidad independiente con su propio ciclo de vida (aplicación → aprobación → activación). Se consulta por separado (admin panel de aprobaciones). |

---

## 3. El patrón Discriminator en detalle

**Archivo**: `server/src/models/mongodb/Event.ts:70-141`

El campo `discriminatorKey: 'eventType'` (línea 70) le dice a Mongoose que use el valor de `eventType` para determinar qué schema aplicar. Esto permite:

1. **Validación por tipo**: Solo los campos definidos en el schema del discriminador se guardan. Mongoose rechaza campos no declarados.
2. **TypeScript type narrowing**: TypeScript infiere el tipo correcto cuando se consulta por `eventType`.
3. **Índice implícito**: Mongoose indexa automáticamente el campo discriminador.

Cada discriminador declara SOLO los campos específicos de ese tipo:

| Discriminador | Campos | Línea |
|---|---|---|
| WorkshopEvent | materials, prerequisiteSubjectCode, prerequisiteSemester | 101-106 |
| TalkEvent | speakerName, speakerProfile, speakerAffiliation, relatedLinks, extendedDescription | 109-116 |
| SportsTournamentEvent | sportType (required), rules, playersPerTeam, tournamentStructure | 119-125 |
| VolunteeringEvent | cause, hoursRequired (required), activities, meetingPoints, responsiblePersons | 128-135 |
| OtherEvent | additionalInfo (Schema.Types.Mixed, JSON libre) | 138-141 |

---

## 4. Estrategia de índices

### events (MongoDB) — `Event.ts:92-96`

| Índice | Propósito | Query típica |
|---|---|---|
| `{eventType: 1}` | Filtrar catálogo por tipo | `Event.find({ eventType: 'WORKSHOP' })` |
| `{date: 1}` | Filtrar por rango de fechas, ordenar | `Event.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 })` |
| `{status: 1}` | Filtrar UPCOMING/FINISHED | `Event.find({ date: { $gt: today } })` — status se computa, pero el índice ayuda cuando se almacena explícitamente |
| `{'registrations.studentId': 1}` | "Mis inscripciones" | `Event.find({ 'registrations.studentId': studentId })` |
| `{uniqueCode: 1}` (unique) | Búsqueda por código | `Event.findOne({ uniqueCode: 'EVT-061' })` |

### organizers (MongoDB) — `Organizer.ts:48-50`

| Índice | Propósito |
|---|---|
| `{approvedByAdmin: 1}` | Panel de admin: filtrar pendientes |
| `{isActive: 1}` | Solo organizadores activos |
| `{type: 1}` | Agrupar por tipo de organizador |

---

## 5. Decisiones de modelado clave

### 5.1 ¿Por qué los registros capturan demografía?

Cada registro almacena `faculty`, `program`, `campus` en el momento de la inscripción. Esto es una **decisión consciente de denormalización**:

- **Ventaja**: Reportes de engagement se calculan directamente desde los datos embebidos, sin JOINs a las tablas institucionales.
- **Desventaja**: Si un estudiante cambia de programa, los registros antiguos reflejan su programa anterior. Esto es aceptable porque los reportes deben reflejar la realidad histórica ("¿de qué programa eran los estudiantes QUE SE INSCRIBIERON?").

La demografía se resuelve en `server/src/controllers/registrationController.ts:237-261` consultando `students` y `campuses` en PostgreSQL.

### 5.2 ¿Por qué senderName en messages?

Cada mensaje almacena `senderName` resuelto al momento de enviarse. Alternativa: guardar solo `senderId` y resolver el nombre al leer. La opción elegida evita consultas a PostgreSQL cada vez que se leen mensajes (operación frecuente).

Resolución en `server/src/routes/events.ts:55-70` — consulta `students` o `employees` en PostgreSQL.

### 5.3 ¿Por qué uniqueCode secuencial en vez de ObjectId?

Los códigos como `EVT-061` son legibles para humanos (aparecen en el catálogo, emails, CSV). Si usáramos `_id` directamente (`507f1f77bcf86cd799439011`), sería imposible de comunicar verbalmente.

La generación está en `server/src/controllers/eventController.ts:11-16`:
```typescript
async function generateUniqueCode(): Promise<string> {
  const lastEvent = await Event.findOne().sort({ uniqueCode: -1 }).select('uniqueCode').lean();
  let nextNum = 1;
  if (lastEvent?.uniqueCode) {
    const match = lastEvent.uniqueCode.match(/EVT-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `EVT-${String(nextNum).padStart(3, '0')}`;
}
```

Busca el código más alto, extrae el número, incrementa +1. No usa `countDocuments()` porque eventos borrados dejarían huecos y causarían colisiones.

---

## 6. La migración: de dual-write a MongoDB-first

**Script**: `server/scripts/migrate-to-mongo.ts` (ejecutado)

**Arquitectura anterior** (problemas):
- `uniplan_events` en PostgreSQL + `event_details` en MongoDB → doble escritura
- `mongodb_detail_id` como string frágil vinculando ambas DBs
- JOINs costosos: `listEvents` requería 4 tablas

**Arquitectura actual** (soluciones):
- Un solo documento en MongoDB contiene todo: metadatos + typeDetails + registrations + messages + organizer
- Sin referencias cross-DB para datos de aplicación
- Consultas sin JOINs: `Event.find()` con filtros de Mongoose

**Verificación**: 7 eventos migrados, conteos verificados, tablas PostgreSQL droppeadas (`uniplan_events`, `uniplan_registrations`, `uniplan_organizers`).
