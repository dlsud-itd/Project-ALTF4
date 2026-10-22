
# CLINIQUE SYSTEM TEST MATRIX

This document outlines the functional and system data testing scenarios for the
CliniQueue system to evaluate its overall functionality, reliability, performance,
and compliance with the defined system requirements.

### AUTHENTICATION & ROLE AUTHENTICATION

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Admin sends a    | Valid       | Registration       | Success                   |
|           |                 | registration     | DLSUD       | link is sent       | Fail                      |
| AUTH-01   |                 | link to a        | email       | to the intended    | Pending                   |
|           |                 | valid DLSU-D     |             | email              |                           |
|           |                 | account          |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2W             | Admin attempts   | Personal    | Registration       | Success                   |
|           |                 | to send a        | email       | is rejected        | Fail                      |
| AUTH-02   |                 | registration     |             |                    | Pending                   |
|           |                 | link to a non-   |             |                    |                           |
|           |                 | DLSU-D email     |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User opens       | Registra-   | Registration       | Success                   |
|           |                 | registration     | tion link   | page opens         | Fail                      |
| AUTH-03   |                 | link             | & form      | successfully       | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User registers   | DLSU-D      | Account is         | Success                   |
|           |                 | with valid       | email,      | created            | Fail                      |
| AUTH-04   |                 | information      | password,   | successfully       | Pending                   |
|           |                 |                  | and req.    |                    |                           |
|           |                 |                  | fields      |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User attempts    | Expired     | Registration       | Success                   |
|           |                 | registration     | registra-   | is denied; user    | Fail                      |
| AUTH-05   |                 | with an          | tion link   | must request a     | Pending                   |
|           |                 | expired link     |             | new link           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User attempts    | Link has    | Duplicate          | Success                   |
|           |                 | to reuse a       | already     | registration is    | Fail                      |
| AUTH-06   |                 | registration     | been used   | prevented          | Pending                   |
|           |                 | link             |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User submits     | Missing     | Validation         | Success                   |
|           |                 | incomplete       | required    | errors are         | Fail                      |
| AUTH-07   |                 | registration     | fields      | displayed          | Pending                   |
|           |                 | details          |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User submits     | Password    | Validation         | Success                   |
|           |                 | a weak           | that does   | errors are         | Fail                      |
| AUTH-08   |                 | password         | not meet    | displayed          | Pending                   |
|           |                 |                  | requirem-   |                    |                           |
|           |                 |                  | ents        |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User signs in    | Registered  | User is            | Success                   |
|           |                 | with valid       | account     | authenticated      | Fail                      |
| AUTH-09   |                 | credentials      | and         | and redirected     | Pending                   |
|           |                 |                  | correct     | to appropriate     |                           |
|           |                 |                  | password    | dashboard          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User attempts    | User        | Access is          | Success                   |
|           |                 | to sign in       |             | denied             | Fail                      |
| AUTH-10   |                 | before           |             |                    | Pending                   |
|           |                 | completing       |             |                    |                           |
|           |                 | registration     |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User attempts    | No active   | User is            | Success                   |
|           |                 | to access a      | authenti-   | redirected to      | Fail                      |
| AUTH-11   |                 | protected page   | cated       | sign-in or         | Pending                   |
|           |                 | without          | session     | denied access      |                           |
|           |                 | signing in       |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User attempts    | Authenti-   | Access is          | Success                   |
|           |                 | to access        | cated user  | denied             | Fail                      |
| AUTH-12   |                 | another role's   | without     |                    | Pending                   |
|           |                 | restricted       | required    |                    |                           |
|           |                 | page             | role        |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User signs out   | Previously  | Protected          | Success                   |
|           |                 | and revisits     | authenti-   | content is no      | Fail                      |
| AUTH-13   |                 | a protected      | cated user  | longer             | Pending                   |
|           |                 | page             | who has     | accessible         |                           |
|           |                 |                  | signed out  | without signing    |                           |
|           |                 |                  |             | in again           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | User requests    | Registered  | Password reset     | Success                   |
|           |                 | a password       | email       | instructions       | Fail                      |
| AUTH-14   |                 | reset using a    |             | are sent to the    | Pending                   |
|           |                 | registered       |             | registered email   |                           |
|           |                 | email            |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User opens a     | Valid,      | Password reset     | Success                   |
|           |                 | valid password   | unused      | page opens         | Fail                      |
| AUTH-15   |                 | reset link       | reset link  | successfully       | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User opens an    | Expired     | Password reset     | Success                   |
|           |                 | expired          | reset link  | is denied; user    | Fail                      |
| AUTH-16   |                 | password reset   |             | is prompted to     | Pending                   |
|           |                 | link             |             | request new link   |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User reuses a    | Previously  | Password reset     | Success                   |
|           |                 | password reset   | used reset  | is denied          | Fail                      |
| AUTH-17   |                 | link             | link        |                    | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User resets      | Valid       | Password is        | Success                   |
|           |                 | password with    | reset link  | updated            | Fail                      |
| AUTH-18   |                 | valid input      | and pass-   | successfully       | Pending                   |
|           |                 |                  | word reqs   |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User submits     | Password    | Validation         | Success                   |
|           |                 | a weak or        | that does   | error is           | Fail                      |
| AUTH-19   |                 | invalid new      | not meet    | displayed and      | Pending                   |
|           |                 | password         | requirem-   | password           |                           |
|           |                 |                  | ents        | remains same       |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | User submits     | Password    | Validation         | Success                   |
|           |                 | mismatched       | and         | error is           | Fail                      |
| AUTH-20   |                 | new passwords    | confirma-   | displayed and      | Pending                   |
|           |                 |                  | tion        | password is not    |                           |
|           |                 |                  | differ      | changed            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User signs in    | New         | Login succeeds     | Success                   |
|           |                 | using the new    | password    | with the new       | Fail                      |
| AUTH-21   |                 | password         |             | password           | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | User signs in    | Old         | Login is           | Success                   |
|           |                 | using the old    | password    | rejected using     | Fail                      |
| AUTH-22   |                 | password         |             | the old password   | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | User requests    | Several     | Reset tokens       | Success                   |
|           |                 | multiple         | reset       | follow system's    | Fail                      |
| AUTH-23   |                 | password reset   | requests    | defined policy;    | Pending                   |
|           |                 | links            | submitted   | only valid ones    |                           |
|           |                 |                  | for acc     | can be used        |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |



