"""
Flask Application for Camiguin Centric Riders Club (CCRC).
On-Demand Island Express Riders: Pahatud, Pakuha, Pasugo & Pabili.
"""

from __future__ import annotations

import os
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
    register_rider,
    save_uploaded_media,
    search_camiguin_places,
    update_booking_receipt,
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


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.secret_key = os.environ.get("SECRET_KEY", "ccrc-island-secret-key-camiguin-2026")
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

    # Initialize tables and seed on start
    with app.app_context():
        conn = get_db()
        init_db(conn)

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
        d_lng = float(data.get("dropoff_lng") or 
