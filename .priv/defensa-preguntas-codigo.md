# UniPlan — Preguntas con Referencias de Código

> Cada pregunta incluye la ruta exacta del archivo y número de línea para que puedas abrir el código durante la defensa y mostrarlo.

---

## Autenticación y Seguridad (Preguntas frecuentes del profesor de BD)

### Q1. ¿Cómo funciona el login?

**Respuesta**: `server/src/controllers/authController.ts:36-76`

1. Busca usuario por username en PostgreSQL: `SELECT * FROM users WHERE username = $1` (línea 42-45)
2. Compara contraseña con bcrypt: `bcrypt.compare(password, user.password_hash)` (línea 52)
3. Si coincide, genera accessToken (1h) + refreshToken (7d) con JWT
4. El JWT contiene `{ userId, role, username }` como payload

**Mostrar**: `server/src/utils/jwt.ts:8-30` — `generateTokens()` con `jwt.sign()`

### Q2. ¿Por qué la tabla users está en PostgreSQL y no en MongoDB?

**Respuesta**: Tres razones de base de datos:

1. **Integridad referencial con FKs**: `users.student_id REFERENCES students(id)` y `users.employee_id REFERENCES employees(id)`. MongoDB no tiene FKs nativos — la integridad sería responsabilidad del código (frágil).
2. **CHECK constraint para roles**: `CHECK ( (role = 'STUDENT' AND student_id IS NOT NULL AND employee_id IS NULL) OR (role IN ('ORGANIZER','ADMIN') AND student_id IS NULL AND employee_id IS NOT NULL) )` — garantiza a nivel de BD que un usuario solo puede tener el rol que corresponde a su tipo de persona.
3. **UNIQUE INDEX en username**: Previene emails duplicados a nivel de base de datos, no en código.

**Mostrar**: `server/prisma/migrations/.../migration.sql` — la migración con FKs y CHECK constraint.

### Q3. ¿Cómo funciona la autorización por roles?

**Respuesta**: `server/src/middleware/auth.ts`

- `requireAuth` (línea 10-30): Extrae el token del header `Authorization: Bearer <token>`, lo verifica con `jwt.verify()`, y agrega `req.user = { userId, role, username }`.
- `requireRole(...roles)` (línea 40-50): Middleware factory que verifica que `req.user.role` esté en la lista de roles permitidos.

```typescript
// Uso en rutas:
statisticsRoutes.get('/dashboard', requireRole('ADMIN', 'ORGANIZER'), getDashboard);
reportRoutes.use(requireAuth, requireRole('ADMIN')); // todo /reports/* = solo ADMIN
```

### Q4. ¿Cómo funciona el refresh token?

**Respuesta**: Dos partes:

**Servidor**: `server/src/controllers/authController.ts:17-22` — endpoint `POST /api/auth/refresh`:
```typescript
const payload = jwt.verify(refreshToken, REFRESH_SECRET);
const user = await query('SELECT * FROM users WHERE id = $1', [payload.userId]);
// genera nuevo par de tokens
```

**Cliente**: `client/src/services/api.ts:31-72` — interceptor de Axios:
```typescript
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Si hay otro refresh en progreso, encola este request
      if (isRefreshing) return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
      // Intenta refrescar
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      // Reintenta el request original con el nuevo token
      return api(originalRequest);
    }
  }
);
```

### Q5. ¿Cómo hasheas las contraseñas?

**Respuesta**: `server/src/controllers/authController.ts:28`

```typescript
const passwordHash = await bcrypt.hash(password, 10);
```

- **bcrypt**: Algoritmo diseñado específicamente para passwords. Lento por diseño — cada hash toma ~100ms con 10 rondas de salt.
- **10 rondas**: Cada ronda duplica el tiempo. 2^10 = 1024 iteraciones del algoritmo Blowfish.
- **¿Por qué no SHA-256?**: SHA-256 es rápido (millones de hashes por segundo). Vulnerable a rainbow tables y fuerza bruta con GPU.

