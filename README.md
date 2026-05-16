# Case 2: Pocket — A Roommate Expense Splitter

**Repo:** <https://github.com/Dakshesh1234/case2-Pocket>

## What this is

Pocket is a lightweight expense splitter for roommates and small groups — log who paid for what, split it however you want, and see the minimum number of transfers needed to settle up. It's for flatmates, trip groups, and couples who don't want to argue over a spreadsheet.

## How to run locally

You'll need **Node 18+** and a Postgres database (local or hosted, e.g. Neon/Supabase).

```bash
git clone https://github.com/Dakshesh1234/case2-Pocket.git
cd case2-Pocket
```

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL + JWT_SECRET
npm run seed           # optional: creates a DEMO01 group with sample data
npm run dev            # runs on http://localhost:3002
```

`.env` should contain:

```
DATABASE_URL=postgres://user:pass@host:5432/pocket
JWT_SECRET=some-long-random-string
PORT=3002
```

**2. Frontend**

```bash
cd ../frontend
npm install
npm run dev            # runs on http://localhost:5173
```

Open <http://localhost:5173>. Register an account, or log in with the seeded demo user and use invite code `DEMO01` to join the sample group.

## Stack

- **React 18 + Vite** — fast dev loop, zero-config JSX, instant HMR.
- **Tailwind CSS** — kept the UI consistent without a component library; design tokens live in `index.css`.
- **React Router v6** — small, file-free routing for a 6-screen app.
- **Express 4** — minimal HTTP layer; the interesting logic is in `utils/balances.js`, not in middleware.
- **PostgreSQL (`pg`)** — relational integrity matters here: expenses → splits → settlements → audit log all reference each other, and the netting math is a join, not a document lookup.
- **JWT + bcrypt** — stateless auth, no session store needed for a take-home.
- **Axios** — single shared instance with `/api` base URL so the frontend doesn't care about backend host in dev/prod.

## What's NOT done

- **No real money movement.** "Settle up" records the intent; it doesn't talk to Stripe/UPI/Venmo.
- **No real-time push.** Notifications are polled every 30s instead of using WebSockets/SSE. Good enough for a roommate app, not for a chat app.
- **Only equal splits in the seed flow + custom-amount splits.** Percentage splits and "by share" splits aren't exposed in the UI (the data model supports them — `expense_splits.amount` is already arbitrary).
- **No multi-currency / FX.** Everything is `DECIMAL(10,2)` and currency-agnostic at the symbol level.
- **No invite-by-email.** Only invite-code/link sharing.
- **No receipt OCR / photo upload.** A `category` column is the only metadata.
- **Test coverage is light.** The netting algorithm has been spot-checked manually but doesn't have automated tests.
- **No rate limiting / abuse protection** on the auth + invite endpoints.

## In production, I would also add

- Real-time updates via WebSockets (or Server-Sent Events) so balances refresh the moment a flatmate adds an expense.
- Mutual confirmation on settlements ("X says they paid you — confirm?") instead of trusting either side unilaterally, plus a dispute/reopen flow.
- Email + push notifications (web push / FCM) for expense added, settlement, and weekly digest.
- Audit-log driven undo: any destructive action (delete expense, settle) reversible for ~30s, fully derived from the audit log.
- Rate limiting (`express-rate-limit`), structured logging (pino), error tracking (Sentry), and a `/healthz` that actually checks the DB.
- Proper integration tests covering the balance/netting math against hand-computed fixtures, plus a property-based test that random-generated expense sets always net to zero.
