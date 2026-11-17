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
    CAMIGUIN_KNOWN_PLACES,
    CAMIGUIN_TOUR_PACKAGES,
    accept_booking,
    apply_promo_code,
    calculate_fare,
    calculate_haversine_km,
    calculate_nearest_rider_eta,
    calculate_road_km,
    create_booking,
    create_review,
    geocode_camiguin_location,
    get_available_broadcast_bookings,
    get_booking_by_code,
    get_booking_by_id,
    get_booking_tracking_trail,
    get_connection,
    get_customer_by_phone,
    get_customer_ride_history,
    get_online_riders,
    get_or_create_customer,
    get_rider_active_job,
    get_rider_by_id,
    get_rider_by_phone,
    get_rider_reviews,
    get_settings,
    get_uploaded_media,
    init_db,
    register_rider,
    save_uploaded_media,
    search_camiguin_places,
    update_booking_status,
    update_rider_location,
    update_rider_online_status,
    update_settings,
    validate_promo_code,
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
            tour_packages=CAMIGUIN_TOUR_PACKAGES,
        )

    @app.get("/tours")
    def tours_page():
        conn = get_db()
        online_riders = get_online_riders(conn)
        settings = get_settings(conn)
        return render_template(
            "tours.html",
            online_riders_count=len(online_riders),
            settings=settings,
            active_nav="tours",
            tour_packages=CAMIGUIN_TOUR_PACKAGES,
        )

    @app.get("/history")
    def history_page():
        return render_template("history.html", active_nav="history")

    @app.get("/about")
    def about_page():
        return render_template("about.html", active_nav="about")

    @app.get("/faq")
    def faq_page():
        return render_template("faq.html", active_nav="faq")

    @app.get("/terms")
    def terms_page():
        return render_template("terms.html", active_nav="terms")

    @app.get("/api/riders/online")
    def api_online_riders():
        conn = get_db()
        riders = get_online_riders(conn)
        clean = [
            {
                "id": r["id"],
                "name": r["name"],
                "bike_model": r["bike_model"],
                "plate_number": r["plate_number"],
                "municipality": r.get("municipality", "Mambajao"),
                "color": r.get("color", "#f97316"),
                "last_lat": r.get("last_lat"),
                "last_lng": r.get("last_lng"),
                "rating_avg": r.get("rating_avg", 5.0),
                "total_trips": r.get("total_trips", 0),
            }
            for r in riders
        ]
        return jsonify({"riders": clean, "count": len(clean)})

    @app.get("/api/tour-packages")
    def api_tour_packages():
        return jsonify({"packages": CAMIGUIN_TOUR_PACKAGES})

    @app.post("/api/promo/validate")
    def api_validate_promo():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        code = (data.get("code") or "").strip()
        try:
            fare_amount = float(data.get("fare_amount") or 40.0)
        except (ValueError, TypeError):
            fare_amount = 40.0
        res = validate_promo_code(conn, code, fare_amount)
        return jsonify(res)

    @app.get("/api/customer/history/<phone>")
    def api_customer_history(phone: str):
        conn = get_db()
        clean_phone = phone.strip()
        history = get_customer_ride_history(conn, clean_phone, limit=25)
        customer = get_customer_by_phone(conn, clean_phone)
        return jsonify({
            "customer": customer,
            "history": history,
            "count": len(history),
        })

    @app.post("/api/reviews")
    def api_submit_review():
        conn = get_db()
        data = request.get_json(silent=True) or {}
        try:
            booking_id = int(data.get("booking_id")) if data.get("booking_id") else None
        except (ValueError, TypeError):
            booking_id = None
        try:
            rider_id = int(data.get("rider_id")) if data.get("rider_id") else None
        except (ValueError, TypeError):
            rider_id = None

        customer_name = (data.get("customer_name") or "").strip()
        try:
            rating = max(1, min(5, int(data.get("rating") or 5)))
        except (ValueError, TypeError):
            rating = 5
        comment = (data.get("comment") or "").strip()

        if not rider_id and booking_id:
            booking = get_booking_by_id(conn, booking_id)
            if booking and booking.get("rider_id"):
                rider_id = int(booking["rider_id"])
                if not customer_name:
                    customer_name = booking.get("customer_name") or "Passenger"

        if not rider_id:
            return jsonify({"error": "A valid rider ID or completed booking ID is required to submit a review."}), 400

        rev = create_review(
            conn=conn,
            booking_id=booking_id,
            rider_id=rider_id,
            customer_name=customer_name or "Verified Passenger",
            rating=rating,
            comment=comment,
        )
        conn.commit()
        return jsonify({"success": True, "message": "Thank you! Your rider review has been recorded.", "review": rev}), 201

    @app.get("/api/reviews/<int:rider_id>")
    def api_rider_reviews(rider_id: int):
        conn = get_db()
        reviews = get_rider_reviews(conn, rider_id, limit=10)
        return jsonify({"reviews": reviews, "count": len(reviews)})

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

        # Apply promo voucher if provided
        promo_code = (data.get("promo_code") or "").strip().upper()
        discount_amount = 0.0
        if promo_code:
            p_res = validate_promo_code(conn, promo_code, fare_amount)
            if p_res.get("valid"):
                fare_amount = p_res["final_fare"]
                discount_amount = p_res.get("discount", 0.0)
                apply_promo_code(conn, promo_code)
                breakdown["promo_discount"] = discount_amount
                breakdown["promo_code"] = promo_code
                breakdown["total_fare"] = fare_amount

        scheduled_at = (data.get("scheduled_at") or "").strip() or None
        payment_method = (data.get("payment_method") or "cash").strip().lower()
        if payment_method not in ("cash", "gcash", "maya"):
            payment_method = "cash"

        # Record / update customer profile
        try:
            get_or_create_customer(conn, customer_name, customer_phone, pickup_address)
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

        # Compute nearest rider live ETA for pickup
        nearest_eta = None
        if pickup_lat and pickup_lng:
            nearest_eta = calculate_nearest_rider_eta(conn, pickup_lat, pickup_lng)

        return jsonify({
            "success": True,
            "message": "Your booking has been broadcasted to all active riders!",
            "booking": booking,
            "breakdown": breakdown,
            "nearest_rider_eta": nearest_eta,
            "discount_amount": discount_amount,
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
        rider_reviews = []
        if booking.get("rider_id"):
            rider_reviews = get_rider_reviews(conn, int(booking["rider_id"]), limit=5)
        return render_template("track.html", booking=booking, rider_reviews=rider_reviews, active_nav="track")

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

        rider_reviews = []
        if booking.get("rider_id"):
            rider_reviews = get_rider_reviews(conn, int(booking["rider_id"]), limit=5)

        return jsonify({
            "booking": booking,
            "trail": trail,
            "distance_to_pickup_km": distance_to_pickup_km,
            "distance_to_dropoff_km": distance_to_dropoff_km,
            "rider_reviews": rider_reviews,
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
