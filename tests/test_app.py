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
        self.temp_dir.cleanup()

    def test_pwa_endpoints(self):
        # 1. Manifest
        m_resp = self.client.get("/manifest.webmanifest")
        self.assertEqual(m_resp.status_code, 200)
        data = m_resp.get_json()
        self.assertIn("Camiguin Centric Riders Club", data["name"])
        self.assertEqual(data["display"], "standalone")

        # 2. Service Worker v2
        sw_resp = self.client.get("/sw.js")
        self.assertEqual(sw_resp.status_code, 200)
        self.assertIn("ccrc-pwa-v2", sw_resp.get_data(as_text=True))

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
        self.assertIn("Padala", html)
        self.assertIn("Pabili", html)
        self.assertIn("Port &amp; Bills", html)
        self.assertIn("Official Camiguin CRC Fare Matrix", html)

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

        # 2. Check available jobs feed
        feed_resp = self.client.get("/api/rider/available-jobs")
        self.assertEqual(feed_resp.status_code, 200)
        jobs = feed_resp.get_json()["jobs"]
        self.assertTrue(any(j["id"] == booking_id for j in jobs))

        # 3. Rider 1 (Kuya Jun, ID 1) accepts the booking atomically
        accept_resp = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={"rider_id": 1},
        )
        self.assertEqual(accept_resp.status_code, 200)
        self.assertTrue(accept_resp.get_json()["success"])

        # 4. Rider 2 (Kuya Mark, ID 2) tries to accept same booking -> should receive 409 Conflict
        second_accept = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={"rider_id": 2},
        )
        self.assertEqual(second_accept.status_code, 409)
        self.assertIn("already been claimed", second_accept.get_json()["error"])

        # 5. Rider 1 streams GPS coordinates while heading to pickup
        gps_resp = self.client.post(
            "/api/rider/location",
            json={
                "rider_id": 1,
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
        self.assertTrue(reg_resp.get_json()["success"])

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

        # Login
        log_resp = self.client.post(
            "/api/rider/login",
            json={"phone": "09170001122", "password": "ridersecret"},
        )
        self.assertEqual(log_resp.status_code, 200)
        self.assertTrue(log_resp.get_json()["success"])

    def test_admin_view_and_settings(self):
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
        admin_resp = self.client.get("/admin")
        self.assertEqual(admin_resp.status_code, 200)
        html = admin_resp.get_data(as_text=True)
        self.assertIn("Club Dispatch &amp; Admin Panel", html)
        self.assertIn("Kuya Jun", html)

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
        # User scenario: Pickup "Baylao", Dropoff "Jollibee"
        # Actual road distance along Camiguin roads is ~1.82 km (within 1-2 km base tariff)
        # In Camiguin CRC Fare matrix (1-2 km = 40.00), fare should be 40.00
        est_resp = self.client.post(
            "/api/fare-estimate",
            json={
                "pickup_address": "Baylao",
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
                "pickup_address": "Baylao, Mambajao",
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
        tours_resp = self.client.get("/api/tour-packages")
        self.assertEqual(tours_resp.status_code, 200)
        packages = tours_resp.get_json()["packages"]
        self.assertGreaterEqual(len(packages), 4)

        # Submit review
        rev_resp = self.client.post(
            "/api/reviews",
            json={
                "rider_id": 1,
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


if __name__ == "__main__":
    unittest.main()
