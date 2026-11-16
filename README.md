# EventPass Backend

Express + MongoDB API for events, registrations, QR tickets, and check-in.

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

Configure `MONGO_URI` and `JWT_SECRET` in `.env`.

**API:** http://localhost:5000/api

**Tests:** `npm test`

## Demo Credentials

| Role      | Email                     | Password     |
| --------- | ------------------------- | ------------ |
| Organizer | `organizer@eventpass.dev` | `Demo12345!` |
| Attendee  | `attendee@eventpass.dev`  | `Demo12345!` |
