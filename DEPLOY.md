# Deploying MediCare to Vercel

The app is split into two parts — a React frontend and a Node/Express backend. Vercel can host both, but they need to be deployed as **two separate projects**. This guide walks through the whole process step by step.

---

## Before you start

You need:
- A [Vercel account](https://vercel.com) (free tier is fine)
- A [MongoDB Atlas](https://cloud.mongodb.com) account (free M0 cluster is fine)
- Your code pushed to a GitHub repository

If you don't have a GitHub repo yet:
```bash
git init
git add .
git commit -m "initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/your-username/medicine-companion.git
git push -u origin main
```

---

## Step 1 — Set up MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign in
2. Create a new project, then click **Build a Database** → choose the free **M0** tier
3. Pick any cloud region close to you
4. Create a database user — save the username and password somewhere
5. Under **Network Access**, click **Add IP Address** → choose **Allow Access from Anywhere** (`0.0.0.0/0`)
   - This is required for Vercel to connect since Vercel doesn't have fixed IPs
6. Go back to your cluster → click **Connect** → **Connect your application**
7. Copy the connection string. It looks like:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
8. Replace `<password>` with your actual password, and add your database name:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.abc123.mongodb.net/medicine-companion?retryWrites=true&w=majority
   ```
   Save this — you'll need it in Step 2.

---

## Step 2 — Deploy the Backend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will detect the project. You need to change the **Root Directory**:
   - Click **Edit** next to Root Directory
   - Type `server` and confirm
4. Framework preset should be **Other** (not Next.js or Vite)
5. Leave Build Command and Output Directory blank
6. Click **Environment Variables** and add these:

   | Name | Value |
   |------|-------|
   | `MONGODB_URI` | your Atlas connection string from Step 1 |
   | `JWT_SECRET` | any long random string, e.g. `x7k2m9p4q8r1s5t6u3v0w` |
   | `NODE_ENV` | `production` |
   | `GROQ_API_KEY` | your Groq key (optional — get one free at console.groq.com) |

   Leave `CLIENT_URL` blank for now — you'll add it after the frontend is deployed.

7. Click **Deploy**
8. Once deployed, copy your backend URL — it'll look like `https://medicine-companion-server.vercel.app`
9. Go back to the backend project → **Settings** → **Environment Variables**
10. Add one more variable:

    | Name | Value |
    |------|-------|
    | `CLIENT_URL` | your frontend URL (you'll get this in Step 3 — come back and add it after) |

    Then go to **Deployments** → click the three dots on your latest deployment → **Redeploy** after adding it.

---

## Step 3 — Deploy the Frontend

1. Go to [vercel.com/new](https://vercel.com/new) again
2. Import the same GitHub repository
3. Change the **Root Directory** to `client`
4. Vercel should detect **Vite** automatically
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | your backend Vercel URL from Step 2, e.g. `https://medicine-companion-server.vercel.app` |

   **Important:** No trailing slash at the end of the URL.

8. Click **Deploy**
9. Once deployed, copy your frontend URL (e.g. `https://medicine-companion.vercel.app`)
10. Go back to **Step 2, point 10** — add this URL as `CLIENT_URL` on the backend and redeploy

---

## Step 4 — Test everything

1. Visit your frontend URL
2. Register a caregiver account
3. Note the caregiver code shown on the My Patients page
4. Register a patient account using that code
5. Add a medicine and check the schedule appears on the dashboard

If something isn't working, check the **Vercel logs**:
- Go to your project on Vercel → **Deployments** → click the latest one → **Functions** tab
- You'll see real-time logs from every API call

---

## Common problems

**"CORS error" in the browser console**

The `CLIENT_URL` env var on the backend doesn't match your frontend URL exactly. Make sure it's `https://your-app.vercel.app` with no trailing slash. After changing it, redeploy the backend.

**"Cannot connect to database"**

- Double-check your Atlas connection string — the password can't contain `@` or `/` (URL encode special characters)
- Make sure you added `0.0.0.0/0` to the Atlas Network Access list
- Check the backend Vercel logs for the exact error

**Frontend shows blank page / 404 on refresh**

The `client/vercel.json` file handles this by rewriting all routes to `index.html`. Make sure that file is in your `client/` folder.

**API calls returning 404**

Make sure `VITE_API_URL` on the frontend points to the backend URL, not the frontend URL. Easy mistake to make.

**Cron jobs / missed dose notifications not working**

This is expected. Vercel's serverless platform doesn't support background cron jobs. The scheduler that detects missed doses runs in local development only. On Vercel, missed doses get detected when the app calls `/api/dose-logs/generate` on each page load — so it still works, just triggered by user activity rather than a timer.

If you need proper scheduled jobs in production, you can set up a free [Uptime Robot](https://uptimerobot.com) monitor that pings your `/api/health` endpoint every 5 minutes, then add logic to that endpoint to run the scheduler. Or use [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) if you're on a paid plan.

---

## Keeping the backend awake

Vercel serverless functions "sleep" after a period of inactivity and the first request after that takes a second or two to respond (cold start). For this kind of app that's usually fine.

If you want to avoid cold starts, set up [Uptime Robot](https://uptimerobot.com) with a free monitor that pings `https://your-backend.vercel.app/api/health` every 5 minutes. It's free and keeps the function warm.

---

## Making changes after deployment

Any time you push to your `main` branch on GitHub, Vercel automatically redeploys both projects. No manual steps needed.

If you add new environment variables, you need to redeploy manually from the Vercel dashboard (push a commit or click Redeploy) for them to take effect.
