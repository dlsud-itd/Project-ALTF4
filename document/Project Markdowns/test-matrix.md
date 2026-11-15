
# CLINIQUE SYSTEM TEST MATRIX

This document outlines the functional and system data testing scenarios for the
CliniQueue system to evaluate its overall functionality, reliability, performance,
and compliance with the defined system requirements.

### AUTHENTICATION & ROLE AUTHENTICATION

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| AUTH-01 | Integration | Admin sends a registration link to a valid DLSU-D account | Valid DLSU-D email | Registration link is sent to the intended email | Pending  |
| AUTH-02 | E2W | Admin attempts to send a registration link to a non-DLSU-D email | Personal email | Registration is rejected | Pending  |
| AUTH-03 | E2E | User opens registration link | Registration link & form | Registration page opens successfully | Pending  |
| AUTH-04 | E2E | User registers with valid information | DLSU-D email, password, and req. fields | Account is created successfully | Pending  |
| AUTH-05 | Unit | User attempts registration with an expired link | Expired registration link | Registration is denied; user must request a new link | Pending  |
| AUTH-06 | Unit | User attempts to reuse a registration link | Link has already been used | Duplicate registration is prevented | Pending  |
| AUTH-07 | Unit | User submits incomplete registration details | Missing required fields | Validation errors are displayed | Success  |
| AUTH-08 | E2E | User submits a weak password | Password that does not meet requirements | Validation errors are displayed | Success  |
| AUTH-09 | E2E | User signs in with valid credentials | Registered account and correct password | User is authenticated and redirected to appropriate dashboard | Success  |
| AUTH-10 | E2E | User attempts to sign in before completing registration | User | Access is denied | Success  |
| AUTH-11 | E2E | User attempts to access a protected page without signing in | No active authenticated session | User is redirected to sign-in or denied access | Success  |
| AUTH-12 | E2E | User attempts to access another role's restricted page | Authenticated user without required role | Access is denied | Success  |
| AUTH-13 | E2E | User signs out and revisits a protected page | Previously authenticated user who has signed out | Protected content is no longer accessible without signing in again | Success  |
| AUTH-14 | Integration | User requests a password reset using a registered email | Registered email | Password reset instructions are sent to the registered email | Fail     |
| AUTH-15 | E2E | User opens a valid password reset link | Valid, unused reset link | Password reset page opens successfully | Pending  |
| AUTH-16 | Unit | User opens an expired password reset link | Expired reset link | Password reset is denied; user is prompted to request new link | Pending  |
| AUTH-17 | Unit | User reuses a password reset link | Previously used reset link | Password reset is denied | Pending  |
| AUTH-18 | E2E | User resets password with valid input | Valid reset link and password reqs | Password is updated successfully | Pending  |
| AUTH-19 | Unit | User submits a weak or invalid new password | Password that does not meet requirements | Validation error is displayed and password remains same | Pending  |
| AUTH-20 | Unit | User submits mismatched new passwords | Password and confirmation differ | Validation error is displayed and password is not changed | Pending  |
| AUTH-21 | E2E | User signs in using the new password | New password | Login succeeds with the new password | Pending  |
| AUTH-22 | E2E | User signs in using the old password | Old password | Login is rejected using the old password | Pending  |
| AUTH-23 | Integration | User requests multiple password reset links | Several reset requests submitted for acc | Reset tokens follow system's defined policy; only valid ones can be used | Fail     |



### APPOINTMENT & BOOKING MANAGEMENT

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

