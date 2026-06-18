# Chess Homework Checker — API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <accessToken>`

All responses follow:
```json
{ "success": true, "message": "...", "data": {}, "meta": {} }
```
Errors follow:
```json
{ "success": false, "message": "...", "errors": [] }
```

---

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register first admin (or student via admin) |
| POST | `/auth/login` | None | Login, returns accessToken + refreshToken |
| POST | `/auth/logout` | ✅ Any | Invalidates refresh token |
| POST | `/auth/refresh` | None | Rotate tokens using refreshToken |
| GET  | `/auth/me` | ✅ Any | Get own profile |

### POST /auth/login
```json
{ "email": "admin@chess.com", "password": "Admin123!" }
```
Response `data`:
```json
{
  "user": { "id", "username", "email", "role", "firstName", "lastName" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

## Students (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/students` | List all students (pagination + search) |
| POST | `/students` | Create a student account |
| GET | `/students/:id` | Get student + progress report |
| PUT | `/students/:id` | Update student profile |
| DELETE | `/students/:id` | Deactivate student (soft delete) |

### GET /students query params
- `page`, `limit` — pagination
- `search` — fuzzy search on username/email/name
- `status` — `active` | `inactive`

---

## Homework

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/homework` | Admin | Create homework (multipart/form-data for PGN file) |
| GET | `/homework` | Any | Admin: all. Student: assigned only |
| GET | `/homework/:id` | Any | Single homework |
| PUT | `/homework/:id` | Admin | Update homework |
| DELETE | `/homework/:id` | Admin | Delete homework |
| POST | `/homework/assign` | Admin | Assign to one or many students |

### POST /homework body
```json
{
  "title": "Sicilian Tactics",
  "description": "...",
  "category": "tactics",
  "difficulty": "intermediate",
  "dueDate": "2026-12-31T23:59:59Z",
  "fenPosition": "rnbqkb1r/... w KQkq - 0 1",
  "pgnReference": "1. e4 c5 2. Nf3...",
  "instructions": "Find the best move.",
  "maxScore": 100
}
```

### POST /homework/assign body
```json
{ "homeworkId": "<id>", "studentIds": ["<id1>", "<id2>"] }
```

**Category values:** `tactics` | `endgame` | `opening` | `middlegame` | `calculation`  
**Difficulty values:** `beginner` | `intermediate` | `advanced`

---

## Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/submissions` | Student | Submit solution (multipart/form-data for PGN file) |
| GET | `/submissions` | Any | Admin: all. Student: own only |
| GET | `/submissions/:id` | Any | Single submission with correction |

### POST /submissions body
```json
{
  "homeworkId": "<id>",
  "submittedSolution": "My analysis: e4 is the best move because...",
  "pgnText": "1. e4 e5 2. Nf3 Nc6...",
  "moveSequence": ["e4", "e5", "Nf3", "Nc6"]
}
```

---

## Corrections

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/corrections` | Admin | Create correction for a submission |
| GET | `/corrections/:id` | Any | Get correction with full submission context |
| PUT | `/corrections/:id` | Admin | Update an existing correction |

### POST /corrections body
```json
{
  "submissionId": "<id>",
  "score": 85,
  "feedback": "Good tactical vision. The knight sacrifice on move 12 was excellent.",
  "annotatedPgn": "1. e4 e5 {Good} 2. Nf3 {Best} ...",
  "moveAnnotations": [
    { "move": "Nf3", "comment": "Best development move", "quality": "excellent" },
    { "move": "Nc6", "comment": "Allows a strong reply", "quality": "inaccuracy" }
  ]
}
```

**Grade** is auto-computed: A (≥90), B (≥80), C (≥70), D (≥60), F (<60)

---

## Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard` | Any | Admin: full analytics. Student: own stats |
| GET | `/dashboard/students/:id` | Admin | Individual student analytics |

### Admin dashboard response
```json
{
  "overview": {
    "totalStudents": 25,
    "activeStudents": 23,
    "totalHomework": 50,
    "totalSubmissions": 120,
    "pendingCorrections": 8,
    "averageClassScore": 76,
    "overdueHomework": 3
  },
  "leaderboard": [
    { "student": {...}, "averageScore": 94, "completedHomework": 12, "completionRate": 92 }
  ],
  "monthlyTrend": [
    { "month": "2026-05", "count": 45 },
    { "month": "2026-06", "count": 30 }
  ]
}
```

---

## Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Server + DB connection status |

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Validation failed |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Duplicate resource |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |
