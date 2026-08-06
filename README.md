This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
### Required Authentication Environment Variables

The app uses NextAuth for authentication. The following environment variables are required for full auth functionality (Google sign-in + JWT session encryption):

- `NEXTAUTH_SECRET` — a stable, strong secret used to sign and encrypt session JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `NEXTAUTH_URL` — the canonical URL of your app (e.g. `http://localhost:3000`).
- `DATABASE_URL` — your database connection string used by Prisma.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — credentials for Google OAuth.
- `DATA_GOV_API_KEY` (optional) — the Data.gov.in open-data API key used by the live Government Data connector (`lib/connectors/dataGovConnector.ts`). When unset, or when the API fails, the connector transparently falls back to its built-in mock provider so the chat never breaks. Get a key at <https://data.gov.in> (Developer → API Management).
- `NCS_CLIENT_ID` / `NCS_CLIENT_SECRET` (optional) — credentials for the National Career Service (NCS) job-search API used by the Employment connector. When absent or on failure, the connector falls back to mock data.
- `NCS_BASE_URL` (optional) — defaults to `https://api.ncs.gov.in`; override for an NCS-compatible proxy in tests.

If `NEXTAUTH_SECRET` is not set, NextAuth will still sign JWTs but will not encrypt them; this may cause tokens to be invalidated across deployments and can lead to decryption errors if encryption was previously enabled.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