### SCHEDULE & APPOINTMENT RULES

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| SLOT-01 | Integration | Create a slot with an invalid calendar date | clinicDate 2026-13-45 | Validation error shown, no slot created | Success  |
| SLOT-02 | Integration | Create a slot with a malformed date format | clinicDate 11-20-2026 | Validation error shown, no slot created | Success  |
| SLOT-03 | Integration | Create a slot with an out-of-range time | startTime 25:00 | Validation error shown, no slot created | Success  |
| SLOT-04 | Integration | Create a slot with end time before start | Start 15:00, end 14:00 | Validation error shown, no slot created | Success  |
| SLOT-05 | Integration | Create a slot with end time equal to start | Start 15:00, end 15:00 | Validation error shown, no slot created | Success  |
| SLOT-06 | Integration | Create a slot with capacity below minimum | capacity 0 | Validation error shown, no slot created | Success  |
| SLOT-07 | Integration | List slots using an inverted date range | to date earlier than from date | Validation error shown, no list returned | Success  |
| SLOT-08 | Integration | Create a slot dated in the past | clinicDate 2020-01-01 | Slot rejected, past dates not permitted | Fail     |
| SLOT-09 | Integration | Create a slot overlapping an existing slot | 09:15-09:45 over 09:00-09:30 | Slot rejected, conflict reported | Success  |
| SLOT-10 | Integration | Create a slot touching an existing boundary | 09:30-10:00 after 09:00-09:30 | Slot created, ranges only touch | Success  |
| SLOT-11 | Integration | Update a slot without any field | Empty JSON object | Validation error shown, slot unchanged | Success  |
| SLOT-12 | Integration | Patient attempts to create a clinic slot | Authenticated patient token | Access denied, staff and admin only | Success  |
| SLOT-13 | Integration | Reduce a slot capacity below booked seats | One booked seat, set to 0 | Reduction rejected, capacity unchanged | Success  |
| SLOT-14 | Integration | Delete a slot with an active appointment | Slot with one BOOKED appointment | Deletion rejected, slot retained | Success  |
| SLOT-15 | Integration | Delete a slot with no active appointments | Slot with no bookings | Slot deleted successfully | Success  |

---

### QUEUE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| QUEUE-01 | Unit | Generate a queue number for a patient | Patient with confirmed appt or walk-in | Unique queue number is generated for patient | Success  |
| QUEUE-02 | Integration | Add a patient to queue after a successful booking | Valid appt and available slot | Patient added to correct queue and associated with appt | Success  |
| QUEUE-03 | E2E | Patient joins queue successfully | Registered patient with valid appt | Patient receives queue number and confirmation | Pending  |
| QUEUE-04 | Unit | Maintain the correct queue order | Multiple patients with differing positions | Patients arranged according to defined queue rules | Fail     |
| QUEUE-05 | Integration | Update a patient's queue status | Patient marked as Waiting | Status updated correctly and reflected in display | Success  |
| QUEUE-06 | E2E | Staff notify next patient | Multiple patients waiting | Next eligible patient found, status changes to Called | Success  |
| QUEUE-07 | Integration | Prevent duplicate queue entries | Patient already has active entry | System prevents unintended duplicate entry | Pending  |
| QUEUE-08 | Unit | Handle an empty queue | No patients waiting | Displays empty message, doesn't call nonexistent | Pending  |
| QUEUE-09 | E2E | Mark a patient as served | Patient called, consult completed | Status changes to Served, queue advances to next | Pending  |
| QUEUE-10 | Integration | Handle a skipped or absent patient | Patient notified but no response | Staff marks as Skipped/ No-show, queue proceeds | Pending  |
| QUEUE-11 | Integration | Synchronize queue updates across UIs | Staff updates status | Displays show updated info, no conflict | Pending  |

<br>

### NOTIFICATION MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| NOTIF-01 | E2E | Patient receives booking confirmation | Valid patient account, slot, details | Appt booked, confirmation notification sent or displayed | Fail     |
| NOTIF-02 | Integration | Patient receives cancellation notification | Patient with existing appt, cancelled | System sends/ displays cancellation with correct details | Fail     |
| NOTIF-03 | Integration | Patient receives rescheduling notification | Existing appt, successfully resched. | System notifies patient of updated date and time | Fail     |
| NOTIF-04 | Integration | Patient receives notification when status changes | Patient with active queue, update | System sends/ displays notification reflecting latest status | Fail     |
| NOTIF-05 | E2E | Patient receives notification when number is called | Patient waiting, staff auth to call | Number called, notification delivered through channel | Fail     |
| NOTIF-06 | Integration | Prevent duplicate notifications same event | One booking or update trigger | System does not send unintended duplicate | Fail     |
| NOTIF-07 | Integration | Handle delivery failure | Valid event, unavailable | Handles failure appropriately, records/retries | Fail     |
| NOTIF-08 | Unit | Validate content | Template with details | Contains correct values, no missing fields | Fail     |
| NOTIF-09 | Integration | Staff receives relevant notifications | Auth staff, relevant event | Delivers notification without exposing other info | Fail     |
| NOTIF-10 | E2E | Patient views notifications | Auth patient, existing notifs | Patient views own notifs, info matches activity | Fail     |
| NOTIF-11 | Unit | Mark notification as read | Existing unread notif | Read status changes, no unrelated changes | Fail     |

