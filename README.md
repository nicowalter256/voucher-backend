# Voucher Backend

This is a Node.js backend for an Internet Data Voucher System. It manages user authentication, voucher management, and payment processing using MTN MoMo and a PostgreSQL database (hosted on Supabase).

## Features

- User authentication
- Voucher creation and redemption
- Payment processing via MTN MoMo
- PostgreSQL database integration (Supabase)

## Project Structure

```
voucher-backend/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── migrations/
│   ├── routes/
│   ├── services/
│   ├── db.js
│   ├── index.js
│   ├── run-migration.js
│   └── run-voucher-migration.js
├── package.json
├── .env
└── README.md
```

## Setup Instructions

1. **Clone the repository:**

   ```sh
   git clone <your-repo-url>
   cd voucher-backend
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the project root with the following variables:

   ```env
   DATABASE_URL=your_supabase_postgres_connection_string
   MTN_MOMO_SUBSCRIPTION_KEY=your_mtn_momo_subscription_key
   MTN_MOMO_API_USER=your_mtn_momo_api_user
   MTN_MOMO_API_KEY=your_mtn_momo_api_key
   JWT_SECRET=your_jwt_secret
   # Add any other required variables
   ```

4. **Run database migrations:**

   ```sh
   node src/run-migration.js
   node src/run-voucher-migration.js
   ```

5. **Start the server:**
   ```sh
   npm start
   # or
   node src/index.js
   ```

## Deployment Notes

- This backend is designed for platforms that support persistent Node.js servers (e.g., Render, Railway, Fly.io).
- Vercel is not recommended for traditional Express backends.
- Ensure your environment variables are set in your deployment platform.

## Security Note

- Do **not** commit your `.env` file to public repositories. It contains sensitive credentials.
- If you accidentally push secrets, revoke and regenerate them immediately.

## License

MIT
