# Clinic Appointment Rules

The appointment endpoints are available under `/api/v1/appointments`. Every route requires
an authenticated account; the acting user's identity is always taken from the bearer token,
so no request accepts a `patientId`.

## Booking

`POST /api/v1/appointments` is available to patients. The authenticated patient becomes the
appointment owner. The request requires a positive `slotId` and may include a
`reasonForVisit` of up to 500 characters.

Booking is rejected when the slot does not exist, the slot is not bookable, the slot has
reached capacity, the patient already holds an active appointment in that slot, or the
patient already holds an active appointment on the same clinic date and start time. Active
means an appointment in `BOOKED` status. Only `BOOKED` appointments count toward capacity
and duplicate detection, so a cancelled appointment frees both the seat and the patient's
ability to rebook.

Each slot holds at most one appointment per patient, and a patient cannot hold two
appointments at the same clinic date and start time even across different slots.

## Listing

`GET /api/v1/appointments` returns the authenticated patient's appointments for patient
accounts. Staff and admins receive all appointments. `GET /api/v1/appointments/my` remains
available to patients as a shorthand for their own list.

List responses contain the appointment status and creation date, slot details, and the
patient's ID, name, and clinic affiliation only.

## Detail

`GET /api/v1/appointments/:id` returns the appointment and slot details to its owning
patient, staff, or admins. A patient requesting another patient's appointment receives
`403`; an unknown appointment returns `404`. The patient profile in the response is limited
to ID, name, and clinic affiliation.

## Cancel

`PATCH /api/v1/appointments/:id/cancel` is available to the owning patient for appointments
in `BOOKED` status. Other patients receive `403`, and an appointment that is already
cancelled, completed, or marked no-show is rejected with `400`. There is no time window
restricting cancellation.

Cancelling sets the status to `CANCELLED` and keeps the row, so the audit record written
for the appointment remains resolvable. In the same transaction, active queue entries
linked to this appointment are cancelled, their `cancelledAt` timestamp and status history
are recorded, and a queue refresh event is published after commit. Other standalone queue
entries for the patient are not changed.

## Capacity

Capacity is not stored as a counter. A slot's remaining capacity is its `capacity` minus the
number of appointments in `BOOKED` status, never below zero. Cancelling an appointment
restores a seat implicitly.

## Audit records

Booking and cancellation each write an audit record. A booking records the slot, clinic
date, start and end times, and the supplied reason for visit. A cancellation records the
appointment. Audit writes are non-blocking, so a failure to record does not fail the
request.

## Response shapes

Booking returns a message and the created appointment. Listing returns an `appointments`
array. Detail returns an `appointment` object with no message. Cancelling returns only a
message.

The reason for visit is accepted on booking and echoed in the booking response, but it is
not stored on the appointment, so it is not returned by listing or detail.

## Queue and appointment lifecycle mapping

Booking creates the `BOOKED` appointment, its `WAITING` queue entry, and the initial queue
status history in one database transaction. Queue refresh events are published after commit
so clients reload current metrics and serving-ticket information.

| Queue transition | Appointment transition | Queue timestamp / behavior |
| :--- | :--- | :--- |
| Booking -> `WAITING` | created as `BOOKED` | `joined_at` is set; initial status history is recorded |
| `WAITING` -> `CALLED` | remains `BOOKED` (there is no appointment `CALLED` status) | `called_at` and the grace deadline are set |
| `CALLED` -> `IN_CONSULTATION` | remains `BOOKED` | `consultation_started_at` is set and the grace deadline is cleared |
| `IN_CONSULTATION` -> `COMPLETED` | `BOOKED` -> `COMPLETED` when linked | `completed_at` is set; optional administrative notes are appended with a timestamp |
| `CALLED` -> `NO_SHOW` | `BOOKED` -> `NO_SHOW` when linked | `no_show_at` is set and the grace deadline is cleared |
| `WAITING`, `CALLED`, or `IN_CONSULTATION` -> `CANCELLED` | `BOOKED` -> `CANCELLED` when linked | `cancelled_at` is set and the grace deadline is cleared |

Queue and appointment changes are guarded against the persisted current state and written
in the same transaction. Terminal states (`COMPLETED`, `NO_SHOW`, and `CANCELLED`) cannot
transition again. Standalone queue entries update only their queue state. Appointment
records do not have `calledAt`, `completedAt`, or `cancelledAt` fields; those timestamps
are recorded on the linked queue entry.

The public queue status response contains patient-appropriate ticket status, current ticket,
room, waiting count, and estimated wait. Administrative counts and patient details are only
included in the authenticated staff response. Administrative queue notes are excluded from
patient status, tracking, and presenter output.

Rescheduling moves the existing appointment to another slot rather than creating a second
appointment, because duplicate date-and-time validation would reject a second booking
against the patient's existing appointment.

## Prerequisite

The migration `20261021161000_auth_only_tables` drops the `appointment`, `clinic_slot`,
`daily_queue`, `queue_entry`, and `notification` tables, and no later migration re-creates
them. A database built from the migration history has the appointment status enum but no
appointment table. A migration that restores these tables is required before the endpoints
can be exercised.