<br>

### DATA INTEGRITY & DATABASE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| DATA-01 | Integration | System saves patient and appt records to DB | Valid patient info, details | Records saved correctly, retrievable from DB | Success  |
| DATA-02 | Integration | Updates DB records after cancellation | Existing appt with active status | Status updated to Cancelled, reflected in DB | Success  |
| DATA-03 | Integration | Updates DB after rescheduling | Existing appt, valid new schedule | Details saved correctly, no duplicates | Success  |
| DATA-04 | Integration | Maintains consistency appts & queue | Patient with confirmed appt | Queue entry associated with patient & record | Pending  |
| DATA-05 | Unit | Validates data before saving | Missing fields, bad format | Invalid data rejected by logic | Pending  |
| DATA-06 | Integration | Prevents duplicate patient records | Existing patient records | Prevents unintended duplication | Pending  |
| DATA-07 | Integration | Preserves data on failure | Existing record, simulated failure | Avoids partial changes, preserves consistency | Pending  |
| DATA-08 | Integration | Handles DB connection failure | Simulated unavailable DB | Handles gracefully, displays error, no false success | Pending  |
| DATA-09 | Integration | Retrieves latest data | Existing record created/ updated | Retrieves latest values, not outdated info | Pending  |
| DATA-10 | Integration | Prevents unauthorized modifications | Patient attempting to modify records | Modifications rejected, original data unchanged | Pending  |
| DATA-11 | Integration | Maintains consistency simultaneous updates | Two requests modifying same rec | Concurrency rules applied, prevents conflict | Pending  |
| DATA-12 | Integration | Preserves records when related cancelled | Patient with appts, history | Records consistent, history retained | Pending  |

<br>

### USER & ADMINISTRATIVE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| ADMIN-01 | E2E | Admin views registered user accounts | Auth admin, existing records | Admin views list of users and info | Fail     |
| ADMIN-02 | Integration | Admin assigns or updates user's role | Existing user, valid role | Role updated, permissions reflect role | Fail     |
| ADMIN-03 | E2E | Admin deactivates user account | Active user, auth admin | Account deactivated, cannot access protected feats | Fail     |
| ADMIN-04 | E2E | Admin reactivates user account | Deactivated user, auth admin | Account reactivated, access restored per rules | Fail     |
| ADMIN-05 | Integration | Prevents unauthorized admin actions | Auth patient/ staff, admin action | Action rejected, records unchanged | Fail     |
| ADMIN-06 | Integration | Admin updates clinic config settings | Auth admin, valid config | Settings saved and applied to functions | Fail     |
| ADMIN-07 | Unit | Validates admin config inputs | Missing, invalid, out of range | Invalid values rejected, feedback provided | Fail     |
| ADMIN-08 | E2E | Admin searches for user account | Existing user, search term | Displays matching account or message if none match | Fail     |

<br>

### DASHBOARD & REPORTING MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :------ | :------------ | :------------ | :-------- | :-------------- | :----- |
| DASH-01 | E2E | Clinic staff views dashboard | Auth staff, existing records | Dashboard loads successfully, shows info per scope | Fail     |
| DASH-02 | Integration | Dashboard shows correct appt count | Known set of appts | Count matches underlying records/rules | Fail     |
| DASH-03 | Integration | Dashboard shows correct active queue count | Known set of queue entries | Active count matches rules | Fail     |
| DASH-04 | Integration | Dashboard reflects appt updates | Appt booked, cancel/ resched | Dashboard reflects change per behavior | Fail     |
| DASH-05 | Integration | Dashboard reflects queue updates | Queue entries in states | Summaries/ counts reflect current status | Fail     |
| DASH-06 | E2E | Admin views clinic stats | Auth admin, period records | Dashboard shows stats for selected period and scope | Fail     |
| DASH-07 | Integration | Filters data by date range | Appt and queue records over time | Only records matching range included | Fail     |
| DASH-08 | Integration | Generates report | Existing records, type | Report contains accurate data and totals | Fail     |
| DASH-09 | E2E | Authorized user exports report | Auth account, report, format | Report exported in supported format, data matches | Fail     |
| DASH-10 | Integration | Restricts data by role | Patient, staff, admin accounts | Each user only accesses permitted data | Pending  |
```

