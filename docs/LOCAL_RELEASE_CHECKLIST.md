# Local Release Checklist

Use this checklist before sharing a local NiEMIS build for stakeholder testing.

## 1) Set QA credentials (session-only)

PowerShell example:

```powershell
$env:QA_SUPER_ADMIN_LOGIN='super_admin'
$env:QA_SUPER_ADMIN_PASSWORD='<super-admin-password>'
$env:QA_ADMIN_LOGIN='admin'
$env:QA_ADMIN_PASSWORD='<admin-password>'
$env:QA_TEACHER_LOGIN='teacher1'
$env:QA_TEACHER_PASSWORD='<teacher-password>'
# Optional
$env:QA_STUDENT_LOGIN='student_demo'
$env:QA_STUDENT_PASSWORD='<student-password>'
```

## 2) Run one command

```powershell
npm run release:check:local
```

This runs:
- frontend production build
- role + audit API smoke checks
- database backup snapshot

## 3) Review results

- Confirm `passed: true` in the final summary.
- Confirm `backup_file` is present and points to `backend/backups/...`.
- If any role check fails, validate the credential env vars and rerun.

## 4) Optional selective runs

```powershell
npm run qa:roles
npm run db:backup
node local-deployment/local-release-check.js --skip-build
node local-deployment/local-release-check.js --skip-qa
node local-deployment/local-release-check.js --skip-backup
```

## 5) Security notes

- Do not commit live credentials.
- Use environment variables for demo/default seed passwords:
  - `DEMO_TEACHER_DEFAULT_PASSWORD`
  - `DEMO_STUDENT_DEFAULT_PASSWORD`
  - `DEMO_ADMIN_DEFAULT_PASSWORD`
  - `SEED_TEACHER_DEFAULT_PASSWORD`
  - `SEED_STUDENT_DEFAULT_PASSWORD`
  - `SEED_PARENT_DEFAULT_PASSWORD`
