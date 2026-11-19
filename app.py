"""
Flask Application for Camiguin Centric Riders Club (CCRC).
On-Demand Island Express Riders: Pahatud, Pakuha, Pasugo & Pabili.
"""

from __future__ import annotations

import base64
import json
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

from qr_svg import render_qr_svg
from db import (
    CAMIGUIN_KNOWN_PLACES,
    export_full_backup,
    restore_full_backup,
    reset_launch_data,
    add_booking_message,
    get_booking_messages,
    add_call_signal,
    create_call_session,
    get_call_session,
    get_latest_call_state,
    respond_to_call,
    add_rider_call_signal,
    create_rider_call_session,
    get_rider_call_session,
    get_latest_rider_call_state,
    respond_to_rider_call,
    accept_booking,
    accept_booking_for_group_slot,
    attach_group_metadata,
    build_booking_group_summary,
    calculate_fare,
    calculate_haversine_km,
    calculate_road_km,
    create_booking,
    create_booking_group,
    geocode_camiguin_location,
    get_available_broadcast_bookings,
    get_booking_by_code,
    get_booking_by_id,
    get_bookings_by_group_code,
    get_booking_tracking_trail,
    get_connection,
    get_customer_active_bookings,
    get_online_riders,
    get_rider_active_job,
    get_rider_live_statuses,
    get_rider_scheduled_jobs,
    get_now_pht,
    get_rider_by_id,
    get_rider_by_phone,
    get_settings,
    get_uploaded_media,
    init_db,
    is_hinterland_route,
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
    get_rider_transaction_summary,
    get_customer_transactions,
    get_financial_summary,
    get_booking_summary_counts,
    validate_promo_code,
    apply_promo_code,
    create_review,
    get_review_by_booking_id,
    get_rider_reviews,
    calculate_nearest_rider_eta,
    get_busy_rider_ids,
    transfer_booking,
    update_rider_gcash_profile,
    mark_gcash_payment_sent,
    confirm_gcash_payment_received,
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
        if response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
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

    @app.get("/api/health")
    def health():
        raw_url = (
            os.environ.get("DATABASE_URL")
            or os.environ.get("POSTGRES_URL")
            or os.environ.get("SUPABASE_DB_URL")
            or ""
        ).strip()
        is_pg = (not app.config.get("TESTING")) and raw_url.startswith(("postgres://", "postgresql://"))
        backend = "postgresql" if is_pg else "sqlite"
        if (request.args.get("db") or "").strip().lower() in ("1", "true", "yes"):
            conn = get_db()
            conn.execute("SELECT 1").fetchone()
            backend = getattr(conn, "backend", backend)
        return jsonify({
            "status": "ok",
            "backend": backend,
            "date": get_now_pht().date().isoformat(),
        })

    @app.get("/media/<path:filename>")
    def serve_uploaded_media(filename: str):
        conn = get_db()
        res = get_uploaded_media(conn, filename)
        if not res:
            return "File not found", 404
        data, mimetype = res
        total_len = len(data)
        range_header = (request.headers.get("Range") or "").strip()
        if range_header.startswith("bytes=") and total_len > 0:
            try:
                spec = range_header[6:].split(",")[0].strip()
                start_str, _, end_str = spec.partition("-")
                if start_str == "":
                    suffix = int(end_str)
                    start = max(0, total_len - suffix)
                    end = total_len - 1
                else:
                    start = int(start_str)
                    end = int(end_str) if end_str else total_len - 1
                if start < 0 or start >= total_len or end < start:
                    resp_416 = Response(status=416)
                    resp_416.headers["Content-Range"] = f"bytes */{total_len}"
                    return resp_416
                end = min(end, total_len - 1)
                chunk = data[start : end + 1]
                resp = Response(chunk, status=206, mimetype=mimetype)
                resp.headers["Content-Range"] = f"bytes {start}-{end}/{total_len}"
                resp.headers["Accept-Ranges"] = "bytes"
                resp.headers["Content-Length"] = str(len(chunk))
                resp.headers["Cache-Control"] = "public, max-age=86400"
                return resp
            except (ValueError, TypeError):
                pass

        resp = Response(data, mimetype=mimetype)
        resp.headers["Accept-Ranges"] = "bytes"
        resp.headers["Content-Length"] = str(total_len)
        resp.headers["Cache-Control"] = "public, max-age=86400"
        return resp

    def _is_customer_authorized_for_booking(booking: dict[str, Any], allow_admin: bool = True) -> bool:
        sess_code = (session.get("active_booking_code") or "").strip().upper()
        sess_group = (session.get("active_group_code") or "").strip().upper()
        b_code = (booking.get("booking_code") or "").strip().upper()
        b_group = (booking.get("group_code") or "").strip().upper()
        if sess_code and (sess_code == b_code or (b_group and sess_code == b_group)):
            return True
        if sess_group and b_group and sess_group == b_group:
            return True
        sess_phone = (session.get("customer_phone") or "").strip()
        if sess_phone and normalize_ph_phone(sess_phone) == normalize_ph_phone(booking.get("customer_phone") or ""):
            return True
        if allow_admin and session.get("is_admin"):
            return True
        return False

    def _pick_group_representative(group_bookings: list[dict[str, Any]], slot_code: str = "") -> dict[str, Any] | None:
        if not group_bookings:
            return None
        clean_slot = (slot_code or "").strip().upper()
        if clean_slot:
            for item in group_bookings:
                if (item.get("booking_code") or "").strip().upper() == clean_slot:
                    return item
        for status_target in ("in_progress", "accepted", "broadcast"):
            for item in group_bookings:
                if (item.get("status") or "").lower() == status_target:
                    return item
        return group_bookings[0]

    def _resolve_booking_or_group(
        conn: Any,
        code_or_group: str,
        slot_code: str = "",
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        clean = (code_or_group or "").strip().upper()
        if not clean:
            return None, []
        direct = get_booking_by_code(conn, clean)
        if direct:
            grp = (direct.get("group_code") or "").strip().upper()
            if grp:
                group_rows = get_bookings_by_group_code(conn, grp)
                if len(group_rows) > 1:
                    if slot_code:
                        focused = _pick_group_representative(group_rows, slot_code)
                        return focused or direct, group_rows
                    return direct, group_rows
            return direct, [direct]

        group_rows = get_bookings_by_group_code(conn, clean)
        if not group_rows:
            return None, []
        focused = _pick_group_representative(group_rows, slot_code)
        return focused, group_rows

    def _group_active_trips_payload(conn: Any, raw_bookings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen_groups: set[str] = set()
        trips: list[dict[str, Any]] = []
        for b in raw_bookings:
            grp = (b.get("group_code") or "").strip().upper()
            if grp:
                if grp in seen_groups:
                    continue
                seen_groups.add(grp)
                grp_rows = get_bookings_by_group_code(conn, grp)
                if len(grp_rows) > 1:
                    summary = build_booking_group_summary(grp_rows)
                    rep = _pick_group_representative(grp_rows) or b
                    trips.append({
                        "is_group": True,
                        "group_code": grp,
                        "group_summary": summary,
                        "booking": rep,
                        "slots": grp_rows,
                        "tracking_url": f"/track/{grp}",
                    })
                    continue
            trips.append({
                "is_group": False,
                "group_code": "",
                "group_summary": None,
                "booking": b,
                "slots": [b],
                "tracking_url": f"/track/{b['booking_code']}",
            })
        return trips

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
        active_trips: list[dict[str, Any]] = []
        active_group_summary = None
        active_tracking_url = ""

        sess_code = (session.get("active_booking_code") or session.get("active_group_code") or "").strip()
        sess_phone = (session.get("customer_phone") or "").strip()
        if sess_code or sess_phone:
            raw_active = get_customer_active_bookings(conn, phone=sess_phone, booking_code=sess_code)
            active_trips = _group_active_trips_payload(conn, raw_active)
            if active_trips:
                first_trip = active_trips[0]
                active_booking = first_trip["booking"]
                active_group_summary = first_trip["group_summary"]
                active_tracking_url = first_trip["tracking_url"]
            elif sess_code:
                session.pop("active_booking_code", None)
                session.pop("active_group_code", None)

        return render_template(
            "index.html",
            online_riders_count=len(online_riders),
            settings=settings,
            active_nav="book",
            active_booking=active_booking,
            active_trips=active_trips,
            active_group_summary=active_group_summary,
            active_tracking_url=active_tracking_url,
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
        try:
            p_lat = float(data.get("pickup_lat") or 0.0)
            p_lng = float(data.get("pickup_lng") or 0.0)
            d_lat = float(data.get("dropoff_lat") or 0.0)
            d_lng = float(data.get("dropoff_lng") or 0.0)
        except (ValueError, TypeError):
            p_lat = p_lng = d_lat = d_lng = 0.0
        p_addr = (data.get("pickup_address") or "").strip()
        d_addr = (data.get("dropoff_address") or "").strip()
        item_notes = (data.get("item_notes") or "").strip()
        service = (data.get("service_type") or "pahatud").lower()

        is_large_store = bool(data.get("is_large_store", False))
        try:
            extra_stores_count = max(0, int(data.get("extra_stores_count") or 0))
        except (ValueError, TypeError):
            extra_stores_count = 0
        is_bulky = bool(data.get("is_bulky_or_high_value", False))
        manual_hinterland = bool(data.get("is_hinterland", False))

        # Auto-geocode text addresses if coordinates are missing
        if (not p_lat or not p_lng) and p_addr:
            geo_p = geocode_camiguin_location(p_addr)
            if geo_p:
                p_lat, p_lng = geo_p["lat"], geo_p["lng"]

        if (not d_lat or not d_lng) and d_addr:
            geo_d = geocode_camiguin_location(d_addr)
            if geo_d:
                d_lat, d_lng = geo_d["lat"], geo_d["lng"]

        auto_hinterland = is_hinterland_route(
            pickup_address=p_addr,
            dropoff_address=d_addr,
            item_notes=item_notes,
            pickup_lat=p_lat,
            pickup_lng=p_lng,
            dropoff_lat=d_lat,
            dropoff_lng=d_lng,
        )
        is_hinterland = manual_hinterland or auto_hinterland

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
            "auto_hinterland": auto_hinterland,
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
            settings=settings,
            tour_packages=enriched_packages,
            packages=enriched_packages,
            online_riders_count=len(online_riders),
        )

    @app.get("/history")
    def history_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "history.html",
            active_nav="history",
            settings=settings,
        )

    @app.get("/about")
    def about_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "about.html",
            active_nav="about",
            settings=settings,
        )

    @app.get("/faq")
    def faq_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "faq.html",
            active_nav="faq",
            settings=settings,
        )

    @app.get("/terms")
    def terms_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "terms.html",
            active_nav="terms",
            settings=settings,
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
        sess_group = (session.get("active_group_code") or "").strip()
        sess_phone = (session.get("customer_phone") or "").strip()

        req_code = (request.args.get("code") or "").strip()
        req_phone = (request.args.get("phone") or "").strip()

        if req_code:
            focused, group_rows = _resolve_booking_or_group(conn, req_code)
            if focused:
                if not _is_customer_authorized_for_booking(focused):
                    return jsonify({"active": False, "booking": None, "error": "Unauthorized"}), 401
                summary = build_booking_group_summary(group_rows) if len(group_rows) > 1 else None
                has_active = bool(
                    summary["active_count"] > 0 if summary else focused.get("status") in ("broadcast", "accepted", "in_progress")
                )
                if has_active:
                    if summary:
                        grp_code = group_rows[0]["group_code"]
                        session["active_booking_code"] = grp_code
                        session["active_group_code"] = grp_code
                        tracking_url = f"/track/{grp_code}"
                    else:
                        grp_code = ""
                        session["active_booking_code"] = focused["booking_code"]
                        session.pop("active_group_code", None)
                        tracking_url = f"/track/{focused['booking_code']}"
                    active_trips = [{
                        "is_group": bool(summary),
                        "group_code": grp_code,
                        "group_summary": summary,
                        "booking": focused,
                        "slots": group_rows,
                        "tracking_url": tracking_url,
                    }]
                    return jsonify({
                        "active": True,
                        "booking": focused,
                        "tracking_url": tracking_url,
                        "is_group": bool(summary),
                        "group_code": grp_code,
                        "group_summary": summary,
                        "group_bookings": group_rows,
                        "active_trips": active_trips,
                    })
                if sess_code.upper() in (
                    focused.get("booking_code", "").upper(),
                    (focused.get("group_code") or "").upper(),
                ):
                    session.pop("active_booking_code", None)
                    session.pop("active_group_code", None)
                return jsonify({
                    "active": False,
                    "booking": focused,
                    "status": focused.get("status"),
                    "group_summary": summary,
                    "active_trips": [],
                })
            return jsonify({"active": False, "booking": None, "active_trips": []})

        if req_phone:
            if not is_admin and (not sess_phone or normalize_ph_phone(req_phone) != normalize_ph_phone(sess_phone)):
                return jsonify({"active": False, "booking": None, "error": "Unauthorized"}), 401
            raw_active = get_customer_active_bookings(conn, phone=req_phone)
        else:
            raw_active = get_customer_active_bookings(conn, phone=sess_phone, booking_code=sess_code or sess_group)

        active_trips = _group_active_trips_payload(conn, raw_active)
        if active_trips:
            first_trip = active_trips[0]
            booking = first_trip["booking"]
            summary = first_trip["group_summary"]
            tracking_url = first_trip["tracking_url"]
            if first_trip["is_group"]:
                session["active_booking_code"] = first_trip["group_code"]
                session["active_group_code"] = first_trip["group_code"]
            else:
                session["active_booking_code"] = booking["booking_code"]
                session.pop("active_group_code", None)
            return jsonify({
                "active": True,
                "booking": booking,
                "tracking_url": tracking_url,
                "is_group": first_trip["is_group"],
                "group_code": first_trip["group_code"],
                "group_summary": summary,
                "group_bookings": first_trip["slots"],
                "active_trips": active_trips,
            })

        session.pop("active_booking_code", None)
        session.pop("active_group_code", None)
        return jsonify({"active": False, "booking": None, "active_trips": []})

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
        history = get_customer_ride_history(conn, clean_p)
        if not is_admin:
            norm_target = normalize_ph_phone(target_phone)
            phone_matches = bool(sess_phone and normalize_ph_phone(sess_phone) == norm_target)
            sess_code = (session.get("active_booking_code") or "").strip().upper()
            sess_group = (session.get("active_group_code") or "").strip().upper()
            code_matches = False
            if (sess_code or sess_group) and history:
                for b in history:
                    bc = (b.get("booking_code") or "").strip().upper()
                    gc = (b.get("group_code") or "").strip().upper()
                    if (sess_code and sess_code in (bc, gc)) or (sess_group and sess_group in (bc, gc)):
                        code_matches = True
                        break
            if not phone_matches and not code_matches:
                return jsonify({"success": False, "error": "Please sign in to view your ride history."}), 401
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
        if not rider_id or rating is None:
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

        if rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5."}), 400

        rider = get_rider_by_id(conn, rider_id)
        if not rider:
            return jsonify({"error": "Rider not found."}), 404

        if booking_id is not None:
            booking = get_booking_by_id(conn, booking_id)
            if not booking:
                return jsonify({"error": "Booking not found."}), 404
            if booking.get("status") != "completed":
                return jsonify({"error": "You can only review completed trips."}), 400
            if booking.get("rider_id") != rider_id:
                return jsonify({"error": "Booking is not assigned to that rider."}), 400
            if get_review_by_booking_id(conn, booking_id):
                return jsonify({"error": "You have already submitted a review for this trip."}), 409

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
        raw_phone = (data.get("customer_phone") or "").strip()
        customer_phone = normalize_ph_phone(raw_phone) or raw_phone
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

        raw_riders_count = data.get("riders_count", 1)
        try:
            riders_count = int(raw_riders_count)
        except (ValueError, TypeError):
            return jsonify({"error": "Please select between 1 and 10 riders."}), 400
        if riders_count < 1 or riders_count > 10:
            return jsonify({"error": "You can request between 1 and 10 riders per booking."}), 400

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
            estimated_budget = max(0.0, float(data.get("estimated_budget") or 0.0))
        except (ValueError, TypeError):
            estimated_budget = 0.0

        # Special options from Fare Matrix
        is_large_store = bool(data.get("is_large_store", False))
        try:
            extra_stores_count = max(0, int(data.get("extra_stores_count") or 0))
        except (ValueError, TypeError):
            extra_stores_count = 0
        is_bulky = bool(data.get("is_bulky_or_high_value", False)) or (estimated_budget >= 2000.0)

        # Auto-detect upland / steep (tungason) route by keywords or coordinates
        manual_hinterland = bool(data.get("is_hinterland", False))
        auto_hinterland = is_hinterland_route(
            pickup_address=pickup_address,
            dropoff_address=dropoff_address,
            item_notes=item_notes,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            dropoff_lat=dropoff_lat,
            dropoff_lng=dropoff_lng,
        )
        is_hinterland = manual_hinterland or auto_hinterland

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

        per_rider_fare = round(float(fare_amount), 2)
        gross_group_total = round(per_rider_fare * riders_count, 2)
        scheduled_at = (data.get("scheduled_at") or "").strip() or None
        promo_code = (data.get("promo_code") or "").strip().upper()
        promo_code_id = None
        discount_amount = 0.0

        if promo_code:
            promo_res = validate_promo_code(conn, promo_code, gross_group_total)
            if promo_res["valid"] and apply_promo_code(conn, promo_code):
                discount_amount = float(promo_res["discount_amount"] or 0.0)
                promo_code_id = promo_res.get("promo_id")
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

        group_code, group_bookings = create_booking_group(
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
            per_rider_fare=per_rider_fare,
            estimated_km=estimated_km,
            payment_method=payment_method,
            scheduled_at=scheduled_at,
            promo_code=promo_code,
            promo_code_id=promo_code_id,
            total_discount=discount_amount,
            riders_count=riders_count,
        )
        conn.commit()

        booking = group_bookings[0]
        total_fare = round(sum(float(b.get("fare_amount") or 0.0) for b in group_bookings), 2)
        group_summary = build_booking_group_summary(group_bookings) if riders_count > 1 else None
        breakdown["riders_count"] = riders_count
        breakdown["per_rider_fare"] = per_rider_fare
        breakdown["gross_group_total"] = gross_group_total
        breakdown["discount_amount"] = round(discount_amount, 2)
        breakdown["group_total_fare"] = total_fare

        if group_code:
            session["active_booking_code"] = group_code
            session["active_group_code"] = group_code
            tracking_url = f"/track/{group_code}"
            msg = f"Your {riders_count}-rider group booking ({group_code}) has been broadcasted to all active riders!"
        else:
            session["active_booking_code"] = booking["booking_code"]
            session.pop("active_group_code", None)
            tracking_url = f"/track/{booking['booking_code']}"
            msg = "Your booking has been broadcasted to all active riders!"

        session["customer_phone"] = booking["customer_phone"]
        session["customer_name"] = booking["customer_name"]

        return jsonify({
            "success": True,
            "message": msg,
            "booking": booking,
            "booking_code": booking["booking_code"],
            "is_group": bool(group_code and riders_count > 1),
            "group_code": group_code,
            "riders_count": riders_count,
            "per_rider_fare": per_rider_fare,
            "total_fare": total_fare,
            "group_bookings": group_bookings,
            "group_summary": group_summary,
            "breakdown": breakdown,
            "tracking_url": tracking_url,
        }), 201


    # -------------------------------------------------------------------------
    # In-App Chat Routes (Customer & Rider Live Messaging)
    # -------------------------------------------------------------------------
    def _authorize_chat_role(booking: dict[str, Any], preferred_role: str = "") -> str | None:
        is_assigned_rider = bool(
            session.get("rider_id") and int(booking.get("rider_id") or 0) == int(session.get("rider_id") or 0)
        )
        is_booking_customer = _is_customer_authorized_for_booking(booking, allow_admin=False)
        is_admin = bool(session.get("is_admin"))

        pref = (preferred_role or "").strip().lower()
        if pref == "rider" and (is_assigned_rider or is_admin):
            return "rider"
        if pref == "customer" and (is_booking_customer or is_admin):
            return "customer"
        if pref == "system" and is_admin:
            return "system"

        if is_assigned_rider and not is_booking_customer:
            return "rider"
        if is_booking_customer and not is_assigned_rider:
            return "customer"
        if is_assigned_rider:
            return "rider"
        if is_booking_customer:
            return "customer"
        if is_admin:
            return "system"
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

        try:
            after_id = max(0, int(request.args.get("after") or 0))
        except (ValueError, TypeError):
            after_id = 0
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

        data = request.get_json(silent=True) or {}
        req_role = str(data.get("sender_role") or "").strip().lower()
        if not req_role:
            req_role = "rider" if code_or_id.isdigit() else "customer"

        auth_role = _authorize_chat_role(booking, preferred_role=req_role)
        if not auth_role:
            return jsonify({"error": "Unauthorized to send messages for this booking."}), 401

        text = (data.get("message") or "").strip()
        if not text:
            return jsonify({"error": "Message cannot be empty."}), 400

        sender_role = auth_role
        if sender_role == "rider":
            rid = session.get("rider_id") or booking.get("rider_id")
            rider = get_rider_by_id(conn, int(rid)) if rid else None
            sender_name = (rider.get("name") if rider else None) or booking.get("rider_name") or "Club Rider"
        elif sender_role == "system":
            sender_name = "CCRC Dispatch"
        else:
            sender_name = booking.get("customer_name") or "Passenger"

        new_msg = add_booking_message(conn, booking["id"], sender_role, sender_name, text)
        conn.commit()

        try:
            after_id = max(0, int(request.args.get("after") or 0))
        except (ValueError, TypeError):
            after_id = 0
        messages = get_booking_messages(conn, booking["id"], after_id=after_id)
        return jsonify({
            "success": True,
            "message": new_msg,
            "messages": messages,
        })

    _ALLOWED_VOICE_MIMES = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/m4a": "m4a",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/aac": "aac",
        "audio/flac": "flac",
    }
    _MAX_VOICE_BYTES = 1_500_000

    @app.post("/api/chat/<code_or_id>/voice")
    def post_chat_voice_message(code_or_id: str):
        conn = get_db()
        booking = None
        if code_or_id.isdigit():
            booking = get_booking_by_id(conn, int(code_or_id))
        if not booking:
            booking = get_booking_by_code(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        pref_voice_role = (
            request.form.get("sender_role")
            or request.args.get("role")
            or ("rider" if code_or_id.isdigit() else "customer")
        )
        auth_role = _authorize_chat_role(booking, preferred_role=pref_voice_role)
        if not auth_role:
            return jsonify({"error": "Unauthorized to send voice messages for this booking."}), 401

        raw_bytes = b""
        raw_mime = ""
        dur_raw: Any = 0.0

        audio_file = request.files.get("audio")
        if audio_file is not None:
            raw_bytes = audio_file.read(_MAX_VOICE_BYTES + 1)
            raw_mime = (audio_file.mimetype or request.form.get("mimetype") or "audio/webm").split(";")[0].strip().lower()
            dur_raw = request.form.get("duration") or 0.0
        else:
            data = request.get_json(silent=True) or {}
            b64_val = (data.get("audio_base64") or "").strip()
            raw_mime = (data.get("mimetype") or "").split(";")[0].strip().lower()
            dur_raw = data.get("duration") or 0.0
            if b64_val:
                if b64_val.startswith("data:") and "," in b64_val:
                    head, b64_payload = b64_val.split(",", 1)
                    if not raw_mime and ";" in head:
                        raw_mime = head[5:].split(";")[0].strip().lower()
                else:
                    b64_payload = b64_val
                try:
                    raw_bytes = base64.b64decode(b64_payload, validate=True)
                except Exception:
                    return jsonify({"error": "Invalid audio encoding."}), 400

        if len(raw_bytes) < 50:
            return jsonify({"error": "Voice recording is empty or too short."}), 400
        if len(raw_bytes) > _MAX_VOICE_BYTES:
            return jsonify({"error": "Voice message is too large (maximum ~60 seconds)."}), 413

        ext = _ALLOWED_VOICE_MIMES.get(raw_mime)
        if not ext:
            return jsonify({"error": f"Unsupported audio format ({raw_mime or 'unknown'})."}), 400

        try:
            duration_sec = max(0.0, min(300.0, round(float(dur_raw or 0.0), 1)))
        except (ValueError, TypeError):
            duration_sec = 0.0

        sender_role = auth_role
        if sender_role == "rider":
            rid = session.get("rider_id") or booking.get("rider_id")
            rider = get_rider_by_id(conn, int(rid)) if rid else None
            sender_name = (rider.get("name") if rider else None) or booking.get("rider_name") or "Club Rider"
        elif sender_role == "system":
            sender_name = "CCRC Dispatch"
        else:
            sender_name = booking.get("customer_name") or "Passenger"

        fname = f"voice_{booking['id']}_{secrets.token_hex(8)}.{ext}"
        media_url = save_uploaded_media(conn, fname, raw_bytes, raw_mime)

        mins = int(duration_sec // 60)
        secs = int(round(duration_sec % 60))
        if secs >= 60:
            mins += 1
            secs = 0
        dur_label = f"{mins}:{secs:02d}"
        fallback_text = f"🎤 Voice message ({dur_label})" if duration_sec > 0 else "🎤 Voice message"

        new_msg = add_booking_message(
            conn,
            booking["id"],
            sender_role,
            sender_name,
            fallback_text,
            msg_type="voice",
            media_url=media_url,
            media_duration=duration_sec,
        )
        conn.commit()

        try:
            after_id = max(0, int(request.args.get("after") or 0))
        except (ValueError, TypeError):
            after_id = 0
        messages = get_booking_messages(conn, booking["id"], after_id=after_id)
        return jsonify({
            "success": True,
            "message": new_msg,
            "messages": messages,
        }), 201

    _MAX_CHAT_PHOTO_BYTES = 2_500_000

    @app.post("/api/chat/<code_or_id>/photo")
    def post_chat_photo_message(code_or_id: str):
        conn = get_db()
        booking = None
        if code_or_id.isdigit():
            booking = get_booking_by_id(conn, int(code_or_id))
        if not booking:
            booking = get_booking_by_code(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        data = request.get_json(silent=True) or {}
        pref_photo_role = (
            request.form.get("sender_role")
            or data.get("sender_role")
            or request.args.get("role")
            or ("rider" if code_or_id.isdigit() else "customer")
        )
        auth_role = _authorize_chat_role(booking, preferred_role=str(pref_photo_role))
        if not auth_role:
            return jsonify({"error": "Unauthorized to send photos for this booking."}), 401

        raw_bytes = b""
        caption = ""

        photo_file = request.files.get("photo") or request.files.get("image")
        if photo_file is not None:
            raw_bytes = photo_file.read(_MAX_CHAT_PHOTO_BYTES + 1)
            caption = (request.form.get("caption") or request.form.get("message") or "").strip()
        else:
            b64_val = (data.get("photo_base64") or data.get("image_base64") or "").strip()
            caption = (data.get("caption") or data.get("message") or "").strip()
            if b64_val:
                if b64_val.startswith("data:") and "," in b64_val:
                    _, b64_payload = b64_val.split(",", 1)
                else:
                    b64_payload = b64_val
                try:
                    raw_bytes = base64.b64decode(b64_payload, validate=True)
                except Exception:
                    return jsonify({"error": "Invalid photo encoding. Please upload a PNG, JPG, or WebP image."}), 400

        if len(raw_bytes) < 20:
            return jsonify({"error": "Photo is empty or invalid."}), 400
        if len(raw_bytes) > _MAX_CHAT_PHOTO_BYTES:
            return jsonify({"error": "Photo is too large (maximum 2.5 MB)."}), 413

        if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            mime, ext = "image/png", "png"
        elif raw_bytes.startswith(b"\xff\xd8\xff"):
            mime, ext = "image/jpeg", "jpg"
        elif len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
            mime, ext = "image/webp", "webp"
        else:
            return jsonify({"error": "Unsupported photo format. Please upload a JPG, PNG, or WebP image."}), 400

        sender_role = auth_role
        if sender_role == "rider":
            rid = session.get("rider_id") or booking.get("rider_id")
            rider = get_rider_by_id(conn, int(rid)) if rid else None
            sender_name = (rider.get("name") if rider else None) or booking.get("rider_name") or "Club Rider"
        elif sender_role == "system":
            sender_name = "CCRC Dispatch"
        else:
            sender_name = booking.get("customer_name") or "Passenger"

        fname = f"chat_photo_{booking['id']}_{secrets.token_hex(8)}.{ext}"
        media_url = save_uploaded_media(conn, fname, raw_bytes, mime)

        clean_caption = caption[:240]
        msg_text = clean_caption if clean_caption else "📸 Photo"

        new_msg = add_booking_message(
            conn,
            booking["id"],
            sender_role,
            sender_name,
            msg_text,
            msg_type="image",
            media_url=media_url,
            media_duration=0.0,
        )
        conn.commit()

        try:
            after_id = max(0, int(request.args.get("after") or 0))
        except (ValueError, TypeError):
            after_id = 0
        messages = get_booking_messages(conn, booking["id"], after_id=after_id)
        return jsonify({
            "success": True,
            "message": new_msg,
            "messages": messages,
        }), 201

    # -------------------------------------------------------------------------
    # Free In-App Voice Call Routes (WebRTC Peer Audio + DB Signaling)
    # -------------------------------------------------------------------------
    def _get_rtc_ice_servers() -> list[dict[str, Any]]:
        raw_json = (os.environ.get("CCRC_ICE_SERVERS_JSON") or "").strip()
        if raw_json:
            try:
                parsed = json.loads(raw_json)
                if isinstance(parsed, list) and parsed:
                    return parsed
            except Exception:
                pass
        servers: list[dict[str, Any]] = [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},
            {"urls": "stun:stun.cloudflare.com:3478"},
        ]
        turn_urls = [u.strip() for u in (os.environ.get("CCRC_TURN_URLS") or "").split(",") if u.strip()]
        if turn_urls:
            turn_entry: dict[str, Any] = {"urls": turn_urls if len(turn_urls) > 1 else turn_urls[0]}
            turn_user = (os.environ.get("CCRC_TURN_USERNAME") or "").strip()
            turn_cred = (os.environ.get("CCRC_TURN_CREDENTIAL") or "").strip()
            if turn_user:
                turn_entry["username"] = turn_user
            if turn_cred:
                turn_entry["credential"] = turn_cred
            servers.append(turn_entry)
        return servers

    def _resolve_booking_by_code_or_id(conn: Any, code_or_id: str) -> dict[str, Any] | None:
        if str(code_or_id).isdigit():
            b = get_booking_by_id(conn, int(code_or_id))
            if b:
                return b
        return get_booking_by_code(conn, str(code_or_id))

    @app.get("/api/rtc/ice-config")
    def get_rtc_ice_config():
        return jsonify({"success": True, "ice_servers": _get_rtc_ice_servers()})

    @app.get("/api/calls/<code_or_id>/state")
    def get_inapp_call_state(code_or_id: str):
        conn = get_db()
        booking = _resolve_booking_by_code_or_id(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        pref_call_role = request.args.get("role") or ("rider" if str(code_or_id).isdigit() else "customer")
        auth_role = _authorize_chat_role(booking, preferred_role=pref_call_role)
        if not auth_role:
            return jsonify({"error": "Unauthorized for this booking's call state."}), 401

        try:
            after_signal_id = max(0, int(request.args.get("after_signal_id") or 0))
        except (ValueError, TypeError):
            after_signal_id = 0
        try:
            active_call_id = int(request.args.get("call_id")) if request.args.get("call_id") else None
        except (ValueError, TypeError):
            active_call_id = None

        call_obj, signals = get_latest_call_state(
            conn,
            int(booking["id"]),
            active_call_id=active_call_id,
            after_signal_id=after_signal_id,
        )
        conn.commit()

        can_call = bool(booking.get("rider_id") and booking.get("status") in ("accepted", "in_progress"))
        if auth_role == "rider":
            peer_name = booking.get("customer_name") or "Passenger"
            peer_phone = booking.get("customer_phone") or ""
        else:
            peer_name = booking.get("rider_name") or "Club Rider"
            peer_phone = booking.get("rider_phone") or ""

        return jsonify({
            "success": True,
            "viewer_role": auth_role,
            "booking_id": booking["id"],
            "booking_code": booking["booking_code"],
            "booking_status": booking.get("status"),
            "can_call": can_call,
            "peer_name": peer_name,
            "peer_phone": peer_phone,
            "call": call_obj,
            "signals": signals,
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/calls/<code_or_id>/start")
    def start_inapp_call(code_or_id: str):
        conn = get_db()
        booking = _resolve_booking_by_code_or_id(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        pref_start_role = "rider" if str(code_or_id).isdigit() else "customer"
        auth_role = _authorize_chat_role(booking, preferred_role=pref_start_role)
        if not auth_role:
            return jsonify({"error": "Unauthorized to start a call for this booking."}), 401
        if auth_role not in ("customer", "rider"):
            return jsonify({"error": "Only the passenger or assigned rider can initiate an in-app voice call."}), 403

        if auth_role == "rider":
            rid = session.get("rider_id") or booking.get("rider_id")
            rider = get_rider_by_id(conn, int(rid)) if rid else None
            caller_name = (rider.get("name") if rider else None) or booking.get("rider_name") or "Club Rider"
        else:
            caller_name = booking.get("customer_name") or "Passenger"

        data = request.get_json(silent=True) or {}
        offer_data = data.get("offer")
        if offer_data is not None and not isinstance(offer_data, dict):
            return jsonify({"error": "Invalid WebRTC offer payload."}), 400

        ok, msg, call_obj, status_code = create_call_session(
            conn,
            booking=booking,
            caller_role=auth_role,
            caller_name=caller_name,
            offer_data=offer_data,
        )
        if not ok:
            conn.commit()
            return jsonify({
                "error": msg,
                "call": call_obj,
                "ice_servers": _get_rtc_ice_servers(),
            }), status_code

        conn.commit()
        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        }), 201

    @app.post("/api/calls/session/<int:call_id>/respond")
    def respond_inapp_call(call_id: int):
        conn = get_db()
        prev_call = get_call_session(conn, call_id)
        if not prev_call:
            return jsonify({"error": "Call session not found."}), 404

        booking = get_booking_by_id(conn, int(prev_call["booking_id"]))
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        auth_role = _authorize_chat_role(booking)
        if not auth_role:
            return jsonify({"error": "Unauthorized to respond to this call."}), 401

        data = request.get_json(silent=True) or {}
        action = (data.get("action") or "").strip().lower()
        answer_data = data.get("answer")
        reason = str(data.get("reason") or "").strip()

        if answer_data is not None and not isinstance(answer_data, dict):
            return jsonify({"error": "Invalid WebRTC answer payload."}), 400

        prev_status = prev_call.get("status")
        ok, msg, call_obj, status_code = respond_to_call(
            conn,
            call_id=call_id,
            actor_role=auth_role,
            action=action,
            answer_data=answer_data,
            reason=reason,
        )
        if not ok:
            conn.commit()
            return jsonify({"error": msg, "call": call_obj}), status_code

        # Log one brief timeline note in chat when a call terminates cleanly
        if call_obj and prev_status in ("ringing", "accepted") and call_obj.get("status") in ("declined", "ended", "missed"):
            try:
                final_status = call_obj.get("status")
                if final_status == "declined":
                    log_text = "📵 In-app call was declined."
                elif final_status == "missed":
                    log_text = f"📵 Missed in-app call from {call_obj.get('caller_name') or 'User'}."
                else:
                    dur_label = ""
                    ans_str = call_obj.get("answered_at")
                    end_str = call_obj.get("ended_at")
                    if ans_str and end_str:
                        try:
                            secs = max(0, int((datetime.fromisoformat(end_str) - datetime.fromisoformat(ans_str)).total_seconds()))
                            dur_label = f" ({secs // 60}:{secs % 60:02d})"
                        except Exception:
                            dur_label = ""
                    log_text = f"📞 In-app voice call ended{dur_label}."
                add_booking_message(conn, int(booking["id"]), "system", "CCRC Call", log_text)
            except Exception:
                pass

        conn.commit()
        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/calls/session/<int:call_id>/signal")
    def post_inapp_call_signal(call_id: int):
        conn = get_db()
        call_obj = get_call_session(conn, call_id)
        if not call_obj:
            return jsonify({"error": "Call session not found."}), 404

        booking = get_booking_by_id(conn, int(call_obj["booking_id"]))
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        auth_role = _authorize_chat_role(booking)
        if not auth_role:
            return jsonify({"error": "Unauthorized to signal this call."}), 401
        if auth_role not in (call_obj["caller_role"], call_obj["callee_role"], "system"):
            return jsonify({"error": "Forbidden from signaling this call."}), 403
        if call_obj.get("status") not in ("ringing", "accepted"):
            return jsonify({"error": "Call has already ended."}), 409

        data = request.get_json(silent=True) or {}
        signal_ids: list[int] = []

        candidates = data.get("candidates")
        if isinstance(candidates, list) and candidates:
            for item in candidates[:30]:
                if item is not None:
                    sig_id = add_call_signal(conn, call_id, int(booking["id"]), auth_role, "candidate", item)
                    signal_ids.append(sig_id)
        else:
            sig_type = (data.get("signal_type") or "").strip().lower()
            if sig_type not in ("offer", "answer", "candidate", "renegotiate"):
                return jsonify({"error": "Invalid signal_type."}), 400
            sig_data = data.get("data")
            sig_id = add_call_signal(conn, call_id, int(booking["id"]), auth_role, sig_type, sig_data)
            signal_ids.append(sig_id)

        conn.commit()
        return jsonify({"success": True, "signal_ids": signal_ids})

    # -------------------------------------------------------------------------
    # Rider-to-Rider Free In-App Voice Call Routes
    # -------------------------------------------------------------------------
    @app.get("/api/rider/calls/state")
    def get_rider_call_state():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401

        conn = get_db()
        me = get_rider_by_id(conn, int(rider_id))
        if not me or me.get("status") != "active":
            return jsonify({"error": "Active rider account required."}), 403

        try:
            after_signal_id = max(0, int(request.args.get("after_signal_id") or 0))
        except (ValueError, TypeError):
            after_signal_id = 0
        try:
            active_call_id = int(request.args.get("call_id")) if request.args.get("call_id") else None
        except (ValueError, TypeError):
            active_call_id = None

        call_obj, signals = get_latest_rider_call_state(
            conn,
            rider_id=int(rider_id),
            active_call_id=active_call_id,
            after_signal_id=after_signal_id,
        )
        conn.commit()

        peer_name = "Fellow Rider"
        peer_phone = ""
        if call_obj:
            other_id = (
                int(call_obj["callee_rider_id"])
                if int(call_obj["caller_rider_id"]) == int(rider_id)
                else int(call_obj["caller_rider_id"])
            )
            other_rider = get_rider_by_id(conn, other_id)
            if other_rider:
                peer_name = other_rider.get("name") or peer_name
                peer_phone = other_rider.get("phone") or ""
            else:
                peer_name = (
                    call_obj.get("callee_name")
                    if int(call_obj["caller_rider_id"]) == int(rider_id)
                    else call_obj.get("caller_name")
                ) or peer_name

        return jsonify({
            "success": True,
            "viewer_role": f"rider:{rider_id}",
            "rider_id": int(rider_id),
            "peer_name": peer_name,
            "peer_phone": peer_phone,
            "call": call_obj,
            "signals": signals,
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/rider/calls/<int:target_rider_id>/start")
    def start_rider_to_rider_call(target_rider_id: int):
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401

        conn = get_db()
        data = request.get_json(silent=True) or {}
        offer_data = data.get("offer")
        if offer_data is not None and not isinstance(offer_data, dict):
            return jsonify({"error": "Invalid WebRTC offer payload."}), 400

        ok, msg, call_obj, status_code = create_rider_call_session(
            conn,
            caller_rider_id=int(rider_id),
            callee_rider_id=int(target_rider_id),
            offer_data=offer_data,
        )
        conn.commit()
        if not ok:
            return jsonify({
                "error": msg,
                "call": call_obj,
                "ice_servers": _get_rtc_ice_servers(),
            }), status_code

        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        }), 201

    @app.post("/api/rider/calls/session/<int:call_id>/respond")
    def respond_rider_to_rider_call(call_id: int):
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401

        conn = get_db()
        data = request.get_json(silent=True) or {}
        action = (data.get("action") or "").strip().lower()
        answer_data = data.get("answer")
        reason = str(data.get("reason") or "").strip()

        if answer_data is not None and not isinstance(answer_data, dict):
            return jsonify({"error": "Invalid WebRTC answer payload."}), 400

        ok, msg, call_obj, status_code = respond_to_rider_call(
            conn,
            call_id=call_id,
            actor_rider_id=int(rider_id),
            action=action,
            answer_data=answer_data,
            reason=reason,
        )
        conn.commit()
        if not ok:
            return jsonify({"error": msg, "call": call_obj}), status_code

        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/rider/calls/session/<int:call_id>/signal")
    def post_rider_to_rider_call_signal(call_id: int):
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401

        conn = get_db()
        call_obj = get_rider_call_session(conn, call_id)
        if not call_obj:
            return jsonify({"error": "Rider call session not found."}), 404

        rid = int(rider_id)
        if rid not in (int(call_obj["caller_rider_id"]), int(call_obj["callee_rider_id"])):
            return jsonify({"error": "Forbidden from signaling this rider call."}), 403
        if call_obj.get("status") not in ("ringing", "accepted"):
            return jsonify({"error": "Call has already ended."}), 409

        data = request.get_json(silent=True) or {}
        signal_ids: list[int] = []

        candidates = data.get("candidates")
        if isinstance(candidates, list) and candidates:
            for item in candidates[:30]:
                if item is not None:
                    sig_id = add_rider_call_signal(conn, call_id, rid, "candidate", item)
                    signal_ids.append(sig_id)
        else:
            sig_type = (data.get("signal_type") or "").strip().lower()
            if sig_type not in ("offer", "answer", "candidate", "renegotiate"):
                return jsonify({"error": "Invalid signal_type."}), 400
            sig_data = data.get("data")
            sig_id = add_rider_call_signal(conn, call_id, rid, sig_type, sig_data)
            signal_ids.append(sig_id)

        conn.commit()
        return jsonify({"success": True, "signal_ids": signal_ids})

    # -------------------------------------------------------------------------
    # Live Tracking Routes
    # -------------------------------------------------------------------------
    @app.get("/track/<booking_code>")
    def track_view(booking_code: str):
        conn = get_db()
        slot_param = (request.args.get("slot") or "").strip()
        booking, group_bookings = _resolve_booking_or_group(conn, booking_code, slot_param)
        if not booking:
            return render_template("track.html", booking=None, group_bookings=[], group_summary=None, error="Booking not found."), 404

        group_summary = build_booking_group_summary(group_bookings) if len(group_bookings) > 1 else None
        is_group_active = bool(group_summary["active_count"] > 0) if group_summary else booking.get("status") in ("broadcast", "accepted", "in_progress")

        if is_group_active:
            if group_summary:
                session["active_booking_code"] = group_summary["group_code"]
                session["active_group_code"] = group_summary["group_code"]
            else:
                session["active_booking_code"] = booking["booking_code"]
                session.pop("active_group_code", None)
        else:
            sess_code = (session.get("active_booking_code") or "").strip().upper()
            if sess_code in (
                (booking.get("booking_code") or "").upper(),
                (booking.get("group_code") or "").upper(),
            ):
                session.pop("active_booking_code", None)
                session.pop("active_group_code", None)

        slot_ids = [int(s["id"]) for s in group_bookings if s.get("id")]
        reviewed_ids: set[int] = set()
        if slot_ids:
            placeholders = ", ".join(["?"] * len(slot_ids))
            rev_rows = conn.execute(
                f"SELECT DISTINCT booking_id FROM reviews WHERE booking_id IN ({placeholders})",
                tuple(slot_ids),
            ).fetchall()
            reviewed_ids = {int(r["booking_id"]) for r in rev_rows if r["booking_id"] is not None}

        for s in group_bookings:
            s["already_reviewed"] = int(s.get("id") or 0) in reviewed_ids

        already_reviewed = bool(booking.get("already_reviewed"))
        track_code = group_summary["group_code"] if group_summary else booking["booking_code"]
        return render_template(
            "track.html",
            booking=booking,
            group_bookings=group_bookings,
            group_summary=group_summary,
            track_code=track_code,
            active_nav="track",
            already_reviewed=already_reviewed,
        )

    @app.get("/api/bookings/track/<booking_code>")
    def api_track_booking(booking_code: str):
        conn = get_db()
        slot_param = (request.args.get("slot") or "").strip()
        booking, group_bookings = _resolve_booking_or_group(conn, booking_code, slot_param)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        trail = []
        if booking.get("id"):
            trail = get_booking_tracking_trail(conn, booking["id"], limit=20)

        # Compute real-time road distance from focused rider to pickup/dropoff
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

        slot_ids = [int(s["id"]) for s in group_bookings if s.get("id")]
        reviewed_ids: set[int] = set()
        if slot_ids:
            placeholders = ", ".join(["?"] * len(slot_ids))
            rev_rows = conn.execute(
                f"SELECT DISTINCT booking_id FROM reviews WHERE booking_id IN ({placeholders})",
                tuple(slot_ids),
            ).fetchall()
            reviewed_ids = {int(r["booking_id"]) for r in rev_rows if r["booking_id"] is not None}

        focused_id = int(booking.get("id") or 0)
        for s in group_bookings:
            sid = int(s.get("id") or 0)
            s["already_reviewed"] = sid in reviewed_ids
            if sid == focused_id:
                s["distance_to_pickup_km"] = distance_to_pickup_km
                s["distance_to_dropoff_km"] = distance_to_dropoff_km
            else:
                if s.get("rider_lat") and s.get("rider_lng") and s.get("pickup_lat") and s.get("pickup_lng"):
                    s["distance_to_pickup_km"] = round(
                        calculate_haversine_km(float(s["rider_lat"]), float(s["rider_lng"]), float(s["pickup_lat"]), float(s["pickup_lng"])) * 1.25,
                        2,
                    )
                else:
                    s["distance_to_pickup_km"] = None
                if s.get("rider_lat") and s.get("rider_lng") and s.get("dropoff_lat") and s.get("dropoff_lng"):
                    s["distance_to_dropoff_km"] = round(
                        calculate_haversine_km(float(s["rider_lat"]), float(s["rider_lng"]), float(s["dropoff_lat"]), float(s["dropoff_lng"])) * 1.25,
                        2,
                    )
                else:
                    s["distance_to_dropoff_km"] = None

        group_summary = build_booking_group_summary(group_bookings) if len(group_bookings) > 1 else None

        return jsonify({
            "booking": booking,
            "trail": trail,
            "distance_to_pickup_km": distance_to_pickup_km,
            "distance_to_dropoff_km": distance_to_dropoff_km,
            "already_reviewed": int(booking.get("id") or 0) in reviewed_ids,
            "group_bookings": group_bookings,
            "group_summary": group_summary,
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

    _MAX_GCASH_QR_BYTES = 2_000_000

    def _parse_gcash_qr_upload(qr_b64: str) -> tuple[bytes | None, str | None, str | None, str | None, int]:
        raw_val = (qr_b64 or "").strip()
        if not raw_val:
            return None, None, None, "Please select a GCash QR code image.", 400
        if raw_val.startswith("data:") and "," in raw_val:
            _, b64_payload = raw_val.split(",", 1)
        else:
            b64_payload = raw_val
        try:
            raw_bytes = base64.b64decode(b64_payload, validate=True)
        except Exception:
            return None, None, None, "Invalid GCash QR image encoding. Please upload a PNG, JPG, or WebP image.", 400
        if len(raw_bytes) < 20:
            return None, None, None, "GCash QR image is empty or invalid.", 400
        if len(raw_bytes) > _MAX_GCASH_QR_BYTES:
            return None, None, None, "GCash QR image is too large (maximum 2 MB).", 413
        if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return raw_bytes, "image/png", "png", None, 200
        if raw_bytes.startswith(b"\xff\xd8\xff"):
            return raw_bytes, "image/jpeg", "jpg", None, 200
        if len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
            return raw_bytes, "image/webp", "webp", None, 200
        return None, None, None, "Unsupported GCash QR image format. Please upload a PNG, JPG, or WebP image.", 400

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
        gcash_number = (data.get("gcash_number") or "").strip()
        gcash_qr_b64 = (data.get("gcash_qr_base64") or "").strip()

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

        qr_parsed: tuple[bytes, str, str] | None = None
        if gcash_qr_b64:
            qr_bytes, qr_mime, qr_ext, qr_err, qr_status = _parse_gcash_qr_upload(gcash_qr_b64)
            if qr_err or not qr_bytes or not qr_mime or not qr_ext:
                return jsonify({"error": qr_err or "Invalid GCash QR image."}), qr_status
            qr_parsed = (qr_bytes, qr_mime, qr_ext)

        # Process and save profile picture
        avatar_url = ""
        if avatar_b64 and "," in avatar_b64:
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
            gcash_number=gcash_number,
        )
        if qr_parsed:
            qr_bytes, qr_mime, qr_ext = qr_parsed
            ts = int(datetime.now().timestamp())
            qr_fname = f"gcash_qr_{rider_id}_{ts}_{secrets.token_hex(3)}.{qr_ext}"
            qr_url = save_uploaded_media(conn, qr_fname, qr_bytes, qr_mime)
            update_rider_gcash_profile(conn, int(rider_id), gcash_qr_url=qr_url)
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

    @app.route("/api/rider/gcash-profile", methods=["GET", "POST"])
    def rider_gcash_profile():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        rider = get_rider_by_id(conn, int(rider_id))
        if not rider:
            return jsonify({"error": "Rider account not found."}), 404

        if request.method == "GET":
            clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
            return jsonify({
                "success": True,
                "gcash_number": clean_rider.get("gcash_number") or "",
                "gcash_qr_url": clean_rider.get("gcash_qr_url") or "",
                "rider": clean_rider,
            })

        data = request.get_json(silent=True) or {}
        new_number: str | None = None
        if "gcash_number" in data:
            new_number = str(data.get("gcash_number") or "").strip()

        new_qr_url: str | None = None
        clear_qr = bool(data.get("clear_qr"))
        qr_b64 = (data.get("gcash_qr_base64") or "").strip()
        if clear_qr:
            new_qr_url = ""
        elif qr_b64:
            qr_bytes, qr_mime, qr_ext, qr_err, qr_status = _parse_gcash_qr_upload(qr_b64)
            if qr_err or not qr_bytes or not qr_mime or not qr_ext:
                return jsonify({"error": qr_err or "Invalid GCash QR image."}), qr_status
            ts = int(datetime.now().timestamp())
            qr_fname = f"gcash_qr_{rider_id}_{ts}_{secrets.token_hex(3)}.{qr_ext}"
            new_qr_url = save_uploaded_media(conn, qr_fname, qr_bytes, qr_mime)

        if new_number is None and new_qr_url is None:
            return jsonify({"error": "Please enter your GCash mobile number or upload a GCash QR code image."}), 400

        updated_rider = update_rider_gcash_profile(
            conn,
            int(rider_id),
            gcash_number=new_number,
            gcash_qr_url=new_qr_url,
        )
        conn.commit()
        clean_rider = {k: v for k, v in (updated_rider or rider).items() if k != "password_hash"}
        return jsonify({
            "success": True,
            "message": "Your GCash QR & payment details have been saved!",
            "gcash_number": clean_rider.get("gcash_number") or "",
            "gcash_qr_url": clean_rider.get("gcash_qr_url") or "",
            "rider": clean_rider,
        })

    # -------------------------------------------------------------------------
    # Digital Official CCRC Club ID Card & Public QR Verification
    # -------------------------------------------------------------------------
    def _format_club_rider_id(rider_id: int) -> str:
        return f"CCRC-{int(rider_id):04d}"

    def _mask_license_no(raw_license: str) -> str:
        clean = str(raw_license or "").strip().upper()
        if not clean:
            return ""
        if len(clean) <= 4:
            return ("•" * max(0, len(clean) - 2)) + clean[-2:]
        prefix = clean[:3]
        suffix = clean[-3:]
        mid = "".join(ch if not ch.isalnum() else "•" for ch in clean[3:-3])
        return f"{prefix}{mid}{suffix}"

    def _format_member_since(created_at: str | None) -> str:
        raw = str(created_at or "").strip()
        if not raw:
            return "Verified Member"
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.strftime("%b %Y")
        except Exception:
            return raw[:10]

    def _build_rider_id_payload(conn, rider: dict[str, Any], include_private: bool = False) -> dict[str, Any]:
        rid = int(rider["id"])
        settings = get_settings(conn)
        reviews = get_rider_reviews(conn, rid, limit=200)
        review_count = len(reviews)
        status_raw = str(rider.get("status") or "pending").strip().lower()
        is_verified = status_raw == "active"
        base_url = request.url_root.rstrip("/")
        verify_url = f"{base_url}/verify/rider/{rid}"
        qr_svg_url = f"/api/rider/{rid}/id-qr.svg"
        raw_license = str(rider.get("license_no") or "").strip().upper()
        now_pht = get_now_pht()
        return {
            "id": rid,
            "club_id": _format_club_rider_id(rid),
            "name": rider.get("name") or "Club Rider",
            "phone": (rider.get("phone") or "") if include_private else "",
            "bike_model": rider.get("bike_model") or "Motorcycle",
            "plate_number": (rider.get("plate_number") or "N/A").upper(),
            "municipality": rider.get("municipality") or "Mambajao",
            "license_no": raw_license if include_private else _mask_license_no(raw_license),
            "has_license_on_file": bool(raw_license),
            "avatar_url": rider.get("avatar_url") or "",
            "status": status_raw,
            "is_verified": is_verified,
            "is_online": bool(rider.get("is_online")),
            "total_trips": int(rider.get("total_trips") or 0),
            "rating_avg": round(float(rider.get("rating_avg") or 5.0), 1),
            "review_count": review_count,
            "member_since": _format_member_since(rider.get("created_at")),
            "created_at": rider.get("created_at") or "",
            "verify_url": verify_url,
            "qr_svg_url": qr_svg_url,
            "club_name": settings.get("club_name", "Camiguin Centric Riders Club"),
            "club_hotline": settings.get("hotline", "0917 555 0199"),
            "verified_at_pht": now_pht.strftime("%b %d, %Y %I:%M %p PHT"),
        }

    @app.get("/api/rider/id-card")
    def api_rider_id_card():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        rider = get_rider_by_id(conn, int(rider_id))
        if not rider:
            return jsonify({"error": "Rider account not found."}), 404
        return jsonify({
            "success": True,
            "id_card": _build_rider_id_payload(conn, rider, include_private=True),
        })

    @app.get("/api/rider/<int:rider_id>/id-qr.svg")
    def api_rider_id_qr_svg(rider_id: int):
        conn = get_db()
        rider = get_rider_by_id(conn, int(rider_id))
        if not rider:
            return Response("Rider not found", status=404, mimetype="text/plain")
        verify_url = f"{request.url_root.rstrip('/')}/verify/rider/{int(rider['id'])}"
        svg_markup = render_qr_svg(verify_url, border=4, dark="#0f172a", light="#ffffff")
        resp = Response(svg_markup, status=200, mimetype="image/svg+xml")
        resp.headers["Cache-Control"] = "public, max-age=300"
        return resp

    @app.get("/verify/rider/<int:rider_id>")
    def verify_rider_public_page(rider_id: int):
        conn = get_db()
        rider = get_rider_by_id(conn, int(rider_id))
        if not rider:
            return (
                render_template(
                    "verify_rider.html",
                    active_nav="",
                    rider_card=None,
                    requested_club_id=_format_club_rider_id(rider_id),
                ),
                404,
            )
        card = _build_rider_id_payload(conn, rider, include_private=False)
        return render_template(
            "verify_rider.html",
            active_nav="",
            rider_card=card,
            requested_club_id=card["club_id"],
        )

    @app.get("/api/rider/co-riders")
    def get_rider_co_riders():
        current_rider_id = session.get("rider_id")
        if not current_rider_id and not session.get("is_admin"):
            return jsonify({"error": "Rider authentication required."}), 401
        conn = get_db()
        riders = get_online_riders(conn)
        live_statuses = get_rider_live_statuses(conn)
        busy_ids = get_busy_rider_ids(conn)
        clean_list = []
        for r in riders:
            rid = int(r["id"])
            st = live_statuses.get(rid, {})
            is_busy = bool(rid in busy_ids)
            activity_status = st.get("activity_status", "available")
            activity_label = st.get("activity_label", "Available")
            clean_list.append({
                "id": rid,
                "name": r["name"],
                "phone": r["phone"],
                "bike_model": r["bike_model"],
                "plate_number": r["plate_number"],
                "municipality": r.get("municipality") or "Mambajao",
                "avatar_url": r.get("avatar_url") or "",
                "rating_avg": r.get("rating_avg") or 5.0,
                "total_trips": r.get("total_trips") or 0,
                "last_lat": r.get("last_lat"),
                "last_lng": r.get("last_lng"),
                "last_active_at": r.get("last_active_at"),
                "is_self": bool(current_rider_id and rid == current_rider_id),
                "has_active_job": is_busy,
                "activity_status": activity_status,
                "activity_label": activity_label,
                "trip_destination": st.get("dropoff_address", ""),
                "trip_pickup": st.get("pickup_address", ""),
                "service_type": st.get("service_type", ""),
                "recent_completed": bool(st.get("recent_completed", False)),
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
        rider_id = session.get("rider_id")
        jobs = get_available_broadcast_bookings(conn, rider_id=int(rider_id) if rider_id else None)
        return jsonify({"jobs": jobs, "count": len(jobs)})

    @app.get("/api/rider/active-job")
    def rider_active_job():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"authenticated": False, "job": None, "scheduled_jobs": []})
        conn = get_db()

        rider = get_rider_by_id(conn, int(rider_id))
        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"} if rider else None
        job = get_rider_active_job(conn, int(rider_id))
        scheduled_jobs = get_rider_scheduled_jobs(conn, int(rider_id))
        return jsonify({
            "authenticated": True,
            "rider": clean_rider,
            "job": job,
            "scheduled_jobs": scheduled_jobs,
        })

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

        # Check if rider already has an active ongoing job (same-group duplicate claims fall through to 409 below)
        active = get_rider_active_job(conn, int(rider_id))
        target_grp = (target_booking.get("group_code") or "").strip().upper()
        active_grp = (active.get("group_code") or "").strip().upper() if active else ""
        same_group_active = bool(active and target_grp and active_grp == target_grp)
        if active and active["id"] != booking_id and not is_target_advance and not same_group_active:
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

        claimed, claimed_id, claim_reason = accept_booking_for_group_slot(conn, booking_id, int(rider_id))
        if not claimed:
            conn.rollback()
            return jsonify({"error": claim_reason or "This booking has already been claimed by another rider."}), 409

        conn.commit()
        updated_job = attach_group_metadata(conn, get_booking_by_id(conn, int(claimed_id or booking_id)))
        msg = "Booking accepted successfully!"
        if updated_job and int(updated_job.get("group_size") or 1) > 1:
            msg = f"Joined Group Ride as Rider {updated_job.get('rider_slot', 1)} of {updated_job.get('group_size', 1)}!"
        return jsonify({
            "success": True,
            "message": msg,
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
        if booking.get("status") != "accepted":
            return jsonify({"error": "Only accepted scheduled bookings can be started."}), 400
        if not update_booking_status(conn, booking_id, "in_progress"):
            return jsonify({"error": "Unable to start booking from its current status."}), 400
        conn.commit()
        return jsonify({"success": True, "job": attach_group_metadata(conn, get_booking_by_id(conn, booking_id))})

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
        is_booking_customer = _is_customer_authorized_for_booking(booking)

        if not is_admin and not is_assigned_rider:
            if not (new_status == "cancelled" and is_booking_customer):
                return jsonify({"error": "Unauthorized to update this booking's status."}), 403
            if (booking.get("status") or "").strip().lower() != "broadcast":
                return jsonify({
                    "error": "Only open (unassigned) broadcast bookings or slots can be cancelled directly by the passenger."
                }), 400

        if (
            new_status == "completed"
            and (booking.get("payment_method") or "").strip().lower() == "gcash"
            and (booking.get("payment_status") or "pending").strip().lower() != "paid"
            and not is_admin
        ):
            return jsonify({
                "error": "Cannot complete this GCash booking yet. Please show your GCash QR code and confirm that you received the customer's GCash payment first.",
                "requires_gcash_payment": True,
                "payment_status": booking.get("payment_status") or "pending",
            }), 400

        if not update_booking_status(conn, booking_id, new_status):
            return jsonify({"error": "Cannot transition booking from its current status."}), 400
        conn.commit()
        updated_job = attach_group_metadata(conn, get_booking_by_id(conn, booking_id))
        return jsonify({"success": True, "job": updated_job})

    @app.post("/api/bookings/<code_or_id>/gcash/customer-sent")
    def booking_gcash_customer_sent(code_or_id: str):
        conn = get_db()
        booking = _resolve_booking_by_code_or_id(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        auth_role = _authorize_chat_role(booking, preferred_role="customer")
        if not auth_role:
            return jsonify({"error": "Unauthorized to report GCash payment for this booking."}), 401
        if auth_role == "rider":
            return jsonify({"error": "Only the customer can mark GCash payment as sent."}), 403

        data = request.get_json(silent=True) or {}
        payment_ref = str(data.get("payment_ref") or "").strip()

        ok, msg, updated, status_code = mark_gcash_payment_sent(
            conn,
            int(booking["id"]),
            payment_ref=payment_ref,
        )
        if not ok:
            conn.rollback()
            return jsonify({"error": msg}), status_code
        conn.commit()
        return jsonify({"success": True, "message": msg, "booking": updated})

    @app.post("/api/bookings/<code_or_id>/gcash/confirm")
    def booking_gcash_confirm(code_or_id: str):
        rider_id = session.get("rider_id")
        is_admin = bool(session.get("is_admin"))
        if not rider_id and not is_admin:
            return jsonify({"error": "Rider authentication required."}), 401

        conn = get_db()
        booking = _resolve_booking_by_code_or_id(conn, code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        data = request.get_json(silent=True) or {}
        payment_ref = str(data.get("payment_ref") or "").strip()
        verified_offline_receipt = bool(data.get("verified_offline_receipt", False))

        ok, msg, updated, status_code = confirm_gcash_payment_received(
            conn,
            int(booking["id"]),
            acting_rider_id=int(rider_id) if rider_id else None,
            is_admin=is_admin,
            payment_ref=payment_ref,
            verified_offline_receipt=verified_offline_receipt,
        )
        if not ok:
            conn.rollback()
            return jsonify({"error": msg}), status_code
        conn.commit()
        updated_with_grp = attach_group_metadata(conn, updated)
        return jsonify({
            "success": True,
            "message": msg,
            "booking": updated_with_grp,
            "job": updated_with_grp,
        })

    @app.post("/api/bookings/<int:booking_id>/transfer")
    def transfer_job_booking(booking_id: int):
        rider_id = session.get("rider_id")
        is_admin = bool(session.get("is_admin"))
        if not rider_id and not is_admin:
            return jsonify({"error": "Rider authentication required."}), 401

        conn = get_db()
        data = request.get_json(silent=True) or {}

        raw_target = data.get("target_rider_id")
        target_rid: int | None = None
        if raw_target not in (None, "", 0, "0"):
            try:
                target_rid = int(raw_target)
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid target rider selected."}), 400

        reason = str(data.get("reason") or "").strip()
        note = str(data.get("note") or "").strip()
        new_pickup_lat = data.get("new_pickup_lat")
        new_pickup_lng = data.get("new_pickup_lng")
        go_offline = bool(data.get("go_offline", True))

        ok, res_or_err, updated_booking, status_code = transfer_booking(
            conn,
            booking_id,
            target_rider_id=target_rid,
            reason=reason,
            note=note,
            new_pickup_lat=new_pickup_lat,
            new_pickup_lng=new_pickup_lng,
            acting_rider_id=int(rider_id) if rider_id else None,
            is_admin=is_admin,
        )
        if not ok:
            conn.rollback()
            return jsonify({"error": res_or_err}), status_code

        resulting_is_online = None
        if rider_id and not is_admin:
            if go_offline:
                update_rider_online_status(conn, int(rider_id), False)
                resulting_is_online = 0
            else:
                acting_rider = get_rider_by_id(conn, int(rider_id))
                resulting_is_online = int(acting_rider.get("is_online") or 0) if acting_rider else 1

        conn.commit()
        if res_or_err == "direct" and updated_booking:
            msg = f"Trip transferred to {updated_booking.get('rider_name') or 'fellow rider'}!"
        else:
            msg = "Urgent re-broadcast sent to all online CCRC riders!"

        return jsonify({
            "success": True,
            "mode": res_or_err,
            "message": msg,
            "booking": updated_booking,
            "is_online": resulting_is_online,
        })

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
        summary = get_rider_transaction_summary(conn, r_id, now_pht_str)

        return jsonify({
            "success": True,
            "rider_id": r_id,
            "transactions": txns,
            "today_earnings": summary["today_earnings"],
            "all_time_earnings": summary["all_time_earnings"],
            "total_transactions": summary["total_transactions"],
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
                   COALESCE(tr.name, '') AS transferred_from_rider_name,
                   COALESCE(c.is_verified, 0) AS customer_verified
            FROM bookings b
            LEFT JOIN riders r ON r.id = b.rider_id
            LEFT JOIN riders tr ON tr.id = b.transferred_from_rider_id
            LEFT JOIN customers c ON b.customer_phone = c.phone
            ORDER BY b.id DESC
            LIMIT 50
            """
        ).fetchall()
        transactions = get_all_transactions(conn, limit=200)
        customers = get_all_customers(conn)
        fin_summary = get_financial_summary(conn)
        booking_counts = get_booking_summary_counts(conn)

        stats = {
            "total_bookings": booking_counts["total_bookings"],
            "completed": booking_counts["completed"],
            "active_now": booking_counts["active_now"],
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


    @app.post("/api/admin/reset-launch-data")
    def admin_reset_launch_data():
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required."}), 401

        payload = request.get_json(silent=True) or {}
        admin_pwd = (payload.get("admin_password") or "").strip()

        # Verify admin password for critical destructive operation
        conn = get_db()
        settings = get_settings(conn)
        stored_hash = settings.get("admin_password_hash") or ""
        if not stored_hash or not check_password_hash(stored_hash, admin_pwd):
            return jsonify({"error": "Incorrect admin password. Action aborted."}), 403

        wipe_riders = bool(payload.get("wipe_riders", True))
        wipe_customers = bool(payload.get("wipe_customers", True))
        wipe_bookings = bool(payload.get("wipe_bookings", True))

        try:
            result = reset_launch_data(
                conn,
                wipe_riders=wipe_riders,
                wipe_customers=wipe_customers,
                wipe_bookings=wipe_bookings,
            )
            conn.commit()
            return jsonify(result)
        except Exception as e:
            conn.rollback()
            return jsonify({"error": f"Reset failed: {str(e)}"}), 500


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
