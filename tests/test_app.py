import os
import tempfile
import unittest

from app import create_app
from db import calculate_fare


class CamiguinCentricRidersClubTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_riders.db")
        self.app = create_app(
            {
                "TESTING": True,
                "DB_PATH": self.db_path,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        try:
            self.temp_dir.cleanup()
        except Exception:
            pass

    def _create_active_rider(self, name="Test Rider Jun", phone="09171112233", bike_model="Honda Click 125i"):
        from db import get_connection, register_rider
        conn = get_connection(self.db_path)
        try:
            rid = register_rider(conn, name=name, phone=phone, password="password123", bike_model=bike_model, plate_number="CCRC-99")
            conn.execute("UPDATE riders SET status = 'active', is_online = 1 WHERE id = ?", (rid,))
            conn.commit()
            return rid
        finally:
            conn.close()

    def _create_customer(self, name="Registered Passenger Maria", phone="09183334455", password="custpassword123"):
        from db import get_connection, register_customer
        conn = get_connection(self.db_path)
        try:
            c = register_customer(conn, name=name, phone=phone, password=password)
            conn.commit()
            return c["id"]
        finally:
            conn.close()

    def test_pwa_endpoints(self):
        # 1. Manifest
        m_resp = self.client.get("/manifest.webmanifest")
        self.assertEqual(m_resp.status_code, 200)
        data = m_resp.get_json()
        self.assertIn("Camiguin Centric Riders Club", data["name"])
        self.assertEqual(data["display"], "standalone")

        # 2. Service Worker v16
        sw_resp = self.client.get("/sw.js")
        self.assertEqual(sw_resp.status_code, 200)
        sw_text = sw_resp.get_data(as_text=True)
        self.assertIn("ccrc-pwa-v19", sw_text)
        self.assertIn("/static/css/style.css?v=31", sw_text)
        self.assertIn("/static/js/i18n.js?v=9", sw_text)
        self.assertIn("/static/js/app.js?v=35", sw_text)
        self.assertIn("/static/js/auth.js?v=1", sw_text)
        self.assertIn("/static/js/voice_call.js?v=1", sw_text)

        # 3. Offline fallback in English
        off_resp = self.client.get("/offline")
        self.assertEqual(off_resp.status_code, 200)
        self.assertIn("No Internet Connection", off_resp.get_data(as_text=True))

    def test_official_fare_matrix_calculations(self):
        # Test exact Official Camiguin CRC Fare Matrix values
        settings = {
            "base_fare": "40.0",
            "base_km": "2.0",
            "per_km_rate": "18.0",
            "min_fare": "40.0",
            "pabili_service_fee": "20.0",
            "pasugo_service_fee": "20.0",
            "queuing_fee": "30.0",
            "extra_store_fee": "20.0",
            "bulky_order_fee": "20.0",
            "hinterland_fee": "30.0",
        }

        # 1 KM -> 40
        f1, _, _ = calculate_fare(1.0, "pahatud", settings)
        self.assertEqual(f1, 40.0)

        # 2 KMS -> 40
        f2, _, _ = calculate_fare(2.0, "pahatud", settings)
        self.assertEqual(f2, 40.0)

        # 3 KMS -> 58
        f3, _, _ = calculate_fare(3.0, "pahatud", settings)
        self.assertEqual(f3, 58.0)

        # 4 KMS -> 76
        f4, _, _ = calculate_fare(4.0, "pahatud", settings)
        self.assertEqual(f4, 76.0)

        # 5 KMS -> 94
        f5, _, _ = calculate_fare(5.0, "pahatud", settings)
        self.assertEqual(f5, 94.0)

        # 10 KMS -> 184
        f10, _, _ = calculate_fare(10.0, "pahatud", settings)
        self.assertEqual(f10, 184.0)

        # 15 KMS -> 274
        f15, _, _ = calculate_fare(15.0, "pahatud", settings)
        self.assertEqual(f15, 274.0)

        # 20 KMS -> 364
        f20, _, _ = calculate_fare(20.0, "pahatud", settings)
        self.assertEqual(f20, 364.0)

        # 25 KMS -> 454
        f25, _, _ = calculate_fare(25.0, "pahatud", settings)
        self.assertEqual(f25, 454.0)

        # 30 KMS -> 544
        f30, _, _ = calculate_fare(30.0, "pahatud", settings)
        self.assertEqual(f30, 544.0)

    def test_fare_matrix_surcharges(self):
        settings = {
            "base_fare": "40.0",
            "base_km": "2.0",
            "per_km_rate": "18.0",
            "min_fare": "40.0",
            "pabili_service_fee": "20.0",
            "pasugo_service_fee": "20.0",
            "queuing_fee": "30.0",
            "extra_store_fee": "20.0",
            "bulky_order_fee": "20.0",
            "hinterland_fee": "30.0",
        }

        # Pasugo/Pabili (+₱20 on top of meter)
        pabili_fare, _, _ = calculate_fare(2.0, "pabili", settings)
        self.assertEqual(pabili_fare, 60.0)  # 40 + 20

        # Large Store / Supermarket Queuing (+₱30)
        store_fare, _, _ = calculate_fare(2.0, "pabili", settings, is_large_store=True)
        self.assertEqual(store_fare, 90.0)  # 40 + 20 + 30

        # Additional Store Stops (+₱20 per store)
        multi_fare, _, _ = calculate_fare(2.0, "pabili", settings, extra_stores_count=2)
        self.assertEqual(multi_fare, 100.0)  # 40 + 20 + 40

        # Bulky orders / orders reaching ₱2,000 (+₱20)
        bulky_fare, _, _ = calculate_fare(2.0, "pabili", settings, is_bulky_or_high_value=True)
        self.assertEqual(bulky_fare, 80.0)  # 40 + 20 + 20

        # Hinterland / Mountain Route (+₱30)
        hinterland_fare, _, _ = calculate_fare(2.0, "pahatud", settings, is_hinterland=True)
        self.assertEqual(hinterland_fare, 70.0)  # 40 + 30

    def test_customer_home_and_fare_estimate(self):
        # Home view in English
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)
        self.assertIn("Camiguin Centric Riders Club", html)
        self.assertIn("Passenger", html)
        self.assertIn("Courier", html)
        self.assertIn("Errand", html)
        self.assertIn("Port &amp; Bills", html)
        self.assertIn("Official Camiguin CRC Fare Matrix", html)
        self.assertIn('id="ccrc-lang-select"', html)
        self.assertIn("/static/js/i18n.js", html)
        i18n_resp = self.client.get("/static/js/i18n.js")
        self.assertEqual(i18n_resp.status_code, 200)

        # Fare estimate API
        est_resp = self.client.post(
            "/api/fare-estimate",
            json={
                "pickup_lat": 9.2483,
                "pickup_lng": 124.6975,
                "dropoff_lat": 9.2553,
                "dropoff_lng": 124.6468,
                "service_type": "pahatud",
            },
        )
        self.assertEqual(est_resp.status_code, 200)
        data = est_resp.get_json()
        self.assertIn("fare_amount", data)
        self.assertTrue(data["fare_amount"] >= 40.0)
        self.assertTrue(data["estimated_km"] > 0)
        self.assertIn("breakdown", data)

    def test_booking_creation_for_different_services(self):
        # 1. Passenger Ride
        p_resp = self.client.post(
            "/api/bookings",
            json={
                "service_type": "pahatud",
                "customer_name": "Maria Santos",
                "customer_phone": "09171234567",
                "pickup_address": "Balbagon Port",
                "pickup_lat": 9.2561,
                "pickup_lng": 124.7175,
                "dropoff_address": "Paras Beach Resort, Yumbing",
                "dropoff_lat": 9.2553,
                "dropoff_lng": 124.6468,
            },
        )
        self.assertEqual(p_resp.status_code, 201)
        b_data = p_resp.get_json()["booking"]
        self.assertEqual(b_data["service_type"], "pahatud")
        self.assertEqual(b_data["status"], "broadcast")
        self.assertTrue(b_data["booking_code"].startswith("CCRC-"))

        # 2. Pabili Errand with Budget & Shopping List & Large Store
        b_resp = self.client.post(
            "/api/bookings",
            json={
                "service_type": "pabili",
                "customer_name": "Jerome Visitor",
                "customer_phone": "09187654321",
                "pickup_address": "Gaisano Camiguin",
                "pickup_lat": 9.2483,
                "pickup_lng": 124.6975,
                "dropoff_address": "Balyali Resort, Yumbing",
                "dropoff_lat": 9.2588,
                "dropoff_lng": 124.6432,
                "item_notes": "1 whole Roast Chicken, 5 rice cakes, 1L Juice",
                "estimated_budget": 500,
                "is_large_store": True,
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        pabili_booking = b_resp.get_json()["booking"]
        self.assertEqual(pabili_booking["service_type"], "pabili")
        self.assertEqual(pabili_booking["estimated_budget"], 500.0)
        self.assertIn("Roast Chicken", pabili_booking["item_notes"])

    def test_rider_flow_dispatch_atomic_accept_and_gps_tracking(self):
        # Setup 2 active riders
        r1_id = self._create_active_rider(name="Kuya Jun (President)", phone="09171110001", bike_model="Honda Click 125i")
        r2_id = self._create_active_rider(name="Kuya Mark (VP Operations)", phone="09171110002", bike_model="Yamaha NMAX 155")

        # 1. Create a broadcast booking
        create_resp = self.client.post(
            "/api/bookings",
            json={
                "service_type": "pasugo",
                "customer_name": "Rochelle Tourist",
                "customer_phone": "09199998888",
                "pickup_address": "Benoni Port",
                "pickup_lat": 9.1306,
                "pickup_lng": 124.7937,
                "dropoff_address": "Mambajao Central Plaza",
                "dropoff_lat": 9.2483,
                "dropoff_lng": 124.6975,
                "item_notes": "Important travel documents envelope",
            },
        )
        booking = create_resp.get_json()["booking"]
        booking_id = booking["id"]
        code = booking["booking_code"]

        # 2. Check available jobs feed (as authenticated Rider 1)
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        feed_resp = self.client.get("/api/rider/available-jobs")
        self.assertEqual(feed_resp.status_code, 200)
        jobs = feed_resp.get_json()["jobs"]
        self.assertTrue(any(j["id"] == booking_id for j in jobs))

        # 3. Rider 1 accepts the booking atomically
        accept_resp = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={},
        )
        self.assertEqual(accept_resp.status_code, 200)
        self.assertTrue(accept_resp.get_json()["success"])

        # 4. Rider 2 tries to accept same booking -> should receive 409 Conflict
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        second_accept = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={},
        )
        self.assertEqual(second_accept.status_code, 409)
        self.assertIn("already been claimed", second_accept.get_json()["error"])

        # 5. Rider 1 streams GPS coordinates while heading to pickup
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        gps_resp = self.client.post(
            "/api/rider/location",
            json={
                "lat": 9.1500,
                "lng": 124.7800,
                "speed": 35.0,
                "heading": 120.0,
                "booking_id": booking_id,
            },
        )
        self.assertEqual(gps_resp.status_code, 200)

        # 6. Customer live tracking view & API
        track_html = self.client.get(f"/track/{code}").get_data(as_text=True)
        self.assertIn("Kuya Jun", track_html)
        self.assertIn(code, track_html)

        track_api = self.client.get(f"/api/bookings/track/{code}")
        self.assertEqual(track_api.status_code, 200)
        track_data = track_api.get_json()
        self.assertEqual(track_data["booking"]["status"], "accepted")
        self.assertEqual(track_data["booking"]["rider_name"], "Kuya Jun (President)")
        self.assertEqual(track_data["booking"]["rider_lat"], 9.1500)
        self.assertTrue(len(track_data["trail"]) >= 1)

        # 7. Rider progresses status to in_progress -> completed
        prog_resp = self.client.post(
            f"/api/bookings/{booking_id}/status",
            json={"status": "in_progress"},
        )
        self.assertEqual(prog_resp.status_code, 200)

        comp_resp = self.client.post(
            f"/api/bookings/{booking_id}/status",
            json={"status": "completed"},
        )
        self.assertEqual(comp_resp.status_code, 200)

        # Verify completed status on customer tracking
        final_track = self.client.get(f"/api/bookings/track/{code}").get_json()["booking"]
        self.assertEqual(final_track["status"], "completed")

        track_html_resp = self.client.get(f"/track/{code}")
        self.assertEqual(track_html_resp.status_code, 200)
        t_page = track_html_resp.get_data(as_text=True)
        self.assertIn("Back to Dashboard", t_page)
        self.assertIn("Delivered! Thank you for using CCRC", t_page)

    def test_rider_registration_and_login(self):
        # Register new rider
        reg_resp = self.client.post(
            "/api/rider/register",
            json={
                "name": "Kuya Dodong",
                "phone": "09170001122",
                "password": "ridersecret",
                "license_no": "DL-CCRC-101",
                "bike_model": "Honda ADV 160",
                "plate_number": "CCRC-99",
                "municipality": "Mambajao",
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        reg_data = reg_resp.get_json()
        self.assertTrue(reg_data["success"])
        self.assertTrue(reg_data["pending"])
        self.assertEqual(reg_data["rider"]["status"], "pending")
        self.assertEqual(reg_data["rider"]["is_online"], 0)
        rider_id = reg_data["rider"]["id"]

        # Duplicate registration should return 409
        dup_resp = self.client.post(
            "/api/rider/register",
            json={
                "name": "Kuya Dodong",
                "phone": "09170001122",
                "password": "ridersecret",
                "license_no": "DL-CCRC-101",
                "bike_model": "Honda ADV 160",
                "plate_number": "CCRC-99",
            },
        )
        self.assertEqual(dup_resp.status_code, 409)

        # Login while pending must be BLOCKED with 403
        log_pending = self.client.post(
            "/api/rider/login",
            json={"phone": "09170001122", "password": "ridersecret"},
        )
        self.assertEqual(log_pending.status_code, 403)
        self.assertTrue(log_pending.get_json().get("pending"))
        self.assertIn("PENDING APPROVAL", log_pending.get_json().get("error", ""))

        # Admin in-person approval via /api/admin/riders/<id>/status
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
        appr_resp = self.client.post(
            f"/api/admin/riders/{rider_id}/status",
            json={"status": "active"},
        )
        self.assertEqual(appr_resp.status_code, 200)

        # Now verified rider can successfully login
        log_resp = self.client.post(
            "/api/rider/login",
            json={"phone": "09170001122", "password": "ridersecret"},
        )
        self.assertEqual(log_resp.status_code, 200)
        self.assertTrue(log_resp.get_json()["success"])
        self.assertEqual(log_resp.get_json()["rider"]["status"], "active")
        self.assertEqual(log_resp.get_json()["rider"]["is_online"], 1)

    def test_admin_view_and_settings(self):
        r_id = self._create_active_rider(name="Registered Rider Cardo", phone="09173334455")
        c_id = self._create_customer(name="Registered Passenger Maria", phone="09183334455")

        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
        admin_resp = self.client.get("/admin")
        self.assertEqual(admin_resp.status_code, 200)
        html = admin_resp.get_data(as_text=True)
        self.assertIn("Club Dispatch &amp; Admin Panel", html)
        self.assertIn("Registered Rider Cardo", html)
        self.assertIn("Registered Passenger Maria", html)

        # Test Admin Delete Rider
        del_rider_resp = self.client.post(f"/api/admin/riders/{r_id}/delete")
        self.assertEqual(del_rider_resp.status_code, 200)
        self.assertTrue(del_rider_resp.get_json()["success"])

        # Test Admin Delete Customer
        del_cust_resp = self.client.post(f"/api/admin/customers/{c_id}/delete")
        self.assertEqual(del_cust_resp.status_code, 200)
        self.assertTrue(del_cust_resp.get_json()["success"])

        # Verify they are gone from database
        admin_resp2 = self.client.get("/admin")
        html2 = admin_resp2.get_data(as_text=True)
        self.assertNotIn("Registered Rider Cardo", html2)
        self.assertNotIn("Registered Passenger Maria", html2)

        # Update settings
        set_resp = self.client.post(
            "/api/admin/settings",
            json={
                "base_fare": 45,
                "per_km_rate": 18,
                "hotline": "0917 999 8877",
            },
        )
        self.assertEqual(set_resp.status_code, 200)
        settings = set_resp.get_json()["settings"]
        self.assertEqual(settings["base_fare"], "45")
        self.assertEqual(settings["per_km_rate"], "18")

    def test_typed_address_geocoding_baylao_to_jollibee(self):
        # User scenario: Pickup "Moonflower Garden, Baylao", Dropoff "Jollibee"
        # Actual road distance along Camiguin roads is ~1.8 km (within 1-2 km base tariff)
        # In Camiguin CRC Fare matrix (1-2 km = 40.00), fare should be 40.00
        est_resp = self.client.post(
            "/api/fare-estimate",
            json={
                "pickup_address": "Moonflower Garden, Baylao",
                "dropoff_address": "Jollibee",
                "service_type": "pahatud",
            },
        )
        self.assertEqual(est_resp.status_code, 200)
        est_data = est_resp.get_json()
        self.assertGreater(est_data["estimated_km"], 1.0)
        self.assertLessEqual(est_data["estimated_km"], 2.2)
        self.assertEqual(est_data["fare_amount"], 40.0)
        self.assertIsNotNone(est_data["resolved_pickup"])
        self.assertIsNotNone(est_data["resolved_dropoff"])

        # Also verify booking creation with typed text
        book_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Maria Santos",
                "customer_phone": "09171234567",
                "service_type": "pahatud",
                "pickup_address": "Moonflower Garden, Baylao",
                "dropoff_address": "Jollibee Camiguin",
            },
        )
        self.assertEqual(book_resp.status_code, 201)
        booking = book_resp.get_json()["booking"]
        self.assertEqual(booking["fare_amount"], 40.0)
        self.assertIsNotNone(booking["pickup_lat"])
        self.assertIsNotNone(booking["dropoff_lat"])

    def test_road_distance_routing_and_client_override(self):
        # Test passing exact road distance from OSRM
        est_resp = self.client.post(
            "/api/fare-estimate",
            json={
                "pickup_address": "Baylao",
                "dropoff_address": "Jollibee",
                "service_type": "pahatud",
                "road_km": 1.82,
            },
        )
        self.assertEqual(est_resp.status_code, 200)
        est_data = est_resp.get_json()
        self.assertEqual(est_data["estimated_km"], 1.82)
        self.assertEqual(est_data["fare_amount"], 40.0)

        # Longer road distance: 5.5 km
        # Base 2 km = 40, extra 3.5 km * 18 = 63 -> 103.0
        est_resp2 = self.client.post(
            "/api/fare-estimate",
            json={
                "service_type": "pahatud",
                "road_km": 5.5,
                "pickup_address": "Baylao",
                "dropoff_address": "Agoho",
            },
        )
        self.assertEqual(est_resp2.status_code, 200)
        est2_data = est_resp2.get_json()
        self.assertEqual(est2_data["fare_amount"], 103.0)

    def test_camiguin_places_search_api(self):
        # 1. Search stores & pharmacies
        resp = self.client.get("/api/places/search?q=mercury")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertGreater(len(data["places"]), 0)
        self.assertIn("Mercury Drug", data["places"][0]["name"])

        # 2. Search barangays
        b_resp = self.client.get("/api/places/search?q=baylao")
        self.assertEqual(b_resp.status_code, 200)
        b_data = b_resp.get_json()
        self.assertGreater(len(b_data["places"]), 0)
        self.assertIn("Baylao", b_data["places"][0]["name"])

        # 3. Search streets
        s_resp = self.client.get("/api/places/search?q=rizal")
        self.assertEqual(s_resp.status_code, 200)
        s_data = s_resp.get_json()
        self.assertGreater(len(s_data["places"]), 0)

        # 4. Check all places list
        all_resp = self.client.get("/api/places/all")
        self.assertEqual(all_resp.status_code, 200)
        all_data = all_resp.get_json()
        self.assertGreater(len(all_data["places"]), 100)

    def test_promo_codes_and_scheduled_bookings(self):
        # Validate starter promo WELCOME20 on fare 100
        val_resp = self.client.post(
            "/api/promo/validate",
            json={"code": "WELCOME20", "fare_amount": 100.0},
        )
        self.assertEqual(val_resp.status_code, 200)
        val_data = val_resp.get_json()
        self.assertTrue(val_data["success"])
        self.assertEqual(val_data["promo"]["discount_amount"], 20.0)
        self.assertEqual(val_data["promo"]["new_fare"], 80.0)

        # Booking with GCash, Promo, and Schedule
        book_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Ana Reyes",
                "customer_phone": "09181112233",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "White Island Jump-off",
                "service_type": "pahatud",
                "payment_method": "gcash",
                "promo_code": "WELCOME20",
                "scheduled_at": "2026-11-20T08:30:00",
            },
        )
        self.assertEqual(book_resp.status_code, 201)
        booking = book_resp.get_json()["booking"]
        self.assertEqual(booking["payment_method"], "gcash")
        self.assertEqual(booking["promo_code"], "WELCOME20")
        self.assertEqual(booking["scheduled_at"], "2026-11-20T08:30:00")

    def test_tour_packages_and_reviews_api(self):
        r_id = self._create_active_rider(name="Review Rider Jun", phone="09177771122")
        tours_resp = self.client.get("/api/tour-packages")
        self.assertEqual(tours_resp.status_code, 200)
        packages = tours_resp.get_json()["packages"]
        self.assertGreaterEqual(len(packages), 4)

        # Submit review
        rev_resp = self.client.post(
            "/api/reviews",
            json={
                "rider_id": r_id,
                "rating": 5,
                "customer_name": "Tourist Juan",
                "comment": "Very safe and scenic ride around Camiguin!",
            },
        )
        self.assertEqual(rev_resp.status_code, 201)
        rev = rev_resp.get_json()["review"]
        self.assertEqual(rev["rating"], 5)

    def test_customer_active_booking_retrieval(self):
        # 1. Customer creates booking
        book_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Test Passenger",
                "customer_phone": "09995554433",
                "service_type": "pahatud",
                "pickup_address": "Balbagon, Mambajao",
                "dropoff_address": "Benoni Port",
            },
        )
        self.assertEqual(book_resp.status_code, 201)
        b = book_resp.get_json()["booking"]
        code = b["booking_code"]

        # 2. Check active booking via /api/customer/active-booking?code=...
        act_resp = self.client.get(f"/api/customer/active-booking?code={code}")
        self.assertEqual(act_resp.status_code, 200)
        act_data = act_resp.get_json()
        self.assertTrue(act_data["active"])
        self.assertEqual(act_data["booking"]["booking_code"], code)

        # 3. Check active booking via customer phone
        phone_resp = self.client.get(f"/api/customer/active-booking?phone=09995554433")
        self.assertEqual(phone_resp.status_code, 200)
        phone_data = phone_resp.get_json()
        self.assertTrue(phone_data["active"])
        self.assertEqual(phone_data["booking"]["booking_code"], code)

        # 4. Check index page renders active booking card
        idx_resp = self.client.get("/")
        self.assertEqual(idx_resp.status_code, 200)
        self.assertIn(code, idx_resp.get_data(as_text=True))
        self.assertIn("Active Island Trip Detected", idx_resp.get_data(as_text=True))

    def test_customer_registration_and_login(self):
        # 1. Register a new customer
        reg_resp = self.client.post(
            "/api/customer/register",
            json={
                "name": "Maria Test Santos",
                "phone": "09179998877",
                "email": "maria@test.com",
                "avatar_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "barangay": "Agoho, Mambajao",
                "password": "secretpassword123",
            },
        )
        self.assertEqual(reg_resp.status_code, 200)
        data = reg_resp.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["customer"]["is_verified"], 1)

        # 2. Check /api/customer/me
        me_resp = self.client.get("/api/customer/me")
        self.assertEqual(me_resp.status_code, 200)
        self.assertTrue(me_resp.get_json()["logged_in"])
        self.assertEqual(me_resp.get_json()["customer"]["phone"], "09179998877")

        # 3. Customer logout
        logout_resp = self.client.post("/api/customer/logout")
        self.assertEqual(logout_resp.status_code, 200)

        # 4. Log in with registered credentials
        login_resp = self.client.post(
            "/api/customer/login",
            json={
                "phone": "09179998877",
                "password": "secretpassword123",
            },
        )
        self.assertEqual(login_resp.status_code, 200)
        self.assertTrue(login_resp.get_json()["success"])

        # 5. Invalid password attempt
        bad_login = self.client.post(
            "/api/customer/login",
            json={
                "phone": "09179998877",
                "password": "wrongpassword",
            },
        )
        self.assertEqual(bad_login.status_code, 401)

    def test_transactions_ledger_for_customer_rider_and_admin(self):
        r_id = self._create_active_rider(name="Ledger Rider Cardo", phone="09176662233")

        # 1. Create a booking with instant customer verification
        book_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Verified Passenger",
                "customer_phone": "09181112233",
                "customer_password": "mypassword123",
                "customer_barangay": "Yumbing, Catarman",
                "service_type": "pahatud",
                "pickup_address": "Yumbing, Catarman",
                "dropoff_address": "Mambajao Public Market",
            },
        )
        self.assertEqual(book_resp.status_code, 201)
        b = book_resp.get_json()["booking"]
        b_id = b["id"]
        b_code = b["booking_code"]

        # Verify broadcast booking contains customer verification badge info (as authenticated rider)
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r_id
        avail_resp = self.client.get("/api/rider/available-jobs")
        self.assertEqual(avail_resp.status_code, 200)
        jobs = avail_resp.get_json()["jobs"]
        matching = [j for j in jobs if j["id"] == b_id]
        self.assertTrue(len(matching) > 0)
        self.assertEqual(matching[0]["customer_verified"], 1)

        # 2. Rider accepts booking
        accept_resp = self.client.post(f"/api/bookings/{b_id}/accept", json={})
        self.assertEqual(accept_resp.status_code, 200)

        # 3. Rider completes booking
        comp_resp = self.client.post(f"/api/bookings/{b_id}/status", json={"status": "completed"})
        self.assertEqual(comp_resp.status_code, 200)

        # 4. Check rider transactions endpoint
        rider_txns_resp = self.client.get("/api/rider/transactions")
        self.assertEqual(rider_txns_resp.status_code, 200)
        tx_data = rider_txns_resp.get_json()
        self.assertTrue(tx_data["success"])
        self.assertTrue(tx_data["today_earnings"] > 0)
        matching_tx = [t for t in tx_data["transactions"] if t["booking_code"] == b_code]
        self.assertTrue(len(matching_tx) > 0)
        self.assertEqual(matching_tx[0]["status"], "completed")

        # 5. Check Admin transactions view
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True

        admin_page = self.client.get("/admin")
        self.assertEqual(admin_page.status_code, 200)
        admin_html = admin_page.get_data(as_text=True)
        self.assertIn("Master Transactions Ledger", admin_html)
        self.assertIn(b_code, admin_html)
        self.assertIn("Registered Customers Directory", admin_html)

        # 6. Admin toggle customer verify
        cust_list_resp = self.client.get("/api/admin/transactions")
        self.assertEqual(cust_list_resp.status_code, 200)

        toggle_resp = self.client.post("/api/admin/customers/1/toggle-verify")
        self.assertEqual(toggle_resp.status_code, 200)
        self.assertTrue(toggle_resp.get_json()["success"])

    def test_unauthenticated_booking_blocked_in_production_mode(self):
        prod_app = create_app({"TESTING": False, "CSRF_ENABLED": False, "DB_PATH": self.db_path})
        client = prod_app.test_client()

        # Attempt to broadcast without sign in
        resp = client.post(
            "/api/bookings",
            json={
                "customer_name": "Unverified Passenger",
                "customer_phone": "09990001122",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Public Market",
                "dropoff_address": "Agoho, Mambajao",
            },
        )
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Please Sign In or Register first", resp.get_json()["error"])

        # Broadcast with inline registration password succeeds
        resp2 = client.post(
            "/api/bookings",
            json={
                "customer_name": "Unverified Passenger",
                "customer_phone": "09990001122",
                "customer_password": "mypassword123",
                "customer_barangay": "Mambajao",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Public Market",
                "dropoff_address": "Agoho, Mambajao",
            },
        )
        self.assertEqual(resp2.status_code, 201)
        self.assertEqual(resp2.get_json()["booking"]["customer_phone"], "09990001122")

    def test_customer_history_and_active_booking_endpoints(self):
        # Test creating booking then fetching history and active booking by phone
        with self.app.app_context():
            conn = self.app.get_db() if hasattr(self.app, 'get_db') else None
        
        # Post booking via test client
        resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Test History User",
                "customer_phone": "09187654321",
                "service_type": "pahatud",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "Sunken Cemetery",
                "fare_amount": 120.0,
            },
        )
        self.assertEqual(resp.status_code, 201)
        code = resp.get_json()["booking"]["booking_code"]

        # Fetch history via exact phone
        h_resp = self.client.get("/api/customer/history/09187654321")
        self.assertEqual(h_resp.status_code, 200)
        h_data = h_resp.get_json()
        self.assertTrue(h_data["success"])
        self.assertEqual(len(h_data["history"]), 1)
        self.assertEqual(h_data["history"][0]["booking_code"], code)

        # Fetch history with formatted phone (spaces)
        hf_resp = self.client.get("/api/customer/history/0918%20765%204321")
        self.assertEqual(hf_resp.status_code, 200)
        self.assertEqual(len(hf_resp.get_json()["history"]), 1)

        # Fetch active booking via phone query parameter
        act_resp = self.client.get("/api/customer/active-booking?phone=09187654321")
        self.assertEqual(act_resp.status_code, 200)
        act_data = act_resp.get_json()
        self.assertTrue(act_data["active"])
        self.assertEqual(act_data["booking"]["booking_code"], code)

    def test_header_navigation_role_separation(self):
        # 1. On /rider, customer-signin-btn must NOT be present
        r_resp = self.client.get("/rider")
        self.assertEqual(r_resp.status_code, 200)
        r_html = r_resp.get_data(as_text=True)
        self.assertNotIn('id="customer-signin-btn"', r_html)
        self.assertIn("Rider Hub", r_html)

        # 2. On /track/CODE, tracking page renders cleanly
        resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Track Passenger",
                "customer_phone": "09112223344",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Port",
                "dropoff_address": "Agoho",
            },
        )
        self.assertEqual(resp.status_code, 201)
        code = resp.get_json()["booking"]["booking_code"]

        track_resp = self.client.get(f"/track/{code}")
        self.assertEqual(track_resp.status_code, 200)
        t_html = track_resp.get_data(as_text=True)
        self.assertIn(code, t_html)
        self.assertIn("Universal Header Auth Sync", t_html)

    def test_customer_and_rider_registration_and_login_flow(self):
        # 0. Missing or invalid email should fail with 400
        invalid_email_reg = self.client.post(
            "/api/customer/register",
            json={
                "name": "No Email",
                "phone": "0917 111 2233",
                "password": "secretpassword",
                "email": "not-an-email",
            },
        )
        self.assertEqual(invalid_email_reg.status_code, 400)

        # 1. Customer registration with spaced phone
        c_reg = self.client.post(
            "/api/customer/register",
            json={
                "name": "Maria Test",
                "phone": "0917 999 8888",
                "email": "maria.reg@example.com",
                "avatar_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "password": "secretpassword",
                "barangay": "Mambajao",
            },
        )
        self.assertEqual(c_reg.status_code, 200)
        c_data = c_reg.get_json()
        self.assertTrue(c_data["success"])
        self.assertEqual(c_data["customer"]["phone"], "09179998888")

        # Customer login with unspaced phone
        c_login = self.client.post(
            "/api/customer/login",
            json={
                "phone": "09179998888",
                "password": "secretpassword",
            },
        )
        self.assertEqual(c_login.status_code, 200)
        self.assertTrue(c_login.get_json()["success"])

        # When customer is logged in, rider nav link is hidden from customer bottom nav
        home_resp = self.client.get("/")
        self.assertEqual(home_resp.status_code, 200)
        home_html = home_resp.get_data(as_text=True)
        self.assertNotIn('id="bottom-nav-rider"', home_html)

        # 2. Rider registration returns pending rider
        r_reg = self.client.post(
            "/api/rider/register",
            json={
                "name": "Rider AutoActive",
                "phone": "0918 555 4444",
                "password": "ridersecret",
                "license_no": "A01-99-888888",
                "bike_model": "Suzuki Raider 150",
                "plate_number": "777-XYZ",
                "municipality": "Mambajao",
            },
        )
        self.assertEqual(r_reg.status_code, 201)
        r_data = r_reg.get_json()
        self.assertTrue(r_data["success"])
        self.assertTrue(r_data["pending"])
        self.assertIn("rider", r_data)
        self.assertEqual(r_data["rider"]["status"], "pending")
        self.assertEqual(r_data["rider"]["phone"], "09185554444")
        new_rider_id = r_data["rider"]["id"]

        # Rider login while pending is blocked
        r_login_pending = self.client.post(
            "/api/rider/login",
            json={
                "phone": "09185554444",
                "password": "ridersecret",
            },
        )
        self.assertEqual(r_login_pending.status_code, 403)
        self.assertTrue(r_login_pending.get_json().get("pending"))

        # Admin approves in-person application
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
        appr = self.client.post(f"/api/admin/riders/{new_rider_id}/status", json={"status": "active"})
        self.assertEqual(appr.status_code, 200)

        # Rider login now succeeds
        r_login = self.client.post(
            "/api/rider/login",
            json={
                "phone": "09185554444",
                "password": "ridersecret",
            },
        )
        self.assertEqual(r_login.status_code, 200)
        self.assertTrue(r_login.get_json()["success"])
        self.assertEqual(r_login.get_json()["rider"]["status"], "active")

    def test_customer_avatar_display_and_admin_delete_protection(self):
        # 1. Register customer with avatar photo
        sample_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        reg_resp = self.client.post(
            "/api/customer/register",
            json={
                "name": "Maria Clara Santos",
                "phone": "0917 888 7766",
                "email": "maria.clara@gmail.com",
                "password": "mariapassword123",
                "barangay": "Agoho, Mambajao",
                "avatar_base64": sample_b64,
            },
        )
        self.assertEqual(reg_resp.status_code, 200)
        c_data = reg_resp.get_json()["customer"]
        c_id = c_data["id"]
        self.assertTrue(bool(c_data["avatar_url"]))
        self.assertIn("/media/", c_data["avatar_url"])

        # 2. Check customer profile session has avatar
        with self.client.session_transaction() as sess:
            self.assertEqual(sess["customer_phone"], "09178887766")
            self.assertEqual(sess["customer_avatar"], c_data["avatar_url"])

        # 3. Non-admin cannot delete customer or rider (403 forbidden)
        rid = self._create_active_rider(name="Protected Rider", phone="09172223344")
        del_rider_unauth = self.client.post(f"/api/admin/riders/{rid}/delete")
        self.assertEqual(del_rider_unauth.status_code, 403)

        del_cust_unauth = self.client.post(f"/api/admin/customers/{c_id}/delete")
        self.assertEqual(del_cust_unauth.status_code, 403)

        # 4. Admin deletes successfully
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True

        del_rider_ok = self.client.post(f"/api/admin/riders/{rid}/delete")
        self.assertEqual(del_rider_ok.status_code, 200)

        del_cust_ok = self.client.post(f"/api/admin/customers/{c_id}/delete")
        self.assertEqual(del_cust_ok.status_code, 200)

        # Deleting non-existent returns 404
        del_404 = self.client.post(f"/api/admin/customers/{c_id}/delete")
        self.assertEqual(del_404.status_code, 404)

    def test_forgot_password_and_admin_reset_flow(self):
        # 1. Setup Rider for forgot-password tests
        r_id = self._create_active_rider(name="Rider Forgot Test", phone="09175551234", bike_model="Yamaha Aerox")
        from db import get_connection
        conn = get_connection(self.db_path)
        try:
            conn.execute("UPDATE riders SET plate_number = '789-CCRC', license_no = 'D01-99-123456' WHERE id = ?", (r_id,))
            conn.commit()
        finally:
            conn.close()

        # Rider Forgot Password - Wrong plate/license
        bad_rider_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "WRONGPLATE", "new_password": "newriderpwd123"},
        )
        self.assertEqual(bad_rider_fp.status_code, 400)

        # Rider Forgot Password - Short password
        short_rider_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "789-CCRC", "new_password": "123"},
        )
        self.assertEqual(short_rider_fp.status_code, 400)

        # Rider Forgot Password - Public Plate Number should be rejected (security)
        plate_rider_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "789CCRC", "new_password": "newriderpwd123"},
        )
        self.assertEqual(plate_rider_fp.status_code, 400)

        # Rider Forgot Password - Valid with Driver's License
        ok_rider_license_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "D01-99-123456", "new_password": "licenseriderpwd456"},
        )
        self.assertEqual(ok_rider_license_fp.status_code, 200)

        # Rider can now login with new password
        rider_login_resp = self.client.post(
            "/api/rider/login",
            json={"phone": "09175551234", "password": "licenseriderpwd456"},
        )
        self.assertEqual(rider_login_resp.status_code, 200)

        # 2. Setup Customer for forgot-password tests
        c_id = self._create_customer(name="Customer Forgot Test", phone="09187778899", password="initialpass123")
        conn = get_connection(self.db_path)
        try:
            conn.execute("UPDATE customers SET email = 'customer.test@gmail.com' WHERE id = ?", (c_id,))
            conn.commit()
        finally:
            conn.close()

        # Customer Forgot Password - Wrong email
        bad_cust_fp = self.client.post(
            "/api/customer/forgot-password",
            json={"phone": "09187778899", "email": "wrongemail@gmail.com", "new_password": "newcustpwd123"},
        )
        self.assertEqual(bad_cust_fp.status_code, 400)

        # Customer Forgot Password - Valid email
        ok_cust_fp = self.client.post(
            "/api/customer/forgot-password",
            json={"phone": "09187778899", "email": "customer.test@gmail.com", "new_password": "newcustpwd123"},
        )
        self.assertEqual(ok_cust_fp.status_code, 200)
        self.assertTrue(ok_cust_fp.get_json()["success"])

        # Customer can now login with new password
        cust_login_resp = self.client.post(
            "/api/customer/login",
            json={"phone": "09187778899", "password": "newcustpwd123"},
        )
        self.assertEqual(cust_login_resp.status_code, 200)

        # 3. Admin Reset Password Endpoints
        # Unauthorized check
        admin_unauth = self.client.post(f"/api/admin/riders/{r_id}/reset-password", json={"new_password": "adminpwd123"})
        self.assertEqual(admin_unauth.status_code, 403)

        with self.client.session_transaction() as sess:
            sess["is_admin"] = True

        admin_rider_reset = self.client.post(f"/api/admin/riders/{r_id}/reset-password", json={"new_password": "adminridernew123"})
        self.assertEqual(admin_rider_reset.status_code, 200)

        admin_cust_reset = self.client.post(f"/api/admin/customers/{c_id}/reset-password", json={"new_password": "admincustnew123"})
        self.assertEqual(admin_cust_reset.status_code, 200)

        # Both login successfully with admin-reset passwords
        r_after_admin = self.client.post("/api/rider/login", json={"phone": "09175551234", "password": "adminridernew123"})
        self.assertEqual(r_after_admin.status_code, 200)

        c_after_admin = self.client.post("/api/customer/login", json={"phone": "09187778899", "password": "admincustnew123"})
        self.assertEqual(c_after_admin.status_code, 200)

    def test_login_with_phone_or_email_for_customer_and_rider(self):
        from db import get_connection
        # 1. Customer registration with email and phone
        c_reg = self.client.post(
            "/api/customer/register",
            json={
                "name": "Liza Soberano",
                "phone": "09201234567",
                "email": "liza.soberano@gmail.com",
                "password": "secretcust123",
            },
        )
        self.assertIn(c_reg.status_code, (200, 201))

        # Login using exact phone
        res1 = self.client.post("/api/customer/login", json={"phone": "09201234567", "password": "secretcust123"})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.get_json()["customer"]["name"], "Liza Soberano")

        # Login using email in the phone field
        res2 = self.client.post("/api/customer/login", json={"phone": "liza.soberano@gmail.com", "password": "secretcust123"})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()["customer"]["phone"], "09201234567")

        # Login using case-insensitive email
        res3 = self.client.post("/api/customer/login", json={"phone": "LIZA.SOBERANO@GMAIL.COM", "password": "secretcust123"})
        self.assertEqual(res3.status_code, 200)

        # Login using formatted phone (+63 920 123 4567)
        res4 = self.client.post("/api/customer/login", json={"phone": "+63 920 123 4567", "password": "secretcust123"})
        self.assertEqual(res4.status_code, 200)

        # Customer history lookup via email
        res_hist = self.client.get("/api/customer/history/liza.soberano@gmail.com")
        self.assertEqual(res_hist.status_code, 200)
        self.assertEqual(res_hist.get_json()["customer"]["phone"], "09201234567")

        # 2. Rider registration with email and phone
        r_reg = self.client.post(
            "/api/rider/register",
            json={
                "name": "Pedro Penduko",
                "phone": "09281234567",
                "email": "pedro.rider@gmail.com",
                "password": "ridersecret123",
                "bike_model": "Honda Click 125",
                "plate_number": "MC-9988",
                "license_no": "P02-88-123456",
                "municipality": "Mambajao",
                "avatar_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            },
        )
        self.assertIn(r_reg.status_code, (200, 201))
        r_id = r_reg.get_json()["rider"]["id"]

        # Approve rider via DB so login succeeds
        conn = get_connection(self.db_path)
        try:
            conn.execute("UPDATE riders SET status = 'active' WHERE id = ?", (r_id,))
            conn.commit()
        finally:
            conn.close()

        # Login rider with phone
        r_login_phone = self.client.post("/api/rider/login", json={"phone": "09281234567", "password": "ridersecret123"})
        self.assertEqual(r_login_phone.status_code, 200)
        self.assertEqual(r_login_phone.get_json()["rider"]["name"], "Pedro Penduko")

        # Login rider with email in phone field
        r_login_email = self.client.post("/api/rider/login", json={"phone": "pedro.rider@gmail.com", "password": "ridersecret123"})
        self.assertEqual(r_login_email.status_code, 200)
        self.assertEqual(r_login_email.get_json()["rider"]["id"], r_id)

        # Login rider with case-insensitive email
        r_login_email_upper = self.client.post("/api/rider/login", json={"phone": "PEDRO.RIDER@GMAIL.COM", "password": "ridersecret123"})
        self.assertEqual(r_login_email_upper.status_code, 200)

        # Login rider with plate number
        r_login_plate = self.client.post("/api/rider/login", json={"phone": "MC-9988", "password": "ridersecret123"})
        self.assertEqual(r_login_plate.status_code, 200)

    def test_rider_portal_contains_active_job_map(self):
        resp = self.client.get("/rider")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)
        self.assertIn("rider-job-map-container", html)
        self.assertIn("rider-job-map", html)
        self.assertIn("data-rider-job-layer", html)
        self.assertIn("rider-job-recenter-btn", html)
        self.assertIn("rider-job-fullscreen-btn", html)

    def test_security_and_regression_fixes(self):
        from db import accept_booking, export_full_backup, get_connection, restore_full_backup, update_booking_status

        # 1. Admin settings requires admin auth
        unauth_set = self.client.post("/api/admin/settings", json={"base_fare": 1})
        self.assertEqual(unauth_set.status_code, 403)

        # 2. Admin login rejects hardcoded backdoor once password hash is set
        from werkzeug.security import generate_password_hash
        conn = get_connection(self.db_path)
        try:
            conn.execute(
                "UPDATE settings SET value = ? WHERE key = 'admin_password_hash'",
                (generate_password_hash("super-secret-admin-99"),),
            )
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(self.client.post("/api/admin/login", json={"password": "admin1234"}).status_code, 401)
        self.assertEqual(self.client.post("/api/admin/login", json={"password": "admin"}).status_code, 401)
        self.assertEqual(self.client.post("/api/admin/login", json={"password": "super-secret-admin-99"}).status_code, 200)

        # 3. /tours renders all packages properly
        tours_resp = self.client.get("/tours")
        self.assertEqual(tours_resp.status_code, 200)
        tours_html = tours_resp.get_data(as_text=True)
        self.assertIn("White Island &amp; Mambajao Coast Tour", tours_html)
        self.assertIn("450", tours_html)

        # 4. Cancelled booking cannot be accepted, and completed + review does not double-count total_trips
        r_id = self._create_active_rider(name="Rider Regression", phone="09179990001")
        b_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Test User",
                "customer_phone": "09179990002",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Public Market",
                "dropoff_address": "Jollibee Camiguin",
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        b_id = b_resp.get_json()["booking"]["id"]

        # Unauthenticated status update is blocked
        with self.client.session_transaction() as sess:
            sess.clear()
        self.assertEqual(self.client.post(f"/api/bookings/{b_id}/status", json={"status": "completed"}).status_code, 403)

        # Cancel booking and verify accept_booking refuses it
        conn = get_connection(self.db_path)
        try:
            self.assertTrue(update_booking_status(conn, b_id, "cancelled"))
            self.assertFalse(accept_booking(conn, b_id, r_id))
            conn.commit()
        finally:
            conn.close()

        # Backup & restore preserves customers, promo_codes, and transactions
        conn = get_connection(self.db_path)
        try:
            snap = export_full_backup(conn)
            self.assertIn("customers", snap["tables"])
            self.assertIn("transactions", snap["tables"])
            self.assertIn("promo_codes", snap["tables"])
            res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(res["success"])
        finally:
            conn.close()

        # 5. CSRF protection rejects missing token and accepts valid token when enabled
        csrf_app = create_app({"TESTING": True, "CSRF_ENABLED": True, "DB_PATH": self.db_path})
        c_client = csrf_app.test_client()
        home_html = c_client.get("/").get_data(as_text=True)
        import re
        m = re.search(r'<meta name="csrf-token" content="([^"]+)"', home_html)
        self.assertIsNotNone(m)
        csrf_tok = m.group(1)

        no_csrf = c_client.post("/api/promo/validate", json={"code": "INVALID", "fare_amount": 100})
        self.assertEqual(no_csrf.status_code, 403)

        with_csrf = c_client.post(
            "/api/promo/validate",
            json={"code": "INVALID", "fare_amount": 100},
            headers={"X-CSRF-Token": csrf_tok},
        )
        self.assertEqual(with_csrf.status_code, 400)

    def test_place_search_accuracy_and_coordinates(self):
        from db import geocode_camiguin_location, search_camiguin_places

        # Balbagon Port & Barangay Balbagon must resolve to Balbagon east coast (~124.733-124.737), not Poblacion
        balbagon_port = geocode_camiguin_location("Balbagon Port")
        self.assertIsNotNone(balbagon_port)
        self.assertIn("Balbagon Port", balbagon_port["name"])
        self.assertGreater(balbagon_port["lng"], 124.73)

        balbagon_brgy = geocode_camiguin_location("Balbagon")
        self.assertIsNotNone(balbagon_brgy)
        self.assertEqual(balbagon_brgy["name"], "Balbagon, Mambajao")
        self.assertGreater(balbagon_brgy["lng"], 124.73)

        # Municipality/barangay queries should not be hijacked by schools/restaurants
        self.assertNotIn("School", geocode_camiguin_location("Mambajao")["name"])
        self.assertNotIn("School", geocode_camiguin_location("Catarman")["name"])
        self.assertEqual(geocode_camiguin_location("Yumbing")["name"], "Yumbing, Mambajao")

        # Municipality-qualified & punctuated queries must match cleanly
        sunken = geocode_camiguin_location("Sunken Cemetery, Catarman")
        self.assertIsNotNone(sunken)
        self.assertIn("Sunken Cemetery", sunken["name"])

        # /api/places/search returns ranked results
        resp = self.client.get("/api/places/search?q=Balbagon%20Port")
        self.assertEqual(resp.status_code, 200)
        places = resp.get_json()["places"]
        self.assertTrue(len(places) >= 1)
        self.assertIn("Balbagon Port", places[0]["name"])
        self.assertTrue(any("Balbagon" in p["name"] for p in search_camiguin_places("Balbagon", limit=5)))

        # Ardent Hot Spring must resolve to Sitio Esperanza foothills (~9.2270, 124.6880), NOT Yumbing coast
        for q in ("Ardent Hot Spring", "Ardent Hot Springs"):
            ardent = geocode_camiguin_location(q)
            self.assertIsNotNone(ardent, q)
            self.assertEqual(ardent["name"], "Ardent Hot Spring, Esperanza")
            self.assertTrue(9.220 <= ardent["lat"] <= 9.230, ardent)
            self.assertTrue(124.685 <= ardent["lng"] <= 124.692, ardent)

        # Verified OSM/Plus-Code landmark coordinates (preventing sea-dumped or valley-shifted pins)
        verified_checks = [
            ("White Island", "White Island Boat Jump-off, Yumbing", (9.240, 9.246), (124.658, 124.663)),
            ("Paras Beach Resort", "Paras Beach Resort, Yumbing", (9.241, 9.246), (124.659, 124.664)),
            ("Sunken Cemetery", "Sunken Cemetery & Giant Cross, Bonbon", (9.205, 9.209), (124.630, 124.635)),
            ("Old Church Ruins", "Old Church Ruins (Gui-ob Church), Bonbon", (9.200, 9.204), (124.632, 124.637)),
            ("Mount Vulcan", "Mount Vulcan Daan / Walkway to Old Volcano", (9.208, 9.213), (124.638, 124.642)),
            ("Benoni Port", "Benoni Port / Ferry Wharf, Mahinog", (9.137, 9.142), (124.792, 124.796)),
            ("Benoni Passenger Terminal", "Benoni Passenger Terminal, Mahinog", (9.137, 9.142), (124.791, 124.796)),
            ("Guinsiliban Port", "Guinsiliban Port / Ferry Terminal", (9.097, 9.101), (124.786, 124.791)),
            ("Giant Clam Sanctuary", "Giant Clam Sanctuary, Cantaan", (9.104, 9.108), (124.801, 124.805)),
            ("Katunggan Mangrove Park", "Katunggan Mangrove Park, Mahinog", (9.129, 9.134), (124.795, 124.799)),
            ("Bura Soda Water", "Bura Soda Water Park, Catarman", (9.169, 9.173), (124.655, 124.659)),
            ("Tuasan Falls", "Tuasan Falls, Mainit, Catarman", (9.174, 9.179), (124.678, 124.683)),
            ("Katibawasan Falls", "Katibawasan Falls", (9.211, 9.216), (124.716, 124.721)),
            ("Camiguin Highland Resort", "Camiguin Highland Resort, Soro-soro", (9.216, 9.220), (124.726, 124.731)),
            ("Camiguin Lanzones Resort", "Camiguin Lanzones Resort, Balbagon", (9.239, 9.243), (124.734, 124.738)),
            ("Lanzones Cabana", "Lanzones Cabana, Agoho", (9.240, 9.244), (124.665, 124.670)),
            ("Camiguin Airport", "Camiguin Airport", (9.249, 9.253), (124.703, 124.707)),
            ("Catarman Public Market", "Catarman Public Market", (9.123, 9.128), (124.671, 124.676)),
            ("Somewhere Else Boutique Resort", "Somewhere Else Boutique Resort, Agoho", (9.248, 9.252), (124.669, 124.673)),
            ("Balai sa Baibai", "Balai sa Baibai Dive Resort, Agoho", (9.248, 9.252), (124.668, 124.672)),
        ]
        for query, expected_name, (lat_lo, lat_hi), (lng_lo, lng_hi) in verified_checks:
            hit = geocode_camiguin_location(query)
            self.assertIsNotNone(hit, query)
            self.assertEqual(hit["name"], expected_name, query)
            self.assertTrue(lat_lo <= hit["lat"] <= lat_hi, (query, hit))
            self.assertTrue(lng_lo <= hit["lng"] <= lng_hi, (query, hit))

        # Coastal barangays keep flat coastal match while Timogsay & Upper Cogon resolve cleanly to uplands
        self.assertEqual(geocode_camiguin_location("Agoho")["name"], "Agoho, Mambajao")
        self.assertEqual(geocode_camiguin_location("Bug-ong")["name"], "Bug-ong, Mambajao")
        for q in ("Timogsay", "Timugsay", "Upper Bug-ong"):
            hit = geocode_camiguin_location(q)
            self.assertIsNotNone(hit, q)
            self.assertEqual(hit["name"], "Timogsay, Bug-ong, Mambajao", q)
            self.assertTrue(9.234 <= hit["lat"] <= 9.240, (q, hit))
            self.assertTrue(124.677 <= hit["lng"] <= 124.682, (q, hit))
        for q in ("Upper Cogon", "Cogon, Agoho", "Upper Agoho"):
            hit = geocode_camiguin_location(q)
            self.assertIsNotNone(hit, q)
            self.assertEqual(hit["name"], "Upper Cogon, Agoho, Mambajao", q)
            self.assertTrue(9.233 <= hit["lat"] <= 9.239, (q, hit))
            self.assertTrue(124.671 <= hit["lng"] <= 124.677, (q, hit))

        # Exact 58 official PSA Camiguin barangays
        from db import CAMIGUIN_HIGHWAY_WAYPOINTS, CAMIGUIN_KNOWN_PLACES, CAMIGUIN_TOUR_PACKAGES, compute_island_road_network_route

        brgys = [p for p in CAMIGUIN_KNOWN_PLACES if p["cat"] == "barangay"]
        self.assertEqual(len(brgys), 58)
        self.assertEqual(len({p["name"] for p in brgys}), 58)

        # Every tour package stop resolves accurately
        for pkg in CAMIGUIN_TOUR_PACKAGES:
            for stop in pkg["itinerary"]:
                self.assertIsNotNone(geocode_camiguin_location(stop), f"Unresolved tour stop: {stop}")

        # Circumferential highway loop integrity and offline routing sanity
        self.assertEqual(CAMIGUIN_HIGHWAY_WAYPOINTS[0][:2], CAMIGUIN_HIGHWAY_WAYPOINTS[-1][:2])
        self.assertEqual(CAMIGUIN_HIGHWAY_WAYPOINTS[0][3], 0.0)
        self.assertAlmostEqual(CAMIGUIN_HIGHWAY_WAYPOINTS[-1][3], 63.85, places=1)
        kms = [w[3] for w in CAMIGUIN_HIGHWAY_WAYPOINTS]
        self.assertTrue(all(kms[i] < kms[i + 1] for i in range(len(kms) - 1)))
        offline_km, _ = compute_island_road_network_route(9.25057, 124.70110, 9.24971, 124.71667)
        self.assertGreater(offline_km, 1.0)
        self.assertLessEqual(offline_km, 2.2)

        # DB <-> JS directory parity & UI consistency
        import html
        import json
        import re
        from pathlib import Path

        root = Path(__file__).resolve().parent.parent
        app_js = (root / "static/js/app.js").read_text(encoding="utf-8")
        self.assertNotIn("Na-set", app_js)
        js_match = re.search(r"let CAMIGUIN_PLACES = (\[.*?\r?\n\]);", app_js, re.S)
        self.assertIsNotNone(js_match)
        js_places = json.loads(js_match.group(1))
        self.assertEqual(js_places, CAMIGUIN_KNOWN_PLACES)

        index_html = (root / "templates/index.html").read_text(encoding="utf-8")
        chips_block = re.search(r'id="quick-landmark-chips">(.*?)</div>', index_html, re.S)
        self.assertIsNotNone(chips_block)
        db_by_name = {p["name"]: p for p in CAMIGUIN_KNOWN_PLACES}
        chip_attrs = re.findall(
            r'data-name="([^"]+)"\s+data-lat="([^"]+)"\s+data-lng="([^"]+)"',
            chips_block.group(1),
        )
        self.assertTrue(any("Ardent Hot Spring" in html.unescape(n) for n, _, _ in chip_attrs))
        for raw_name, lat_s, lng_s in chip_attrs:
            cname = html.unescape(raw_name)
            self.assertIn(cname, db_by_name)
            self.assertAlmostEqual(float(lat_s), db_by_name[cname]["lat"], places=4)
            self.assertAlmostEqual(float(lng_s), db_by_name[cname]["lng"], places=4)

    def test_auto_hinterland_surcharge_upland_routes(self):
        from db import CAMIGUIN_HIGHWAY_WAYPOINTS, CAMIGUIN_KNOWN_PLACES, is_hinterland_route

        # 1. Verify zero false positives on coastal Circumferential Highway waypoints
        for lat, lng, label, _ in CAMIGUIN_HIGHWAY_WAYPOINTS:
            self.assertFalse(
                is_hinterland_route(pickup_lat=lat, pickup_lng=lng),
                f"Coastal highway waypoint falsely flagged upland: {label}",
            )

        # 2. Verify Mambajao, Catarman, Mahinog, Sagay & Guinsiliban upland / hinterland places
        # automatically add +₱30 across BOTH /api/fare-estimate AND /api/bookings (including Passenger rides!)
        upland_cases = [
            # Mambajao
            ("Mambajao Town Plaza", "Soro-soro, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Utopia Café, Mambajao", "pahatud"),
            ("Poblacion, Mambajao", "Camiguin Highland Resort, Soro-soro", "pabili"),
            ("Mambajao Town Plaza", "Ardent Hot Spring, Esperanza", "pahatud"),
            ("Gaisano Capital Camiguin", "Katibawasan Falls", "pasugo"),
            ("Mambajao Town Plaza", "Binunsaran, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Sa-ay Cold Spring, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Tagdo, Mambajao", "pahatud"),
            ("Poblacion, Mambajao", "Brgy. Tagdo", "pabili"),
            ("Mambajao Town Plaza", "Timogsay, Bug-ong, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Timugsay, Bug-ong", "pabili"),
            ("Mambajao Town Plaza", "Upper Cogon, Agoho, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Benhaan, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Upper Pandan (Kanangkaan / Maubog), Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Litican, Upper Balbagon, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Upper Lakas, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Upper Magting, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Macao Cold Spring, Tupsan", "pahatud"),
            ("Mambajao Town Plaza", "Sitio Bas-iao, Yumbing, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Katobli / Sibato Reservoir, Mambajao", "pahatud"),
            ("Mambajao Town Plaza", "Volcano House (Km 11 Itum), Mambajao", "pahatud"),
            # Catarman
            ("Catarman Public Market", "Tuasan Falls, Mainit, Catarman", "pahatud"),
            ("Catarman Public Market", "Sto. Niño Cold Spring, Catarman", "pahatud"),
            ("Catarman Public Market", "Santo Niño, Catarman", "pahatud"),
            ("Catarman Public Market", "Mainit, Catarman", "pahatud"),
            ("Catarman Public Market", "Manduao, Catarman", "pahatud"),
            ("Catarman Public Market", "Bura Soda Water Park, Catarman", "pahatud"),
            ("Catarman Public Market", "Liloan, Catarman", "pahatud"),
            ("Catarman Public Market", "Mount Vulcan Daan / Walkway to Old Volcano", "pahatud"),
            ("Catarman Public Market", "Piyakong / Tres Marias Slopes, Catarman", "pahatud"),
            # Mahinog
            ("Benoni Port / Ferry Wharf, Mahinog", "Owakan, Mahinog", "pahatud"),
            ("Benoni Port / Ferry Wharf, Mahinog", "Puntod, Mahinog", "pahatud"),
            ("Benoni Port / Ferry Wharf, Mahinog", "San Isidro, Mahinog", "pahatud"),
            ("Benoni Port / Ferry Wharf, Mahinog", "San Miguel, Mahinog", "pahatud"),
            ("Benoni Port / Ferry Wharf, Mahinog", "Tubod, Mahinog", "pahatud"),
            ("Benoni Port / Ferry Wharf, Mahinog", "Tupsan Pequeño, Mahinog", "pahatud"),
            # Sagay
            ("Sagay Municipal Hall", "Binangawan Falls, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Mantalaga Falls, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Cuna, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Sitio Kital-is, Cuna, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Bacnit, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Bugang, Sagay", "pahatud"),
            ("Sagay Municipal Hall", "Mayana, Sagay", "pahatud"),
            # Guinsiliban
            ("Guinsiliban Port / Ferry Terminal", "Butay, Guinsiliban", "pahatud"),
            ("Guinsiliban Port / Ferry Terminal", "Cabuan, Guinsiliban", "pahatud"),
            ("Guinsiliban Port / Ferry Terminal", "Upper Cantaan, Guinsiliban", "pahatud"),
        ]
        booking_check_dropoffs = {
            "Soro-soro, Mambajao",
            "Utopia Café, Mambajao",
            "Camiguin Highland Resort, Soro-soro",
            "Ardent Hot Spring, Esperanza",
            "Katibawasan Falls",
            "Tagdo, Mambajao",
            "Timogsay, Bug-ong, Mambajao",
            "Upper Cogon, Agoho, Mambajao",
            "Upper Pandan (Kanangkaan / Maubog), Mambajao",
            "Sto. Niño Cold Spring, Catarman",
            "Owakan, Mahinog",
            "Mantalaga Falls, Sagay",
            "Upper Cantaan, Guinsiliban",
        }
        for idx, (pickup_q, dropoff_q, svc) in enumerate(upland_cases):
            est_resp = self.client.post(
                "/api/fare-estimate",
                json={
                    "pickup_address": pickup_q,
                    "dropoff_address": dropoff_q,
                    "service_type": svc,
                },
            )
            self.assertEqual(est_resp.status_code, 200)
            est = est_resp.get_json()
            self.assertTrue(est["auto_hinterland"], (pickup_q, dropoff_q, est))
            self.assertEqual(est["breakdown"]["hinterland_fee"], 30.0, (pickup_q, dropoff_q))
            expected_service_fee = 20.0 if svc in ("pabili", "pasugo", "pabayad") else 0.0
            self.assertEqual(est["breakdown"]["service_fee"], expected_service_fee)
            self.assertEqual(
                est["fare_amount"],
                round(est["breakdown"]["meter_fare"] + expected_service_fee + 30.0),
            )

            if dropoff_q in booking_check_dropoffs:
                book_resp = self.client.post(
                    "/api/bookings",
                    json={
                        "customer_name": f"Upland Passenger {idx}",
                        "customer_phone": f"091700011{idx:02d}",
                        "pickup_address": pickup_q,
                        "dropoff_address": dropoff_q,
                        "service_type": svc,
                        "is_hinterland": False,  # Server MUST auto-enforce even if omitted/false
                    },
                )
                self.assertEqual(book_resp.status_code, 201)
                booked = book_resp.get_json()
                self.assertEqual(booked["breakdown"]["hinterland_fee"], 30.0)
                self.assertEqual(booked["booking"]["fare_amount"], est["fare_amount"])

        # 3. Map-pinned coordinates across all 5 municipalities without place keywords still auto-add +₱30
        for d_lat, d_lng in [
            (9.22741, 124.70748),  # Utopia / Quiboro (Mambajao)
            (9.23453, 124.69148),  # Tagdo (Mambajao)
            (9.23580, 124.67380),  # Upper Cogon (Mambajao)
            (9.23750, 124.67950),  # Timogsay (Mambajao)
            (9.20322, 124.76773),  # Benhaan (Mambajao)
            (9.22850, 124.72150),  # Upper Pandan / Kanangkaan (Mambajao)
            (9.22750, 124.73300),  # Litican, Upper Balbagon (Mambajao)
            (9.23550, 124.73200),  # Upper Lakas (Mambajao)
            (9.21100, 124.74850),  # Upper Magting (Mambajao)
            (9.19586, 124.77407),  # Macao Cold Spring (Mambajao)
            (9.23150, 124.66100),  # Sitio Bas-iao (Mambajao)
            (9.22950, 124.67650),  # Katobli / Sibato Reservoir (Mambajao)
            (9.20550, 124.69750),  # Volcano House Km 11 Itum (Mambajao)
            (9.15019, 124.67424),  # Sto. Niño Cold Spring (Catarman)
            (9.17107, 124.65697),  # Bura Soda Water Park (Catarman)
            (9.15517, 124.65775),  # Mainit (Catarman)
            (9.13813, 124.67337),  # Manduao (Catarman)
            (9.14331, 124.67926),  # Liloan (Catarman)
            (9.21068, 124.64015),  # Mount Vulcan Walkway (Catarman)
            (9.20850, 124.64800),  # Piyakong / Tres Marias (Catarman)
            (9.15373, 124.76255),  # Owakan (Mahinog)
            (9.15603, 124.77313),  # Puntod (Mahinog)
            (9.18171, 124.76971),  # San Isidro (Mahinog)
            (9.13051, 124.78384),  # San Miguel (Mahinog)
            (9.16090, 124.78326),  # Tubod (Mahinog)
            (9.19518, 124.77836),  # Tupsan Pequeño (Mahinog)
            (9.12148, 124.74358),  # Cuna (Sagay)
            (9.13100, 124.74200),  # Sitio Kital-is (Sagay)
            (9.12643, 124.70861),  # Bacnit (Sagay)
            (9.10841, 124.70507),  # Bugang (Sagay)
            (9.10524, 124.71876),  # Mayana (Sagay)
            (9.14250, 124.72650),  # Mantalaga Falls (Sagay)
            (9.10476, 124.76919),  # Butay (Guinsiliban)
            (9.11881, 124.79810),  # Cabuan (Guinsiliban)
            (9.11350, 124.78200),  # Upper Cantaan (Guinsiliban)
        ]:
            pin_est = self.client.post(
                "/api/fare-estimate",
                json={
                    "pickup_address": "Pinned Pickup",
                    "pickup_lat": 9.24958,
                    "pickup_lng": 124.71654,
                    "dropoff_address": "Pinned Dropoff",
                    "dropoff_lat": d_lat,
                    "dropoff_lng": d_lng,
                    "service_type": "pahatud",
                },
            )
            self.assertEqual(pin_est.status_code, 200)
            pin_data = pin_est.get_json()
            self.assertTrue(pin_data["auto_hinterland"], (d_lat, d_lng))
            self.assertEqual(pin_data["breakdown"]["hinterland_fee"], 30.0, (d_lat, d_lng))

        # 4. Flat coastal routes must NOT receive upland surcharge
        for pickup_q, dropoff_q in [
            ("Moonflower Garden, Baylao", "Jollibee Camiguin"),
            ("Balbagon Port", "White Island Boat Jump-off, Yumbing"),
            ("Pandan, Mambajao", "Mambajao Town Plaza"),
            ("Lakas, Poblacion, Mambajao", "Mambajao Town Plaza"),
            ("Magting, Mambajao", "Mambajao Town Plaza"),
            ("Tupsan, Mambajao", "Mambajao Town Plaza"),
            ("Kuguita, Mambajao", "Agoho, Mambajao"),
            ("Poblacion, Mambajao", "Agoho, Mambajao"),
            ("Poblacion, Mambajao", "Bug-ong, Mambajao"),
            ("Mambajao Town Plaza", "Lanzones Cabana, Agoho"),
            ("Mambajao Town Plaza", "Nype Stile Resort, Bug-ong"),
            ("Mambajao Town Plaza", "Paradiso Restaurant, Agoho"),
            ("Sunken Cemetery & Giant Cross, Bonbon", "Old Church Ruins (Gui-ob Church), Bonbon"),
            ("Benoni Port / Ferry Wharf, Mahinog", "Hubangon, Mahinog"),
            ("Cantaan, Guinsiliban", "Giant Clam Sanctuary, Cantaan"),
            ("Sagay Municipal Hall", "Bonbon, Sagay"),
        ]:
            flat_est = self.client.post(
                "/api/fare-estimate",
                json={
                    "pickup_address": pickup_q,
                    "dropoff_address": dropoff_q,
                    "service_type": "pahatud",
                },
            ).get_json()
            self.assertFalse(flat_est["auto_hinterland"], (pickup_q, dropoff_q))
            self.assertEqual(flat_est["breakdown"]["hinterland_fee"], 0.0, (pickup_q, dropoff_q))

        # 5. Home template & i18n reflect Tagdo / Timogsay / Upper Cogon + upland badge labels
        home_html = self.client.get("/").get_data(as_text=True)
        self.assertIn('id="fare-breakdown-badges"', home_html)
        self.assertIn("Tagdo", home_html)
        self.assertIn("Timogsay", home_html)
        self.assertIn("Upper Cogon", home_html)
        i18n_js = self.client.get("/static/js/i18n.js").get_data(as_text=True)
        self.assertIn("Steep / Upland Route (Auto-Added)", i18n_js)
        self.assertIn("Tagdo, Timogsay, Upper Cogon", i18n_js)

    def test_system_audit_regression_fixes(self):
        from pathlib import Path
        from db import (
            accept_booking,
            create_review,
            export_full_backup,
            get_booking_summary_counts,
            get_connection,
            get_now_pht,
            get_rider_by_phone,
            get_rider_reviews,
            restore_full_backup,
            update_booking_status,
            validate_promo_code,
        )

        # 1. Public pages render clean club name (no club=settings overwrite) & load shared auth.js
        for route in ("/tours", "/history", "/about", "/faq", "/terms"):
            resp = self.client.get(route)
            self.assertEqual(resp.status_code, 200, route)
            html_body = resp.get_data(as_text=True)
            self.assertIn("Camiguin Centric Riders Club", html_body, route)
            self.assertIn("/static/js/auth.js?v=1", html_body, route)

        # 2. Review auto-commit persistence, API guards, duplicate protection & track already_reviewed
        r1 = self._create_active_rider(name="Audit Rider One", phone="09171110001")
        r2 = self._create_active_rider(name="Audit Rider Two", phone="09171110002")

        conn = get_connection(self.db_path)
        try:
            create_review(conn, None, r1, "Direct Reviewer", 4, "Persisted without caller commit")
        finally:
            conn.close()

        conn_check = get_connection(self.db_path)
        try:
            revs = get_rider_reviews(conn_check, r1)
            self.assertTrue(any(r["comment"] == "Persisted without caller commit" for r in revs))
        finally:
            conn_check.close()

        b_open = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Audit Passenger",
                "customer_phone": "09172220001",
                "service_type": "pahatud",
                "pickup_address": "Poblacion, Mambajao",
                "dropoff_address": "Agoho, Mambajao",
            },
        ).get_json()["booking"]

        # Validation guards before trip completion
        self.assertEqual(self.client.post("/api/reviews", json={"rider_id": r1, "rating": 0}).status_code, 400)
        self.assertEqual(self.client.post("/api/reviews", json={"rider_id": r1, "rating": 6}).status_code, 400)
        self.assertEqual(self.client.post("/api/reviews", json={"rider_id": 999999, "rating": 5}).status_code, 404)
        self.assertEqual(
            self.client.post("/api/reviews", json={"rider_id": r1, "booking_id": 999999, "rating": 5}).status_code,
            404,
        )
        self.assertEqual(
            self.client.post("/api/reviews", json={"rider_id": r1, "booking_id": b_open["id"], "rating": 5}).status_code,
            400,
        )

        # Complete trip as r1
        conn = get_connection(self.db_path)
        try:
            self.assertTrue(accept_booking(conn, b_open["id"], r1))
            self.assertTrue(update_booking_status(conn, b_open["id"], "completed"))
            conn.commit()
        finally:
            conn.close()

        # Wrong rider rejected (400)
        self.assertEqual(
            self.client.post("/api/reviews", json={"rider_id": r2, "booking_id": b_open["id"], "rating": 5}).status_code,
            400,
        )

        # Before review submission, /track/<CODE> & JSON show not reviewed
        tr_before = self.client.get(f"/track/{b_open['booking_code']}").get_data(as_text=True)
        self.assertNotIn("Your review has already been submitted", tr_before)
        tr_json_before = self.client.get(f"/api/bookings/track/{b_open['booking_code']}").get_json()
        self.assertFalse(tr_json_before["already_reviewed"])

        # Valid completed-booking review (201) + duplicate rejected (409) + optional review without booking_id (201)
        rev_ok = self.client.post(
            "/api/reviews",
            json={"rider_id": r1, "booking_id": b_open["id"], "rating": 5, "customer_name": "Audit Passenger"},
        )
        self.assertEqual(rev_ok.status_code, 201)
        rev_dup = self.client.post(
            "/api/reviews",
            json={"rider_id": r1, "booking_id": b_open["id"], "rating": 5, "customer_name": "Audit Passenger"},
        )
        self.assertEqual(rev_dup.status_code, 409)
        rev_opt = self.client.post(
            "/api/reviews",
            json={"rider_id": r1, "rating": 4, "customer_name": "Walk-in Passenger", "comment": "Smooth ride"},
        )
        self.assertEqual(rev_opt.status_code, 201)

        tr_after = self.client.get(f"/track/{b_open['booking_code']}").get_data(as_text=True)
        self.assertIn("Your review has already been submitted", tr_after)
        tr_json_after = self.client.get(f"/api/bookings/track/{b_open['booking_code']}").get_json()
        self.assertTrue(tr_json_after["already_reviewed"])

        # 3. Road route road_km, active-job authenticated boolean, start-now status guard, & chat ?after=abc tolerance
        road_resp = self.client.get("/api/road-route?p_lat=9.25405&p_lng=124.71636&d_lat=9.2400&d_lng=124.6600")
        self.assertEqual(road_resp.status_code, 200)
        road_data = road_resp.get_json()
        self.assertEqual(road_data["code"], "Ok")
        self.assertGreater(road_data["road_km"], 0)

        with self.client.session_transaction() as sess:
            sess.clear()
        aj_out = self.client.get("/api/rider/active-job").get_json()
        self.assertFalse(aj_out["authenticated"])

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1
        aj_in = self.client.get("/api/rider/active-job").get_json()
        self.assertTrue(aj_in["authenticated"])

        # start-now must reject already completed booking with 400
        start_completed = self.client.post(f"/api/bookings/{b_open['id']}/start-now")
        self.assertEqual(start_completed.status_code, 400)

        # Chat ?after=abc on GET & POST must not fail with 500 ValueError
        chat_get = self.client.get(f"/api/chat/{b_open['booking_code']}/messages?after=abc")
        self.assertEqual(chat_get.status_code, 200)
        chat_post = self.client.post(
            f"/api/chat/{b_open['booking_code']}/messages?after=abc",
            json={"message": "Safe arrival!"},
        )
        self.assertEqual(chat_post.status_code, 200)
        self.assertTrue(any(m["message"] == "Safe arrival!" for m in chat_post.get_json()["messages"]))

        # 4. Phone normalization (+63 spaces) & short-phone wildcard LIKE leak prevention
        self.client.post(
            "/api/customer/register",
            json={
                "name": "Spaced Phone User",
                "phone": "0917 888 9900",
                "email": "spaced.user@example.com",
                "password": "password123",
                "barangay": "Mambajao",
            },
        )
        spaced_book = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Spaced Phone User",
                "customer_phone": "+63 917 888 9900",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Town Plaza",
                "dropoff_address": "Agoho, Mambajao",
            },
        )
        self.assertEqual(spaced_book.status_code, 201)
        sb = spaced_book.get_json()["booking"]
        self.assertEqual(sb["customer_phone"], "09178889900")

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1
        avail = self.client.get("/api/rider/available-jobs").get_json()["jobs"]
        matched_sb = [j for j in avail if j["id"] == sb["id"]]
        self.assertEqual(len(matched_sb), 1)
        self.assertEqual(matched_sb[0]["customer_verified"], 1)

        with self.client.session_transaction() as sess:
            sess.clear()
            sess["customer_phone"] = "a"
        short_hist = self.client.get("/api/customer/history/a")
        self.assertEqual(short_hist.status_code, 200)
        self.assertEqual(short_hist.get_json()["history"], [])

        with self.client.session_transaction() as sess:
            sess.clear()
            sess["customer_phone"] = "12"
        short_act = self.client.get("/api/customer/active-booking?phone=12")
        self.assertEqual(short_act.status_code, 200)
        self.assertFalse(short_act.get_json()["active"])

        # 5. Promo code metadata + frontend recalculate hook
        conn = get_connection(self.db_path)
        try:
            conn.execute(
                "INSERT INTO promo_codes (code, discount_amount, min_fare, max_uses, uses_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("MIN100TEST", 25.0, 100.0, 10, 0, 1, "2026-01-01T00:00:00"),
            )
            conn.commit()
            p_res = validate_promo_code(conn, "MIN100TEST", 120.0)
            self.assertTrue(p_res["valid"])
            self.assertEqual(p_res["raw_discount"], 25.0)
            self.assertEqual(p_res["min_fare"], 100.0)
        finally:
            conn.close()

        root = Path(__file__).resolve().parent.parent
        app_js = (root / "static/js/app.js").read_text(encoding="utf-8")
        self.assertIn("applyPromoPreviewToFare", app_js)

        # 6. >50 rider transactions & >50 bookings SQL aggregation accuracy
        r_bulk = self._create_active_rider(name="Bulk Ledger Rider", phone="09173330001")
        today_iso = get_now_pht().strftime("%Y-%m-%d") + "T09:00:00"
        conn = get_connection(self.db_path)
        try:
            before_counts = get_booking_summary_counts(conn)
            for i in range(55):
                status = "completed" if i < 25 else "broadcast"
                ts = today_iso if i < 30 else "2026-01-01T09:00:00"
                b_id = conn.insert_returning_id(
                    """
                    INSERT INTO bookings (
                        booking_code, service_type, status, customer_name, customer_phone,
                        pickup_address, dropoff_address, fare_amount, estimated_km,
                        payment_method, rider_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"CCRC-BULK-{i:03d}",
                        "pahatud",
                        status,
                        f"Bulk Cust {i}",
                        f"0999111{i:04d}",
                        "Poblacion, Mambajao",
                        "Agoho, Mambajao",
                        100.0,
                        2.0,
                        "cash",
                        r_bulk,
                        ts,
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO transactions (
                        transaction_code, booking_id, booking_code, customer_phone, customer_name,
                        rider_id, rider_name, service_type, amount, payment_method, status, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"TXN-BULK-{i:03d}",
                        b_id,
                        f"CCRC-BULK-{i:03d}",
                        f"0999111{i:04d}",
                        f"Bulk Cust {i}",
                        r_bulk,
                        "Bulk Ledger Rider",
                        "pahatud",
                        100.0,
                        "cash",
                        "completed",
                        "Bulk audit test",
                        ts,
                    ),
                )
            conn.commit()
            after_counts = get_booking_summary_counts(conn)
            self.assertEqual(after_counts["total_bookings"], before_counts["total_bookings"] + 55)
            self.assertEqual(after_counts["completed"], before_counts["completed"] + 25)
            self.assertEqual(after_counts["active_now"], before_counts["active_now"] + 30)
        finally:
            conn.close()

        with self.client.session_transaction() as sess:
            sess.clear()
            sess["rider_id"] = r_bulk
        r_tx_resp = self.client.get("/api/rider/transactions")
        self.assertEqual(r_tx_resp.status_code, 200)
        r_tx = r_tx_resp.get_json()
        self.assertEqual(len(r_tx["transactions"]), 50)
        self.assertEqual(r_tx["total_transactions"], 55)
        self.assertEqual(r_tx["today_earnings"], 3000.0)
        self.assertEqual(r_tx["all_time_earnings"], 5500.0)

        # 7. Backup & restore fidelity for riders.email and bookings.scheduled_at/promo_code/promo_code_id/discount_amount
        r_reg = self.client.post(
            "/api/rider/register",
            json={
                "name": "Backup Fidelity Rider",
                "phone": "09174445566",
                "email": "backup.rider@example.com",
                "password": "riderpass123",
                "license_no": "B01-88-123456",
                "bike_model": "Yamaha NMAX",
                "plate_number": "BKP-101",
                "municipality": "Mambajao",
            },
        )
        self.assertEqual(r_reg.status_code, 201)
        b_promo = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Backup Promo User",
                "customer_phone": "09174447788",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "Agoho, Mambajao",
                "service_type": "pahatud",
                "promo_code": "WELCOME20",
                "scheduled_at": "2026-12-01T10:30:00",
            },
        ).get_json()["booking"]

        conn = get_connection(self.db_path)
        try:
            snap = export_full_backup(conn)
            restore_res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(restore_res["success"])

            restored_rider = get_rider_by_phone(conn, "backup.rider@example.com")
            self.assertIsNotNone(restored_rider)
            self.assertEqual(restored_rider["email"], "backup.rider@example.com")

            restored_booking = conn.execute(
                "SELECT * FROM bookings WHERE booking_code = ?",
                (b_promo["booking_code"],),
            ).fetchone()
            self.assertIsNotNone(restored_booking)
            self.assertEqual(restored_booking["scheduled_at"], "2026-12-01T10:30:00")
            self.assertEqual(restored_booking["promo_code"], "WELCOME20")
            self.assertEqual(restored_booking["promo_code_id"], b_promo["promo_code_id"])
            self.assertEqual(float(restored_booking["discount_amount"]), float(b_promo["discount_amount"]))
        finally:
            conn.close()

    def test_emergency_booking_transfer_and_rebroadcast(self):
        from datetime import timedelta
        from pathlib import Path
        from db import (
            accept_booking,
            export_full_backup,
            get_booking_messages,
            get_connection,
            get_now_pht,
            get_rider_by_id,
            restore_full_backup,
            update_rider_location,
            update_rider_online_status,
        )

        # Create riders with varied online/GPS/busy states
        r1 = self._create_active_rider(name="Transfer Rider One", phone="09175550101")
        r2 = self._create_active_rider(name="Transfer Rescue Two", phone="09175550102")
        r3 = self._create_active_rider(name="Offline Rider Three", phone="09175550103")
        r4 = self._create_active_rider(name="Busy Rider Four", phone="09175550104")
        r5 = self._create_active_rider(name="Advance Only Five", phone="09175550105")

        conn = get_connection(self.db_path)
        try:
            update_rider_online_status(conn, r1, True)
            update_rider_location(conn, r1, 9.24958, 124.71654)
            update_rider_online_status(conn, r2, True)
            update_rider_location(conn, r2, 9.24100, 124.66100)
            update_rider_online_status(conn, r3, False)
            update_rider_online_status(conn, r4, True)
            update_rider_online_status(conn, r5, True)
            conn.commit()
        finally:
            conn.close()

        # Assign an ongoing trip to r4, and a distant future scheduled booking to r5
        b_busy = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Busy Cust",
                "customer_phone": "09175551004",
                "service_type": "pahatud",
                "pickup_address": "Mambajao Town Plaza",
                "dropoff_address": "Balbagon Port",
            },
        ).get_json()["booking"]
        future_iso = (get_now_pht() + timedelta(hours=4)).isoformat(timespec="seconds")
        b_adv = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Future Advance Cust",
                "customer_phone": "09175551005",
                "service_type": "pahatud",
                "pickup_address": "Agoho, Mambajao",
                "dropoff_address": "Mambajao Town Plaza",
                "scheduled_at": future_iso,
            },
        ).get_json()["booking"]

        conn = get_connection(self.db_path)
        try:
            self.assertTrue(accept_booking(conn, b_busy["id"], r4))
            self.assertTrue(accept_booking(conn, b_adv["id"], r5))
            conn.commit()
        finally:
            conn.close()

        # Booking A: customer ride to upland Ardent Hot Spring (fare includes auto highland fee)
        b_a = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Emergency Passenger A",
                "customer_phone": "09175552001",
                "service_type": "pahatud",
                "pickup_address": "Poblacion, Mambajao",
                "dropoff_address": "Ardent Hot Spring, Esperanza",
            },
        ).get_json()["booking"]
        orig_fare_a = b_a["fare_amount"]

        # 1. Auth & ownership guards
        with self.client.session_transaction() as sess:
            sess.clear()
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={}).status_code, 401)
        self.assertEqual(self.client.post("/api/bookings/999999/transfer", json={}).status_code, 401)

        with self.client.session_transaction() as sess:
            sess["customer_phone"] = "09175552001"
            sess["active_booking_code"] = b_a["booking_code"]
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={}).status_code, 401)

        # Cannot transfer while still broadcast
        with self.client.session_transaction() as sess:
            sess.clear()
            sess["rider_id"] = r1
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={}).status_code, 400)

        # r1 accepts b_a
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/accept").status_code, 200)

        # Wrong rider r2 rejected with 403; nonexistent booking returns 404
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={}).status_code, 403)
        self.assertEqual(self.client.post("/api/bookings/999999/transfer", json={}).status_code, 404)

        # r1 checks co-riders busy flags and validation errors (self, offline, busy)
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1
        cor_resp = self.client.get("/api/rider/co-riders").get_json()
        by_id = {c["id"]: c for c in cor_resp["co_riders"]}
        self.assertFalse(by_id[r2]["has_active_job"])
        self.assertTrue(by_id[r4]["has_active_job"])
        self.assertFalse(by_id[r5]["has_active_job"])  # Future advance trip should not block

        self.assertEqual(
            self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={"target_rider_id": r1}).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={"target_rider_id": r3}).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={"target_rider_id": r4}).status_code,
            409,
        )

        # Create a newer broadcast booking AFTER b_a so we can verify Urgent Re-Broadcast priority sort
        b_newer = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Regular Later Cust",
                "customer_phone": "09175552999",
                "service_type": "pahatud",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "Agoho, Mambajao",
            },
        ).get_json()["booking"]

        # 2. r1 triggers Urgent Re-Broadcast with auto go_offline
        with self.client.session_transaction() as sess:
            sess.clear()
            sess["rider_id"] = r1
        re_resp = self.client.post(
            f"/api/bookings/{b_a['id']}/transfer",
            json={
                "target_rider_id": None,
                "reason": "Flat tire / tire puncture",
                "note": "Waiting outside customer gate",
                "go_offline": True,
            },
        )
        self.assertEqual(re_resp.status_code, 200)
        re_data = re_resp.get_json()
        self.assertEqual(re_data["mode"], "broadcast")
        self.assertEqual(re_data["is_online"], 0)
        b_after_re = re_data["booking"]
        self.assertEqual(b_after_re["status"], "broadcast")
        self.assertIsNone(b_after_re["rider_id"])
        self.assertEqual(b_after_re["fare_amount"], orig_fare_a)
        self.assertEqual(b_after_re["transferred_from_rider_id"], r1)
        self.assertEqual(b_after_re["transferred_from_rider_name"], "Transfer Rider One")
        self.assertEqual(b_after_re["transfer_count"], 1)
        self.assertIn("Flat tire / tire puncture", b_after_re["transfer_reason"])
        self.assertIn("Waiting outside customer gate", b_after_re["transfer_reason"])

        # r1 should now be offline, have no active job, and lose pending transaction ownership
        conn = get_connection(self.db_path)
        try:
            self.assertEqual(get_rider_by_id(conn, r1)["is_online"], 0)
            tx_row = conn.execute("SELECT * FROM transactions WHERE booking_id = ?", (b_a["id"],)).fetchone()
            self.assertIsNone(tx_row["rider_id"])
            self.assertEqual(tx_row["status"], "broadcast")
            msgs = get_booking_messages(conn, b_a["id"])
            self.assertTrue(
                any(m["sender_role"] == "system" and "Transfer Rider One" in m["message"] for m in msgs)
            )
        finally:
            conn.close()

        self.assertIsNone(self.client.get("/api/rider/active-job").get_json()["job"])

        # Customer tracking API & HTML reflect the emergency handover
        tr_json = self.client.get(f"/api/bookings/track/{b_a['booking_code']}").get_json()["booking"]
        self.assertIsNone(tr_json["rider_id"])
        self.assertEqual(tr_json["transfer_count"], 1)
        self.assertEqual(tr_json["transferred_from_rider_name"], "Transfer Rider One")
        tr_html = self.client.get(f"/track/{b_a['booking_code']}").get_data(as_text=True)
        self.assertIn('id="track-transfer-banner"', tr_html)
        self.assertIn("Transfer Rider One", tr_html)
        self.assertIn('id="rider-rating-wrap"', tr_html)
        self.assertIn("track.js?v=34", tr_html)

        # r2 sees transferred b_a prioritized BEFORE b_newer in broadcast feed, then claims and completes it
        with self.client.session_transaction() as sess:
            sess.clear()
            sess["rider_id"] = r2
        avail_jobs = self.client.get("/api/rider/available-jobs").get_json()["jobs"]
        avail_ids = [j["id"] for j in avail_jobs]
        self.assertIn(b_a["id"], avail_ids)
        self.assertIn(b_newer["id"], avail_ids)
        self.assertLess(avail_ids.index(b_a["id"]), avail_ids.index(b_newer["id"]))

        claim_resp = self.client.post(f"/api/bookings/{b_a['id']}/accept")
        self.assertEqual(claim_resp.status_code, 200)
        conn = get_connection(self.db_path)
        try:
            msgs = get_booking_messages(conn, b_a["id"])
            self.assertTrue(
                any(m["sender_role"] == "system" and "Rescue rider Transfer Rescue Two" in m["message"] for m in msgs)
            )
        finally:
            conn.close()

        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/status", json={"status": "in_progress"}).status_code, 200)
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/status", json={"status": "completed"}).status_code, 200)

        # Ledger earnings credit r2, not r1
        r2_txns = self.client.get("/api/rider/transactions").get_json()["transactions"]
        self.assertTrue(any(t["booking_id"] == b_a["id"] and t["status"] == "completed" for t in r2_txns))
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1
        r1_txns = self.client.get("/api/rider/transactions").get_json()["transactions"]
        self.assertFalse(any(t["booking_id"] == b_a["id"] for t in r1_txns))

        # Cannot transfer completed booking
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2
        self.assertEqual(self.client.post(f"/api/bookings/{b_a['id']}/transfer", json={}).status_code, 400)

        # 3. Direct Co-Rider Transfer mid-trip (in_progress) with handover GPS + stay online (go_offline=False)
        conn = get_connection(self.db_path)
        try:
            update_rider_online_status(conn, r1, True)
            conn.commit()
        finally:
            conn.close()

        b_b = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Emergency Passenger B",
                "customer_phone": "09175552002",
                "service_type": "pahatud",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "Catibawasan Falls",
            },
        ).get_json()["booking"]
        orig_fare_b = b_b["fare_amount"]

        with self.client.session_transaction() as sess:
            sess.clear()
            sess["rider_id"] = r1
        self.assertEqual(self.client.post(f"/api/bookings/{b_b['id']}/accept").status_code, 200)
        self.assertEqual(self.client.post(f"/api/bookings/{b_b['id']}/status", json={"status": "in_progress"}).status_code, 200)

        dir_resp = self.client.post(
            f"/api/bookings/{b_b['id']}/transfer",
            json={
                "target_rider_id": r2,
                "reason": "Engine / mechanical trouble",
                "note": "Near Pandan intersection",
                "new_pickup_lat": 9.231234,
                "new_pickup_lng": 124.695678,
                "go_offline": False,
            },
        )
        self.assertEqual(dir_resp.status_code, 200)
        dir_data = dir_resp.get_json()
        self.assertEqual(dir_data["mode"], "direct")
        self.assertEqual(dir_data["is_online"], 1)
        b_b_after = dir_data["booking"]
        self.assertEqual(b_b_after["status"], "accepted")
        self.assertEqual(b_b_after["rider_id"], r2)
        self.assertIsNone(b_b_after["pickup_time"])
        self.assertAlmostEqual(float(b_b_after["pickup_lat"]), 9.231234, places=5)
        self.assertAlmostEqual(float(b_b_after["pickup_lng"]), 124.695678, places=5)
        self.assertEqual(b_b_after["fare_amount"], orig_fare_b)
        self.assertEqual(b_b_after["transfer_count"], 1)
        self.assertEqual(b_b_after["transferred_from_rider_id"], r1)

        # r1 no longer has active job; r2 immediately sees it
        self.assertIsNone(self.client.get("/api/rider/active-job").get_json()["job"])
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2
        r2_active = self.client.get("/api/rider/active-job").get_json()["job"]
        self.assertIsNotNone(r2_active)
        self.assertEqual(r2_active["id"], b_b["id"])
        self.assertEqual(r2_active["transferred_from_rider_name"], "Transfer Rider One")

        # 4. Admin override transfer (without rider_id in session) -> r5 (only has future advance trip)
        with self.client.session_transaction() as sess:
            sess.clear()
            sess["is_admin"] = True
        adm_tr = self.client.post(
            f"/api/bookings/{b_b['id']}/transfer",
            json={"target_rider_id": r5, "reason": "Dispatch swap"},
        )
        self.assertEqual(adm_tr.status_code, 200)
        b_b_adm = adm_tr.get_json()["booking"]
        self.assertEqual(b_b_adm["rider_id"], r5)
        self.assertEqual(b_b_adm["transferred_from_rider_id"], r2)
        self.assertEqual(b_b_adm["transfer_count"], 2)

        admin_resp = self.client.get("/admin")
        self.assertIn("no-store", admin_resp.headers.get("Cache-Control", ""))
        admin_html = admin_resp.get_data(as_text=True)
        self.assertIn("Transferred x2", admin_html)
        self.assertIn("Transferred x1", admin_html)
        self.assertIn("Flat tire / tire puncture", admin_html)
        self.assertIn("admin-open-transfer-btn", admin_html)
        self.assertIn("Transfer to Rider", admin_html)
        self.assertIn('id="admin-transfer-modal"', admin_html)
        self.assertIn(f'data-booking-id="{b_b["id"]}"', admin_html)

        # 5. Rider Portal HTML, JS hooks, cache headers & i18n checks
        rider_resp = self.client.get("/rider")
        self.assertIn("no-store", rider_resp.headers.get("Cache-Control", ""))
        rider_html = rider_resp.get_data(as_text=True)
        self.assertIn('id="job-transfer-top-btn"', rider_html)
        self.assertIn('id="job-transfer-btn"', rider_html)
        self.assertIn('id="co-riders-transfer-hint"', rider_html)
        self.assertIn('id="rider-transfer-modal"', rider_html)
        self.assertIn("Transfer to Rider", rider_html)
        self.assertIn("rider.js?v=34", rider_html)
        rider_js = self.client.get("/static/js/rider.js").get_data(as_text=True)
        self.assertIn("scheduled-transfer-btn", rider_js)
        self.assertIn("co-rider-transfer-btn", rider_js)
        i18n_js = self.client.get("/static/js/i18n.js").get_data(as_text=True)
        self.assertIn("Flat Tire / Emergency Transfer", i18n_js)
        self.assertIn("🔄 Transfer to Rider", i18n_js)
        self.assertIn("⚠️ Transfer to Rider (Flat / Emergency)", i18n_js)

        # 6. Backup & restore fidelity for transfer audit columns
        conn = get_connection(self.db_path)
        try:
            snap = export_full_backup(conn)
            res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(res["success"])
            restored_b = conn.execute(
                "SELECT * FROM bookings WHERE booking_code = ?",
                (b_b["booking_code"],),
            ).fetchone()
            self.assertIsNotNone(restored_b)
            self.assertEqual(restored_b["transferred_from_rider_id"], r2)
            self.assertEqual(restored_b["transfer_reason"], "Dispatch swap")
            self.assertEqual(restored_b["transfer_count"], 2)
        finally:
            conn.close()

    def test_inapp_voice_call_and_voice_messages(self):
        import base64
        import io
        from datetime import timedelta
        from db import (
            export_full_backup,
            get_booking_messages,
            get_call_session,
            get_connection,
            get_now_pht,
            restore_full_backup,
        )

        cust_client = self.app.test_client()
        rider_client = self.app.test_client()
        other_client = self.app.test_client()

        r1 = self._create_active_rider(name="Voice Rider One", phone="09178880001", bike_model="Honda Click 125i")
        r2 = self._create_active_rider(name="Voice Rider Two", phone="09178880002", bike_model="Yamaha NMAX")

        # 1. Public ICE config (STUN defaults + optional env TURN override)
        ice_resp = self.client.get("/api/rtc/ice-config")
        self.assertEqual(ice_resp.status_code, 200)
        ice_data = ice_resp.get_json()
        self.assertTrue(ice_data["success"])
        ice_urls = [s.get("urls") for s in ice_data["ice_servers"]]
        self.assertIn("stun:stun.l.google.com:19302", ice_urls)

        old_turn = os.environ.get("CCRC_TURN_URLS")
        try:
            os.environ["CCRC_TURN_URLS"] = "turn:turn.camiguin.example:3478"
            turn_data = self.client.get("/api/rtc/ice-config").get_json()
            self.assertTrue(any(s.get("urls") == "turn:turn.camiguin.example:3478" for s in turn_data["ice_servers"]))
        finally:
            if old_turn is None:
                os.environ.pop("CCRC_TURN_URLS", None)
            else:
                os.environ["CCRC_TURN_URLS"] = old_turn

        # 2. Customer creates booking & verifies broadcast/unauth guards
        b_resp = cust_client.post(
            "/api/bookings",
            json={
                "customer_name": "Voice Call Passenger",
                "customer_phone": "09175553001",
                "service_type": "pahatud",
                "pickup_address": "Poblacion, Mambajao",
                "dropoff_address": "Agoho, Mambajao",
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        b = b_resp.get_json()["booking"]
        code = b["booking_code"]

        # Unauthenticated client blocked
        self.assertEqual(self.client.get(f"/api/calls/{code}/state").status_code, 401)
        self.assertEqual(self.client.post(f"/api/calls/{code}/start", json={}).status_code, 401)
        self.assertEqual(self.client.post(f"/api/chat/{code}/voice", json={}).status_code, 401)

        # Customer sees can_call=False and cannot call while status is broadcast
        st_bcast = cust_client.get(f"/api/calls/{code}/state").get_json()
        self.assertFalse(st_bcast["can_call"])
        self.assertEqual(st_bcast["viewer_role"], "customer")
        self.assertEqual(
            cust_client.post(
                f"/api/calls/{code}/start",
                json={"offer": {"type": "offer", "sdp": "v=0-early"}},
            ).status_code,
            400,
        )

        # Unrelated rider r2 blocked from accessing booking calls/voice
        with other_client.session_transaction() as sess:
            sess["rider_id"] = r2
        self.assertEqual(other_client.get(f"/api/calls/{b['id']}/state").status_code, 401)
        self.assertEqual(other_client.post(f"/api/chat/{b['id']}/voice", json={}).status_code, 401)

        # 3. Assigned rider r1 accepts the booking
        with rider_client.session_transaction() as sess:
            sess["rider_id"] = r1
        self.assertEqual(rider_client.post(f"/api/bookings/{b['id']}/accept").status_code, 200)

        # 4. HTML, assets & i18n checks on Track & Rider pages
        track_html = cust_client.get(f"/track/{code}").get_data(as_text=True)
        for token in (
            'id="ccrc-call-modal"',
            'id="ccrc-remote-audio"',
            'id="inapp-call-rider-btn"',
            'id="chat-inapp-call-btn"',
            'id="chat-voice-recording-bar"',
            'id="chat-voice-btn"',
            "voice_call.js?v=1",
            "track.js?v=34",
            "style.css?v=31",
            "i18n.js?v=9",
            "📞 Phone Call",
        ):
            self.assertIn(token, track_html)

        rider_html = rider_client.get("/rider").get_data(as_text=True)
        for token in (
            'id="active-job-inapp-call-btn"',
            'id="rider-chat-inapp-call-btn"',
            'id="rider-chat-voice-recording-bar"',
            'id="rider-chat-voice-btn"',
            "voice_call.js?v=1",
            "rider.js?v=34",
            "📞 Phone Call",
        ):
            self.assertIn(token, rider_html)

        vc_js = self.client.get("/static/js/voice_call.js").get_data(as_text=True)
        self.assertIn("CCRCVoiceCall", vc_js)
        self.assertIn("bindVoiceRecorder", vc_js)
        css_text = self.client.get("/static/css/style.css").get_data(as_text=True)
        self.assertIn(".btn-inapp-call", css_text)
        self.assertIn(".chat-voice-player", css_text)
        i18n_js = self.client.get("/static/js/i18n.js").get_data(as_text=True)
        self.assertIn("Free In-App Call", i18n_js)
        self.assertIn("Libreng Tawag sa App", i18n_js)
        self.assertIn("Record Voice Message", i18n_js)

        # 5. Full WebRTC Call Lifecycle (Customer -> Rider, ICE candidates, Answer, Hangup)
        start_resp = cust_client.post(
            f"/api/calls/{code}/start",
            json={"offer": {"type": "offer", "sdp": "v=0-cust-sdp-offer"}},
        )
        self.assertEqual(start_resp.status_code, 201)
        call1 = start_resp.get_json()["call"]
        call1_id = call1["id"]
        self.assertEqual(call1["status"], "ringing")
        self.assertEqual(call1["caller_role"], "customer")
        self.assertEqual(call1["callee_role"], "rider")

        # Simultaneous outgoing call from rider conflicts (409)
        self.assertEqual(
            rider_client.post(
                f"/api/calls/{b['id']}/start",
                json={"offer": {"type": "offer", "sdp": "v=0-collision"}},
            ).status_code,
            409,
        )

        # Caller cannot accept their own ringing call (403)
        self.assertEqual(
            cust_client.post(
                f"/api/calls/session/{call1_id}/respond",
                json={"action": "accept"},
            ).status_code,
            403,
        )

        # Customer batches ICE candidates; unrelated rider blocked from signaling
        sig_resp = cust_client.post(
            f"/api/calls/session/{call1_id}/signal",
            json={"candidates": [{"candidate": "cand-c1"}, {"candidate": "cand-c2"}]},
        )
        self.assertEqual(sig_resp.status_code, 200)
        self.assertEqual(len(sig_resp.get_json()["signal_ids"]), 2)
        self.assertEqual(
            other_client.post(
                f"/api/calls/session/{call1_id}/signal",
                json={"candidates": [{"candidate": "intruder"}]},
            ).status_code,
            401,
        )

        # Rider polls call state & receives offer + ICE candidates
        r_state = rider_client.get(f"/api/calls/{b['id']}/state").get_json()
        self.assertTrue(r_state["can_call"])
        self.assertEqual(r_state["viewer_role"], "rider")
        self.assertEqual(r_state["peer_name"], "Voice Call Passenger")
        self.assertEqual(r_state["call"]["id"], call1_id)
        sig_types = [s["signal_type"] for s in r_state["signals"]]
        self.assertIn("offer", sig_types)
        self.assertIn("candidate", sig_types)
        offer_sig = next(s for s in r_state["signals"] if s["signal_type"] == "offer")
        self.assertEqual(offer_sig["data"]["sdp"], "v=0-cust-sdp-offer")

        # Rider answers call with SDP answer + sends ICE candidate
        ans_resp = rider_client.post(
            f"/api/calls/session/{call1_id}/respond",
            json={
                "action": "accept",
                "answer": {"type": "answer", "sdp": "v=0-rider-sdp-answer"},
            },
        )
        self.assertEqual(ans_resp.status_code, 200)
        ans_call = ans_resp.get_json()["call"]
        self.assertEqual(ans_call["status"], "accepted")
        self.assertIsNotNone(ans_call["answered_at"])

        # Starting another call while one is active conflicts (409)
        self.assertEqual(
            cust_client.post(
                f"/api/calls/{code}/start",
                json={"offer": {"type": "offer", "sdp": "v=0-dup"}},
            ).status_code,
            409,
        )
        self.assertEqual(
            rider_client.post(
                f"/api/calls/session/{call1_id}/signal",
                json={"candidates": [{"candidate": "cand-r1"}]},
            ).status_code,
            200,
        )

        # Customer receives SDP answer + rider ICE
        c_state = cust_client.get(f"/api/calls/{code}/state?call_id={call1_id}&after_signal_id=0").get_json()
        self.assertEqual(c_state["call"]["status"], "accepted")
        c_sig_types = [s["signal_type"] for s in c_state["signals"]]
        self.assertIn("answer", c_sig_types)
        self.assertIn("candidate", c_sig_types)
        ans_sig = next(s for s in c_state["signals"] if s["signal_type"] == "answer")
        self.assertEqual(ans_sig["data"]["sdp"], "v=0-rider-sdp-answer")

        # Customer hangs up -> logs system summary in chat & closes signaling
        hang_resp = cust_client.post(
            f"/api/calls/session/{call1_id}/respond",
            json={"action": "hangup", "reason": "Finished call"},
        )
        self.assertEqual(hang_resp.status_code, 200)
        self.assertEqual(hang_resp.get_json()["call"]["status"], "ended")

        self.assertEqual(
            rider_client.post(
                f"/api/calls/session/{call1_id}/signal",
                json={"candidates": [{"candidate": "late-cand"}]},
            ).status_code,
            409,
        )

        msgs_after_hang = cust_client.get(f"/api/chat/{code}/messages").get_json()["messages"]
        self.assertTrue(
            any(
                m["sender_role"] == "system"
                and m["sender_name"] == "CCRC Call"
                and "In-app voice call ended" in m["message"]
                for m in msgs_after_hang
            )
        )

        # 6. Decline Flow + Stale Call Expiry
        call2 = rider_client.post(
            f"/api/calls/{b['id']}/start",
            json={"offer": {"type": "offer", "sdp": "v=0-rider-call"}},
        ).get_json()["call"]
        dec_resp = cust_client.post(
            f"/api/calls/session/{call2['id']}/respond",
            json={"action": "decline", "reason": "Busy"},
        )
        self.assertEqual(dec_resp.status_code, 200)
        self.assertEqual(dec_resp.get_json()["call"]["status"], "declined")

        msgs_after_dec = cust_client.get(f"/api/chat/{code}/messages").get_json()["messages"]
        self.assertTrue(
            any(
                m["sender_role"] == "system"
                and m["sender_name"] == "CCRC Call"
                and "declined" in m["message"]
                for m in msgs_after_dec
            )
        )

        call3 = cust_client.post(
            f"/api/calls/{code}/start",
            json={"offer": {"type": "offer", "sdp": "v=0-stale"}},
        ).get_json()["call"]
        old_ts = (get_now_pht() - timedelta(seconds=60)).isoformat(timespec="seconds")
        conn = get_connection(self.db_path)
        try:
            conn.execute(
                "UPDATE call_sessions SET created_at = ?, updated_at = ? WHERE id = ?",
                (old_ts, old_ts, call3["id"]),
            )
            conn.commit()
        finally:
            conn.close()
        stale_state = rider_client.get(f"/api/calls/{b['id']}/state?call_id={call3['id']}").get_json()
        self.assertIsNotNone(stale_state["call"])
        self.assertEqual(stale_state["call"]["status"], "missed")
        self.assertEqual(stale_state["call"]["end_reason"], "No answer")

        # 7. Push-to-Talk Voice Messages + Byte-Range HTTP 206 Streaming
        # Validation checks
        self.assertEqual(
            cust_client.post(
                f"/api/chat/{code}/voice",
                data={"audio": (io.BytesIO(b"tiny"), "short.webm", "audio/webm"), "mimetype": "audio/webm", "duration": "0.1"},
                content_type="multipart/form-data",
            ).status_code,
            400,
        )
        self.assertEqual(
            cust_client.post(
                f"/api/chat/{code}/voice",
                data={"audio": (io.BytesIO(b"A" * 120), "bad.txt", "text/plain"), "mimetype": "text/plain", "duration": "1.0"},
                content_type="multipart/form-data",
            ).status_code,
            400,
        )
        self.assertEqual(
            cust_client.post(
                f"/api/chat/{code}/voice",
                data={"audio": (io.BytesIO(b"B" * 1_500_050), "big.webm", "audio/webm"), "mimetype": "audio/webm", "duration": "65.0"},
                content_type="multipart/form-data",
            ).status_code,
            413,
        )

        # Customer multipart audio upload
        sample_audio = bytes(range(256)) * 2  # 512 bytes deterministic payload
        v_cust = cust_client.post(
            f"/api/chat/{code}/voice",
            data={
                "audio": (io.BytesIO(sample_audio), "note.webm", "audio/webm"),
                "mimetype": "audio/webm",
                "duration": "4.2",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(v_cust.status_code, 201)
        v_cust_msg = v_cust.get_json()["message"]
        self.assertEqual(v_cust_msg["msg_type"], "voice")
        self.assertEqual(v_cust_msg["sender_role"], "customer")
        self.assertAlmostEqual(float(v_cust_msg["media_duration"]), 4.2, places=1)
        self.assertTrue(v_cust_msg["media_url"].startswith("/media/voice_"))
        self.assertTrue(v_cust_msg["media_url"].endswith(".webm"))

        # Rider JSON data-URI base64 audio upload
        rider_audio = b"M4A-DATA-" * 16
        b64_payload = "data:audio/mp4;base64," + base64.b64encode(rider_audio).decode("ascii")
        v_rider = rider_client.post(
            f"/api/chat/{b['id']}/voice",
            json={"audio_base64": b64_payload, "duration": 2.7},
        )
        self.assertEqual(v_rider.status_code, 201)
        v_rider_msg = v_rider.get_json()["message"]
        self.assertEqual(v_rider_msg["msg_type"], "voice")
        self.assertEqual(v_rider_msg["sender_role"], "rider")
        self.assertTrue(v_rider_msg["media_url"].endswith(".m4a"))

        # Chat messages API includes voice metadata
        chat_msgs = cust_client.get(f"/api/chat/{code}/messages").get_json()["messages"]
        voice_msgs = [m for m in chat_msgs if m.get("msg_type") == "voice"]
        self.assertEqual(len(voice_msgs), 2)

        # Full GET + HTTP 206 Partial Content byte-range streaming
        full_media = cust_client.get(v_cust_msg["media_url"])
        self.assertEqual(full_media.status_code, 200)
        self.assertEqual(full_media.headers.get("Accept-Ranges"), "bytes")
        self.assertEqual(full_media.data, sample_audio)

        part_media = cust_client.get(v_cust_msg["media_url"], headers={"Range": "bytes=0-99"})
        self.assertEqual(part_media.status_code, 206)
        self.assertEqual(part_media.headers.get("Content-Range"), f"bytes 0-99/{len(sample_audio)}")
        self.assertEqual(part_media.headers.get("Content-Length"), "100")
        self.assertEqual(part_media.data, sample_audio[:100])

        bad_range = cust_client.get(v_cust_msg["media_url"], headers={"Range": "bytes=9999-10050"})
        self.assertEqual(bad_range.status_code, 416)

        # 8. Open Calls Auto-End on Transfer and Trip Completion
        call_tr = cust_client.post(
            f"/api/calls/{code}/start",
            json={"offer": {"type": "offer", "sdp": "v=0-pre-transfer"}},
        ).get_json()["call"]
        self.assertEqual(
            rider_client.post(
                f"/api/bookings/{b['id']}/transfer",
                json={"target_rider_id": r2, "reason": "Flat tire", "go_offline": False},
            ).status_code,
            200,
        )
        conn = get_connection(self.db_path)
        try:
            tr_c = get_call_session(conn, call_tr["id"])
            self.assertEqual(tr_c["status"], "missed")
            self.assertEqual(tr_c["end_reason"], "Trip transferred to another rider")
        finally:
            conn.close()

        # New rider r2 handles booking -> call accepted -> trip completed auto-ends call
        self.assertEqual(other_client.post(f"/api/bookings/{b['id']}/status", json={"status": "in_progress"}).status_code, 200)
        call_done = other_client.post(
            f"/api/calls/{b['id']}/start",
            json={"offer": {"type": "offer", "sdp": "v=0-before-complete"}},
        ).get_json()["call"]
        self.assertEqual(
            cust_client.post(
                f"/api/calls/session/{call_done['id']}/respond",
                json={"action": "accept", "answer": {"type": "answer", "sdp": "v=0-cust-ans"}},
            ).status_code,
            200,
        )
        self.assertEqual(
            other_client.post(f"/api/bookings/{b['id']}/status", json={"status": "completed"}).status_code,
            200,
        )
        conn = get_connection(self.db_path)
        try:
            done_c = get_call_session(conn, call_done["id"])
            self.assertEqual(done_c["status"], "ended")
            self.assertEqual(done_c["end_reason"], "Booking completed")
        finally:
            conn.close()
        self.assertEqual(
            other_client.post(
                f"/api/calls/{b['id']}/start",
                json={"offer": {"type": "offer", "sdp": "v=0-after-done"}},
            ).status_code,
            400,
        )

        # 9. Full Backup & Restore Preserves Voice Messages and Uploaded Audio
        conn = get_connection(self.db_path)
        try:
            snap = export_full_backup(conn)
            res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(res["success"])
            restored_msgs = get_booking_messages(conn, b["id"])
            restored_voices = [m for m in restored_msgs if m.get("msg_type") == "voice"]
            self.assertEqual(len(restored_voices), 2)
            self.assertEqual(restored_voices[0]["media_url"], v_cust_msg["media_url"])
            self.assertAlmostEqual(float(restored_voices[0]["media_duration"]), 4.2, places=1)
        finally:
            conn.close()

        restored_media = self.client.get(v_cust_msg["media_url"])
        self.assertEqual(restored_media.status_code, 200)
        self.assertEqual(restored_media.data, sample_audio)

    def test_gcash_qr_and_payment_completion_gate(self):
        import base64
        from db import export_full_backup, get_booking_messages, get_connection, restore_full_backup

        cust_client = self.app.test_client()
        rider_client = self.app.test_client()
        r2_client = self.app.test_client()
        admin_client = self.app.test_client()

        r1 = self._create_active_rider(name="GCash Rider One", phone="09179990001", bike_model="Honda Click 125i")
        r2 = self._create_active_rider(name="GCash Rider Two", phone="09179990002", bike_model="Yamaha Aerox")

        sample_png = (
            b"\x89PNG\r\n\x1a\n"
            b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
            b"\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xf6\x178U"
            b"\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        qr_data_uri = "data:image/png;base64," + base64.b64encode(sample_png).decode("ascii")

        # 1. Auth guards on /api/rider/gcash-profile and optional GCash fields on /api/rider/register
        self.assertEqual(self.client.get("/api/rider/gcash-profile").status_code, 401)
        self.assertEqual(self.client.post("/api/rider/gcash-profile", json={"gcash_number": "09170001111"}).status_code, 401)

        reg_resp = self.client.post(
            "/api/rider/register",
            json={
                "name": "Pending GCash Applicant",
                "phone": "09179990099",
                "license_no": "G01-23-456789",
                "bike_model": "Suzuki Raider 150",
                "plate_number": "CCRC-GC99",
                "municipality": "Mambajao",
                "password": "password123",
                "gcash_number": "09178889999",
                "gcash_qr_base64": qr_data_uri,
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        reg_rider = reg_resp.get_json()["rider"]
        self.assertEqual(reg_rider["gcash_number"], "09178889999")
        self.assertTrue(reg_rider["gcash_qr_url"].startswith("/media/gcash_qr_"))

        # 2. Validation and upload/clear flows for rider QR
        with rider_client.session_transaction() as sess:
            sess["rider_id"] = r1

        self.assertEqual(
            rider_client.post("/api/rider/gcash-profile", json={}).status_code,
            400,
        )
        self.assertEqual(
            rider_client.post("/api/rider/gcash-profile", json={"gcash_qr_base64": "not-base64!!!"}).status_code,
            400,
        )
        self.assertEqual(
            rider_client.post(
                "/api/rider/gcash-profile",
                json={"gcash_qr_base64": "data:text/plain;base64," + base64.b64encode(b"PLAIN TEXT FILE" * 4).decode("ascii")},
            ).status_code,
            400,
        )

        up_resp = rider_client.post(
            "/api/rider/gcash-profile",
            json={"gcash_number": "09179990001", "gcash_qr_base64": qr_data_uri},
        )
        self.assertEqual(up_resp.status_code, 200)
        up_data = up_resp.get_json()
        qr_url = up_data["gcash_qr_url"]
        self.assertTrue(qr_url.startswith("/media/gcash_qr_"))
        self.assertEqual(up_data["gcash_number"], "09179990001")

        # Served QR image matches exact uploaded PNG bytes
        qr_img_resp = self.client.get(qr_url)
        self.assertEqual(qr_img_resp.status_code, 200)
        self.assertEqual(qr_img_resp.data, sample_png)
        self.assertEqual(qr_img_resp.mimetype, "image/png")

        # Clear QR works, then re-upload for trip testing
        clr_resp = rider_client.post("/api/rider/gcash-profile", json={"gcash_number": "09179990001", "clear_qr": True})
        self.assertEqual(clr_resp.status_code, 200)
        self.assertEqual(clr_resp.get_json()["gcash_qr_url"], "")
        up_resp2 = rider_client.post(
            "/api/rider/gcash-profile",
            json={"gcash_number": "09179990001", "gcash_qr_base64": qr_data_uri},
        )
        self.assertEqual(up_resp2.status_code, 200)
        qr_url = up_resp2.get_json()["gcash_qr_url"]

        # 3. Customer creates GCash booking -> auth & UI checks
        b_resp = cust_client.post(
            "/api/bookings",
            json={
                "customer_name": "GCash Passenger Ana",
                "customer_phone": "09175554001",
                "service_type": "pahatud",
                "pickup_address": "Poblacion, Mambajao",
                "dropoff_address": "Yumbing, Mambajao",
                "payment_method": "gcash",
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        b1 = b_resp.get_json()["booking"]
        code1 = b1["booking_code"]
        self.assertEqual(b1["payment_method"], "gcash")
        self.assertEqual(b1["payment_status"], "pending")

        # Unauthenticated customer-sent and confirm endpoints blocked
        self.assertEqual(self.client.post(f"/api/bookings/{code1}/gcash/customer-sent", json={}).status_code, 401)
        self.assertEqual(self.client.post(f"/api/bookings/{b1['id']}/gcash/confirm", json={}).status_code, 401)
        # Cannot mark payment sent before a rider accepts
        self.assertEqual(cust_client.post(f"/api/bookings/{code1}/gcash/customer-sent", json={"payment_ref": "EARLY-1"}).status_code, 400)

        # Rider r1 accepts & starts trip
        self.assertEqual(rider_client.post(f"/api/bookings/{b1['id']}/accept").status_code, 200)
        self.assertEqual(rider_client.post(f"/api/bookings/{b1['id']}/status", json={"status": "in_progress"}).status_code, 200)

        # Customer tracking page, tracking JSON, and active-booking API include GCash QR & official launcher UI
        tr_json = cust_client.get(f"/api/bookings/track/{code1}").get_json()["booking"]
        self.assertEqual(tr_json["payment_status"], "pending")
        self.assertEqual(tr_json["rider_gcash_number"], "09179990001")
        self.assertEqual(tr_json["rider_gcash_qr"], qr_url)

        act_cust = cust_client.get("/api/customer/active-booking?phone=09175554001").get_json()["booking"]
        self.assertEqual(act_cust["rider_gcash_qr"], qr_url)
        self.assertEqual(act_cust["rider_gcash_number"], "09179990001")

        track_html = cust_client.get(f"/track/{code1}").get_data(as_text=True)
        for token in (
            'id="gcash-payment-card"',
            'id="open-official-gcash-btn"',
            "Open Official GCash",
            qr_url,
            'id="gcash-sent-form"',
            'id="mark-gcash-sent-btn"',
            "gcash-recipient-row",
            "gcash-sent-row",
            "track.js?v=34",
            "style.css?v=31",
            "i18n.js?v=9",
        ):
            self.assertIn(token, track_html)

        track_js = self.client.get("/static/js/track.js").get_data(as_text=True)
        self.assertIn("com.globe.gcash.android", track_js)
        self.assertIn("gcash://", track_js)

        rider_html = rider_client.get("/rider").get_data(as_text=True)
        for token in (
            'id="open-rider-gcash-setup-btn"',
            'id="active-job-gcash-box"',
            'id="job-show-gcash-qr-btn"',
            'id="job-gcash-top-btn"',
            'id="rider-gcash-qr-modal"',
            'id="r-gcash-confirm-btn"',
            'id="rider-gcash-gate-hint"',
            "rider-gcash-profile-row",
            "rider-gcash-profile-info",
            "rider-active-gcash-footer",
            "rider.js?v=34",
        ):
            self.assertIn(token, rider_html)

        rider_js = self.client.get("/static/js/rider.js").get_data(as_text=True)
        self.assertIn("requires_gcash_payment", rider_js)
        self.assertIn("btn-complete-locked", rider_js)
        css_text = self.client.get("/static/css/style.css").get_data(as_text=True)
        self.assertIn(".btn-gcash-official", css_text)
        self.assertIn(".btn-complete-locked", css_text)
        self.assertIn(".rider-gcash-profile-row", css_text)
        self.assertIn(".rider-gcash-profile-info", css_text)
        i18n_js = self.client.get("/static/js/i18n.js").get_data(as_text=True)
        self.assertIn("Open Official GCash", i18n_js)
        self.assertIn("Ablihi ang Opisyal nga GCash", i18n_js)

        # Rider active-job returns sanitized rider with gcash_qr_url
        r1_act = rider_client.get(f"/api/rider/active-job?rider_id={r1}").get_json()
        self.assertEqual(r1_act["rider"]["gcash_qr_url"], qr_url)
        self.assertEqual(r1_act["job"]["payment_status"], "pending")

        # 4. Strict GCash completion gate: blocked while pending AND while customer_sent!
        blk_pending = rider_client.post(f"/api/bookings/{b1['id']}/status", json={"status": "completed"})
        self.assertEqual(blk_pending.status_code, 400)
        blk_p_json = blk_pending.get_json()
        self.assertTrue(blk_p_json["requires_gcash_payment"])
        self.assertEqual(blk_p_json["payment_status"], "pending")

        # Premature confirm rejected while still pending without verified_offline_receipt
        self.assertEqual(
            rider_client.post(f"/api/bookings/{b1['id']}/gcash/confirm", json={}).status_code,
            400,
        )

        # Rider cannot spoof customer-sent endpoint (403)
        self.assertEqual(
            rider_client.post(f"/api/bookings/{b1['id']}/gcash/customer-sent", json={"payment_ref": "SPOOF"}).status_code,
            403,
        )

        # Customer reports GCash payment sent with reference number
        sent_resp = cust_client.post(
            f"/api/bookings/{code1}/gcash/customer-sent",
            json={"payment_ref": "90241184521"},
        )
        self.assertEqual(sent_resp.status_code, 200)
        b1_sent = sent_resp.get_json()["booking"]
        self.assertEqual(b1_sent["payment_status"], "customer_sent")
        self.assertEqual(b1_sent["payment_ref"], "90241184521")

        # Still blocked from completing until rider explicitly confirms receipt!
        blk_sent = rider_client.post(f"/api/bookings/{b1['id']}/status", json={"status": "completed"})
        self.assertEqual(blk_sent.status_code, 400)
        self.assertTrue(blk_sent.get_json()["requires_gcash_payment"])
        self.assertEqual(blk_sent.get_json()["payment_status"], "customer_sent")

        # Unrelated rider r2 cannot confirm r1's GCash payment (403)
        with r2_client.session_transaction() as sess:
            sess["rider_id"] = r2
        self.assertEqual(
            r2_client.post(f"/api/bookings/{b1['id']}/gcash/confirm", json={}).status_code,
            403,
        )

        # Assigned rider r1 confirms GCash receipt -> payment_status='paid' -> unlocks completion!
        conf_resp = rider_client.post(f"/api/bookings/{b1['id']}/gcash/confirm", json={})
        self.assertEqual(conf_resp.status_code, 200)
        b1_paid = conf_resp.get_json()["booking"]
        self.assertEqual(b1_paid["payment_status"], "paid")
        self.assertIsNotNone(b1_paid["payment_confirmed_at"])

        # Idempotent second confirm stays 200
        self.assertEqual(rider_client.post(f"/api/bookings/{b1['id']}/gcash/confirm", json={}).status_code, 200)

        # Now completion succeeds (200)
        comp_resp = rider_client.post(f"/api/bookings/{b1['id']}/status", json={"status": "completed"})
        self.assertEqual(comp_resp.status_code, 200)
        self.assertEqual(comp_resp.get_json()["job"]["status"], "completed")

        # 5. In-person QR scan flow (verified_offline_receipt=True) confirms directly from pending -> paid
        b2 = cust_client.post(
            "/api/bookings",
            json={
                "customer_name": "GCash InPerson Ben",
                "customer_phone": "09175554002",
                "service_type": "pahatud",
                "pickup_address": "Agoho, Mambajao",
                "dropoff_address": "Balbagon Port",
                "payment_method": "gcash",
            },
        ).get_json()["booking"]
        self.assertEqual(rider_client.post(f"/api/bookings/{b2['id']}/accept").status_code, 200)
        self.assertEqual(rider_client.post(f"/api/bookings/{b2['id']}/status", json={"status": "in_progress"}).status_code, 200)
        self.assertEqual(rider_client.post(f"/api/bookings/{b2['id']}/status", json={"status": "completed"}).status_code, 400)

        off_conf = rider_client.post(
            f"/api/bookings/{b2['id']}/gcash/confirm",
            json={"verified_offline_receipt": True, "payment_ref": "INPERSON-7788"},
        )
        self.assertEqual(off_conf.status_code, 200)
        self.assertEqual(off_conf.get_json()["booking"]["payment_status"], "paid")
        self.assertEqual(off_conf.get_json()["booking"]["payment_ref"], "INPERSON-7788")
        self.assertEqual(rider_client.post(f"/api/bookings/{b2['id']}/status", json={"status": "completed"}).status_code, 200)

        # 6. Emergency Transfer resets 'customer_sent' back to 'pending', but preserves 'paid'
        b3 = cust_client.post(
            "/api/bookings",
            json={
                "customer_name": "GCash Transfer Carlos",
                "customer_phone": "09175554003",
                "service_type": "pahatud",
                "pickup_address": "Tupsan, Mambajao",
                "dropoff_address": "Benoni Port",
                "payment_method": "gcash",
            },
        ).get_json()["booking"]
        self.assertEqual(rider_client.post(f"/api/bookings/{b3['id']}/accept").status_code, 200)
        self.assertEqual(
            cust_client.post(f"/api/bookings/{b3['booking_code']}/gcash/customer-sent", json={"payment_ref": "OLD-R1-REF"}).status_code,
            200,
        )
        tr_sent = rider_client.post(
            f"/api/bookings/{b3['id']}/transfer",
            json={"target_rider_id": r2, "reason": "Flat tire / tire puncture", "go_offline": False},
        )
        self.assertEqual(tr_sent.status_code, 200)
        b3_tr = tr_sent.get_json()["booking"]
        self.assertEqual(b3_tr["rider_id"], r2)
        self.assertEqual(b3_tr["payment_status"], "pending")
        self.assertEqual(b3_tr["payment_ref"], "")

        # Also test transfer preserves already 'paid' booking (b4) & admin override completes unpaid booking
        self.assertEqual(r2_client.post(f"/api/bookings/{b3['id']}/gcash/confirm", json={"verified_offline_receipt": True}).status_code, 200)
        tr_paid = r2_client.post(
            f"/api/bookings/{b3['id']}/transfer",
            json={"target_rider_id": r1, "reason": "Relay handover", "go_offline": False},
        )
        self.assertEqual(tr_paid.status_code, 200)
        self.assertEqual(tr_paid.get_json()["booking"]["payment_status"], "paid")

        # Unpaid GCash booking b4 completed by Admin override
        b4 = cust_client.post(
            "/api/bookings",
            json={
                "customer_name": "GCash Admin Override Dana",
                "customer_phone": "09175554004",
                "service_type": "pahatud",
                "pickup_address": "Catarman Poblacion",
                "dropoff_address": "Bonbon, Catarman",
                "payment_method": "gcash",
            },
        ).get_json()["booking"]
        with admin_client.session_transaction() as sess:
            sess["is_admin"] = True
        adm_html = admin_client.get("/admin").get_data(as_text=True)
        self.assertIn("View GCash QR", adm_html)
        self.assertIn("GCash Paid", adm_html)
        self.assertIn("GCash Pending", adm_html)
        self.assertEqual(
            admin_client.post(f"/api/bookings/{b4['id']}/status", json={"status": "completed"}).status_code,
            200,
        )

        # 7. Backup & Restore preserves GCash rider QR/number, booking payment audit columns, and QR PNG bytes
        conn = get_connection(self.db_path)
        try:
            msgs_b1 = get_booking_messages(conn, b1["id"])
            self.assertTrue(any("GCash payment" in m["message"] for m in msgs_b1))

            snap = export_full_backup(conn)
            res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(res["success"])

            restored_r1 = conn.execute("SELECT gcash_number, gcash_qr_url FROM riders WHERE id = ?", (r1,)).fetchone()
            self.assertEqual(restored_r1["gcash_number"], "09179990001")
            self.assertEqual(restored_r1["gcash_qr_url"], qr_url)

            restored_b1 = conn.execute(
                "SELECT payment_method, payment_status, payment_ref, payment_sent_at, payment_confirmed_at FROM bookings WHERE id = ?",
                (b1["id"],),
            ).fetchone()
            self.assertEqual(restored_b1["payment_method"], "gcash")
            self.assertEqual(restored_b1["payment_status"], "paid")
            self.assertEqual(restored_b1["payment_ref"], "90241184521")
            self.assertIsNotNone(restored_b1["payment_sent_at"])
            self.assertIsNotNone(restored_b1["payment_confirmed_at"])
        finally:
            conn.close()

        restored_qr_resp = self.client.get(qr_url)
        self.assertEqual(restored_qr_resp.status_code, 200)
        self.assertEqual(restored_qr_resp.data, sample_png)

    def test_multi_rider_group_booking_up_to_ten_riders(self):
        import base64
        from db import export_full_backup, get_connection, restore_full_backup

        cust_client = self.app.test_client()
        r1_client = self.app.test_client()
        r2_client = self.app.test_client()
        r3_client = self.app.test_client()

        self._create_customer(name="Group Boss Ana", phone="09181110010", password="custpass123")
        r1 = self._create_active_rider(name="Group Rider One", phone="09172220001", bike_model="Honda Click 125")
        r2 = self._create_active_rider(name="Group Rider Two", phone="09172220002", bike_model="Yamaha Mio i125")
        r3 = self._create_active_rider(name="Group Rider Three", phone="09172220003", bike_model="Suzuki Raider 150")

        # Configure distinct Official GCash QRs & numbers for r2 and r3
        sample_png_r2 = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
            b"\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        sample_png_r3 = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x02\x00\x00\x00\x02"
            b"\x08\x02\x00\x00\x00\xfd\xd4\x9as\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
            b"\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with r2_client.session_transaction() as sess:
            sess["rider_id"] = r2
        qr_r2_resp = r2_client.post(
            "/api/rider/gcash-profile",
            json={
                "gcash_number": "09172220002",
                "gcash_qr_base64": "data:image/png;base64," + base64.b64encode(sample_png_r2).decode("ascii"),
            },
        )
        self.assertEqual(qr_r2_resp.status_code, 200)
        qr_r2_url = qr_r2_resp.get_json()["gcash_qr_url"]

        with r3_client.session_transaction() as sess:
            sess["rider_id"] = r3
        qr_r3_resp = r3_client.post(
            "/api/rider/gcash-profile",
            json={
                "gcash_number": "09172220003",
                "gcash_qr_base64": "data:image/png;base64," + base64.b64encode(sample_png_r3).decode("ascii"),
            },
        )
        self.assertEqual(qr_r3_resp.status_code, 200)
        qr_r3_url = qr_r3_resp.get_json()["gcash_qr_url"]

        with r1_client.session_transaction() as sess:
            sess["rider_id"] = r1

        # 1. riders_count validation (< 1, > 10, non-integer -> 400)
        base_payload = {
            "customer_name": "Group Boss Ana",
            "customer_phone": "09181110010",
            "service_type": "pahatud",
            "pickup_address": "Poblacion, Mambajao",
            "pickup_lat": 9.25405,
            "pickup_lng": 124.71636,
            "dropoff_address": "White Island Boat Jump-off, Yumbing",
            "dropoff_lat": 9.24368,
            "dropoff_lng": 124.66090,
            "payment_method": "gcash",
        }
        for bad_count in (0, -2, 11, "ten"):
            bad_resp = cust_client.post("/api/bookings", json={**base_payload, "riders_count": bad_count})
            self.assertEqual(bad_resp.status_code, 400, f"Expected 400 for riders_count={bad_count!r}")

        # 2. Create 10-rider group booking with WELCOME20 promo (single P20 discount split across 10 slots)
        resp_10 = cust_client.post(
            "/api/bookings",
            json={**base_payload, "riders_count": 10, "promo_code": "WELCOME20"},
        )
        self.assertEqual(resp_10.status_code, 201)
        data_10 = resp_10.get_json()
        self.assertTrue(data_10["success"])
        self.assertTrue(data_10["is_group"])
        self.assertEqual(data_10["riders_count"], 10)
        group_code = data_10["group_code"]
        self.assertTrue(group_code.startswith("GRP-"))
        self.assertEqual(data_10["tracking_url"], f"/track/{group_code}")

        slots = data_10["group_bookings"]
        self.assertEqual(len(slots), 10)
        token = group_code[4:]
        for idx, s in enumerate(slots, start=1):
            self.assertEqual(s["group_code"], group_code)
            self.assertEqual(s["group_size"], 10)
            self.assertEqual(s["rider_slot"], idx)
            self.assertEqual(s["booking_code"], f"CCRC-{token}-{idx}")

        # Promo discount must be applied ONCE across the group (P20 total, not P200)
        total_disc = round(sum(float(s["discount_amount"]) for s in slots), 2)
        self.assertEqual(total_disc, 20.0)
        slot_sum_fare = round(sum(float(s["fare_amount"]) for s in slots), 2)
        self.assertEqual(slot_sum_fare, round(float(data_10["total_fare"]), 2))
        self.assertEqual(slot_sum_fare, round(float(data_10["group_summary"]["total_fare"]), 2))
        self.assertEqual(data_10["group_summary"]["total_riders"], 10)

        # 3. Rider dispatch feed collapses 10 open slots into 1 card; r1 claims slot 1, blocked from claiming slot 2
        feed_r1 = r1_client.get("/api/rider/available-jobs").get_json()
        grp_cards = [j for j in feed_r1["jobs"] if j.get("group_code") == group_code]
        self.assertEqual(len(grp_cards), 1)
        card = grp_cards[0]
        card_id = card["id"]
        self.assertEqual(card_id, slots[0]["id"])
        self.assertEqual(card["group_open_count"], 10)
        self.assertEqual(card["group_assigned_count"], 0)
        self.assertFalse(card["rider_already_in_group"])

        acc_r1 = r1_client.post(f"/api/bookings/{card_id}/accept")
        self.assertEqual(acc_r1.status_code, 200)
        acc_r1_json = acc_r1.get_json()
        self.assertEqual(acc_r1_json["job"]["id"], slots[0]["id"])
        self.assertEqual(acc_r1_json["job"]["rider_slot"], 1)
        self.assertIn("Rider 1 of 10", acc_r1_json["message"])

        # r1 now sees rider_already_in_group=True and gets 409 trying to claim slot 2
        feed_r1_after = r1_client.get("/api/rider/available-jobs").get_json()
        grp_cards_after = [j for j in feed_r1_after["jobs"] if j.get("group_code") == group_code]
        self.assertEqual(len(grp_cards_after), 1)
        self.assertTrue(grp_cards_after[0]["rider_already_in_group"])
        self.assertEqual(grp_cards_after[0]["group_open_count"], 9)
        self.assertEqual(grp_cards_after[0]["group_assigned_count"], 1)

        dup_r1 = r1_client.post(f"/api/bookings/{slots[1]['id']}/accept")
        self.assertEqual(dup_r1.status_code, 409)

        # 4. Concurrent/stale card_id fallthrough: r2 clicks old card_id (slots[0]['id']) -> claims Slot 2!
        acc_r2 = r2_client.post(f"/api/bookings/{card_id}/accept")
        self.assertEqual(acc_r2.status_code, 200)
        acc_r2_json = acc_r2.get_json()
        self.assertEqual(acc_r2_json["job"]["id"], slots[1]["id"])
        self.assertEqual(acc_r2_json["job"]["rider_slot"], 2)
        self.assertIn("Rider 2 of 10", acc_r2_json["message"])

        # Also test a 2-rider group saturation -> 3rd rider gets 409 "already been claimed" & card vanishes from feed
        sat_cust = self.app.test_client()
        sat_resp = sat_cust.post(
            "/api/bookings",
            json={**base_payload, "customer_phone": "09181110022", "riders_count": 2},
        )
        self.assertEqual(sat_resp.status_code, 201)
        sat_data = sat_resp.get_json()
        sat_slots = sat_data["group_bookings"]
        sat_rA = self._create_active_rider(name="Sat Rider A", phone="09173330001")
        sat_rB = self._create_active_rider(name="Sat Rider B", phone="09173330002")
        sat_rC = self._create_active_rider(name="Sat Rider C", phone="09173330003")
        cA, cB, cC = self.app.test_client(), self.app.test_client(), self.app.test_client()
        for cl, rid in ((cA, sat_rA), (cB, sat_rB), (cC, sat_rC)):
            with cl.session_transaction() as sess:
                sess["rider_id"] = rid
        self.assertEqual(cA.post(f"/api/bookings/{sat_slots[0]['id']}/accept").status_code, 200)
        self.assertEqual(cB.post(f"/api/bookings/{sat_slots[0]['id']}/accept").status_code, 200)
        sat_full = cC.post(f"/api/bookings/{sat_slots[0]['id']}/accept")
        self.assertEqual(sat_full.status_code, 409)
        self.assertIn("already been claimed", sat_full.get_json()["error"].lower())
        cC_feed = cC.get("/api/rider/available-jobs").get_json()["jobs"]
        self.assertFalse(any(j.get("group_code") == sat_data["group_code"] for j in cC_feed))

        # 5. Emergency transfer in a group: cannot direct-transfer Slot 1 to co-rider r2 already in Slot 2 (409)
        tr_same_grp = r1_client.post(
            f"/api/bookings/{slots[0]['id']}/transfer",
            json={"target_rider_id": r2, "reason": "Flat tire", "go_offline": False},
        )
        self.assertEqual(tr_same_grp.status_code, 409)

        # r1 re-broadcasts Slot 1 -> rescue card appears separately from main collapsed group card in r3's feed
        reb_r1 = r1_client.post(
            f"/api/bookings/{slots[0]['id']}/transfer",
            json={"target_rider_id": None, "reason": "Flat tire near Agora", "go_offline": False},
        )
        self.assertEqual(reb_r1.status_code, 200)
        feed_r3 = r3_client.get("/api/rider/available-jobs").get_json()["jobs"]
        grp_cards_r3 = [j for j in feed_r3 if j.get("group_code") == group_code]
        self.assertEqual(len(grp_cards_r3), 2)
        rescue_cards = [j for j in grp_cards_r3 if int(j.get("transfer_count") or 0) > 0]
        self.assertEqual(len(rescue_cards), 1)
        self.assertEqual(rescue_cards[0]["id"], slots[0]["id"])

        # r3 claims the rescued Slot 1
        acc_r3 = r3_client.post(f"/api/bookings/{slots[0]['id']}/accept")
        self.assertEqual(acc_r3.status_code, 200)
        self.assertEqual(acc_r3.get_json()["job"]["rider_id"], r3)
        self.assertEqual(acc_r3.get_json()["job"]["rider_slot"], 1)

        # 6. Unified /track/<group_code> HTML & API track endpoints + per-slot GCash isolation
        track_html_resp = cust_client.get(f"/track/{group_code}")
        self.assertEqual(track_html_resp.status_code, 200)
        track_html = track_html_resp.get_data(as_text=True)
        self.assertIn(group_code, track_html)
        self.assertIn("Rider 1 of 10", track_html)
        self.assertIn("2 / 10 Riders Assigned", track_html)
        self.assertIn("group-slot-tabs", track_html)
        # Digital receipt lists EVERY booked rider by name + the combined group total
        rc_start = track_html.index('id="receipt-riders-list"')
        rc_end = track_html.index('id="receipt-promo-row"')
        receipt_block = track_html[rc_start:rc_end]
        self.assertIn("Group Rider Three", receipt_block)
        self.assertIn("Group Rider Two", receipt_block)
        self.assertIn("Rider 1:", receipt_block)
        self.assertIn("Rider 2:", receipt_block)
        self.assertIn("Waiting for rider", receipt_block)
        self.assertIn("Total Group Fare:", track_html)

        trk_slot2_resp = cust_client.get(f"/api/bookings/track/{group_code}?slot={slots[1]['booking_code']}")
        self.assertEqual(trk_slot2_resp.status_code, 200)
        trk_slot2 = trk_slot2_resp.get_json()
        self.assertEqual(len(trk_slot2["group_bookings"]), 10)
        self.assertEqual(trk_slot2["booking"]["booking_code"], slots[1]["booking_code"])
        self.assertEqual(trk_slot2["booking"]["rider_id"], r2)
        self.assertEqual(trk_slot2["booking"]["rider_gcash_number"], "09172220002")
        self.assertEqual(trk_slot2["booking"]["rider_gcash_qr"], qr_r2_url)
        self.assertEqual(trk_slot2["group_summary"]["assigned_count"], 2)
        self.assertEqual(trk_slot2["group_summary"]["open_count"], 8)

        trk_slot1 = cust_client.get(f"/api/bookings/track/{group_code}?slot={slots[0]['booking_code']}").get_json()
        self.assertEqual(trk_slot1["booking"]["rider_id"], r3)
        self.assertEqual(trk_slot1["booking"]["rider_gcash_number"], "09172220003")
        self.assertEqual(trk_slot1["booking"]["rider_gcash_qr"], qr_r3_url)

        # 7. Per-slot GCash completion gate, chat isolation, call auth, and per-slot review tracking
        self.assertEqual(r2_client.post(f"/api/bookings/{slots[1]['id']}/status", json={"status": "in_progress"}).status_code, 200)
        blk_slot2 = r2_client.post(f"/api/bookings/{slots[1]['id']}/status", json={"status": "completed"})
        self.assertEqual(blk_slot2.status_code, 400)
        self.assertTrue(blk_slot2.get_json()["requires_gcash_payment"])

        self.assertEqual(
            cust_client.post(f"/api/bookings/{slots[1]['booking_code']}/gcash/customer-sent", json={"payment_ref": "GRP-SLOT2-991"}).status_code,
            200,
        )
        # r3 cannot confirm r2's slot 2 GCash (403)
        self.assertEqual(r3_client.post(f"/api/bookings/{slots[1]['id']}/gcash/confirm", json={}).status_code, 403)
        # r2 confirms slot 2 GCash -> completes slot 2 -> submits review for slot 2
        self.assertEqual(r2_client.post(f"/api/bookings/{slots[1]['id']}/gcash/confirm", json={}).status_code, 200)
        self.assertEqual(r2_client.post(f"/api/bookings/{slots[1]['id']}/status", json={"status": "completed"}).status_code, 200)

        # Chat isolation between Slot 1 (r3) and Slot 2 (r2)
        self.assertEqual(
            cust_client.post(f"/api/chat/{slots[0]['booking_code']}/messages", json={"message": "Slot 1 private check"}).status_code,
            200,
        )
        r3_msgs = r3_client.get(f"/api/chat/{slots[0]['booking_code']}/messages").get_json()["messages"]
        self.assertTrue(any(m["message"] == "Slot 1 private check" for m in r3_msgs))
        r2_msgs = r2_client.get(f"/api/chat/{slots[1]['booking_code']}/messages").get_json()["messages"]
        self.assertFalse(any(m["message"] == "Slot 1 private check" for m in r2_msgs))
        # r2 and r1 (handed off) cannot read Slot 1 chat or start Slot 1 voice calls
        self.assertEqual(r2_client.get(f"/api/chat/{slots[0]['booking_code']}/messages").status_code, 401)
        self.assertEqual(r1_client.get(f"/api/calls/{slots[0]['booking_code']}/state").status_code, 401)
        self.assertEqual(r2_client.post(f"/api/calls/{slots[0]['booking_code']}/start", json={}).status_code, 401)
        self.assertEqual(r3_client.get(f"/api/calls/{slots[0]['booking_code']}/state").status_code, 200)

        # Customer reviews Slot 2 (r2); Slot 2 shows already_reviewed=True while Slot 1 shows False
        rev2 = cust_client.post(
            "/api/reviews",
            json={"rider_id": r2, "booking_id": slots[1]["id"], "rating": 5, "comment": "Smooth Slot 2!"},
        )
        self.assertEqual(rev2.status_code, 201)
        self.assertTrue(cust_client.get(f"/api/bookings/track/{group_code}?slot={slots[1]['booking_code']}").get_json()["already_reviewed"])
        self.assertFalse(cust_client.get(f"/api/bookings/track/{group_code}?slot={slots[0]['booking_code']}").get_json()["already_reviewed"])

        # 8. Selective customer cancel: 400 on assigned Slot 1 (still 'accepted'), 200 on open 'broadcast' Slot 10
        blk_cancel_slot1 = cust_client.post(f"/api/bookings/{slots[0]['id']}/status", json={"status": "cancelled"})
        self.assertEqual(blk_cancel_slot1.status_code, 400)
        ok_cancel_slot10 = cust_client.post(f"/api/bookings/{slots[9]['id']}/status", json={"status": "cancelled"})
        self.assertEqual(ok_cancel_slot10.status_code, 200)

        trk_after_cancel = cust_client.get(f"/api/bookings/track/{group_code}").get_json()
        gs = trk_after_cancel["group_summary"]
        self.assertEqual(gs["open_count"], 7)
        self.assertEqual(gs["cancelled_count"], 1)
        self.assertEqual(gs["completed_count"], 1)
        self.assertEqual(gs["active_count"], 8)  # 7 broadcast + 1 accepted (slot 1)
        expected_active_fare = round(sum(float(s["fare_amount"]) for s in slots[:9]), 2)
        self.assertEqual(round(float(gs["active_total_fare"]), 2), expected_active_fare)

        # Complete and review Slot 1 as well
        self.assertEqual(r3_client.post(f"/api/bookings/{slots[0]['id']}/status", json={"status": "in_progress"}).status_code, 200)
        self.assertEqual(r3_client.post(f"/api/bookings/{slots[0]['id']}/gcash/confirm", json={"verified_offline_receipt": True}).status_code, 200)
        self.assertEqual(r3_client.post(f"/api/bookings/{slots[0]['id']}/status", json={"status": "completed"}).status_code, 200)
        rev1 = cust_client.post(
            "/api/reviews",
            json={"rider_id": r3, "booking_id": slots[0]["id"], "rating": 5, "comment": "Great rescue on Slot 1!"},
        )
        self.assertEqual(rev1.status_code, 201)

        # 9. /api/customer/active-booking & SSR homepage banner reflect the active group cleanly
        act_resp = cust_client.get("/api/customer/active-booking")
        self.assertEqual(act_resp.status_code, 200)
        act_json = act_resp.get_json()
        self.assertTrue(act_json["active"])
        self.assertTrue(act_json["is_group"])
        self.assertEqual(act_json["group_code"], group_code)
        self.assertEqual(act_json["tracking_url"], f"/track/{group_code}")
        self.assertGreaterEqual(len(act_json["active_trips"]), 1)
        self.assertEqual(act_json["group_summary"]["total_riders"], 10)
        self.assertEqual(act_json["group_summary"]["completed_count"], 2)
        self.assertEqual(act_json["group_summary"]["cancelled_count"], 1)
        self.assertEqual(act_json["group_summary"]["open_count"], 7)

        home_html = cust_client.get("/").get_data(as_text=True)
        self.assertIn(group_code, home_html)
        self.assertIn("Group Ride (10 Riders)", home_html)

        # 10. UI/JS/CSS/i18n token smoke checks across rendered pages & static assets
        self.assertIn("riders-count-input", home_html)
        self.assertIn("data-riders-preset=\"10\"", home_html)
        self.assertIn("active-job-group-badge", self.client.get("/rider").get_data(as_text=True))
        for static_url, token in (
            ("/static/css/style.css", ".group-slot-tabs"),
            ("/static/css/style.css", ".riders-stepper"),
            ("/static/js/i18n.js", "Number of Riders Needed"),
            ("/static/js/track.js", "selectGroupSlot"),
            ("/static/js/track.js", "cancelOpenSlot"),
            ("/static/js/track.js", "renderReceiptRiders"),
            ("/static/js/rider.js", "rider_already_in_group"),
            ("/static/js/app.js", "riders_count"),
        ):
            s_resp = self.client.get(static_url)
            self.assertEqual(s_resp.status_code, 200)
            self.assertIn(token, s_resp.get_data(as_text=True))

        # 11. Full backup & restore preserves group_code, rider_slot, group_size for all 10 slots
        conn = get_connection(self.db_path)
        try:
            snap = export_full_backup(conn)
            res = restore_full_backup(conn, snap, wipe_existing=True)
            conn.commit()
            self.assertTrue(res["success"])
            restored_rows = conn.execute(
                "SELECT booking_code, group_code, rider_slot, group_size FROM bookings WHERE UPPER(group_code) = ? ORDER BY rider_slot ASC",
                (group_code,),
            ).fetchall()
            self.assertEqual(len(restored_rows), 10)
            for idx, rr in enumerate(restored_rows, start=1):
                self.assertEqual(rr["group_code"], group_code)
                self.assertEqual(rr["rider_slot"], idx)
                self.assertEqual(rr["group_size"], 10)
        finally:
            conn.close()

    def test_fellow_riders_realtime_activity_statuses(self):
        """
        Tests fellow riders seeing live status changes:
        'available' -> 'accepted' (Accepting Booking) -> 'in_progress' (Heading Destination) -> 'completed' (Available ✓),
        allowing other riders to know who is busy and take waiting broadcast bookings.
        """
        r1_id = self._create_active_rider(phone="09181111111", name="Rider Juan")
        r2_id = self._create_active_rider(phone="09182222222", name="Rider Pedro")

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        resp = self.client.get("/api/rider/co-riders").get_json()
        self.assertTrue(resp["success"])
        by_id = {r["id"]: r for r in resp["co_riders"]}
        self.assertEqual(by_id[r1_id]["activity_status"], "available")
        self.assertFalse(by_id[r1_id]["has_active_job"])

        b_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Test Passenger",
                "customer_phone": "09175550000",
                "service_type": "express_ride",
                "pickup_address": "Mambajao Port",
                "dropoff_address": "White Island",
            },
        ).get_json()
        booking_id = b_resp["booking"]["id"]

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        acc_resp = self.client.post(f"/api/bookings/{booking_id}/accept", json={"rider_id": r1_id})
        self.assertEqual(acc_resp.status_code, 200)

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        resp = self.client.get("/api/rider/co-riders").get_json()
        by_id = {r["id"]: r for r in resp["co_riders"]}
        self.assertEqual(by_id[r1_id]["activity_status"], "accepted")
        self.assertEqual(by_id[r1_id]["activity_label"], "Accepting Booking")
        self.assertTrue(by_id[r1_id]["has_active_job"])
        self.assertEqual(by_id[r1_id]["trip_destination"], "White Island")

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        prog_resp = self.client.post(f"/api/bookings/{booking_id}/status", json={"status": "in_progress"})
        self.assertEqual(prog_resp.status_code, 200)

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        resp = self.client.get("/api/rider/co-riders").get_json()
        by_id = {r["id"]: r for r in resp["co_riders"]}
        self.assertEqual(by_id[r1_id]["activity_status"], "in_progress")
        self.assertEqual(by_id[r1_id]["activity_label"], "Heading Destination")
        self.assertTrue(by_id[r1_id]["has_active_job"])

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        comp_resp = self.client.post(f"/api/bookings/{booking_id}/status", json={"status": "completed"})
        self.assertEqual(comp_resp.status_code, 200)

        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        resp = self.client.get("/api/rider/co-riders").get_json()
        by_id = {r["id"]: r for r in resp["co_riders"]}
        self.assertEqual(by_id[r1_id]["activity_status"], "available")
        self.assertFalse(by_id[r1_id]["has_active_job"])
        self.assertTrue(by_id[r1_id]["recent_completed"])

        rider_html = self.client.get("/rider").get_data(as_text=True)
        self.assertIn("Accepting", rider_html)
        self.assertIn("Heading Dest", rider_html)

    def test_admin_reset_launch_data(self):
        # 1. Unauthenticated or wrong password rejected
        unauth_resp = self.client.post("/api/admin/reset-launch-data", json={"admin_password": "admin"})
        self.assertEqual(unauth_resp.status_code, 401)

        with self.client.session_transaction() as sess:
            sess["is_admin"] = True

        wrong_pwd = self.client.post("/api/admin/reset-launch-data", json={"admin_password": "wrongpassword"})
        self.assertEqual(wrong_pwd.status_code, 403)

        # 2. Seed some riders, customers, and bookings
        rid = self._create_active_rider()
        cid = self._create_customer()
        book_resp = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Reset Test Cust",
                "customer_phone": "09179998877",
                "pickup_address": "Mambajao Town Plaza",
                "dropoff_address": "White Island Ferry Terminal",
                "service_type": "pahatud",
            },
        )
        self.assertEqual(book_resp.status_code, 201)

        # 3. Perform clean launch reset
        reset_resp = self.client.post("/api/admin/reset-launch-data", json={"admin_password": "admin1234"})
        self.assertEqual(reset_resp.status_code, 200)
        res = reset_resp.get_json()
        self.assertTrue(res["success"])

        # 4. Verify tables are clean while settings and promos remain intact
        from db import get_connection
        conn = get_connection(self.db_path)
        try:
            r_cnt = conn.execute("SELECT COUNT(*) AS c FROM riders").fetchone()["c"]
            b_cnt = conn.execute("SELECT COUNT(*) AS c FROM bookings").fetchone()["c"]
            c_cnt = conn.execute("SELECT COUNT(*) AS c FROM customers").fetchone()["c"]
            s_cnt = conn.execute("SELECT COUNT(*) AS c FROM settings").fetchone()["c"]
            p_cnt = conn.execute("SELECT COUNT(*) AS c FROM promo_codes").fetchone()["c"]
            self.assertEqual(r_cnt, 0)
            self.assertEqual(b_cnt, 0)
            self.assertEqual(c_cnt, 0)
            self.assertGreater(s_cnt, 0)
            self.assertGreater(p_cnt, 0)
        finally:
            conn.close()

    def test_rider_to_rider_free_inapp_voice_call(self):
        r1_id = self._create_active_rider(name="Kuya Jun Rider", phone="09171001111")
        r2_id = self._create_active_rider(name="Kuya Mark Rider", phone="09171002222")

        # Cannot call oneself
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        self_call = self.client.post(
            f"/api/rider/calls/{r1_id}/start",
            json={"offer": {"type": "offer", "sdp": "v=0..."}},
        )
        self.assertEqual(self_call.status_code, 400)

        # Rider 1 starts a free in-app call to Rider 2
        start_resp = self.client.post(
            f"/api/rider/calls/{r2_id}/start",
            json={"offer": {"type": "offer", "sdp": "v=0\r\no=rider1-sdp"}},
        )
        self.assertEqual(start_resp.status_code, 201)
        call_data = start_resp.get_json()
        self.assertTrue(call_data["success"])
        call_session = call_data["call"]
        call_id = call_session["id"]
        self.assertEqual(call_session["status"], "ringing")
        self.assertEqual(call_session["caller_role"], f"rider:{r1_id}")
        self.assertEqual(call_session["callee_role"], f"rider:{r2_id}")
        self.assertEqual(call_session["caller_name"], "Kuya Jun Rider")
        self.assertEqual(call_session["callee_name"], "Kuya Mark Rider")

        # Rider 2 polls /api/rider/calls/state and sees incoming call + offer signal
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        r2_state = self.client.get("/api/rider/calls/state").get_json()
        self.assertTrue(r2_state["success"])
        self.assertIsNotNone(r2_state["call"])
        self.assertEqual(r2_state["call"]["id"], call_id)
        self.assertEqual(r2_state["call"]["status"], "ringing")
        self.assertTrue(any(s["signal_type"] == "offer" for s in r2_state["signals"]))

        # Rider 2 answers the call with SDP answer
        ans_resp = self.client.post(
            f"/api/rider/calls/session/{call_id}/respond",
            json={
                "action": "accept",
                "answer": {"type": "answer", "sdp": "v=0\r\no=rider2-answer-sdp"},
            },
        )
        self.assertEqual(ans_resp.status_code, 200)
        self.assertEqual(ans_resp.get_json()["call"]["status"], "accepted")

        # Rider 1 exchanges ICE candidate
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        ice_resp = self.client.post(
            f"/api/rider/calls/session/{call_id}/signal",
            json={
                "signal_type": "candidate",
                "data": {"candidate": "candidate:1 1 UDP 2122252543 192.168.1.2 54321 typ host"},
            },
        )
        self.assertEqual(ice_resp.status_code, 200)
        self.assertTrue(ice_resp.get_json()["success"])

        # Rider 2 polls and receives the ICE candidate
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r2_id
        r2_connected_state = self.client.get(f"/api/rider/calls/state?call_id={call_id}").get_json()
        self.assertEqual(r2_connected_state["call"]["status"], "accepted")
        self.assertTrue(any(s["signal_type"] == "candidate" for s in r2_connected_state["signals"]))

        # Rider 1 hangs up
        with self.client.session_transaction() as sess:
            sess["rider_id"] = r1_id
        end_resp = self.client.post(
            f"/api/rider/calls/session/{call_id}/respond",
            json={"action": "hangup"},
        )
        self.assertEqual(end_resp.status_code, 200)
        self.assertEqual(end_resp.get_json()["call"]["status"], "ended")

        # Lightweight health ping (does not wake DB unless ?db=1 is passed)
        h_resp = self.client.get("/api/health")
        self.assertEqual(h_resp.status_code, 200)
        self.assertEqual(h_resp.get_json()["status"], "ok")

        h_db_resp = self.client.get("/api/health?db=1")
        self.assertEqual(h_db_resp.status_code, 200)
        self.assertEqual(h_db_resp.get_json()["status"], "ok")


if __name__ == "__main__":
    unittest.main()


