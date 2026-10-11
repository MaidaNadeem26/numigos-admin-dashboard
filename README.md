# NUMIGOS OSA Admin Dashboard

This project is the OSA admin dashboard for the same Supabase data model used by the mobile app.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in your Supabase project URL and anon key.
3. Install dependencies:

```bash
npm install
```

4. Run the app:

```bash
npm run dev
```

5. Open http://localhost:3000.

## Notes

- Only `osa_admin` profiles are allowed to sign in.
- Signed-out users are redirected to the sign-in page.
- Overview metrics, charts, and review queues are read from Supabase using the signed-in OSA admin session.
- Society review states are resolved from `admin_status_rules.from_statuses` and `societies.status`.