### Q6. Muéstrame dónde haces la validación del estudiante al registrarse

**Respuesta**: `server/src/controllers/authController.ts:5-33`

1. **Valida contra BD institucional** (línea 12-14):
   ```sql
   SELECT s.first_name, s.last_name FROM public.students s WHERE s.id = $1
   ```
   Si el estudiante no existe en la tabla `students` de PostgreSQL, se rechaza el registro. Esto garantiza que solo estudiantes reales de la universidad pueden crear cuenta.

2. **Verifica email duplicado** (línea 19-21):
   ```sql
   INSERT INTO users (username, password_hash, role, student_id)
   VALUES ($1, $2, 'STUDENT', $3)
   ```
   Si el username ya existe, PostgreSQL lanza error por UNIQUE constraint → 409 Conflict.

### Q7. ¿Cómo cambia un estudiante a organizador?

**Respuesta**: `server/src/controllers/adminController.ts:56-66` y `organizerController.ts`

1. **Aplicación**: `POST /api/organizers/apply` → crea documento en MongoDB `organizers` con `approvedByAdmin: false`.
2. **Aprobación**: `POST /api/admin/organizers/:id/approve` → ADMIN aprueba:
   - MongoDB: `Organizer.findByIdAndUpdate(id, { approvedByAdmin: true })` (línea 59)
   - PostgreSQL: `UPDATE users SET role = 'ORGANIZER', employee_id = $1 WHERE id = $2` (línea 63-66)
   - La BD garantiza que el CHECK constraint no se viole (employee_id debe ser NOT NULL para ORGANIZER)

### Q8. ¿Cómo evitas que un request sin token acceda a rutas protegidas?

**Respuesta**: `server/src/middleware/auth.ts:10-30`

```typescript
const token = req.headers.authorization?.split(' ')[1];
if (!token) {
  res.status(401).json({ message: 'No token provided', code: 'UNAUTHORIZED' });
  return;
}
try {
  const payload = jwt.verify(token, ACCESS_SECRET);
  req.user = { userId: payload.userId, role: payload.role, username: payload.username };
  next();
} catch {
  res.status(401).json({ message: 'Invalid or expired token', code: 'UNAUTHORIZED' });
}
```

### Q9. ¿Dónde configuras rate limiting y seguridad HTTP?

**Respuesta**: `server/src/app.ts:39-58`

```typescript
app.use(helmet());                          // headers de seguridad HTTP
app.use(cors({ origin: FRONTEND_URL }));    // solo el frontend puede hacer requests

// 100 req/15min en auth
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// 50 req/15min en endpoints de escritura
app.use('/api/events', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, skip: (req) => req.method === 'GET' }));
```

---

## MongoDB — Modelo de Datos

### Q1. Muéstrame dónde defines el modelo de eventos en MongoDB

**Respuesta**: `server/src/models/mongodb/Event.ts`

- Schema base con discriminator key: línea 70-89 — define todos los campos comunes (title, date, location, etc.), arrays de registrations y messages, y organizer como subdocumento
- Índices: líneas 92-96 — 5 índices (eventType, date, status, registrations.studentId, uniqueCode)
- Discriminators por tipo: líneas 98-141 — 5 tipos (Workshop, Talk, Sports, Volunteering, Other) cada uno con su propio schema de campos específicos
- El campo `typeDetails: Schema.Types.Mixed` (línea 86) permite almacenar campos variables sin forzar esquema rígido

### Q2. ¿Cómo implementas los 5 tipos de evento con campos diferentes?

**Respuesta**: Patrón Discriminator de Mongoose en `server/src/models/mongodb/Event.ts`

