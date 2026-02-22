# BitK

AI-powered project management and issue tracking board.

## Tech Stack

- **Backend**: Bun + Hono + SQLite (Drizzle ORM)
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **DnD**: @dnd-kit/react
- **i18n**: i18next (Chinese / English)

## Getting Started

```bash
# Install dependencies
bun install
bun install --cwd frontend

# Start dev server (frontend + API)
bun run dev

# Or start API only
bun run dev:api
```

## Scripts

```bash
# Lint & Format
bun run lint          # eslint (backend)
bun run lint:fix
bun run format        # prettier
bun run format:check

# Database
bun run db:generate   # generate migration SQL
bun run db:migrate    # apply migrations
bun run db:reset      # reset SQLite DB

# Build & Production
bun run build         # vite build
bun run start         # production server
```

## License

MIT
