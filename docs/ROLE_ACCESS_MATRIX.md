# NiEMIS Role Access Matrix

## Scope model
- `national`: full cross-school visibility
- `school`: restricted to one school
- `self`: own profile only
- `children`: linked child profiles only

## Access roles

### `super_admin` (national)
- Full read/write access across all modules
- Can manage roles, audit logs, system configuration, and demo-data tooling
- Can view and edit access-control matrix

### `ministry_admin` (national)
- Manages schools, students, teachers, attendance, facilities, reports, and transfers
- Can manage user accounts (except super-admin controls)
- Can view audit and data-quality dashboards

### `school_admin` (school)
- Manages school-local students, classes, timetables, attendance, facilities, reports
- Can finalize reports/grades at school level
- Cannot access cross-school records

### `data_clerk` (school)
- Manages student enrollment/profile records
- Can view attendance/reports and process transfer requests
- Cannot finalize grades/reports or manage teacher roles

### `teacher` (school)
- Manages own classes, timetables, attendance, and grade entry
- Can view assigned student records and class reports
- Cannot manage school-wide users or system settings

### `parent` (children)
- Read-only access for linked child records (profile, attendance, reports)

### `student` (self)
- Read-only access to own profile, attendance, and reports

## Core permission keys
- `dashboard.view`
- `schools.view|create|edit|delete|import`
- `students.view|create|edit|delete|view.self`
- `teachers.view|create|edit|delete`
- `classes.view|manage`
- `timetable.manage`
- `attendance.view|mark|view.self`
- `facilities.view|manage`
- `reports.view|export|finalize|view.self`
- `grades.enter|finalize`
- `transfers.view|manage`
- `users.view|manage_roles|manage_accounts`
- `audit.view`
- `rfid.manage`
- `system.config`
- `access.matrix.view`
- `demo_data.manage`

## UI expectations
- Sidebar navigation must only show items when the permission exists.
- Routes should render an access-denied view for missing permissions.
- Backend remains source of truth and enforces every protected API route.
- Super Admin role console should support per-user history (`who changed what, when`) for access assignments.
