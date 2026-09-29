# Quizz

A Kahoot clone on Cloudflare: Workers + Durable Objects (via [PartyServer](https://github.com/cloudflare/partykit)) + D1, with a React + Fluent UI v9 front end.

The interface is available in English and French, picked from the browser language (English by default).

## Architecture

```
src/
  worker/
    index.ts       Worker entry point: /parties/* → Durable Object, /api/* → Hono
    api.ts         REST API (question sets, games) backed by D1
    auth.ts        Cloudflare Access JWT verification
    quiz-room.ts   QuizRoom Durable Object: one instance per game (state, timer, scores)
  shared/          Types, validation and error codes shared by front and back (WebSocket protocol)
  app/             React SPA
    i18n/          Translations (en, fr) and i18next setup
    pages/Home     Player home (PIN + name, ?pin= pre-filled by the QR code)
    pages/Play     Player controller
    pages/Host     Presentation view (big screen, QR code, timer, stats, leaderboard)
    pages/admin/   Admin panel: question sets, editor, games, results
migrations/        D1 schema
```

- **D1** stores question sets (as JSON) and the history of games and results.
- **QuizRoom** (SQLite-backed Durable Object, hibernation enabled) holds the game state. Questions are copied into it when the game is created, so editing a set doesn't affect a running game. The timer uses an `alarm`: nothing is billed while no messages arrive.
- Players have a stable id (localStorage), so a refresh or a network drop reconnects them with their score.
- The admin is protected by **Cloudflare Access** (see below).

Game flow: `lobby → question → reveal → leaderboard → question … → ended`.
The reveal happens when the timer runs out, or as soon as every connected player has answered.

**Modes** (chosen per question set, frozen when the game is created):
- **Competitive**: from 1000 points (instant answer) down to 500 (last second), streaks, leaderboard between questions, podium.
- **Informative**: no score and no leaderboard (`reveal → next question`). A question without a correct answer becomes a poll: only the answer distribution is shown.

**Unlimited timer** ("Unlimited" in the editor): no deadline, the host reveals whenever they want. In competitive mode a correct answer is then worth 1000 points, with no speed bonus.

**CSV export** of answers (Games tab, or a button on the presentation's final screen): one row per person and, for each question, the chosen answer, whether it was correct, the points (competitive mode) and the response time. Headers follow the UI language, and the separator and decimal mark follow what Excel expects for that locale (`,` and `.` in English, `;` and `,` in French). UTF-8 with BOM.

## Internationalization

- [i18next](https://www.i18next.com/) + `react-i18next`, with language detection from `navigator.languages`: French for `fr-*`, English for everything else. The choice isn't persisted, so it always follows the browser.
- Translations live in `src/app/i18n/en.ts` (source of truth) and `fr.ts`, typed as `Translation`: a missing key in `fr.ts`, or a `t()` call with an unknown key, fails type checking.
- The server never sends user-facing text: API responses and WebSocket messages carry an error code (`src/shared/errors.ts`) plus optional params, e.g. `{ "error": "correct_required", "params": { "question": 2 } }`. The client translates them under `errors.*`.
- To add a language: create `src/app/i18n/<lang>.ts` typed as `Translation`, then register it in `resources` and `supportedLngs` in `src/app/i18n/index.ts`.

## Development

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local   # creates the D1 tables locally
npm run dev                # http://localhost:5173
```

There is no Cloudflare Access locally: `DEV_AUTH_BYPASS=true` in `.dev.vars` opens the admin (identity `dev@localhost`).

- Admin: `/admin`
- Players: `/`
- Presentation: "Start" button in the admin (opens `/host/:code`)

Presentation shortcuts: `Space`, `Enter` or `→` to move to the next step.

To test on a phone on the same network: `npm run dev -- --host`, then open `http://<your-machine-ip>:5173`.

## Authentication: Cloudflare Access

| Route | Protection |
| --- | --- |
| `/admin*`, `/host/*`, `/api/admin/*` | Access at the edge **and** JWT verification in the Worker |
| `/parties/*` (WebSocket) | Public for players. The `host` role is only granted if the `CF_Authorization` cookie carries a valid JWT |
| `/`, `/play/*`, `/api/games/:code` | Public |

The Worker always re-verifies the JWT (signature, `iss`, `aud`, expiry) against the team's public keys (`/cdn-cgi/access/certs`), so a misconfigured Access app is not enough to open the API. For the WebSocket, the Worker sets an internal `x-quizz-admin` header after verification and always strips the one sent by the client.

If the Access variables are missing and `DEV_AUTH_BYPASS` is not set, all admin access is denied.

### Setup

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Domain: your custom domain (e.g. `quizz.example.com`). Add three paths: `admin`, `host`, `api/admin`.
   Access can't protect `*.workers.dev` domains by path: use a custom domain.
3. Policy: *Allow*, e.g. with *Emails* = your address or *Emails ending in* = your domain.
4. Grab the **Application Audience (AUD) Tag** (the application's Overview tab) and your **team domain** (Settings → Custom Pages, `https://<team>.cloudflareaccess.com`).
5. Set them in `wrangler.jsonc` (`vars.ACCESS_TEAM_DOMAIN` and `vars.ACCESS_AUD`). They are not secrets.

Log out: `/cdn-cgi/access/logout` (button in the admin).

## Deployment

```sh
npx wrangler d1 create quizz-db          # copy the id into wrangler.jsonc
npm run db:migrate:remote
# set ACCESS_TEAM_DOMAIN / ACCESS_AUD in wrangler.jsonc, and the custom domain (routes)
npm run deploy
```

After any change to `wrangler.jsonc`, run `npm run cf-typegen`.

## Costs

Normal usage fits in the Workers free plan: SQLite-backed Durable Objects, D1 (5 GB) and static assets are free. Thanks to WebSocket hibernation, an idle lobby doesn't consume Durable Object compute time.
