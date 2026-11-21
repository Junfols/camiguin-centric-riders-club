"""
Flask Application for Camiguin Centric Riders Club (CCRC).
On-Demand Island Express Riders: Pahatud, Pakuha, Pasugo & Pabili.
"""

from __future__ import annotations

import base64
import html
import os
import secrets
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

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
    add_booking_message,
    get_booking_messages,
    accept_booking,
    accept_booking_for_group_slot,
    attach_group_metadata,
    build_booking_group_summary,
    calculate_fare,
    calculate_haversine_km,
    calculate_road_km,
    create_booking,
    create_booking_group,
    get_bookings_by_group_code,
    geocode_camiguin_location,
    get_available_broadcast_bookings,
    get_booking_by_code,
    get_booking_by_id,
    get_booking_tracking_trail,
    get_connection,
    get_online_riders,
    get_rider_live_statuses,
    get_rider_active_job,
    get_rider_scheduled_jobs,
    get_now_pht,
    get_rider_by_id,
    get_rider_by_phone,
    get_settings,
    normalize_ph_phone,
    get_uploaded_media,
    init_db,
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
    is_hinterland_route,
    create_call_session,
    respond_to_call,
    get_latest_call_state,
    add_call_signal,
    get_call_session,
    create_rider_call_session,
    respond_to_rider_call,
    get_latest_rider_call_state,
    add_rider_call_signal,
    get_rider_call_session,
)


_RATE_BUCKETS: dict[tuple[str, str], deque] = {}
_WEAK_ADMIN_PASSWORDS = ("admin1234", "admin")


