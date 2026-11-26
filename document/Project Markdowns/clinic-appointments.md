# Clinic Appointment API

Appointment endpoints are available under `/api/v1/appointments` and require
an authenticated account.

## Create

`POST /api/v1/appointments` is available to patients. The authenticated patient
is used as the appointment owner; callers cannot select another patient. The
request requires a positive `slotId` and may include a `reasonForVisit` of up
to 500 characters.

Booking is rejected when the slot does not exist, is closed, has reached
capacity, or the patient already has an active appointment for that slot or
date and time. Patients may hold at most three active bookings. Active means
the appointment is in `BOOKED` status and its slot end time has not passed in
Asia/Manila; expired, completed, cancelled, and no-show appointments do not
count. The limit is checked in the booking transaction while holding a lock on
the patient row, so simultaneous booking requests cannot exceed it. The limit
and active-status list are configured in
[`clinic.constants.ts`](../../apps/api/src/common/clinic.constants.ts).

## List

`GET /api/v1/appointments` returns the authenticated patient's appointments for
patient accounts. Staff and admins can list all appointments. `GET
/api/v1/appointments/my` remains available to patients for their own list.

List responses contain the appointment status and creation date, slot details,
and only the patient's ID, name, and clinic affiliation. Patient list responses
also include `activeBookingCount` and `maxActiveBookings` for the booking form.
Each appointment includes all active `reservedQueueEntries`, with position,
status, and estimated wait; the singular `reservedQueueEntry` remains available
for compatibility with existing appointment views.

## Queue wait estimates

The estimate for each ticket is the number of active tickets ahead multiplied
by the average service duration of completed tickets in that queue. When no
completed service durations are available, the queue's configured fallback is
used (15 minutes by default). The reusable calculation and default are in
[`queue-wait.util.ts`](../../apps/api/src/common/queue-wait.util.ts) and
[`clinic.constants.ts`](../../apps/api/src/common/clinic.constants.ts).

## Detail

`GET /api/v1/appointments/:id` returns the appointment and slot details to its
owning patient, staff, or admins. A patient requesting another patient's
appointment receives `403`; an unknown appointment returns `404`. The patient
profile in the response is limited to ID, name, and clinic affiliation.

## Cancel

`PATCH /api/v1/appointments/:id/cancel` is available to the owning patient for
active booked appointments.
