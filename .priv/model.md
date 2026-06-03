# UniPlan Data Model

## Database Architecture: Dual-Database Strategy

UniPlan uses **PostgreSQL** for structured, relational data and **MongoDB** for polymorphic, schema-flexible event details. This hybrid approach maximizes the strengths of each database paradigm.

---

## Why MongoDB for Event Details?

### 1. Polymorphic Event Types
UniPlan supports 5 event types (Workshop, Talk, Sports Tournament, Volunteering, Other), each with wildly different attributes:

| Event Type | Unique Fields |
|------------|--------------|
| Workshop | `materials[]`, `prerequisiteSubjectCode`, `prerequisiteSemester` |
| Talk | `speakerName`, `speakerProfile`, `speakerAffiliation`, `relatedLinks[]`, `extendedDescription` |
| Sports Tournament | `sportType`, `rules`, `playersPerTeam`, `tournamentStructure` |
| Volunteering | `cause`, `hoursRequired`, `activities[]`, `meetingPoints[]`, `responsiblePersons[]` |
| Other | `additionalInfo` (free-form JSON) |

In a relational database, this would require either:
- **Wide table with many NULL columns** (wasteful, hard to query, breaks normalization)
- **Join table per event type** (10+ extra tables, complex queries)
- **EAV pattern** (performance killer for reads)

MongoDB's **discriminator pattern** (via Mongoose) gives us a single `event_details` collection where each document self-describes its type and carries exactly the fields it needs. Mongoose handles validation per discriminator automatically.

### 2. Embedded Messages
Each event detail document contains an embedded `messages` array:

```json
{
  "eventId": 42,
  "eventType": "WORKSHOP",
  "materials": ["Laptop", "Python 3.10+"],
  "messages": [
    { "text": "Room changed to B-201", "sentBy": "12345", "sentAt": "2026-05-20T..." }
  ]
}
```

This is a textbook MongoDB use case:
- Messages are **always accessed with their parent event** (no independent queries)
- Messages grow over time but remain bounded (dozens, not millions)
- Atomic push operations (`$push`) are efficient and safe
- No joins needed to display messages on the event detail page

A relational approach would require a separate `event_messages` table with a FK to `events` and JOIN queries — needless complexity for data that's naturally nested.

### 3. Flexible `additionalInfo` for "Other" Events
The `Other` event type uses MongoDB's `Mixed` schema type, allowing organizers to attach arbitrary key-value metadata without schema migrations. This is essential for a university platform where new event categories may emerge.

---

## Why PostgreSQL for Everything Else?

### Structured, Transactional Data
The following belong in PostgreSQL because they benefit from ACID guarantees, relational integrity, and structured querying:

| Table | Rationale |
|-------|-----------|
| `uniplan_events` | Core event metadata (FK to organizer, date range queries, type filtering) |
| `uniplan_organizers` | Organizer profiles with FK to institutional `students`/`employees` |
| `uniplan_registrations` | Many-to-many junction with unique constraints, status tracking |
| `uniplan_statistics` | Aggregated counters with atomic increment/decrement |

### Institutional Data Access
The university's existing PostgreSQL database contains:
- `students`, `employees` — identity verification
- `enrollments`, `groups`, `subjects` — prerequisite validation (WorkshopValidator)
- `programs`, `faculties` — engagement report aggregation

UniPlan **reads** from these tables but **never modifies** them — respecting the institutional schema boundaries.

### Why Not MongoDB for Registrations?
- Registrations require **unique constraints** (one student per event)
- Registration queries are **relational** (list all registrations for an event with student names)
- Count operations benefit from **SQL aggregation** (COUNT, GROUP BY)
- Status transitions (REGISTERED → CANCELLED) need **atomic updates**

---

## Observer Pattern for Statistics

Instead of tightly coupling statistics updates to registration/cancellation logic, UniPlan uses an **event-driven Observer pattern**:

```
RegistrationController → EventBus (Node.js EventEmitter)
                              ↓
                      StatisticsObserver
                      (listens for registration:created,
                       registration:cancelled events)
```

Benefits:
- **Decoupling**: registration logic doesn't know about statistics
- **Extensibility**: new observers (notifications, audit logs) can be added without touching existing code
- **Testability**: each observer can be tested in isolation

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│                    UniPlan Application                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ PostgreSQL│    │  PostgreSQL   │    │   MongoDB    │  │
│  │(App Data)│    │(Institutional)│    │(Event Detail)│  │
│  ├──────────┤    ├──────────────┤    ├──────────────┤  │
│  │ events   │◄───│ students     │    │ event_details│  │
│  │organizers│    │ employees    │    │  ├ Workshop  │  │
│  │registrat.│    │ enrollments  │───►│  ├ Talk      │  │
│  │statistics│    │ groups       │    │  ├ Sports    │  │
│  └──────────┘    │ subjects     │    │  ├ Volunteer │  │
│                  └──────────────┘    │  └ Other     │  │
│                                      └──────────────┘  │
│  Validators use institutional data to check             │
│  prerequisites before allowing registration.            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Strategy Pattern for Registration Validation

Each event type has a dedicated validator implementing `IRegistrationValidator`:

| Validator | Checks Performed |
|-----------|-----------------|
| `BaseValidator` | Spots available, not already registered |
| `WorkshopValidator` | Extends Base — prerequisite subject completed (via `enrollments` table), minimum semester |
| `TalkValidator` | Extends Base — no additional checks |
| `SportsTournamentValidator` | Extends Base — time overlap detection with other tournaments |
| `VolunteeringValidator` | Extends Base — hours prerequisite (sums past volunteering registrations from MongoDB) |
| `ValidatorRegistry.get(type)` | Returns the correct validator for an event type |

The `VolunteeringValidator` demonstrates the cross-database integration: it queries PostgreSQL for past registrations, then looks up each event's `hoursRequired` from MongoDB to validate the student has enough accumulated volunteering hours.

---

## Alternative NoSQL Databases Considered

| Database | Why Rejected |
|----------|-------------|
| **Cassandra** | Wide-column store optimized for time-series. Not suitable for document-oriented event details with variable schemas. |
| **DynamoDB** | Vendor lock-in to AWS. Our deployment is self-hosted. |
| **Redis** | In-memory only. Not suitable as primary data store for persistent event details. |
| **CouchDB** | Similar document model to MongoDB but smaller ecosystem and fewer driver options for TypeScript. |
