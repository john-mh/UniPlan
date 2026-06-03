# UniPlan — Guión de Defensa por Rúbrica (v2 MongoDB-First)

> Usa este guión para estructurar tu sustentación. Cada sección mapea directamente a un criterio de la rúbrica. Los tiempos sugeridos suman ~15 min.

---

## Criterio 1: Análisis — Justificación BD NoSQL (10%) — 3 min

### Talking Points

1. **El problema de variabilidad**: Los 5 tipos de evento tienen campos radicalmente distintos.
   - Taller → materiales, código de prerrequisito, semestre
   - Charla → nombre del conferencista, afiliación, links
   - Torneo → tipo de deporte, reglas, estructura
   - Voluntariado → causa, horas requeridas, puntos de encuentro
   - Otro → campos no previstos (JSON libre)
   - *Si usáramos solo PostgreSQL: o bien 25+ columnas NULL (anti-patrón EAV), o una tabla genérica key-value (pierde tipos, validación, queries complejas).*

2. **Comparativa MongoDB vs alternativas**:
   | Alternativa | ¿Por qué no? |
   |---|---|
   | Cassandra | Optimizada para time-series, no documentos polimórficos |
   | DynamoDB | Vendor lock-in AWS, pricing impredecible |
   | Redis | In-memory, no es almacén primario |
   | CouchDB | Ecosistema TypeScript/Node.js más limitado |

3. **Lo que MongoDB sí ofrece**: Documentos flexibles, discriminators de Mongoose, arrays embebidos (registrations, messages), aggregation pipeline para reportes, atomic operators ($push, $set).

### Código a mostrar
- 5 discriminators: `server/src/models/mongodb/Event.ts:98-141`
- 5 tipos con campos variables: mismo archivo, líneas 101-141

---

## Criterio 2: Diseño — Modelo de datos (10%) — 3 min

### Talking Points

1. **Arquitectura dual justificada**:
   - **MongoDB**: datos de la aplicación (events, organizers) — polimórficos y documentales
   - **PostgreSQL**: datos institucionales (students, employees, enrollments...) — relacionales, externos, read-only + auth (users) + estadísticas (uniplan_statistics)

2. **Decisiones de modelado**:
   - **Registros embebidos** (`events.registrations[]`): se acceden siempre junto al evento. Evita JOINs costosos. Un solo documento contiene el evento + todos sus registros.
   - **Mensajes embebidos** (`events.messages[]`): mismo razonamiento.
   - **Organizador embebido** (`events.organizer`): subdocumento con `{userId, name, type}`. Referencia por userId a la colección `organizers`.
   - **typeDetails como campo discriminado**: los campos específicos de cada tipo de evento se almacenan en el mismo documento, no en colección separada. Esto elimina la referencia cross-DB (`mongodb_detail_id`) que existía antes.

3. **Índices**:
   - `events`: `{eventType:1}`, `{date:1}`, `{status:1}`, `{registrations.studentId:1}`, `{uniqueCode:1}`
   - `organizers`: `{approvedByAdmin:1}`, `{isActive:1}`, `{type:1}`

### Código a mostrar
- Schema de events con arrays embebidos: `server/src/models/mongodb/Event.ts:72-89`
- Índices: `server/src/models/mongodb/Event.ts:92-96`
- Schema de organizers: `server/src/models/mongodb/Organizer.ts:22-52`
- DBML completo: `.priv/data-model.dbml`

### Diagrama a mostrar
- DBML en dbdiagram.io mostrando los 3 TableGroups (MongoDB, PostgreSQL Auth/Stats, PostgreSQL Institutional)

---

## Criterio 3: BD Relacional — Uso e integración (10%) — 2 min

### Talking Points

1. **Respetamos la BD institucional**: Las 15 tablas institucionales (students, employees, enrollments, groups, subjects, programs, faculties, areas, campuses, cities, departments, countries, contract_types, employee_types, users) son de SOLO LECTURA. Accedidas exclusivamente vía `prisma.$queryRawUnsafe()`. Nunca modificamos su estructura.

2. **Tabla users**: Única tabla institucional que la app escribe (registro de nuevos estudiantes, cambio de rol al aprobar organizador). FKs a students.id y employees.id con CHECK constraint que garantiza rol exclusivo.

3. **Estructura adicional: uniplan_statistics**:
   - Columnas: `event_id VARCHAR(24)`, `total_registered`, `total_cancelled`, `total_attended`, `demographics JSONB`
   - `event_id` referencia al `_id` de MongoDB (ObjectId como string)
   - `demographics` almacena distribución por facultad/programa/campus
   - Actualización vía Observer pattern (nunca desde el controller directamente)

4. **Por qué raw SQL en vez de Prisma models**: Las tablas institucionales no están modeladas en schema.prisma. Esto evita que Prisma intente generar migraciones sobre ellas (son externas). El acceso raw SQL deja explícito en el código que son datos externos de solo lectura.

### Código a mostrar
- Schema de Prisma actual (solo uniplan_statistics): `server/prisma/schema.prisma:1-16`
- Raw SQL en auth: `server/src/controllers/authController.ts:42-45`
- Raw SQL en validación de prerrequisitos: `server/src/strategies/WorkshopValidator.ts:16-23`
- Observer actualizando estadísticas: `server/src/observers/StatisticsObserver.ts:8-12`

---

## Criterio 4: BD NoSQL — Implementación (20%) — 3 min

### Talking Points