def _bootstrap_security(app: Flask, conn) -> None:
    """Persisted random session key + make sure the admin password is never a known default."""
    if not app.secret_key:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
            ("_session_secret", secrets.token_hex(32)),
        )
        conn.commit()
        row = conn.execute("SELECT value FROM settings WHERE key = ?", ("_session_secret",)).fetchone()
        app.secret_key = row["value"]

    if app.config.get("TESTING"):
        return

    settings = get_settings(conn)
    current_hash = settings.get("admin_password_hash") or ""
    env_pwd = (os.environ.get("ADMIN_PASSWORD") or "").strip()

    def _matches(pwd: str) -> bool:
        try:
            return bool(current_hash) and check_password_hash(current_hash, pwd)
        except Exception:
            return False

    if env_pwd:
        if not _matches(env_pwd):
            update_settings(conn, {"admin_password_hash": generate_password_hash(env_pwd)})
            conn.commit()
    elif (not current_hash) or any(_matches(w) for w in _WEAK_ADMIN_PASSWORDS):
        new_pwd = secrets.token_urlsafe(12)
        update_settings(conn, {"admin_password_hash": generate_password_hash(new_pwd)})
        conn.commit()
        print("=" * 60)
        print("[CCRC SECURITY] Default admin password was replaced.")
        print(f"[CCRC SECURITY] NEW ADMIN PASSWORD: {new_pwd}")
        print("[CCRC SECURITY] Set ADMIN_PASSWORD in your environment to choose your own.")
        print("=" * 60)


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.secret_key = os.environ.get("SECRET_KEY") or None
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=bool(os.environ.get("RENDER")) or os.environ.get("SESSION_COOKIE_SECURE") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
        MAX_CONTENT_LENGTH=32 * 1024 * 1024,
    )
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

    with app.app_context():
        conn = get_db()
        init_db(conn)
        _bootstrap_security(app, conn)

    @app.after_request
    def set_security_headers(response: Response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), camera=(self), microphone=(self)"
        if request.is_secure or request.headers.get("X-Forwarded-Proto", "") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.before_request
    def make_session_permanent():
        session.permanent = True

    @app.before_request
    def csrf_origin_check():
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and not app.config.get("TESTING"):
            src = request.headers.get("Origin") or request.headers.get("Referer") or ""
            if src:
                host = urlparse(src).netloc.lower()
                if host and host != request.host.lower():
                    return jsonify({"error": "Cross-site request blocked."}), 403
        return None

    def _client_ip() -> str:
        xff = request.headers.get("X-Forwarded-For", "")
        return (xff.split(",")[0].strip() if xff else request.remote_addr) or "unknown"

    def _throttle(bucket: str, key: str, limit: int, window_sec: int):
        if app.config.get("TESTING") and not app.config.get("RATE_LIMIT_IN_TESTS"):
            return None
        now = time.time()
        dq = _RATE_BUCKETS.setdefault((bucket, key), deque())
        while dq and now - dq[0] > window_sec:
            dq.popleft()
        if len(dq) >= limit:
            return jsonify({"error": "Too many attempts. Please wait a few minutes and try again."}), 429
        dq.append(now)
        if len(_RATE_BUCKETS) > 20000:
            for k in list(_RATE_BUCKETS)[:5000]:
                _RATE_BUCKETS.pop(k, None)
        return None

    def _admin_ok() -> bool:
        return bool(session.get("is_admin")) and (time.time() - float(session.get("admin_ts") or 0)) < 12 * 3600

    def _rider_id_from_session():
        rid = session.get("rider_id")
        if rid:
            try:
                return int(rid)
            except (TypeError, ValueError):
                pass
        # Recover session seamlessly after server restart if valid active rider_id + phone provided
        req_rid = request.args.get("rider_id")
        req_phone = (request.args.get("rider_phone") or "").strip()
        if not req_rid and request.is_json:
            body = request.get_json(silent=True) or {}
            req_rid = body.get("rider_id")
            req_phone = (body.get("rider_phone") or "").strip()
        if req_rid and req_phone:
            try:
                cand = get_rider_by_id(get_db(), int(req_rid))
                if cand and cand.get("status") == "active" and normalize_ph_phone(cand.get("phone") or "") == normalize_ph_phone(req_phone):
                    session["rider_id"] = int(cand["id"])
                    return int(cand["id"])
            except Exception:
                pass
        return None

    def _is_booking_customer(booking: dict) -> bool:
        if not booking:
            return False
        phone = (session.get("customer_phone") or "").strip()
        if phone and normalize_ph_phone(phone) == normalize_ph_phone(booking.get("customer_phone") or ""):
            return True
        cust_id = session.get("customer_id")
        if cust_id:
            try:
                c_row = get_db().execute("SELECT phone FROM customers WHERE id = ?", (int(cust_id),)).fetchone()
                if c_row and normalize_ph_phone(c_row["phone"] or "") == normalize_ph_phone(booking.get("customer_phone") or ""):
                    return True
            except Exception:
                pass
        known_codes = {
            c.strip().upper()
            for c in (
                session.get("active_booking_code"),
                session.get("last_completed_code"),
            )
            if c and str(c).strip()
        }
        b_code = (booking.get("booking_code") or "").strip().upper()
        b_grp = (booking.get("group_code") or "").strip().upper()
        if b_code and b_code in known_codes:
            return True
        if b_grp and b_grp in known_codes:
            return True
        if known_codes:
            conn = get_db()
            for code in known_codes:
                ref = conn.execute(
                    "SELECT group_code, customer_phone, created_at FROM bookings WHERE UPPER(booking_code) = ? OR UPPER(group_code) = ? LIMIT 1",
                    (code, code),
                ).fetchone()
                if not ref:
                    continue
                ref_grp = (ref["group_code"] or "").strip().upper()
                if b_grp and ref_grp and b_grp == ref_grp:
                    return True
                if (
                    ref["customer_phone"]
                    and booking.get("customer_phone")
                    and ref["created_at"]
                    and booking.get("created_at")
                    and normalize_ph_phone(ref["customer_phone"]) == normalize_ph_phone(booking["customer_phone"])
                    and ref["created_at"] == booking["created_at"]
                ):
                    return True
        return False

    def _is_booking_participant(booking: dict) -> bool:
        if not booking:
            return False
        if _admin_ok():
            return True
        rid = _rider_id_from_session()
        if rid and booking.get("rider_id") == rid:
            return True
        return _is_booking_customer(booking)

    def _decode_image(data_url: str, max_bytes: int = 8 * 1024 * 1024):
        if not data_url or "," not in data_url:
            raise ValueError("Invalid image data.")
        b64str = data_url.split(",", 1)[1]
        if len(b64str) > int(max_bytes * 1.4):
            raise ValueError("Image file too large.")
        raw = base64.b64decode(b64str, validate=False)
        if len(raw) > max_bytes:
            raise ValueError("Image file too large.")
        if raw[:3] == b"\xff\xd8\xff":
            return raw, "image/jpeg", "jpg"
        if raw[:8] == b"\x89PNG\r\n\x1a\n":
            return raw, "image/png", "png"
        if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
            return raw, "image/webp", "webp"
        raise ValueError("Only JPG, PNG or WebP images are allowed.")

    @app.context_processor
    def inject_club_context():
        conn = get_db()
        settings = get_settings(conn)
        advisory_data = {
            "category": settings.get("advisory_category", "info"),
            "category_icon": settings.get("advisory_icon", "📢"),
            "category_label": settings.get("advisory_label", "Club Advisory"),
            "revision": int(settings.get("advisory_revision", 1) or 1),
            "show_customers": str(settings.get("advisory_show_customers", "0")).lower() in ("1", "true", "yes"),
            "show_riders": str(settings.get("advisory_show_riders", "0")).lower() in ("1", "true", "yes"),
            "message": settings.get("advisory_message", ""),
            "title": settings.get("advisory_title", "Camiguin Centric Advisory"),
            "updated_label": settings.get("advisory_updated_label", ""),
        }
        return {
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
            "club_advisory": advisory_data,
            "active_group_summary": None,
            "db_backend": getattr(conn, "backend", "sqlite"),
            "year": datetime.now().year,
        }

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
        sw_root_path = os.path.join(app.static_folder or "static", "sw.js")
        if os.path.isfile(sw_root_path):
            response = send_from_directory(app.static_folder or "static", "sw.js")
        else:
            response = send_from_directory(os.path.join(app.static_folder or "static", "js"), "sw.js")
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
        if mimetype not in ("image/jpeg", "image/png", "image/webp"):
            mimetype = "application/octet-stream"
        resp = Response(data, mimetype=mimetype)
        resp.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        resp.headers["Content-Disposition"] = "inline"
        return resp

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

        full_addr = f"{p_addr} {d_addr}".lower()
        hinterland_keywords = [
            # Mambajao Uplands & Steep Routes
            "phivolcs", "observatory", "volcano observatory", "quiboro", "quipasa",
            "ardent", "esperanza", "tagdo", "timogsay", "timugsay", "cogon", "sibato",
            "katobli", "kaolyong", "sorosoro", "sorosro", "soro'soro", "soro-soro", "soro soro",
            "highland", "utopia", "binunsaran", "nanaw", "granelandia", "itum", "volcano house",
            "km 11", "hibok-hibok", "hibok hibok", "katibawasan", "sa-ay", "sa ay", "saay",
            "upper pandan", "kanangkaan", "maubog", "pandayan", "litican", "upper balbagon",
            "tinago", "upper lakas", "upper anito", "upper magting", "benhaan", "macao",
            "bas-iao", "basiao", "upper yumbing", "upper naasag",
            # Catarman Uplands & Steep Routes
            "tuasan", "mainit", "santo nino", "santo niño", "sto. nino", "sto. niño", "sto nino", "sto niño",
            "manduao", "mandawa", "bura", "soda water", "liloan", "licoan",
            "vulcan", "walkway", "old volcano", "stations of the cross", "piyakong", "tres marias", "tresmarias",
            # Mahinog Uplands & Steep Routes
            "owakan", "puntod", "san isidro", "san miguel", "tubod", "tupsan pequeno", "tupsan pequeño",
            # Sagay Uplands & Steep Routes
            "binangawan", "mantalaga", "cuna", "cuña", "kital-is", "kitalis", "bacnit", "bugang", "bug-ang", "mayana", "upper sagay",
            # Guinsiliban Uplands & Steep Routes
            "butay", "cabuan", "upper cantaan", "ibabaw cantaan",
            # General Upland / Steep Terms
            "bukid", "mountain", "hinterland", "tungason", "upland", "steep"
        ]
        is_hinterland = (
            bool(data.get("is_hinterland", False))
            or any(k in full_addr for k in hinterland_keywords)
            or is_hinterland_route(p_addr, d_addr, "", p_lat, p_lng, d_lat, d_lng)
        )

        if (not p_lat or not p_lng) and p_addr:
            geo_p = geocode_camiguin_location(p_addr)
            if geo_p:
                p_lat, p_lng = geo_p["lat"], geo_p["lng"]

        if (not d_lat or not d_lng) and d_addr:
            geo_d = geocode_camiguin_location(d_addr)
            if geo_d:
                d_lat, d_lng = geo_d["lat"], geo_d["lng"]

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
            km = 1.5

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

    @app.get("/tours")
    def tours_page():
        conn = get_db()
        settings = get_settings(conn)
        return render_template(
            "tours.html",
            active_nav="tours",
            club=settings,
            packages=CAMIGUIN_TOUR_PACKAGES,
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

    @app.get("/rider/<int:rider_id>/id-card")
    def rider_id_card_view(rider_id: int):
        conn = get_db()
        rider = get_rider_by_id(conn, rider_id)
        if not rider:
            return "Wala makit-i ang rider account.", 404

        qr_code_svg = ""
        try:
            verify_url = f"{request.host_url.rstrip('/')}/verify/rider/{rider['id']}"
            qr_code_svg = render_qr_svg(verify_url, border=1)
        except Exception as e:
            print("QR render notice:", e)
            qr_code_svg = ""

        try:
            return render_template("id_card.html", rider=rider, qr_svg=qr_code_svg)
        except Exception:
            name = rider.get("name") or "CCRC Rider"
            plate = rider.get("plate_number") or "N/A"
            bike = rider.get("bike_model") or "Motorcycle"
            mun = rider.get("municipality") or "Mambajao"
            lic = rider.get("license_no") or "N/A"
            avatar = rider.get("avatar_url") or ""
            name, plate, bike, mun, lic = (html.escape(str(v), quote=True) for v in (name, plate, bike, mun, lic))
            avatar = html.escape(avatar, quote=True) if str(avatar).startswith("/media/") else ""
            photo_html = f'<img src="{avatar}" style="width:100%;height:100%;object-fit:cover;">' if avatar else '<span style="font-size:26pt;">👤</span>'

            return f"""<!DOCTYPE html>
<html lang="ceb">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CCRC ID - {name}</title>
  <style>
    body {{ background: #0b1120; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }}
    .btn {{ background: #f97316; color: #fff; border: none; padding: 10px 20px; border-radius: 999px; font-weight: bold; cursor: pointer; margin-bottom: 20px; }}
    .cards-wrap {{ display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }}
    .pvc-card {{ width: 85.6mm; height: 53.98mm; background: #fff; border-radius: 3.2mm; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; }}
    .front-head {{ background: #0f172a; color: #fff; padding: 5px 8px; display: flex; align-items: center; gap: 6px; border-bottom: 2.5px solid #f97316; }}
    .front-head img {{ width: 26px; height: 26px; border-radius: 50%; }}
    .front-head h1 {{ margin: 0; font-size: 7.8pt; font-weight: 900; color: #fff; }}
    .front-head p {{ margin: 0; font-size: 5pt; color: #f97316; font-weight: 700; }}
    .front-body {{ flex: 1; display: flex; padding: 6px 8px; gap: 8px; align-items: center; }}
    .photo-box {{ width: 24mm; height: 30mm; border: 1.5px solid #0f172a; border-radius: 2mm; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f1f5f9; flex-shrink: 0; }}
    .info-box {{ flex: 1; line-height: 1.25; }}
    .r-name {{ font-size: 9pt; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 3px; }}
    .row {{ font-size: 5.2pt; color: #64748b; margin-bottom: 1.5px; text-transform: uppercase; }}
    .row strong {{ color: #0f172a; font-size: 6.2pt; }}
    .front-foot {{ background: #0f172a; color: #94a3b8; font-size: 4.8pt; padding: 3px 8px; display: flex; justify-content: space-between; }}
    .qr-box {{ width: 26mm; height: 26mm; background: #fff; border: 1px solid #cbd5e1; border-radius: 2mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }}
    .qr-box svg {{ width: 100%; height: 100%; }}
    @media print {{ body {{ background: transparent; padding: 0; }} .btn {{ display: none; }} .pvc-card {{ box-shadow: none; border: 0.1mm solid #cbd5e1; }} }}
  </style>
</head>
<body>
  <button class="btn" onclick="window.print()">🖨️ Print PVC ID (Front &amp; Back)</button>
  <div class="cards-wrap">
    <div class="pvc-card">
      <div class="front-head">
        <img src="/static/icons/logo.png" onerror="this.src='/static/icons/icon-192.png'">
        <div>
          <h1>CAMIGUIN CENTRIC RIDERS CLUB</h1>
          <p>Verified Island Express Driver</p>
        </div>
      </div>
      <div class="front-body">
        <div class="photo-box">{photo_html}</div>
        <div class="info-box">
          <div class="r-name">{name}</div>
          <div class="row">ID No: <strong style="color:#ea580c;font-family:monospace;">CCRC-{rider['id']:04d}-R</strong></div>
          <div class="row">Motorcycle: <strong>{bike}</strong></div>
          <div class="row">Plate: <strong style="font-family:monospace;">{plate}</strong></div>
          <div class="row">License: <strong style="font-family:monospace;">{lic}</strong></div>
          <div class="row">Station: <strong>{mun}, Camiguin</strong></div>
        </div>
      </div>
      <div class="front-foot">
        <span>Hotline: 0917 555 0199</span>
        <span>ISSUED: 2026</span>
      </div>
    </div>
    <div class="pvc-card" style="padding: 10px; justify-content: space-between;">
      <div style="display:flex; gap:10px; align-items:center;">
        <div class="qr-box">{qr_code_svg}</div>
        <div>
          <h3 style="margin:0 0 4px; font-size:7pt; font-weight:900; color:#0f172a;">SCAN TO VERIFY</h3>
          <p style="margin:0; font-size:4.8pt; color:#475569; line-height:1.3;">Gamita ang camera sa selpon aron masubay ang official active verification status niining rider sa Camiguin.</p>
        </div>
      </div>
      <div style="border-top:1px dashed #cbd5e1; padding-top:4px; font-size:4.2pt; color:#64748b;">
        Kini nga kard gipanag-iya sa Camiguin Centric Riders Club. Non-transferable.
      </div>
    </div>
  </div>
</body>
</html>"""

    @app.get("/api/rider/<int:rider_id>/id-qr.svg")
    def api_rider_qr_svg(rider_id: int):
        conn = get_db()
        rider = get_rider_by_id(conn, rider_id)
        if not rider:
            return "Rider not found", 404

        verify_url = f"{request.host_url.rstrip('/')}/verify/rider/{rider['id']}"
        svg_content = render_qr_svg(verify_url, border=1)
        return Response(svg_content, mimetype="image/svg+xml")

    @app.get("/verify/rider/<int:rider_id>")
    def verify_rider_public_page(rider_id: int):
        conn = get_db()
        rider = get_rider_by_id(conn, rider_id)
        if not rider:
            return render_template("verify_rider.html", rider=None, error="Wala makit-i ang rider account."), 404

        raw_license = rider.get("license_no") or ""
        if len(raw_license) >= 6:
            masked_license = f"{raw_license[:3]}-••-•••{raw_license[-3:]}"
        else:
            masked_license = "VERIFIED-LIC"

        return render_template(
            "verify_rider.html",
            rider=rider,
            masked_license=masked_license,
            verify_time=get_now_pht().strftime("%B %d, %Y - %I:%M %p PHT"),
        )

    @app.get("/api/rider/id-card")
    def api_rider_id_card():
        rider_id = session.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401

        conn = get_db()
        rider = get_rider_by_id(conn, int(rider_id))
        if not rider:
            return jsonify({"error": "Rider not found"}), 404

        return jsonify({
            "success": True,
            "rider": {
                "id": rider["id"],
                "club_id_no": f"CCRC-{rider['id']:04d}",
                "name": rider["name"],
                "phone": rider["phone"],
                "bike_model": rider["bike_model"],
                "plate_number": rider["plate_number"],
                "license_no": rider.get("license_no", ""),
                "municipality": rider.get("municipality", "Mambajao"),
                "avatar_url": rider.get("avatar_url", ""),
                "status": rider.get("status", "active"),
                "rating_avg": rider.get("rating_avg", 5.0),
                "total_trips": rider.get("total_trips", 0),
                "created_at": rider.get("created_at", ""),
            }
        })

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
        code = (request.args.get("code") or session.get("active_booking_code") or "").strip()
        phone = (session.get("customer_phone") or "").strip()
        booking = None
        if code:
            booking = get_booking_by_code(conn, code)
        elif phone:
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

    @app.post("/api/customer/register")
    def api_customer_register():
        _lim = _throttle("cust-reg", _client_ip(), 10, 3600)
        if _lim:
            return _lim
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
            try:
                raw_bytes, mimetype, _ext = _decode_image(avatar_b64, 5 * 1024 * 1024)
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
        _lim = _throttle("cust-login", _client_ip(), 10, 900)
        if _lim:
            return _lim
        conn = get_db()
        data = request.get_json(silent=True) or {}
        identifier = (data.get("phone") or data.get("email") or data.get("identifier") or "").strip()
        password = (data.get("password") or "").strip()

        if not identifier or not password:
            return jsonify({"success": False, "error": "Palihug ibutang ang imong Phone Number o Email ug Password."}), 400

        _lim2 = _throttle("cust-login-id", identifier.lower(), 8, 900)
        if _lim2:
            return _lim2
        cust = authenticate_customer(conn, identifier, password)
        if not cust:
            return jsonify({"success": False, "error": "Incorrect phone number/email or password. Palihug susiha ang imong phone number/email ug password."}), 401

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
        _lim = _throttle("cust-forgot", _client_ip(), 5, 3600)
        if _lim:
            return _lim
        conn = get_db()
        data = request.get_json(silent=True) or {}
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip().lower()
        new_password = (data.get("new_password") or "").strip()

        if not phone:
            return jsonify({"success": False, "error": "Palihug ibutang ang imong rehistradong mobile phone number."}), 400
        if not email:
            return jsonify({"success": False, "error": "Palihug ibutang ang imong rehistradong email address para sa verification."}), 400
        if not new_password or len(new_password) < 6:
            return jsonify({"success": False, "error": "Ang bag-ong password kinahanglan labing menos 6 ka characters."}), 400

        cust = get_customer_by_phone(conn, phone)
        if not cust:
            return jsonify({"success": False, "error": "Wala makit-i ang customer account alang niining numero."}), 404

        cust_email = (cust.get("email") or "").strip().lower()
        name_input = (data.get("name") or "").strip().lower()
        cust_name = (cust.get("name") or "").strip().lower()

        matches = False
        if cust_email and cust_email == email:
            matches = True
        elif not cust_email:
            if name_input and name_input == cust_name:
                matches = True
            elif "@" in email:
                matches = True
                try:
                    conn.execute("UPDATE customers SET email = ? WHERE id = ?", (email, cust["id"]))
                except Exception:
                    pass

        if not matches:
            return jsonify({
                "success": False,
                "error": "Wala motukma ang Email Address alang niining account. Palihug susiha o kontaka ang Admin."
            }), 400

        pwd_hash = generate_password_hash(new_password)
        update_customer_password(conn, cust["id"], pwd_hash)
        return jsonify({
            "success": True,
            "message": "Malampusong na-reset ang imong passenger password! Pwede na ka mag-login."
        })

    @app.get("/api/customer/me")
    def api_customer_me():
        conn = get_db()
        phone = (session.get("customer_phone") or "").strip()
        if not phone:
            return jsonify({"logged_in": False, "customer": None})
        cust = get_customer_by_phone(conn, phone)
        if not cust:
            return jsonify({"logged_in": False, "customer": None})
        cust = {k: v for k, v in cust.items() if k != "password_hash"}
        return jsonify({"logged_in": True, "customer": cust})

    @app.get("/api/customer/history/<phone>")
    def api_customer_history(phone: str):
        conn = get_db()
        clean_p = phone.strip()
        _sess_phone = (session.get("customer_phone") or "").strip()
        _own = False
        if _sess_phone:
            if normalize_ph_phone(_sess_phone) == normalize_ph_phone(clean_p):
                _own = True
            else:
                _c = get_customer_by_phone(conn, clean_p)
                _own = bool(_c and session.get("customer_id") and _c.get("id") == session.get("customer_id"))
        if not _admin_ok() and not _own:
            return jsonify({"success": False, "error": "Please log in to view your ride history.", "rides": [], "history": [], "total_rides": 0}), 403
        customer = get_customer_by_phone(conn, clean_p)
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

        def _resolve_slot_booking(b_id: int | None, r_id: int) -> dict[str, Any] | None:
            bk = get_booking_by_id(conn, b_id) if b_id else None
            if not bk:
                return None
            if bk.get("rider_id") == r_id:
                return bk
            grp_code = (bk.get("group_code") or "").strip().upper()
            if grp_code:
                sib = conn.execute(
                    "SELECT * FROM bookings WHERE UPPER(group_code) = ? AND rider_id = ? ORDER BY id ASC LIMIT 1",
                    (grp_code, r_id),
                ).fetchone()
                if sib:
                    return dict(sib)
            if bk.get("customer_phone") and bk.get("created_at"):
                sib = conn.execute(
                    "SELECT * FROM bookings WHERE customer_phone = ? AND created_at = ? AND rider_id = ? ORDER BY id ASC LIMIT 1",
                    (bk["customer_phone"], bk["created_at"], r_id),
                ).fetchone()
                if sib:
                    return dict(sib)
            return bk

        # Multi-rider batch mode: {"reviews": [{"booking_id": ..., "rider_id": ..., "rating": ..., "comment": ...}, ...]}
        if isinstance(data.get("reviews"), list):
            items = data.get("reviews") or []
            if not items:
                return jsonify({"error": "At least one rider rating is required."}), 400

            default_customer_name = (data.get("customer_name") or "Passenger").strip()
            default_booking_id = data.get("booking_id")
            saved_reviews: list[dict[str, Any]] = []
            already_reviewed_count = 0
            unauthorized_count = 0
            invalid_count = 0

            for item in items:
                if not isinstance(item, dict):
                    invalid_count += 1
                    continue
                raw_rid = item.get("rider_id")
                raw_rating = item.get("rating")
                raw_bid = item.get("booking_id") or default_booking_id
                if not raw_rid or not raw_rating:
                    invalid_count += 1
                    continue
                try:
                    b_id = int(raw_bid) if raw_bid else None
                    r_id = int(raw_rid)
                    rating_val = int(raw_rating)
                except (ValueError, TypeError):
                    invalid_count += 1
                    continue

                bk = _resolve_slot_booking(b_id, r_id)
                if not bk or bk.get("rider_id") != r_id or bk.get("status") != "completed":
                    invalid_count += 1
                    continue
                if not _is_booking_customer(bk):
                    unauthorized_count += 1
                    continue

                slot_bid = int(bk["id"])
                if conn.execute(
                    "SELECT 1 FROM reviews WHERE booking_id = ? AND rider_id = ?",
                    (slot_bid, r_id),
                ).fetchone():
                    already_reviewed_count += 1
                    continue

                c_name = (item.get("customer_name") or default_customer_name or "Passenger").strip()[:80]
                c_text = (item.get("comment") or "").strip()[:500]
                rating_val = max(1, min(5, rating_val))
                rev = create_review(conn, slot_bid, r_id, c_name, rating_val, c_text)
                if rev:
                    saved_reviews.append(rev)

            if saved_reviews:
                return jsonify({
                    "success": True,
                    "review": saved_reviews[0],
                    "reviews": saved_reviews,
                    "saved_count": len(saved_reviews),
                    "already_reviewed_count": already_reviewed_count,
                }), 201
            if already_reviewed_count > 0:
                return jsonify({"error": "All selected riders were already reviewed.", "already_reviewed": True}), 409
            if unauthorized_count > 0:
                return jsonify({"error": "Only the passenger of this trip can review it."}), 403
            return jsonify({"error": "You can only review completed trips."}), 403

        # Single-rider mode (backward compatible)
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

        booking = _resolve_slot_booking(booking_id, rider_id) if booking_id else None
        if not booking or booking.get("rider_id") != rider_id or booking.get("status") != "completed":
            return jsonify({"error": "You can only review a completed trip."}), 403
        if not _is_booking_customer(booking):
            return jsonify({"error": "Only the passenger of this trip can review it."}), 403
        slot_booking_id = int(booking["id"])
        if conn.execute(
            "SELECT 1 FROM reviews WHERE booking_id = ? AND rider_id = ?",
            (slot_booking_id, rider_id),
        ).fetchone():
            return jsonify({"error": "This trip was already reviewed."}), 409
        rating = max(1, min(5, rating))
        comment = comment[:500]
        customer_name = customer_name[:80]
        review = create_review(conn, slot_booking_id, rider_id, customer_name, rating, comment)
        return jsonify({"success": True, "review": review, "reviews": [review], "saved_count": 1}), 201

    @app.get("/api/reviews/<int:rider_id>")
    def api_get_rider_reviews(rider_id: int):
        conn = get_db()
        reviews = get_rider_reviews(conn, rider_id)
        return jsonify({"success": True, "reviews": reviews})

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
        _lim = _throttle("booking-create", _client_ip(), 20, 3600)
        if _lim:
            return _lim
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

        is_large_store = bool(data.get("is_large_store", False))
        extra_stores_count = int(data.get("extra_stores_count") or 0)
        is_bulky = bool(data.get("is_bulky_or_high_value", False)) or (estimated_budget >= 2000.0)

        full_addr = f"{pickup_address} {dropoff_address} {item_notes}".lower()
        hinterland_keywords = [
            # Mambajao Uplands & Steep Routes
            "phivolcs", "observatory", "volcano observatory", "quiboro", "quipasa",
            "ardent", "esperanza", "tagdo", "timogsay", "timugsay", "cogon", "sibato",
            "katobli", "kaolyong", "sorosoro", "sorosro", "soro'soro", "soro-soro", "soro soro",
            "highland", "utopia", "binunsaran", "nanaw", "granelandia", "itum", "volcano house",
            "km 11", "hibok-hibok", "hibok hibok", "katibawasan", "sa-ay", "sa ay", "saay",
            "upper pandan", "kanangkaan", "maubog", "pandayan", "litican", "upper balbagon",
            "tinago", "upper lakas", "upper anito", "upper magting", "benhaan", "macao",
            "bas-iao", "basiao", "upper yumbing", "upper naasag",
            # Catarman Uplands & Steep Routes
            "tuasan", "mainit", "santo nino", "santo niño", "sto. nino", "sto. niño", "sto nino", "sto niño",
            "manduao", "mandawa", "bura", "soda water", "liloan", "licoan",
            "vulcan", "walkway", "old volcano", "stations of the cross", "piyakong", "tres marias", "tresmarias",
            # Mahinog Uplands & Steep Routes
            "owakan", "puntod", "san isidro", "san miguel", "tubod", "tupsan pequeno", "tupsan pequeño",
            # Sagay Uplands & Steep Routes
            "binangawan", "mantalaga", "cuna", "cuña", "kital-is", "kitalis", "bacnit", "bugang", "bug-ang", "mayana", "upper sagay",
            # Guinsiliban Uplands & Steep Routes
            "butay", "cabuan", "upper cantaan", "ibabaw cantaan",
            # General Upland / Steep Terms
            "bukid", "mountain", "hinterland", "tungason", "upland", "steep"
        ]
        is_hinterland = (
            bool(data.get("is_hinterland", False))
            or any(k in full_addr for k in hinterland_keywords)
            or is_hinterland_route(pickup_address, dropoff_address, item_notes, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        )

        if is_hinterland and "hinterland" not in item_notes.lower() and "bukid" not in item_notes.lower():
            tag = "[🏔️ Hinterland / Bukid Route +₱30]"
            item_notes = f"{tag} {item_notes}".strip()

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
            if promo_res["valid"]:
                discount_amount = promo_res["discount_amount"]
                fare_amount = promo_res["new_fare"]
                apply_promo_code(conn, promo_code)

        customer_password = (data.get("customer_password") or "").strip()
        customer_barangay = (data.get("customer_barangay") or "").strip()
        is_authenticated = bool(session.get("customer_phone") and session.get("customer_phone") == customer_phone)

        if not app.config.get("TESTING") and not is_authenticated and not customer_password:
            return jsonify({
                "error": "Kinahanglan mo-Sign In o mag-Register una aron ma-verify ang imong account sa dili pa mo-broadcast sa mga riders."
            }), 401

        if customer_password or customer_barangay:
            try:
                cust = register_customer(conn, customer_name, customer_phone, customer_password, customer_barangay)
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

        try:
            riders_count = max(1, min(10, int(data.get("riders_count") or data.get("group_size") or 1)))
        except (ValueError, TypeError):
            riders_count = 1

        group_code, created_bookings = create_booking_group(
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
            per_rider_fare=fare_amount,
            estimated_km=estimated_km,
            payment_method=payment_method,
            scheduled_at=scheduled_at,
            promo_code=promo_code,
            total_discount=discount_amount,
            riders_count=riders_count,
        )
        conn.commit()

        booking = attach_group_metadata(conn, created_bookings[0]) if created_bookings else None
        group_summary = build_booking_group_summary(created_bookings) if len(created_bookings) > 1 else None

        if booking:
            session["active_booking_code"] = booking["booking_code"]
            session["customer_phone"] = booking["customer_phone"]
            session["customer_name"] = booking["customer_name"]

        msg_text = (
            f"Your group booking for {riders_count} riders ({group_code}) has been broadcasted to all active riders!"
            if riders_count > 1
            else "Your booking has been broadcasted to all active riders!"
        )

        return jsonify({
            "success": True,
            "message": msg_text,
            "booking": booking,
            "bookings": created_bookings,
            "group_code": group_code,
            "group_summary": group_summary,
            "riders_count": riders_count,
            "breakdown": breakdown,
            "tracking_url": f"/track/{booking['booking_code']}" if booking else "/",
        }), 201

    # -------------------------------------------------------------------------
    # In-App Chat Routes
    # -------------------------------------------------------------------------
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
        if code_or_id.isdigit() and not _is_booking_participant(booking):
            return jsonify({"error": "Not allowed."}), 403

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

        if code_or_id.isdigit() and not _is_booking_participant(booking):
            return jsonify({"error": "Not allowed."}), 403
        limited = _throttle("chat", _client_ip(), 120, 600)
        if limited:
            return limited
        data = request.get_json(silent=True) or {}
        text = (data.get("message") or "").strip()[:2000]
        if not text:
            return jsonify({"error": "Message cannot be empty."}), 400

        _rid = _rider_id_from_session()
        sender_role = "rider" if (_rid and booking.get("rider_id") == _rid) else "customer"

        sender_name = (data.get("sender_name") or "").strip()
        if not sender_name:
            sender_name = "Kuya Rider" if sender_role == "rider" else booking["customer_name"]

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
    # In-App Free Voice Call (WebRTC Signaling Endpoints)
    # -------------------------------------------------------------------------
    def _get_rtc_ice_servers() -> list[dict[str, Any]]:
        servers: list[dict[str, Any]] = [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},
            {"urls": "stun:stun.cloudflare.com:3478"},
        ]
        turn_url = (os.environ.get("TURN_URL") or "").strip()
        if turn_url:
            entry: dict[str, Any] = {"urls": [u.strip() for u in turn_url.split(",") if u.strip()]}
            turn_user = (os.environ.get("TURN_USERNAME") or "").strip()
            turn_cred = (os.environ.get("TURN_CREDENTIAL") or "").strip()
            if turn_user:
                entry["username"] = turn_user
            if turn_cred:
                entry["credential"] = turn_cred
            servers.append(entry)
        return servers

    def _resolve_booking_for_call(code_or_id: str) -> dict[str, Any] | None:
        conn = get_db()
        booking = get_booking_by_id(conn, int(code_or_id)) if code_or_id.isdigit() else None
        if not booking:
            booking = get_booking_by_code(conn, code_or_id)
        return booking

    def _call_actor_role(booking: dict[str, Any]) -> str | None:
        rid = _rider_id_from_session()
        if rid and booking.get("rider_id") == rid:
            return "rider"
        if _is_booking_customer(booking):
            return "customer"
        if _admin_ok():
            return "customer"
        return None

    @app.get("/api/rtc/ice-config")
    def api_rtc_ice_config():
        return jsonify({"success": True, "ice_servers": _get_rtc_ice_servers()})

    @app.post("/api/calls/<code_or_id>/start")
    def api_start_booking_call(code_or_id: str):
        booking = _resolve_booking_for_call(code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404
        role = _call_actor_role(booking)
        if not role:
            return jsonify({"error": "Not authorized for this trip."}), 403

        data = request.get_json(silent=True) or {}
        caller_name = booking.get("rider_name") if role == "rider" else booking.get("customer_name")
        conn = get_db()
        ok, msg, call_obj, status_code = create_call_session(
            conn=conn,
            booking=booking,
            caller_role=role,
            caller_name=caller_name or "CCRC Member",
            offer_data=data.get("offer"),
        )
        conn.commit()
        if not ok:
            return jsonify({"success": False, "error": msg, "call": call_obj}), status_code
        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        }), status_code

    @app.get("/api/calls/<code_or_id>/state")
    def api_get_booking_call_state(code_or_id: str):
        booking = _resolve_booking_for_call(code_or_id)
        if not booking:
            return jsonify({"error": "Booking not found."}), 404
        role = _call_actor_role(booking)
        if not role:
            return jsonify({"error": "Not authorized for this trip."}), 403

        active_call_id = request.args.get("call_id", type=int)
        after_sig = request.args.get("after_signal_id", default=0, type=int)
        conn = get_db()
        call_obj, signals = get_latest_call_state(
            conn=conn,
            booking_id=int(booking["id"]),
            active_call_id=active_call_id,
            after_signal_id=after_sig,
        )
        conn.commit()
        peer_name = booking.get("rider_name") if role == "customer" else booking.get("customer_name")
        peer_phone = booking.get("rider_phone") if role == "customer" else booking.get("customer_phone")
        return jsonify({
            "success": True,
            "call": call_obj,
            "signals": signals,
            "peer_name": peer_name or "CCRC Member",
            "peer_phone": peer_phone or "",
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/calls/session/<int:call_id>/respond")
    def api_respond_booking_call(call_id: int):
        conn = get_db()
        call = get_call_session(conn, call_id)
        if not call:
            return jsonify({"error": "Call session not found."}), 404
        booking = get_booking_by_id(conn, int(call["booking_id"]))
        if not booking:
            return jsonify({"error": "Booking not found."}), 404
        role = _call_actor_role(booking)
        if not role:
            return jsonify({"error": "Unauthorized."}), 403

        data = request.get_json(silent=True) or {}
        ok, msg, updated_call, status_code = respond_to_call(
            conn=conn,
            call_id=call_id,
            actor_role=role,
            action=data.get("action") or "",
            answer_data=data.get("answer"),
            reason=data.get("reason") or "",
        )
        conn.commit()
        if not ok:
            return jsonify({"success": False, "error": msg, "call": updated_call}), status_code
        return jsonify({"success": True, "message": msg, "call": updated_call}), status_code

    @app.post("/api/calls/session/<int:call_id>/signal")
    def api_signal_booking_call(call_id: int):
        conn = get_db()
        call = get_call_session(conn, call_id)
        if not call:
            return jsonify({"error": "Call session not found."}), 404
        booking = get_booking_by_id(conn, int(call["booking_id"]))
        if not booking:
            return jsonify({"error": "Booking not found."}), 404
        role = _call_actor_role(booking)
        if not role:
            return jsonify({"error": "Unauthorized."}), 403

        data = request.get_json(silent=True) or {}
        candidates = data.get("candidates") or []
        if isinstance(candidates, list):
            for cand in candidates[:30]:
                add_call_signal(conn, call_id, int(booking["id"]), role, "candidate", cand)
        elif data.get("candidate"):
            add_call_signal(conn, call_id, int(booking["id"]), role, "candidate", data.get("candidate"))
        conn.commit()
        return jsonify({"success": True})

    # Rider-to-Rider Free In-App Call Routes
    @app.post("/api/rider/calls/<int:target_rider_id>/start")
    def api_start_rider_call(target_rider_id: int):
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401
        data = request.get_json(silent=True) or {}
        conn = get_db()
        ok, msg, call_obj, status_code = create_rider_call_session(
            conn=conn,
            caller_rider_id=rider_id,
            target_rider_id=target_rider_id,
            offer_data=data.get("offer"),
        )
        conn.commit()
        if call_obj:
            call_obj["caller_role"] = f"rider:{call_obj['caller_rider_id']}"
            call_obj["callee_role"] = f"rider:{call_obj['callee_rider_id']}"
            call_obj["call_kind"] = "rider_to_rider"
        if not ok:
            return jsonify({"success": False, "error": msg, "call": call_obj}), status_code
        return jsonify({
            "success": True,
            "message": msg,
            "call": call_obj,
            "ice_servers": _get_rtc_ice_servers(),
        }), status_code

    @app.get("/api/rider/calls/state")
    def api_get_rider_call_state():
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401
        active_call_id = request.args.get("call_id", type=int)
        after_sig = request.args.get("after_signal_id", default=0, type=int)
        conn = get_db()
        call_obj, signals = get_latest_rider_call_state(
            conn=conn,
            rider_id=rider_id,
            active_call_id=active_call_id,
            after_signal_id=after_sig,
        )
        conn.commit()
        peer_name = ""
        peer_phone = ""
        if call_obj:
            call_obj["caller_role"] = f"rider:{call_obj['caller_rider_id']}"
            call_obj["callee_role"] = f"rider:{call_obj['callee_rider_id']}"
            for s in signals:
                s["sender_role"] = f"rider:{s['sender_rider_id']}"
            is_caller = int(call_obj["caller_rider_id"]) == int(rider_id)
            peer_name = call_obj["callee_name"] if is_caller else call_obj["caller_name"]
            peer_phone = call_obj.get("callee_phone", "") if is_caller else call_obj.get("caller_phone", "")

        return jsonify({
            "success": True,
            "viewer_role": f"rider:{rider_id}",
            "call": call_obj,
            "signals": signals,
            "peer_name": peer_name,
            "peer_phone": peer_phone,
            "ice_servers": _get_rtc_ice_servers(),
        })

    @app.post("/api/rider/calls/session/<int:call_id>/respond")
    def api_respond_rider_call(call_id: int):
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401
        data = request.get_json(silent=True) or {}
        conn = get_db()
        ok, msg, updated_call, status_code = respond_to_rider_call(
            conn=conn,
            call_id=call_id,
            acting_rider_id=rider_id,
            action=data.get("action") or "",
            answer_data=data.get("answer"),
            reason=data.get("reason") or "",
        )
        conn.commit()
        if updated_call:
            updated_call["caller_role"] = f"rider:{updated_call['caller_rider_id']}"
            updated_call["callee_role"] = f"rider:{updated_call['callee_rider_id']}"
            updated_call["call_kind"] = "rider_to_rider"
        if not ok:
            return jsonify({"success": False, "error": msg, "call": updated_call}), status_code
        return jsonify({"success": True, "message": msg, "call": updated_call}), status_code

    @app.post("/api/rider/calls/session/<int:call_id>/signal")
    def api_signal_rider_call(call_id: int):
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Rider login required."}), 401
        conn = get_db()
        call = get_rider_call_session(conn, call_id)
        if not call or int(rider_id) not in (int(call["caller_rider_id"]), int(call["callee_rider_id"])):
            return jsonify({"error": "Unauthorized."}), 403

        data = request.get_json(silent=True) or {}
        candidates = data.get("candidates") or []
        if isinstance(candidates, list):
            for cand in candidates[:30]:
                add_rider_call_signal(conn, call_id, rider_id, "candidate", cand)
        elif data.get("candidate"):
            add_rider_call_signal(conn, call_id, rider_id, "candidate", data.get("candidate"))
        conn.commit()
        return jsonify({"success": True})

    # -------------------------------------------------------------------------
    # Live Tracking Routes
    # -------------------------------------------------------------------------
    @app.get("/track/<booking_code>")
    def track_view(booking_code: str):
        conn = get_db()
        booking = get_booking_by_code(conn, booking_code)
        if not booking:
            grp_list = get_bookings_by_group_code(conn, booking_code)
            if grp_list:
                req_slot = (request.args.get("slot") or "").strip().upper()
                booking = next((gb for gb in grp_list if (gb.get("booking_code") or "").upper() == req_slot), grp_list[0])
        if not booking:
            return render_template("track.html", booking=None, error="Booking not found."), 404
        if booking.get("status") in ("broadcast", "accepted", "in_progress"):
            session["active_booking_code"] = booking["booking_code"]
        else:
            if booking.get("status") == "completed":
                session["last_completed_code"] = booking["booking_code"]
            if session.get("active_booking_code") == booking["booking_code"]:
                session.pop("active_booking_code", None)
        return render_template("track.html", booking=booking, active_nav="track")

    @app.get("/api/bookings/track/<booking_code>")
    def api_track_booking(booking_code: str):
        conn = get_db()
        booking = get_booking_by_code(conn, booking_code)
        if not booking:
            grp_list = get_bookings_by_group_code(conn, booking_code)
            if grp_list:
                booking = grp_list[0]
        if not booking:
            return jsonify({"error": "Booking not found."}), 404

        trail = []
        if booking.get("id"):
            trail = get_booking_tracking_trail(conn, booking["id"], limit=20)

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

        attach_group_metadata(conn, booking)
        grp_code = (booking.get("group_code") or "").strip().upper()
        group_bookings = get_bookings_by_group_code(conn, grp_code) if grp_code else []
        if len(group_bookings) <= 1 and booking.get("customer_phone") and booking.get("created_at"):
            sib_rows = conn.execute(
                """
                SELECT b.*,
                       r.name AS rider_name, r.phone AS rider_phone, r.bike_model AS rider_bike,
                       r.plate_number AS rider_plate, r.color AS rider_color, r.last_lat AS rider_lat,
                       r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
                       r.avatar_url AS rider_avatar, r.license_no AS rider_license,
                       COALESCE(r.gcash_number, '') AS rider_gcash_number,
                       COALESCE(r.gcash_qr_url, '') AS rider_gcash_qr
                FROM bookings b
                LEFT JOIN riders r ON r.id = b.rider_id
                WHERE b.customer_phone = ? AND b.created_at = ?
                  AND b.status IN ('broadcast', 'accepted', 'in_progress', 'completed')
                ORDER BY b.id ASC
                """,
                (booking["customer_phone"], booking["created_at"]),
            ).fetchall()
            if len(sib_rows) > 1:
                group_bookings = [dict(sr) for sr in sib_rows]
                for idx_s, sb in enumerate(group_bookings, start=1):
                    sb["rider_slot"] = sb.get("rider_slot") or idx_s
                    sb["group_size"] = len(group_bookings)
        group_summary = build_booking_group_summary(group_bookings) if len(group_bookings) > 1 else None

        # Preserve review authorization when booking completes while tracking page stays open
        any_completed = booking.get("status") == "completed" or any(
            gb.get("status") == "completed" for gb in group_bookings
        )
        if any_completed and session.get("active_booking_code") in (
            booking.get("booking_code"),
            booking.get("group_code"),
        ):
            session["last_completed_code"] = booking["booking_code"]

        # Attach per-slot review state so customer UI knows which riders are already rated
        review_booking_ids = sorted({
            int(x["id"])
            for x in ([booking] + list(group_bookings))
            if x and x.get("id")
        })
        reviewed_map: dict[int, int] = {}
        if review_booking_ids:
            placeholders = ", ".join(["?"] * len(review_booking_ids))
            rev_rows = conn.execute(
                f"SELECT booking_id, rating FROM reviews WHERE booking_id IN ({placeholders})",
                tuple(review_booking_ids),
            ).fetchall()
            for rr in rev_rows:
                if rr["booking_id"] is not None:
                    reviewed_map[int(rr["booking_id"])] = int(rr["rating"] or 5)

        if booking.get("id"):
            b_id_int = int(booking["id"])
            booking["is_reviewed"] = b_id_int in reviewed_map
            booking["review_rating"] = reviewed_map.get(b_id_int)
        for gb in group_bookings:
            gb_id = int(gb["id"]) if gb.get("id") else None
            gb["is_reviewed"] = bool(gb_id and gb_id in reviewed_map)
            gb["review_rating"] = reviewed_map.get(gb_id) if gb_id else None

        if not _is_booking_participant(booking):
            booking = {k: v for k, v in booking.items() if k not in ("customer_phone",)}
            group_bookings = [
                {k: v for k, v in gb.items() if k not in ("customer_phone",)}
                for gb in group_bookings
            ]

        return jsonify({
            "booking": booking,
            "group_bookings": group_bookings,
            "group_summary": group_summary,
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
            try:
                conn = get_db()
                update_rider_online_status(conn, int(rider_id), False)
                conn.commit()
            except Exception as e:
                print("Error updating rider offline status on logout:", e)
        return jsonify({"success": True})

    @app.post("/api/rider/login")
    def rider_login():
        _lim = _throttle("rider-login", _client_ip(), 10, 900)
        if _lim:
            return _lim
        conn = get_db()
        data = request.get_json(silent=True) or {}
        identifier = (data.get("phone") or data.get("email") or data.get("identifier") or "").strip()
        password = (data.get("password") or "").strip()

        if not identifier or not password:
            return jsonify({"error": "Palihug ibutang ang imong Mobile Phone Number o Email ug Password."}), 400

        _lim2 = _throttle("rider-login-id", identifier.lower(), 8, 900)
        if _lim2:
            return _lim2
        rider = get_rider_by_phone(conn, identifier)
        if not rider:
            return jsonify({"error": "Wala makit-i ang rider account nga adunay maong Phone Number o Email. Palihug pagsusi o pag-register."}), 404

        if not check_password_hash(rider["password_hash"], password):
            return jsonify({"error": "Incorrect password. Sayop ang imong password."}), 401

        status = (rider.get("status") or "").lower()
        if status == "pending":
            return jsonify({
                "error": "Ang imong account anaa pa sa PENDING APPROVAL. Palihug bisitaha ang CCRC Club Admin sa personal dala ang imong Driver's License, OR/CR, ug motorsiklo aron ma-inspeksyon, ma-verify ug ma-activate ang imong account.",
                "pending": True,
            }), 403

        if status in ("suspended", "rejected"):
            return jsonify({
                "error": "Ang imong account nasuspenso o gibalibaran sa Club Admin. Palihug pakigkita sa CCRC Admin.",
                "suspended": True,
            }), 403

        session["rider_id"] = rider["id"]
        update_rider_online_status(conn, rider["id"], True)
        conn.commit()

        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
        clean_rider["is_online"] = 1
        return jsonify({"success": True, "rider": clean_rider})

    @app.post("/api/rider/forgot-password")
    def rider_forgot_password():
        _lim = _throttle("rider-forgot", _client_ip(), 5, 3600)
        if _lim:
            return _lim
        conn = get_db()
        data = request.get_json(silent=True) or {}
        phone = (data.get("phone") or "").strip()
        identifier = (data.get("identifier") or "").strip()
        new_password = (data.get("new_password") or "").strip()

        if not phone:
            return jsonify({"success": False, "error": "Palihug ibutang ang imong rehistradong mobile phone number."}), 400
        if not identifier:
            return jsonify({"success": False, "error": "Palihug ibutang ang imong Plate Number o Driver's License Number para sa verification."}), 400
        if not new_password or len(new_password) < 6:
            return jsonify({"success": False, "error": "Ang bag-ong password kinahanglan labing menos 6 ka characters."}), 400

        rider = get_rider_by_phone(conn, phone)
        if not rider:
            return jsonify({"success": False, "error": "Wala makit-i ang rider account alang niining numero."}), 404

        clean_input = identifier.replace(" ", "").replace("-", "").upper()
        clean_plate = (rider.get("plate_number") or "").replace(" ", "").replace("-", "").upper()
        clean_license = (rider.get("license_no") or "").replace(" ", "").replace("-", "").upper()

        if clean_input != clean_plate and clean_input != clean_license:
            return jsonify({
                "success": False,
                "error": "Wala motukma ang Plate Number o Driver's License Number alang niining account. Palihug susiha o kontaka ang Admin."
            }), 400

        pwd_hash = generate_password_hash(new_password)
        update_rider_password(conn, rider["id"], pwd_hash)
        return jsonify({
            "success": True,
            "message": "Malampusong na-reset ang imong rider password! Pwede na ka mag-login."
        })

    @app.post("/api/rider/register")
    def rider_register():
        _lim = _throttle("rider-reg", _client_ip(), 10, 3600)
        if _lim:
            return _lim
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

        avatar_url = ""
        if avatar_b64 and "," in avatar_b64:
            try:
                raw_bytes, mimetype, _ext = _decode_image(avatar_b64, 5 * 1024 * 1024)
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
            "message": f"✅ Malampusong napasa ang imong Rider Application, {name}! Ang imong account anaa pa sa PENDING APPROVAL. Palihug bisitaha ang CCRC Club Admin sa personal dala ang imong Driver's License, OR/CR, ug motor aron ma-inspeksyon, ma-verify ug ma-activate ang imong account."
        }), 201

    @app.get("/api/rider/co-riders")
    def get_rider_co_riders():
        conn = get_db()
        riders = get_online_riders(conn)
        live_statuses = get_rider_live_statuses(conn, recent_completed_minutes=15)
        current_rider_id = _rider_id_from_session()
        if not current_rider_id:
            q_rid = request.args.get("rider_id", type=int)
            if q_rid and get_rider_by_id(conn, q_rid):
                current_rider_id = q_rid

        status_label_map = {
            "accepted": "Accepted Booking",
            "in_progress": "In Transit",
            "completed": "Completed • Available",
            "available": "Available",
        }
        status_counts = {
            "available": 0,
            "completed": 0,
            "accepted": 0,
            "in_progress": 0,
        }
        clean_list = []
        for r in riders:
            st_info = live_statuses.get(int(r["id"]), {
                "has_active_job": False,
                "has_scheduled_job": False,
                "work_status": "available",
                "work_status_label": "Available",
                "trip_status": "available",
                "last_completed_at": None,
            })
            trip_status = st_info.get("trip_status", "available")
            if trip_status not in status_label_map:
                trip_status = "available"
            has_active_job = bool(st_info.get("has_active_job"))
            is_available = not has_active_job
            status_counts[trip_status] = status_counts.get(trip_status, 0) + 1

            clean_list.append({
                "id": r["id"],
                "name": r["name"],
                "phone": r["phone"],
                "bike_model": r["bike_model"],
                "plate_number": r["plate_number"],
                "municipality": r.get("municipality") or "Mambajao",
                "avatar_url": r.get("avatar_url") or "",
                "license_no": r.get("license_no") or "",
                "rating_avg": r.get("rating_avg") or 5.0,
                "last_lat": r.get("last_lat"),
                "last_lng": r.get("last_lng"),
                "last_active_at": r.get("last_active_at"),
                "is_self": bool(current_rider_id and int(r["id"]) == int(current_rider_id)),
                "has_active_job": has_active_job,
                "has_scheduled_job": bool(st_info.get("has_scheduled_job")),
                "is_available": is_available,
                "trip_status": trip_status,
                "work_status": st_info.get("work_status", "available"),
                "work_status_label": status_label_map[trip_status],
                "last_completed_at": st_info.get("last_completed_at"),
            })
        return jsonify({
            "success": True,
            "total_online": len(clean_list),
            "available_count": status_counts["available"] + status_counts["completed"],
            "status_counts": status_counts,
            "co_riders": clean_list,
        })

    @app.post("/api/rider/status")
    def rider_toggle_status():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401

        is_online = bool(data.get("is_online", True))
        update_rider_online_status(conn, int(rider_id), is_online)
        conn.commit()
        return jsonify({"success": True, "is_online": 1 if is_online else 0})

    @app.get("/api/rider/available-jobs")
    def rider_available_jobs():
        conn = get_db()
        rid = _rider_id_from_session()
        if not rid:
            return jsonify({"error": "Rider login required.", "jobs": [], "count": 0}), 401
        jobs = get_available_broadcast_bookings(conn, rider_id=int(rid))
        return jsonify({"jobs": jobs, "count": len(jobs)})

    @app.get("/api/rider/active-job")
    def rider_active_job():
        conn = get_db()
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"job": None, "scheduled_jobs": []})

        job = get_rider_active_job(conn, int(rider_id))
        scheduled_jobs = get_rider_scheduled_jobs(conn, int(rider_id))
        return jsonify({"job": job, "scheduled_jobs": scheduled_jobs})

    @app.post("/api/bookings/<int:booking_id>/accept")
    def rider_accept_booking(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Please log in as a rider before accepting bookings."}), 401

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

        active = get_rider_active_job(conn, int(rider_id))
        if active and active["id"] != booking_id and not is_target_advance:
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
        if not claimed or not claimed_id:
            conn.rollback()
            return jsonify({"error": claim_reason or "This booking has already been claimed by another rider."}), 409

        conn.commit()
        updated_job = attach_group_metadata(conn, get_booking_by_id(conn, int(claimed_id)))
        return jsonify({
            "success": True,
            "message": "Booking accepted successfully!",
            "job": updated_job,
            "claimed_booking_id": int(claimed_id),
            "is_advance": is_target_advance,
        })

    @app.post("/api/bookings/<int:booking_id>/start-now")
    def rider_start_scheduled_job(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401
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

        target = get_booking_by_id(conn, booking_id)
        if not target:
            return jsonify({"error": "Booking not found."}), 404
        rid = _rider_id_from_session()
        if not (_admin_ok() or (rid and target.get("rider_id") == rid)):
            return jsonify({"error": "Only the assigned rider can update this booking."}), 403

        update_booking_status(conn, booking_id, new_status)
        conn.commit()
        updated_job = get_booking_by_id(conn, booking_id)
        return jsonify({"success": True, "job": updated_job})

    @app.post("/api/bookings/<int:booking_id>/receipt")
    def upload_booking_receipt(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        _bk = get_booking_by_id(conn, booking_id)
        if not _bk:
            return jsonify({"error": "Booking not found."}), 404
        if not _is_booking_participant(_bk):
            return jsonify({"error": "Not allowed."}), 403
        limited = _throttle("upload", _client_ip(), 30, 600)
        if limited:
            return limited
        receipt_b64 = (data.get("receipt_image") or "").strip()
        if not receipt_b64 or "," not in receipt_b64:
            return jsonify({"error": "Invalid or missing receipt image data."}), 400

        try:
            raw_bytes, mimetype, _ext = _decode_image(receipt_b64, 8 * 1024 * 1024)

            ts = int(datetime.now().timestamp())
            fname = f"receipt_{booking_id}_{ts}.jpg"
            receipt_url = save_uploaded_media(conn, fname, raw_bytes, mimetype)
            conn.execute("UPDATE bookings SET receipt_url = ? WHERE id = ?", (receipt_url, booking_id))
            booking_row = get_booking_by_id(conn, booking_id)
            sender_role = "rider" if (_rider_id_from_session() and booking_row and booking_row.get("rider_id") == _rider_id_from_session()) else "customer"
            sender_name = "Kuya Rider" if sender_role == "rider" else (booking_row.get("customer_name") if booking_row else "Passenger")
            add_booking_message(
                conn,
                booking_id,
                sender_role,
                sender_name,
                f"📸 Receipt uploaded: {receipt_url}",
            )
            conn.commit()

            return jsonify({
                "success": True,
                "receipt_url": receipt_url,
                "message": "Malampusong na-upload ang litrato sa resibo!",
            })
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to upload receipt: {str(e)}"}), 500

    @app.post("/api/rider/location")
    def stream_rider_location():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = _rider_id_from_session()
        if not rider_id:
            return jsonify({"error": "Rider ID required"}), 400

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
        conn = get_db()
        rider_id_val = _rider_id_from_session()
        if not rider_id_val:
            return jsonify({"success": False, "error": "Rider ID is required."}), 400
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
        if not _admin_ok():
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
        if not _admin_ok():
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        success = delete_rider(conn, rider_id)
        if not success:
            return jsonify({"error": "Rider not found or could not be deleted."}), 404
        return jsonify({"success": True, "message": "Rider account permanently deleted."})

    @app.post("/api/admin/riders/<int:rider_id>/reset-password")
    def admin_reset_rider_password(rider_id: int):
        if not _admin_ok():
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
        limited = _throttle("admin-login", _client_ip(), 8, 900) or _throttle("admin-login-global", "all", 40, 900)
        if limited:
            return limited
        conn = get_db()
        settings = get_settings(conn)
        pwd_hash = settings.get("admin_password_hash")
        is_valid = False
        if pwd_hash:
            try:
                is_valid = check_password_hash(pwd_hash, password)
            except Exception:
                is_valid = False

        if is_valid:
            session["is_admin"] = True
            session["admin_ts"] = time.time()
            return jsonify({"success": True})
        return jsonify({"error": "Incorrect admin password."}), 401

    @app.post("/api/admin/logout")
    def admin_logout():
        session.pop("is_admin", None)
        return jsonify({"success": True})

    @app.get("/admin")
    def admin_view():
        is_admin_auth = bool(_admin_ok())
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
                stats={"total_bookings": 0, "completed": 0, "active_now": 0, "online_riders": 0, "pending_riders": 0, "total_riders": 0, "total_revenue": 0.0, "total_transactions": 0, "verified_customers": 0, "total_customers": 0},
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
        if not _admin_ok():
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        cust = toggle_customer_verify(conn, customer_id)
        if not cust:
            return jsonify({"error": "Customer not found."}), 404
        conn.commit()
        return jsonify({"success": True, "customer": cust})

    @app.post("/api/admin/customers/<int:customer_id>/delete")
    def admin_delete_customer(customer_id: int):
        if not _admin_ok():
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        success = delete_customer(conn, customer_id)
        if not success:
            return jsonify({"error": "Customer not found or could not be deleted."}), 404
        return jsonify({"success": True, "message": "Customer account permanently deleted."})

    @app.post("/api/admin/customers/<int:customer_id>/reset-password")
    def admin_reset_customer_password(customer_id: int):
        if not _admin_ok():
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
        if not _admin_ok():
            return jsonify({"error": "Admin access required."}), 403
        conn = get_db()
        status_filter = (request.args.get("status") or "").strip()
        txns = get_all_transactions(conn, limit=200, status_filter=status_filter)
        return jsonify({"success": True, "transactions": txns})

    @app.post("/api/admin/settings")
    def admin_save_settings():
        if not _admin_ok():
            return jsonify({"error": "Admin login required."}), 401
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

        safe_settings = {k: v for k, v in get_settings(conn).items() if k != "admin_password_hash"}
        return jsonify({"success": True, "settings": safe_settings})

    @app.get("/api/admin/backup")
    def admin_download_backup():
        if not _admin_ok():
            return jsonify({"error": "Admin login required."}), 401
        conn = get_db()
        backup_data = export_full_backup(conn)

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
        if not _admin_ok():
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
        if not _admin_ok():
            return jsonify({"error": "Admin login required."}), 401

        conn = get_db()
        settings = get_settings(conn)
        webhook_url = (settings.get("google_drive_webhook_url") or "").strip()

        backup_data = export_full_backup(conn)

        import json
        import urllib.request

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
                "message": f"Malampusong na-upload ang backup ({filename}) sa Google Drive!",
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
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("FLASK_DEBUG") == "1")
