# 🛵 Camiguin Centric Riders Club (CCRC)
### On-Demand Island Express Riders & Delivery PWA

Usa ka komprehensibo, mobile-first Progressive Web App (PWA) alang sa **Pahatud, Pakuha, Pasugo, ug Pabili** sa tibuok Isla sa Camiguin.

---

## 🌟 Mga Nag-unang Bahin

1. **📱 Installable Progressive Web App (PWA)**:
   - Ma-install sa home screen sa Android, iPhone, Windows, ug Mac.
   - Paspas mo-load gamit ang modernong Service Worker cache (`ccrc-pwa-v1`) ug dunay offline fallback.

2. **🛵 Upat (4) ka Serbisyo sa Isla**:
   - **Pahatud / Pakuha**: Sakay sa pasahero (habal-habal/motor taxi) nga may GPS route pinning.
   - **Pasugo / Padala**: Pagpadala og parsel, dokumento, o kargamento taliwala sa mga lungsod.
   - **Pabili Service**: Pabili sa merkado, grocery, botika/tambal, o carenderia/fastfood nga dunay budget input.
   - **Pabayad / Port Claim**: Bayad sa bills o pagkuha og cargo sa Benoni Wharf o Balbagon Port.

3. **🗺️ Interactive Camiguin GPS Map**:
   - Leaflet + OpenStreetMap nga dunay mga shortcut chips para sa mga pantalan (Benoni, Balbagon), airport, ug mga sikat nga resort (Paras Beach, Balyali, Tongatok, Lanzones).
   - "Akong GPS Karon" 1-tap locator button.
   - Awtomatikong kalkulado sa plete base sa tinuod nga kilometro (`base_fare` + `per_km_rate`).

4. **🔔 Rider Dispatch Board (`/rider`)**:
   - **Online / Standby Toggle**: Paminaw kon andam modawat og booking.
   - **Audio Ringing Alert**: Motingog dayon ang cellphone sa online riders inig abot sa bag-ong kustomer.
   - **Atomic Acceptance**: Unang rider nga maka-tap sa `[Dawati Kini nga Booking]` maoy makadawat, aron walay mag-ilog.
   - **Google Maps Navigation**: 1-tap turn-by-turn navigation diretso sa Google Maps o Waze.
   - **Live GPS Beacon**: Awtomatikong mo-stream sa posisyon sa rider gamit ang `navigator.geolocation.watchPosition`.

5. **📍 Customer Live GPS Tracking (`/track/<booking_code>`)**:
   - Real-time map nga nagpakita sa nagdagan nga motor icon sa rider padulong sa kustomer.
   - Step updates: `Nangita og Rider` ➡️ `Padulong sa Pickup` ➡️ `In Transit` ➡️ `Nahatud na`.
   - Direct Call ug SMS button ngadto sa nadestinong rider.

6. **⚙️ Club Admin & Dispatch Control (`/admin`)**:
   - Real-time dashboard sa mga online riders, biyahe karon, ug natapos nga mga sugo.
   - Roster sa mga miyembro sa club ug editor sa taripa sa plete.
