# Financial App Frontend

React + Tailwind + Vite frontend to test the Financial App backend quickly.

## Stack

- React 18
- Vite
- Tailwind CSS
- TypeScript

## Run

```bash
cd ../financial-app-frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Backend

Default API base URL is `http://localhost:3000`.

To change:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Seeded test credentials

- `demo@financial.app` / `password123`
- `member@financial.app` / `password123`

## Features in this frontend

- Login with JWT
- Workspace selection
- Monthly financial summary
- Transaction creation + latest list
- Credit card creation
- Purchase creation (installments)
- Projection (12 months)
- Invoice preview by year/month

## Important

This is a V1 testing console UI focused on backend validation workflows.
