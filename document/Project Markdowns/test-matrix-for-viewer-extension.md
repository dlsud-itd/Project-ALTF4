# CLINIQUE SYSTEM TEST MATRIX

This document outlines the functional and system data testing scenarios for the
CliniQueue system to evaluate its overall functionality, reliability, performance,
and compliance with the defined system requirements.

### AUTHENTICATION & ROLE AUTHENTICATION

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Integration | Admin sends a registration link to a valid DLSU-D account | Valid DLSU-D email | Registration link is sent to the intended email | Success<br>Fail<br>Pending |
| **AUTH-02** | E2W | Admin attempts to send a registration link to a non-DLSU-D email | Personal email | Registration is rejected | Success<br>Fail<br>Pending |
| **AUTH-03** | E2E | User opens registration link | Registration link & form | Registration page opens successfully | Success<br>Fail<br>Pending |
| **AUTH-04** | E2E | User registers with valid information | DLSU-D email, password, and required fields | Account is created successfully | Success<br>Fail<br>Pending |
| **AUTH-05** | Unit | User attempts registration with an expired link | Expired registration link | Registration is denied; user must request a new link | Success<br>Fail<br>Pending |
| **AUTH-06** | Unit | User attempts to reuse a registration link | Link has already been used | Duplicate registration is prevented | Success<br>Fail<br>Pending |
| **AUTH-07** | Unit | User submits incomplete registration details | Missing required fields | Validation errors are displayed | Success<br>Fail<br>Pending |
| **AUTH-08** | E2E | User submits a weak password | Password that does not meet requirements | Validation errors are displayed | Success<br>Fail<br>Pending |
| **AUTH-09** | E2E | User signs in with valid credentials | Registered account and correct password | User is authenticated and redirected to the appropriate dashboard | Success<br>Fail<br>Pending |
| **AUTH-10** | E2E | User attempts to sign in before completing registration | User | Access is denied | Success<br>Fail<br>Pending |
| **AUTH-11** | E2E | User attempts to access a protected page without signing in | No active authenticated session | User is redirected to sign-in or denied access | Success<br>Fail<br>Pending |
| **AUTH-12** | E2E | User attempts to access another role's restricted page | Authenticated user without the required role | Access is denied | Success<br>Fail<br>Pending |
| **AUTH-13** | E2E | User signs out and revisits a protected page | Previously authenticated user who has signed out | Protected content is no longer accessible without signing in again | Success<br>Fail<br>Pending |
| **AUTH-14** | Integration | User requests a password reset using a registered email | Registered email | Password reset instructions are sent to the registered email | Success<br>Fail<br>Pending |
| **AUTH-15** | E2E | User opens a valid password reset link | Valid, unused reset link | Password reset page opens successfully | Success<br>Fail<br>Pending |
| **AUTH-16** | Unit | User opens an expired password reset link | Expired reset link | Password reset is denied; user is prompted to request a new link | Success<br>Fail<br>Pending |
| **AUTH-17** | Unit | User reuses a password reset link | Previously used reset link | Password reset is denied | Success<br>Fail<br>Pending |
| **AUTH-18** | E2E | User resets password with valid input | Valid reset link and password meeting requirements | Password is updated successfully | Success<br>Fail<br>Pending |
| **AUTH-19** | Unit | User submits a weak or invalid new password | Password that does not meet requirements | Validation error is displayed and password remains unchanged | Success<br>Fail<br>Pending |
| **AUTH-20** | Unit | User submits mismatched new passwords | Password and confirmation fields differ | Validation error is displayed and password is not changed | Success<br>Fail<br>Pending |
| **AUTH-21** | E2E | User signs in using the new password | New password | Login succeeds with the new password | Success<br>Fail<br>Pending |
| **AUTH-22** | E2E | User signs in using the old password | Old password | Login is rejected using the old password | Success<br>Fail<br>Pending |
| **AUTH-23** | Integration | User requests multiple password reset links | Several reset requests are submitted for the same account | Reset tokens follow the system's defined invalidation and expiration policy; only valid tokens can be used | Success<br>Fail<br>Pending |

***

