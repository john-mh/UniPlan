# UniPlan — Guión de Defensa por Rúbrica (v2 MongoDB-First)

> Usa este guión para estructurar tu sustentación. Cada sección mapea directamente a un criterio de la rúbrica. Los tiempos sugeridos suman ~15 min.

---

## Criterio 1: Análisis — Justificación BD NoSQL (10%) — 2 min

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

4. **El papel de PostgreSQL en la arquitectura**: No es una competencia — cada BD resuelve lo que hace mejor. PostgreSQL maneja autenticación (users con FK constraints, CHECK constraints, índices únicos), estadísticas precomputadas (UPDATEs atómicos SET x = x + 1), y las 15 tablas institucionales externas (solo lectura). Esta separación es una decisión de arquitectura de base de datos, no una limitación técnica.

### Código a mostrar
- 5 discriminators: `server/src/models/mongodb/Event.ts:98-141`
- CHECK constraint en users: `server/prisma/migrations/.../migration.sql`
- Dual connection en app.ts: `server/src/app.ts:22-37`

---

## Criterio 2: Diseño — Modelo de datos (10%) — 2 min

### Talking Points

1. **Arquitectura dual justificada**:
   - **MongoDB**: datos de la aplicación (events, organizers) — polimórficos y documentales. Un documento = un evento con todos sus registros, mensajes, y tipo específico.
   - **PostgreSQL**: datos institucionales (students, employees, enrollments...) — relacionales, externos, read-only + auth (users con FKs) + estadísticas (uniplan_statistics con UPDATEs atómicos).

2. **Decisiones de modelado**:
   - **Registros embebidos** (`events.registrations[]`): se acceden siempre junto al evento. Evita JOINs costosos. Un solo documento contiene el evento + todos sus registros. La demografía (faculty, program, campus) se captura al momento de registro.
   - **Mensajes embebidos** (`events.messages[]`): mismo razonamiento. senderName resuelto al insertar.
   - **Organizador embebido** (`events.organizer`): subdocumento con `{userId, name, type}`. Referencia por userId a la colección `organizers`.
   - **users en PostgreSQL con FKs y CHECK**: `users.student_id REFERENCES students(id)`, `users.employee_id REFERENCES employees(id)`, CHECK constraint que garantiza rol exclusivo (STUDENT ↔ student_id, ORGANIZER/ADMIN ↔ employee_id).

3. **Índices**:
   - `events`: `{eventType:1}`, `{date:1}`, `{status:1}`, `{registrations.studentId:1}`, `{uniqueCode:1}`
   - `organizers`: `{approvedByAdmin:1}`, `{isActive:1}`, `{type:1}`
   - `users` (PostgreSQL): UNIQUE INDEX on username, FKs a students/employees

### Código a mostrar
- Schema de events con arrays embebidos: `server/src/models/mongodb/Event.ts:72-89`
- Índices: `server/src/models/mongodb/Event.ts:92-96`
- CHECK constraint en users: migration.sql
- DBML completo: `.priv/data-model.dbml`

---

## Criterio 3: BD Relacional — Uso e integración (10%) — 2 min

### Talking Points

1. **La tabla users — el puente entre autenticación y datos institucionales**:
   - `users.student_id FK → students.id` y `users.employee_id FK → employees.id`
   - CHECK constraint: `(role = 'STUDENT' AND student_id IS NOT NULL) OR (role IN ('ORGANIZER','ADMIN') AND employee_id IS NOT NULL)`
   - Esto garantiza a nivel de base de datos que un estudiante no puede tener rol de organizador sin pasar por la aprobación admin.

2. **Respetamos la BD institucional**: Las 15 tablas institucionales son de SOLO LECTURA. Accedidas vía `prisma.$queryRawUnsafe()`. Nunca modificamos su estructura.

3. **Estructura adicional: uniplan_statistics**:
   - Columnas: `event_id VARCHAR(24)`, `total_registered`, `total_cancelled`, `total_attended`, `demographics JSONB`
   - `event_id` referencia al `_id` de MongoDB (ObjectId como string de 24 chars)
   - `demographics` almacena distribución por facultad/programa/campus
   - Actualización vía Observer pattern (nunca desde el controller)

4. **Por qué raw SQL en vez de Prisma models**: Las tablas institucionales no están modeladas en schema.prisma. Esto evita que Prisma intente generar migraciones sobre ellas (son externas). El acceso raw SQL deja explícito que son datos externos.

### Código a mostrar
- Schema de Prisma actual: `server/prisma/schema.prisma:1-16`
- Login query: `server/src/controllers/authController.ts:42-45`
- Validación de prerrequisitos: `server/src/strategies/WorkshopValidator.ts:16-23`
- Observer: `server/src/observers/StatisticsObserver.ts:8-12`

---

## Criterio 4: BD NoSQL — Implementación (20%) — 2 min

### Talking Points

1. **Patrón Discriminator de Mongoose**: `discriminatorKey: 'eventType'` permite que cada tipo tenga sus propios campos y validaciones, pero todos se almacenen en la misma colección `events`.

2. **Estructuras flexibles**: typeDetails como Mixed, registrations[] como array de subdocumentos con demografía, messages[] con senderName resuelto.

3. **Operaciones atómicas**:
   - Registro: `findOneAndUpdate` con `$push` + condición `$ne` previene duplicados
   - Cancelación: `$set` sobre elemento del array por `_id`
   - Ambos son atómicos por documento — equivalente a una transacción SQL sobre una sola tabla

