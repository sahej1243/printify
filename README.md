# Printify

Queue-free A4 black-and-white printing for students. Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, and Razorpay.

Current mock pricing is ₹3 per printed page per copy: ₹2 shop earnings plus a ₹1 Printify platform fee. Pricing must be revalidated and calculated server-side before payment is enabled.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The student order preview is `/`, the read-only shop pitch demo is `/demo`, and invited shop owners sign in at `/shop/login` to use the live `/dashboard`.

The `/demo` screen uses separate sample data and is deliberately read-only. It has no payment simulation, real orders, private documents, or collection-code actions. Payments are disabled until Razorpay is configured; do not treat demo orders or payments as real transactions.

## Supabase setup

1. In the Supabase project dashboard, open **SQL Editor** and run the files in [`supabase/migrations`](supabase/migrations) in filename order. The initial migration creates the single shop, order/payment tables, shop-scoped row security, and a private PDF bucket; the pricing migration sets the customer price to ₹3/page/copy and records the ₹2 shop / ₹1 Printify split. Apply only migrations you have not already run.
2. Copy `.env.example` to `.env.local` and replace the Supabase URL and publishable key with values from **Project Settings → API Keys**. Keep the secret key server-side only. Never commit `.env.local`.
3. Restart `npm run dev` after changing environment variables.

### Give a shopkeeper dashboard access

1. In Supabase **Authentication → URL Configuration**, keep the production redirect URL allow-listed and set **Site URL** to `https://printify-alpha-ten.vercel.app/auth/confirm` so invitation links open the password setup page. For local development, also allow `http://localhost:3000/**`.
2. In Supabase **Authentication → Users**, invite the shopkeeper by email. The invitation opens `/auth/confirm`, where they set their own password.
3. Open [`supabase/manual/assign_shopkeeper.sql`](supabase/manual/assign_shopkeeper.sql), replace `shopowner@example.com`, and run it in SQL Editor. This assigns that Auth account to Campus Print House as an owner.
4. The shopkeeper signs in at `/shop/login`. There is no public signup; dashboard reads and mutations are limited to the assigned shop.

The project URL currently configured locally is `https://dpijrbvrdfvkfvbilkej.supabase.co`. Retrieve keys directly in Supabase and store them locally. Do not send secret keys in chat.

## Implementation plan

1. Shopkeeper dashboard and student order UI, including a read-only pitch demo. (Implemented.)
2. Supabase schema, authentication, shop-scoped access, private document uploads, and signed previews. (Code prepared; database migrations still need to be applied.)
3. Server-validated order creation and Razorpay checkout, signature/webhook verification, and idempotent payment updates. (Not enabled; awaiting a Razorpay account and credentials.)
4. Fulfillment controls, single-use collection codes, student order status/receipt confirmation, and analytics.
5. Deployment and production security/configuration review.

## Initial schema

- `shops`: shop identity, open state, and server-owned page price.
- `shop_staff`: authenticated staff-to-shop assignments and role.
- `orders`: validated document metadata, selected pages/copies, customer total, platform fee, shop earnings, payment and fulfillment states, and hashed tracking/collection tokens.
- `payments`: Razorpay order/payment identifiers and verified payment state.
- `payment_webhook_events`: unique webhook IDs for idempotent processing.
- Private Storage bucket `order-pdfs`, readable only by assigned staff through row-scoped policy.

Students will use server routes for order access; the first schema does not allow anonymous reads of order or payment data. The migration is an initial foundation and will be extended as the ordering and payment flows are implemented.

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Server only | Privileged server-side operations |
| `RAZORPAY_KEY_ID` | Server/config (public checkout ID only when needed) | Razorpay checkout identification |
| `RAZORPAY_KEY_SECRET` | Server only | Razorpay API/signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | Webhook signature verification |

Do not add secrets with a `NEXT_PUBLIC_` prefix. Razorpay credentials are not required for the no-payment showroom demo and must be configured before accepting orders or payments.