### APPOINTMENT & BOOKING MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient books    | Valid       | Appointment is     | Success                   |
|           |                 | an available     | patient     | created            | Fail                      |
| BOOK-01   |                 | appointment      | account,    | successfully       | Pending                   |
|           |                 | slot             | date/time   | and a booking      |                           |
|           |                 |                  | slot, req   | confirmation       |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | System           | Missing     | Validation         | Success                   |
|           |                 | validates        | patient     | errors are         | Fail                      |
| BOOK-02   |                 | required         | info, date  | displayed and      | Pending                   |
|           |                 | booking fields   | or details  | invalid data       |                           |
|           |                 |                  |             | is rejected        |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | System updates   | System      | Slot avail-        | Success                   |
|           |                 | slot avail-      | updates     | ability is         | Fail                      |
| BOOK-03   |                 | ability after    | slot        | updated in DB      | Pending                   |
|           |                 | successful       | avail-      | and reflected      |                           |
|           |                 | booking          | ability     | in interface       |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit&Integ.     | Patient          | Appointment | Booking is         | Success                   |
|           |                 | attempts to      | slot with   | rejected and       | Fail                      |
| BOOK-04   |                 | book a fully     | no remain-  | system informs     | Pending                   |
|           |                 | booked slot      | ing capa-   | slot is            |                           |
|           |                 |                  | city        | unavailable        |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Two patients     | Two         | Only one           | Success                   |
|           |                 | attempt to       | patient     | booking            | Fail                      |
| BOOK-05   |                 | book final       | accounts    | succeeds, no       | Pending                   |
|           |                 | slot simul-      | and one     | overbooking        |                           |
|           |                 | taneously        | slot        |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | System           | Past date,  | Invalid            | Success                   |
|           |                 | validates        | invalid     | schedules are      | Fail                      |
| BOOK-06   |                 | appointment      | time, or    | rejected           | Pending                   |
|           |                 | date and time    | outside     | according to       |                           |
|           |                 |                  | allowed     | scheduling         |                           |
|           |                 |                  | period      | rules              |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient views    | Auth-       | Only auth-         | Success                   |
|           |                 | existing         | enticated   | enticated          | Fail                      |
| BOOK-07   |                 | appointments     | patient     | patient's          | Pending                   |
|           |                 |                  | with        | appointments       |                           |
|           |                 |                  | bookings    | displayed          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient          | Auth-       | Status updated     | Success                   |
|           |                 | cancels an       | enticated   | to cancelled       | Fail                      |
| BOOK-08   |                 | existing         | patient     | and reflected      | Pending                   |
|           |                 | appointment      | with        | in records         |                           |
|           |                 |                  | active      |                    |                           |
|           |                 |                  | booking     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | System           | Active      | Cancelled          | Success                   |
|           |                 | releases a       | booking     | booking no         | Fail                      |
| BOOK-9    |                 | slot after       | occupying   | longer             | Pending                   |
|           |                 | cancellation     | slot        | occupies slot      |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient          | Active      | Original           | Success                   |
|           |                 | reschedules      | booking     | booking updated    | Fail                      |
| BOOK-10   |                 | existing         | and new     | or replaced,       | Pending                   |
|           |                 | appointment      | slot        | new schedule       |                           |
|           |                 |                  |             | recorded           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient          | Active      | Rescheduling       | Success                   |
|           |                 | attempts to      | booking     | rejected,          | Fail                      |
| BOOK-11   |                 | reschedule to    | and fully   | original           | Pending                   |
|           |                 | unavailable      | booked      | appointment        |                           |
|           |                 | slot             | dest slot   | unchanged          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit & Integ.   | System           | Same        | Duplicates         | Success                   |
|           |                 | prevents         | patient,    | do not create      | Fail                      |
| BOOK-12   |                 | duplicate        | details,    | unintended         | Pending                   |
|           |                 | submissions      | repeated    | bookings           |                           |
|           |                 |                  | request     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | System           | Slot        | Accepts within     | Success                   |
|           |                 | validates        | capacity,   | capacity,          | Fail                      |
| BOOK-13   |                 | booking          | current     | rejects            | Pending                   |
|           |                 | capacity         | bookings,   | exceeding          |                           |
|           |                 |                  | new req     | capacity           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Walk-in          | Patient     | Registered         | Success                   |
|           |                 | patient          | details,    | successfully       | Fail                      |
| BOOK-14   |                 | requests an      | requested   | and added to       | Pending                   |
|           |                 | appointment      | service,    | active queue       |                           |
|           |                 | at clinic        | slot        | with online        |                           |
|           |                 |                  |             | bookings           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Clinic staff     | Auth-       | Staff views        | Success                   |
|           |                 | views            | enticated   | appointments       | Fail                      |
| BOOK-15   |                 | scheduled        | staff       | within their       | Pending                   |
|           |                 | appointments     | account,    | assigned clinic    |                           |
|           |                 |                  | existing    | and scope          |                           |
|           |                 |                  | records     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |

