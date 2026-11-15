"""
Database module for Camiguin Centric Riders Club (CCRC).
Supports SQLite for local development/testing and PostgreSQL for Neon/Render cloud deployments.
"""

from __future__ import annotations

import math
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from werkzeug.security import check_password_hash, generate_password_hash

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None
    dict_row = None


def get_database_url() -> str:
    return (os.environ.get("DATABASE_URL") or "").strip()


def calculate_haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great circle distance in kilometers between two GPS points."""
    r = 6371.0  # Earth radius in kilometers
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def calculate_fare(km: float, service_type: str, settings: dict[str, Any]) -> tuple[float, float]:
    """
    Calculate fare based on service type, estimated distance, and club settings.
    Returns (fare_amount, estimated_km).
    """
    clean_km = max(1.0, round(km, 2))
    base_fare = float(settings.get("base_fare") or 50.0)
    base_km = float(settings.get("base_km") or 2.0)
    per_km_rate = float(settings.get("per_km_rate") or 15.0)
    min_fare = float(settings.get("min_fare") or 50.0)

    # Service-specific base multipliers or additions
    service_add = 0.0
    if service_type in ("pabili", "pabayad"):
        service_add = float(settings.get("pabili_service_fee") or 20.0)
    elif service_type == "pasugo":
        service_add = float(settings.get("pasugo_service_fee") or 10.0)

    if clean_km <= base_km:
        computed = base_fare + service_add
    else:
        extra_km = clean_km - base_km
        computed = base_fare + (extra_km * per_km_rate) + service_add

    final_fare = max(min_fare, round(computed, 0))
    return final_fare, clean_km


def generate_booking_code() -> str:
    now = datetime.now()
    token = secrets.token_hex(2).upper()
    return f"CCRC-{now.strftime('%y%m')}-{token}"


def translate_sql_to_postgres(sql: str) -> str:
    converted = sql.replace("?", "%s")
    converted = converted.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    return converted


class DatabaseConnection:
    def __init__(self, backend: str, raw_connection: Any):
        self.backend = backend
        self._raw = raw_connection

    def execute(self, sql: str, params: tuple | list = ()) -> Any:
        if self.backend == "postgresql":
            pg_sql = translate_sql_to_postgres(sql)
            return self._raw.execute(pg_sql, params or None)
        return self._raw.execute(sql, params)

    def executemany(self, sql: str, seq_of_params: list) -> Any:
        if self.backend == "postgresql":
            pg_sql = translate_sql_to_postgres(sql)
            with self._raw.cursor() as cur:
                cur.executemany(pg_sql, seq_of_params)
            return
        return self._raw.executemany(sql, seq_of_params)

    def insert_returning_id(self, sql: str, params: tuple | list = ()) -> int:
        if self.backend == "postgresql":
            pg_sql = translate_sql_to_postgres(sql.strip().rstrip(";")) + " RETURNING id"
            cur = self._raw.execute(pg_sql, params or None)
            row = cur.fetchone()
            return int(row[0])
        cur = self._raw.execute(sql, params)
        return int(cur.lastrowid)

    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()

    def close(self) -> None:
        self._raw.close()


def get_connection(db_path: str = "riders_club.db") -> DatabaseConnection:
    db_url = get_database_url()
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL connections.")
        if db_url.startswith("postgres://"):
            db_url = "postgresql://" + db_url[len("postgres://") :]
        raw_conn = psycopg.connect(db_url, row_factory=dict_row, autocommit=False)
        return DatabaseConnection("postgresql", raw_conn)

    raw_conn = sqlite3.connect(db_path, timeout=15.0)
    raw_conn.row_factory = sqlite3.Row
    raw_conn.execute("PRAGMA foreign_keys = ON")
    raw_conn.execute("PRAGMA journal_mode = WAL")
    return DatabaseConnection("sqlite", raw_conn)


def init_db(conn: DatabaseConnection) -> None:
    if conn.backend == "postgresql":
        _create_postgres_schema(conn)
    else:
        _create_sqlite_schema(conn)
    _seed_initial_data(conn)
    conn.commit()


def _create_sqlite_schema(conn: DatabaseConnection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS riders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            bike_model TEXT NOT NULL,
            plate_number TEXT NOT NULL,
            municipality TEXT DEFAULT 'Mambajao',
            color TEXT DEFAULT '#f97316',
            avatar_url TEXT DEFAULT '',
            status TEXT DEFAULT 'active', -- active, pending, suspended
            is_online INTEGER DEFAULT 0,
            last_lat REAL DEFAULT NULL,
            last_lng REAL DEFAULT NULL,
            last_active_at TEXT DEFAULT NULL,
            total_trips INTEGER DEFAULT 0,
            rating_avg REAL DEFAULT 5.0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_code TEXT NOT NULL UNIQUE,
            service_type TEXT NOT NULL, -- pahatud, pakuha, pasugo, pabili, pabayad
            status TEXT NOT NULL DEFAULT 'broadcast', -- broadcast, accepted, in_progress, completed, cancelled
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            pickup_address TEXT NOT NULL,
            pickup_lat REAL DEFAULT NULL,
            pickup_lng REAL DEFAULT NULL,
            dropoff_address TEXT NOT NULL,
            dropoff_lat REAL DEFAULT NULL,
            dropoff_lng REAL DEFAULT NULL,
            item_notes TEXT DEFAULT '',
            estimated_budget REAL DEFAULT 0,
            estimated_km REAL DEFAULT 0,
            fare_amount REAL NOT NULL,
            payment_method TEXT DEFAULT 'cash', -- cash, gcash
            rider_id INTEGER DEFAULT NULL,
            accepted_at TEXT DEFAULT NULL,
            pickup_time TEXT DEFAULT NULL,
            completed_at TEXT DEFAULT NULL,
            cancelled_reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracking_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            rider_id INTEGER NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            speed REAL DEFAULT 0,
            heading REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
            FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER DEFAULT NULL,
            rider_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
            FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS uploaded_media (
            filename TEXT PRIMARY KEY,
            data BLOB NOT NULL,
            mimetype TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracking_booking ON tracking_logs(booking_id)")


def _create_postgres_schema(conn: DatabaseConnection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(120) PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS riders (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            bike_model VARCHAR(120) NOT NULL,
            plate_number VARCHAR(32) NOT NULL,
            municipality VARCHAR(64) DEFAULT 'Mambajao',
            color VARCHAR(32) DEFAULT '#f97316',
            avatar_url TEXT DEFAULT '',
            status VARCHAR(32) DEFAULT 'active',
            is_online INTEGER DEFAULT 0,
            last_lat DOUBLE PRECISION DEFAULT NULL,
            last_lng DOUBLE PRECISION DEFAULT NULL,
            last_active_at VARCHAR(32) DEFAULT NULL,
            total_trips INTEGER DEFAULT 0,
            rating_avg DOUBLE PRECISION DEFAULT 5.0,
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            booking_code VARCHAR(32) NOT NULL UNIQUE,
            service_type VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'broadcast',
            customer_name VARCHAR(120) NOT NULL,
            customer_phone VARCHAR(32) NOT NULL,
            pickup_address TEXT NOT NULL,
            pickup_lat DOUBLE PRECISION DEFAULT NULL,
            pickup_lng DOUBLE PRECISION DEFAULT NULL,
            dropoff_address TEXT NOT NULL,
            dropoff_lat DOUBLE PRECISION DEFAULT NULL,
            dropoff_lng DOUBLE PRECISION DEFAULT NULL,
            item_notes TEXT DEFAULT '',
            estimated_budget DOUBLE PRECISION DEFAULT 0,
            estimated_km DOUBLE PRECISION DEFAULT 0,
            fare_amount DOUBLE PRECISION NOT NULL,
            payment_method VARCHAR(32) DEFAULT 'cash',
            rider_id INTEGER DEFAULT NULL REFERENCES riders(id) ON DELETE SET NULL,
            accepted_at VARCHAR(32) DEFAULT NULL,
            pickup_time VARCHAR(32) DEFAULT NULL,
            completed_at VARCHAR(32) DEFAULT NULL,
            cancelled_reason TEXT DEFAULT '',
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracking_logs (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
            lat DOUBLE PRECISION NOT NULL,
            lng DOUBLE PRECISION NOT NULL,
            speed DOUBLE PRECISION DEFAULT 0,
            heading DOUBLE PRECISION DEFAULT 0,
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER DEFAULT NULL REFERENCES bookings(id) ON DELETE SET NULL,
            rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
            customer_name VARCHAR(120) NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT DEFAULT '',
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS uploaded_media (
            filename VARCHAR(120) PRIMARY KEY,
            data BYTEA NOT NULL,
            mimetype VARCHAR(100) NOT NULL,
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracking_booking ON tracking_logs(booking_id)")


def _seed_initial_data(conn: DatabaseConnection) -> None:
    now = datetime.now().isoformat(timespec="seconds")

    default_settings = {
        "club_name": "Camiguin Centric Riders Club",
        "tagline": "Pahatud, Pakuha, Pasugo & Pabili — On-Demand Island Express Riders",
        "hotline": "0917 555 0199",
        "admin_password_hash": generate_password_hash("admin1234"),
        "base_fare": "50.0",
        "base_km": "2.0",
        "per_km_rate": "15.0",
        "min_fare": "50.0",
        "pabili_service_fee": "20.0",
        "pasugo_service_fee": "10.0",
        "default_lat": "9.2483",
        "default_lng": "124.6975",  # Mambajao center
    }

    for k, v in default_settings.items():
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (k,)).fetchone()
        if not row:
            conn.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Seed starter verified club riders if none exist
    rider_count = conn.execute("SELECT COUNT(*) AS c FROM riders").fetchone()
    count = int(rider_count["c"] if isinstance(rider_count, dict) or hasattr(rider_count, "keys") else rider_count[0])

    if count == 0:
        default_riders = [
            (
                "Kuya Jun (President)",
                "09171234501",
                generate_password_hash("rider1234"),
                "Honda Click 125i (Orange)",
                "CCRC-01",
                "Mambajao",
                "#f97316",
                "active",
                1,  # online
                9.2483,
                124.6975,
                now,
                142,
                5.0,
                now,
            ),
            (
                "Kuya Mark (VP Operations)",
                "09171234502",
                generate_password_hash("rider1234"),
                "Yamaha NMAX 155 (Blue)",
                "CCRC-02",
                "Mahinog / Benoni",
                "#0284c7",
                "active",
                1,  # online
                9.1306,
                124.7937,
                now,
                98,
                4.9,
                now,
            ),
            (
                "Kuya Jerome (Lead Courier)",
                "09171234503",
                generate_password_hash("rider1234"),
                "Honda Beat Fi (Black)",
                "CCRC-03",
                "Yumbing / Catarman",
                "#10b981",
                "active",
                1,  # online
                9.2553,
                124.6468,
                now,
                76,
                5.0,
                now,
            ),
        ]
        conn.executemany(
            """
            INSERT INTO riders (
                name, phone, password_hash, bike_model, plate_number, municipality,
                color, status, is_online, last_lat, last_lng, last_active_at,
                total_trips, rating_avg, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            default_riders,
        )