- Línea 70: `discriminatorKey: 'eventType'` — Mongoose usa el valor de eventType para saber qué schema aplicar
- Línea 98: `export const Event = mongoose.model<IEvent>('Event', baseSchema)` — modelo base
- Línea 106: `Event.discriminator(EventType.WORKSHOP, workshopTypeSchema)` — registra el tipo Workshop con campos: materials, prerequisiteSubjectCode, prerequisiteSemester
- Línea 116: Talk — speakerName, speakerProfile, speakerAffiliation, relatedLinks, extendedDescription
- Línea 125: Sports — sportType (required), rules, playersPerTeam, tournamentStructure
- Línea 135: Volunteering — cause, hoursRequired (required), activities, meetingPoints, responsiblePersons
- Línea 141: Other — additionalInfo (Mixed, JSON libre)

**Mostrar en pantalla**: Abre Event.ts y haz scroll de la línea 70 a la 141.

---

### Q3. ¿Por qué los registros están embebidos en el documento del evento y no en una colección separada?

**Respuesta**: `server/src/models/mongodb/Event.ts:82` — `registrations: [registrationSchema]`

**Razones**:
1. **Patrón de acceso**: Los registros SIEMPRE se consultan junto al evento. Nunca necesitas "todos los registros sin sus eventos".
2. **Atomicidad**: Al estar en el mismo documento, `$push` y `$set` son operaciones atómicas sin necesidad de transacciones multi-documento.
3. **Rendimiento**: Una sola consulta (`Event.findById`) devuelve el evento + todos sus registros. Sin JOINs.
4. **Demografía**: Cada registro captura `studentName`, `faculty`, `program`, `campus` en el momento de inscripción. Estos datos no cambian si el estudiante cambia de programa después.

El registration schema está en líneas 42-50 del mismo archivo.

### Q4. ¿Los mensajes también están embebidos?

**Respuesta**: Sí. `server/src/models/mongodb/Event.ts:83` — `messages: [messageSchema]`

Schema de mensaje en líneas 52-57. Cada mensaje tiene `senderName` ya resuelto al momento de enviarse (para evitar consultar PostgreSQL cada vez que se leen los mensajes).

La inserción de mensajes está en `server/src/routes/events.ts:55-80` — el handler resuelve el nombre del remitente desde `students` o `employees` (PostgreSQL) y lo guarda en `senderName`.

---

## MongoDB — Operaciones

### Q5. Muéstrame el código del registro atómico

**Respuesta**: `server/src/controllers/registrationController.ts:47-70`

```typescript
const updateResult = await Event.findOneAndUpdate(
  {
    _id: eventId,
    'registrations.studentId': { $ne: studentId },  // ← previene duplicados
  },
  {
    $push: {
      registrations: { studentId, studentName, faculty, program, campus, ... }
    }
  },
  { new: false }
);

if (!updateResult) {
  // Si no modificó nada → ya está registrado o el evento no existe
  const alreadyReg = await Event.findOne({
    _id: eventId,
    'registrations.studentId': studentId,
    'registrations.status': RegistrationStatus.REGISTERED,
  });
  if (alreadyReg) {
    res.status(409).json({ message: 'Already registered' });
    return;
  }
}
```

**Explicar**: La condición `$ne` en el filter asegura que `$push` solo se ejecute si el studentId NO existe ya en el array. Esto es equivalente atómico a un `@@unique([studentId, eventId])` en SQL.

### Q6. ¿Cómo cancelas un registro?

**Respuesta**: `server/src/controllers/registrationController.ts:85-122`

1. Busca el evento que contiene el registro por `registrations._id` (línea 88)
2. Verifica pertenencia: `reg.studentId !== req.user!.userId` (línea 102)
3. Actualización atómica con `$set` (líneas 108-115):
   ```
   Event.updateOne(
     { _id: event._id, 'registrations._id': reg._id },
     { $set: {
       'registrations.$.status': RegistrationStatus.CANCELLED,
       'registrations.$.cancellationDate': new Date()
     }}
   )
   ```
   El operador `$` referencia el elemento del array que coincidió con el filtro.

### Q7. ¿Cómo manejas la capacidad máxima (maxAttendees)?

