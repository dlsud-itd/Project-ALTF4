S3-3.6 TEST MATRIX

# CLINIQUE SYSTEM TEST MATRIX - SCHEDULING & APPOINTMENTS

This document covers the booking workflow only.

| Field | Value |
| ----- | ----- |
| **Sprint** | CQ-S3-3.6 |
| **Member** | John Alec L. Resos / John Raphael Reganit / Matthew Ryan Sabino |
| **Role** | Tester / Project Manager |
| **Task** | Test validation, full/unbookable slots, overlap/capacity constraints, duplicate submissions and cancel/reschedule paths. |

**Done:**

- Test schedule and appointment rules
- Test date/time and slot integrity rules
- Log defects, verify fixes and prepare demo
- Duplicate Submissions
- Test booking capacity and management flows

---

## CQ-S3-3.6.01 - Schedule & appointment rules

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| SLOT-01 | Integration | Create a slot with an invalid calendar date | clinicDate 2026-13-45 | Validation error shown, no slot created | Success |
| SLOT-02 | Integration | Create a slot with a malformed date format | clinicDate 11-20-2026 | Validation error shown, no slot created | Success |
| SLOT-03 | Integration | Create a slot with an out-of-range time | startTime 25:00 | Validation error shown, no slot created | Success |
| SLOT-04 | Integration | Create a slot with end time before start | Start 15:00, end 14:00 | Validation error shown, no slot created | Success |
| SLOT-05 | Integration | Create a slot with end time equal to start | Start 15:00, end 15:00 | Validation error shown, no slot created | Success |
| SLOT-06 | Integration | Create a slot with capacity below minimum | capacity 0 | Validation error shown, no slot created | Success |
| SLOT-07 | Integration | List slots using an inverted date range | to date earlier than from date | Validation error shown, no list returned | Success |
| SLOT-08 | Integration | Create a slot dated in the past | clinicDate 2020-01-01 | Slot rejected, past dates not permitted | Fail |
| SLOT-09 | Integration | Create a slot overlapping an existing slot | 09:15-09:45 over 09:00-09:30 | Slot rejected, conflict reported | Success |
| SLOT-10 | Integration | Create a slot touching an existing boundary | 09:30-10:00 after 09:00-09:30 | Slot created, ranges only touch | Success |
| SLOT-11 | Integration | Update a slot without any field | Empty JSON object | Validation error shown, slot unchanged | Success |
| SLOT-12 | Integration | Patient attempts to create a clinic slot | Authenticated patient token | Access denied, staff and admin only | Success |
| SLOT-13 | Integration | Reduce a slot capacity below booked seats | One booked seat, set to 0 | Reduction rejected, capacity unchanged | Success |
| SLOT-14 | Integration | Delete a slot with an active appointment | Slot with one BOOKED appointment | Deletion rejected, slot retained | Success |
| SLOT-15 | Integration | Delete a slot with no active appointments | Slot with no bookings | Slot deleted successfully | Success |

---