def get_settings(conn: DatabaseConnection) -> dict[str, str]:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {row["key"]: row["value"] for row in rows}


def update_settings(conn: DatabaseConnection, updates: dict[str, str]) -> None:
    for k, v in updates.items():
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (k, str(v)),
        )


# -----------------------------------------------------------------------------
# Rider Management Functions
# -----------------------------------------------------------------------------
def get_rider_by_id(conn: DatabaseConnection, rider_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM riders WHERE id = ?", (rider_id,)).fetchone()
    return dict(row) if row else None


def get_rider_by_phone(conn: DatabaseConnection, phone: str) -> dict[str, Any] | None:
    clean = phone.strip().replace(" ", "").replace("-", "")
    row = conn.execute("SELECT * FROM riders WHERE phone = ?", (clean,)).fetchone()
    return dict(row) if row else None


def register_rider(
    conn: DatabaseConnection,
    name: str,
    phone: str,
    password: str,
    bike_model: str,
    plate_number: str,
    municipality: str = "Mambajao",
) -> int:
    clean_phone = phone.strip().replace(" ", "").replace("-", "")
    pwd_hash = generate_password_hash(password)
    now = datetime.now().isoformat(timespec="seconds")
    return conn.insert_returning_id(
        """
        INSERT INTO riders (
            name, phone, password_hash, bike_model, plate_number,
            municipality, status, is_online, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?)
        """,
        (name.strip(), clean_phone, pwd_hash, bike_model.strip(), plate_number.strip().upper(), municipality, now),
    )


def update_rider_online_status(conn: DatabaseConnection, rider_id: int, is_online: bool) -> None:
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "UPDATE riders SET is_online = ?, last_active_at = ? WHERE id = ?",
        (1 if is_online else 0, now, rider_id),
    )


