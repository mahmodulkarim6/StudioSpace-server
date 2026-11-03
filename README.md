# StudioSpace API (Server)

Express.js and MongoDB backend for **StudioSpace**, a peer-to-peer marketplace for booking creative studios.

**Client Repository:** https://github.com/YOUR-USERNAME/studiospace-client
**Live Site:** https://YOUR-VERCEL-URL.vercel.app
**Live API:** https://YOUR-RENDER-URL.onrender.com

## Features

- **Better Auth** (MongoDB adapter) for email/password and Google login, with the session JWT stored in an **HTTPOnly cookie**
- Protected routes return `401 Unauthorized` when the user is not logged in
- Studio CRUD, where only the owner can update or delete a listing (`403` otherwise)
- Booking system with **double-booking prevention**: a request that overlaps a Confirmed booking is rejected with `409`
- Host booking requests: confirm, decline or complete
- Saved studios wishlist and home page category stats
- Search, category filter and sort for studios

## Tech Stack

Node.js, Express.js, MongoDB, Better Auth

## API Overview

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| ALL | `/api/auth/*` | Public | Better Auth (register, login, Google, session, logout) |
| GET | `/api/studios` | Public | List studios (`category`, `search`, `sort`, `limit`) |
| GET | `/api/studios/:id` | Public | Studio details |
| GET | `/api/my-studios` | Private | Studios owned by the logged-in user |
| POST | `/api/studios` | Private | Add a studio |
| PUT | `/api/studios/:id` | Owner | Update a studio |
| DELETE | `/api/studios/:id` | Owner | Delete a studio |
| POST | `/api/bookings` | Private | Create a booking (Pending) |
| GET | `/api/bookings/mine` | Private | My bookings |
| GET | `/api/bookings/requests` | Private | Requests for my studios |
| PATCH | `/api/bookings/:id/status` | Guest or Host | Cancel, confirm, decline or complete |
| GET / POST | `/api/wishlist` | Private | Saved studios |
| GET | `/api/stats` | Public | Studio counts per category |

## Local Setup

Requirements: Node.js 18 or newer and a MongoDB Atlas database.

```bash
git clone https://github.com/YOUR-USERNAME/studiospace-server.git
cd studiospace-server
npm install
cp .env.example .env
```

Fill in `.env`:
```
PORT=5000
MONGODB_URI=your MongoDB connection string (database name: studiospace)
BETTER_AUTH_SECRET=a random string of 32 or more characters
CLIENT_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your Google OAuth client id
GOOGLE_CLIENT_SECRET=your Google OAuth client secret
NODE_ENV=development
```

Add demo studios and test users, then start the server:
```bash
npm run seed
npm run dev
```

Google OAuth redirect URI: `<CLIENT_URL>/api/auth/callback/google`

## Test Users (created by `npm run seed`)

- `examiner@studiospace.com` / `Examiner1`
- `host@studiospace.com` / `Host1234`

## Deploy on Render

- Build command: `npm install`
- Start command: `npm start`
- Environment variables: same as `.env`, with `NODE_ENV=production` and `CLIENT_URL` set to your Vercel URL