<br>

### QUEUE MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Generate a       | Patient     | Unique queue       | Success                   |
|           |                 | queue number     | with        | number is          | Fail                      |
| QUEUE-01  |                 | for a patient    | confirmed   | generated for      | Pending                   |
|           |                 |                  | appt or     | patient            |                           |
|           |                 |                  | walk-in     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Add a patient    | Valid       | Patient added      | Success                   |
|           |                 | to queue         | appt and    | to correct         | Fail                      |
| QUEUE-02  |                 | after a          | available   | queue and          | Pending                   |
|           |                 | successful       | slot        | associated         |                           |
|           |                 | booking          |             | with appt          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient joins    | Registered  | Patient receives   | Success                   |
|           |                 | queue            | patient     | queue number       | Fail                      |
| QUEUE-03  |                 | successfully     | with valid  | and                | Pending                   |
|           |                 |                  | appt        | confirmation       |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Maintain the     | Multiple    | Patients           | Success                   |
|           |                 | correct queue    | patients    | arranged           | Fail                      |
| QUEUE-04  |                 | order            | with        | according to       | Pending                   |
|           |                 |                  | differing   | defined queue      |                           |
|           |                 |                  | positions   | rules              |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Update a         | Patient     | Status updated     | Success                   |
|           |                 | patient's        | marked      | correctly and      | Fail                      |
| QUEUE-05  |                 | queue status     | as Waiting  | reflected in       | Pending                   |
|           |                 |                  |             | display            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Staff notify     | Multiple    | Next eligible      | Success                   |
|           |                 | next patient     | patients    | patient found,     | Fail                      |
| QUEUE-06  |                 |                  | waiting     | status changes     | Pending                   |
|           |                 |                  |             | to Called          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Prevent          | Patient     | System prevents    | Success                   |
|           |                 | duplicate        | already     | unintended         | Fail                      |
| QUEUE-07  |                 | queue entries    | has active  | duplicate          | Pending                   |
|           |                 |                  | entry       | entry              |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Handle an        | No          | Displays           | Success                   |
|           |                 | empty queue      | patients    | empty message,     | Fail                      |
| QUEUE-08  |                 |                  | waiting     | doesn't call       | Pending                   |
|           |                 |                  |             | nonexistent        |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Mark a patient   | Patient     | Status changes     | Success                   |
|           |                 | as served        | called,     | to Served,         | Fail                      |
| QUEUE-09  |                 |                  | consult     | queue advances     | Pending                   |
|           |                 |                  | completed   | to next            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Handle a         | Patient     | Staff marks        | Success                   |
|           |                 | skipped or       | notified    | as Skipped/        | Fail                      |
| QUEUE-10  |                 | absent patient   | but no      | No-show, queue     | Pending                   |
|           |                 |                  | response    | proceeds           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Synchronize      | Staff       | Displays show      | Success                   |
|           |                 | queue updates    | updates     | updated info,      | Fail                      |
| QUEUE-11  |                 | across UIs       | status      | no conflict        | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |

