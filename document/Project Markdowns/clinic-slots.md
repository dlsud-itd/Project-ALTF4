# Clinic Slot Rules

The slot endpoints are available under `/api/v1/slots`. Listing is public;
creating, updating, and deleting slots requires an authenticated `STAFF` or
`ADMIN` account.

## Listing

`GET /api/v1/slots` accepts optional `from` and `to` query parameters in
`YYYY-MM-DD` format. Both endpoints of the date range are inclusive. If omitted,
`from` defaults to today and `to` defaults to seven days after `from`. The API
rejects invalid calendar dates and a `to` date earlier than `from`; it does not
impose a maximum range length.

The response includes slots whether or not they can currently be booked. Each
slot reports `capacity`, `remainingCapacity`, and an effective `isBookable`
value. `remainingCapacity` is `capacity` minus appointments in `BOOKED` status,
never below zero. Effective `isBookable` is true only when the slot is enabled
and has remaining capacity.

## Create and update

`POST /api/v1/slots` creates a slot; `PATCH /api/v1/slots/:id` updates only
provided fields. A clinic date must be a valid `YYYY-MM-DD` calendar date, and
start/end times must use 24-hour `HH:mm` format. The end time must be later than
the start time. Capacity must be a positive integer, and an update cannot lower
capacity below the number of booked appointments. An empty update is rejected.
Dates are not restricted to a future-only window.

Slots on the same clinic date cannot overlap. Time ranges that only touch at an
endpoint are allowed. A slot can be marked `isBookable: false` to stop new
bookings while retaining the slot.

## Delete

`DELETE /api/v1/slots/:id` is rejected while a slot has any `BOOKED`
appointments. Disable the slot with `isBookable: false` instead. Cancelled,
completed, and no-show appointments do not count as active for the capacity or
deletion checks.
