# UniPlan — Autenticación y Seguridad (Preguntas de Defensa)

> Cómo manejamos login, registro, tokens JWT, roles, y por qué PostgreSQL para auth.

---

## 1. Visión general del flujo de autenticación

```
POST /api/auth/register          POST /api/auth/login
  │                                  │
  ├─ Valida student_code contra      ├─ Busca usuario en PostgreSQL
  │  students (PostgreSQL)           │  (users.username)
  ├─ Verifica email único            ├─ bcrypt.compare(password, hash)
  ├─ bcrypt.hash(password, 10)       ├─ Genera accessToken (1h) + refreshToken (7d)
  ├─ INSERT en users (PostgreSQL)    ├─ Middleware: requireAuth → verify JWT
  └─ Retorna 201                     └─ Middleware: requireRole → check user.role
```

---

## 2. Por qué PostgreSQL para la tabla `users`

| Razón | Detalle |
|---|---|
| **Integridad referencial** | `users.student_id` → `students.id` y `users.employee_id` → `employees.id` con FK constraint. MongoDB no tiene FKs nativos. |
| **CHECK constraint para roles** | `CHECK ( (role = 'STUDENT' AND student_id IS NOT NULL AND employee_id IS NULL) OR (role IN ('ORGANIZER','ADMIN') AND student_id IS NULL AND employee_id IS NOT NULL) )` — garantiza que un usuario solo puede tener un rol y la FK correcta. |
| **Índice único** | `UNIQUE INDEX ON users(username)` — garantiza que no haya emails duplicados a nivel de BD. |
| **Atomicidad en registro** | La combinación INSERT + validación ocurre en una sola transacción SQL. Si falla la validación, el INSERT se revierte. |
| **bcrypt en la app, integridad en la BD** | El hash se calcula en Node.js con `bcrypt.hash()`, pero las FKs y CHECK constraints garantizan que la BD nunca tenga datos inconsistentes. |

**Código**: `server/src/controllers/authController.ts:42-45` — login query, `server/prisma/migrations/` — constraints.

---

## 3. JWT: Access Token + Refresh Token

### 3.1 ¿Por qué dos tokens?

| Token | Duración | Almacenamiento | Propósito |
|---|---|---|---|
| **accessToken** | 1 hora | localStorage (cliente) | Autoriza cada request. Corta vida útil → si se roba, expira rápido. |
| **refreshToken** | 7 días | localStorage (cliente) | Renueva el accessToken sin pedir password. Larga vida → conveniencia. |

### 3.2 Flujo de refresh

```
Cliente: GET /api/admin/organizers (con accessToken expirado)
  → 401 Unauthorized
  → interceptor de Axios: POST /api/auth/refresh { refreshToken }
  → servidor verifica JWT del refreshToken
  → genera nuevo accessToken + refreshToken
  → cliente reintenta la petición original con el nuevo accessToken
```

**Código**: `client/src/services/api.ts:31-72` — interceptor de Axios con cola de requests pendientes mientras se renueva el token.

### 3.3 ¿Qué contiene el JWT?

```json
{
  "userId": "A00374201",
  "role": "STUDENT",
  "username": "ts@u.edu.co",
  "iat": 1685880000,
  "exp": 1685883600
}
```

**Código**: `server/src/utils/jwt.ts:8-20` — generación del token con `jsonwebtoken.sign()`.

---

## 4. Roles y Control de Acceso

### 4.1 Tres roles con permisos crecientes

| Rol | Permisos | Cómo se obtiene |
|---|---|---|
| **STUDENT** | Explorar eventos, inscribirse, cancelar su registro | Registro automático al crear cuenta |
| **ORGANIZER** | Todo lo de STUDENT + crear/editar/eliminar eventos propios, ver estadísticas | Aplicación → aprobación por ADMIN |
| **ADMIN** | Todo + aprobar organizadores, ver reportes, exportar datos | Definido en seed o manualmente en BD |

### 4.2 Middleware de autorización

**Archivo**: `server/src/middleware/auth.ts`