<br>

### NOTIFICATION MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient          | Valid       | Appt booked,       | Success                   |
|           |                 | receives         | patient     | confirmation       | Fail                      |
| NOTIF-01  |                 | booking          | account,    | notification       | Pending                   |
|           |                 | confirmation     | slot,       | sent or            |                           |
|           |                 |                  | details     | displayed          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Patient          | Patient     | System sends/      | Success                   |
|           |                 | receives         | with        | displays           | Fail                      |
| NOTIF-02  |                 | cancellation     | existing    | cancellation       | Pending                   |
|           |                 | notification     | appt,       | with correct       |                           |
|           |                 |                  | cancelled   | details            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Patient          | Existing    | System notifies    | Success                   |
|           |                 | receives         | appt,       | patient of         | Fail                      |
| NOTIF-03  |                 | rescheduling     | success-    | updated date       | Pending                   |
|           |                 | notification     | fully       | and time           |                           |
|           |                 |                  | resched.    |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Patient          | Patient     | System sends/      | Success                   |
|           |                 | receives         | with        | displays           | Fail                      |
| NOTIF-04  |                 | notification     | active      | notification       | Pending                   |
|           |                 | when status      | queue,      | reflecting         |                           |
|           |                 | changes          | update      | latest status      |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient          | Patient     | Number called,     | Success                   |
|           |                 | receives         | waiting,    | notification       | Fail                      |
| NOTIF-05  |                 | notification     | staff       | delivered          | Pending                   |
|           |                 | when number      | auth to     | through            |                           |
|           |                 | is called        | call        | channel            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Prevent          | One         | System does        | Success                   |
|           |                 | duplicate        | booking     | not send           | Fail                      |
| NOTIF-06  |                 | notifications    | or update   | unintended         | Pending                   |
|           |                 | same event       | trigger     | duplicate          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Handle           | Valid       | Handles            | Success                   |
|           |                 | delivery         | event,      | failure            | Fail                      |
| NOTIF-07  |                 | failure          | unavail-    | appropriately,     | Pending                   |
|           |                 |                  | able        | records/retries    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Validate         | Template    | Contains           | Success                   |
|           |                 | content          | with        | correct            | Fail                      |
| NOTIF-08  |                 |                  | details     | values, no         | Pending                   |
|           |                 |                  |             | missing fields     |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Staff            | Auth        | Delivers           | Success                   |
|           |                 | receives         | staff,      | notification       | Fail                      |
| NOTIF-09  |                 | relevant         | relevant    | without            | Pending                   |
|           |                 | notifications    | event       | exposing           |                           |
|           |                 |                  |             | other info         |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Patient views    | Auth        | Patient views      | Success                   |
|           |                 | notifications    | patient,    | own notifs,        | Fail                      |
| NOTIF-10  |                 |                  | existing    | info matches       | Pending                   |
|           |                 |                  | notifs      | activity           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Mark             | Existing    | Read status        | Success                   |
|           |                 | notification     | unread      | changes, no        | Fail                      |
| NOTIF-11  |                 | as read          | notif       | unrelated          | Pending                   |
|           |                 |                  |             | changes            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |

