import os
import tempfile
import unittest

from app import create_app


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

        # 2. Service Worker
        sw_resp = self.client.get("/sw.js")
        self.assertEqual(sw_resp.status_code, 200)
        self.assertIn("ccrc-pwa-v1", sw_resp.get_data(as_text=True))

        # 3. Offline fallback
        off_resp = self.client.get("/offline")
        self.assertEqual(off_resp.status_code, 200)
        self.assertIn("Walay Internet Connection", off_resp.get_data(as_text=True))

    def test_customer_home_and_fare_estimate(self):
        # Home view
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)
        self.assertIn("Camiguin Centric Riders Club", html)
        self.assertIn("Pahatud / Pakuha", html)
        self.assertIn("Pasugo / Padala", html)
        self.assertIn("Pabili Service", html)
        self.assertIn("Pabayad / Port Claim", html)

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
        self.assertTrue(data["fare_amount"] >= 50.0)
        self.assertTrue(data["estimated_km"] > 0)

    def test_booking_creation_for_different_services(self):
        # 1. Passenger Ride (Pahatud)
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

        # 2. Pabili Errand with Budget & Shopping List
        b_resp = self.client.post(
            "/api/bookings",
            json={
                "service_type": "pabili",
                "customer_name": "Jerome Visitor",
                "customer_phone": "09187654321",
                "pickup_address": "Mambajao Public Market",
                "pickup_lat": 9.2483,
                "pickup_lng": 124.6975,
                "dropoff_address": "Balyali Resort, Yumbing",
                "dropoff_lat": 9.2588,
                "dropoff_lng": 124.6432,
                "item_notes": "1 whole Lechon Manok, 5 puso, 1L Coke",
                "estimated_budget": 500,
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        pabili_booking = b_resp.get_json()["booking"]
        self.assertEqual(pabili_booking["service_type"], "pabili")
        self.assertEqual(pabili_booking["estimated_budget"], 500.0)
        self.assertIn("Lechon Manok", pabili_booking["item_notes"])

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
        self.assertIn("Naunhan ka", second_accept.get_json()["error"])

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
                "bike_model": "Honda ADV 160",
                "plate_number": "CCRC-99",
                "municipality": "Mambajao",
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        r = reg_resp.get_json()["rider"]
        self.assertEqual(r["name"], "Kuya Dodong")

        # Duplicate registration should return 409
        dup_resp = self.client.post(
            "/api/rider/register",
            json={
                "name": "Kuya Dodong",
                "phone": "09170001122",
                "password": "ridersecret",
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
        admin_resp = self.client.get("/admin")
        self.assertEqual(admin_resp.status_code, 200)
        html = admin_resp.get_data(as_text=True)
        self.assertIn("Club Dispatch &amp; Admin Panel", html)
        self.assertIn("Kuya Jun", html)

        # Update settings
        set_resp = self.client.post(
            "/api/admin/settings",
            json={
                "base_fare": 60,
                "per_km_rate": 18,
                "hotline": "0917 999 8877",
            },
        )
        self.assertEqual(set_resp.status_code, 200)
        settings = set_resp.get_json()["settings"]
        self.assertEqual(settings["base_fare"], "60")
        self.assertEqual(settings["per_km_rate"], "18")


if __name__ == "__main__":
    unittest.main()
