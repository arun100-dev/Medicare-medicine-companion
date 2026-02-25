# MediCare — Medicine Companion

A web app that helps elderly patients manage their medicines safely, with a caregiver system built on top so that a family member or nurse can oversee and control what gets added or changed.

I built this because medicine management for elderly people is genuinely hard — they forget doses, run out of pills without realizing it, and sometimes take the wrong thing at the wrong time. This app tries to solve that in a simple, accessible way.

---

## What it does

**For patients:**
- See today's medicine schedule on the dashboard, grouped by morning / afternoon / night
- Mark doses as taken with one tap
- Get browser notifications when it's time to take something
- View a weekly adherence report showing how consistently they've been taking medicines
- Ask an AI assistant for general medicine scheduling advice

**For caregivers:**
- Register once and get a unique 6-character code (like `A3F9B2`)
- Share that code with patients — they enter it when signing up to link accounts
- View all linked patients from the "My Patients" screen
- Click into any patient to see their medicine list and their weekly report side by side
- Add, edit, or delete medicines for a patient — but only after entering a PIN

---

## How the PIN system works

This was the trickiest part to get right. Here's the full flow:

1. When a caregiver registers, they set a 4-digit PIN
2. That PIN is hashed with bcrypt before being stored — it's never saved as plain text
3. When anyone tries to edit a patient's medicines (caregiver OR the patient themselves), the app asks for the caregiver's PIN
4. The server issues a short-lived JWT token (5 minutes) once the PIN is verified
5. That token is scoped to a specific patient — so verifying for Patient A doesn't unlock Patient B
6. After 5 minutes, the session expires and the PIN has to be entered again

The key thing: it's always the **caregiver's PIN** that's checked. Not the patient's own password, not any random PIN. This prevents patients from accidentally (or intentionally) changing their own medicine setup without the caregiver knowing.

---

## Tech stack

- **Frontend:** React 18, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** MongoDB with Mongoose
- **Auth:** JWT for sessions, bcryptjs for password and PIN hashing
- **Background jobs:** node-cron (checks for missed doses every minute, refill alerts daily)
- **AI:** Groq API (llama-3.1-8b-instant) with a rule-based fallback if no API key is set

---

## Getting started

You'll need Node.js 18+ and a MongoDB database (local or Atlas).

**1. Clone and set up environment**

```bash
git clone <your-repo-url>
cd medicine-companion
cp .env.example .env
```

Edit `.env` and fill in:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=pick_a_long_random_string
GROQ_API_KEY=your_groq_key_if_you_have_one
```

The GROQ key is optional — without it, the AI assistant uses a built-in rule-based engine that handles common conditions like blood pressure, diabetes, cholesterol, etc.

**2. Install dependencies**

```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

**3. (Optional) Load demo data**

```bash
cd server && npm run seed
```

This creates:
- Patient account: `demo@medicine.com` / `demo1234`
- Caregiver account: `caregiver@medicine.com` / `care1234`
- Caregiver PIN: `1234`
- A few sample medicines with 7 days of dose history

**4. Run in development**

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

---

## Project structure

```
medicine-companion/
├── server/
│   ├── controllers/        # Business logic (auth, medicines)
│   ├── routes/             # Route definitions — thin, just maps URLs to controllers
│   ├── models/             # Mongoose schemas (User, Medicine, DoseLog, Notification)
│   ├── middleware/         # JWT auth middleware
│   └── utils/
│       ├── scheduler.js    # Cron jobs for missed dose detection and refill alerts
│       └── seed.js         # Demo data
│
└── client/
    └── src/
        ├── pages/
        │   ├── DashboardPage.jsx          # Today's schedule + caregiver info banner
        │   ├── MedicinesPage.jsx          # Patient's own medicine list
        │   ├── CaregiverDashboardPage.jsx # My Patients list + per-patient medicines & report
        │   ├── WeeklySummaryPage.jsx      # Patient's own weekly adherence report
        │   ├── AIAssistantPage.jsx        # AI schedule generator
        │   └── LoginPage.jsx              # Login + registration (role-based fields)
        ├── components/
        │   ├── Layout.jsx                 # Sidebar navigation (role-aware)
        │   └── CaregiverPINModal.jsx      # PIN entry modal
        └── context/
            └── AuthContext.jsx            # Auth state, PIN verification, caregiver session
```

---

## Registration flow

**Caregiver signs up first:**
1. Goes to Register → selects "Caregiver"
2. Sets name, email, password, and a 4-digit PIN
3. Gets a 6-character code shown on their dashboard (e.g. `A3F9B2`)
4. Shares that code with the patient they're managing

**Patient signs up second:**
1. Goes to Register → selects "Patient"  
2. Fills in name, email, password
3. Enters the caregiver's 6-character code — this is **required**, not optional
4. Their account is immediately linked to that caregiver

---

## A few things to know

- The caregiver code system is intentionally simple. In a real production app you'd probably want something more like an invite-link flow, but for this use case (one caregiver managing 1–3 family members) it works well.

- Timezone handling is done by passing the browser's `timezoneOffset` to the server and adjusting scheduled times accordingly. It's not perfect for all edge cases but works for the common case.

- The missed dose cron job runs every minute and marks any dose that's more than 30 minutes past its scheduled time as missed. It also deduplicates notifications so you don't get spammed.

- If you're running this locally and port 5000 is taken, change `PORT` in your `.env` and update the proxy target in `client/vite.config.js` to match.

---

## License

MIT
