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
date and time.

## List

`GET /api/v1/appointments` returns the authenticated patient's appointments for
patient accounts. Staff and admins can list all appointments. `GET
/api/v1/appointments/my` remains available to patients for their own list.

List responses contain the appointment status and creation date, slot details,
and only the patient's ID, name, and clinic affiliation.

## Detail

`GET /api/v1/appointments/:id` returns the appointment and slot details to its
owning patient, staff, or admins. A patient requesting another patient's
appointment receives `403`; an unknown appointment returns `404`. The patient
profile in the response is limited to ID, name, and clinic affiliation.

## Cancel

`PATCH /api/v1/appointments/:id/cancel` is available to the owning patient for
active booked appointments.