1. **Patrón Discriminator de Mongoose**: `discriminatorKey: 'eventType'` en el schema base permite que cada tipo de evento tenga sus propios campos y validaciones, pero todos se almacenen en la misma colección `events`. 5 discriminators registrados.

2. **Estructuras flexibles aprovechadas**:
   - `typeDetails: Schema.Types.Mixed` — los campos varían por tipo sin forzar un esquema rígido
   - `registrations[]` — array de subdocumentos con demografía capturada al momento del registro
   - `messages[]` — array de mensajes con senderName ya resuelto
   - `organizer` — subdocumento embebido (no referencia a otra colección)
   - `profile` en `organizers` — JSONB con campos opcionales según tipo (semester, department, etc.)

3. **Operaciones atómicas**:
   - Registro: `findOneAndUpdate` con `$push` + condición `$ne` para prevenir duplicados
   - Cancelación: `$set` sobre elemento específico del array por `_id`
   - Mensajes: `push` al array con nombre resuelto desde institutional tables
   - Capacidad: se compara `registrations.length` con `maxAttendees` en el mismo documento

4. **Aggregation pipeline para reportes**:
   - `occupancyReport`: `$group` por eventType con `$avg` de ocupación
   - `participationReport`: `$unwind` registrations → `$group` por estudiante → `$sort` → `$limit`
   - `engagementReport`: itera sobre eventos, agrega faculty/program/campus counts

### Código a mostrar
- Registration atómico con `$push` y condición `$ne`: `server/src/controllers/registrationController.ts:47-59`
- Cancelación con `$set`: `server/src/controllers/registrationController.ts:102-110`
- Aggregation pipeline para reportes: `server/src/controllers/reportController.ts:5-54`

---

## Criterio 5: App — Integración entre BDs (20%) — 2 min

### Talking Points

1. **Consistencia sin transacciones distribuidas**: Las escrituras de negocio van SOLO a MongoDB. Las estadísticas en PostgreSQL se actualizan vía Observer (EventBus + StatisticsObserver). Flujo:

   ```
   POST /api/registrations
     → Event.findOneAndUpdate($push atómico en MongoDB)
     → emitRegistrationEvent(REGISTRATION_CREATED)
     → StatisticsObserver escucha
     → UPDATE uniplan_statistics SET total_registered++
     → Lee evento de MongoDB, calcula demographics JSONB
     → UPDATE uniplan_statistics SET demographics = ...
   ```

2. **Validación cross-DB (Strategy Pattern)**:
   - `WorkshopValidator`: prerequisiteSubjectCode y prerequisiteSemester desde MongoDB `typeDetails` → verifica contra enrollments en PostgreSQL
   - `VolunteeringValidator`: hoursRequired desde MongoDB `typeDetails` → suma horas de otros eventos en MongoDB `registrations[]`
   - `SportsTournamentValidator`: solapamiento de horario → consulta MongoDB `events` con filtro por fecha + rango horario

3. **Resolución de identidad**: Al registrar, se consulta `students` (PostgreSQL) para obtener nombre, campus. La facultad/programa se deja como "Unknown" porque `students` no tiene `program_code` — se obtendría vía cadena de enrollment (enrollments→groups→subjects→programs→areas→faculties), lo cual es costoso y no determinista.

### Código a mostrar
- EventBus: `server/src/observers/EventBus.ts:1-21`
- StatisticsObserver (demographics): `server/src/observers/StatisticsObserver.ts:19-36`
- Strategy Registry: `server/src/strategies/ValidatorRegistry.ts:7-18`
- Validación de prerrequisitos: `server/src/strategies/WorkshopValidator.ts:16-35`
- Validación de horas de voluntariado: `server/src/strategies/VolunteeringValidator.ts:11-30`

---

## Criterio 6: Sustentación (30%) — Preguntas frecuentes

Aquí tienes que estar preparado para defender decisiones. Las preguntas más probables y sus respuestas están en `defensa-preguntas.md` y `defensa-preguntas-codigo.md`. Las más críticas:

| Pregunta | Dónde responder |
|---|---|
| ¿Por qué MongoDB y no otra NoSQL? | `defensa-db-justificacion.md` |
| ¿Cómo garantizan consistencia sin transacciones? | `defensa-integracion-app.md` |
| ¿Qué pasa si MongoDB se cae? | `defensa-preguntas.md` P6 |
| Muéstrame el código donde haces el registro atómico | `registrationController.ts:47-59` |
| ¿Por qué los registros están embebidos y no en colección separada? | `defensa-modelo-datos.md` |
| ¿Cómo manejas los 5 tipos de evento con campos diferentes? | Event.ts discriminators, líneas 98-141 |
| ¿Las estadísticas se actualizan en tiempo real? | `StatisticsObserver.ts:7-12` |

---

## Orden sugerido para la defensa

1. **Arquitectura general** (1 min) — mostrar el diagrama DBML
2. **Justificación MongoDB** (2 min) — comparativa, variabilidad
3. **Modelo de datos MongoDB** (3 min) — discriminator, embebidos, índices
4. **Modelo relacional** (2 min) — qué quedó en PostgreSQL y por qué
5. **Integración** (2 min) — Observer, Strategy, flujo de registro
6. **Demostración en vivo** (3 min) — ejecutar `defense-acid.spec.ts` con --headed
7. **Preguntas** (2-5 min) — responder con código abierto

**Total: ~15-18 minutos**