**Respuesta**: En dos niveles:

1. **BaseValidator** (`server/src/strategies/BaseValidator.ts:20-29`): Cuenta los registros con status `REGISTERED` en el array del documento y compara con `maxAttendees`.

2. **Controlador** (`server/src/controllers/registrationController.ts:47-59`): El `findOneAndUpdate` con `$ne` actúa como segunda barrera — si entre la validación y la inserción otro estudiante tomó el último cupo, el `$push` no se ejecuta.

### Q8. ¿Cómo generas los códigos únicos de evento (EVT-061)?

**Respuesta**: `server/src/controllers/eventController.ts:11-16`

Función `generateUniqueCode()`: busca el evento con el `uniqueCode` más alto (orden descendente), extrae el número con regex `/EVT-(\d+)/`, incrementa +1, formatea con padStart(3). Esto evita colisiones incluso si se borran eventos.

---

## PostgreSQL — Institucional y Estadísticas

### Q9. ¿Qué tablas creaste en PostgreSQL?

**Respuesta**: Solo `uniplan_statistics`. Schema en `server/prisma/schema.prisma:1-16`

Columnas:
- `id SERIAL PK`
- `event_id VARCHAR(24) UNIQUE` — almacena el `_id` de MongoDB (ObjectId de 24 caracteres)
- `total_registered`, `total_cancelled`, `total_attended` — INTEGER
- `demographics JSONB` — distribución por facultad/programa/campus

El modelo Prisma tiene `eventId String @unique @db.VarChar(24)` (línea 7) y `demographics Json?` (línea 11).

### Q10. ¿Cómo consultas las tablas institucionales sin Prisma models?

**Respuesta**: Usando `prisma.$queryRawUnsafe()` en todo el código:

- Validación de estudiante al registrar: `server/src/controllers/authController.ts:12-14`
- Login: `server/src/controllers/authController.ts:43-45`
- Resolución de nombre en mensajes: `server/src/routes/events.ts:58-70`
- Validación de prerrequisitos: `server/src/strategies/WorkshopValidator.ts:16-23`
- Resolución de demografía del estudiante: `server/src/controllers/registrationController.ts:237-248`

Las tablas institucionales NO están en schema.prisma. Esto evita que Prisma genere migraciones sobre ellas y deja explícito en el código que son datos externos.

### Q11. ¿Por qué las estadísticas están en PostgreSQL y no en MongoDB?

**Respuesta**: Tres razones:

1. **UPDATEs atómicos SQL**: `SET total_registered = total_registered + 1` es una operación atómica nativa. En MongoDB requeriría transacciones.
2. **Datos agregacionales**: Las estadísticas son conteos y promedios — operaciones SQL naturales.
3. **Separación de responsabilidades**: Los datos operacionales viven en MongoDB; las métricas precomputadas en PostgreSQL. Esto permite consultar reportes sin afectar el rendimiento transaccional.

El código: `server/src/observers/StatisticsObserver.ts:8-12`

### Q12. ¿Cómo actualizas las estadísticas?

**Respuesta**: Patrón Observer. `server/src/observers/StatisticsObserver.ts`

- Línea 46: `eventBus.on(EventTopic.REGISTRATION_CREATED, ...)` — escucha eventos
- Línea 8-12: `updateStat()` — UPDATE atómico en PostgreSQL
- Línea 19-36: `updateDemographics()` — lee el evento de MongoDB, recorre `registrations[]`, cuenta por facultad/programa/campus, escribe JSONB en PostgreSQL

El EventBus está en `server/src/observers/EventBus.ts:1-21`.

---

## Integración Cross-DB

### Q13. ¿Cómo funciona la validación de prerrequisitos de un taller?

**Respuesta**: `server/src/strategies/WorkshopValidator.ts:6-44`