## CQ-S3-3.6.02 - Appointment & booking management

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| BOOK-01 | E2E | Patient books an available appointment slot | Valid patient account, date/time slot, req | Appointment is created successfully and a booking confirmation | Success |
| BOOK-02 | Unit | System validates required booking fields | Missing patient info, date or details | Validation errors are displayed and invalid data is rejected | Success |
| BOOK-03 | Integration | System updates slot availability after successful booking | System updates slot availability | Slot availability is updated in DB and reflected in interface | Success |
| BOOK-04 | Unit&Integ. | Patient attempts to book a fully booked slot | Appointment slot with no remaining capacity | Booking is rejected and system informs slot is unavailable | Success |
| BOOK-05 | Integration | Two patients attempt to book final slot simultaneously | Two patient accounts and one slot | Only one booking succeeds, no overbooking | Fail |
| BOOK-06 | Unit | System validates appointment date and time | Past date, invalid time, or outside allowed period | Invalid schedules are rejected according to scheduling rules | Fail |
| BOOK-07 | E2E | Patient views existing appointments | Authenticated patient with bookings | Only authenticated patient's appointments displayed | Success |
| BOOK-08 | E2E | Patient cancels an existing appointment | Authenticated patient with active booking | Status updated to cancelled and reflected in records | Success |
| BOOK-09 | Integration | System releases a slot after cancellation | Active booking occupying slot | Cancelled booking no longer occupies slot | Success |
| BOOK-10 | E2E | Patient reschedules existing appointment | Active booking and new slot | Original booking updated or replaced, new schedule recorded | Success |
| BOOK-11 | E2E | Patient attempts to reschedule to unavailable slot | Active booking and fully booked dest slot | Rescheduling rejected, original appointment unchanged | Success |
| BOOK-12 | Unit & Integ. | System prevents duplicate submissions | Same patient, details, repeated request | Duplicates do not create unintended bookings | Success |
| BOOK-13 | Unit | System validates booking capacity | Slot capacity, current bookings, new req | Accepts within capacity, rejects exceeding capacity | Success |
| BOOK-14 | E2E | Walk-in patient requests an appointment at clinic | Patient details, requested service, slot | Registered successfully and added to active queue with online bookings | Fail |
| BOOK-15 | Integration | Patient books the same slot twice | Same patient, same slot, second request | Duplicate booking rejected, one appointment remains | Success |
| BOOK-16 | Integration | Patient books a second slot at the same date and time | Two slots sharing a date and start time | Booking rejected, date and time already held | Success |
| BOOK-17 | Integration | Patient books a slot closed by staff | Slot marked as not bookable | Booking rejected, slot reported unavailable | Success |
| BOOK-18 | E2E | Patient views a single appointment detail | Own appointment identifier | Appointment and slot details returned | Success |
| BOOK-19 | Integration | Patient views an appointment that does not exist | Appointment identifier 999999 | System reports appointment not found | Success |
| BOOK-20 | Integration | Patient cancels an already cancelled appointment | Appointment in CANCELLED status | Cancellation rejected, status unchanged | Success |
| BOOK-21 | E2E | Clinic staff views scheduled appointments | Authenticated staff account with records | Staff views appointments within authorized scope | Success |
| BOOK-22 | Integration | Patient reschedules a cancelled appointment | Appointment in CANCELLED status | Reschedule rejected, status unchanged | Success |
| BOOK-23 | Integration | Patient reschedules to the slot already held | Same slot identifier as current booking | Reschedule rejected, appointment unchanged | Success |
| BOOK-24 | Integration | Patient reschedules to a slot that does not exist | Slot identifier 999999 | Reschedule rejected, appointment unchanged | Success |
| BOOK-25 | Integration | Patient views another patient's appointment | Foreign appointment identifier | Access denied, appointment not disclosed | Success |
| BOOK-26 | Integration | Patient reschedules another patient's appointment | Foreign appointment identifier | Access denied, appointment unchanged | Success |
| BOOK-27 | Integration | Patient cancels another patient's appointment | Foreign appointment identifier | Access denied, appointment unchanged | Success |

---

## CQ-S3-3.6.03 - Defects logged

### DEF-01 - Past clinic dates are accepted

Creating a slot with clinicDate set to 2020-01-01 returned 200 and created the slot.

| Field | Value |
| ----- | ----- |
| Test | SLOT-08 |
| Owner | Slots module |

### DEF-02 - Past-dated slots can still be booked

A patient booked an appointment into the slot dated 2020-01-01 and received a successful response. Even if slot creation is later restricted, existing past-dated slots remain bookable because the booking path performs no date comparison.

| Field | Value |
| ----- | ----- |
| Test | BOOK-06 |
| Owner | Appointments module |

### DEF-03 - Concurrent bookings overbook a slot

Two races were reproduced against real records.

Six identical requests issued at the same moment against a capacity-5 slot produced two successful bookings. Two different patients booking a capacity-1 slot at the same moment both received a successful response, leaving two BOOKED appointments against a slot holding one seat. Reading the slot afterwards reported a remaining capacity of zero rather than a negative value, so the API does not reveal that it is oversold.

| Field | Value |
| ----- | ----- |
| Test | BOOK-05 |
| Owner | Appointments module |

### DEF-04 - Walk-in registration does not create an appointment

The walk-in endpoint registers a queue entry and returns a ticket, but no appointment record is created, so the patient is queued without a booked schedule.

| Field | Value |
| ----- | ----- |
| Test | BOOK-14 |
| Owner | Appointments and queue modules |
