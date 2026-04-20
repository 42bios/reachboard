# Reachboard

Reachboard is a small Microsoft 365 reception wallboard built with Next.js.

I created it in my free time as a quick solution for the reception desk of my employer, so the team could get a fast overview of who is reachable, who is away, and who is likely to be available again soon.

## What it does

- shows a compact wallboard of employees and their current reachability
- combines Microsoft 365 presence, calendar, and absence signals
- supports search, manual ordering, and hidden cards for kiosk use
- refreshes automatically for near-live updates
- protects access through Microsoft sign-in and group-based authorization

## Tech stack

- Next.js 14
- React 18
- Microsoft Graph
- Tailwind CSS
- Docker

## Getting started

1. Copy `.env.example` to `.env`.
2. Fill in your Microsoft Graph and access-control values.
3. Install dependencies and start the dev server.

```bash
npm install
npm run dev
```

The app runs on port `3010` by default.

## Environment variables

The main settings are:

- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `MS_GRAPH_TENANT_ID`
- `RECEPTION_GROUP_NAME`
- `RECEPTION_ALLOWED_GROUPS`
- `RECEPTION_SESSION_SECRET`
- `RECEPTION_BOARD_TITLE`
- `RECEPTION_BOARD_DESCRIPTION`
- `RECEPTION_AUTO_REFRESH_SECONDS`

## Production

The repository includes a Dockerfile and a host-level Compose file for a dedicated deployment target.

```bash
docker compose --env-file .env.production -f docker-compose.host.yml up -d --build
```

For public repositories, do not commit real `.env` files or tenant secrets.

## License

This project is released under the MIT License. See `LICENSE`.

## Third-party software

The current direct dependencies are permissive:

- `next` (`MIT`)
- `react` (`MIT`)
- `react-dom` (`MIT`)
- `jose` (`MIT`)
- `lucide-react` (`ISC`)
- `tailwindcss` (`MIT`)
- `postcss` (`MIT`)
- `autoprefixer` (`MIT`)
- `typescript` (`Apache-2.0`)

That makes an MIT license for this repository a reasonable fit, while the third-party packages naturally keep their own original licenses.