<br>

### DATA INTEGRITY & DATABASE MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | System saves     | Valid       | Records saved      | Success                   |
|           |                 | patient and      | patient     | correctly,         | Fail                      |
| DATA-01   |                 | appt records     | info,       | retrievable        | Pending                   |
|           |                 | to DB            | details     | from DB            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Updates DB       | Existing    | Status updated     | Success                   |
|           |                 | records after    | appt with   | to Cancelled,      | Fail                      |
| DATA-02   |                 | cancellation     | active      | reflected in       | Pending                   |
|           |                 |                  | status      | DB                 |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Updates DB       | Existing    | Details saved      | Success                   |
|           |                 | after            | appt,       | correctly, no      | Fail                      |
| DATA-03   |                 | rescheduling     | valid new   | duplicates         | Pending                   |
|           |                 |                  | schedule    |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Maintains        | Patient     | Queue entry        | Success                   |
|           |                 | consistency      | with        | associated         | Fail                      |
| DATA-04   |                 | appts & queue    | confirmed   | with patient       | Pending                   |
|           |                 |                  | appt        | & record           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Validates        | Missing     | Invalid data       | Success                   |
|           |                 | data before      | fields,     | rejected by        | Fail                      |
| DATA-05   |                 | saving           | bad         | logic              | Pending                   |
|           |                 |                  | format      |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Prevents         | Existing    | Prevents           | Success                   |
|           |                 | duplicate        | patient     | unintended         | Fail                      |
| DATA-06   |                 | patient          | records     | duplication        | Pending                   |
|           |                 | records          |             |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Preserves        | Existing    | Avoids partial     | Success                   |
|           |                 | data on          | record,     | changes,           | Fail                      |
| DATA-07   |                 | failure          | simulated   | preserves          | Pending                   |
|           |                 |                  | failure     | consistency        |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Handles DB       | Simulated   | Handles            | Success                   |
|           |                 | connection       | unavail-    | gracefully,        | Fail                      |
| DATA-08   |                 | failure          | able DB     | displays error,    | Pending                   |
|           |                 |                  |             | no false success   |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Retrieves        | Existing    | Retrieves          | Success                   |
|           |                 | latest data      | record      | latest values,     | Fail                      |
| DATA-09   |                 |                  | created/    | not outdated       | Pending                   |
|           |                 |                  | updated     | info               |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Prevents         | Patient     | Modifications      | Success                   |
|           |                 | unauthorized     | attempting  | rejected,          | Fail                      |
| DATA-10   |                 | modifications    | to modify   | original data      | Pending                   |
|           |                 |                  | records     | unchanged          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Maintains        | Two         | Concurrency        | Success                   |
|           |                 | consistency      | requests    | rules applied,     | Fail                      |
| DATA-11   |                 | simultaneous     | modifying   | prevents           | Pending                   |
|           |                 | updates          | same rec    | conflict           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Preserves        | Patient     | Records            | Success                   |
|           |                 | records when     | with        | consistent,        | Fail                      |
| DATA-12   |                 | related          | appts,      | history retained   | Pending                   |
|           |                 | cancelled        | history     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |

<br>

