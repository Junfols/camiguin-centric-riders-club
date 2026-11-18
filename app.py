"""
Flask Application for Camiguin Centric Riders Club (CCRC).
On-Demand Island Express Riders: Pahatud, Pakuha, Pasugo & Pabili.
"""

from __future__ import annotations

import os
import secrets
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from flask import (
    Flask,
    Response,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import (
    CAMIGUIN_KNOWN_PLACES,
    export_full_backup,
    restore_full_backup,
    add_booking_message,
    get_booking_messages,
    accept_booking,
    calculate_fare,
    calculate_haversine_km,
    calculate_road_km,
    create_booking,
    geocode_camiguin_location,
    get_available_broadcast_bookings,
    get_booking_by_code,
    get_booking_by_id,
    get_booking_tracking_trail,
    get_connection,
    get_online_riders,
    get_rider_active_job,
    get_rider_scheduled_jobs,
    get_now_pht,
    get_rider_by_id,
    get_rider_by_phone,
    get_settings,
    get_uploaded_media,
    init_db,
    normalize_ph_phone,
    register_rider,
    save_uploaded_media,
    search_camiguin_places,
    update_booking_status,
    update_rider_location,
    update_rider_online_status,
    update_settings,
    CAMIGUIN_TOUR_PACKAGES,
    get_or_create_customer,
    register_customer,
    authenticate_customer,
    toggle_customer_verify,
    get_all_customers,
    get_customer_by_phone,
    get_customer_ride_history,
    delete_rider,
    delete_customer,
    update_rider_password,
    update_customer_password,
    record_transaction,
    get_all_transactions,
    get_rider_transactions,
    get_customer_transactions,
    get_financial_summary,
    validate_promo_code,
    apply_promo_code,
    create_review,
    get_rider_reviews,
    calculate_nearest_rider_eta,
)

_INIT_DB_LOCK = threading.Lock()
_RATE_LIMIT_BUCKETS: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_LOCK = threading.Lock()


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = bool(os.environ.get("RENDER") or os.environ.get("HTTPS"))
    if test_config:
        app.config.update(test_config)

    db_path = "riders_club.db"
    if test_config and "DB_PATH" in test_config:
        db_path = test_config["DB_PATH"]

    def get_db():
        if "db" not in g:
            g.db = get_connection(db_path)
        return g.db

    @app.teardown_appcontext
    def close_db(exception=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    # Initialize tables and seed on start (thread-safe)
    with _INIT_DB_LOCK:
        with app.app_context():
            conn = get_db()
            init_db(conn)

    def _get_csrf_token() -> str:
        tok = session.get("_csrf_token")
        if not tok:
            tok = secrets.token_urlsafe(32)
            session["_csrf_token"] = tok
        return tok

    def _check_rate_limit(bucket_name: str, max_calls: int, window_sec: int) -> bool:
        if app.config.get("TESTING") and not app.config.get("RATE_LIMIT_ENABLED"):
            return True
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()
        key = f"{bucket_name}:{ip}"
        now = time.monotonic()
        with _RATE_LIMIT_LOCK:
            timestamps = [t for t in _RATE_LIMIT_BUCKETS[key] if now - t < window_sec]
            if len(timestamps) >= max_calls:
                _RATE_LIMIT_BUCKETS[key] = timestamps
                return False
            timestamps.append(now)
            _RATE_LIMIT_BUCKETS[key] = timestamps
            return True

    @app.before_request
    def enforce_csrf_and_rate_limits():
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            # Rate limits for sensitive endpoints
            path = request.path
            if path.endswith("/login") or path.endswith("/forgot-password"):
                if not _check_rate_limit("auth", max_calls=15, window_sec=60):
                    return jsonify({"error": "Too many attempts. Please wait a minute and try again."}), 429
            elif path == "/api/bookings":
                if not _check_rate_limit("bookings", max_calls=10, window_sec=60):
                    return jsonify({"error": "Too many booking requests. Please wait a moment."}), 429
            elif path == "/api/promo/validate":
                if not _check_rate_limit("promo", max_calls=20, window_sec=60):
                    return jsonify({"error": "Too many promo code attempts. Please wait a minute."}), 429

            # CSRF check in non-testing mode (or when explicitly enabled)
            csrf_enabled = app.config.get("CSRF_ENABLED", not app.config.get("TESTING"))
            if csrf_enabled:
                expected = session.get("_csrf_token")
                provided = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
                if not expected or not provided or not secrets.compare_digest(str(expected), str(provided)):
                    return jsonify({"error": "Invalid or missing CSRF token. Please refresh the page."}), 403

    @app.after_request
    def set_security_headers(response: Response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    # -------------------------------------------------------------------------
    # Context Processor for Global Template Data
    # -------------------------------------------------------------------------
    @app.context_processor
    def inject_club_context():
        conn = get_db()
        settings = get_settings(conn)
        return {
            "csrf_token": _get_csrf_token(),
            "club": {
                "name": settings.get("club_name", "Camiguin Centric Riders Club"),
                "tagline": settings.get("tagline", "Express Ride-Hailing, Courier, & Errand Services in Camiguin Island"),
                "hotline": settings.get("hotline", "0917 555 0199"),
                "base_fare": settings.get("base_fare", "40"),
                "per_km_rate": settings.get("per_km_rate", "18"),
                "min_fare": settings.get("min_fare", "40"),
                "pabili_service_fee": settings.get("pabili_service_fee", "20"),
                "pasugo_service_fee": settings.get("pasugo_service_fee", "20"),
                "queuing_fee": settings.get("queuing_fee", "30"),
                "extra_store_fee": settings.get("extra_store_fee", "20"),
                "bulky_order_fee": settings.get("bulky_order_fee", "20"),
                "hinterland_fee": settings.get("hinterland_fee", "30"),
            },
            "db_backend": getattr(conn, "backend", "sqlite"),
            "year": datetime.now().year,
        }

    # -------------------------------------------------------------------------
    # PWA Endpoints
    # -------------------------------------------------------------------------
    @app.get("/manifest.webmanifest")
    def manifest():
        conn = get_db()
        settings = get_settings(conn)
        club_name = settings.get("club_name", "Camiguin Centric Riders Club")
        return jsonify(
            {
                "name": club_name,
                "short_name": "Centric Riders",
                "description": "On-Demand Island Rider & Express Delivery Booking — Passenger Ride-Hailing, Parcel Courier, & Buy-For-Me in Camiguin.",
                "start_url": "/",
                "display": "standalone",
                "background_color": "#ffffff",
                "theme_color": "#f97316",
                "orientation": "portrait-primary",
                "icons": [
                    {
                        "src": "/static/icons/icon-192.png",
                        "sizes": "192x192",
                        "type": "image/png",
                        "purpose": "any maskable",
                    },
                    {
                        "src": "/static/icons/icon-512.png",
                        "sizes": "512x512",
                        "type": "image/png",
                        "purpose": "any maskable",
                    },
                ],
            }
        )

    @app.get("/sw.js")
    def service_worker():
        response = send_from_directory("static", "sw.js")
        response.headers["Content-Type"] = "application/javascript"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Service-Worker-Allowed"] = "/"
        return response

    @app.get("/offline")
    def offline_page():
        return render_template("offline.html")

    @app.get("/media/<path:filename>")
    def serve_uploaded_media(filename: str):
        conn = get_db()
        res = get_uploaded_media(conn, filename)
        if not res:
            return "File not found", 404
        data, mimetype = res
        return Response(data, mimetype=mimetype)

    # -------------------------------------------------------------------------
    # Customer Storefront & Booking Routes
    # -------------------------------------------------------------------------
    @app.get("/")
    @app.get("/customer")
    @app.get("/bookings")
    def index():
        if session.get("rider_id"):
            return redirect("/rider")
        conn = get_db()
        online_riders = get_online_riders(conn)
        settings = get_settings(conn)

        active_booking = None
        code = session.get("active_booking_code")
        if code:
            b = get_booking_by_code(conn, code)
            if b and b.get("status") in ("broadcast", "accepted", "in_progress"):
                active_booking = b
            else:
                session.pop("active_booking_code", None)

        return render_template(
            "index.html",
            online_riders_count=len(online_riders),
            settings=settings,
            active_nav="book",
            active_booking=active_booking,
        )

    @app.get("/api/road-route")
    def api_road_route():
        try:
            p_lat = float(request.args.get("p_lat") or 0.0)
            p_lng = float(request.args.get("p_lng") or 0.0)
            d_lat = float(request.args.get("d_lat") or 0.0)
            d_lng = float(request.args.get("d_lng") or 0.0)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid coordinates"}), 400

        if not (p_lat and p_lng and d_lat and d_lng):
            return jsonify({"error": "Missing pickup or dropoff coordinates"}), 400

        road_km, coords = calculate_road_km(p_lat, p_lng, d_lat, d_lng)
        return jsonify({
            "code": "Ok",
            "road_km": road_km,
            "route_coords": coords,
        })

    @app.post("/api/fare-estimate")
    def estimate_fare():
        conn = get_db()
        settings = get_settings(conn)
        data = request.get_json(silent=True) or {}
        p_lat = float(data.get("pickup_lat") or 0.0)
        p_lng = float(data.get("pickup_lng") or 0.0)
        d_lat = float(data.get("dropoff_lat") or 0.0)
        d_lng = float(data.get("dropoff_lng") or 0.0)
        p_addr = (data.get("pickup_address") or "").strip()
        d_addr = (data.get("dropoff_address") or "").strip()
        service = (data.get("service_type") or "pahatud").lower()

        is_large_store = bool(data.get("is_large_store", False))
        extra_stores_count = int(data.get("extra_stores_count") or 0)
        is_bulky = bool(data.get("is_bulky_or_high_value", False))
        is_hinterland = bool(data.get("is_hinterland", False))

        # Auto-geocode text addresses if coordinates are missing
        if (not p_lat or not p_lng) and p_addr:
            geo_p = geocode_camiguin_location(p_addr)
            if geo_p:
                p_lat, p_lng = geo_p["lat"], geo_p["lng"]

        if (not d_lat or not d_lng) and d_addr:
            geo_d = geocode_camiguin_location(d_addr)
            if geo_d:
                d_lat, d_lng = geo_d["lat"], geo_d["lng"]

        # Client may have provided pre-fetched road route distance from browser OSRM
        client_road_km = None
        try:
            if data.get("road_km"):
                client_road_km = float(data.get("road_km"))
        except (ValueError, TypeError):
            client_road_km = None

        road_coords = None
        if p_lat and p_lng and d_lat and d_lng:
            if client_road_km and client_road_km > 0:
                km = round(client_road_km, 2)
            else:
                road_km, road_coords = calculate_road_km(p_lat, p_lng, d_lat, d_lng)
                km = road_km
        else:
            km = 1.5  # default close island distance (₱40 base)

        fare, estimated_km, breakdown = calculate_fare(
            km=km,
            service_type=service,
            settings=settings,
            is_large_store=is_large_store,
            extra_stores_count=extra_stores_count,
            is_bulky_or_high_value=is_bulky,
            is_hinterland=is_hinterland,
        )
        return jsonify({
            "estimated_km": estimated_km,
            "road_km": estimated_km,
            "fare_amount": fare,
            "service_type": service,
            "breakdown": breakdown,
            "resolved_pickup": {"lat": p_lat, "lng": p_lng} if p_lat and p_lng else None,
            "resolved_dropoff": {"lat": d_lat, "lng": d_lng} if d_lat and d_lng else None,
            "route_coords": road_coords,
        })


    # -------------------------------------------------------------------------
    # Public Information & Feature Pages
    # -------------------------------------------------------------------------
    @app.get("/tours")
    def tours_page():
        conn = get_db()
        settings = get_settings(conn)
        online_riders = get_online_riders(conn)
        enriched_packages = []
        for pkg in CAMIGUIN_TOUR_PACKAGES:
            itinerary = pkg.get("itinerary") or []
            enriched_packages.append({
                **pkg,
                "rate": pkg.get("base_fare", 450),
                "rate_note": pkg.get("recommended_rider", "1 Verified Habal-habal Guide"),
                "highlights": itinerary,
                "default_pickup": "Mambajao Town Plaza",
                "default_dropoff": itinerary[0] if itinerary else "White Island Boat Station",
            })
        return render_template(
            "tours.html",
            active_nav="tours",
            club=settings,
            tour_packages=enriched_packages,
            packages=enriched_packages,
            online_riders_count=len(online_riders),
            year=datetime.now().year,
        )

    @app.get("/history")
    def history_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "history.html",
            active_nav="history",
            club=settings,
            year=datetime.now().year,
        )

    @app.get("/about")
    def about_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "about.html",
            active_nav="about",
            club=settings,
            year=datetime.now().year,
        )

    @app.get("/faq")
    def faq_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "faq.html",
            active_nav="faq",
            club=settings,
            year=datetime.now().year,
        )

    @app.get("/terms")
    def terms_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "terms.html",
            active_nav="terms",
            club=settings,
            year=datetime.now().year,
        )

    # -------------------------------------------------------------------------
    # New Extended APIs: Tours, Promos, Customer, Reviews, Online Riders
    # -------------------------------------------------------------------------
    @app.get("/api/tour-packages")
    def api_tour_packages():
        return jsonify({"success": True, "packages": CAMIGUIN_TOUR_PACKAGES})

    @app.post("/api/promo/validate")
    def api_validate_promo():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        code = (data.get("code") or "").strip()
        try:
            fare = float(data.get("fare_amount") or 0.0)
        except (ValueError, TypeError):
            fare = 0.0
        result = validate_promo_code(conn, code, fare)
        if not result["valid"]:
            return jsonify({"success": False, "error": result["error"]}), 400
        return jsonify({"success": True, "promo": result})

    @app.get("/api/customer/active-booking")
    def api_customer_active_booking():
        conn = get_db()
        is_admin = bool(session.get("is_admin"))
        sess_code = (session.get("active_booking_code") or "").strip()
        sess_phone = (session.get("customer_phone") or "").strip()

        req_code = (request.args.get("code") or "").strip()
        req_phone = (request.args.get("phone") or "").strip()

        code = req_code or sess_code
        phone = req_phone or sess_phone

        booking = None
        if code:
            candidate = get_booking_by_code(conn, code)
            if candidate:
                is_owner = (
                    is_admin
                    or (sess_code and candidate.get("booking_code") == sess_code)
                    or (sess_phone and normalize_ph_phone(candidate.get("customer_phone") or "") == normalize_ph_phone(sess_phone))
                )
                if not is_owner:
                    return jsonify({"active": False, "booking": None, "error": "Unauthorized"}), 401
                booking = candidate
        elif phone:
            if not is_admin and (not sess_phone or normalize_ph_phone(phone) != normalize_ph_phone(sess_phone)):
                return jsonify({"active": False, "booking": None, "error": "Unauthorized"}), 401
            digits = "".join(filter(str.isdigit, phone))
            last10 = digits[-10:] if len(digits) >= 10 else digits
            cur = conn.execute("""
                SELECT b.*,
                       r.name AS rider_name, r.phone AS rider_phone, r.bike_model AS rider_bike,
                       r.plate_number AS rider_plate, r.color AS rider_color, r.last_lat AS rider_lat,
                       r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
                       r.avatar_url AS rider_avatar
                FROM bookings b
                LEFT JOIN riders r ON b.rider_id = r.id
                WHERE (b.customer_phone = ? OR b.customer_phone LIKE ? OR b.customer_phone LIKE ?)
                  AND b.status IN ('broadcast', 'accepted', 'in_progress')
                ORDER BY b.id DESC LIMIT 1
            """, (phone, f"%{last10}", f"0{last10}"))
            row = cur.fetchone()
            if row:
                booking = dict(row)

        if booking and booking.get("status") in ("broadcast", "accepted", "in_progress"):
            session["active_booking_code"] = booking["booking_code"]
            return jsonify({
                "active": True,
                "booking": booking,
                "tracking_url": f"/track/{booking['booking_code']}",
            })

        if booking:
            session.pop("active_booking_code", None)
            return jsonify({"active": False, "booking": booking, "status": booking.get("status")})

        session.pop("active_booking_code", None)
        return jsonify({"active": False, "booking": None})

    # -------------------------------------------------------------------------
    # Customer Authentication & Legit Verification Routes
    # -------------------------------------------------------------------------
    @app.post("/api/customer/register")
    def api_customer_register():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        password = (data.get("password") or "").strip()
        barangay = (data.get("barangay") or "").strip()
        email = (data.get("email") or "").strip()
        avatar_b64 = (data.get("avatar_base64") or "").strip()

        if not name:
            return jsonify({"success": False, "error": "Please enter your full name."}), 400
        if not phone or len(phone) < 7:
            return jsonify({"success": False, "error": "Please provide a valid Philippine phone number."}), 400
        if not email or "@" not in email:
            return jsonify({"success": False, "error": "Please enter a valid email address (e.g. maria@gmail.com)."}), 400
        if not password or len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters long."}), 400

        avatar_url = ""
        if avatar_b64 and "," in avatar_b64:
            import base64
            try:
                head, b64str = avatar_b64.split(",", 1)
                mimetype = "image/jpeg"
                if "png" in head:
                    mimetype = "image/png"
                elif "webp" in head:
                    mimetype = "image/webp"
                raw_bytes = base64.b64decode(b64str)
                safe_p = "".join(c for c in phone if c.isalnum()) or "cust"
                ts = int(datetime.now().timestamp())
                fname = f"cust_{safe_p}_{ts}.jpg"
                avatar_url = save_uploaded_media(conn, fname, raw_bytes, mimetype)
            except Exception as e:
                print("Failed to save customer avatar:", e)
                try:
                    conn.rollback()
                except Exception:
                    pass
                if len(avatar_b64) < 120000:
                    avatar_url = avatar_b64

        try:
            cust = register_customer(conn, name=name, phone=phone, password=password, barangay=barangay, email=email, avatar_url=avatar_url)
            conn.commit()
            clean_cust = {k: v for k, v in cust.items() if k != "password_hash"}
            session["customer_phone"] = clean_cust["phone"]
            session["customer_name"] = clean_cust["name"]
            session["customer_id"] = clean_cust["id"]
            session["customer_avatar"] = clean_cust.get("avatar_url", "")
            return jsonify({"success": True, "message": "Account registered and verified!", "customer": clean_cust})
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            return jsonify({"success": False, "error": str(e)}), 500

    @app.post("/api/customer/login")
    def api_customer_login():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        identifier = (data.get("phone") or data.get("email") or data.get("identifier") or "").strip()
        password = (data.get("password") or "").strip()

        if not identifier or not password:
            return jsonify({"success": False, "error": "Please enter your Phone Number or Email and Password."}), 400

        cust = authenticate_customer(conn, identifier, password)
        if not cust:
            return jsonify({"success": False, "error": "Incorrect phone number/email or password. Please check your credentials and try again."}), 401

        conn.commit()
        session["customer_phone"] = cust["phone"]
        session["customer_name"] = cust["name"]
        session["customer_id"] = cust["id"]
        session["customer_avatar"] = cust.get("avatar_url", "")
        return jsonify({"success": True, "message": "Successfully logged in!", "customer": cust})

    @app.post("/api/customer/logout")
    def api_customer_logout():
        session.pop("customer_phone", None)
        session.pop("customer_name", None)
        session.pop("customer_id", None)
        session.pop("customer_avatar", None)
        return jsonify({"success": True, "message": "Logged out successfully."})

    @app.post("/api/customer/forgot-password")
    def api_customer_forgot_password():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip().lower()
        new_password = (data.get("new_password") or "").strip()

        if not phone:
            return jsonify({"success": False, "error": "Please enter your registered mobile phone number."}), 400
        if not email:
            return jsonify({"success": False, "error": "Please enter your registered email address for verification."}), 400
        if not new_password or len(new_password) < 6:
            return jsonify({"success": False, "error": "New password must be at least 6 characters long."}), 400

        cust = get_customer_by_phone(conn, phone)
        if not cust:
            return jsonify({"success": False, "error": "No customer account found for this phone number."}), 404

        cust_email = (cust.get("email") or "").strip().lower()
        if not cust_email or cust_email != email:
            return jsonify({
                "success": False,
                "error": "Email address does not match this account. Please check or contact Admin."
            }), 400

        pwd_hash = generate_password_hash(new_password)
        update_customer_password(conn, cust["id"], pwd_hash)
        return jsonify({
            "success": True,
            "message": "Your passenger password has been reset successfully! You can now log in."
        })

    @app.get("/api/customer/me")
    def api_customer_me():
        conn = get_db()
        sess_phone = (session.get("customer_phone") or "").strip()
        req_phone = (request.args.get("phone") or "").strip()
        if req_phone and not session.get("is_admin") and (not sess_phone or normalize_ph_phone(req_phone) != normalize_ph_phone(sess_phone)):
            return jsonify({"logged_in": False, "customer": None}), 401
        phone = req_phone or sess_phone
        if not phone:
            return jsonify({"logged_in": False, "customer": None})
        cust = get_customer_by_phone(conn, phone)
        if not cust:
            return jsonify({"logged_in": False, "customer": None})
        return jsonify({"logged_in": True, "customer": cust})

    @app.get("/api/customer/history/<phone>")
    def api_customer_history(phone: str):
        conn = get_db()
        clean_p = phone.strip()
        customer = get_customer_by_phone(conn, clean_p)

        is_admin = bool(session.get("is_admin"))
        sess_phone = (session.get("customer_phone") or "").strip()
        target_phone = (customer.get("phone") if customer else clean_p) or ""
        if not is_admin:
            if not sess_phone or normalize_ph_phone(sess_phone) != normalize_ph_phone(target_phone):
                return jsonify({"success": False, "error": "Please sign in to view your ride history."}), 401

        history = get_customer_ride_history(conn, clean_p)
        if not customer and history:
            customer = {
                "name": history[0].get("customer_name") or "Passenger",
                "phone": clean_p,
                "is_verified": 0,
                "total_rides": len(history),
                "total_spent": sum(float(b.get("fare_amount") or 0) for b in history if b.get("status") == "completed")
            }
        return jsonify({
            "success": True,
            "customer": customer,
            "rides": history,
            "history": history,
            "total_rides": len(history)
        })

    @app.post("/api/reviews")
    def api_submit_review():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = data.get("rider_id")
        rating = data.get("rating")
        if not rider_id or not rating:
            return jsonify({"error": "Rider ID and rating are required."}), 400
        customer_name = (data.get("customer_name") or "Passenger").strip()
        comment = (data.get("comment") or "").strip()
        booking_id = data.get("booking_id")
        try:
            booking_id = int(booking_id) if booking_id else None
            rider_id = int(rider_id)
            rating = int(rating)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid IDs or rating value."}), 400

        review = create_review(conn, booking_id, rider_id, customer_name, rating, comment)
        return jsonify({"success": True, "review": review}), 201

    @app.get("/api/reviews/<int:rider_id>")
    def api_get_rider_reviews(rider_id: int):
        conn = get_db()
        reviews = get_rider_reviews(conn, rider_id)
        rider = get_rider_by_id(conn, rider_id)
        rating_avg = float(rider.get("rating_avg") or 5.0) if rider else 5.0
        return jsonify({
            "success": True,
            "rating_avg": round(rating_avg, 2),
            "review_count": len(reviews),
            "reviews": reviews,
        })

    @app.get("/api/riders/online")
    def api_online_riders():
        conn = get_db()
        riders = get_online_riders(conn)
        safe_list = []
        for r in riders:
            safe_list.append({
                "id": r["id"],
                "name": r["name"],
                "bike_model": r["bike_model"],
                "plate_number": r["plate_number"],
                "color": r.get("color") or "Orange",
                "lat": r.get("last_lat"),
                "lng": r.get("last_lng"),
                "rating_avg": r.get("rating_avg", 5.0),
                "total_trips": r.get("total_trips", 0),
            })
        return jsonify({"success": True, "riders": safe_list, "count": len(safe_list)})

    @app.get("/api/places/search")
    def api_places_search():
        q = (request.args.get("q") or "").strip()
        if not q:
            return jsonify({"places": []})
        results = search_camiguin_places(q, limit=10)
        return jsonify({"places": results})

    @app.get("/api/places/all")
    def api_places_all():
        return jsonify({"places": CAMIGUIN_KNOWN_PLACES})

    @app.post("/api/bookings")
    def api_create_booking():
        conn = get_db()
        settings = get_settings(conn)
        data = request.get_json(silent=True) or {}

        service_type = (data.get("service_type") or "pahatud").strip().lower()
        if service_type not in ("pahatud", "pakuha", "pasugo", "pabili", "pabayad"):
            service_type = "pahatud"

        customer_name = (data.get("customer_name") or "").strip()
        customer_phone = (data.get("customer_phone") or "").strip()
        pickup_address = (data.get("pickup_address") or "").strip()
        dropoff_address = (data.get("dropoff_address") or "").strip()

        if not customer_name:
            return jsonify({"error": "Please enter your full name."}), 400
        if not customer_phone or len(customer_phone) < 7:
            return jsonify({"error": "Please provide a valid Mobile / WhatsApp phone number."}), 400
        if not pickup_address:
            return jsonify({"error": "Please specify a Pickup / Store location."}), 400
        if not dropoff_address:
            return jsonify({"error": "Please specify a Drop-off / Destination address."}), 400

        try:
            pickup_lat = float(data.get("pickup_lat")) if data.get("pickup_lat") else None
            pickup_lng = float(data.get("pickup_lng")) if data.get("pickup_lng") else None
            dropoff_lat = float(data.get("dropoff_lat")) if data.get("dropoff_lat") else None
            dropoff_lng = float(data.get("dropoff_lng")) if data.get("dropoff_lng") else None
        except (ValueError, TypeError):
            pickup_lat = pickup_lng = dropoff_lat = dropoff_lng = None

        # Auto-geocode text addresses if coordinates are missing
        if (not pickup_lat or not pickup_lng) and pickup_address:
            geo_p = geocode_camiguin_location(pickup_address)
            if geo_p:
                pickup_lat, pickup_lng = geo_p["lat"], geo_p["lng"]

        if (not dropoff_lat or not dropoff_lng) and dropoff_address:
            geo_d = geocode_camiguin_location(dropoff_address)
            if geo_d:
                dropoff_lat, dropoff_lng = geo_d["lat"], geo_d["lng"]

        client_road_km = None
        try:
            if data.get("road_km"):
                client_road_km = float(data.get("road_km"))
        except (ValueError, TypeError):
            client_road_km = None

        if pickup_lat and pickup_lng and dropoff_lat and dropoff_lng:
            if client_road_km and client_road_km > 0:
                km = round(client_road_km, 2)
            else:
                km, _ = calculate_road_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        else:
            km = 1.5

        item_notes = (data.get("item_notes") or "").strip()
        try:
            estimated_budget = float(data.get("estimated_budget") or 0.0)
        except (ValueError, TypeError):
            estimated_budget = 0.0

        # Special options from Fare Matrix
        is_large_store = bool(data.get("is_large_store", False))
        extra_stores_count = int(data.get("extra_stores_count") or 0)
        is_bulky = bool(data.get("is_bulky_or_high_value", False)) or (estimated_budget >= 2000.0)

        # Auto-detect hinterland route
        full_addr = f"{pickup_address} {dropoff_address} {item_notes}".lower()
        hinterland_keywords = ["sorosoro", "soro'soro", "soro-soro", "highland", "utopia", "binunsaran", "granelandia", "itum", "hinterland"]
        is_hinterland = bool(data.get("is_hinterland", False)) or any(k in full_addr for k in hinterland_keywords)

        fare_amount, estimated_km, breakdown = calculate_fare(
            km=km,
            service_type=service_type,
            settings=settings,
            is_large_store=is_large_store,
            extra_stores_count=extra_stores_count,
            is_bulky_or_high_value=is_bulky,
            is_hinterland=is_hinterland,
        )

        payment_method = (data.get("payment_method") or "cash").strip().lower()
        if payment_method not in ("cash", "gcash", "maya"):
            payment_method = "cash"

        scheduled_at = (data.get("scheduled_at") or "").strip() or None
        promo_code = (data.get("promo_code") or "").strip().upper()
        discount_amount = 0.0

        if promo_code:
            promo_res = validate_promo_code(conn, promo_code, fare_amount)
            if promo_res["valid"] and apply_promo_code(conn, promo_code):
                discount_amount = promo_res["discount_amount"]
                fare_amount = promo_res["new_fare"]
            else:
                promo_code = ""

        # Auto-register / update customer profile (prevent account takeover)
        customer_password = (data.get("customer_password") or "").strip()
        customer_barangay = (data.get("customer_barangay") or "").strip()
        sess_cust_phone = (session.get("customer_phone") or "").strip()
        is_authenticated = bool(sess_cust_phone and normalize_ph_phone(sess_cust_phone) == normalize_ph_phone(customer_phone))

        if not app.config.get("TESTING") and not is_authenticated and not customer_password:
            return jsonify({
                "error": "Please Sign In or Register first to verify your account before broadcasting a ride request."
            }), 401

        if customer_password and not is_authenticated:
            existing_cust = get_customer_by_phone(conn, customer_phone)
            if existing_cust and existing_cust.get("password_hash"):
                return jsonify({
                    "error": "This phone number is already registered. Please sign in to your account first."
                }), 409

        if customer_password or (is_authenticated and customer_barangay):
            try:
                cust = register_customer(conn, customer_name, customer_phone, customer_password if not is_authenticated else "", customer_barangay)
                session["customer_id"] = cust["id"]
                session["customer_phone"] = cust["phone"]
                session["customer_name"] = cust["name"]
            except Exception:
                pass
        else:
            try:
                get_or_create_customer(conn, customer_phone, customer_name)
            except Exception:
                pass

        booking = create_booking(
            conn=conn,
            service_type=service_type,
            customer_name=customer_name,
            customer_phone=customer_phone,
            pickup_address=pickup_address,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            dropoff_address=dropoff_address,
            dropoff_lat=dropoff_lat,
            dropoff_lng=dropoff_lng,
            item_notes=item_notes,
            estimated_budget=estimated_budget,
            fare_amount=fare_amount,
            estimated_km=estimated_km,
            payment_method=payment_method,
            scheduled_at=scheduled_at,
            promo_code=promo_code,
            discount_amount=discount_amount,
        )
        conn.commit()

        session["active_booking_code"] = booking["booking_code"]
        session["customer_phone"] = booking["customer_phone"]
        session["customer_name"] = booking["customer_name"]

        return jsonify({
            "success": True,
            "message": "Your booking has been broadcasted to all active riders!",
            "booking": booking,
            "breakdown": breakdown,
            "tracking_url": f"/track/{booking['booking_code']}",
        }), 201


    # -------------------------------------------------------------------------
    # In-App Chat Routes (Customer & Rider Live Messaging)
    # -------------------------------------------------------------------------
    def _authorize_chat_role(booking: dict[str, Any]) -> str | None:
        if session.get("is_admin"):
            return "system"
        if session.get("rider_id") and booking.get("rider_id") == session.get("rider_id"):
            return "rider"
        if session.get("active_booking_code") and session.get("active_booking_code") == booking.get("booking_code"):
            return "customer"
        sess_phone = (session.get("customer_phone") or "").strip()
        if sess_phone and normalize_ph_phone(sess_phone) == normalize_ph_phone(booking.get("customer_phone") or ""):
            return "customer"
        return None

    @app.get("/api/chat/<code_or_id>/messages")
    def get_chat_messages(code_or_id: str):
        conn = get_db()
        booking = None
        if code_or_id.isdigit():
            booking = get_booking_by_id(conn, int(code_or_id))
        if not booking:
            booking = get_booking_by_code(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        if not _authorize_chat_role(booking):
            return jsonify({"error": "Unauthorized to view messages for this booking."}), 401

        after_id = int(request.args.get("after") or 0)
        messages = get_booking_messages(conn, booking["id"], after_id=after_id)
        return jsonify({
            "success": True,
            "booking_id": booking["id"],
            "booking_code": booking["booking_code"],
            "messages": messages,
        })

    @app.post("/api/chat/<code_or_id>/messages")
    def post_chat_message(code_or_id: str):
        conn = get_db()
        booking = None
        if code_or_id.isdigit():
            booking = get_booking_by_id(conn, int(code_or_id))
        if not booking:
            booking = get_booking_by_code(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        auth_role = _authorize_chat_role(booking)
        if not auth_role:
            return jsonify({"error": "Unauthorized to send messages for this booking."}), 401

        data = request.get_json(silent=True) or {}
        text = (data.get("message") or "").strip()
        if not text:
            return jsonify({"error": "Message cannot be empty."}), 400

        sender_role = auth_role
        if sender_role == "rider":
            rider = get_rider_by_id(conn, int(session["rider_id"]))
            sender_name = (rider.get("name") if rider else None) or "Club Rider"
        elif sender_role == "system":
            sender_name = "CCRC Dispatch"
        else:
            sender_name = booking.get("customer_name") or "Passenger"

        new_msg = add_booking_message(conn, booking["id"], sender_role, sender_name, text)
        conn.commit()

        after_id = int(request.args.get("after") or 0)
        messages = get_booking_messages(conn, booking["id"], after_id=after_id)
        return jsonify({
            "success": True,
            "message": new_msg,
            "messages": messages,
        })

    # -------------------------------------------------------------------------
    # Live Tracking Routes
    # -------------------------------------------------------------------------
    @app.get("/track/<booking_code>")
    def track_view(booking_code: str):
        conn = get_db()
        booking = get_booking_by_code(conn, booking_code)
        if not booking:
            return render_template("track.html", booking=None, error="Booking not found."), 404
        if booking.get("status") in ("broadcast", "accepted", "in_progress"):
            session["active_booking_code"] = booking["booking_code"]
        else:
            if session.get("active_booking_code") == booking["booking_code"]:
                session.pop("active_booking_code", None)
        return render_template("track.html", booking=booking, active_nav="track")

    @app.get("/api/bookings/track/<booking_code>")
    def api_track_booking(booking_code: str):
        conn = get_db()
        booking = get_booking_by_code(conn, booking_code)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        trail = []
        if booking.get("id"):
            trail = get_booking_tracking_trail(conn, booking["id"], limit=20)

        # Compute real-time road distance from rider to pickup/dropoff
        distance_to_pickup_km = None
        if booking.get("rider_lat") and booking.get("rider_lng") and booking.get("pickup_lat") and booking.get("pickup_lng"):
            distance_to_pickup_km, _ = calculate_road_km(
                booking["rider_lat"], booking["rider_lng"], booking["pickup_lat"], booking["pickup_lng"]
            )

        distance_to_dropoff_km = None
        if booking.get("rider_lat") and booking.get("rider_lng") and booking.get("dropoff_lat") and booking.get("dropoff_lng"):
            distance_to_dropoff_km, _ = calculate_road_km(
                booking["rider_lat"], booking["rider_lng"], booking["dropoff_lat"], booking["dropoff_lng"]
            )

        return jsonify({
            "booking": booking,
            "trail": trail,
            "distance_to_pickup_km": distance_to_pickup_km,
            "distance_to_dropoff_km": distance_to_dropoff_km,
        })

    # -------------------------------------------------------------------------
    # Rider Portal & Dispatch Board Routes
    # -------------------------------------------------------------------------
    @app.get("/rider")
    def rider_view():
        return render_template("rider.html", active_nav="rider")

    @app.post("/api/rider/logout")
    def rider_logout():
        rider_id = session.pop("rider_id", None)
        if rider_id:
            conn = get_db()
            update_rider_online_status(conn, rider_id, False)
            conn.commit()
        return jsonify({"success": True})

    @app.post("/api/rider/login")
    def rider_login():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        identifier = (data.get("phone") or data.get("email") or data.get("identifier") or "").strip()
        password = (data.get("password") or "").strip()

        if not identifier or not password:
            return jsonify({"error": "Please enter your Mobile Phone Number or Email and Password."}), 400

        rider = get_rider_by_phone(conn, identifier)
        if not rider:
            return jsonify({"error": "No rider account found with that Phone Number or Email. Please check your details or register."}), 404

        if not check_password_hash(rider["password_hash"], password):
            return jsonify({"error": "Incorrect password. Please check your password and try again."}), 401

        status = (rider.get("status") or "").lower()
        if status == "pending":
            return jsonify({
                "error": "Your account is currently PENDING APPROVAL. Please visit the CCRC Club Admin in person with your Driver's License, OR/CR, and motorcycle for inspection, verification, and account activation.",
                "pending": True,
            }), 403

        if status in ("suspended", "rejected"):
            return jsonify({
                "error": "Your account has been suspended or rejected by the Club Admin. Please contact the CCRC Admin.",
                "suspended": True,
            }), 403

        session["rider_id"] = rider["id"]
        update_rider_online_status(conn, rider["id"], True)
        conn.commit()

        # Sanitize sensitive field
        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
        clean_rider["is_online"] = 1
        return jsonify({"success": True, "rider": clean_rider})

    @app.post("/api/rider/forgot-password")
    def rider_forgot_password():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        phone = (data.get("phone") or "").strip()
        identifier = (data.get("identifier") or "").strip()
        new_password = (data.get("new_password") or "").strip()

        if not phone:
            return jsonify({"success": False, "error": "Please enter your registered mobile phone number."}), 400
        if not identifier:
            return jsonify({"success": False, "error": "Please enter your Driver's License Number for verification."}), 400
        if not new_password or len(new_password) < 6:
            return jsonify({"success": False, "error": "New password must be at least 6 characters long."}), 400

        rider = get_rider_by_phone(conn, phone)
        if not rider:
            return jsonify({"success": False, "error": "No rider account found for this phone number."}), 404

        clean_input = identifier.replace(" ", "").replace("-", "").upper()
        clean_license = (rider.get("license_no") or "").replace(" ", "").replace("-", "").upper()

        if not clean_license or clean_input != clean_license:
            return jsonify({
                "success": False,
                "error": "Driver's License Number does not match this account. Please check or contact Admin."
            }), 400

        pwd_hash = generate_password_hash(new_password)
        update_rider_password(conn, rider["id"], pwd_hash)
        return jsonify({
            "success": True,
            "message": "Your rider password has been reset successfully! You can now log in."
        })

    @app.post("/api/rider/register")
    def rider_register():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        license_no = (data.get("license_no") or "").strip().upper()
        bike_model = (data.get("bike_model") or "").strip()
        plate_number = (data.get("plate_number") or "").strip()
        municipality = (data.get("municipality") or "Mambajao").strip()
        avatar_b64 = (data.get("avatar_base64") or "").strip()

        if not name or not phone or not password or not bike_model or not plate_number:
            return jsonify({"error": "Please complete all required fields."}), 400

        if not license_no:
            return jsonify({"error": "Driver's License Number is required."}), 400

        existing = get_rider_by_phone(conn, phone)
        if existing:
            return jsonify({"error": "This phone number is already registered. Please log in."}), 409

        if email:
            existing_email = get_rider_by_phone(conn, email)
            if existing_email:
                return jsonify({"error": "This email address is already registered as a rider. Please log in."}), 409

        # Process and save profile picture
        avatar_url = ""
        if avatar_b64 and "," in avatar_b64:
            import base64
            try:
                head, b64str = avatar_b64.split(",", 1)
                mimetype = "image/jpeg"
                if "png" in head:
                    mimetype = "image/png"
                elif "webp" in head:
                    mimetype = "image/webp"
                raw_bytes = base64.b64decode(b64str)
                clean_p = phone.replace(" ", "").replace("-", "")
                ts = int(datetime.now().timestamp())
                fname = f"rider_{clean_p}_{ts}.jpg"
                avatar_url = save_uploaded_media(conn, fname, raw_bytes, mimetype)
            except Exception as e:
                print("Failed to save avatar:", e)

        rider_id = register_rider(
            conn=conn,
            name=name,
            phone=phone,
            password=password,
            bike_model=bike_model,
            plate_number=plate_number,
            municipality=municipality,
            license_no=license_no,
            avatar_url=avatar_url,
            email=email,
        )
        conn.commit()

        rider = get_rider_by_id(conn, rider_id)
        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
        clean_rider["is_online"] = 0

        return jsonify({
            "success": True,
            "pending": True,
            "rider": clean_rider,
            "message": f"✅ Your Rider Application has been submitted, {name}! Your account is currently PENDING APPROVAL. Please visit the CCRC Club Admin in person with your Driver's License, OR/CR, and motorcycle for inspection, verification, and account activation."
        }), 201


    @app.get("/api/rider/co-riders")
    def get_rider_co_riders():
        current_rider_id = session.get("rider_id")
        if not current_rider_id and not session.get("is_admin"):
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        riders = get_online_riders(conn)
        clean_list = []
        for r in riders:
            clean_list.append({
                "id": r["id"],
                "name": r["name"],
                "phone": r["phone"],
                "bike_model": r["bike_model"],
                "plate_number": r["plate_number"],
                "municipality": r.get("municipality") or "Mambajao",
                "avatar_url": r.get("avatar_url") or "",
                "rating_avg": r.get("rating_avg") or 5.0,
                "last_lat": r.get("last_lat"),
                "last_lng": r.get("last_lng"),
                "last_active_at": r.get("last_active_at"),
                "is_self": bool(current_rider_id and r["id"] == current_rider_id),
            })
        return jsonify({
            "success": True,
            "total_online": len(clean_list),
            "co_riders": clean_list,
        })

    @app.post("/api/rider/status")
    def rider_toggle_status():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401
        conn = get_db()
        data = request.get_json(silent=True) or {}

        is_online = bool(data.get("is_online", True))
        update_rider_online_status(conn, int(rider_id), is_online)
        conn.commit()
        return jsonify({"success": True, "is_online": 1 if is_online else 0})

    @app.get("/api/rider/available-jobs")
    def rider_available_jobs():
        if not session.get("rider_id") and not session.get("is_admin"):
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        jobs = get_available_broadcast_bookings(conn)
        return jsonify({"jobs": jobs, "count": len(jobs)})

    @app.get("/api/rider/active-job")
    def rider_active_job():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"job": None, "scheduled_jobs": []})
        conn = get_db()

        job = get_rider_active_job(conn, int(rider_id))
        scheduled_jobs = get_rider_scheduled_jobs(conn, int(rider_id))
        return jsonify({"job": job, "scheduled_jobs": scheduled_jobs})

    @app.post("/api/bookings/<int:booking_id>/accept")
    def rider_accept_booking(booking_id: int):
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Please log in as a rider before accepting bookings."}), 401
        conn = get_db()

        rider = get_rider_by_id(conn, int(rider_id))
        if not rider or rider.get("status") != "active":
            return jsonify({"error": "Your rider account is pending approval or suspended."}), 403

        target_booking = get_booking_by_id(conn, booking_id)
        if not target_booking:
            return jsonify({"error": "Booking not found."}), 404

        target_sched = (target_booking.get("scheduled_at") or "").strip()
        is_target_advance = False
        if target_sched:
            try:
                diff_m = (datetime.fromisoformat(target_sched) - get_now_pht()).total_seconds() / 60
                if diff_m > 30:
                    is_target_advance = True
            except Exception:
                pass

        # Check if rider already has an active ongoing job
        active = get_rider_active_job(conn, int(rider_id))
        if active and active["id"] != booking_id and not is_target_advance:
            # If the current active job is a future advance job (not in_progress and scheduled > 15m), allow taking this on-demand job!
            is_active_advance = False
            act_sched = (active.get("scheduled_at") or "").strip()
            if act_sched and active.get("status") != "in_progress":
                try:
                    m_left = (datetime.fromisoformat(act_sched) - get_now_pht()).total_seconds() / 60
                    if m_left > 15:
                        is_active_advance = True
                except Exception:
                    pass
            if not is_active_advance:
                return jsonify({"error": "You already have an active ongoing trip that must be completed first."}), 400

        claimed = accept_booking(conn, booking_id, int(rider_id))
        if not claimed:
            conn.rollback()
            return jsonify({"error": "This booking has already been claimed by another rider."}), 409

        conn.commit()
        updated_job = get_booking_by_id(conn, booking_id)
        return jsonify({
            "success": True,
            "message": "Booking accepted successfully!",
            "job": updated_job,
            "is_advance": is_target_advance,
        })

    @app.post("/api/bookings/<int:booking_id>/start-now")
    def rider_start_scheduled_job(booking_id: int):
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401
        conn = get_db()
        booking = get_booking_by_id(conn, booking_id)
        if not booking or booking.get("rider_id") != int(rider_id):
            return jsonify({"error": "Booking not found or not assigned to you."}), 404
        update_booking_status(conn, booking_id, "in_progress")
        conn.commit()
        return jsonify({"success": True, "job": get_booking_by_id(conn, booking_id)})

    @app.post("/api/bookings/<int:booking_id>/status")
    def update_job_status(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        new_status = (data.get("status") or "").strip().lower()

        if new_status not in ("in_progress", "completed", "cancelled"):
            return jsonify({"error": "Invalid status transition"}), 400

        booking = get_booking_by_id(conn, booking_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        is_admin = bool(session.get("is_admin"))
        rider_id = session.get("rider_id")
        is_assigned_rider = bool(rider_id and booking.get("rider_id") == int(rider_id))
        is_booking_customer = bool(
            (session.get("active_booking_code") and session.get("active_booking_code") == booking.get("booking_code"))
            or (
                session.get("customer_phone")
                and normalize_ph_phone(session.get("customer_phone") or "") == normalize_ph_phone(booking.get("customer_phone") or "")
            )
        )

        if not is_admin and not is_assigned_rider:
            if not (new_status == "cancelled" and is_booking_customer):
                return jsonify({"error": "Unauthorized to update this booking's status."}), 403

        if not update_booking_status(conn, booking_id, new_status):
            return jsonify({"error": "Cannot transition booking from its current status."}), 400
        conn.commit()
        updated_job = get_booking_by_id(conn, booking_id)
        return jsonify({"success": True, "job": updated_job})

    @app.post("/api/rider/location")
    def stream_rider_location():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        data = request.get_json(silent=True) or {}

        try:
            lat = float(data.get("lat"))
            lng = float(data.get("lng"))
            speed = float(data.get("speed") or 0.0)
            heading = float(data.get("heading") or 0.0)
            booking_id = int(data.get("booking_id")) if data.get("booking_id") else None
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid coordinates"}), 400

        update_rider_location(conn, int(rider_id), lat, lng, booking_id, speed, heading)
        conn.commit()
        return jsonify({"success": True, "lat": lat, "lng": lng})

    @app.get("/api/rider/transactions")
    def api_rider_transactions():
        is_admin = bool(session.get("is_admin"))
        sess_rider_id = session.get("rider_id")
        if is_admin and request.args.get("rider_id"):
            rider_id_val = request.args.get("rider_id")
        else:
            rider_id_val = sess_rider_id
        if not rider_id_val:
            return jsonify({"success": False, "error": "Rider authentication required."}), 401
        conn = get_db()
        try:
            r_id = int(rider_id_val)
        except ValueError:
            return jsonify({"success": False, "error": "Invalid Rider ID."}), 400

        txns = get_rider_transactions(conn, r_id, limit=50)
        now_pht_str = get_now_pht().strftime("%Y-%m-%d")

        today_earnings = sum(
            float(t["amount"])
            for t in txns
            if t["status"] == "completed" and str(t["created_at"]).startswith(now_pht_str)
        )
        all_time_earnings = sum(
            float(t["amount"])
            for t in txns
            if t["status"] == "completed"
        )
        return jsonify({
            "success": True,
            "rider_id": r_id,
            "transactions": txns,
            "today_earnings": today_earnings,
            "all_time_earnings": all_time_earnings,
            "total_transactions": len(txns),
        })

    # -------------------------------------------------------------------------
    # Admin / Club Management Portal
    # -------------------------------------------------------------------------
    @app.post("/api/admin/riders/<int:rider_id>/status")
    def admin_update_rider_status(rider_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required."}), 401
        conn = get_db()
        data = request.get_json(silent=True) or {}
        new_status = (data.get("status") or "").strip().lower()
        if new_status not in ("active", "pending", "suspended", "rejected"):
            return jsonify({"error": "Invalid status."}), 400
        conn.execute("UPDATE riders SET status = ? WHERE id = ?", (new_status, rider_id))
        conn.commit()
        return jsonify({"success": True, "status": new_status})

    @app.post("/api/admin/riders/<int:rider_id>/delete")
    def admin_delete_rider(rider_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        success = delete_rider(conn, rider_id)
        if not success:
            return jsonify({"error": "Rider not found or could not be deleted."}), 404
        return jsonify({"success": True, "message": "Rider account permanently deleted."})

    @app.post("/api/admin/riders/<int:rider_id>/reset-password")
    def admin_reset_rider_password(rider_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        data = request.get_json(silent=True) or {}
        new_password = (data.get("new_password") or "").strip()
        if not new_password or len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400
        pwd_hash = generate_password_hash(new_password)
        success = update_rider_password(conn, rider_id, pwd_hash)
        if not success:
            return jsonify({"error": "Rider not found."}), 404
        return jsonify({"success": True, "message": "Rider password updated successfully."})

    @app.post("/api/admin/login")
    def admin_login():
        data = request.get_json(silent=True) or {}
        password = str(data.get("password") or "").strip()
        conn = get_db()
        settings = get_settings(conn)
        pwd_hash = settings.get("admin_password_hash")
        is_valid = False
        if pwd_hash:
            try:
                is_valid = check_password_hash(pwd_hash, password)
            except Exception:
                is_valid = False
        else:
            default_admin_pwd = os.environ.get("ADMIN_DEFAULT_PASSWORD", "admin1234")
            is_valid = bool(password and password == default_admin_pwd)

        if is_valid:
            session["is_admin"] = True
            return jsonify({"success": True})
        return jsonify({"error": "Incorrect admin password."}), 401

    @app.post("/api/admin/logout")
    def admin_logout():
        session.pop("is_admin", None)
        return jsonify({"success": True})

    @app.get("/admin")
    def admin_view():
        is_admin_auth = bool(session.get("is_admin"))
        conn = get_db()
        settings = get_settings(conn)

        if not is_admin_auth:
            return render_template(
                "admin.html",
                settings=settings,
                riders=[],
                bookings=[],
                transactions=[],
                customers=[],
                fin_summary={"total_transactions": 0, "total_revenue": 0.0, "cash_revenue": 0.0, "digital_revenue": 0.0, "total_customers": 0, "verified_customers": 0},
                stats={"total_bookings": 0, "completed": 0, "active_now": 0, "online_riders": 0, "total_riders": 0, "total_revenue": 0.0, "total_transactions": 0, "verified_customers": 0, "total_customers": 0},
                active_nav="admin",
                is_admin=False,
            )

        riders = conn.execute("SELECT * FROM riders ORDER BY id DESC").fetchall()
        recent_bookings = conn.execute(
            """
            SELECT b.*, r.name AS rider_name, r.bike_model AS rider_bike,
                   COALESCE(c.is_verified, 0) AS customer_verified
            FROM bookings b
            LEFT JOIN riders r ON r.id = b.rider_id
            LEFT JOIN customers c ON b.customer_phone = c.phone
            ORDER BY b.id DESC
            LIMIT 50
            """
        ).fetchall()
        transactions = get_all_transactions(conn, limit=200)
        customers = get_all_customers(conn)
        fin_summary = get_financial_summary(conn)

        stats = {
            "total_bookings": len(recent_bookings),
            "completed": sum(1 for b in recent_bookings if b["status"] == "completed"),
            "active_now": sum(1 for b in recent_bookings if b["status"] in ("broadcast", "accepted", "in_progress")),
            "online_riders": sum(1 for r in riders if r["is_online"] == 1 and r["status"] == "active"),
            "pending_riders": sum(1 for r in riders if r["status"] == "pending"),
            "total_riders": len(riders),
            "total_revenue": fin_summary["total_revenue"],
            "total_transactions": fin_summary["all_transactions"],
            "verified_customers": fin_summary["verified_customers"],
            "total_customers": fin_summary["total_customers"],
        }

        return render_template(
            "admin.html",
            settings=settings,
            riders=[dict(r) for r in riders],
            bookings=[dict(b) for b in recent_bookings],
            transactions=transactions,
            customers=customers,
            fin_summary=fin_summary,
            stats=stats,
            active_nav="admin",
            is_admin=True,
        )

    @app.post("/api/admin/customers/<int:customer_id>/toggle-verify")
    def admin_toggle_customer_verify(customer_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        cust = toggle_customer_verify(conn, customer_id)
        if not cust:
            return jsonify({"error": "Customer not found."}), 404
        conn.commit()
        return jsonify({"success": True, "customer": cust})

    @app.post("/api/admin/customers/<int:customer_id>/delete")
    def admin_delete_customer(customer_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        success = delete_customer(conn, customer_id)
        if not success:
            return jsonify({"error": "Customer not found or could not be deleted."}), 404
        return jsonify({"success": True, "message": "Customer account permanently deleted."})

    @app.post("/api/admin/customers/<int:customer_id>/reset-password")
    def admin_reset_customer_password(customer_id: int):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        data = request.get_json(silent=True) or {}
        new_password = (data.get("new_password") or "").strip()
        if not new_password or len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400
        pwd_hash = generate_password_hash(new_password)
        success = update_customer_password(conn, customer_id, pwd_hash)
        if not success:
            return jsonify({"error": "Customer not found."}), 404
        return jsonify({"success": True, "message": "Customer password updated successfully."})

    @app.get("/api/admin/transactions")
    def admin_get_transactions():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        status_filter = (request.args.get("status") or "").strip()
        txns = get_all_transactions(conn, limit=200, status_filter=status_filter)
        return jsonify({"success": True, "transactions": txns})

    @app.post("/api/admin/settings")
    def admin_save_settings():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        data = request.get_json(silent=True) or {}
        updates = {}
        for key in (
            "club_name", "tagline", "hotline", "base_fare", "base_km", "per_km_rate", "min_fare",
            "pabili_service_fee", "pasugo_service_fee", "queuing_fee", "extra_store_fee", "bulky_order_fee", "hinterland_fee",
            "google_drive_webhook_url"
        ):
            if key in data:
                updates[key] = str(data[key]).strip()

        if updates:
            update_settings(conn, updates)
            conn.commit()

        return jsonify({"success": True, "settings": get_settings(conn)})


    @app.get("/api/admin/backup")
    def admin_download_backup():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required."}), 401
        conn = get_db()
        backup_data = export_full_backup(conn)

        import base64
        import json

        def _json_serial(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            if isinstance(obj, (bytes, memoryview)):
                return base64.b64encode(bytes(obj)).decode("ascii")
            return str(obj)

        json_str = json.dumps(backup_data, indent=2, default=_json_serial)
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ccrc_backup_{timestamp_str}.json"
        resp = Response(json_str, mimetype="application/json")
        resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    @app.post("/api/admin/restore")
    def admin_restore_backup():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required."}), 401

        import json

        backup_data = None
        wipe_existing = True

        if "backup_file" in request.files:
            file = request.files["backup_file"]
            if not file or not file.filename:
                return jsonify({"error": "No backup file selected."}), 400
            try:
                content = file.read().decode("utf-8")
                backup_data = json.loads(content)
            except Exception as e:
                return jsonify({"error": f"Invalid backup file: {str(e)}"}), 400
            wipe_val = (request.form.get("wipe_existing") or "true").lower()
            wipe_existing = wipe_val in ("true", "1", "yes")
        else:
            payload = request.get_json(silent=True) or {}
            backup_data = payload.get("backup_data") or payload
            wipe_existing = bool(payload.get("wipe_existing", True))

        if not backup_data or not isinstance(backup_data, dict):
            return jsonify({"error": "Missing or invalid backup data."}), 400

        conn = get_db()
        try:
            result = restore_full_backup(conn, backup_data, wipe_existing=wipe_existing)
            conn.commit()
            return jsonify(result)
        except Exception as e:
            conn.rollback()
            return jsonify({"error": f"Restore failed: {str(e)}"}), 500


    @app.post("/api/admin/backup/google-drive")
    def admin_upload_backup_google_drive():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required."}), 401

        conn = get_db()
        settings = get_settings(conn)
        webhook_url = (settings.get("google_drive_webhook_url") or "").strip()

        backup_data = export_full_backup(conn)

        import base64
        import json
        import urllib.request
        from datetime import datetime

        def _json_serial(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            if isinstance(obj, (bytes, memoryview)):
                return base64.b64encode(bytes(obj)).decode("ascii")
            return str(obj)

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ccrc_backup_{timestamp_str}.json"

        if not webhook_url:
            return jsonify({
                "configured": False,
                "message": "Google Drive Webhook URL is not configured yet in Settings.",
                "backup_data": backup_data,
                "filename": filename,
            })

        # Send to Google Apps Script Web App / Webhook
        try:
            payload = {
                "filename": filename,
                "timestamp": datetime.now().isoformat(),
                "app": "Camiguin Centric Riders Club",
                "content": json.dumps(backup_data, indent=2, default=_json_serial),
                "summary": backup_data.get("summary", {}),
            }
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                webhook_url,
                data=req_data,
                headers={"Content-Type": "application/json", "User-Agent": "CCRC-Backup-Client/1.0"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_text = resp.read().decode("utf-8")
                try:
                    resp_json = json.loads(resp_text)
                    file_url = resp_json.get("url") or resp_json.get("file_url") or "https://drive.google.com"
                except Exception:
                    file_url = "https://drive.google.com"

            return jsonify({
                "configured": True,
                "success": True,
                "filename": filename,
                "file_url": file_url,
                "message": f"Backup ({filename}) uploaded to Google Drive successfully!",
            })
        except Exception as e:
            return jsonify({
                "configured": True,
                "success": False,
                "error": f"Failed to upload to Google Drive webhook: {str(e)}",
                "backup_data": backup_data,
                "filename": filename,
            }), 502

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