### APPOINTMENT & BOOKING MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BOOK-01** | E2E | Patient books an available appointment slot | Valid patient account, available date and time slot, complete booking details | Appointment is created successfully and a booking confirmation is displayed | Success<br>Fail<br>Pending |
| **BOOK-02** | Unit | System validates required booking fields | Missing patient information, appointment date, or required booking details | Validation errors are displayed and invalid booking data is rejected | Success<br>Fail<br>Pending |
| **BOOK-03** | Integration | System updates slot availability after a successful booking | System updates slot availability after a successful booking | Slot availability is updated in the database and reflected in the booking interface | Success<br>Fail<br>Pending |
| **BOOK-04** | Unit&Integration | Patient attempts to book a fully booked slot | Appointment slot with no remaining capacity | Booking is rejected and the system informs the patient that the slot is unavailable | Success<br>Fail<br>Pending |
| **BOOK-05** | Integration | Two patients attempt to book the final available slot simultaneously | Two patient accounts and one remaining slot | Only one booking succeeds, and the slot is not overbooked | Success<br>Fail<br>Pending |
| **BOOK-06** | Unit | System validates appointment date and time | Past date, invalid time, or date outside the permitted booking period | Invalid appointment schedules are rejected according to the configured scheduling rules | Success<br>Fail<br>Pending |
| **BOOK-07** | E2E | Patient views their existing appointments | Authenticated patient with one or more existing bookings | Only the authenticated patient's appointments are displayed | Success<br>Fail<br>Pending |
| **BOOK-08** | E2E | Patient cancels an existing appointment | Authenticated patient with an active appointment | Appointment status is updated to cancelled and the change is reflected in the booking records | Success<br>Fail<br>Pending |
| **BOOK-09** | Integration | System releases a slot after appointment cancellation | Active booking occupying a slot with available capacity after cancellation | The cancelled booking no longer occupies the slot, making it available according to scheduling rules | Success<br>Fail<br>Pending |
| **BOOK-10** | E2E | Patient reschedules an existing appointment | Active booking and a different available appointment slot | The original booking is updated or replaced according to the system's rescheduling rules, and the new schedule is recorded | Success<br>Fail<br>Pending |
| **BOOK-11** | E2E | Patient attempts to reschedule to an unavailable slot | Active booking and a fully booked destination slot | Rescheduling is rejected and the original appointment remains unchanged | Success<br>Fail<br>Pending |
| **BOOK-12** | Unit & Integration | System prevents duplicate appointment submissions | Same patient, same appointment details, and repeated submission of the same request | Duplicate submissions do not create unintended duplicate bookings | Success<br>Fail<br>Pending |
| **BOOK-13** | Unit | System validates booking capacity | Slot capacity, current confirmed bookings, and a new booking request | The system accepts bookings within capacity and rejects bookings that exceed it | Success<br>Fail<br>Pending |
| **BOOK-14** | E2E | Walk-in patient requests an appointment at the clinic | Patient details, requested clinic or service, and an available appointment slot | Walk-in patients are successfully registered and added to the active queue alongside patients with online bookings. | Success<br>Fail<br>Pending |
| **BOOK-15** | E2E | Clinic staff views scheduled appointments | Authenticated clinic staff account and existing appointment records | Clinic staff can view appointments within their assigned clinic and authorized scope | Success<br>Fail<br>Pending |

***

### QUEUE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QUEUE-01** | Unit | Generate a queue number for a patient | Patient with a confirmed appointment or a registered walk-in entry | A unique queue number is generated for the patient. | Success<br>Fail<br>Pending |
| **QUEUE-02** | Integration | Add a patient to the queue after a successful booking | Valid appointment and available queue slot | The patient is added to the correct queue and associated with the appointment. | Success<br>Fail<br>Pending |
| **QUEUE-03** | E2E | Patient joins the queue successfully | Registered patient with a valid appointment or eligibility to queue | The patient receives a queue number and confirmation of successful entry. | Success<br>Fail<br>Pending |
| **QUEUE-04** | Unit | Maintain the correct queue order | Multiple patients with different queue positions or priorities | Patients are arranged according to the system's defined queue rules. | Success<br>Fail<br>Pending |
| **QUEUE-05** | Integration | Update a patient's queue status | Patient currently marked as Waiting | The status is updated correctly and reflected in the queue display. | Success<br>Fail<br>Pending |
| **QUEUE-06** | E2E | Staff notify the next patient | Multiple patients are waiting in the queue | The next eligible patient is identified and their queue status changes to Called. | Success<br>Fail<br>Pending |
| **QUEUE-07** | Integration | Prevent duplicate active queue entries | Patient already has an active queue entry for the same appointment or service | The system prevents an unintended duplicate entry. | Success<br>Fail<br>Pending |
| **QUEUE-08** | Unit | Handle an empty queue | No patients are waiting | The system displays an appropriate empty-queue message and does not attempt to call a nonexistent patient. | Success<br>Fail<br>Pending |
| **QUEUE-09** | E2E | Mark a patient as served | Patient has been called and consultation is completed | The patient's status changes to Served, and the queue advances to the next eligible patient. | Success<br>Fail<br>Pending |
| **QUEUE-10** | Integration | Handle a skipped or absent patient | Patient is notified but does not respond | Staff can mark the patient as Skipped or No-show, and the queue proceeds according to the defined rules. | Success<br>Fail<br>Pending |
| **QUEUE-11** | Integration | Synchronize queue updates across user interfaces | Staff updates a patient's queue status while the patient dashboard is open | Relevant displays show the updated queue information without inconsistent status values. | Success<br>Fail<br>Pending |

