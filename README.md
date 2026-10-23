# Chandradip frontend

React, TypeScript, and Vite frontend for the Student Management System API.
The UI adapts to the signed-in role and includes student registration, login,
password reset, role-aware dashboards, course browsing, student records,
enrollments, attendance, assessment marks, sports achievements, and results.
Administrators can review the sports dashboard and manage achievements;
students can view their own sports records. The Notice Board is available to
admins and students, with admin-only notice management and the latest notices
on both dashboards. The sports achievement form uses searchable dropdowns
restricted to the supported sports and medal / recognition types.
Admins can assign Monday–Saturday lecture schedules to existing courses;
students automatically see schedules for courses they are enrolled in, with
today's classes highlighted on the dashboard.
Admins can set or update an optional fee for each course; the course list shows
the saved fee.
Fees Management lets admins assign the fee already configured on a course to
enrolled students and record dated payments by method. Course totals are only
created or changed in Courses; updating a course fee updates its existing
student assignments. Students can view fee totals, paid and pending balances,
status, and payment history from their dashboard.

## Local setup

In PowerShell, from this directory:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The Vite development server proxies `/api` and `/health` to
`http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` in `.env` if
your backend runs elsewhere. Start the backend separately using the setup in
`../student_management_system_backend/README.md`.

Open the URL printed by Vite (normally <http://localhost:5173>). Create an
administrator using `python -m app.create_admin` from the backend directory.
Students can register from the sign-in screen; public registration always
creates a student account.

Password-reset requests do not send email. To test the reset flow locally,
enable `APP_ENV=development` and
`PASSWORD_RESET_OTP_CONSOLE_ENABLED=true` in the backend `.env`, then use the
OTP printed in the backend terminal.

## Production

Set `VITE_API_URL` at build time to the full API root, such as
`https://api.example.com/api/v1`. Add the frontend origin to the backend
`CORS_ORIGINS` setting as a comma-separated, exact origin list. Alternatively,
serve the frontend and API through the same origin/reverse proxy and leave
`VITE_API_URL` unset.

Build and preview:

```powershell
npm run build
npm run preview
```