def update_rider_location(
    conn: DatabaseConnection,
    rider_id: int,
    lat: float,
    lng: float,
    booking_id: int | None = None,
    speed: float = 0.0,
    heading: float = 0.0,
) -> None:
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "UPDATE riders SET last_lat = ?, last_lng = ?, last_active_at = ? WHERE id = ?",
        (lat, lng, now, rider_id),
    )
    if booking_id:
        conn.execute(
            """
            INSERT INTO tracking_logs (booking_id, rider_id, lat, lng, speed, heading, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (booking_id, rider_id, lat, lng, speed, heading, now),
        )


def get_online_riders(conn: DatabaseConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, phone, bike_model, plate_number, municipality, color,
               last_lat, last_lng, last_active_at, total_trips, rating_avg
        FROM riders
        WHERE is_online = 1 AND status = 'active'
        ORDER BY last_active_at DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]


# -----------------------------------------------------------------------------
# Booking & Dispatch Functions
# -----------------------------------------------------------------------------
def create_booking(
    conn: DatabaseConnection,
    service_type: str,
    customer_name: str,
    customer_phone: str,
    pickup_address: str,
    pickup_lat: float | None,
    pickup_lng: float | None,
    dropoff_address: str,
    dropoff_lat: float | None,
    dropoff_lng: float | None,
    item_notes: str = "",
    estimated_budget: float = 0.0,
    fare_amount: float = 50.0,
    estimated_km: float = 1.0,
    payment_method: str = "cash",
) -> dict[str, Any]:
    code = generate_booking_code()
    now = datetime.now().isoformat(timespec="seconds")
    booking_id = conn.insert_returning_id(
        """
        INSERT INTO bookings (
            booking_code, service_type, status, customer_name, customer_phone,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            item_notes, estimated_budget, estimated_km, fare_amount, payment_method, created_at
        ) VALUES (?, ?, 'broadcast', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            code,
            service_type,
            customer_name.strip(),
            customer_phone.strip(),
            pickup_address.strip(),
            pickup_lat,
            pickup_lng,
            dropoff_address.strip(),
            dropoff_lat,
            dropoff_lng,
            item_notes.strip(),
            estimated_budget,
            estimated_km,
            fare_amount,
            payment_method,
            now,
        ),
    )
    return get_booking_by_id(conn, booking_id)