1. Lee el evento de MongoDB (línea 8): `Event.findById(eventId)` → obtiene `typeDetails.prerequisiteSubjectCode` y `typeDetails.prerequisiteSemester`
2. Si hay `prerequisiteSubjectCode`, consulta PostgreSQL (líneas 16-23):
   ```sql
   SELECT g.subject_code FROM public.enrollments e
   JOIN public.groups g ON e.nrc = g.nrc
   WHERE e.student_id = $1 AND g.subject_code = $2 AND e.status IN ('Active', 'Passed')
   ```
3. Si hay `prerequisiteSemester`, consulta el semestre del estudiante (líneas 27-35):
   ```sql
   SELECT DISTINCT g.semester FROM public.enrollments e
   JOIN public.groups g ON e.nrc = g.nrc
   WHERE e.student_id = $1 AND e.status = 'Active'
   ORDER BY g.semester DESC LIMIT 1
   ```

**Aquí se ve la integración**: los datos del prerrequisito vienen de MongoDB (flexible), la validación académica de PostgreSQL (relacional).

### Q14. ¿Cómo funciona la validación de horas de voluntariado?

**Respuesta**: `server/src/strategies/VolunteeringValidator.ts:6-30`

1. Lee el evento actual de MongoDB (línea 8): `Event.findById(eventId)` → `typeDetails.hoursRequired`
2. Busca TODOS los eventos de voluntariado donde el estudiante está registrado (líneas 12-16):
   ```
   Event.find({
     eventType: EventType.VOLUNTEERING,
     'registrations.studentId': studentId,
     'registrations.status': RegistrationStatus.REGISTERED,
   })
   ```
3. Suma las horas (líneas 19-23): itera sobre eventos encontrados, acumula `typeDetails.hoursRequired`

**Antes de la migración**: Esto requería consultar PostgreSQL para los registros + MongoDB para las horas de cada evento. Ahora es todo MongoDB.

### Q15. ¿Cómo funciona la validación de solapamiento en torneos?

**Respuesta**: `server/src/strategies/SportsTournamentValidator.ts:6-25`

Consulta MongoDB con filtro compuesto:
```
Event.find({
  eventType: EventType.SPORTS_TOURNAMENT,
  _id: { $ne: eventId },
  date: event.date,
  'registrations.studentId': studentId,
  'registrations.status': RegistrationStatus.REGISTERED,
  $or: [
    { startTime <= event.startTime, endTime > event.startTime },
    { startTime < event.endTime, endTime >= event.endTime },
    { startTime >= event.startTime, endTime <= event.endTime },
  ],
})
```

Los tres casos del `$or` cubren: solapamiento parcial izquierdo, parcial derecho, y contenido total.

---

## Estrategia y Diseño

### Q16. ¿Cómo funciona el Strategy Pattern para las validaciones?

**Respuesta**: `server/src/strategies/ValidatorRegistry.ts:7-18`

```typescript
export class ValidatorRegistry {
  private static registry: Record<string, IRegistrationValidator> = {
    WORKSHOP: new WorkshopValidator(),
    TALK: new TalkValidator(),
    SPORTS_TOURNAMENT: new SportsTournamentValidator(),
    VOLUNTEERING: new VolunteeringValidator(),
    OTHER: new TalkValidator(),  // sin validaciones extra
  };

  static getValidator(eventType: string): IRegistrationValidator {
    return this.registry[eventType] || new TalkValidator();
  }
}
```

El BaseValidator (`server/src/strategies/BaseValidator.ts:5-14`) implementa Template Method:
1. `checkSpotsAvailable()` — capacidad
2. `checkNotAlreadyRegistered()` — no duplicado
3. `additionalChecks()` — cada subclase implementa sus reglas

La interfaz: `server/src/strategies/IRegistrationValidator.ts:1-7`

### Q17. ¿Cómo se integra el Observer con el EventBus?

**Respuesta**: Tres archivos:

