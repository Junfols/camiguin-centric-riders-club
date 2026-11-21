# Security patch – CCRC

## Giayo (Fixed)
1. **Default admin password** (`admin1234` / `admin`) – gitangtang. Sa startup, kung ang stored password kay default pa, ma-replace (gikan sa `ADMIN_PASSWORD` env, o random nga i-print sa logs).
2. **`/api/admin/settings`** – gi-require na ang admin login; wala na i-echo ang password hash.
3. **Hardcoded `SECRET_KEY`** – gitangtang. `SECRET_KEY` env, o random key nga persistent sa DB.
4. **Booking `/status`, `/receipt`, `/accept`, `/start-now`, `/rider/location`, `/rider/status`, `/active-job`, `/transactions`, `/co-riders`, `/available-jobs`** – rider identity gikan na sa **server session** lang, dili na sa `rider_id` sa request. Status = assigned rider/admin lang; receipt = participant lang.
5. **Chat** – ang `sender_role` gi-decide na sa server (dili na ma-spoof ang "rider"/"system"); numeric-ID chat = participant lang.
6. **Customer history / me / active-booking** – own account lang (o admin). Gitangtang ang `password_hash` sa `/api/customer/me`.
7. **Reviews** – completed trip lang, passenger lang, usa ra kada trip.
8. **Uploads** – magic-byte validation (JPG/PNG/WebP lang), size limit, `MAX_CONTENT_LENGTH`; `/media` nag-serve og image-only + `CSP: sandbox`.
9. **Rate limiting** – login (customer/rider/admin), register, forgot-password, booking, uploads, chat.
10. **CSRF** – Origin/Referer check sa tanang POST/PUT/DELETE; cookies: HttpOnly, SameSite=Lax, Secure (sa Render).
11. **Headers** – HSTS, Referrer-Policy, Permissions-Policy.
12. **Admin session** – mo-expire human sa 12 oras; ang rider/customer session 30 adlaw.
13. **ID-card fallback HTML** – gi-escape (stored XSS).
14. `debug=True` – gitangtang (`FLASK_DEBUG=1` na lang).
15. `/api/bookings/track/<code>` – gitago ang `customer_phone` sa dili participant.

## Wala pa ma-fix / Nahibilin
- **Forgot-password** (phone + email lang): mahimong i-takeover ang account kung nahibaloan ang duha. Kinahanglan og SMS/email OTP.
- **Rate limit kay per-worker, in-memory** (2 ka gunicorn workers). Para sa strict nga limit, gamit og Redis.
- **Walay Content-Security-Policy** kay daghan og inline scripts. I-migrate sa nonce-based CSP.
- **Booking code** 4 ka hex (65k/bulan) – naa na ang rate limit, apan mas maayo ang mas taas.
- Giayo na ang `receipt_url` bug (bag-ong `bookings.receipt_url` column, auto-migrate).
- Pre-existing nga 2 ka test failures (`Padala` text, geocoding Baylao→Jollibee 3.23 km) – wala gihilabtan.
- Ang `innerHTML` sa JS: spot-check ra; ang rider.js/track.js/app.js naggamit na og `escapeHtml`, apan wala nako gi-audit ang tanang 44.

## Importante human ma-deploy
1. I-set ang `ADMIN_PASSWORD` sa Render.
2. Tan-awa ang Render logs sa unang boot kung wala nimo gi-set.
3. Ang tanang naka-login karon ma-logout (bag-ong session key) – normal ra.
4. Gamit sa customer history: kinahanglan naka-login ang customer.
