import os
import time
import tempfile
import unittest
from unittest import mock

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

    def _as_rider(self, rider_id):
        """Log the shared test client in as this rider (server session, not request body)."""
        with self.client.session_transaction() as sess:
            sess["rider_id"] = rider_id

    def _as_no_rider(self):
        with self.client.session_transaction() as sess:
            sess.pop("rider_id", None)

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
        self.assertIn("Errand", html)
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

    def test_hinterland_auto_detection_and_fare(self):
        # Auto-detection from address keyword
        est_resp = self.client.post(
            "/api/fare-estimate",
            json={
                "pickup_lat": 9.248,
                "pickup_lng": 124.745,
                "dropoff_lat": 9.215,
                "dropoff_lng": 124.718,
                "service_type": "pahatud",
                "dropoff_address": "Soro-soro, Mambajao",
            },
        )
        self.assertEqual(est_resp.status_code, 200)
        data = est_resp.get_json()
        self.assertEqual(data["breakdown"]["hinterland_fee"], 30.0)

        # Booking creation auto-tagging
        b_resp = self.client.post(
            "/api/bookings",
            json={
                "service_type": "pahatud",
                "customer_name": "Test Mountain Passenger",
                "customer_phone": "09171234567",
                "pickup_address": "Poblacion, Mambajao",
                "dropoff_address": "Katibawasan Falls",
                "item_notes": "",
            },
        )
        self.assertEqual(b_resp.status_code, 201)
        b_json = b_resp.get_json()
        self.assertEqual(b_json["breakdown"]["hinterland_fee"], 30.0)
        self.assertIn("[🏔️ Hinterland / Bukid Route +₱30]", b_json["booking"]["item_notes"])

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

        # 2. Check available jobs feed
        self._as_rider(r1_id)
        feed_resp = self.client.get("/api/rider/available-jobs")
        self.assertEqual(feed_resp.status_code, 200)
        jobs = feed_resp.get_json()["jobs"]
        self.assertTrue(any(j["id"] == booking_id for j in jobs))

        # 3. Rider 1 accepts the booking atomically
        self._as_rider(r1_id)
        accept_resp = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={"rider_id": r1_id},
        )
        self.assertEqual(accept_resp.status_code, 200)
        self.assertTrue(accept_resp.get_json()["success"])

        # 4. Rider 2 tries to accept same booking -> should receive 409 Conflict
        self._as_rider(r2_id)
        second_accept = self.client.post(
            f"/api/bookings/{booking_id}/accept",
            json={"rider_id": r2_id},
        )
        self.assertEqual(second_accept.status_code, 409)
        self.assertIn("already been claimed", second_accept.get_json()["error"])

        # 5. Rider 1 streams GPS coordinates while heading to pickup
        self._as_rider(r1_id)
        gps_resp = self.client.post(
            "/api/rider/location",
            json={
                "rider_id": r1_id,
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
        self._as_no_rider()
        denied = self.client.post(f"/api/bookings/{booking_id}/status", json={"status": "completed"})
        self.assertEqual(denied.status_code, 403)  # anonymous callers cannot change a booking
        self._as_rider(r2_id)
        denied2 = self.client.post(f"/api/bookings/{booking_id}/status", json={"status": "completed"})
        self.assertEqual(denied2.status_code, 403)  # a different rider cannot either
        self._as_rider(r1_id)
        prog_resp = self.client.post(
            f"/api/bookings/{booking_id}/status",
            json={"status": "in_progress"},
        )
        self.assertEqual(prog_resp.status_code, 200)

        # Upload store receipt photo
        sample_receipt_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        rcpt_resp = self.client.post(
            f"/api/bookings/{booking_id}/receipt",
            json={"receipt_image": sample_receipt_b64},
        )
        self.assertEqual(rcpt_resp.status_code, 200)
        self.assertTrue(rcpt_resp.get_json()["success"])
        self.assertIn("/media/receipt_", rcpt_resp.get_json()["receipt_url"])

        comp_resp = self.client.post(
            f"/api/bookings/{booking_id}/status",
            json={"status": "completed"},
        )
        self.assertEqual(comp_resp.status_code, 200)

        # Verify completed status and receipt URL on customer tracking
        final_track = self.client.get(f"/api/bookings/track/{code}").get_json()["booking"]
        self.assertEqual(final_track["status"], "completed")
        self.assertEqual(final_track["receipt_url"], rcpt_resp.get_json()["receipt_url"])

        track_html_resp = self.client.get(f"/track/{code}")
        self.assertEqual(track_html_resp.status_code, 200)
        t_page = track_html_resp.get_data(as_text=True)
        self.assertIn("Balik sa Dashboard", t_page)
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
            sess["admin_ts"] = time.time()
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
            sess["admin_ts"] = time.time()
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

    @mock.patch("urllib.request.urlopen")
    def test_typed_address_geocoding_baylao_to_jollibee(self, mock_urlopen):
        # Make the test independent of the internet: pretend the online road router (OSRM)
        # answers with a 1.82 km road route, so we test our geocoding + fare logic only.
        import json as _json
        import urllib.error
        import db as _db

        _db._ROAD_ROUTE_CACHE.clear()

        class _FakeResp:
            def __init__(self, payload):
                self._payload = payload

            def read(self):
                return _json.dumps(self._payload).encode("utf-8")

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def _fake_urlopen(req, *args, **kwargs):
            url = getattr(req, "full_url", str(req))
            if "osrm" in url:
                return _FakeResp({
                    "code": "Ok",
                    "routes": [{"distance": 1820.0,
                                "geometry": {"coordinates": [[124.69541, 9.24956], [124.7165, 9.2496]]}}],
                })
            raise urllib.error.URLError("offline in tests")

        mock_urlopen.side_effect = _fake_urlopen

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
        # Promo codes are OFF by default; switch them on just for this test of the optional feature
        self.app.config["PROMOS_ENABLED"] = True
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

        # A review without a completed trip must be refused
        bad_rev = self.client.post("/api/reviews", json={"rider_id": r_id, "rating": 1, "comment": "fake"})
        self.assertEqual(bad_rev.status_code, 403)

        # Complete a real trip first: customer books, assigned rider accepts and completes
        bk = self.client.post(
            "/api/bookings",
            json={
                "customer_name": "Tourist Juan",
                "customer_phone": "09175550101",
                "pickup_address": "Balbagon Port",
                "dropoff_address": "Mambajao Public Market",
                "service_type": "pahatud",
            },
        ).get_json()["booking"]
        self._as_rider(r_id)
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/accept").status_code, 200)
        self.assertEqual(
            self.client.post(f"/api/bookings/{bk['id']}/status", json={"status": "completed"}).status_code, 200
        )
        self._as_no_rider()  # back to the passenger

        # Submit review
        rev_resp = self.client.post(
            "/api/reviews",
            json={
                "booking_id": bk["id"],
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

        # Verify broadcast booking contains customer verification badge info
        self._as_rider(r_id)
        avail_resp = self.client.get("/api/rider/available-jobs")
        self.assertEqual(avail_resp.status_code, 200)
        jobs = avail_resp.get_json()["jobs"]
        matching = [j for j in jobs if j["id"] == b_id]
        self.assertTrue(len(matching) > 0)
        self.assertEqual(matching[0]["customer_verified"], 1)

        # 2. Rider accepts booking
        accept_resp = self.client.post(f"/api/bookings/{b_id}/accept", json={"rider_id": r_id})
        self.assertEqual(accept_resp.status_code, 200)

        # 3. Rider completes booking
        comp_resp = self.client.post(f"/api/bookings/{b_id}/status", json={"status": "completed"})
        self.assertEqual(comp_resp.status_code, 200)

        # 4. Check rider transactions endpoint
        rider_txns_resp = self.client.get(f"/api/rider/transactions?rider_id={r_id}")
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
            sess["admin_ts"] = time.time()

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
        prod_app = create_app({"TESTING": False, "DB_PATH": self.db_path})
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
        self.assertIn("Kinahanglan mo-Sign In o mag-Register una", resp.get_json()["error"])

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
            sess["admin_ts"] = time.time()
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
            sess["admin_ts"] = time.time()

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

        # Rider Forgot Password - Valid with Plate Number
        ok_rider_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "789CCRC", "new_password": "newriderpwd123"},
        )
        self.assertEqual(ok_rider_fp.status_code, 200)
        self.assertTrue(ok_rider_fp.get_json()["success"])

        # Rider can now login with new password
        rider_login_resp = self.client.post(
            "/api/rider/login",
            json={"phone": "09175551234", "password": "newriderpwd123"},
        )
        self.assertEqual(rider_login_resp.status_code, 200)

        # Rider Forgot Password - Valid with Driver's License
        ok_rider_license_fp = self.client.post(
            "/api/rider/forgot-password",
            json={"phone": "09175551234", "identifier": "D01-99-123456", "new_password": "licenseriderpwd456"},
        )
        self.assertEqual(ok_rider_license_fp.status_code, 200)

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
            sess["admin_ts"] = time.time()

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

    # ------------------------------------------------------------------
    # Security regression tests
    # ------------------------------------------------------------------
    def test_admin_settings_requires_login_and_hides_hash(self):
        anon = self.client.post("/api/admin/settings", json={"hotline": "0000"})
        self.assertEqual(anon.status_code, 401)
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
            sess["admin_ts"] = time.time()
        ok = self.client.post("/api/admin/settings", json={"hotline": "0917 555 0100"})
        self.assertEqual(ok.status_code, 200)
        self.assertNotIn("admin_password_hash", ok.get_json()["settings"])
        self.assertNotIn("_session_secret", ok.get_json()["settings"])

    def test_admin_session_expires(self):
        with self.client.session_transaction() as sess:
            sess["is_admin"] = True
            sess["admin_ts"] = time.time() - 13 * 3600
        self.assertEqual(self.client.post("/api/admin/settings", json={"hotline": "1"}).status_code, 401)

    def test_default_admin_passwords_are_rejected_in_production_mode(self):
        prod_app = create_app({"TESTING": False, "DB_PATH": self.db_path})
        client = prod_app.test_client()
        for weak in ("admin1234", "admin"):
            res = client.post("/api/admin/login", json={"password": weak})
            self.assertEqual(res.status_code, 401)

    def test_admin_password_from_environment(self):
        os.environ["ADMIN_PASSWORD"] = "My-Very-Strong-Pass-77"
        try:
            prod_app = create_app({"TESTING": False, "DB_PATH": self.db_path})
        finally:
            os.environ.pop("ADMIN_PASSWORD", None)
        client = prod_app.test_client()
        self.assertEqual(client.post("/api/admin/login", json={"password": "admin1234"}).status_code, 401)
        self.assertEqual(client.post("/api/admin/login", json={"password": "My-Very-Strong-Pass-77"}).status_code, 200)

    def test_cross_site_post_is_blocked_in_production_mode(self):
        prod_app = create_app({"TESTING": False, "DB_PATH": self.db_path})
        client = prod_app.test_client()
        res = client.post("/api/customer/login", json={"phone": "x", "password": "y"},
                          headers={"Origin": "https://evil.example"})
        self.assertEqual(res.status_code, 403)

    def test_login_is_rate_limited(self):
        app = create_app({"TESTING": True, "DB_PATH": self.db_path, "RATE_LIMIT_IN_TESTS": True})
        client = app.test_client()
        codes = [client.post("/api/customer/login", json={"phone": "09170000001", "password": "wrong-%d" % i}).status_code
                 for i in range(12)]
        self.assertIn(429, codes)

    def test_customer_history_only_for_own_account(self):
        self._create_customer(name="Maria", phone="09183334455", password="custpassword123")
        self.assertEqual(self.client.get("/api/customer/history/09183334455").status_code, 403)
        login = self.client.post("/api/customer/login", json={"phone": "09183334455", "password": "custpassword123"})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(self.client.get("/api/customer/history/09183334455").status_code, 200)
        self.assertEqual(self.client.get("/api/customer/history/09999999999").status_code, 403)
        me = self.client.get("/api/customer/me").get_json()
        self.assertNotIn("password_hash", me["customer"])

    def test_rider_endpoints_ignore_rider_id_in_request(self):
        r_id = self._create_active_rider(name="Rider A", phone="09170000011")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550199",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]
        self._as_no_rider()
        spoof = self.client.post(f"/api/bookings/{bk['id']}/accept", json={"rider_id": r_id})
        self.assertEqual(spoof.status_code, 401)
        self.assertEqual(self.client.get("/api/rider/available-jobs").status_code, 401)
        self.assertEqual(self.client.get(f"/api/rider/transactions?rider_id={r_id}").status_code, 400)
        self.assertEqual(self.client.post("/api/rider/location", json={"rider_id": r_id, "lat": 9.2, "lng": 124.7}).status_code, 400)

    def test_upload_rejects_non_images(self):
        r_id = self._create_active_rider(name="Rider B", phone="09170000012")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550198",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]
        import base64 as b64
        evil = "data:image/jpeg;base64," + b64.b64encode(b"<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>").decode()
        res = self.client.post(f"/api/bookings/{bk['id']}/receipt", json={"receipt_image": evil})
        self.assertEqual(res.status_code, 400)

    def test_receipt_upload_requires_booking_participant(self):
        self._create_active_rider(name="Rider C", phone="09170000013")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550197",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]
        stranger = self.app.test_client()
        jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        self.assertEqual(stranger.post(f"/api/bookings/{bk['id']}/receipt", json={"receipt_image": jpeg}).status_code, 403)
        self.assertEqual(stranger.post(f"/api/bookings/{bk['id']}/status", json={"status": "cancelled"}).status_code, 403)
        self.assertEqual(stranger.get(f"/api/chat/{bk['id']}/messages").status_code, 403)

    def test_chat_sender_role_cannot_be_spoofed(self):
        self._create_active_rider(name="Rider D", phone="09170000014")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550196",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]
        res = self.client.post(f"/api/chat/{bk['booking_code']}/messages",
                               json={"message": "hello", "sender_role": "rider"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["message"]["sender_role"], "customer")

    def test_media_is_served_as_sandboxed_image_only(self):
        from db import get_connection, save_uploaded_media
        conn = get_connection(self.db_path)
        try:
            save_uploaded_media(conn, "evil.svg", b"<svg onload=alert(1)/>", "image/svg+xml")
            conn.commit()
        finally:
            conn.close()
        res = self.client.get("/media/evil.svg")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "application/octet-stream")
        self.assertIn("sandbox", res.headers.get("Content-Security-Policy", ""))

    def test_rider_enters_purchase_amount_and_customer_sees_total(self):
        r_id = self._create_active_rider(name="Rider P", phone="09170000021")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550301",
            "pickup_address": "Jollibee Camiguin, Mambajao", "dropoff_address": "Benoni, Mahinog",
            "service_type": "pabili", "item_notes": "1 lechon manok", "estimated_budget": 300}).get_json()["booking"]
        code = bk["booking_code"]

        # not logged in as the assigned rider -> refused
        self._as_no_rider()
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/purchase", json={"amount": 275}).status_code, 403)

        self._as_rider(r_id)
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/accept").status_code, 200)
        for bad in (-5, "abc", 10**7, None):
            self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/purchase", json={"amount": bad}).status_code, 400)
        ok = self.client.post(f"/api/bookings/{bk['id']}/purchase", json={"amount": 275})
        self.assertEqual(ok.status_code, 200)
        body = ok.get_json()
        self.assertEqual(body["purchase_amount"], 275.0)
        self.assertAlmostEqual(body["total_due"], body["fare_amount"] + 275.0, places=2)

        # customer sees it live (tracking API + page) and in the chat
        self._as_no_rider()
        tr = self.client.get(f"/api/bookings/track/{code}").get_json()
        self.assertEqual(tr["booking"]["purchase_amount"], 275.0)
        page = self.client.get(f"/track/{code}").get_data(as_text=True)
        self.assertIn("Total nga Bayronon", page)
        msgs = self.client.get(f"/api/chat/{code}/messages").get_json()["messages"]
        self.assertTrue(any("275" in m["message"] for m in msgs))

    def test_passenger_ride_has_no_purchase_amount(self):
        r_id = self._create_active_rider(name="Rider Q", phone="09170000022")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550302",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]
        self._as_rider(r_id)
        self.client.post(f"/api/bookings/{bk['id']}/accept")
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/purchase", json={"amount": 100}).status_code, 400)

    def test_baylao_places_resolve_on_the_highway(self):
        for text, lat, lng in (
            ("Baylao Elementary School", 9.24956, 124.69541),
            ("baylao basketball court", 9.24951, 124.69505),
            ("Bahay Pamahalaan ng Barangay Baylao", 9.24951, 124.69505),
        ):
            res = self.client.post("/api/fare-estimate", json={
                "pickup_address": text, "dropoff_address": "Jollibee", "service_type": "pahatud"})
            self.assertEqual(res.status_code, 200)
            pickup = res.get_json()["resolved_pickup"]
            self.assertAlmostEqual(pickup["lat"], lat, places=5)
            self.assertAlmostEqual(pickup["lng"], lng, places=5)

    def test_customer_receipt_shows_rider_name_plate_and_purchase_total(self):
        r_id = self._create_active_rider(name="Rider Receipt", phone="09170000031")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Pax", "customer_phone": "09175550401",
            "pickup_address": "Jollibee Camiguin, Mambajao", "dropoff_address": "Benoni, Mahinog",
            "service_type": "pabili", "item_notes": "1 lechon manok"}).get_json()["booking"]
        self._as_rider(r_id)
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/accept").status_code, 200)
        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/purchase", json={"amount": 275}).status_code, 200)
        self._as_no_rider()
        page = self.client.get(f"/track/{bk['booking_code']}").get_data(as_text=True)
        self.assertIn("Rider Receipt", page)
        self.assertIn("Plate No.", page)
        self.assertIn("Pinalit (gi-input sa rider)", page)
        self.assertIn('id="modal-total-fare"', page)
        self.assertNotIn("09170000031", page.split('id="receipt-modal"', 1)[1].split("modal-receipt-img-wrap", 1)[0])
    def test_promo_codes_are_disabled_by_default(self):
        res = self.client.post("/api/promo/validate", json={"code": "WELCOME20", "fare_amount": 100.0})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json()["success"])
        payload = {
            "customer_name": "Maria Santos", "customer_phone": "09171234568", "service_type": "pahatud",
            "pickup_address": "Baylao, Mambajao", "dropoff_address": "Jollibee Camiguin",
        }
        plain = self.client.post("/api/bookings", json=payload).get_json()["booking"]
        with_code = self.client.post("/api/bookings", json={**payload, "promo_code": "WELCOME20"}).get_json()["booking"]
        self.assertEqual(float(with_code.get("discount_amount") or 0), 0.0)
        self.assertEqual(with_code["fare_amount"], plain["fare_amount"])
        html = self.client.get("/").get_data(as_text=True)
        self.assertNotIn('id="promo-code-input"', html)

    def test_rider_sees_customer_photo_in_feed_and_active_job(self):
        jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        reg = self.client.post("/api/customer/register", json={
            "name": "Angeline Dangan", "phone": "09175550148", "email": "angeline@example.com",
            "password": "secret123", "barangay": "Poblacion", "avatar_base64": jpeg})
        self.assertEqual(reg.status_code, 200, reg.get_data(as_text=True))
        photo = reg.get_json()["customer"]["avatar_url"]
        self.assertTrue(photo.startswith("/media/"))

        r_id = self._create_active_rider(name="Rider Photo", phone="09170000041")
        bk = self.client.post("/api/bookings", json={
            "customer_name": "Angeline Dangan", "customer_phone": "09175550148",
            "pickup_address": "Balbagon Port", "dropoff_address": "Mambajao Public Market",
            "service_type": "pahatud"}).get_json()["booking"]

        self._as_rider(r_id)
        feed = self.client.get("/api/rider/available-jobs").get_json()
        job = next(j for j in feed["jobs"] if j["id"] == bk["id"])
        self.assertEqual(job.get("customer_avatar"), photo)

        self.assertEqual(self.client.post(f"/api/bookings/{bk['id']}/accept").status_code, 200)
        active = self.client.get("/api/rider/active-job").get_json()
        self.assertEqual(active["job"]["customer_avatar"], photo)
        self.assertEqual(self.client.get(photo).status_code, 200)

        js = self.client.get("/static/js/rider.js").get_data(as_text=True)
        self.assertIn("active-job-customer-avatar", js)
        html = self.client.get("/rider").get_data(as_text=True)
        self.assertIn('id="active-job-customer-avatar"', html)

    def test_island_tour_banner_is_at_the_bottom_of_the_home_page(self):
        html = self.client.get("/").get_data(as_text=True)
        self.assertEqual(html.count("Planning an Island Tour"), 1)
        self.assertLess(html.index('id="fare-display"'), html.index("Planning an Island Tour"))
        self.assertLess(html.index("Camiguin Live Island Map"), html.index("Planning an Island Tour"))
        self.assertIn('href="/tours"', html)

    def test_logged_in_customer_gets_compact_passenger_info(self):
        html = self.client.get("/").get_data(as_text=True)
        # compact summary exists, hidden by default, and the real inputs are still in the form
        self.assertIn('id="customer-compact-card" class="hidden"', html)
        self.assertIn('id="customer-name"', html)
        self.assertIn('id="customer-phone"', html)
        js = self.client.get("/static/js/app.js").get_data(as_text=True)
        self.assertIn("customer-compact-card", js)
        self.assertIn("customer-compact-edit", js)

    def test_rider_hub_has_cart_button_that_opens_the_request_list(self):
        from html.parser import HTMLParser

        html = self.client.get("/rider").get_data(as_text=True)
        self.assertIn('id="requests-fab"', html)
        self.assertIn('id="requests-fab-count"', html)
        self.assertIn('id="requests-drawer-close"', html)

        void = {"br", "img", "input", "meta", "link", "hr", "source", "area", "base", "col", "embed", "param", "track", "wbr"}

        class Nesting(HTMLParser):
            def __init__(self):
                super().__init__()
                self.stack, self.inside = [], {}

            def handle_starttag(self, tag, attrs):
                if tag in void:
                    return
                attrs = dict(attrs)
                el_id = attrs.get("id")
                self.stack.append(el_id or "")
                if el_id:
                    self.inside[el_id] = "requests-drawer" in self.stack[:-1]

            def handle_endtag(self, tag):
                if tag in void:
                    return
                if self.stack:
                    self.stack.pop()

        parser = Nesting()
        parser.feed(html)
        # only the booking requests live inside the full-screen drawer ...
        self.assertTrue(parser.inside["available-jobs-feed"])
        self.assertTrue(parser.inside["jobs-count-pill"])
        # ... earnings, advisory, reserved trips and the active trip must NOT be swallowed by it
        for el_id in ("rider-today-earnings", "open-rider-txns-btn", "rider-club-advisory-banner",
                      "rider-scheduled-card", "rider-active-job-box", "requests-fab"):
            self.assertIn(el_id, parser.inside, el_id)
            self.assertFalse(parser.inside[el_id], f"{el_id} is wrongly inside the requests drawer")
        self.assertLess(html.index('id="rider-active-job-box"'), html.index('id="requests-drawer"'))
        # earnings are shown at the top of the dashboard, right after the online/offline banner
        self.assertLess(html.index('rider-status-banner'), html.index('id="rider-today-earnings"'))
        self.assertLess(html.index('id="rider-today-earnings"'), html.index('id="rider-active-job-box"'))

    def test_reviews_api_returns_total_average_and_supports_limit(self):
        from db import get_connection, create_review

        r_id = self._create_active_rider(name="Rider Many Reviews", phone="09170000051")
        conn = get_connection(self.db_path)
        try:
            for i in range(12):
                create_review(conn, None, r_id, f"Pax {i}", 5 if i % 2 == 0 else 4, f"comment {i}")
            conn.commit()
        finally:
            conn.close()

        default = self.client.get(f"/api/reviews/{r_id}").get_json()
        self.assertEqual(len(default["reviews"]), 10)          # old behaviour kept for other callers
        self.assertEqual(default["total"], 12)
        self.assertAlmostEqual(default["average"], 4.5, places=2)

        more = self.client.get(f"/api/reviews/{r_id}?limit=100").get_json()
        self.assertEqual(len(more["reviews"]), 12)
        self.assertEqual(more["reviews"][0]["customer_name"], "Pax 11")   # newest first

        js = self.client.get("/static/js/rider.js").get_data(as_text=True)
        self.assertIn("rider-reviews-toggle", js)
        self.assertIn("REVIEWS_PREVIEW_COUNT", js)
        self.assertIn('id="rider-reviews-toggle"', self.client.get("/rider").get_data(as_text=True))

    def test_home_history_card_shows_summary_only(self):
        html = self.client.get("/").get_data(as_text=True)
        # summary + "View Full History" stay; the list of recent trips moves to the history page only
        self.assertIn('id="customer-home-history-card"', html)
        self.assertIn('id="customer-home-trips-count"', html)
        self.assertIn('href="/history"', html)
        self.assertNotIn('id="customer-home-recent-feed"', html)


if __name__ == "__main__":
    unittest.main()