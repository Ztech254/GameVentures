# GameVentures 🏕️

Adventure booking site for hikes, safaris, river trips, road trips and games in Kenya.
Visitors browse trips, mark the ones they're **interested** in (free account, no payment), and **pay for slots** from their account with Paystack (M-Pesa and cards).

## Run it

```bash
npm install
cp .env.example .env     # then edit it
npm start                # http://localhost:3000
```

Requires Node.js 22.13+ (uses the built-in `node:sqlite`). Data is stored in `data/gameventures.db`.

On the first run an admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. **Change the password before going live.**

## Pages

| Page | What it does |
|---|---|
| `/` | Hero and search, a **Spotlight** ad card for the featured trip (countdown, activities, ride, slots left), category tiles, trip grid, fleet section, how it works |
| `/tour?id=…` | Trip details: activity timeline, your ride (Land Cruiser, bus…), what's included, slot picker, **Book & pay** or **I'm interested** |
| `/account` | The traveller's bookings (pay, retry, cancel) and their **Interested** list (book later or remove) |
| `/admin` | Post, edit and feature trips (image URL or upload), see all bookings, and the **Interested leads** list with WhatsApp/email follow-up buttons and CSV export |

## Payments (Paystack)

1. Get your secret key from the Paystack dashboard (Settings → API Keys & Webhooks).
2. Set `PAYSTACK_SECRET_KEY` (use `sk_test_…` first) and `PUBLIC_URL` in `.env`.
3. In the Paystack dashboard, set the **Webhook URL** to `https://your-domain/api/paystack/webhook`.

How a payment works: **Book** creates a pending booking. **Pay** opens Paystack's hosted checkout (M-Pesa or card), and the customer is sent back to `/account`. The server then confirms with Paystack (through the webhook, with verify as a backup), checks that the amount matches, and only then claims the seats.

With no key set the site runs in **demo mode**: payments confirm themselves after about 3 seconds, so you can test the whole flow.

## Interested travellers (not paying yet)

- "I'm interested" saves a trip to the traveller's account. It needs a free account, so you get their name, email and phone.
- Cards show "🔥 N interested" as social proof.
- Admin → Interested leads lists everyone with one-click WhatsApp/email messages to nudge them to book.
- When a lead pays, they move off the interested list automatically.
- Slots are only held once someone has paid, so interested travellers can't block seats.

## Transport

Each trip has a ride type (Land Cruiser 4x4, pop-up roof safari van, coach bus, 14-seater shuttle) and a details line. The ride shows on cards, on the Spotlight ad, and in a "Your ride" panel on the trip page.

## Going live checklist

- [ ] Strong `ADMIN_PASSWORD`, set `NODE_ENV=production` and serve over HTTPS
- [ ] Live Paystack key and webhook URL
- [ ] Replace the starter trip photos with your own (Admin → Edit → upload)
- [ ] Update the contact details in `public/js/app.js` (footer) and the stats and testimonials in `public/index.html`
- [ ] Back up `data/` regularly