### USER & ADMINISTRATIVE MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Admin views      | Auth        | Admin views        | Success                   |
|           |                 | registered       | admin,      | list of users      | Fail                      |
| ADMIN-01  |                 | user accounts    | existing    | and info           | Pending                   |
|           |                 |                  | records     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Admin assigns    | Existing    | Role updated,      | Success                   |
|           |                 | or updates       | user,       | permissions        | Fail                      |
| ADMIN-02  |                 | user's role      | valid       | reflect role       | Pending                   |
|           |                 |                  | role        |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Admin            | Active      | Account            | Success                   |
|           |                 | deactivates      | user,       | deactivated,       | Fail                      |
| ADMIN-03  |                 | user account     | auth        | cannot access      | Pending                   |
|           |                 |                  | admin       | protected feats    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Admin            | Deactiv-    | Account            | Success                   |
|           |                 | reactivates      | ated user,  | reactivated,       | Fail                      |
| ADMIN-04  |                 | user account     | auth        | access restored    | Pending                   |
|           |                 |                  | admin       | per rules          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Prevents         | Auth        | Action             | Success                   |
|           |                 | unauthorized     | patient/    | rejected,          | Fail                      |
| ADMIN-05  |                 | admin actions    | staff,      | records            | Pending                   |
|           |                 |                  | admin       | unchanged          |                           |
|           |                 |                  | action      |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Admin updates    | Auth        | Settings saved     | Success                   |
|           |                 | clinic config    | admin,      | and applied        | Fail                      |
| ADMIN-06  |                 | settings         | valid       | to functions       | Pending                   |
|           |                 |                  | config      |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Unit            | Validates        | Missing,    | Invalid values     | Success                   |
|           |                 | admin config     | invalid,    | rejected,          | Fail                      |
| ADMIN-07  |                 | inputs           | out of      | feedback           | Pending                   |
|           |                 |                  | range       | provided           |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Admin            | Existing    | Displays           | Success                   |
|           |                 | searches for     | user,       | matching account   | Fail                      |
| ADMIN-08  |                 | user account     | search      | or message if      | Pending                   |
|           |                 |                  | term        | none match         |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |

<br>

### DASHBOARD & REPORTING MANAGEMENT

| Test ID   | Testing level   | Test scenario    | Test data   | Expected Result    | Status                    |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Clinic staff     | Auth        | Dashboard loads    | Success                   |
|           |                 | views            | staff,      | successfully,      | Fail                      |
| DASH-01   |                 | dashboard        | existing    | shows info         | Pending                   |
|           |                 |                  | records     | per scope          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Dashboard        | Known       | Count matches      | Success                   |
|           |                 | shows correct    | set of      | underlying         | Fail                      |
| DASH-02   |                 | appt count       | appts       | records/rules      | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Dashboard        | Known       | Active count       | Success                   |
|           |                 | shows correct    | set of      | matches rules      | Fail                      |
| DASH-03   |                 | active queue     | queue       |                    | Pending                   |
|           |                 | count            | entries     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Dashboard        | Appt        | Dashboard          | Success                   |
|           |                 | reflects appt    | booked,     | reflects change    | Fail                      |
| DASH-04   |                 | updates          | cancel/     | per behavior       | Pending                   |
|           |                 |                  | resched     |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Dashboard        | Queue       | Summaries/         | Success                   |
|           |                 | reflects         | entries     | counts reflect     | Fail                      |
| DASH-05   |                 | queue updates    | in states   | current status     | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Admin views      | Auth        | Dashboard shows    | Success                   |
|           |                 | clinic stats     | admin,      | stats for          | Fail                      |
| DASH-06   |                 |                  | period      | selected period    | Pending                   |
|           |                 |                  | records     | and scope          |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Filters data     | Appt and    | Only records       | Success                   |
|           |                 | by date range    | queue       | matching range     | Fail                      |
| DASH-07   |                 |                  | records     | included           | Pending                   |
|           |                 |                  | over time   |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Generates        | Existing    | Report contains    | Success                   |
|           |                 | report           | records,    | accurate data      | Fail                      |
| DASH-08   |                 |                  | type        | and totals         | Pending                   |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | E2E             | Authorized       | Auth        | Report exported    | Success                   |
|           |                 | user exports     | account,    | in supported       | Fail                      |
| DASH-09   |                 | report           | report,     | format, data       | Pending                   |
|           |                 |                  | format      | matches            |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
|           | Integration     | Restricts        | Patient,    | Each user only     | Success                   |
|           |                 | data by role     | staff,      | accesses           | Fail                      |
| DASH-10   |                 |                  | admin       | permitted data     | Pending                   |
|           |                 |                  | accounts    |                    |                           |
| --------- | --------------- | ---------------- | ----------- | ------------------ | ------------------------- |
```