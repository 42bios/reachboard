# Deployment Notes

## Goal

Run the reception wallboard as its own container with direct Microsoft Graph access and an isolated deployment lifecycle.

## Recommended DNS

- `reception.example.internal`

## Required environment

- `TRAEFIK_RECEPTION_HOST`
- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `MS_GRAPH_TENANT_ID`
- `RECEPTION_GROUP_NAME`
- `RECEPTION_ALLOWED_GROUPS`
- `RECEPTION_SESSION_SECRET`

## Runtime idea

- keep the wallboard independent from your main intranet frontend
- use a dedicated host or kiosk URL
- deploy and restart the board without affecting other apps

## Benefits

- safer kiosk deployment
- simpler operational model
- clearer ownership for Microsoft 365 access
- easier reception-specific UX iteration