1. `server/src/observers/EventBus.ts:1-21` — EventEmitter con topics: REGISTRATION_CREATED, REGISTRATION_CANCELLED, REGISTRATION_STATUS_CHANGED
2. `server/src/controllers/registrationController.ts:72-76` — el controller emite el evento después de la operación exitosa
3. `server/src/observers/StatisticsObserver.ts:46-68` — el observer escucha y actualiza PostgreSQL

El observer se importa en `server/src/app.ts:20` como side-effect import (`import './observers/StatisticsObserver.js'`), lo que registra los listeners al iniciar el servidor.

---

## Reportes

### Q18. ¿Cómo generas los reportes de ocupación?

**Respuesta**: `server/src/controllers/reportController.ts:5-54`

Aggregation pipeline de MongoDB:
```javascript
Event.aggregate([
  { $group: {
    _id: '$eventType',
    totalEvents: { $sum: 1 },
    avgOccupancy: { $avg: {
      $multiply: [{ $divide: [
        { $size: { $filter: { input: '$registrations',
          cond: { $eq: ['$$this.status', 'REGISTERED'] } } } },
        '$maxAttendees'
      ] }, 100]
    } }
  } },
  { $project: { eventType: '$_id', totalEvents: 1, avgOccupancy: { $round: ['$avgOccupancy', 1] } } }
])
```

Esto calcula, por tipo de evento, el porcentaje promedio de ocupación — directamente desde los arrays embebidos, sin JOINs.

### Q19. ¿Cómo generas los reportes de engagement?

**Respuesta**: `server/src/controllers/reportController.ts:58-106`

Itera sobre eventos con registros activos, acumula conteos por:
- `faculty` → `registrations[].faculty`
- `program` → `registrations[].program`
- `campus` → `registrations[].campus`

Los datos demográficos ya están capturados en cada registro (se resolvieron al momento de la inscripción).

### Q20. ¿El CSV de inscritos de dónde sale?

**Respuesta**: `server/src/controllers/registrationController.ts:204-231`

Lee el evento de MongoDB → itera `event.registrations[]` → genera CSV con columnas: Name, Student Code, Faculty, Program, Campus, Date, Status. Los datos vienen del array embebido, sin consultar PostgreSQL.

---

## Consistencia y ACID

### Q21. ¿Cómo garantizas que no haya inscripciones duplicadas?

**Respuesta**: Dos capas:

1. **BaseValidator.checkNotAlreadyRegistered()**: `server/src/strategies/BaseValidator.ts:31-40` — consulta preventiva
2. **findOneAndUpdate con $ne**: `server/src/controllers/registrationController.ts:47-59` — barrera atómica final

La combinación de ambas garantiza que incluso con requests concurrentes, no se crean duplicados.

### Q22. ¿Qué pasa si PostgreSQL falla durante una inscripción?

**Respuesta**: El registro ya existe en MongoDB (el `$push` fue exitoso). El StatisticsObserver intentará actualizar PostgreSQL y fallará (el error se loguea con `console.error` en línea 50 del observer). La estadística estará temporalmente desactualizada, pero el dato de negocio (el registro) es correcto. En la siguiente inscripción exitosa, las estadísticas se recalcularán incluyendo el registro anterior.

### Q23. El test ACID de defensa, ¿dónde está y qué demuestra?

**Respuesta**: `server/tests/defense-acid.spec.ts`

Demuestra:
- **A**tomicidad (línea 50): Creación de evento en MongoDB + inicialización de stats en PostgreSQL
- **C**onsistencia (línea 79): Registro duplicado → 400, capacidad llena → 400, mensajes cross-DB
- **I**solación (línea 98): Stats independientes por evento, race condition en último cupo
- **D**urabilidad (línea 119): Lecturas repetidas devuelven mismos datos
- **R**oles (línea 127): Estudiante bloqueado de crear eventos (403) y admin (403)
- **U**I (línea 142): Frontend login, dashboard, catálogo público

Ejecutar con: `npx playwright test tests/defense-acid.spec.ts --headed`