4. **Aggregation pipeline para reportes**: $group, $unwind, $filter, $avg, $sort, $limit sobre arrays embebidos sin mover datos al servidor.

### Código a mostrar
- Registration atómico: `server/src/controllers/registrationController.ts:47-59`
- Aggregation pipeline: `server/src/controllers/reportController.ts:7-177`

---

## Criterio 5: App — Integración entre BDs (20%) — 2 min

### Talking Points

1. **Flujo de registro cross-DB**:
   ```
   POST /api/auth/register
     → prisma.$queryRawUnsafe('SELECT FROM students WHERE id = $1')  ← PostgreSQL
     → bcrypt.hash(password, 10)                                      ← Node.js
     → INSERT INTO users (...) VALUES (...)                           ← PostgreSQL
   POST /api/registrations
     → Event.findOneAndUpdate($push atómico)                          ← MongoDB
     → emitRegistrationEvent(REGISTRATION_CREATED)                    ← EventBus
     → StatisticsObserver → UPDATE uniplan_statistics                 ← PostgreSQL
   ```

2. **Observer Pattern**: Escrituras de negocio van SOLO a MongoDB. Estadísticas en PostgreSQL se actualizan async vía Observer — consistencia eventual sin transacciones distribuidas.

3. **Strategy Pattern cross-DB**: WorkshopValidator consulta MongoDB (prerrequisitos) + PostgreSQL (enrollments). VolunteeringValidator y SportsTournamentValidator solo MongoDB.

### Código a mostrar
- EventBus: `server/src/observers/EventBus.ts:1-21`
- StatisticsObserver: `server/src/observers/StatisticsObserver.ts:19-36`
- WorkshopValidator cross-DB: `server/src/strategies/WorkshopValidator.ts:16-23`

---

## Criterio 6: Autenticación y Seguridad (Pregunta frecuente del profesor) — 2 min

> La profesora de base de datos SIEMPRE pregunta sobre autenticación. Tener esta sección lista.

### Talking Points

1. **JWT con dos tokens**: accessToken (1h) para autorizar requests, refreshToken (7d) para renovar sin pedir password. El interceptor de Axios en el frontend maneja la rotación automática.

2. **Por qué PostgreSQL para users y no MongoDB**: FKs a students/employees con CHECK constraint que garantiza integridad a nivel de BD. Si un estudiante intenta registrarse como organizador, la BD lo rechaza. MongoDB no tiene FKs nativos — necesitaríamos validación en código, que es frágil.

3. **bcrypt con 10 rondas**: Algoritmo diseñado para ser lento (~100ms), resistente a fuerza bruta. SHA-256 es rápido y vulnerable a rainbow tables.

4. **Middleware de roles**: `requireRole('ADMIN', 'ORGANIZER')` verifica el claim `role` del JWT. Tres roles con permisos incrementales (STUDENT < ORGANIZER < ADMIN).

5. **Rate limiting + Helmet + CORS**: 100 req/15min en auth, 50 req/15min en endpoints de escritura. Headers de seguridad. CORS restringido al frontend.

### Código a mostrar
- Login con bcrypt + JWT: `server/src/controllers/authController.ts:36-76`
- Middleware requireAuth + requireRole: `server/src/middleware/auth.ts:10-50`
- Interceptor con refresh: `client/src/services/api.ts:31-72`
- CHECK constraint en users: migration SQL

**Documento completo de autenticación**: `.priv/defensa-auth.md`

---

## Criterio 7: Sustentación (30%) — Preguntas frecuentes

| Pregunta | Dónde responder |
|---|---|
| ¿Por qué MongoDB y no otra NoSQL? | `defensa-db-justificacion.md` |
| ¿Cómo funciona la autenticación? | `.priv/defensa-auth.md` |
| ¿Cómo garantizan consistencia sin transacciones? | `defensa-integracion-app.md` |
| ¿Qué pasa si MongoDB se cae? | `defensa-preguntas.md` P6 |
| Muéstrame el código donde haces el registro atómico | `registrationController.ts:47-59` |
| ¿Por qué los registros están embebidos? | `defensa-modelo-datos.md` Sección 2 |
| ¿Cómo manejas los 5 tipos de evento? | Event.ts discriminators, líneas 98-141 |
| ¿Las estadísticas se actualizan en tiempo real? | `StatisticsObserver.ts:7-12` |
| ¿Por qué users en PostgreSQL y no en MongoDB? | `.priv/defensa-auth.md` Sección 2 |
| ¿Cómo funciona el refresh token? | `api.ts:31-72` (cliente) + `auth.ts:18-22` (servidor) |

---

## Orden sugerido para la defensa (15-18 min)

1. **Arquitectura general** (1 min) — diagrama DBML, dos BDs, por qué
2. **Justificación MongoDB + PostgreSQL** (2 min) — comparativa NoSQL, variabilidad, división de responsabilidades
3. **Modelo de datos** (2 min) — discriminator, embebidos, índices, FKs, CHECK
4. **Autenticación** (2 min) — JWT, roles, bcrypt, por qué PostgreSQL para users
5. **Integración cross-DB** (2 min) — Observer, Strategy, flujo de registro
6. **Demostración en vivo** (3 min) — ejecutar `defense-acid.spec.ts` con --headed
7. **Preguntas** (3-5 min) — responder con código abierto
