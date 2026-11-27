# Notifications Setup Guide: Brevo SMTP & SMS API PH

This guide walks you through setting up **Email (Brevo SMTP)** and **SMS (SMS API PH)** notifications for **ClinicQueue** locally and in production (Render).

> **How notifications behave by default:**
> - **In-App notifications** always work automatically (stored in PostgreSQL and pushed live to the Patient Portal via SSE).
> - **Email** and **SMS** are **non-blocking**: if their credentials are missing or an external provider fails, ClinicQueue logs a warning and continues working normally without breaking bookings or queue actions.

---

## 1. Where to Add Environment Variables

* **Local Development:** Add variables to either the repository root `.env` or `apps/api/.env` (the backend loads both). Never commit `.env` files to Git.
* **Production (Render):** Open **Render Dashboard → `clinicqueue-api` → Environment** and add the same key/value pairs, then save to trigger a restart.
* **Vercel:** Do **not** add SMTP or SMS keys to Vercel—Vercel only hosts the Angular frontend, and secrets must stay on the backend.

---

## 2. Brevo SMTP Setup (Email Notifications)

### Step 1: Create or Log In to Brevo
1. Go to [brevo.com](https://www.brevo.com) and sign in (the free tier allows 300 emails/day).

### Step 2: Verify Your Sender Email Address
Brevo will reject or fail to deliver emails if `SMTP_FROM_EMAIL` is not a verified sender.
1. In the Brevo dashboard, click your profile/organization menu (top-right) → **Senders, Domains & Dedicated IPs**.
2. Open the **Senders** tab and click **Add a sender**.
3. Enter:
   * **From Name:** `DLSU-D ClinicQueue`
   * **From Email:** an email inbox you can access (e.g., your project Gmail or institutional email).
4. Open the verification email sent to that address and click the confirmation link.

### Step 3: Get Your SMTP Login & Generate an SMTP Key
1. Click your profile menu (top-right) → **SMTP & API**.
2. Stay on the **SMTP** tab. Note the **SMTP Settings** displayed on the page:
   * **SMTP Server:** `smtp-relay.brevo.com`
   * **Port:** `587`
   * **Login:** copy the exact **Login** shown on that page (e.g. `8a1b2c001@smtp-brevo.com` or your Brevo account email).
3. Click **Generate a new SMTP key**, name it `ClinicQueue`, and **copy the key immediately** (Brevo only shows it once).

### Step 4: Add Brevo Variables to `.env` / Render
```env
SMTP_ENABLED=true
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="<your-brevo-smtp-login>"
SMTP_PASS="<your-generated-brevo-smtp-key>"
SMTP_FROM_EMAIL="<your-verified-sender-email>"
SMTP_FROM_NAME="DLSU-D ClinicQueue"
```

| Variable | Required | Default | Notes |
| :--- | :--- | :--- | :--- |
| `SMTP_ENABLED` | No | Auto (`true` if credentials exist) | Set `false` to temporarily mute all emails without deleting credentials. |
| `SMTP_HOST` | Yes | — | `smtp-relay.brevo.com` for Brevo. |
| `SMTP_PORT` | No | `587` | Uses STARTTLS on `587`, or SSL if set to `465`. |
| `SMTP_USER` | Yes | — | The **Login** shown in Brevo's SMTP tab. |
| `SMTP_PASS` | Yes | — | The generated **SMTP Key** (not your Brevo account password). |
| `SMTP_FROM_EMAIL` | No | Falls back to `SMTP_USER` | Must match a verified sender in Brevo. |
| `SMTP_FROM_NAME` | No | `DLSU-D ClinicQueue` | Display name shown in recipients' inboxes. |

---

## 3. SMS API PH Setup (Optional SMS Notifications)

ClinicQueue integrates with **SMS API PH** (`https://smsapiph.netlify.app/documentation#quickstart`), which sends `POST` requests to `https://smsapiph.onrender.com/api/v1/send/sms` with an `x-api-key` header.

### Step 1: Create an Account & Generate an API Key
1. Visit `https://smsapiph.netlify.app/register` and sign up for a free account.
2. Sign in to the dashboard and create a new **API Key** (format: `sk-...`).

### Step 2: Add SMS Variables to `.env` / Render
```env
SMS_ENABLED=true
SMS_API_URL="https://smsapiph.onrender.com/api/v1/send/sms"
SMS_API_KEY="sk-your-api-key-here"
```

To disable SMS while keeping Email & In-App active, set:
```env
SMS_ENABLED=false
```

### Important SMS Behavior & Limits
* **Philippine Mobile Numbers Only:** Input numbers like `09171234567` are automatically normalized to `+639171234567`. Placeholder (`+639000000000`) or invalid numbers are skipped automatically.
* **160-Character Limit:** SMS API PH enforces a 160-character limit per message. ClinicQueue automatically formats and truncates SMS text to `<= 160` characters.
* **6 SMS / Minute Rate Limit:** To avoid exhausting the free tier limit, ClinicQueue only sends SMS to **patients** (including walk-in tickets with a phone number), not to staff accounts on booking cancellations/reschedules.
* **5-Second Timeout:** Requests time out after 5 seconds so Render free-tier cold starts on `smsapiph.onrender.com` never slow down the ClinicQueue API.

---

## 4. Which Events Trigger Notifications?

| Event | In-App | Email (Brevo) | SMS (Patients Only) |
| :--- | :--- | :--- | :--- |
| Appointment Booked (`BOOKING_CONFIRMATION`) | Patient | Patient | Patient |
| Appointment Cancelled (`BOOKING_CANCELLATION`) | Patient + Staff | Patient + Staff | Patient |
| Appointment Rescheduled / Slot Blocked (`BOOKING_RESCHEDULE`) | Patient + Staff | Patient + Staff | Patient |
| Ticket Called / Recalled (`QUEUE_CALL`) | Patient | Patient | Patient (including Walk-In) |
| Next 2 in Line (`APPROACHING_TURN`) | Patient | Patient | Patient (including Walk-In) |
| Queue Status Changed / No-Show (`QUEUE_STATUS_UPDATE`) | Patient | Patient | Patient (including Walk-In) |

---

## 5. Testing & Verification

### 1. Check Startup Logs
Run the project with:
```bash
npm run dev
```
* **If Brevo is NOT configured:** you will see a warning:
  `[EmailChannelService] Email notifications disabled — missing SMTP_HOST, SMTP_USER, SMTP_PASS, or SMTP_FROM_EMAIL.`
* **If SMS is NOT enabled:** you will see:
  `[SmsChannelService] SMS notifications disabled (set SMS_ENABLED=true and SMS_API_KEY to enable).`
* When configured properly, those disabled messages will **not** appear.

### 2. Trigger a Real Test
1. Register or sign in with a patient account that uses a real email you can check and a real PH mobile number (e.g., `0917...`).
2. Book an appointment on `/patient/schedule` (or create a walk-in ticket on `/staff/walk-in` and click **Call Next**).
3. Verify:
   * **In-App:** Bell icon badge updates immediately in the Patient Portal.
   * **Email:** Confirmation email (`[ClinicQueue] Booking confirmed`) arrives in your inbox (check Spam/Promotions on the first test).
   * **SMS:** Text arrives on the PH mobile number (if `SMS_ENABLED=true`).

---

## 6. Troubleshooting

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| `535 5.7.8 Authentication failed` in API logs | `SMTP_PASS` is your Brevo account password instead of an SMTP key, or `SMTP_USER` doesn't match Brevo's SMTP Login. | Copy the exact **Login** and generate a fresh **SMTP Key** from **Brevo → SMTP & API → SMTP**. |
| Email sends without error in logs, but never arrives | `SMTP_FROM_EMAIL` is not verified in Brevo, or email landed in Spam. | Verify the sender under **Brevo → Senders, Domains & Dedicated IPs → Senders**. |
| `SMS API PH returned HTTP 401` | Invalid or missing `SMS_API_KEY`. | Re-copy the `sk-...` key from `smsapiph.netlify.app` dashboard and restart `npm run dev`. |
| `SMS API PH returned HTTP 429` | Exceeded 6 SMS/minute free rate limit. | Wait 1 minute or temporarily set `SMS_ENABLED=false` during heavy testing. |
| `SMS delivery failed ... timeout` | Free `smsapiph.onrender.com` instance is sleeping or unreachable. | Expected non-blocking behavior; Email and In-App notifications still deliver normally. |