def get_booking_by_id(conn: DatabaseConnection, booking_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT b.*,
               r.name AS rider_name, r.phone AS rider_phone, r.bike_model AS rider_bike,
               r.plate_number AS rider_plate, r.color AS rider_color, r.last_lat AS rider_lat,
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating
        FROM bookings b
        LEFT JOIN riders r ON r.id = b.rider_id
        WHERE b.id = ?
        """,
        (booking_id,),
    ).fetchone()
    return dict(row) if row else None


def get_booking_by_code(conn: DatabaseConnection, booking_code: str) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT b.*,
               r.name AS rider_name, r.phone AS rider_phone, r.bike_model AS rider_bike,
               r.plate_number AS rider_plate, r.color AS rider_color, r.last_lat AS rider_lat,
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating
        FROM bookings b
        LEFT JOIN riders r ON r.id = b.rider_id
        WHERE UPPER(b.booking_code) = ?
        """,
        (booking_code.strip().upper(),),
    ).fetchone()
    return dict(row) if row else None


def get_available_broadcast_bookings(conn: DatabaseConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM bookings
        WHERE status = 'broadcast' AND rider_id IS NULL
        ORDER BY id DESC
        LIMIT 20
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_rider_active_job(conn: DatabaseConnection, rider_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT * FROM bookings
        WHERE rider_id = ? AND status IN ('accepted', 'in_progress')
        ORDER BY id DESC
        LIMIT 1
        """,
        (rider_id,),
    ).fetchone()
    return dict(row) if row else None


def accept_booking(conn: DatabaseConnection, booking_id: int, rider_id: int) -> bool:
    """Atomic acceptance: assigns rider only if booking is still in 'broadcast' status."""
    now = datetime.now().isoformat(timespec="seconds")
    cur = conn.execute(
        """
        UPDATE bookings
        SET status = 'accepted', rider_id = ?, accepted_at = ?
        WHERE id = ? AND (status = 'broadcast' OR rider_id IS NULL)
        """,
        (rider_id, now, booking_id),
    )
    # Check if row was updated
    rowcount = cur.rowcount if hasattr(cur, "rowcount") else 0
    return rowcount > 0


def update_booking_status(conn: DatabaseConnection, booking_id: int, new_status: str) -> bool:
    now = datetime.now().isoformat(timespec="seconds")
    extra_col = ""
    extra_params = []
    if new_status == "in_progress":
        extra_col = ", pickup_time = ?"
        extra_params.append(now)
    elif new_status == "completed":
        extra_col = ", completed_at = ?"
        extra_params.append(now)
        # Update rider trip count
        b = get_booking_by_id(conn, booking_id)
        if b and b.get("rider_id"):
            conn.execute("UPDATE riders SET total_trips = total_trips + 1 WHERE id = ?", (b["rider_id"],))

    params = [new_status] + extra_params + [booking_id]
    conn.execute(f"UPDATE bookings SET status = ?{extra_col} WHERE id = ?", tuple(params))
    return True


def get_booking_tracking_trail(conn: DatabaseConnection, booking_id: int, limit: int = 40) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT lat, lng, speed, heading, created_at
        FROM tracking_logs
        WHERE booking_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (booking_id, limit),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


# -----------------------------------------------------------------------------
# Media Storage in DB
# -----------------------------------------------------------------------------
def save_uploaded_media(conn: DatabaseConnection, filename: str, data: bytes, mimetype: str) -> str:
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        """
        INSERT INTO uploaded_media (filename, data, mimetype, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET data = excluded.data, mimetype = excluded.mimetype
        """,
        (filename, data, mimetype, now),
    )
    return f"/media/{filename}"


def get_uploaded_media(conn: DatabaseConnection, filename: str) -> tuple[bytes, str] | None:
    row = conn.execute("SELECT data, mimetype FROM uploaded_media WHERE filename = ?", (filename,)).fetchone()
    if not row:
        return None
    return bytes(row["data"]), str(row["mimetype"])
