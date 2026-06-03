# UniPlan — Justificación de MongoDB como BD NoSQL (Criterio 1 — 10%)

> Responde la pregunta: ¿Por qué MongoDB y no Cassandra, DynamoDB, Redis o CouchDB?

---

## 1. El problema de variabilidad

UniPlan gestiona 5 tipos de evento con atributos radicalmente distintos:

| Tipo de Evento | Atributos Específicos |
|---|---|
| **Workshop** | materials[], prerequisiteSubjectCode, prerequisiteSemester |
| **Talk** | speakerName, speakerProfile, speakerAffiliation, relatedLinks[], extendedDescription |
| **Sports Tournament** | sportType, rules, playersPerTeam, tournamentStructure |
| **Volunteering** | cause, hoursRequired, activities[], meetingPoints[], responsiblePersons[] |
| **Other** | additionalInfo (JSON libre, campos no previstos) |

Si usáramos solo PostgreSQL tendríamos dos opciones, ambas malas:
- **Tabla única con columnas NULL**: 25+ columnas donde la mayoría son NULL para cada fila. Violación de principios de normalización, desperdicio de espacio, queries complejas.
- **Modelo Entity-Attribute-Value (EAV)**: Tabla genérica `(event_id, attribute_name, attribute_value)`. Pierde tipos de datos, no permite validación por tipo, queries ineficientes.

MongoDB resuelve esto naturalmente con **documentos flexibles** y el **patrón Discriminator de Mongoose**: cada tipo tiene su propio schema, pero todos viven en la misma colección.

**Código**: `server/src/models/mongodb/Event.ts:98-141` — 5 discriminators registrados.

---

## 2. Comparativa MongoDB vs Alternativas

| Alternativa | Tipo | ¿Por qué NO aplica a UniPlan? |
|---|---|---|
| **Cassandra** | Wide-column (column-family) | Optimizada para time-series y datos append-only con esquema fijo. Los 5 tipos de evento tienen esquemas radicalmente diferentes. No tiene documentos embebidos nativos ni operadores atómicos como `$push`/`$set` sobre arrays. |
| **DynamoDB** | Key-value + Document (AWS) | Vendor lock-in con AWS. Pricing impredecible (RCU/WCU) para el patrón de acceso de UniPlan: ráfagas durante período de inscripciones. No tiene aggregation pipeline equivalente. |
| **Redis** | In-memory key-value | No es base de datos primaria para datos que deben persistir en disco. Sin esquemas flexibles, sin consultas por campos anidados. Excelente como caché, pero no como almacén principal de eventos y registros. |
| **CouchDB** | Document | Similar a MongoDB en filosofía, pero con ecosistema TypeScript/Node.js más reducido. Mongoose ofrece discriminators, type inference, middleware, population, y aggregation pipeline que CouchDB no iguala. Curva de aprendizaje más alta. |
| **MongoDB** ✓ | Document | Documentos JSON flexibles. Discriminators para polimorfismo. Arrays embebidos (registrations, messages). Aggregation pipeline para reportes. Operadores atómicos ($push, $set, $ne). Ecosistema Mongoose maduro para TypeScript. |

**Conclusión**: MongoDB es la única base de datos NoSQL que ofrece simultáneamente: flexibilidad de esquema (para los 5 tipos), operaciones atómicas sobre documentos (para registros concurrentes), aggregation pipeline (para reportes), y un ecosistema TypeScript maduro (Mongoose).

---

## 3. ¿Por qué MongoDB + PostgreSQL y no solo MongoDB?

| Dato | Dónde está | Por qué esa BD |
|---|---|---|
| **Eventos, registros, mensajes** | MongoDB | Datos polimórficos y documentales. Se acceden juntos (un evento con sus registros). Atomicidad por documento. |
| **Organizadores** | MongoDB | Colección independiente, referenciada por userId desde events.organizer. |
| **Usuarios (auth)** | PostgreSQL | Autenticación con bcrypt requiere SQL. JWT necesita role lookup rápido. FKs a students/employees mantienen integridad institucional. |
| **Estadísticas** | PostgreSQL | UPDATEs atómicos (`SET x = x + 1`) son nativos en SQL. Datos agregacionales. Separación de responsabilidades: métricas no compiten con queries transaccionales. |
| **Tablas institucionales** | PostgreSQL (Supabase) | Ya existen, son mantenidas por la universidad. La app solo las consulta (read-only). Migrarlas sería redundante y violaría el requisito del enunciado. |

**Código**: La separación es visible en la arquitectura:
- MongoDB models: `server/src/models/mongodb/Event.ts`, `Organizer.ts`
- PostgreSQL model: `server/prisma/schema.prisma` (solo `uniplan_statistics`)
- Acceso institucional: raw SQL en `authController.ts`, `WorkshopValidator.ts`, etc.

---

## 4. Patrones de modelado que aprovechan MongoDB

| Patrón | Implementación | Ventaja |
|---|---|---|
| **Embedded documents** | `events.registrations[]`, `events.messages[]`, `events.organizer` | Una consulta devuelve todo el evento con sus datos relacionados. Sin JOINs. |
| **Discriminator** | 5 tipos de evento con `discriminatorKey: 'eventType'` | Campos específicos por tipo validados por Mongoose, pero todos en la misma colección. Queries por tipo usan índices. |
| **Atomic array operations** | `$push` con condición `$ne`, `$set` con `$` positional | Previenen race conditions en inscripciones sin necesidad de transacciones. |
| **Aggregation pipeline** | `$group`, `$unwind`, `$filter`, `$avg` para reportes | Cálculos complejos sobre arrays embebidos sin mover datos al servidor de aplicación. |
| **Mixed types** | `typeDetails: Schema.Types.Mixed` para OTHER events | Permite campos no previstos en el tipo "Otros eventos" sin modificar el esquema. |

---

## 5. Resumen ejecutivo (30 segundos)

> "Escogimos MongoDB como base de datos NoSQL para la aplicación porque maneja naturalmente la variabilidad de los 5 tipos de evento mediante el patrón Discriminator. Los registros y mensajes están embebidos en el documento del evento, lo que elimina JOINs costosos. Usamos operadores atómicos de MongoDB ($push, $set) para garantizar consistencia en inscripciones concurrentes. PostgreSQL se mantiene exclusivamente para autenticación de usuarios, estadísticas agregadas, y consulta de las tablas institucionales que son externas al sistema. Esta arquitectura dual nos permite usar cada base de datos para lo que es naturalmente superior."