***

### NOTIFICATION MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NOTIF-01** | E2E | Patient receives an appointment booking confirmation | Valid patient account, available appointment slot, and complete booking details | Appointment is booked successfully, and a confirmation notification is displayed or sent through the configured notification channel. | Success<br>Fail<br>Pending |
| **NOTIF-02** | Integration | Patient receives an appointment cancellation notification | Patient with an existing appointment and a successfully processed cancellation | The system sends or displays a cancellation notification containing the correct appointment details. | Success<br>Fail<br>Pending |
| **NOTIF-03** | Integration | Patient receives an appointment rescheduling notification | Existing appointment and a successfully rescheduled appointment | The system notifies the patient of the updated appointment date and time. | Success<br>Fail<br>Pending |
| **NOTIF-04** | Integration | Patient receives a notification when their queue status changes | Patient with an active queue entry and a queue status update | The system sends or displays a notification reflecting the patient's latest queue status. | Success<br>Fail<br>Pending |
| **NOTIF-05** | E2E | Patient receives a notification when their queue number is called | Patient with a queue entry marked as Waiting and clinic staff authorized to call the patient | The patient's queue number is called, and the corresponding notification is delivered or displayed through the configured channel. | Success<br>Fail<br>Pending |
| **NOTIF-06** | Integration | System prevents duplicate notifications for the same event | One appointment booking or queue update that triggers a notification | The system does not send unintended duplicate notifications for the same event. | Success<br>Fail<br>Pending |
| **NOTIF-07** | Integration | System handles notification delivery failure | Valid notification event and an unavailable email, SMS, or notification service | The system handles the delivery failure appropriately, records the failure when supported, and retries or reports it according to the configured rules. | Success<br>Fail<br>Pending |
| **NOTIF-08** | Unit | System validates notification content | Notification template with patient details, appointment information, or queue number | The generated notification contains the correct values and required information without missing or incorrectly substituted fields. | Success<br>Fail<br>Pending |
| **NOTIF-09** | Integration | Clinic staff receives relevant appointment or queue notifications | Authenticated clinic staff account and an event within the staff member's authorized clinic scope | The system delivers or displays the relevant notification to the appropriate staff member without exposing unrelated patient information. | Success<br>Fail<br>Pending |
| **NOTIF-10** | E2E | Patient views their notifications | Authenticated patient account with existing notifications | The patient can view their own notifications, and the displayed information corresponds to their appointments or queue activity. | Success<br>Fail<br>Pending |
| **NOTIF-11** | Unit | System marks a notification as read | Existing unread notification belonging to the authenticated user | The notification's read status changes correctly without modifying unrelated notifications. | Success<br>Fail<br>Pending |

***

### DATA INTEGRITY & DATABASE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DATA-01** | Integration | System saves patient and appointment records to the database | Valid patient information and complete appointment booking details | Patient and appointment records are saved correctly and can be retrieved from the database. | Success<br>Fail<br>Pending |
| **DATA-02** | Integration | System updates database records after appointment cancellation | Existing appointment with an active status | The appointment status is updated to Cancelled, and the change is reflected in the database. | Success<br>Fail<br>Pending |
| **DATA-03** | Integration | System updates database records after appointment rescheduling | Existing appointment and a valid new appointment schedule | The updated appointment details are saved correctly without leaving unintended duplicate or conflicting active bookings. | Success<br>Fail<br>Pending |
| **DATA-04** | Integration | System maintains consistency between appointments and queue entries | Patient with a confirmed appointment or registered walk-in entry | The patient's queue entry is correctly associated with the corresponding patient and appointment or walk-in record. | Success<br>Fail<br>Pending |
| **DATA-05** | Unit | System validates data before saving records | Missing required fields, invalid values, or improperly formatted data | Invalid data is rejected before being accepted by the relevant application logic. | Success<br>Fail<br>Pending |
| **DATA-06** | Integration | System prevents duplicate patient records | Existing patient records | The system prevents unintended duplication of patient records | Success<br>Fail<br>Pending |
| **DATA-07** | Integration | System preserves existing data when an operation fails | Existing database record and a simulated failure during an update or transaction | The system avoids partially applied changes and preserves data consistency according to the transaction rules. | Success<br>Fail<br>Pending |
| **DATA-08** | Integration | System handles database connection failure | Simulated unavailable database connection during a read or write operation | The system handles the failure gracefully, displays an appropriate error, and does not falsely report that the operation succeeded. | Success<br>Fail<br>Pending |
| **DATA-09** | Integration | System retrieves the latest saved data | Existing record that has been successfully created or updated | The system retrieves the latest saved values rather than displaying outdated or inconsistent information. | Success<br>Fail<br>Pending |
| **DATA-10** | Integration | System prevents unauthorized data modifications | Patient account attempting to modify protected patient, appointment, or queue records | Unauthorized modifications are rejected, and the original data remains unchanged. | Success<br>Fail<br>Pending |
| **DATA-11** | Integration | System maintains data consistency during simultaneous updates | Two authorized requests attempting to modify the same appointment or queue record | The system applies its defined concurrency rules and prevents conflicting or inconsistent final records. | Success<br>Fail<br>Pending |
| **DATA-12** | Integration | System preserves existing records when related records are cancelled or deactivated | Patient with existing appointments or queue history | Related records remain consistent and historical information is retained according to the system's data-retention rules. | Success<br>Fail<br>Pending |

