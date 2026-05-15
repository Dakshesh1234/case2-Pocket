# Decisions Log — Case 2

## Assumptions I made

1. **Trust between group members is high.** Roommates aren't adversarial — so a single click "I paid them" or "they paid me" both record a settlement, no two-sided confirmation. The audit log captures who recorded it for accountability.
2. **Groups are small (≤20 people).** All balance computation runs server-side on every read; for 20 members and a few hundred expenses this is sub-millisecond. No caching needed.
3. **One currency per group.** Multi-currency adds FX rates, historical conversion, and reconciliation ambiguity that's out of scope.
4. **Notifications are "nice to have," not transactional.** Polling every 30s is fine; a missed notification doesn't corrupt state because balances are always recomputed from source-of-truth tables.
5. **Equal-split is the 80% case.** The UI defaults to equal split among selected members; the schema (`expense_splits.amount`) still supports arbitrary per-user amounts.
6. **No offline mode.** This is a connected app — every action is a network round trip and the UI shows optimistic updates only where the failure mode is cosmetic (e.g. mark-as-read).
7. **Invite codes don't need to be cryptographic.** A 6-char alphanumeric code is fine because invites are short-lived and joining still requires an account.

## Trade-offs

| Choice | Alternative | Why I picked this |
|---|---|---|
| Postgres | MongoDB | Need relational integrity for the netting logic — expenses, splits, settlements, and audit entries all reference each other, and the balance query is a join. |
| Compute balances on every request | Maintain a `balances` table | Source-of-truth lives in expenses + settlements; a derived table introduces drift bugs that are nasty to debug. Recompute is fast at this scale. |
| Greedy two-pointer for minimum transfers | Exact min-flow (NP-hard in general) | The greedy "biggest creditor pays biggest debtor" gives `n-1` transfers max and is optimal for nearly all realistic cases. The exact min-transactions problem is NP-hard and not worth the complexity. |
| JWT (stateless) | Server sessions + Redis | Take-home scope — no infra to add. Trade-off accepted: can't invalidate a token before expiry without a deny-list. |
| Either party can settle (this PR) | Only debtor can settle | Symmetric matches how people actually pay each other back ("I got the cash, let me mark it"). Backend now branches the notification copy based on who recorded it. |
| Notification polling every 30s | WebSockets / SSE | Avoids stateful connections, scales horizontally for free, fits the "low-frequency human events" use case. Switch to push when activity warrants it. |
| Tailwind utility-first | Component library (MUI/Chakra) | Bundle size + visual control. Took ~half a day longer but the UI feels custom, not generic. |
| Vite + plain JS | Next.js / SSR | This is a SPA behind auth — no SEO need, no per-page data fetching benefit. Vite's dev loop is faster. |
| Single shared `axios` instance with `baseURL: '/api'` | Per-call `fetch` | Lets dev proxy (`vite.config.js`) and prod (same-origin) work identically without env-var juggling. |
| `DECIMAL(10,2)` for money | Cents as integers | Tradeoff — integer cents avoids float pitfalls but every read/write would need conversion. Postgres `DECIMAL` is exact, and `parseFloat` happens only at the API boundary. |
| Audit log as append-only JSONB | Per-action event tables | One table, queried once for the activity tab. JSONB `details` is searchable enough; no need for five join tables. |

## What I de-scoped and why

- **Payment processor integration (Stripe/UPI/Venmo).** Off-scope for an expense tracker; "record a settlement" is the right primitive and integrations slot in later.
- **Mutual confirmation of settlements.** Added friction that real users skip. The audit trail + push notifications give enough recourse for the dispute case.
- **Percentage / share-based split UI.** Schema supports it (split amount is arbitrary), but the form would need significant UX work. Equal-split + custom-amount per person covers the common cases.
- **Multi-currency.** FX, historical rates, and currency mismatch in a single group are a separate product surface.
- **Receipt photos / OCR.** Cool but unrelated to the core "who owes whom" problem.
- **Admin panel / group ownership transfer.** Creator is implicitly owner; nobody can be kicked. Fine for v1.
- **Email/SMS invites.** Invite code + shareable URL was enough to demo; SMTP setup wasn't justified.
- **Automated tests.** Wrote the balance algorithm with hand-checked fixtures (in the seed file) but didn't add a Jest suite — would be the first thing I add tomorrow.

## What I'd do differently with another day

- **Write the balance/netting unit tests first** — a property-based test ("for any random set of expenses, sum of net balances ≈ 0 and minimized transfers settle them") would catch rounding bugs cleanly.
- **Move balance computation into a database view / materialized view** so the API route is a trivial `SELECT *` and any new client gets the same math.
- **Replace polling with a single SSE stream per group** for live updates of expenses, balances, and notifications — same protocol, no WebSocket complexity.
- **Add a server-side validation layer (zod/joi)** instead of the ad-hoc `if (!field) return 400` checks scattered through routes.
- **Settle-up flow improvement:** when "Settle all" is clicked, send one batched request instead of N sequential ones — atomic on the server, faster, and the audit log can group the entries.
- **Optimistic UI for expense add/delete** with rollback on error, so the list animates immediately rather than after a round trip.
- **Accessibility pass** — keyboard navigation in the notification dropdown and settle-up modal, focus traps, ARIA roles for the toast system. Right now it's "works" but not "great."
- **Deployable preview from a single command** — Dockerfile + a `docker-compose.yml` with Postgres so a judge can `docker compose up` and have it running in 30 seconds.
