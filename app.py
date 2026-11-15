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
    render_template,
    request,
    send_from_directory,
    session,
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import (
    accept_booking,
    calculate_fare,
    calculate_haversine_km,
    create_booking,
    get_available_broadcast_bookings,
    get_booking_by_code,
    get_booking_by_id,
    get_booking_tracking_trail,
    get_connection,
    get_online_riders,
    get_rider_active_job,
    get_rider_by_id,
    get_rider_by_phone,
    get_settings,
    get_uploaded_media,
    init_db,
    register_rider,
    save_uploaded_media,
    update_booking_status,
    update_rider_location,
    update_rider_online_status,
    update_settings,
)


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.secret_key = os.environ.get("SECRET_KEY", "ccrc-island-secret-key-camiguin-2026")

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
    def index():
        conn = get_db()
        online_riders = get_online_riders(conn)
        settings = get_settings(conn)
        return render_template(
            "index.html",
            online_riders_count=len(online_riders),
            settings=settings,
            active_nav="book",
        )

    @app.post("/api/fare-estimate")
    def estimate_fare():
        conn = get_db()
        settings = get_settings(conn)
        data = request.get_json(silent=True) or {}
        p_lat = float(data.get("pickup_lat") or 0.0)
        p_lng = float(data.get("pickup_lng") or 0.0)
        d_lat = float(data.get("dropoff_lat") or 0.0)
        d_lng = float(data.get("dropoff_lng") or 0.0)
        service = (data.get("service_type") or "pahatud").lower()

        is_large_store = bool(data.get("is_large_store", False))
        extra_stores_count = int(data.get("extra_stores_count") or 0)
        is_bulky = bool(data.get("is_bulky_or_high_value", False))
        is_hinterland = bool(data.get("is_hinterland", False))

        if p_lat and p_lng and d_lat and d_lng:
            km = calculate_haversine_km(p_lat, p_lng, d_lat, d_lng)
        else:
            km = 2.0  # default estimate

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
            "fare_amount": fare,
            "service_type": service,
            "breakdown": breakdown,
        })

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

        if pickup_lat and pickup_lng and dropoff_lat and dropoff_lng:
            km = calculate_haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        else:
            km = 2.0

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
            payment_method=(data.get("payment_method") or "cash").strip().lower(),
        )
        conn.commit()

        return jsonify({
            "success": True,
            "message": "Your booking has been broadcasted to all active riders!",
            "booking": booking,
            "breakdown": breakdown,
            "tracking_url": f"/track/{booking['booking_code']}",
        }), 201

    # -------------------------------------------------------------------------
    # Live Tracking Routes
    # -------------------------------------------------------------------------
    @app.get("/track/<booking_code>")
    def track_view(booking_code: str):
        conn = get_db()
        booking = get_booking_by_code(conn, booking_code)
        if not booking:
            return render_template("track.html", booking=None, error="Booking not found."), 404
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

        # Compute real-time distance from rider to pickup/dropoff
        distance_to_pickup_km = None
        if booking.get("rider_lat") and booking.get("rider_lng") and booking.get("pickup_lat") and booking.get("pickup_lng"):
            distance_to_pickup_km = calculate_haversine_km(
                booking["rider_lat"], booking["rider_lng"], booking["pickup_lat"], booking["pickup_lng"]
            )

        distance_to_dropoff_km = None
        if booking.get("rider_lat") and booking.get("rider_lng") and booking.get("dropoff_lat") and booking.get("dropoff_lng"):
            distance_to_dropoff_km = calculate_haversine_km(
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

    @app.post("/api/rider/login")
    def rider_login():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        phone = (data.get("phone") or "").strip()
        password = (data.get("password") or "").strip()

        rider = get_rider_by_phone(conn, phone)
        if not rider:
            return jsonify({"error": "Rider phone number not found."}), 404

        if not check_password_hash(rider["password_hash"], password):
            return jsonify({"error": "Incorrect password."}), 401

        session["rider_id"] = rider["id"]
        update_rider_online_status(conn, rider["id"], True)
        conn.commit()

        # Sanitize sensitive field
        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
        clean_rider["is_online"] = 1
        return jsonify({"success": True, "rider": clean_rider})

    @app.post("/api/rider/register")
    def rider_register():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        password = (data.get("password") or "").strip()
        bike_model = (data.get("bike_model") or "").strip()
        plate_number = (data.get("plate_number") or "").strip()
        municipality = (data.get("municipality") or "Mambajao").strip()

        if not name or not phone or not password or not bike_model or not plate_number:
            return jsonify({"error": "Please complete all required fields."}), 400

        existing = get_rider_by_phone(conn, phone)
        if existing:
            return jsonify({"error": "This phone number is already registered. Please log in."}), 409

        rider_id = register_rider(
            conn=conn,
            name=name,
            phone=phone,
            password=password,
            bike_model=bike_model,
            plate_number=plate_number,
            municipality=municipality,
        )
        conn.commit()
        session["rider_id"] = rider_id
        rider = get_rider_by_id(conn, rider_id)
        clean_rider = {k: v for k, v in rider.items() if k != "password_hash"}
        return jsonify({"success": True, "rider": clean_rider}), 201

    @app.post("/api/rider/status")
    def rider_toggle_status():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = session.get("rider_id") or data.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Unauthorized"}), 401

        is_online = bool(data.get("is_online", True))
        update_rider_online_status(conn, int(rider_id), is_online)
        conn.commit()
        return jsonify({"success": True, "is_online": 1 if is_online else 0})

    @app.get("/api/rider/available-jobs")
    def rider_available_jobs():
        conn = get_db()
        jobs = get_available_broadcast_bookings(conn)
        return jsonify({"jobs": jobs, "count": len(jobs)})

    @app.get("/api/rider/active-job")
    def rider_active_job():
        conn = get_db()
        rider_id = session.get("rider_id") or request.args.get("rider_id")
        if not rider_id:
            return jsonify({"job": None})

        job = get_rider_active_job(conn, int(rider_id))
        return jsonify({"job": job})

    @app.post("/api/bookings/<int:booking_id>/accept")
    def rider_accept_booking(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = session.get("rider_id") or data.get("rider_id")
        if not rider_id:
            return jsonify({"error": "Please log in as a rider before accepting bookings."}), 401

        rider = get_rider_by_id(conn, int(rider_id))
        if not rider or rider.get("status") != "active":
            return jsonify({"error": "Your rider account is pending approval or suspended."}), 403

        # Check if rider already has an active ongoing job
        active = get_rider_active_job(conn, int(rider_id))
        if active and active["id"] != booking_id:
            return jsonify({"error": "You already have an active ongoing trip that must be completed first."}), 400

        claimed = accept_booking(conn, booking_id, int(rider_id))
        if not claimed:
            conn.rollback()
            return jsonify({"error": "This booking has already been claimed by another rider."}), 409

        conn.commit()
        updated_job = get_booking_by_id(conn, booking_id)
        return jsonify({"success": True, "message": "Booking accepted successfully!", "job": updated_job})

    @app.post("/api/bookings/<int:booking_id>/status")
    def update_job_status(booking_id: int):
        conn = get_db()
        data = request.get_json(silent=True) or {}
        new_status = (data.get("status") or "").strip().lower()

        if new_status not in ("in_progress", "completed", "cancelled"):
            return jsonify({"error": "Invalid status transition"}), 400

        update_booking_status(conn, booking_id, new_status)
        conn.commit()
        updated_job = get_booking_by_id(conn, booking_id)
        return jsonify({"success": True, "job": updated_job})

    @app.post("/api/rider/location")
    def stream_rider_location():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        rider_id = session.get("rider_id") or data.get("rider_id")
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

    # -------------------------------------------------------------------------
    # Admin / Club Management Portal
    # -------------------------------------------------------------------------
    @app.get("/admin")
    def admin_view():
        conn = get_db()
        settings = get_settings(conn)
        riders = conn.execute("SELECT * FROM riders ORDER BY id DESC").fetchall()
        recent_bookings = conn.execute(
            """
            SELECT b.*, r.name AS rider_name, r.bike_model AS rider_bike
            FROM bookings b
            LEFT JOIN riders r ON r.id = b.rider_id
            ORDER BY b.id DESC
            LIMIT 50
            """
        ).fetchall()

        stats = {
            "total_bookings": len(recent_bookings),
            "completed": sum(1 for b in recent_bookings if b["status"] == "completed"),
            "active_now": sum(1 for b in recent_bookings if b["status"] in ("broadcast", "accepted", "in_progress")),
            "online_riders": sum(1 for r in riders if r["is_online"] == 1 and r["status"] == "active"),
            "total_riders": len(riders),
        }

        return render_template(
            "admin.html",
            settings=settings,
            riders=[dict(r) for r in riders],
            bookings=[dict(b) for b in recent_bookings],
            stats=stats,
            active_nav="admin",
        )

    @app.post("/api/admin/settings")
    def admin_save_settings():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        updates = {}
        for key in (
            "club_name", "tagline", "hotline", "base_fare", "base_km", "per_km_rate", "min_fare",
            "pabili_service_fee", "pasugo_service_fee", "queuing_fee", "extra_store_fee", "bulky_order_fee", "hinterland_fee"
        ):
            if key in data:
                updates[key] = str(data[key]).strip()

        if updates:
            update_settings(conn, updates)
            conn.commit()

        return jsonify({"success": True, "settings": get_settings(conn)})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