***

### USER & ADMINISTRATIVE MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN-01** | E2E | Administrator views registered user accounts | Authenticated administrator account and existing user records | The administrator can view the list of registered users and their relevant account information. | Success<br>Fail<br>Pending |
| **ADMIN-02** | Integration | Administrator assigns or updates a user's role | Existing user account and a valid role assignment | The user's role is updated and saved correctly, and the assigned permissions reflect the new role. | Success<br>Fail<br>Pending |
| **ADMIN-03** | E2E | Administrator deactivates a user account | Existing active user account and an authorized administrator | The account is deactivated successfully, and the user can no longer access protected features requiring an active account. | Success<br>Fail<br>Pending |
| **ADMIN-04** | E2E | Administrator reactivates a deactivated user account | Existing deactivated user account and an authorized administrator | The account is reactivated, and access is restored according to the assigned role and account rules. | Success<br>Fail<br>Pending |
| **ADMIN-05** | Integration | System prevents unauthorized users from performing administrative actions | Authenticated patient or clinic staff account attempting an administrator-only action | The action is rejected, and administrative records remain unchanged. | Success<br>Fail<br>Pending |
| **ADMIN-06** | Integration | Administrator updates clinic configuration settings | Authorized administrator and valid configuration values | The updated settings are saved and applied to the relevant system functions. | Success<br>Fail<br>Pending |
| **ADMIN-07** | Unit | System validates administrative configuration inputs | Missing, invalid, or out-of-range configuration values | Invalid configuration values are rejected, and validation feedback is provided. | Success<br>Fail<br>Pending |
| **ADMIN-08** | E2E | Administrator searches for a specific user account | Existing user account and a supported search term, such as email | The system displays the matching account or an appropriate message when no account matches. | Success<br>Fail<br>Pending |

***

### DASHBOARD & REPORTING MANAGEMENT

| Test ID | Testing level | Test scenario | Test data | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DASH-01** | E2E | Clinic staff views the dashboard | Authenticated clinic staff account and existing clinic records | The dashboard loads successfully and displays information available to the staff member's authorized scope. | Success<br>Fail<br>Pending |
| **DASH-02** | Integration | Dashboard displays the correct appointment count | Known set of appointments with different statuses | The displayed appointment count matches the underlying records and the dashboard's counting rules. | Success<br>Fail<br>Pending |
| **DASH-03** | Integration | Dashboard displays the correct active queue count | Known set of queue entries with different statuses | The displayed active queue count matches the number of entries considered active under the system's rules. | Success<br>Fail<br>Pending |
| **DASH-04** | Integration | Dashboard reflects appointment updates | An appointment is booked, cancelled, or rescheduled | The dashboard reflects the relevant change according to its refresh and update behavior. | Success<br>Fail<br>Pending |
| **DASH-05** | Integration | Dashboard reflects queue status updates | Queue entries in Waiting, Called, In Consultation, or Served states | Queue summaries and counts reflect the current status of queue entries. | Success<br>Fail<br>Pending |
| **DASH-06** | E2E | Administrator views clinic activity statistics | Authorized administrator account and records covering a defined reporting period | The dashboard displays clinic activity statistics for the selected period and authorized scope. | Success<br>Fail<br>Pending |
| **DASH-07** | Integration | System filters dashboard data by date range | Existing appointment and queue records across different dates | Only records matching the selected date range are included in the relevant summaries. | Success<br>Fail<br>Pending |
| **DASH-08** | Integration | System generates an appointment or queue report | Existing records and a supported report type | The generated report contains accurate records and totals for the selected report criteria. | Success<br>Fail<br>Pending |
| **DASH-09** | E2E | Authorized user exports a report | Authorized account, available report, and supported export format | The report is exported successfully in the supported format, and its contents match the selected report data. | Success<br>Fail<br>Pending |
| **DASH-10** | Integration | System restricts dashboard data according to user role | Patient, clinic staff, and administrator accounts with different permissions | Each user can access only the dashboard information permitted by their assigned role. | Success<br>Fail<br>Pending |