- `requireAuth` (línea 10): Verifica que el JWT sea válido. Agrega `req.user = { userId, role }`.
- `requireRole(...roles)` (línea 40): Verifica que `req.user.role` esté en la lista de roles permitidos.

```typescript
// Ejemplo de uso en rutas:
statisticsRoutes.get('/dashboard', requireRole('ADMIN', 'ORGANIZER'), getDashboard);
reportRoutes.use(requireAuth, requireRole('ADMIN')); // todo /reports/* requiere ADMIN
```

### 4.3 Cómo se convierte un STUDENT en ORGANIZER

1. **Aplicación** (`POST /api/organizers/apply`): Crea documento en MongoDB `organizers` con `approvedByAdmin: false`.
2. **Aprobación** (`POST /api/admin/organizers/:id/approve`): ADMIN aprueba → actualiza MongoDB (`approvedByAdmin: true`) Y PostgreSQL (`UPDATE users SET role = 'ORGANIZER'`).
3. **El cambio es cross-DB**: Un organizador existe en MongoDB (perfil, eventos creados) y en PostgreSQL (rol para autenticación).

---

## 5. Seguridad adicional

### 5.1 Rate limiting

**Código**: `server/src/app.ts:43-58`

- `/api/auth/*` → 100 requests cada 15 minutos
- `/api/events`, `/api/registrations`, `/api/organizers` → 50 requests cada 15 minutos (solo POST/PUT/DELETE, GETs ilimitados)

### 5.2 Helmet y CORS

**Código**: `server/src/app.ts:39-40`

- `helmet()` — headers de seguridad HTTP (X-Frame-Options, X-XSS-Protection, etc.)
- `cors({ origin: 'http://localhost:5173', credentials: true })` — solo el frontend puede hacer requests con cookies/tokens

### 5.3 Contraseñas

- **bcrypt con 10 rondas de salt**: `bcrypt.hash(password, 10)` — ~100ms de cómputo, suficiente para prevenir fuerza bruta.
- **Nunca se loguean contraseñas**: `console.error` solo muestra mensajes genéricos.
- **Nunca se devuelven hashes al cliente**: El endpoint de login solo retorna tokens, nunca el hash.

---

## 6. Preguntas probables en la defensa

| Pregunta | Dónde mostrar |
|---|---|
| ¿Cómo haces el login? | `authController.ts:36-76` — bcrypt.compare + JWT sign |
| ¿Cómo verificas que un token es válido? | `middleware/auth.ts:10-30` — jwt.verify + req.user |
| ¿Por qué PostgreSQL para users y no MongoDB? | Ver sección 2 arriba — FKs, CHECK constraints, índices únicos |
| ¿Cómo evitas que un estudiante acceda a rutas de admin? | `middleware/auth.ts:40-50` — requireRole() |
| ¿Qué pasa si el token expira? | `client/src/services/api.ts:31-72` — interceptor con refresh |
| ¿Cómo manejas el registro de nuevos estudiantes? | `authController.ts:5-33` — valida contra students, INSERT atómico |
| ¿Por qué bcrypt y no SHA-256? | bcrypt es lento por diseño (10 rounds de salt). SHA-256 es rápido y vulnerable a rainbow tables. |
| ¿Dónde están las FKs entre users y students/employees? | En la migración SQL de Prisma: `FOREIGN KEY (student_id) REFERENCES students(id)` |

---

## 7. Código clave a mostrar

| Archivo | Líneas | Qué muestra |
|---|---|---|
| `server/src/middleware/auth.ts` | 10-50 | requireAuth y requireRole |
| `server/src/controllers/authController.ts` | 5-33 | Registro con validación PostgreSQL |
| `server/src/controllers/authController.ts` | 36-76 | Login con bcrypt + JWT |
| `server/src/utils/jwt.ts` | 1-40 | Generación y verificación de tokens |
| `client/src/services/api.ts` | 31-72 | Interceptor con refresh token rotation |
| `server/src/app.ts` | 39-58 | Helmet, CORS, rate limiting |
| `server/prisma/migrations/` | migration.sql | CHECK constraint y FKs en users |
