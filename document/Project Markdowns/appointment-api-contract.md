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
for the appointment remains resolvable.

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

## Status values

Appointments carry one of four statuses: `BOOKED`, `CANCELLED`, `COMPLETED`, or `NO_SHOW`.
Only `BOOKED` is set through the API, on booking. Cancellation moves `BOOKED` to
`CANCELLED`. `COMPLETED` and `NO_SHOW` are defined but no route produces them. `CANCELLED`
is terminal because the cancel route rejects any appointment that is not `BOOKED`.

## Not yet available

Confirming or rejecting an appointment, marking a consultation completed or no-show, and
rescheduling an appointment have no endpoints. Adding confirmation requires a new value in
the appointment status enum, and every capacity check keyed on `BOOKED` must include it or
confirming an appointment would release its seat.

Rescheduling cannot be added as a new booking, because the duplicate date-and-time rule
would reject the patient against their own existing appointment. It requires moving the
existing appointment to another slot.

## Prerequisite

The migration `20261021161000_auth_only_tables` drops the `appointment`, `clinic_slot`,
`daily_queue`, `queue_entry`, and `notification` tables, and no later migration re-creates
them. A database built from the migration history has the appointment status enum but no
appointment table. A migration that restores these tables is required before the endpoints
can be exercised.
