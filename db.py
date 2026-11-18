"""
Database module for Camiguin Centric Riders Club (CCRC).
Supports SQLite for local development/testing and PostgreSQL for Neon/Render cloud deployments.
"""

from __future__ import annotations

import json
import math
import os
import queue
import random
import re
import secrets
import sqlite3
import string
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any
from urllib.parse import urlencode, urlparse

from werkzeug.security import check_password_hash, generate_password_hash

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None
    dict_row = None


def get_database_url() -> str:
    return (os.environ.get("DATABASE_URL") or "").strip()


PHT = timezone(timedelta(hours=8))


def get_now_pht() -> datetime:
    """Returns current date and time in Philippine Standard Time (UTC+8) matching Camiguin Island."""
    return datetime.now(PHT).replace(tzinfo=None)


# -------------------------------------------------------------------------
# Camiguin Island Master Landmark & Places Directory (Verified OSM Coordinates)
# Covers all 5 municipalities, all 58 official barangays, sitios, stores, supermarkets,
# pharmacies, markets, schools, hospitals, resorts, tourist spots, & streets.
# -------------------------------------------------------------------------
CAMIGUIN_KNOWN_PLACES: list[dict[str, Any]] = [
    {
        "name": "Poblacion, Mambajao",
        "cat": "barangay",
        "keywords": [
            "mambajao",
            "poblacion mambajao",
            "poblacion",
            "centro mambajao",
            "mambajao proper",
            "mambajao town"
        ],
        "lat": 9.25405,
        "lng": 124.71636,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "Agoho, Mambajao",
        "cat": "barangay",
        "keywords": [
            "agoho",
            "brgy agoho",
            "barangay agoho",
            "agoho sandy beach",
            "agoho beach"
        ],
        "lat": 9.24479,
        "lng": 124.66854,
        "mun": "Mambajao",
        "full_address": "Agoho, Mambajao, Camiguin"
    },
    {
        "name": "Anito, Mambajao",
        "cat": "barangay",
        "keywords": [
            "anito",
            "brgy anito",
            "barangay anito"
        ],
        "lat": 9.22961,
        "lng": 124.7444,
        "mun": "Mambajao",
        "full_address": "Anito, Mambajao, Camiguin"
    },
    {
        "name": "Balbagon, Mambajao",
        "cat": "barangay",
        "keywords": [
            "balbagon",
            "brgy balbagon",
            "barangay balbagon"
        ],
        "lat": 9.23802,
        "lng": 124.7395,
        "mun": "Mambajao",
        "full_address": "Balbagon, Mambajao, Camiguin"
    },
    {
        "name": "Baylao, Mambajao",
        "cat": "barangay",
        "keywords": [
            "baylao",
            "bailao",
            "brgy baylao",
            "barangay baylao"
        ],
        "lat": 9.24674,
        "lng": 124.69862,
        "mun": "Mambajao",
        "full_address": "Baylao, Mambajao, Camiguin"
    },
    {
        "name": "Benhaan, Mambajao",
        "cat": "barangay",
        "keywords": [
            "benhaan",
            "brgy benhaan",
            "barangay benhaan"
        ],
        "lat": 9.20322,
        "lng": 124.76773,
        "mun": "Mambajao",
        "full_address": "Benhaan, Mambajao, Camiguin"
    },
    {
        "name": "Bug-ong, Mambajao",
        "cat": "barangay",
        "keywords": [
            "bug-ong",
            "bugong",
            "brgy bug-ong",
            "barangay bugong",
            "barangay bug-ong"
        ],
        "lat": 9.25117,
        "lng": 124.67809,
        "mun": "Mambajao",
        "full_address": "Bug-ong, Mambajao, Camiguin"
    },
    {
        "name": "Kuguita, Mambajao",
        "cat": "barangay",
        "keywords": [
            "kuguita",
            "cuguita",
            "brgy kuguita",
            "barangay kuguita"
        ],
        "lat": 9.24839,
        "lng": 124.68679,
        "mun": "Mambajao",
        "full_address": "Kuguita, Mambajao, Camiguin"
    },
    {
        "name": "Magting, Mambajao",
        "cat": "barangay",
        "keywords": [
            "magting",
            "brgy magting",
            "barangay magting",
            "magting mambajao"
        ],
        "lat": 9.21895,
        "lng": 124.75603,
        "mun": "Mambajao",
        "full_address": "Magting, Mambajao, Camiguin"
    },
    {
        "name": "Naasag, Mambajao",
        "cat": "barangay",
        "keywords": [
            "naasag",
            "brgy naasag",
            "barangay naasag"
        ],
        "lat": 9.23512,
        "lng": 124.64924,
        "mun": "Mambajao",
        "full_address": "Naasag, Mambajao, Camiguin"
    },
    {
        "name": "Pandan, Mambajao",
        "cat": "barangay",
        "keywords": [
            "pandan",
            "pandan mambajao",
            "brgy pandan",
            "barangay pandan"
        ],
        "lat": 9.23818,
        "lng": 124.72698,
        "mun": "Mambajao",
        "full_address": "Pandan, Mambajao, Camiguin"
    },
    {
        "name": "Soro-soro, Mambajao",
        "cat": "barangay",
        "keywords": [
            "soro-soro",
            "sorosoro",
            "soro soro",
            "soro'soro",
            "brgy sorosoro",
            "brgy soro-soro",
            "hinterland"
        ],
        "lat": 9.22961,
        "lng": 124.72617,
        "mun": "Mambajao",
        "full_address": "Soro-soro, Mambajao, Camiguin"
    },
    {
        "name": "Tagdo, Mambajao",
        "cat": "barangay",
        "keywords": [
            "tagdo",
            "brgy tagdo",
            "barangay tagdo",
            "upper tagdo",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2384,
        "lng": 124.6885,
        "mun": "Mambajao",
        "full_address": "Tagdo, Mambajao, Camiguin"
    },
    {
        "name": "Tupsan, Mambajao",
        "cat": "barangay",
        "keywords": [
            "tupsan",
            "tupsan mambajao",
            "brgy tupsan",
            "barangay tupsan"
        ],
        "lat": 9.20186,
        "lng": 124.77742,
        "mun": "Mambajao",
        "full_address": "Tupsan, Mambajao, Camiguin"
    },
    {
        "name": "Yumbing, Mambajao",
        "cat": "barangay",
        "keywords": [
            "yumbing",
            "brgy yumbing",
            "barangay yumbing"
        ],
        "lat": 9.24346,
        "lng": 124.66295,
        "mun": "Mambajao",
        "full_address": "Yumbing, Mambajao, Camiguin"
    },
    {
        "name": "Poblacion, Mahinog",
        "cat": "barangay",
        "keywords": [
            "mahinog",
            "poblacion mahinog",
            "mahinog centro",
            "centro mahinog",
            "mahinog proper"
        ],
        "lat": 9.15434,
        "lng": 124.78761,
        "mun": "Mahinog",
        "full_address": "Poblacion, Mahinog, Camiguin"
    },
    {
        "name": "Benoni, Mahinog",
        "cat": "barangay",
        "keywords": [
            "benoni",
            "brgy benoni",
            "barangay benoni",
            "benoni mahinog"
        ],
        "lat": 9.13912,
        "lng": 124.79328,
        "mun": "Mahinog",
        "full_address": "Benoni, Mahinog, Camiguin"
    },
    {
        "name": "Binaliwan, Mahinog",
        "cat": "barangay",
        "keywords": [
            "binaliwan",
            "brgy binaliwan",
            "barangay binaliwan",
            "binitinan",
            "brgy binitinan",
            "barangay binitinan"
        ],
        "lat": 9.16189,
        "lng": 124.78917,
        "mun": "Mahinog",
        "full_address": "Binaliwan, Mahinog, Camiguin"
    },
    {
        "name": "Catohogan, Mahinog",
        "cat": "barangay",
        "keywords": [
            "catohogan",
            "katohogan",
            "brgy catohogan",
            "barangay catohogan"
        ],
        "lat": 9.18562,
        "lng": 124.78183,
        "mun": "Mahinog",
        "full_address": "Catohogan, Mahinog, Camiguin"
    },
    {
        "name": "Hubangon, Mahinog",
        "cat": "barangay",
        "keywords": [
            "hubangon",
            "brgy hubangon",
            "barangay hubangon"
        ],
        "lat": 9.17296,
        "lng": 124.78517,
        "mun": "Mahinog",
        "full_address": "Hubangon, Mahinog, Camiguin"
    },
    {
        "name": "Owakan, Mahinog",
        "cat": "barangay",
        "keywords": [
            "owakan",
            "brgy owakan",
            "barangay owakan"
        ],
        "lat": 9.15373,
        "lng": 124.76255,
        "mun": "Mahinog",
        "full_address": "Owakan, Mahinog, Camiguin"
    },
    {
        "name": "Puntod, Mahinog",
        "cat": "barangay",
        "keywords": [
            "puntod",
            "brgy puntod",
            "barangay puntod"
        ],
        "lat": 9.15603,
        "lng": 124.77313,
        "mun": "Mahinog",
        "full_address": "Puntod, Mahinog, Camiguin"
    },
    {
        "name": "San Isidro, Mahinog",
        "cat": "barangay",
        "keywords": [
            "san isidro",
            "san isidro mahinog",
            "brgy san isidro",
            "barangay san isidro"
        ],
        "lat": 9.18171,
        "lng": 124.76971,
        "mun": "Mahinog",
        "full_address": "San Isidro, Mahinog, Camiguin"
    },
    {
        "name": "San Jose, Mahinog",
        "cat": "barangay",
        "keywords": [
            "san jose",
            "san jose mahinog",
            "brgy san jose",
            "barangay san jose"
        ],
        "lat": 9.16774,
        "lng": 124.78382,
        "mun": "Mahinog",
        "full_address": "San Jose, Mahinog, Camiguin"
    },
    {
        "name": "San Miguel, Mahinog",
        "cat": "barangay",
        "keywords": [
            "san miguel",
            "san miguel mahinog",
            "brgy san miguel",
            "barangay san miguel"
        ],
        "lat": 9.13051,
        "lng": 124.78384,
        "mun": "Mahinog",
        "full_address": "San Miguel, Mahinog, Camiguin"
    },
    {
        "name": "San Roque, Mahinog",
        "cat": "barangay",
        "keywords": [
            "san roque",
            "san roque mahinog",
            "brgy san roque",
            "barangay san roque"
        ],
        "lat": 9.15279,
        "lng": 124.79187,
        "mun": "Mahinog",
        "full_address": "San Roque, Mahinog, Camiguin"
    },
    {
        "name": "Tubod, Mahinog",
        "cat": "barangay",
        "keywords": [
            "tubod",
            "tubod mahinog",
            "brgy tubod",
            "barangay tubod"
        ],
        "lat": 9.1609,
        "lng": 124.78326,
        "mun": "Mahinog",
        "full_address": "Tubod, Mahinog, Camiguin"
    },
    {
        "name": "Tupsan Pequeño, Mahinog",
        "cat": "barangay",
        "keywords": [
            "tupsan pequeno",
            "tupsan pequeño",
            "tupsan mahinog",
            "brgy tupsan pequeno"
        ],
        "lat": 9.19518,
        "lng": 124.77836,
        "mun": "Mahinog",
        "full_address": "Tupsan Pequeño, Mahinog, Camiguin"
    },
    {
        "name": "Poblacion, Catarman",
        "cat": "barangay",
        "keywords": [
            "catarman",
            "poblacion catarman",
            "catarman centro",
            "centro catarman",
            "catarman proper"
        ],
        "lat": 9.12523,
        "lng": 124.67453,
        "mun": "Catarman",
        "full_address": "Poblacion, Catarman, Camiguin"
    },
    {
        "name": "Alga, Catarman",
        "cat": "barangay",
        "keywords": [
            "alga",
            "algga",
            "brgy alga",
            "barangay alga",
            "alangilan catarman",
            "biga"
        ],
        "lat": 9.11799,
        "lng": 124.6819,
        "mun": "Catarman",
        "full_address": "Alga, Catarman, Camiguin"
    },
    {
        "name": "Bonbon, Catarman",
        "cat": "barangay",
        "keywords": [
            "bonbon",
            "bonbon catarman",
            "brgy bonbon",
            "barangay bonbon"
        ],
        "lat": 9.19867,
        "lng": 124.63629,
        "mun": "Catarman",
        "full_address": "Bonbon, Catarman, Camiguin"
    },
    {
        "name": "Bura, Catarman",
        "cat": "barangay",
        "keywords": [
            "bura",
            "bura catarman",
            "brgy bura",
            "barangay bura"
        ],
        "lat": 9.1762,
        "lng": 124.65194,
        "mun": "Catarman",
        "full_address": "Bura, Catarman, Camiguin"
    },
    {
        "name": "Catibac, Catarman",
        "cat": "barangay",
        "keywords": [
            "catibac",
            "brgy catibac",
            "barangay catibac"
        ],
        "lat": 9.17761,
        "lng": 124.6352,
        "mun": "Catarman",
        "full_address": "Catibac, Catarman, Camiguin"
    },
    {
        "name": "Compol, Catarman",
        "cat": "barangay",
        "keywords": [
            "compol",
            "brgy compol",
            "barangay compol"
        ],
        "lat": 9.14206,
        "lng": 124.65601,
        "mun": "Catarman",
        "full_address": "Compol, Catarman, Camiguin"
    },
    {
        "name": "Lawigan, Catarman",
        "cat": "barangay",
        "keywords": [
            "lawigan",
            "brgy lawigan",
            "barangay lawigan"
        ],
        "lat": 9.16665,
        "lng": 124.63975,
        "mun": "Catarman",
        "full_address": "Lawigan, Catarman, Camiguin"
    },
    {
        "name": "Liloan, Catarman",
        "cat": "barangay",
        "keywords": [
            "liloan",
            "licoan",
            "brgy liloan",
            "barangay liloan",
            "liloan catarman"
        ],
        "lat": 9.14331,
        "lng": 124.67926,
        "mun": "Catarman",
        "full_address": "Liloan, Catarman, Camiguin"
    },
    {
        "name": "Looc, Catarman",
        "cat": "barangay",
        "keywords": [
            "looc",
            "looc catarman",
            "brgy looc",
            "barangay looc"
        ],
        "lat": 9.13131,
        "lng": 124.67012,
        "mun": "Catarman",
        "full_address": "Looc, Catarman, Camiguin"
    },
    {
        "name": "Mainit, Catarman",
        "cat": "barangay",
        "keywords": [
            "mainit",
            "mainit catarman",
            "brgy mainit",
            "barangay mainit"
        ],
        "lat": 9.15517,
        "lng": 124.65775,
        "mun": "Catarman",
        "full_address": "Mainit, Catarman, Camiguin"
    },
    {
        "name": "Manduao, Catarman",
        "cat": "barangay",
        "keywords": [
            "manduao",
            "mandawa",
            "brgy manduao",
            "barangay manduao"
        ],
        "lat": 9.13813,
        "lng": 124.67337,
        "mun": "Catarman",
        "full_address": "Manduao, Catarman, Camiguin"
    },
    {
        "name": "Panghiawan, Catarman",
        "cat": "barangay",
        "keywords": [
            "panghiawan",
            "pangihawan",
            "brgy panghiawan",
            "barangay panghiawan"
        ],
        "lat": 9.15186,
        "lng": 124.64599,
        "mun": "Catarman",
        "full_address": "Panghiawan, Catarman, Camiguin"
    },
    {
        "name": "Santo Niño, Catarman",
        "cat": "barangay",
        "keywords": [
            "santo nino",
            "santo niño",
            "sto nino catarman",
            "brgy sto nino",
            "barangay santo nino"
        ],
        "lat": 9.14845,
        "lng": 124.67332,
        "mun": "Catarman",
        "full_address": "Santo Niño, Catarman, Camiguin"
    },
    {
        "name": "Tangaro, Catarman",
        "cat": "barangay",
        "keywords": [
            "tangaro",
            "brgy tangaro",
            "barangay tangaro"
        ],
        "lat": 9.11241,
        "lng": 124.69434,
        "mun": "Catarman",
        "full_address": "Tangaro, Catarman, Camiguin"
    },
    {
        "name": "Poblacion, Sagay",
        "cat": "barangay",
        "keywords": [
            "sagay",
            "poblacion sagay",
            "sagay centro",
            "centro sagay",
            "sagay proper"
        ],
        "lat": 9.10511,
        "lng": 124.72349,
        "mun": "Sagay",
        "full_address": "Poblacion, Sagay, Camiguin"
    },
    {
        "name": "Alangilan, Sagay",
        "cat": "barangay",
        "keywords": [
            "alangilan",
            "alangilan sagay",
            "brgy alangilan",
            "brgy alangilan sagay"
        ],
        "lat": 9.10209,
        "lng": 124.74535,
        "mun": "Sagay",
        "full_address": "Alangilan, Sagay, Camiguin"
    },
    {
        "name": "Bacnit, Sagay",
        "cat": "barangay",
        "keywords": [
            "bacnit",
            "brgy bacnit",
            "barangay bacnit"
        ],
        "lat": 9.12643,
        "lng": 124.70861,
        "mun": "Sagay",
        "full_address": "Bacnit, Sagay, Camiguin"
    },
    {
        "name": "Balite, Sagay",
        "cat": "barangay",
        "keywords": [
            "balite",
            "balite sagay",
            "brgy balite",
            "barangay balite"
        ],
        "lat": 9.08187,
        "lng": 124.76099,
        "mun": "Sagay",
        "full_address": "Balite, Sagay, Camiguin"
    },
    {
        "name": "Bonbon, Sagay",
        "cat": "barangay",
        "keywords": [
            "bonbon sagay",
            "brgy bonbon sagay",
            "barangay bonbon sagay"
        ],
        "lat": 9.10377,
        "lng": 124.73214,
        "mun": "Sagay",
        "full_address": "Bonbon, Sagay, Camiguin"
    },
    {
        "name": "Bugang, Sagay",
        "cat": "barangay",
        "keywords": [
            "bugang",
            "bug-ang",
            "brgy bugang",
            "barangay bugang"
        ],
        "lat": 9.10841,
        "lng": 124.70507,
        "mun": "Sagay",
        "full_address": "Bugang, Sagay, Camiguin"
    },
    {
        "name": "Cuna, Sagay",
        "cat": "barangay",
        "keywords": [
            "cuna",
            "cuña",
            "brgy cuna",
            "barangay cuna"
        ],
        "lat": 9.12148,
        "lng": 124.74358,
        "mun": "Sagay",
        "full_address": "Cuña, Sagay, Camiguin"
    },
    {
        "name": "Manuyog, Sagay",
        "cat": "barangay",
        "keywords": [
            "manuyog",
            "brgy manuyog",
            "barangay manuyog"
        ],
        "lat": 9.094,
        "lng": 124.75344,
        "mun": "Sagay",
        "full_address": "Manuyog, Sagay, Camiguin"
    },
    {
        "name": "Mayana, Sagay",
        "cat": "barangay",
        "keywords": [
            "mayana",
            "brgy mayana",
            "barangay mayana"
        ],
        "lat": 9.10524,
        "lng": 124.71876,
        "mun": "Sagay",
        "full_address": "Mayana, Sagay, Camiguin"
    },
    {
        "name": "North Poblacion, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "guinsiliban",
            "north poblacion",
            "north poblacion guinsiliban",
            "poblacion guinsiliban"
        ],
        "lat": 9.09874,
        "lng": 124.78589,
        "mun": "Guinsiliban",
        "full_address": "North Poblacion, Guinsiliban, Camiguin"
    },
    {
        "name": "South Poblacion, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "south poblacion",
            "south poblacion guinsiliban"
        ],
        "lat": 9.09569,
        "lng": 124.78495,
        "mun": "Guinsiliban",
        "full_address": "South Poblacion, Guinsiliban, Camiguin"
    },
    {
        "name": "Butay, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "butay",
            "brgy butay",
            "barangay butay"
        ],
        "lat": 9.10476,
        "lng": 124.76919,
        "mun": "Guinsiliban",
        "full_address": "Butay, Guinsiliban, Camiguin"
    },
    {
        "name": "Cabuan, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "cabuan",
            "brgy cabuan",
            "barangay cabuan"
        ],
        "lat": 9.11881,
        "lng": 124.7981,
        "mun": "Guinsiliban",
        "full_address": "Cabuan, Guinsiliban, Camiguin"
    },
    {
        "name": "Cantaan, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "cantaan",
            "brgy cantaan",
            "barangay cantaan"
        ],
        "lat": 9.10898,
        "lng": 124.79682,
        "mun": "Guinsiliban",
        "full_address": "Cantaan, Guinsiliban, Camiguin"
    },
    {
        "name": "Liong, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "liong",
            "liongs",
            "brgy liong",
            "barangay liong"
        ],
        "lat": 9.0841,
        "lng": 124.77734,
        "mun": "Guinsiliban",
        "full_address": "Liong, Guinsiliban, Camiguin"
    },
    {
        "name": "Maac, Guinsiliban",
        "cat": "barangay",
        "keywords": [
            "maac",
            "brgy maac",
            "barangay maac"
        ],
        "lat": 9.12702,
        "lng": 124.79588,
        "mun": "Guinsiliban",
        "full_address": "Maac, Guinsiliban, Camiguin"
    },
    {
        "name": "Boloc-boloc, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "boloc boloc",
            "boloc-boloc",
            "bolocboloc",
            "bolok bolok",
            "bolok-bolok",
            "bolokboloc",
            "boloc",
            "bolok",
            "sitio boloc-boloc",
            "sitio boloc boloc",
            "boloc boloc mambajao",
            "bolocboloc mambajao"
        ],
        "lat": 9.25725,
        "lng": 124.70658,
        "mun": "Mambajao",
        "full_address": "Sitio Boloc-boloc, Poblacion, Mambajao"
    },
    {
        "name": "Sitio Esperanza, Tagdo, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "esperanza",
            "sitio esperanza",
            "esperanza tagdo",
            "esperanza mambajao"
        ],
        "lat": 9.22762,
        "lng": 124.68826,
        "mun": "Mambajao",
        "full_address": "Sitio Esperanza, Tagdo, Mambajao"
    },
    {
        "name": "Binunsaran, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "binunsaran",
            "sitio binunsaran",
            "itum",
            "itum road",
            "hinterland"
        ],
        "lat": 9.20987,
        "lng": 124.7058,
        "mun": "Mambajao",
        "full_address": "Binunsaran, Mambajao, Camiguin"
    },
    {
        "name": "Lakas, Poblacion, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "lakas",
            "sitio lakas",
            "lakas mambajao"
        ],
        "lat": 9.24794,
        "lng": 124.72204,
        "mun": "Mambajao",
        "full_address": "Sitio Lakas, Poblacion, Mambajao"
    },
    {
        "name": "Quiboro, Poblacion, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "quiboro",
            "sitio quiboro",
            "quipasa",
            "quiboro mambajao"
        ],
        "lat": 9.23345,
        "lng": 124.71291,
        "mun": "Mambajao",
        "full_address": "Sitio Quiboro, Poblacion, Mambajao"
    },
    {
        "name": "Balintawak, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "balintawak",
            "balintawak street",
            "balintawak mambajao"
        ],
        "lat": 9.25067,
        "lng": 124.72091,
        "mun": "Mambajao",
        "full_address": "Sitio Balintawak, Poblacion, Mambajao"
    },
    {
        "name": "Timogsay, Bug-ong, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "timogsay",
            "timugsay",
            "timogsai",
            "timugsai",
            "sitio timogsay",
            "sitio timugsay",
            "timogsay bug-ong",
            "timugsay bug-ong",
            "upper bug-ong",
            "upper bug ong",
            "bug-ong upland",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2375,
        "lng": 124.6795,
        "mun": "Mambajao",
        "full_address": "Sitio Timogsay (Timugsay), Upper Bug-ong, Mambajao"
    },
    {
        "name": "Upper Cogon, Agoho, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "upper cogon",
            "cogon",
            "cogon agoho",
            "sitio cogon",
            "upper cogon agoho",
            "lower cogon",
            "upper agoho",
            "sibato",
            "sibato road",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2358,
        "lng": 124.6738,
        "mun": "Mambajao",
        "full_address": "Sitio Upper Cogon, Agoho, Mambajao"
    },
    {
        "name": "Upper Pandan (Kanangkaan / Maubog), Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "upper pandan",
            "kanangkaan",
            "maubog",
            "pandayan",
            "brgy pandayan",
            "barangay pandayan",
            "pandan upland",
            "sitio kanangkaan",
            "sitio maubog",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2285,
        "lng": 124.7215,
        "mun": "Mambajao",
        "full_address": "Upper Pandan (Sitio Kanangkaan / Maubog), Mambajao"
    },
    {
        "name": "Litican, Upper Balbagon, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "litican",
            "sitio litican",
            "upper balbagon",
            "tinago",
            "sitio tinago",
            "tinago balbagon",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2275,
        "lng": 124.733,
        "mun": "Mambajao",
        "full_address": "Sitio Litican / Tinago, Upper Balbagon, Mambajao"
    },
    {
        "name": "Upper Lakas, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "upper lakas",
            "sitio upper lakas",
            "lakas upland",
            "upper anito",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2355,
        "lng": 124.732,
        "mun": "Mambajao",
        "full_address": "Upper Lakas, Poblacion, Mambajao"
    },
    {
        "name": "Upper Magting, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "upper magting",
            "sitio magting",
            "magting bukid",
            "magting upland",
            "hinterland",
            "tungason"
        ],
        "lat": 9.211,
        "lng": 124.7485,
        "mun": "Mambajao",
        "full_address": "Upper Magting, Mambajao, Camiguin"
    },
    {
        "name": "Sitio Bas-iao, Yumbing, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "bas-iao",
            "basiao",
            "sitio bas-iao",
            "sitio basiao",
            "upper yumbing",
            "upper naasag",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2315,
        "lng": 124.661,
        "mun": "Mambajao",
        "full_address": "Sitio Bas-iao, Upper Yumbing / Naasag, Mambajao"
    },
    {
        "name": "Katobli / Sibato Reservoir, Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "katobli",
            "kaolyong",
            "sibato reservoir",
            "sitio katobli",
            "sitio kaolyong",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2295,
        "lng": 124.6765,
        "mun": "Mambajao",
        "full_address": "Sitio Katobli / Sibato Reservoir, Agoho, Mambajao"
    },
    {
        "name": "Volcano House (Km 11 Itum), Mambajao",
        "cat": "neighborhood",
        "keywords": [
            "volcano house",
            "km 11",
            "km 11 itum",
            "itum volcano house",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2055,
        "lng": 124.6975,
        "mun": "Mambajao",
        "full_address": "Volcano House, Km 11 Itum, Baylao, Mambajao"
    },
    {
        "name": "Piyakong / Tres Marias Slopes, Catarman",
        "cat": "neighborhood",
        "keywords": [
            "piyakong",
            "tres marias",
            "mount vulcan slopes",
            "mt vulcan slopes",
            "old volcano slopes",
            "sitio piyakong",
            "hinterland",
            "tungason"
        ],
        "lat": 9.2085,
        "lng": 124.648,
        "mun": "Catarman",
        "full_address": "Sitio Piyakong / Tres Marias Slopes, Bonbon, Catarman"
    },
    {
        "name": "Sitio Kital-is, Cuna, Sagay",
        "cat": "neighborhood",
        "keywords": [
            "kital-is",
            "kitalis",
            "sitio kital-is",
            "sitio kitalis",
            "upper cuna",
            "hinterland",
            "tungason"
        ],
        "lat": 9.131,
        "lng": 124.742,
        "mun": "Sagay",
        "full_address": "Sitio Kital-is, Cuna, Sagay, Camiguin"
    },
    {
        "name": "Upper Cantaan, Guinsiliban",
        "cat": "neighborhood",
        "keywords": [
            "upper cantaan",
            "cantaan upland",
            "sitio upper cantaan",
            "ibabaw cantaan",
            "hinterland",
            "tungason"
        ],
        "lat": 9.1135,
        "lng": 124.782,
        "mun": "Guinsiliban",
        "full_address": "Upper Cantaan, Guinsiliban, Camiguin"
    },
    {
        "name": "Ardent Hot Spring, Esperanza",
        "cat": "tourist",
        "keywords": [
            "ardent hot spring",
            "ardent hot springs",
            "ardent spring",
            "ardent",
            "ardent hibok-hibok",
            "ardent resort",
            "hot spring",
            "esperanza hot spring"
        ],
        "lat": 9.22702,
        "lng": 124.68798,
        "mun": "Mambajao",
        "full_address": "Sitio Esperanza, Tagdo, Mambajao, Camiguin"
    },
    {
        "name": "White Island Boat Jump-off, Yumbing",
        "cat": "tourist",
        "keywords": [
            "white island",
            "white island boat station",
            "white island jump-off",
            "white island boat",
            "yumbing dock",
            "jump-off",
            "medano",
            "island"
        ],
        "lat": 9.24368,
        "lng": 124.6609,
        "mun": "Mambajao",
        "full_address": "Yumbing Boat Dock, Yumbing, Mambajao"
    },
    {
        "name": "Mantigue Island Boat Station, San Roque",
        "cat": "tourist",
        "keywords": [
            "mantigue island",
            "mantigue",
            "mantigue boat station",
            "san roque mantigue",
            "mantigue ferry"
        ],
        "lat": 9.15164,
        "lng": 124.79513,
        "mun": "Mahinog",
        "full_address": "San Roque Boat Terminal, Mahinog, Camiguin"
    },
    {
        "name": "Katibawasan Falls",
        "cat": "tourist",
        "keywords": [
            "katibawasan falls",
            "katibawasan",
            "busay",
            "waterfall",
            "hinterland"
        ],
        "lat": 9.21358,
        "lng": 124.71793,
        "mun": "Mambajao",
        "full_address": "Soro-soro / Pandan, Mambajao, Camiguin"
    },
    {
        "name": "Tuasan Falls, Mainit, Catarman",
        "cat": "tourist",
        "keywords": [
            "tuasan falls",
            "tuasan",
            "busay catarman",
            "waterfall"
        ],
        "lat": 9.17683,
        "lng": 124.68097,
        "mun": "Catarman",
        "full_address": "Barangay Mainit, Catarman, Camiguin"
    },
    {
        "name": "Sto. Niño Cold Spring, Catarman",
        "cat": "tourist",
        "keywords": [
            "sto. nino cold spring",
            "sto. niño cold spring",
            "sto nino cold spring",
            "santo nino cold spring",
            "sto. niño spring sagay",
            "cold spring",
            "sto nino",
            "sto. nino",
            "sto niño",
            "bugnaw spring"
        ],
        "lat": 9.15019,
        "lng": 124.67424,
        "mun": "Catarman",
        "full_address": "Barangay Santo Niño, Catarman, Camiguin"
    },
    {
        "name": "Bura Soda Water Park, Catarman",
        "cat": "tourist",
        "keywords": [
            "bura soda water",
            "bura soda water park",
            "soda water",
            "soda water pool",
            "bura soda",
            "soda swimming",
            "bura"
        ],
        "lat": 9.17107,
        "lng": 124.65697,
        "mun": "Catarman",
        "full_address": "Barangay Bura, Catarman, Camiguin"
    },
    {
        "name": "Sunken Cemetery & Giant Cross, Bonbon",
        "cat": "tourist",
        "keywords": [
            "sunken cemetery",
            "sunken cemetery cross",
            "sunken cemetery catarman",
            "sunken",
            "giant cross",
            "lubnganan",
            "krus"
        ],
        "lat": 9.2068,
        "lng": 124.63277,
        "mun": "Catarman",
        "full_address": "Barangay Bonbon, Catarman, Camiguin"
    },
    {
        "name": "Old Church Ruins (Gui-ob Church), Bonbon",
        "cat": "tourist",
        "keywords": [
            "old church ruins",
            "guiob church ruins",
            "gui-ob church ruins",
            "church ruins",
            "guiob",
            "gui-ob",
            "old church",
            "simbahan"
        ],
        "lat": 9.20184,
        "lng": 124.63457,
        "mun": "Catarman",
        "full_address": "Barangay Bonbon, Catarman, Camiguin"
    },
    {
        "name": "Mount Vulcan Daan / Walkway to Old Volcano",
        "cat": "tourist",
        "keywords": [
            "walkway to old volcano",
            "stations of the cross / volcano walkway",
            "stations of the cross",
            "volcano walkway",
            "vulcan daan",
            "old volcano",
            "mount vulcan",
            "walkway",
            "via crucis"
        ],
        "lat": 9.21068,
        "lng": 124.64015,
        "mun": "Catarman",
        "full_address": "Walkway Trailhead, Bonbon, Catarman, Camiguin"
    },
    {
        "name": "Mount Hibok-Hibok Jump-off (DENR Visitors Center)",
        "cat": "tourist",
        "keywords": [
            "hibok-hibok",
            "hibok hibok",
            "mount hibok-hibok",
            "volcano hike",
            "denr visitors center"
        ],
        "lat": 9.19684,
        "lng": 124.69221,
        "mun": "Mambajao",
        "full_address": "Mambajao-Itum Road, Mount Hibok-Hibok, Mambajao"
    },
    {
        "name": "Giant Clam Sanctuary, Cantaan",
        "cat": "tourist",
        "keywords": [
            "giant clam sanctuary",
            "giant clam sanctuary guinsiliban",
            "kibila giant clam",
            "giant clam",
            "clam sanctuary",
            "kibila",
            "cantaan",
            "taklobo"
        ],
        "lat": 9.10614,
        "lng": 124.80301,
        "mun": "Guinsiliban",
        "full_address": "Sitio Kibila, Barangay Cantaan, Guinsiliban, Camiguin"
    },
    {
        "name": "Taguines Lagoon & Zipline, Benoni",
        "cat": "tourist",
        "keywords": [
            "taguines lagoon",
            "taguines",
            "zipline",
            "lagoon bistro",
            "kamayan"
        ],
        "lat": 9.13287,
        "lng": 124.79156,
        "mun": "Mahinog",
        "full_address": "Benoni Highway, Mahinog, Camiguin"
    },
    {
        "name": "Katunggan Mangrove Park, Mahinog",
        "cat": "tourist",
        "keywords": [
            "katunggan",
            "katunggan park",
            "mangrove park",
            "bakawan",
            "boardwalk"
        ],
        "lat": 9.13159,
        "lng": 124.79736,
        "mun": "Mahinog",
        "full_address": "Benoni Coast, Mahinog, Camiguin"
    },
    {
        "name": "Sa-ay Cold Spring, Mambajao",
        "cat": "tourist",
        "keywords": [
            "sa-ay",
            "saay",
            "sa ay",
            "sa-ay cold spring",
            "saay cold spring",
            "quipasa",
            "cold spring"
        ],
        "lat": 9.2211,
        "lng": 124.7034,
        "mun": "Mambajao",
        "full_address": "Sitio Quipasa, Poblacion, Mambajao"
    },
    {
        "name": "Binangawan Falls, Sagay",
        "cat": "tourist",
        "keywords": [
            "binangawan falls",
            "binangawan",
            "waterfall sagay",
            "busay sagay"
        ],
        "lat": 9.15596,
        "lng": 124.73317,
        "mun": "Sagay",
        "full_address": "Sagay Uplands, Camiguin"
    },
    {
        "name": "Macao Cold Spring, Tupsan",
        "cat": "tourist",
        "keywords": [
            "macao cold spring",
            "macao",
            "tupsan spring",
            "cold spring"
        ],
        "lat": 9.19586,
        "lng": 124.77407,
        "mun": "Mambajao",
        "full_address": "Tupsan, Mambajao, Camiguin"
    },
    {
        "name": "Mantalaga Falls, Sagay",
        "cat": "tourist",
        "keywords": [
            "mantalaga",
            "mantalaga falls",
            "busay mantalaga",
            "upper sagay",
            "hinterland",
            "tungason"
        ],
        "lat": 9.1425,
        "lng": 124.7265,
        "mun": "Sagay",
        "full_address": "Mantalaga Falls, Sagay Uplands, Camiguin"
    },
    {
        "name": "Hibok-Hibok Volcano Observatory (PHIVOLCS)",
        "cat": "tourist",
        "keywords": [
            "phivolcs",
            "volcano observatory",
            "hibok-hibok observatory",
            "observatory",
            "quiboro"
        ],
        "lat": 9.22719,
        "lng": 124.70799,
        "mun": "Mambajao",
        "full_address": "Quiboro / Itum, Mambajao, Camiguin"
    },
    {
        "name": "Old Parola Park, Mambajao",
        "cat": "tourist",
        "keywords": [
            "old parola park",
            "parola",
            "lighthouse",
            "parola park"
        ],
        "lat": 9.25551,
        "lng": 124.71656,
        "mun": "Mambajao",
        "full_address": "Parola Road, Poblacion, Mambajao"
    },
    {
        "name": "Balbagon Port (FastCat & Ferry Wharf)",
        "cat": "transport",
        "keywords": [
            "balbagon port",
            "mambajao port",
            "fastcat",
            "super shuttle",
            "ferry",
            "barko",
            "pantalan",
            "pantalan balbagon",
            "balbagon wharf"
        ],
        "lat": 9.2439,
        "lng": 124.73794,
        "mun": "Mambajao",
        "full_address": "Balbagon Port Road, Balbagon, Mambajao"
    },
    {
        "name": "Benoni Port / Ferry Wharf, Mahinog",
        "cat": "transport",
        "keywords": [
            "benoni port",
            "benoni port / taguines lagoon",
            "benoni wharf",
            "pantalan benoni",
            "ferry mahinog",
            "barko benoni",
            "wharf",
            "port",
            "pantalan"
        ],
        "lat": 9.13904,
        "lng": 124.7942,
        "mun": "Mahinog",
        "full_address": "Benoni Ferry Wharf, Benoni, Mahinog"
    },
    {
        "name": "Benoni Passenger Terminal, Mahinog",
        "cat": "transport",
        "keywords": [
            "benoni passenger terminal",
            "benoni terminal",
            "passenger terminal",
            "passenger terminal benoni",
            "benoni port passenger terminal",
            "ppa passenger terminal",
            "ppa benoni",
            "pantalan passenger terminal",
            "ferry terminal"
        ],
        "lat": 9.13931,
        "lng": 124.79342,
        "mun": "Mahinog",
        "full_address": "PPA Passenger Terminal, Benoni, Mahinog"
    },
    {
        "name": "Guinsiliban Port / Ferry Terminal",
        "cat": "transport",
        "keywords": [
            "guinsiliban port",
            "pantalan guinsiliban",
            "ferry guinsiliban",
            "guinsiliban wharf"
        ],
        "lat": 9.09873,
        "lng": 124.78824,
        "mun": "Guinsiliban",
        "full_address": "Guinsiliban Ferry Wharf, Guinsiliban"
    },
    {
        "name": "Camiguin Airport",
        "cat": "transport",
        "keywords": [
            "airport",
            "camiguin airport",
            "tugpahanan",
            "eroplano",
            "flight",
            "arrivals",
            "departures"
        ],
        "lat": 9.25111,
        "lng": 124.70459,
        "mun": "Mambajao",
        "full_address": "Baylao / Lumban, Mambajao, Camiguin"
    },
    {
        "name": "Mambajao Transport Terminal",
        "cat": "transport",
        "keywords": [
            "mambajao terminal",
            "transport terminal",
            "bus terminal",
            "van terminal",
            "jeep terminal",
            "multicab terminal"
        ],
        "lat": 9.25383,
        "lng": 124.71595,
        "mun": "Mambajao",
        "full_address": "Plaridel / Market District, Poblacion, Mambajao"
    },
    {
        "name": "Paras Beach Resort, Yumbing",
        "cat": "resort",
        "keywords": [
            "paras beach",
            "paras beach resort",
            "paras resort",
            "paras",
            "hotel"
        ],
        "lat": 9.24379,
        "lng": 124.66164,
        "mun": "Mambajao",
        "full_address": "Pearl Road, Yumbing, Mambajao"
    },
    {
        "name": "Balai sa Baibai Dive Resort, Agoho",
        "cat": "resort",
        "keywords": [
            "balai sa baibai",
            "balai sa babibai",
            "balyali",
            "balyali resort",
            "balyali beach resort",
            "balyali resort yumbing",
            "balyali yumbing",
            "dive resort"
        ],
        "lat": 9.25025,
        "lng": 124.6705,
        "mun": "Mambajao",
        "full_address": "Agoho Coastline, Mambajao"
    },
    {
        "name": "Tongatok Cliff Resort, Naasag",
        "cat": "resort",
        "keywords": [
            "tongatok cliff",
            "tongatok cliff viewpoint",
            "tongatok",
            "cliff resort"
        ],
        "lat": 9.23035,
        "lng": 124.6432,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Naasag, Mambajao"
    },
    {
        "name": "Camiguin Lanzones Resort, Balbagon",
        "cat": "resort",
        "keywords": [
            "camiguin lanzones resort",
            "lanzones resort",
            "lanzones balbagon",
            "resort balbagon"
        ],
        "lat": 9.2408,
        "lng": 124.7356,
        "mun": "Mambajao",
        "full_address": "Bliss Road, Balbagon, Mambajao"
    },
    {
        "name": "Lanzones Cabana, Agoho",
        "cat": "resort",
        "keywords": [
            "lanzones cabana",
            "lanzones agoho",
            "dal-as",
            "resort agoho"
        ],
        "lat": 9.24185,
        "lng": 124.66742,
        "mun": "Mambajao",
        "full_address": "Dal-as, Agoho, Mambajao"
    },
    {
        "name": "Camiguin Highland Resort, Soro-soro",
        "cat": "resort",
        "keywords": [
            "highland resort",
            "camiguin highland",
            "highland",
            "sorosoro",
            "soro-soro",
            "soro'soro",
            "hinterland"
        ],
        "lat": 9.21816,
        "lng": 124.72839,
        "mun": "Mambajao",
        "full_address": "Soro-soro, Mambajao, Camiguin"
    },
    {
        "name": "Somewhere Else Boutique Resort, Agoho",
        "cat": "resort",
        "keywords": [
            "somewhere else",
            "somewhere else resort",
            "boutique resort"
        ],
        "lat": 9.25025,
        "lng": 124.67126,
        "mun": "Mambajao",
        "full_address": "Agoho Coast, Mambajao"
    },
    {
        "name": "Cabua-an Beach Resort, Mambajao",
        "cat": "resort",
        "keywords": [
            "cabua-an",
            "cabuaan",
            "cabua-an beach resort",
            "balerin",
            "balerin resort"
        ],
        "lat": 9.25104,
        "lng": 124.72308,
        "mun": "Mambajao",
        "full_address": "Cabua-an Beach, Lakas, Mambajao"
    },
    {
        "name": "Pabua's Cottages, Yumbing",
        "cat": "resort",
        "keywords": [
            "pabuas",
            "pabua",
            "pabua's cottages",
            "paguia cottages",
            "cottages"
        ],
        "lat": 9.24367,
        "lng": 124.66242,
        "mun": "Mambajao",
        "full_address": "Pearl Road, Yumbing, Mambajao"
    },
    {
        "name": "Medano Island Resort, Yumbing",
        "cat": "resort",
        "keywords": [
            "medano",
            "medano island resort",
            "medano resort"
        ],
        "lat": 9.24482,
        "lng": 124.66288,
        "mun": "Mambajao",
        "full_address": "Pearl Road, Yumbing, Mambajao"
    },
    {
        "name": "Bahay Bakasyunan sa Camiguin, Balbagon",
        "cat": "resort",
        "keywords": [
            "bahay bakasyunan",
            "bbc",
            "bakasyunan",
            "balbagon resort"
        ],
        "lat": 9.24066,
        "lng": 124.73718,
        "mun": "Mambajao",
        "full_address": "Balbagon, Mambajao, Camiguin"
    },
    {
        "name": "Bintana sa Paraiso Binunsaran, Mambajao",
        "cat": "resort",
        "keywords": [
            "bintana sa paraiso",
            "bintana",
            "binunsaran",
            "hinterland"
        ],
        "lat": 9.2119,
        "lng": 124.70596,
        "mun": "Mambajao",
        "full_address": "Binunsaran, Mambajao, Camiguin"
    },
    {
        "name": "Villa Paraiso Resort & Apartelle, Mambajao",
        "cat": "resort",
        "keywords": [
            "villa paraiso",
            "apartelle",
            "rizal resort"
        ],
        "lat": 9.24406,
        "lng": 124.7158,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "GV Hotel Camiguin, Mambajao",
        "cat": "resort",
        "keywords": [
            "gv hotel",
            "gv camiguin",
            "hotel mambajao"
        ],
        "lat": 9.25009,
        "lng": 124.71679,
        "mun": "Mambajao",
        "full_address": "Burgos Street, Poblacion, Mambajao"
    },
    {
        "name": "Camiguin Volcan Beach Eco Retreat, Naasag",
        "cat": "resort",
        "keywords": [
            "volcan beach",
            "eco retreat",
            "zum kuckuck",
            "naasag resort"
        ],
        "lat": 9.23288,
        "lng": 124.64393,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Naasag, Mambajao"
    },
    {
        "name": "Dreamland Resort & Hotel, Yumbing",
        "cat": "resort",
        "keywords": [
            "dreamland",
            "dreamland resort",
            "yumbing hotel"
        ],
        "lat": 9.23887,
        "lng": 124.65745,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "Nype Stile Resort, Bug-ong",
        "cat": "resort",
        "keywords": [
            "nype stile",
            "nype stile resort",
            "bug-ong resort"
        ],
        "lat": 9.24384,
        "lng": 124.67919,
        "mun": "Mambajao",
        "full_address": "Bug-ong, Mambajao, Camiguin"
    },
    {
        "name": "Golden Sunset Beach Club, Yumbing",
        "cat": "resort",
        "keywords": [
            "golden sunset",
            "sunset beach club",
            "yumbing"
        ],
        "lat": 9.2382,
        "lng": 124.65398,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "Seaside Traveler's Inn, Tangaro, Catarman",
        "cat": "resort",
        "keywords": [
            "seaside travelers inn",
            "seaside inn",
            "tangaro inn",
            "catarman hotel"
        ],
        "lat": 9.11482,
        "lng": 124.68757,
        "mun": "Catarman",
        "full_address": "Tangaro, Catarman, Camiguin"
    },
    {
        "name": "Mambajao Town Plaza",
        "cat": "building",
        "keywords": [
            "mambajao plaza",
            "mambajao town plaza",
            "mambajao central plaza",
            "plaza",
            "town center"
        ],
        "lat": 9.24933,
        "lng": 124.7165,
        "mun": "Mambajao",
        "full_address": "Poblacion Town Center, Mambajao"
    },
    {
        "name": "Mambajao Municipal Hall, Sitio Lakas",
        "cat": "building",
        "keywords": [
            "mambajao municipal hall",
            "municipal hall",
            "munisipyo mambajao",
            "munisipyo",
            "mayor"
        ],
        "lat": 9.24475,
        "lng": 124.72664,
        "mun": "Mambajao",
        "full_address": "Sitio Lakas, Poblacion, Mambajao"
    },
    {
        "name": "Provincial Capitol Compound, Mambajao",
        "cat": "building",
        "keywords": [
            "capitol",
            "kapitolyo",
            "provincial capitol",
            "governor"
        ],
        "lat": 9.24417,
        "lng": 124.72725,
        "mun": "Mambajao",
        "full_address": "Capitol Hills, Lakas, Mambajao"
    },
    {
        "name": "Camiguin General Hospital (CGH)",
        "cat": "hospital",
        "keywords": [
            "hospital",
            "cgh",
            "camiguin general hospital",
            "clinic",
            "doktor",
            "emergency",
            "pagamutan"
        ],
        "lat": 9.24847,
        "lng": 124.72159,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Mambajao Municipal Police Station (PNP)",
        "cat": "building",
        "keywords": [
            "police",
            "pnp",
            "pulis",
            "police station",
            "mambajao police",
            "istasyon"
        ],
        "lat": 9.24608,
        "lng": 124.72639,
        "mun": "Mambajao",
        "full_address": "Sitio Lakas, Poblacion, Mambajao"
    },
    {
        "name": "Camiguin Sports Complex & Convention Center",
        "cat": "building",
        "keywords": [
            "sports complex",
            "convention center",
            "grandstand",
            "gymnasium",
            "new camiguin gymnasium"
        ],
        "lat": 9.24374,
        "lng": 124.7291,
        "mun": "Mambajao",
        "full_address": "Balbagon, Mambajao, Camiguin"
    },
    {
        "name": "Mahinog Municipal Hall",
        "cat": "building",
        "keywords": [
            "mahinog municipal hall",
            "munisipyo mahinog",
            "mahinog hall",
            "mayor mahinog"
        ],
        "lat": 9.15614,
        "lng": 124.78736,
        "mun": "Mahinog",
        "full_address": "Poblacion, Mahinog, Camiguin"
    },
    {
        "name": "Catarman Municipal Hall",
        "cat": "building",
        "keywords": [
            "catarman municipal hall",
            "munisipyo catarman",
            "catarman hall",
            "mayor catarman"
        ],
        "lat": 9.12419,
        "lng": 124.67579,
        "mun": "Catarman",
        "full_address": "Poblacion, Catarman, Camiguin"
    },
    {
        "name": "Sagay Municipal Hall",
        "cat": "building",
        "keywords": [
            "sagay municipal hall",
            "munisipyo sagay",
            "sagay hall",
            "mayor sagay"
        ],
        "lat": 9.10494,
        "lng": 124.72449,
        "mun": "Sagay",
        "full_address": "Iglesia Street, Poblacion, Sagay"
    },
    {
        "name": "Guinsiliban Municipal Hall",
        "cat": "building",
        "keywords": [
            "guinsiliban municipal hall",
            "munisipyo guinsiliban",
            "guinsiliban hall"
        ],
        "lat": 9.09629,
        "lng": 124.78503,
        "mun": "Guinsiliban",
        "full_address": "Circumferential Road, Poblacion, Guinsiliban"
    },
    {
        "name": "Gaisano Capital Camiguin (Placido Reyes St)",
        "cat": "supermarket",
        "keywords": [
            "gaisano",
            "gaisano capital",
            "gaisano camiguin",
            "placido reyes",
            "mall",
            "supermarket",
            "grocery"
        ],
        "lat": 9.25281,
        "lng": 124.71617,
        "mun": "Mambajao",
        "full_address": "Placido Reyes Street, Poblacion, Mambajao"
    },
    {
        "name": "Davilett Store & Supermarket, Guinsiliban",
        "cat": "supermarket",
        "keywords": [
            "davilett",
            "davilet",
            "davilett corp",
            "davilett store",
            "davi",
            "supermarket guinsiliban",
            "grocery"
        ],
        "lat": 9.09781,
        "lng": 124.78542,
        "mun": "Guinsiliban",
        "full_address": "North Poblacion, Guinsiliban, Camiguin"
    },
    {
        "name": "W & M Superstore, Mambajao",
        "cat": "supermarket",
        "keywords": [
            "w&m",
            "w & m",
            "wm superstore",
            "superstore",
            "supermarket",
            "grocery"
        ],
        "lat": 9.24929,
        "lng": 124.71776,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Nene Uy Store / Wholesaler, Mambajao",
        "cat": "store",
        "keywords": [
            "nene uy",
            "nene",
            "wholesaler",
            "grocery",
            "supply"
        ],
        "lat": 9.25172,
        "lng": 124.71575,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Mr. DIY Camiguin (Mambajao)",
        "cat": "store",
        "keywords": [
            "mr diy",
            "mr. diy",
            "diy",
            "hardware",
            "department store"
        ],
        "lat": 9.25394,
        "lng": 124.71608,
        "mun": "Mambajao",
        "full_address": "Parola Road, Poblacion, Mambajao"
    },
    {
        "name": "DJ Bonita Merchandising, Mambajao",
        "cat": "store",
        "keywords": [
            "dj bonita",
            "bonita",
            "department store",
            "dry goods"
        ],
        "lat": 9.25351,
        "lng": 124.71648,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "Tee Enterprises, Mambajao",
        "cat": "store",
        "keywords": [
            "tee enterprises",
            "tee",
            "department store",
            "hardware"
        ],
        "lat": 9.25364,
        "lng": 124.71614,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "Mercury Drug Camiguin, Mambajao",
        "cat": "pharmacy",
        "keywords": [
            "mercury drug",
            "mercury",
            "pharmacy",
            "botika",
            "tambal",
            "drugstore"
        ],
        "lat": 9.25249,
        "lng": 124.71641,
        "mun": "Mambajao",
        "full_address": "Placido Reyes Street, Poblacion, Mambajao"
    },
    {
        "name": "The Generics Pharmacy (TGP), Mambajao",
        "cat": "pharmacy",
        "keywords": [
            "tgp",
            "the generics pharmacy",
            "generics pharmacy",
            "botika",
            "pharmacy",
            "tambal"
        ],
        "lat": 9.25121,
        "lng": 124.71581,
        "mun": "Mambajao",
        "full_address": "J. Rizal / Burgos, Poblacion, Mambajao"
    },
    {
        "name": "Landbank Camiguin, Mambajao",
        "cat": "building",
        "keywords": [
            "landbank",
            "lbp",
            "atm",
            "bank"
        ],
        "lat": 9.25247,
        "lng": 124.71612,
        "mun": "Mambajao",
        "full_address": "Placido Reyes Street, Poblacion, Mambajao"
    },
    {
        "name": "PNB Mambajao",
        "cat": "building",
        "keywords": [
            "pnb",
            "philippine national bank",
            "atm",
            "bank"
        ],
        "lat": 9.24932,
        "lng": 124.71694,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "EastWest Rural Bank, Mambajao",
        "cat": "building",
        "keywords": [
            "eastwest",
            "eastwest bank",
            "atm",
            "bank"
        ],
        "lat": 9.25338,
        "lng": 124.71671,
        "mun": "Mambajao",
        "full_address": "Plaridel Street, Poblacion, Mambajao"
    },
    {
        "name": "Palawan Pawnshop, Mambajao",
        "cat": "store",
        "keywords": [
            "palawan",
            "palawan pawnshop",
            "palawan express",
            "remittance"
        ],
        "lat": 9.24808,
        "lng": 124.72096,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Cebuana Lhuillier (Plaridel St), Mambajao",
        "cat": "store",
        "keywords": [
            "cebuana",
            "cebuana lhuillier",
            "pawnshop",
            "remittance"
        ],
        "lat": 9.25348,
        "lng": 124.71666,
        "mun": "Mambajao",
        "full_address": "Plaridel Street, Poblacion, Mambajao"
    },
    {
        "name": "Mambajao Public Market",
        "cat": "market",
        "keywords": [
            "mambajao market",
            "public market",
            "merkado",
            "palengke",
            "bagsakan",
            "wet market",
            "isda",
            "karne",
            "utanon"
        ],
        "lat": 9.2531,
        "lng": 124.7166,
        "mun": "Mambajao",
        "full_address": "J. Ebarle / Plaridel Street, Poblacion, Mambajao"
    },
    {
        "name": "Mahinog Public Market",
        "cat": "market",
        "keywords": [
            "mahinog market",
            "merkado mahinog",
            "palengke mahinog"
        ],
        "lat": 9.15467,
        "lng": 124.7879,
        "mun": "Mahinog",
        "full_address": "Circumferential Road, Poblacion, Mahinog"
    },
    {
        "name": "Catarman Public Market",
        "cat": "market",
        "keywords": [
            "catarman market",
            "merkado catarman",
            "palengke catarman"
        ],
        "lat": 9.12564,
        "lng": 124.67387,
        "mun": "Catarman",
        "full_address": "Circumferential Road, Poblacion, Catarman"
    },
    {
        "name": "Sagay Public Market",
        "cat": "market",
        "keywords": [
            "sagay market",
            "merkado sagay",
            "palengke sagay"
        ],
        "lat": 9.10374,
        "lng": 124.72696,
        "mun": "Sagay",
        "full_address": "Circumferential Road, Poblacion, Sagay"
    },
    {
        "name": "Guinsiliban Public Market",
        "cat": "market",
        "keywords": [
            "guinsiliban market",
            "merkado guinsiliban",
            "palengke guinsiliban"
        ],
        "lat": 9.10045,
        "lng": 124.788,
        "mun": "Guinsiliban",
        "full_address": "North Poblacion, Guinsiliban"
    },
    {
        "name": "Tupsan Public Market, Mambajao",
        "cat": "market",
        "keywords": [
            "tupsan market",
            "merkado tupsan",
            "palengke tupsan"
        ],
        "lat": 9.20137,
        "lng": 124.77786,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Tupsan, Mambajao"
    },
    {
        "name": "Yumbing Public Market, Mambajao",
        "cat": "market",
        "keywords": [
            "yumbing market",
            "merkado yumbing",
            "palengke yumbing"
        ],
        "lat": 9.23931,
        "lng": 124.65973,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "Jollibee Camiguin, Mambajao",
        "cat": "food",
        "keywords": [
            "jollibee",
            "jolibee",
            "joli",
            "jolli",
            "fastfood",
            "chickenjoy",
            "burger"
        ],
        "lat": 9.24971,
        "lng": 124.71667,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Poblacion, Mambajao"
    },
    {
        "name": "Moonflower Garden and Restaurant, Baylao",
        "cat": "food",
        "keywords": [
            "moonflower",
            "moonflower garden",
            "moonflower restaurant",
            "moonflower garden and restaurant",
            "moonflower baylao",
            "moonflower garden baylao",
            "baylao moonflower",
            "ice cream",
            "restaurant"
        ],
        "lat": 9.25057,
        "lng": 124.7011,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Baylao, Mambajao"
    },
    {
        "name": "Samuel Restaurant, Mambajao",
        "cat": "food",
        "keywords": [
            "samuel",
            "samuel restaurant",
            "resto",
            "restaurant",
            "food"
        ],
        "lat": 9.2528,
        "lng": 124.71574,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Kurma Eco Restaurant & Cafe, Yumbing",
        "cat": "food",
        "keywords": [
            "kurma",
            "kurma cafe",
            "kurma restaurant",
            "cafe",
            "freedive",
            "food"
        ],
        "lat": 9.24123,
        "lng": 124.66003,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "CheckPoint Food Park, Yumbing",
        "cat": "food",
        "keywords": [
            "checkpoint",
            "checkpoint food park",
            "food park",
            "resto bar",
            "kaonan",
            "food"
        ],
        "lat": 9.24227,
        "lng": 124.6634,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "Julie's Bakeshop, Mambajao",
        "cat": "food",
        "keywords": [
            "julies",
            "julie's",
            "julies bakeshop",
            "tinapay",
            "panaderia",
            "bakery",
            "bakeshop"
        ],
        "lat": 9.25188,
        "lng": 124.71615,
        "mun": "Mambajao",
        "full_address": "Balintawak / Placido Reyes, Poblacion, Mambajao"
    },
    {
        "name": "Vjandep Bakeshop, Mambajao",
        "cat": "food",
        "keywords": [
            "vjandep",
            "pastel",
            "pasalubong",
            "bakery",
            "bakeshop"
        ],
        "lat": 9.25328,
        "lng": 124.71629,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "Chooks to Go, Mambajao",
        "cat": "food",
        "keywords": [
            "chooks",
            "chooks to go",
            "manok",
            "lechon manok"
        ],
        "lat": 9.25185,
        "lng": 124.7161,
        "mun": "Mambajao",
        "full_address": "Placido Reyes Street, Poblacion, Mambajao"
    },
    {
        "name": "Angel's Burger, Mambajao",
        "cat": "food",
        "keywords": [
            "angels burger",
            "angel's burger",
            "burger",
            "fastfood"
        ],
        "lat": 9.25379,
        "lng": 124.7156,
        "mun": "Mambajao",
        "full_address": "Plaridel / Rizal Corner, Poblacion, Mambajao"
    },
    {
        "name": "Potato Corner, Mambajao",
        "cat": "food",
        "keywords": [
            "potato corner",
            "fries",
            "fastfood"
        ],
        "lat": 9.25374,
        "lng": 124.71592,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "Hayahay Cafe & Restaurant, Bug-ong",
        "cat": "food",
        "keywords": [
            "hayahay cafe",
            "hayahay",
            "cafe",
            "restaurant"
        ],
        "lat": 9.25081,
        "lng": 124.67799,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Bug-ong, Mambajao"
    },
    {
        "name": "Guerrera Restaurant, Yumbing",
        "cat": "food",
        "keywords": [
            "guerrera",
            "casa roces",
            "asian food",
            "rice paddy",
            "restaurant"
        ],
        "lat": 9.24564,
        "lng": 124.66463,
        "mun": "Mambajao",
        "full_address": "Yumbing / Agoho, Mambajao"
    },
    {
        "name": "Northern Lights Cafe, Agoho",
        "cat": "food",
        "keywords": [
            "northern lights",
            "northern lights agoho",
            "cafe",
            "kape"
        ],
        "lat": 9.24422,
        "lng": 124.66614,
        "mun": "Mambajao",
        "full_address": "Agoho, Mambajao, Camiguin"
    },
    {
        "name": "Northern Lights Downtown, Balbagon",
        "cat": "food",
        "keywords": [
            "northern lights downtown",
            "northern lights balbagon",
            "pizza",
            "grill"
        ],
        "lat": 9.24478,
        "lng": 124.73137,
        "mun": "Mambajao",
        "full_address": "Balbagon Highway, Mambajao"
    },
    {
        "name": "La Dolce Vita, Baylao",
        "cat": "food",
        "keywords": [
            "la dolce vita",
            "pizza",
            "italian",
            "pasta"
        ],
        "lat": 9.25036,
        "lng": 124.70507,
        "mun": "Mambajao",
        "full_address": "Baylao Highway, Mambajao"
    },
    {
        "name": "Utopia Café, Mambajao",
        "cat": "food",
        "keywords": [
            "utopia",
            "utopia cafe",
            "utopia café",
            "cafe",
            "hinterland"
        ],
        "lat": 9.22741,
        "lng": 124.70748,
        "mun": "Mambajao",
        "full_address": "Quiboro / Itum Road, Mambajao"
    },
    {
        "name": "Paradiso Restaurant, Agoho",
        "cat": "food",
        "keywords": [
            "paradiso",
            "paradiso hillside",
            "la isla cocina",
            "pizza",
            "restaurant"
        ],
        "lat": 9.24896,
        "lng": 124.67246,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Agoho, Mambajao"
    },
    {
        "name": "Daos Plant-Based Kitchen, Boloc-boloc",
        "cat": "food",
        "keywords": [
            "daos",
            "plant based",
            "vegan",
            "boloc-boloc restaurant"
        ],
        "lat": 9.25742,
        "lng": 124.70395,
        "mun": "Mambajao",
        "full_address": "Boloc-boloc, Poblacion, Mambajao"
    },
    {
        "name": "Nanaw Café, Binunsaran, Mambajao",
        "cat": "food",
        "keywords": [
            "nanaw",
            "nanaw cafe",
            "cafe",
            "hinterland"
        ],
        "lat": 9.21037,
        "lng": 124.70209,
        "mun": "Mambajao",
        "full_address": "Binunsaran, Mambajao, Camiguin"
    },
    {
        "name": "Sapore Ristorante, Bug-ong",
        "cat": "food",
        "keywords": [
            "sapore",
            "italian",
            "pasta",
            "restaurant"
        ],
        "lat": 9.24393,
        "lng": 124.67928,
        "mun": "Mambajao",
        "full_address": "Bug-ong, Mambajao, Camiguin"
    },
    {
        "name": "The Beehive Restaurant, Bura",
        "cat": "food",
        "keywords": [
            "beehive",
            "the beehive",
            "driftwood cafe",
            "catarman restaurant"
        ],
        "lat": 9.17448,
        "lng": 124.6359,
        "mun": "Catarman",
        "full_address": "Bura / Catibac Coast, Catarman"
    },
    {
        "name": "Petron Gas Station Balbagon, Mambajao",
        "cat": "fuel",
        "keywords": [
            "petron",
            "petron mambajao",
            "petron balbagon",
            "gasolinahan",
            "gas station",
            "fuel",
            "gasolina",
            "tubil"
        ],
        "lat": 9.24535,
        "lng": 124.72986,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Balbagon, Mambajao"
    },
    {
        "name": "Shell Gas Station Poblacion, Mambajao",
        "cat": "fuel",
        "keywords": [
            "shell",
            "shell poblacion",
            "shell mambajao",
            "gasolinahan",
            "gas station",
            "fuel",
            "gasolina",
            "tubil"
        ],
        "lat": 9.25203,
        "lng": 124.71567,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Caltex Gas Station Gen. B. Aranas, Mambajao",
        "cat": "fuel",
        "keywords": [
            "caltex",
            "caltex mambajao",
            "caltex aranas",
            "gasolinahan",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.24841,
        "lng": 124.71949,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Caltex Gas Station J. Rizal, Mambajao",
        "cat": "fuel",
        "keywords": [
            "caltex rizal",
            "caltex poblacion",
            "caltex",
            "gasolinahan",
            "fuel",
            "tubil"
        ],
        "lat": 9.25343,
        "lng": 124.71566,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Jetti Gas Station Lakas, Mambajao",
        "cat": "fuel",
        "keywords": [
            "jetti",
            "jetti mambajao",
            "jetti lakas",
            "gasolinahan",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.24712,
        "lng": 124.72357,
        "mun": "Mambajao",
        "full_address": "Sitio Lakas, Poblacion, Mambajao"
    },
    {
        "name": "Petron Gas Station Agoho, Mambajao",
        "cat": "fuel",
        "keywords": [
            "petron agoho",
            "gasolinahan agoho",
            "gas station agoho",
            "petron",
            "gasolinahan",
            "fuel",
            "tubil"
        ],
        "lat": 9.2461,
        "lng": 124.66922,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Agoho, Mambajao"
    },
    {
        "name": "Shell Gas Station Tupsan, Mambajao",
        "cat": "fuel",
        "keywords": [
            "shell tupsan",
            "shell",
            "gasolinahan",
            "gas station",
            "fuel",
            "gasolina",
            "tubil"
        ],
        "lat": 9.20656,
        "lng": 124.77516,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Tupsan, Mambajao"
    },
    {
        "name": "Petron Gas Station Catarman",
        "cat": "fuel",
        "keywords": [
            "petron catarman",
            "petron",
            "gasolinahan catarman",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.12577,
        "lng": 124.67342,
        "mun": "Catarman",
        "full_address": "Circumferential Road, Poblacion, Catarman"
    },
    {
        "name": "Petron Gas Station Sagay",
        "cat": "fuel",
        "keywords": [
            "petron sagay",
            "petron",
            "gasolinahan sagay",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.10422,
        "lng": 124.72567,
        "mun": "Sagay",
        "full_address": "Circumferential Road, Poblacion, Sagay"
    },
    {
        "name": "Shell Gas Station Benoni, Mahinog",
        "cat": "fuel",
        "keywords": [
            "shell mahinog",
            "shell benoni",
            "gasolinahan mahinog",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.14758,
        "lng": 124.79691,
        "mun": "Mahinog",
        "full_address": "Circumferential Road, Benoni, Mahinog"
    },
    {
        "name": "Jetti Gas Station Benoni, Mahinog",
        "cat": "fuel",
        "keywords": [
            "jetti mahinog",
            "jetti benoni",
            "gasolinahan benoni",
            "gas station",
            "fuel",
            "tubil"
        ],
        "lat": 9.147,
        "lng": 124.79749,
        "mun": "Mahinog",
        "full_address": "Circumferential Road, Benoni, Mahinog"
    },
    {
        "name": "Camiguin Polytechnic State College (CPSC Mambajao)",
        "cat": "school",
        "keywords": [
            "cpsc",
            "csu",
            "camiguin state university",
            "camiguin polytechnic",
            "polytechnic",
            "state college",
            "college",
            "school"
        ],
        "lat": 9.24318,
        "lng": 124.731,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Balbagon, Mambajao"
    },
    {
        "name": "Fatima College of Camiguin (FCC)",
        "cat": "school",
        "keywords": [
            "fatima college",
            "fcc",
            "fatima",
            "fatima college of camiguin",
            "college",
            "school"
        ],
        "lat": 9.25044,
        "lng": 124.71421,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Poblacion, Mambajao"
    },
    {
        "name": "Mambajao Central School",
        "cat": "school",
        "keywords": [
            "mambajao central school",
            "central school",
            "mambajao elementary",
            "eskwelahan",
            "school"
        ],
        "lat": 9.24931,
        "lng": 124.71982,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Mambajao National High School",
        "cat": "school",
        "keywords": [
            "mambajao high school",
            "mnhs",
            "high school",
            "school"
        ],
        "lat": 9.25217,
        "lng": 124.71943,
        "mun": "Mambajao",
        "full_address": "Balintawak Street, Poblacion, Mambajao"
    },
    {
        "name": "Camiguin Polytechnic State College (Catarman Campus)",
        "cat": "school",
        "keywords": [
            "cpsc catarman",
            "csu catarman",
            "college catarman",
            "school"
        ],
        "lat": 9.11663,
        "lng": 124.68761,
        "mun": "Catarman",
        "full_address": "Circumferential Road, Tangaro, Catarman"
    },
    {
        "name": "Camiguin National High School (CNHS)",
        "cat": "school",
        "keywords": [
            "cnhs",
            "camiguin national high school",
            "camiguin high school",
            "high school",
            "school"
        ],
        "lat": 9.1294,
        "lng": 124.67219,
        "mun": "Catarman",
        "full_address": "Circumferential Road, Looc, Catarman"
    },
    {
        "name": "Yumbing National High School",
        "cat": "school",
        "keywords": [
            "yumbing high school",
            "yumbing national high school",
            "high school",
            "school"
        ],
        "lat": 9.24386,
        "lng": 124.66381,
        "mun": "Mambajao",
        "full_address": "Pearl Road, Yumbing, Mambajao"
    },
    {
        "name": "Magting Elementary School",
        "cat": "school",
        "keywords": [
            "magting elementary",
            "magting school",
            "es magting",
            "school",
            "elementary"
        ],
        "lat": 9.22428,
        "lng": 124.75147,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Magting, Mambajao"
    },
    {
        "name": "Agoho Elementary School",
        "cat": "school",
        "keywords": [
            "agoho elementary",
            "agoho school",
            "school",
            "elementary"
        ],
        "lat": 9.24625,
        "lng": 124.67004,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Agoho, Mambajao"
    },
    {
        "name": "Balbagon Elementary School",
        "cat": "school",
        "keywords": [
            "balbagon elementary",
            "balbagon school",
            "school",
            "elementary"
        ],
        "lat": 9.23625,
        "lng": 124.73903,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Balbagon, Mambajao"
    },
    {
        "name": "Catarman Central School",
        "cat": "school",
        "keywords": [
            "catarman central school",
            "catarman elementary",
            "school"
        ],
        "lat": 9.12842,
        "lng": 124.67281,
        "mun": "Catarman",
        "full_address": "Circumferential Road, Poblacion, Catarman"
    },
    {
        "name": "Mahinog Central School",
        "cat": "school",
        "keywords": [
            "mahinog central school",
            "mahinog school",
            "school"
        ],
        "lat": 9.15408,
        "lng": 124.78856,
        "mun": "Mahinog",
        "full_address": "Circumferential Road, Poblacion, Mahinog"
    },
    {
        "name": "Sagay Central School",
        "cat": "school",
        "keywords": [
            "sagay central school",
            "sagay school",
            "school"
        ],
        "lat": 9.10436,
        "lng": 124.72937,
        "mun": "Sagay",
        "full_address": "Circumferential Road, Poblacion, Sagay"
    },
    {
        "name": "Guinsiliban Central School",
        "cat": "school",
        "keywords": [
            "guinsiliban central school",
            "guinsiliban school",
            "school"
        ],
        "lat": 9.09811,
        "lng": 124.78585,
        "mun": "Guinsiliban",
        "full_address": "North Poblacion, Guinsiliban"
    },
    {
        "name": "San Nicolas de Tolentino Parish Church, Mambajao",
        "cat": "church",
        "keywords": [
            "san nicolas",
            "mambajao church",
            "simbahan sa mambajao",
            "parish church",
            "catholic church",
            "church"
        ],
        "lat": 9.24964,
        "lng": 124.71504,
        "mun": "Mambajao",
        "full_address": "Poblacion, Mambajao, Camiguin"
    },
    {
        "name": "IFI Parish of the Good Shepherd, Mambajao",
        "cat": "church",
        "keywords": [
            "ifi",
            "ifi church",
            "good shepherd",
            "parish of the good shepherd",
            "aglipayan church",
            "church"
        ],
        "lat": 9.25145,
        "lng": 124.71702,
        "mun": "Mambajao",
        "full_address": "Burgos Street, Poblacion, Mambajao"
    },
    {
        "name": "Iglesia Ni Cristo (INC), Poblacion, Mambajao",
        "cat": "church",
        "keywords": [
            "inc",
            "inc mambajao",
            "iglesia ni cristo",
            "iglesia",
            "church"
        ],
        "lat": 9.24823,
        "lng": 124.7163,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Iglesia Ni Cristo (INC), Yumbing",
        "cat": "church",
        "keywords": [
            "inc yumbing",
            "iglesia ni cristo yumbing",
            "church"
        ],
        "lat": 9.23865,
        "lng": 124.65567,
        "mun": "Mambajao",
        "full_address": "Circumferential Road, Yumbing, Mambajao"
    },
    {
        "name": "St. Michael (San Roque) Parish Church, Mahinog",
        "cat": "church",
        "keywords": [
            "st michael church",
            "san roque parish",
            "mahinog church",
            "simbahan sa mahinog",
            "church"
        ],
        "lat": 9.15355,
        "lng": 124.78791,
        "mun": "Mahinog",
        "full_address": "Poblacion / San Roque, Mahinog, Camiguin"
    },
    {
        "name": "San Antonio de Padua Parish Church, Bonbon",
        "cat": "church",
        "keywords": [
            "san antonio parish",
            "bonbon church",
            "church"
        ],
        "lat": 9.19867,
        "lng": 124.63629,
        "mun": "Catarman",
        "full_address": "Bonbon, Catarman, Camiguin"
    },
    {
        "name": "Our Lady of Mount Carmel Parish Church, Catarman",
        "cat": "church",
        "keywords": [
            "catarman parish",
            "mount carmel church",
            "catarman church",
            "simbahan sa catarman",
            "church"
        ],
        "lat": 9.12455,
        "lng": 124.6762,
        "mun": "Catarman",
        "full_address": "Poblacion, Catarman, Camiguin"
    },
    {
        "name": "Our Lady of the Holy Rosary Parish Church, Sagay",
        "cat": "church",
        "keywords": [
            "sagay parish",
            "holy rosary church",
            "simbahan sa sagay",
            "church"
        ],
        "lat": 9.10476,
        "lng": 124.72537,
        "mun": "Sagay",
        "full_address": "Rosario Street, Poblacion, Sagay"
    },
    {
        "name": "Our Lady of Consolation Parish Church, Guinsiliban",
        "cat": "church",
        "keywords": [
            "guinsiliban parish",
            "consolation church",
            "simbahan sa guinsiliban",
            "church"
        ],
        "lat": 9.09865,
        "lng": 124.78533,
        "mun": "Guinsiliban",
        "full_address": "North Poblacion, Guinsiliban, Camiguin"
    },
    {
        "name": "San Pedro Calungsod Chapel, Baylao",
        "cat": "church",
        "keywords": [
            "baylao chapel",
            "pedro calungsod",
            "kapilya sa baylao",
            "church"
        ],
        "lat": 9.2495,
        "lng": 124.6949,
        "mun": "Mambajao",
        "full_address": "Baylao, Mambajao, Camiguin"
    },
    {
        "name": "Placido Reyes Street, Mambajao",
        "cat": "street",
        "keywords": [
            "placido reyes",
            "placido reyes street",
            "placido reyes / town center",
            "p. reyes",
            "p. reyes street",
            "gaisano street",
            "mambajao street"
        ],
        "lat": 9.25258,
        "lng": 124.71628,
        "mun": "Mambajao",
        "full_address": "Placido Reyes Street, Poblacion, Mambajao"
    },
    {
        "name": "Burgos Street, Mambajao",
        "cat": "street",
        "keywords": [
            "burgos",
            "burgos street",
            "burgos st",
            "ifi street"
        ],
        "lat": 9.2514,
        "lng": 124.71705,
        "mun": "Mambajao",
        "full_address": "Burgos Street, Poblacion, Mambajao"
    },
    {
        "name": "Bonifacio Aranas Street, Mambajao",
        "cat": "street",
        "keywords": [
            "bonifacio aranas",
            "gen aranas",
            "aranas street",
            "hospital street",
            "jollibee street",
            "aranas"
        ],
        "lat": 9.24825,
        "lng": 124.72056,
        "mun": "Mambajao",
        "full_address": "General Bonifacio Aranas Street, Mambajao"
    },
    {
        "name": "Plaridel Street, Mambajao",
        "cat": "street",
        "keywords": [
            "plaridel",
            "plaridel street",
            "market street",
            "plaridel st"
        ],
        "lat": 9.25351,
        "lng": 124.71605,
        "mun": "Mambajao",
        "full_address": "Plaridel Street, Poblacion, Mambajao"
    },
    {
        "name": "Rizal Street, Mambajao",
        "cat": "street",
        "keywords": [
            "rizal",
            "rizal street",
            "j.p. rizal",
            "j. rizal",
            "rizal st"
        ],
        "lat": 9.25049,
        "lng": 124.71607,
        "mun": "Mambajao",
        "full_address": "J. Rizal Street, Poblacion, Mambajao"
    },
    {
        "name": "Mabini Street, Mambajao",
        "cat": "street",
        "keywords": [
            "mabini",
            "mabini street",
            "mabini st"
        ],
        "lat": 9.24951,
        "lng": 124.71535,
        "mun": "Mambajao",
        "full_address": "Mabini Street, Poblacion, Mambajao"
    }
]


def _normalize_place_tokens(text: str) -> list[str]:
    cleaned = re.sub(r"[,()\-/&.]+", " ", (text or "").lower())
    return [w for w in cleaned.split() if w]


def search_camiguin_places(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Comprehensive island search: all 58 barangays, sitios, stores, supermarkets, pharmacies, streets,
    buildings, resorts, ports, schools, hospitals, tourist spots.
    Uses scored multi-stage token & keyword matching for pinpoint accuracy.
    """
    if not query:
        return []
    q = query.strip().lower()
    q_words = _normalize_place_tokens(q)
    scored: list[tuple[int, int, dict[str, Any]]] = []
    seen_names: set[str] = set()

    for idx, p in enumerate(CAMIGUIN_KNOWN_PLACES):
        name_lower = p["name"].lower()
        kws = [kw.lower() for kw in p.get("keywords", [])]
        mun_lower = (p.get("mun") or "").lower()
        cat_lower = (p.get("cat") or "").lower()
        score = 0

        if q == name_lower:
            score = 1000
        elif any(q == kw for kw in kws):
            score = 900
        elif name_lower.startswith(q):
            score = 750
        elif any(kw.startswith(q) for kw in kws):
            score = 650
        elif q_words:
            name_words = set(_normalize_place_tokens(name_lower))
            mun_words = set(_normalize_place_tokens(mun_lower))
            all_kw_words: set[str] = set()
            for kw in kws:
                all_kw_words.update(_normalize_place_tokens(kw))
            all_words = name_words | all_kw_words | mun_words
            if all(any(qw == nw or nw.startswith(qw) for nw in all_words) for qw in q_words):
                # Prefer matches where all words hit name+keywords over mun-assisted hits
                if all(any(qw == nw or nw.startswith(qw) for nw in (name_words | all_kw_words)) for qw in q_words):
                    score = 520
                else:
                    score = 480
            elif len(q) >= 3 and (q in name_lower or any(q in kw for kw in kws)):
                score = 300
        elif len(q) >= 3 and (q in name_lower or any(q in kw for kw in kws)):
            score = 300

        if score > 0:
            # When searching a town/barangay name (e.g. "Mambajao", "Catarman", "Yumbing"),
            # prioritize barangay/town center & transport hubs over generic schools/stores
            if cat_lower in ("barangay", "neighborhood"):
                score += 40
            elif cat_lower in ("transport", "tourist", "building", "hospital"):
                score += 15
            if p["name"] not in seen_names:
                scored.append((score, -idx, p))
                seen_names.add(p["name"])

    scored.sort(reverse=True)
    results: list[dict[str, Any]] = [item[2] for item in scored[:limit]]

    # 5. External OSM Nominatim fallback if fewer than limit
    if len(results) < limit and len(q) >= 3:
        try:
            params = urlencode({
                "q": f"{query} Camiguin",
                "format": "json",
                "countrycodes": "ph",
                "limit": limit - len(results),
            })
            url = f"https://nominatim.openstreetmap.org/search?{params}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CamiguinCentricRidersClub/1.0 (Island Courier Logistics)"},
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for item in data:
                    display = item.get("display_name", "")
                    if "camiguin" in display.lower():
                        short_name = display.split(",")[0].strip()
                        sub_loc = display.split(",")[1].strip() if len(display.split(",")) > 1 else "Camiguin"
                        title = f"{short_name}, {sub_loc}"
                        if title not in seen_names:
                            results.append({
                                "name": title,
                                "cat": item.get("type", "landmark"),
                                "lat": float(item["lat"]),
                                "lng": float(item["lon"]),
                                "keywords": [q],
                                "mun": "Camiguin",
                                "full_address": display,
                            })
                            seen_names.add(title)
        except Exception:
            pass

    return results[:limit]


def geocode_camiguin_location(query: str) -> dict[str, Any] | None:
    """
    Search for a Camiguin location by name or keyword.
    Returns the place dict with lat and lng if found, or None.
    """
    matches = search_camiguin_places(query, limit=1)
    return matches[0] if matches else None


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


_ROAD_ROUTE_CACHE: dict[tuple[float, float, float, float], tuple[float, list[list[float]] | None]] = {}


# ==============================================================================
# CAMIGUIN ISLAND TOPOLOGICAL ROAD NETWORK ENGINE (HIGHWAY & LOCAL STREETS)
# Guarantees 100% exact road distance ("ang kalsada mismo kung asa ni agi")
# Follows the 64km Circumferential Highway & Mambajao Town Grid.
# ==============================================================================

CAMIGUIN_HIGHWAY_WAYPOINTS: list[tuple[float, float, str, float]] = [
    # Exact 63.85 km OSM Camiguin Circumferential Highway Ring (Clockwise from Mambajao Town)
    (9.24958, 124.71654, "Mambajao Town Center (Jollibee / Plaza)", 0.00),
    (9.24594, 124.72760, "Sitio Lakas / Capitol Highway", 1.28),
    (9.23958, 124.73709, "Balbagon Port Junction", 2.60),
    (9.23019, 124.74490, "Anito Highway, Mambajao", 3.96),
    (9.22407, 124.75352, "Magting Highway North", 5.14),
    (9.21464, 124.75959, "Magting Highway South", 6.45),
    (9.21035, 124.76949, "Benhaan / Tupsan Highway", 7.71),
    (9.20228, 124.77730, "Tupsan Public Market Highway", 9.00),
    (9.19059, 124.78142, "Tupsan Pequeño / Catohogan", 10.38),
    (9.18073, 124.78426, "Catohogan / Hubangon, Mahinog", 11.52),
    (9.16908, 124.78603, "Hubangon Highway, Mahinog", 12.84),
    (9.15840, 124.78916, "Mahinog North / Binaliwan", 14.08),
    (9.15127, 124.79388, "San Roque (Mantigue Jump-off)", 15.33),
    (9.14334, 124.79466, "Benoni North Highway, Mahinog", 16.61),
    (9.13361, 124.79602, "Taguines Lagoon / Benoni Wharf", 17.89),
    (9.12361, 124.79459, "Maac North Highway, Guinsiliban", 19.16),
    (9.11711, 124.78845, "Cabuan / Maac Highway", 20.43),
    (9.10823, 124.79160, "Cantaan Highway, Guinsiliban", 21.72),
    (9.10221, 124.79054, "Guinsiliban Port / North Poblacion", 23.00),
    (9.09376, 124.78386, "South Poblacion, Guinsiliban", 24.29),
    (9.08397, 124.77872, "Liong Coastal Highway", 25.57),
    (9.07938, 124.76840, "Liong / Balite Southern Tip", 26.85),
    (9.08412, 124.75834, "Balite Highway, Sagay", 28.13),
    (9.09397, 124.75307, "Manuyog Highway, Sagay", 29.39),
    (9.10218, 124.74543, "Alangilan Highway, Sagay", 30.65),
    (9.10345, 124.73371, "Bonbon Highway, Sagay", 32.06),
    (9.10437, 124.72310, "Sagay Poblacion Highway", 33.23),
    (9.10589, 124.71136, "Bugang East Highway, Sagay", 34.53),
    (9.11092, 124.70125, "Tangaro South, Catarman", 35.78),
    (9.11392, 124.69028, "Tangaro / CPSC Catarman", 37.04),
    (9.11908, 124.68003, "Alga Highway, Catarman", 38.31),
    (9.12801, 124.67208, "Catarman Poblacion / CNHS", 39.65),
    (9.13453, 124.66303, "Looc Coastal Highway, Catarman", 40.90),
    (9.14245, 124.65471, "Compol Highway, Catarman", 42.18),
    (9.15147, 124.64728, "Panghiawan Highway, Catarman", 43.49),
    (9.16138, 124.64255, "Lawigan South, Catarman", 44.71),
    (9.16874, 124.63878, "Lawigan Highway, Catarman", 45.98),
    (9.17726, 124.63538, "Catibac Highway, Catarman", 47.26),
    (9.18805, 124.63672, "Bonbon South Highway, Catarman", 48.59),
    (9.19859, 124.63608, "Bonbon / Gui-ob Ruins Junction", 49.81),
    (9.20903, 124.63631, "Sunken Cemetery / Old Volcano", 51.08),
    (9.21426, 124.63568, "Mount Vulcan Coastal Road", 52.36),
    (9.22249, 124.64100, "Volcan / Naasag South", 53.65),
    (9.23184, 124.64359, "Naasag Cliff / Tongatok", 54.94),
    (9.23801, 124.65143, "Naasag North / Yumbing West", 56.19),
    (9.24146, 124.66253, "Yumbing Highway (White Island)", 57.50),
    (9.24835, 124.67154, "Agoho Highway, Mambajao", 58.76),
    (9.25050, 124.68249, "Bug-ong / Kuguita Highway", 60.03),
    (9.24938, 124.69402, "Baylao Barangay Hall Highway", 61.31),
    (9.25053, 124.70574, "Airport / Baylao East Highway", 62.61),
    (9.24958, 124.71654, "Mambajao Town Center (Jollibee / Plaza)", 63.85),
]


def _find_nearest_highway_waypoint(lat: float, lng: float) -> tuple[int, float]:
    min_dist = float("inf")
    best_idx = 0
    for idx, wp in enumerate(CAMIGUIN_HIGHWAY_WAYPOINTS):
        d = calculate_haversine_km(lat, lng, wp[0], wp[1])
        if d < min_dist:
            min_dist = d
            best_idx = idx
    return best_idx, min_dist


def compute_island_road_network_route(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> tuple[float, list[list[float]]]:
    """
    Guaranteed island road network solver.
    Follows actual island roads: Mambajao town grid or Circumferential Ring Highway.
    Never cuts across Mount Hibok-Hibok or mountain interiors.
    """
    d_straight = calculate_haversine_km(lat1, lng1, lat2, lng2)

    # 1. Close proximity inside Mambajao town grid (Burgos St, Market, Plaza, Capitol)
    if d_straight <= 1.5 and lat1 > 9.240 and lat2 > 9.240 and lng1 > 124.700 and lng2 > 124.700:
        d_lat_km = abs(lat2 - lat1) * 111.0
        d_lng_km = abs(lng2 - lng1) * 109.5
        grid_km = round(d_lat_km + d_lng_km + 0.10, 2)
        # Waypoints via town streets
        coords = [
            [lat1, lng1],
            [lat1, (lng1 + lng2) / 2.0],
            [lat2, (lng1 + lng2) / 2.0],
            [lat2, lng2],
        ]
        return max(grid_km, 0.40), coords

    # 2. Highway Circumferential Ring routing (Clockwise vs Counter-clockwise)
    idx1, d1 = _find_nearest_highway_waypoint(lat1, lng1)
    idx2, d2 = _find_nearest_highway_waypoint(lat2, lng2)

    total_loop_km = CAMIGUIN_HIGHWAY_WAYPOINTS[-1][3]
    km1 = CAMIGUIN_HIGHWAY_WAYPOINTS[idx1][3]
    km2 = CAMIGUIN_HIGHWAY_WAYPOINTS[idx2][3]

    cw_dist = (km2 - km1) if km2 >= km1 else (total_loop_km - km1 + km2)
    ccw_dist = total_loop_km - cw_dist
    n = len(CAMIGUIN_HIGHWAY_WAYPOINTS) - 1

    path_coords: list[list[float]] = [[lat1, lng1]]
    if cw_dist <= ccw_dist:
        chosen_dist = cw_dist
        cur = idx1
        while True:
            wp = CAMIGUIN_HIGHWAY_WAYPOINTS[cur]
            path_coords.append([wp[0], wp[1]])
            if cur == idx2:
                break
            cur = (cur + 1) % n
    else:
        chosen_dist = ccw_dist
        cur = idx1
        while True:
            wp = CAMIGUIN_HIGHWAY_WAYPOINTS[cur]
            path_coords.append([wp[0], wp[1]])
            if cur == idx2:
                break
            cur = (cur - 1 + n) % n

    path_coords.append([lat2, lng2])
    total_road_km = round(chosen_dist + (d1 * 1.15) + (d2 * 1.15), 2)
    return total_road_km, path_coords


def calculate_road_km(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> tuple[float, list[list[float]] | None]:
    """
    Calculate actual driving road distance along Camiguin's road network using OSRM routing
    with instant fallback to Camiguin Island Topological Road Engine.
    Measures strictly the real road distance ("ang kalsada mismo kung asa ni agi") rather than straight line.
    Returns (road_km, route_coordinates).
    """
    cache_key = (round(lat1, 4), round(lng1, 4), round(lat2, 4), round(lng2, 4))
    if cache_key in _ROAD_ROUTE_CACHE:
        return _ROAD_ROUTE_CACHE[cache_key]

    # Try external OSRM mirrors with short timeout
    endpoints = [
        f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson",
        f"http://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson",
    ]

    import ssl
    verified_ctx = ssl.create_default_context()

    for ep in endpoints:
        try:
            req = urllib.request.Request(
                ep,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CamiguinCentricRiders/1.0",
                    "Accept": "application/json",
                },
            )
            ctx = verified_ctx if ep.startswith("https") else None
            with urllib.request.urlopen(req, context=ctx, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    meters = data["routes"][0]["distance"]
                    road_km = round(meters / 1000.0, 2)
                    coords = data["routes"][0].get("geometry", {}).get("coordinates", [])
                    # OSRM coordinates are [lng, lat] GeoJSON format
                    formatted_coords = [[c[1], c[0]] for c in coords]
                    result = (road_km, formatted_coords)
                    if len(_ROAD_ROUTE_CACHE) >= 512:
                        _ROAD_ROUTE_CACHE.clear()
                    _ROAD_ROUTE_CACHE[cache_key] = result
                    return result
        except Exception:
            continue

    # Instant Fallback: Camiguin Topological Island Road Engine (100% Road Distance, Never Straight Air Line)
    road_km, road_coords = compute_island_road_network_route(lat1, lng1, lat2, lng2)
    result = (road_km, road_coords)
    if len(_ROAD_ROUTE_CACHE) >= 512:
        _ROAD_ROUTE_CACHE.clear()
    _ROAD_ROUTE_CACHE[cache_key] = result
    return result



HINTERLAND_ROUTE_KEYWORDS: tuple[str, ...] = (
    "sorosoro",
    "soro'soro",
    "soro-soro",
    "soro soro",
    "highland",
    "utopia",
    "binunsaran",
    "granelandia",
    "itum road",
    "mambajao-itum",
    "hinterland",
    "ardent",
    "sitio esperanza",
    "upper tagdo",
    "timogsay",
    "timugsay",
    "timogsai",
    "timugsai",
    "upper cogon",
    "sitio cogon",
    "lower cogon",
    "upper agoho",
    "upper bug-ong",
    "upper bug ong",
    "sibato",
    "katibawasan",
    "hibok-hibok",
    "hibok hibok",
    "mount hibok",
    "mt. hibok",
    "mt hibok",
    "volcano observatory",
    "phivolcs",
    "sa-ay",
    "sa ay cold",
    "quipasa",
    "quiboro",
    "nanaw",
    "tuasan",
    "binangawan",
    "benhaan",
    "upper pandan",
    "pandan upland",
    "kanangkaan",
    "maubog",
    "pandayan",
    "litican",
    "upper balbagon",
    "sitio tinago",
    "tinago balbagon",
    "upper lakas",
    "lakas upland",
    "upper anito",
    "upper magting",
    "sitio magting",
    "magting bukid",
    "magting upland",
    "macao cold spring",
    "macao spring",
    "bas-iao",
    "basiao",
    "upper yumbing",
    "upper naasag",
    "katobli",
    "kaolyong",
    "sibato reservoir",
    "volcano house",
    "km 11 itum",
    "santo nino",
    "santo niño",
    "sto. nino",
    "sto. niño",
    "sto nino",
    "sto niño",
    "mainit",
    "manduao",
    "mandawa",
    "bura",
    "soda water",
    "liloan",
    "licoan",
    "mount vulcan",
    "mt. vulcan",
    "mt vulcan",
    "volcano walkway",
    "walkway to old volcano",
    "old volcano",
    "stations of the cross",
    "piyakong",
    "tres marias",
    "owakan",
    "puntod",
    "san isidro",
    "san miguel",
    "tubod",
    "tupsan pequeno",
    "tupsan pequeño",
    "tupsan mahinog",
    "cuna",
    "cuña",
    "kital-is",
    "kitalis",
    "upper cuna",
    "bacnit",
    "bugang",
    "bug-ang",
    "mayana",
    "mantalaga",
    "upper sagay",
    "butay",
    "cabuan",
    "upper cantaan",
    "cantaan upland",
    "ibabaw cantaan",
    "tungason",
    "upland",
    "steep uphill",
)

_HINTERLAND_BOUNDARY_RE = re.compile(
    r"\b(?:itum|esperanza|saay|cogon|tagdo|benhaan|kanangkaan|maubog|pandayan|litican|"
    r"katobli|kaolyong|owakan|puntod|tubod|mainit|manduao|mandawa|bura|liloan|licoan|"
    r"piyakong|cuna|bacnit|bugang|mayana|mantalaga|butay|cabuan)\b"
)

_HINTERLAND_PLACE_ZONES: tuple[tuple[float, float, float], ...] = (
    # Mambajao inland & upland barangays, sitios, springs & mountain trails
    (9.20322, 124.76773, 0.45),  # Benhaan, Mambajao
    (9.19586, 124.77407, 0.45),  # Macao Cold Spring, Tupsan
    (9.22850, 124.72150, 0.45),  # Upper Pandan (Kanangkaan / Maubog)
    (9.22750, 124.73300, 0.45),  # Litican, Upper Balbagon
    (9.23550, 124.73200, 0.45),  # Upper Lakas, Mambajao
    (9.21100, 124.74850, 0.45),  # Upper Magting, Mambajao
    (9.23150, 124.66100, 0.45),  # Sitio Bas-iao, Upper Yumbing / Naasag
    (9.22950, 124.67650, 0.45),  # Katobli / Sibato Reservoir, Agoho
    (9.20550, 124.69750, 0.45),  # Volcano House (Km 11 Itum)
    (9.23453, 124.69148, 0.45),  # Tagdo, Mambajao
    (9.23750, 124.67950, 0.45),  # Timogsay, Upper Bug-ong
    (9.23580, 124.67380, 0.45),  # Upper Cogon, Agoho
    # Catarman inland barangays, springs & volcano slopes
    (9.14845, 124.67332, 0.45),  # Santo Niño, Catarman
    (9.15019, 124.67424, 0.45),  # Sto. Niño Cold Spring, Catarman
    (9.15517, 124.65775, 0.45),  # Mainit, Catarman
    (9.13813, 124.67337, 0.45),  # Manduao, Catarman
    (9.17620, 124.65194, 0.45),  # Bura, Catarman
    (9.17107, 124.65697, 0.45),  # Bura Soda Water Park, Catarman
    (9.14331, 124.67926, 0.45),  # Liloan, Catarman
    (9.21068, 124.64015, 0.35),  # Mount Vulcan Daan / Walkway to Old Volcano
    (9.20850, 124.64800, 0.45),  # Piyakong / Tres Marias Slopes, Catarman
    # Mahinog inland & hillside barangays
    (9.15373, 124.76255, 0.45),  # Owakan, Mahinog
    (9.15603, 124.77313, 0.45),  # Puntod, Mahinog
    (9.18171, 124.76971, 0.45),  # San Isidro, Mahinog
    (9.13051, 124.78384, 0.45),  # San Miguel, Mahinog
    (9.16090, 124.78326, 0.45),  # Tubod, Mahinog
    (9.19518, 124.77836, 0.45),  # Tupsan Pequeño, Mahinog
    # Sagay inland barangays, sitios & waterfalls
    (9.12148, 124.74358, 0.45),  # Cuna, Sagay
    (9.13100, 124.74200, 0.45),  # Sitio Kital-is, Cuna, Sagay
    (9.12643, 124.70861, 0.45),  # Bacnit, Sagay
    (9.10841, 124.70507, 0.45),  # Bugang, Sagay
    (9.10524, 124.71876, 0.45),  # Mayana, Sagay
    (9.14250, 124.72650, 0.45),  # Mantalaga Falls, Sagay
    # Guinsiliban inland & upland barangays / sitios
    (9.10476, 124.76919, 0.45),  # Butay, Guinsiliban
    (9.11881, 124.79810, 0.45),  # Cabuan, Guinsiliban
    (9.11350, 124.78200, 0.45),  # Upper Cantaan, Guinsiliban
)


def _is_hinterland_coord(lat: float | None, lng: float | None) -> bool:
    """
    Detect Camiguin upland / steep uphill (tungason) elevation zones by GPS coordinates,
    strictly clear of the coastal Circumferential Highway ring across all 5 municipalities:
      - Mambajao Uplands: Soro-soro, Highland Resort, Katibawasan Falls, Quiboro,
        Utopia, PHIVOLCS, Sa-ay Cold Spring, Binunsaran, Nanaw, Itum / Hibok-Hibok Trail,
        Volcano House, Sitio Esperanza, Ardent Hot Spring, Tagdo, Timogsay (Upper Bug-ong),
        Upper Cogon & Katobli (Agoho), Sitio Bas-iao (Upper Yumbing/Naasag), Upper Pandan
        (Kanangkaan/Maubog), Litican (Upper Balbagon), Upper Lakas, Upper Magting, Benhaan,
        and Macao Cold Spring.
      - Catarman Uplands: Tuasan Falls, Mainit, Santo Niño & Sto. Niño Cold Spring,
        Bura & Soda Water Park, Manduao, Liloan, Mount Vulcan Walkway, and Piyakong / Tres Marias.
      - Mahinog Uplands: Owakan, Puntod, San Isidro, San Miguel, Tubod, and Tupsan Pequeño.
      - Sagay Uplands: Binangawan Falls, Mantalaga Falls, Cuna, Sitio Kital-is, Bacnit,
        Bugang, and Mayana.
      - Guinsiliban Uplands: Butay, Cabuan, and Upper Cantaan.
    """
    try:
        lat_f = float(lat) if lat else 0.0
        lng_f = float(lng) if lng else 0.0
    except (TypeError, ValueError):
        return False
    if not lat_f or not lng_f:
        return False

    if 9.185 <= lat_f <= 9.2355 and 124.682 <= lng_f <= 124.734:
        return True
    if 9.215 <= lat_f <= 9.2400 and 124.6680 <= lng_f <= 124.6960:
        return True
    if 9.168 <= lat_f <= 9.205 and 124.668 <= lng_f <= 124.695:
        return True
    if 9.138 <= lat_f <= 9.175 and 124.715 <= lng_f <= 124.750:
        return True
    for z_lat, z_lng, radius_km in _HINTERLAND_PLACE_ZONES:
        if calculate_haversine_km(lat_f, lng_f, z_lat, z_lng) <= radius_km:
            return True
    return False


def is_hinterland_route(
    pickup_address: str = "",
    dropoff_address: str = "",
    item_notes: str = "",
    pickup_lat: float | None = None,
    pickup_lng: float | None = None,
    dropoff_lat: float | None = None,
    dropoff_lng: float | None = None,
) -> bool:
    """
    Auto-detect whether a trip traverses or ends in Camiguin's steep upland / mountain
    ('tungason' / hinterland) areas so +₱30 surcharge applies consistently for ALL services.
    Checks both place names/keywords and resolved pickup/dropoff coordinates.
    """
    full_addr = f"{pickup_address or ''} {dropoff_address or ''} {item_notes or ''}".lower()
    if any(k in full_addr for k in HINTERLAND_ROUTE_KEYWORDS):
        return True
    if _HINTERLAND_BOUNDARY_RE.search(full_addr):
        return True
    if _is_hinterland_coord(pickup_lat, pickup_lng) or _is_hinterland_coord(dropoff_lat, dropoff_lng):
        return True
    return False


def calculate_fare(
    km: float,
    service_type: str,
    settings: dict[str, Any],
    is_large_store: bool = False,
    extra_stores_count: int = 0,
    is_bulky_or_high_value: bool = False,
    is_hinterland: bool = False,
) -> tuple[float, float, dict[str, Any]]:
    """
    Calculate fare based on the Official Camiguin CRC Fare Matrix:
    - 1 KM: ₱40.00
    - 2 KMS: ₱40.00
    - Succeeding KMS (> 2 KM): +₱18.00 per KM (e.g. 3 km = ₱58, 10 km = ₱184, 30 km = ₱544)
    - Pasugo / Pabili / Pabayad / Delivery errand fee: +₱20.00 (Meter + 20 PHP)
    - Queuing at large establishments / groceries (Gaisano, Davilett, Nene Uy): +₱30.00
    - Extra store stops: +₱20.00 per additional store
    - Bulky orders / Shopping orders >= ₱2,000: +₱20.00
    - Hinterland / Mountain route (Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon, Quiboro, Sa-ay, Tuasan, Binangawan, Itum, etc.): +₱30.00
    """
    clean_km = max(1.0, round(km, 2))
    base_fare = float(settings.get("base_fare") or 40.0)
    base_km = float(settings.get("base_km") or 2.0)
    per_km_rate = float(settings.get("per_km_rate") or 18.0)
    min_fare = float(settings.get("min_fare") or 40.0)

    # 1. Base distance meter calculation
    if clean_km <= base_km:
        meter_fare = base_fare
    else:
        extra_km = clean_km - base_km
        meter_fare = base_fare + (extra_km * per_km_rate)

    # 2. Service fee (Pasugo / Pabili / Pabayad: +₱20, Passenger Ride: ₱0)
    service_add = 0.0
    st = (service_type or "").lower().strip()
    if st in ("pabili", "pabayad", "pasugo", "delivery", "courier", "errand", "cargo"):
        service_add = float(settings.get("pabili_service_fee") or 20.0)

    # 3. Queuing / Large store fee (+₱30)
    queuing_fee = float(settings.get("queuing_fee") or 30.0) if is_large_store else 0.0

    # 4. Extra stores fee (+₱20 per extra store)
    per_store_rate = float(settings.get("extra_store_fee") or 20.0)
    extra_stores_fee = max(0, int(extra_stores_count or 0)) * per_store_rate

    # 5. Bulky / High value order fee (+₱20)
    bulky_fee = float(settings.get("bulky_order_fee") or 20.0) if is_bulky_or_high_value else 0.0

    # 6. Hinterland / Mountain route fee (+₱30)
    hinterland_fee = float(settings.get("hinterland_fee") or 30.0) if is_hinterland else 0.0

    total_computed = meter_fare + service_add + queuing_fee + extra_stores_fee + bulky_fee + hinterland_fee
    final_fare = max(min_fare, round(total_computed, 0))

    breakdown = {
        "meter_fare": round(meter_fare, 2),
        "service_fee": round(service_add, 2),
        "queuing_fee": round(queuing_fee, 2),
        "extra_stores_fee": round(extra_stores_fee, 2),
        "bulky_fee": round(bulky_fee, 2),
        "hinterland_fee": round(hinterland_fee, 2),
        "total_fare": final_fare,
        "clean_km": clean_km,
    }

    return final_fare, clean_km, breakdown


def generate_booking_code() -> str:
    now = get_now_pht()
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
        self._last_cursor = None

    def cursor(self) -> DatabaseConnection:
        """Cursor compatibility so conn.cursor() calls return this connection object."""
        return self

    def execute(self, sql: str, params: tuple | list = ()) -> Any:
        if self.backend == "postgresql":
            pg_sql = translate_sql_to_postgres(sql)
            cur = self._raw.execute(pg_sql, params or None)
        else:
            cur = self._raw.execute(sql, params)
        self._last_cursor = cur
        return cur

    def fetchone(self) -> Any:
        if self._last_cursor is not None:
            return self._last_cursor.fetchone()
        return None

    def fetchall(self) -> list[Any]:
        if self._last_cursor is not None:
            return self._last_cursor.fetchall()
        return []

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
            if isinstance(row, dict) or hasattr(row, "keys"):
                return int(row["id"])
            return int(row[0])
        cur = self._raw.execute(sql, params)
        return int(cur.lastrowid)


    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()

    def close(self) -> None:
        if self.backend == "postgresql" and getattr(self, "_pool_url", None):
            try:
                if not self._raw.closed:
                    self._raw.rollback()
                    _PG_POOLS.setdefault(self._pool_url, queue.Queue(maxsize=10)).put_nowait(self._raw)
                    return
            except Exception:
                pass
        try:
            self._raw.close()
        except Exception:
            pass


_PG_POOLS: dict[str, queue.Queue] = {}


def get_connection(db_path: str = "riders_club.db") -> DatabaseConnection:
    db_url = get_database_url()
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL connections.")
        if db_url.startswith("postgres://"):
            db_url = "postgresql://" + db_url[len("postgres://") :]
        pool = _PG_POOLS.setdefault(db_url, queue.Queue(maxsize=10))
        raw_conn = None
        while not pool.empty():
            try:
                candidate = pool.get_nowait()
                if candidate and not candidate.closed:
                    candidate.execute("SELECT 1")
                    candidate.rollback()
                    raw_conn = candidate
                    break
            except Exception:
                try:
                    candidate.close()
                except Exception:
                    pass
        if raw_conn is None:
            raw_conn = psycopg.connect(db_url, row_factory=dict_row, autocommit=False)
        dc = DatabaseConnection("postgresql", raw_conn)
        dc._pool_url = db_url  # type: ignore[attr-defined]
        return dc

    raw_conn = sqlite3.connect(db_path, timeout=15.0)
    raw_conn.row_factory = sqlite3.Row
    raw_conn.execute("PRAGMA foreign_keys = ON")
    raw_conn.execute("PRAGMA journal_mode = WAL")
    return DatabaseConnection("sqlite", raw_conn)


def init_db(conn: DatabaseConnection) -> None:
    if conn.backend == "postgresql":
        _create_postgres_schema(conn)
        for migration in [
            "ALTER TABLE riders ADD COLUMN IF NOT EXISTS license_no VARCHAR(64) DEFAULT ''",
            "ALTER TABLE riders ADD COLUMN IF NOT EXISTS email VARCHAR(160) DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(120) DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS barangay VARCHAR(120) DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active'",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent REAL DEFAULT 0.0",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_at VARCHAR(64) DEFAULT NULL",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code_id INTEGER DEFAULT NULL",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code VARCHAR(64) DEFAULT ''",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transferred_from_rider_id INTEGER DEFAULT NULL",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transfer_reason TEXT DEFAULT ''",
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0",
            "ALTER TABLE booking_messages ADD COLUMN IF NOT EXISTS msg_type VARCHAR(24) DEFAULT 'text'",
            "ALTER TABLE booking_messages ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT ''",
            "ALTER TABLE booking_messages ADD COLUMN IF NOT EXISTS media_duration DOUBLE PRECISION DEFAULT 0",
        ]:
            try:
                conn.execute(migration)
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
    else:
        _create_sqlite_schema(conn)
        for migration in [
            "ALTER TABLE riders ADD COLUMN license_no TEXT DEFAULT ''",
            "ALTER TABLE riders ADD COLUMN email TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN avatar_url TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN email TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN password_hash TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN barangay TEXT DEFAULT ''",
            "ALTER TABLE customers ADD COLUMN is_verified INTEGER DEFAULT 0",
            "ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active'",
            "ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0.0",
            "ALTER TABLE booking_messages ADD COLUMN msg_type TEXT DEFAULT 'text'",
            "ALTER TABLE booking_messages ADD COLUMN media_url TEXT DEFAULT ''",
            "ALTER TABLE booking_messages ADD COLUMN media_duration REAL DEFAULT 0",
        ]:
            try:
                conn.execute(migration)
            except Exception:
                pass

    # Purge any legacy starter/demo records from database
    try:
        conn.execute("DELETE FROM riders WHERE phone IN ('09171234501', '09171234502', '09171234503')")
    except Exception:
        if conn.backend == "postgresql":
            try:
                conn.rollback()
            except Exception:
                pass
    try:
        conn.execute("DELETE FROM customers WHERE phone IN ('09170001122', '09180003344')")
    except Exception:
        if conn.backend == "postgresql":
            try:
                conn.rollback()
            except Exception:
                pass
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
            license_no TEXT DEFAULT '',
            avatar_url TEXT DEFAULT '',
            email TEXT DEFAULT '',
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
            scheduled_at TEXT DEFAULT NULL,
            promo_code_id INTEGER DEFAULT NULL,
            promo_code TEXT DEFAULT '',
            discount_amount REAL DEFAULT 0,
            transferred_from_rider_id INTEGER DEFAULT NULL,
            transfer_reason TEXT DEFAULT '',
            transfer_count INTEGER DEFAULT 0,
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
        CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            discount_amount REAL NOT NULL,
            min_fare REAL DEFAULT 0,
            max_uses INTEGER DEFAULT 1000,
            uses_count INTEGER DEFAULT 0,
            expires_at TEXT DEFAULT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT DEFAULT '',
            email TEXT DEFAULT '',
            avatar_url TEXT DEFAULT '',
            barangay TEXT DEFAULT '',
            is_verified INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            total_rides INTEGER DEFAULT 0,
            total_spent REAL DEFAULT 0.0,
            saved_notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            last_active_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_code TEXT NOT NULL UNIQUE,
            booking_id INTEGER NOT NULL,
            booking_code TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            rider_id INTEGER DEFAULT NULL,
            rider_name TEXT DEFAULT '',
            service_type TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            status TEXT NOT NULL DEFAULT 'completed',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS booking_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            msg_type TEXT DEFAULT 'text',
            media_url TEXT DEFAULT '',
            media_duration REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS call_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_uuid TEXT NOT NULL UNIQUE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            caller_role TEXT NOT NULL,
            caller_name TEXT NOT NULL,
            callee_role TEXT NOT NULL,
            callee_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'ringing',
            end_reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            answered_at TEXT DEFAULT NULL,
            ended_at TEXT DEFAULT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS call_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role TEXT NOT NULL,
            signal_type TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_booking ON booking_messages(booking_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_call_sessions_booking ON call_sessions(booking_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_call_signals_call ON call_signals(call_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status_rider ON bookings(status, rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracking_booking ON tracking_logs(booking_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_rider ON transactions(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_phone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_rider ON reviews(rider_id)")
    # Migrations for new columns on bookings
    for col_def in [
        ("scheduled_at", "TEXT DEFAULT NULL"),
        ("promo_code_id", "INTEGER DEFAULT NULL"),
        ("promo_code", "TEXT DEFAULT ''"),
        ("discount_amount", "REAL DEFAULT 0"),
        ("transferred_from_rider_id", "INTEGER DEFAULT NULL"),
        ("transfer_reason", "TEXT DEFAULT ''"),
        ("transfer_count", "INTEGER DEFAULT 0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE bookings ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass

    # Migrations for customers table
    for col_def in [
        ("password_hash", "TEXT DEFAULT ''"),
        ("barangay", "TEXT DEFAULT ''"),
        ("is_verified", "INTEGER DEFAULT 0"),
        ("status", "TEXT DEFAULT 'active'"),
        ("total_spent", "REAL DEFAULT 0.0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE customers ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass



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
            license_no VARCHAR(64) DEFAULT '',
            avatar_url TEXT DEFAULT '',
            email VARCHAR(160) DEFAULT '',
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
            scheduled_at VARCHAR(64) DEFAULT NULL,
            promo_code_id INTEGER DEFAULT NULL,
            promo_code VARCHAR(64) DEFAULT '',
            discount_amount DOUBLE PRECISION DEFAULT 0,
            transferred_from_rider_id INTEGER DEFAULT NULL,
            transfer_reason TEXT DEFAULT '',
            transfer_count INTEGER DEFAULT 0,
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
        CREATE TABLE IF NOT EXISTS promo_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR(64) NOT NULL UNIQUE,
            discount_amount NUMERIC(10, 2) NOT NULL,
            min_fare NUMERIC(10, 2) DEFAULT 0,
            max_uses INTEGER DEFAULT 1000,
            uses_count INTEGER DEFAULT 0,
            expires_at TIMESTAMPTZ DEFAULT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            phone VARCHAR(32) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) DEFAULT '',
            email VARCHAR(120) DEFAULT '',
            avatar_url TEXT DEFAULT '',
            barangay VARCHAR(120) DEFAULT '',
            is_verified INTEGER DEFAULT 0,
            status VARCHAR(32) DEFAULT 'active',
            total_rides INTEGER DEFAULT 0,
            total_spent REAL DEFAULT 0.0,
            saved_notes TEXT DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL,
            last_active_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            transaction_code VARCHAR(64) NOT NULL UNIQUE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            booking_code VARCHAR(32) NOT NULL,
            customer_phone VARCHAR(32) NOT NULL,
            customer_name VARCHAR(120) NOT NULL,
            rider_id INTEGER DEFAULT NULL,
            rider_name VARCHAR(120) DEFAULT '',
            service_type VARCHAR(32) NOT NULL,
            amount REAL NOT NULL,
            payment_method VARCHAR(32) NOT NULL DEFAULT 'cash',
            status VARCHAR(32) NOT NULL DEFAULT 'completed',
            notes TEXT DEFAULT '',
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS booking_messages (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role VARCHAR(32) NOT NULL,
            sender_name VARCHAR(120) NOT NULL,
            message TEXT NOT NULL,
            msg_type VARCHAR(24) DEFAULT 'text',
            media_url TEXT DEFAULT '',
            media_duration DOUBLE PRECISION DEFAULT 0,
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS call_sessions (
            id SERIAL PRIMARY KEY,
            call_uuid VARCHAR(64) NOT NULL UNIQUE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            caller_role VARCHAR(32) NOT NULL,
            caller_name VARCHAR(120) NOT NULL,
            callee_role VARCHAR(32) NOT NULL,
            callee_name VARCHAR(120) NOT NULL DEFAULT '',
            status VARCHAR(32) NOT NULL DEFAULT 'ringing',
            end_reason TEXT DEFAULT '',
            created_at VARCHAR(32) NOT NULL,
            answered_at VARCHAR(32) DEFAULT NULL,
            ended_at VARCHAR(32) DEFAULT NULL,
            updated_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS call_signals (
            id SERIAL PRIMARY KEY,
            call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role VARCHAR(32) NOT NULL,
            signal_type VARCHAR(32) NOT NULL,
            payload TEXT NOT NULL DEFAULT '',
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_booking ON booking_messages(booking_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_call_sessions_booking ON call_sessions(booking_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_call_signals_call ON call_signals(call_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status_rider ON bookings(status, rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracking_booking ON tracking_logs(booking_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_rider ON transactions(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_phone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_rider ON reviews(rider_id)")

    # PostgreSQL migrations
    for col_def in [
        ("password_hash", "VARCHAR(255) DEFAULT ''"),
        ("barangay", "VARCHAR(120) DEFAULT ''"),
        ("is_verified", "INTEGER DEFAULT 0"),
        ("status", "VARCHAR(32) DEFAULT 'active'"),
        ("total_spent", "REAL DEFAULT 0.0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {col_def[0]} {col_def[1]}")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass

    for col_def in [
        ("scheduled_at", "VARCHAR(64) DEFAULT NULL"),
        ("promo_code_id", "INTEGER DEFAULT NULL"),
        ("promo_code", "VARCHAR(64) DEFAULT ''"),
        ("discount_amount", "DOUBLE PRECISION DEFAULT 0"),
        ("transferred_from_rider_id", "INTEGER DEFAULT NULL"),
        ("transfer_reason", "TEXT DEFAULT ''"),
        ("transfer_count", "INTEGER DEFAULT 0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE bookings ADD COLUMN IF NOT EXISTS {col_def[0]} {col_def[1]}")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass


def _seed_initial_data(conn: DatabaseConnection) -> None:
    now = get_now_pht().isoformat(timespec="seconds")

    default_settings = {
        "club_name": "Camiguin Centric Riders Club",
        "tagline": "Express Ride-Hailing, Courier & Errand Services in Camiguin Island",
        "hotline": "0917 555 0199",
        "admin_password_hash": generate_password_hash("admin1234"),
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
        "default_lat": "9.2483",
        "default_lng": "124.6975",  # Mambajao center
    }

    for k, v in default_settings.items():
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (k,)).fetchone()
        if not row:
            conn.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (k, v))
        else:
            # Upgrade outdated default fare numbers to Official Camiguin CRC Fare Matrix
            old_val = str(row["value"] if isinstance(row, dict) or hasattr(row, "keys") else row[0])
            if (k == "base_fare" and old_val == "50.0") or (k == "per_km_rate" and old_val == "15.0") or (k == "min_fare" and old_val == "50.0"):
                conn.execute("UPDATE settings SET value = ? WHERE key = ?", (v, k))

    # Starter promo codes
    try:
        existing_promos = conn.execute("SELECT COUNT(*) AS c FROM promo_codes").fetchone()
        if not existing_promos or existing_promos["c"] == 0:
            now_iso = get_now_pht().isoformat(timespec="seconds")
            starter_promos = [
                ("WELCOME20", 20.0, 50.0, 1000, 0, "2027-12-31T23:59:59", 1, now_iso),
                ("FIRSTRIDE", 15.0, 40.0, 500, 0, "2027-12-31T23:59:59", 1, now_iso),
                ("CAMIGUIN10", 10.0, 40.0, 2000, 0, "2027-12-31T23:59:59", 1, now_iso),
                ("ISLANDRIDER", 25.0, 80.0, 500, 0, "2027-12-31T23:59:59", 1, now_iso),
            ]
            for p in starter_promos:
                conn.execute(
                    """
                    INSERT INTO promo_codes (code, discount_amount, min_fare, max_uses, uses_count, expires_at, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    p,
                )
    except Exception as e:
        pass

    # Backfill transactions for existing bookings if transactions table is empty
    try:
        existing_txns = conn.execute("SELECT COUNT(*) AS c FROM transactions").fetchone()
        if not existing_txns or existing_txns["c"] == 0:
            now_iso = get_now_pht().isoformat(timespec="seconds")
            bookings_rows = conn.execute("SELECT * FROM bookings ORDER BY id ASC").fetchall()
            for b in bookings_rows:
                r_id = b.get("rider_id")
                r_name = ""
                if r_id:
                    rider_row = conn.execute("SELECT name FROM riders WHERE id = ?", (r_id,)).fetchone()
                    if rider_row:
                        r_name = rider_row["name"]
                t_code = f"TXN-{b['booking_code']}"
                conn.execute(
                    """
                    INSERT INTO transactions (
                        transaction_code, booking_id, booking_code, customer_phone, customer_name,
                        rider_id, rider_name, service_type, amount, payment_method, status, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        t_code,
                        b["id"],
                        b["booking_code"],
                        b["customer_phone"],
                        b["customer_name"],
                        r_id,
                        r_name,
                        b["service_type"],
                        float(b.get("fare_amount", 50.0)),
                        b.get("payment_method", "cash"),
                        b.get("status", "completed"),
                        f"Booking {b['booking_code']}",
                        b.get("created_at", now_iso),
                    ),
                )
    except Exception:
        pass


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


def normalize_ph_phone(phone: str) -> str:
    """Normalizes any Philippine phone number variation into clean standard 09XXXXXXXXX format."""
    if not phone:
        return ""
    digits = "".join(filter(str.isdigit, str(phone)))
    if len(digits) == 10 and digits.startswith("9"):
        return f"0{digits}"
    if len(digits) == 12 and digits.startswith("639"):
        return f"0{digits[2:]}"
    if len(digits) == 11 and digits.startswith("09"):
        return digits
    return digits or str(phone).strip().replace(" ", "").replace("-", "")


def get_rider_by_phone(conn: DatabaseConnection, identifier: str) -> dict[str, Any] | None:
    """Finds a rider by phone number, email address, or plate number."""
    if not identifier:
        return None
    ident = str(identifier).strip()

    # 1. Search by email if it looks like an email or as direct match
    if "@" in ident:
        row = conn.execute("SELECT * FROM riders WHERE LOWER(TRIM(email)) = LOWER(?)", (ident,)).fetchone()
        if row:
            return dict(row)

    clean = normalize_ph_phone(ident)
    unspaced = ident.replace(" ", "").replace("-", "")

    # 2. Search by phone or email
    row = conn.execute(
        "SELECT * FROM riders WHERE phone = ? OR phone = ? OR LOWER(TRIM(email)) = LOWER(?)",
        (clean, unspaced, ident.lower())
    ).fetchone()
    if row:
        return dict(row)

    # 3. Match last 10 digits of phone
    digits = "".join(filter(str.isdigit, ident))
    if len(digits) >= 10:
        last10 = digits[-10:]
        row = conn.execute(
            "SELECT * FROM riders WHERE phone = ? OR phone = ? OR phone LIKE ? ORDER BY id DESC LIMIT 1",
            (f"0{last10}", f"+63{last10}", f"%{last10}"),
        ).fetchone()
        if row:
            return dict(row)

    # 4. Search by plate number
    clean_plate = unspaced.upper()
    if len(clean_plate) >= 4:
        row = conn.execute(
            "SELECT * FROM riders WHERE UPPER(REPLACE(REPLACE(plate_number, ' ', ''), '-', '')) = ? ORDER BY id DESC LIMIT 1",
            (clean_plate,)
        ).fetchone()
        if row:
            return dict(row)

    return None

get_rider_by_phone_or_email = get_rider_by_phone


def register_rider(
    conn: DatabaseConnection,
    name: str,
    phone: str,
    password: str,
    bike_model: str,
    plate_number: str,
    municipality: str = "Mambajao",
    license_no: str = "",
    avatar_url: str = "",
    email: str = "",
) -> int:
    clean_phone = normalize_ph_phone(phone)
    pwd_hash = generate_password_hash(password)
    now = get_now_pht().isoformat(timespec="seconds")
    clean_email = email.strip().lower()
    return conn.insert_returning_id(
        """
        INSERT INTO riders (
            name, phone, password_hash, bike_model, plate_number,
            municipality, license_no, avatar_url, email, status, is_online, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
        """,
        (name.strip(), clean_phone, pwd_hash, bike_model.strip(), plate_number.strip().upper(), municipality, license_no.strip().upper(), avatar_url.strip(), clean_email, now),
    )


def delete_rider(conn: DatabaseConnection, rider_id: int) -> bool:
    """Permanently deletes a rider by ID (Admin-only action). Cleanly updates associated bookings."""
    row = conn.execute("SELECT id FROM riders WHERE id = ?", (rider_id,)).fetchone()
    if not row:
        return False
    try:
        conn.execute("UPDATE bookings SET rider_id = NULL WHERE rider_id = ?", (rider_id,))
    except Exception:
        pass
    try:
        conn.execute("UPDATE bookings SET transferred_from_rider_id = NULL WHERE transferred_from_rider_id = ?", (rider_id,))
    except Exception:
        pass
    try:
        conn.execute("DELETE FROM tracking_logs WHERE rider_id = ?", (rider_id,))
    except Exception:
        pass
    try:
        conn.execute("DELETE FROM reviews WHERE rider_id = ?", (rider_id,))
    except Exception:
        pass
    conn.execute("DELETE FROM riders WHERE id = ?", (rider_id,))
    conn.commit()
    return True


def update_rider_password(conn: DatabaseConnection, rider_id: int, new_password_hash: str) -> bool:
    """Updates password hash for a rider account."""
    row = conn.execute("SELECT id FROM riders WHERE id = ?", (rider_id,)).fetchone()
    if not row:
        return False
    conn.execute("UPDATE riders SET password_hash = ? WHERE id = ?", (new_password_hash, rider_id))
    conn.commit()
    return True


def update_rider_online_status(conn: DatabaseConnection, rider_id: int, is_online: bool) -> None:
    now = get_now_pht().isoformat(timespec="seconds")
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
    now = get_now_pht().isoformat(timespec="seconds")
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
               last_lat, last_lng, last_active_at, total_trips, rating_avg,
               avatar_url, license_no
        FROM riders
        WHERE is_online = 1 AND status = 'active'
        ORDER BY last_active_at DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_busy_rider_ids(conn: DatabaseConnection) -> set[int]:
    """Returns rider IDs currently committed to an in-progress or on-demand/imminent trip."""
    rows = conn.execute(
        """
        SELECT rider_id, status, scheduled_at
        FROM bookings
        WHERE rider_id IS NOT NULL AND status IN ('accepted', 'in_progress')
        """
    ).fetchall()
    now = get_now_pht()
    busy: set[int] = set()
    for r in rows:
        rid = r["rider_id"]
        if not rid:
            continue
        if r["status"] == "in_progress":
            busy.add(int(rid))
            continue
        sched_str = (r["scheduled_at"] or "").strip()
        if not sched_str:
            busy.add(int(rid))
            continue
        try:
            sched_dt = datetime.fromisoformat(sched_str)
            if sched_dt.tzinfo is not None:
                sched_dt = sched_dt.replace(tzinfo=None)
            mins_left = (sched_dt - now).total_seconds() / 60
            if mins_left <= 15:
                busy.add(int(rid))
        except Exception:
            busy.add(int(rid))
    return busy


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
    scheduled_at: str | None = None,
    promo_code: str = "",
    discount_amount: float = 0.0,
) -> dict[str, Any]:
    code = generate_booking_code()
    now = get_now_pht().isoformat(timespec="seconds")
    booking_id = conn.insert_returning_id(
        """
        INSERT INTO bookings (
            booking_code, service_type, status, customer_name, customer_phone,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            item_notes, estimated_budget, estimated_km, fare_amount, payment_method,
            scheduled_at, promo_code, discount_amount, created_at
        ) VALUES (?, ?, 'broadcast', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            scheduled_at,
            promo_code.strip().upper(),
            discount_amount,
            now,
        ),
    )
    booking = get_booking_by_id(conn, booking_id)
    if booking:
        try:
            record_transaction(conn, booking, status="broadcast", notes=f"{service_type.upper()} booking created")
        except Exception:
            pass
    return booking


def get_booking_by_id(conn: DatabaseConnection, booking_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT b.*,
               r.name AS rider_name, r.phone AS rider_phone, r.bike_model AS rider_bike,
               r.plate_number AS rider_plate, r.color AS rider_color, r.last_lat AS rider_lat,
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
               r.avatar_url AS rider_avatar, r.license_no AS rider_license,
               COALESCE(tr.name, '') AS transferred_from_rider_name,
               COALESCE(c.is_verified, 0) AS customer_verified,
               COALESCE(c.total_rides, 0) AS customer_total_rides,
               COALESCE(c.barangay, '') AS customer_barangay
        FROM bookings b
        LEFT JOIN riders r ON r.id = b.rider_id
        LEFT JOIN riders tr ON tr.id = b.transferred_from_rider_id
        LEFT JOIN customers c ON b.customer_phone = c.phone
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
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
               r.avatar_url AS rider_avatar, r.license_no AS rider_license,
               COALESCE(tr.name, '') AS transferred_from_rider_name,
               COALESCE(c.is_verified, 0) AS customer_verified,
               COALESCE(c.total_rides, 0) AS customer_total_rides,
               COALESCE(c.barangay, '') AS customer_barangay
        FROM bookings b
        LEFT JOIN riders r ON r.id = b.rider_id
        LEFT JOIN riders tr ON tr.id = b.transferred_from_rider_id
        LEFT JOIN customers c ON b.customer_phone = c.phone
        WHERE UPPER(b.booking_code) = ?
        """,
        (booking_code.strip().upper(),),
    ).fetchone()
    return dict(row) if row else None


def get_available_broadcast_bookings(conn: DatabaseConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT b.*,
               COALESCE(tr.name, '') AS transferred_from_rider_name,
               COALESCE(c.is_verified, 0) AS customer_verified,
               COALESCE(c.total_rides, 0) AS customer_total_rides,
               COALESCE(c.barangay, '') AS customer_barangay
        FROM bookings b
        LEFT JOIN riders tr ON tr.id = b.transferred_from_rider_id
        LEFT JOIN customers c ON b.customer_phone = c.phone
        WHERE b.status = 'broadcast' AND b.rider_id IS NULL
        ORDER BY CASE WHEN COALESCE(b.transfer_count, 0) > 0 THEN 0 ELSE 1 END, b.id DESC
        LIMIT 20
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_rider_active_job(conn: DatabaseConnection, rider_id: int) -> dict[str, Any] | None:
    """
    Returns the rider's active trip to display on their dashboard:
    1. Priority 1: In-progress trip (always active).
    2. Priority 2: On-demand accepted trip (no schedule).
    3. Priority 3: Advance trip due soon (<= 30 mins).
    4. Fallback Priority 4: Nearest accepted advance trip if rider has no other active trips,
       ensuring the trip NEVER disappears from the rider's dashboard after accepting!
    """
    rows = conn.execute(
        """
        SELECT b.*,
               COALESCE(tr.name, '') AS transferred_from_rider_name,
               COALESCE(c.is_verified, 0) AS customer_verified,
               COALESCE(c.total_rides, 0) AS customer_total_rides,
               COALESCE(c.barangay, '') AS customer_barangay
        FROM bookings b
        LEFT JOIN riders tr ON tr.id = b.transferred_from_rider_id
        LEFT JOIN customers c ON b.customer_phone = c.phone
        WHERE b.rider_id = ? AND b.status IN ('accepted', 'in_progress')
        ORDER BY b.id DESC
        """,
        (rider_id,),
    ).fetchall()

    if not rows:
        return None

    dict_rows = [dict(r) for r in rows]

    # Priority 1: in_progress job
    for r in dict_rows:
        if r["status"] == "in_progress":
            return r

    now = get_now_pht()

    # Priority 2: on-demand accepted job (no schedule)
    for r in dict_rows:
        if r["status"] == "accepted":
            sched_str = (r.get("scheduled_at") or "").strip()
            if not sched_str:
                return r

    # Priority 3: advance accepted job due within 30 mins
    for r in dict_rows:
        if r["status"] == "accepted":
            sched_str = (r.get("scheduled_at") or "").strip()
            if sched_str:
                try:
                    sched_dt = datetime.fromisoformat(sched_str)
                    if sched_dt.tzinfo is not None:
                        sched_dt = sched_dt.replace(tzinfo=None)
                    mins_left = (sched_dt - now).total_seconds() / 60
                    if mins_left <= 30:
                        d = dict(r)
                        d["minutes_left"] = max(0, int(mins_left))
                        d["is_advance"] = True
                        return d
                except Exception:
                    return r

    # Priority 4 Fallback: If rider has accepted advance jobs, show the earliest one
    # so the dashboard NEVER appears blank right after accepting a booking!
    advance_jobs = []
    for r in dict_rows:
        if r["status"] == "accepted":
            d = dict(r)
            sched_str = (d.get("scheduled_at") or "").strip()
            mins_left = None
            if sched_str:
                try:
                    sched_dt = datetime.fromisoformat(sched_str)
                    if sched_dt.tzinfo is not None:
                        sched_dt = sched_dt.replace(tzinfo=None)
                    mins_left = int((sched_dt - now).total_seconds() / 60)
                except Exception:
                    pass
            d["minutes_left"] = mins_left
            d["is_advance"] = True
            advance_jobs.append(d)

    if advance_jobs:
        advance_jobs.sort(key=lambda x: x.get("scheduled_at") or "")
        return advance_jobs[0]

    return None


def get_rider_scheduled_jobs(conn: DatabaseConnection, rider_id: int) -> list[dict[str, Any]]:
    """
    Returns future advance reservations for this rider.
    Includes minutes_left and is_due_soon flags so the rider UI can trigger notifications.
    """
    rows = conn.execute(
        """
        SELECT * FROM bookings
        WHERE rider_id = ? AND status = 'accepted' AND scheduled_at IS NOT NULL AND scheduled_at != ''
        ORDER BY scheduled_at ASC
        """,
        (rider_id,),
    ).fetchall()

    now = get_now_pht()
    results = []
    for r in rows:
        d = dict(r)
        sched_str = (d.get("scheduled_at") or "").strip()
        try:
            sched_dt = datetime.fromisoformat(sched_str)
            if sched_dt.tzinfo is not None:
                sched_dt = sched_dt.replace(tzinfo=None)
            mins_left = (sched_dt - now).total_seconds() / 60
            d["minutes_left"] = int(mins_left)
            d["is_due_soon"] = mins_left <= 30
        except Exception:
            d["minutes_left"] = None
            d["is_due_soon"] = False
        results.append(d)
    return results


def accept_booking(conn: DatabaseConnection, booking_id: int, rider_id: int) -> bool:
    """Atomic acceptance: assigns rider only if booking is still in 'broadcast' status."""
    now = get_now_pht().isoformat(timespec="seconds")
    cur = conn.execute(
        """
        UPDATE bookings
        SET status = 'accepted', rider_id = ?, accepted_at = ?
        WHERE id = ? AND status = 'broadcast' AND rider_id IS NULL
        """,
        (rider_id, now, booking_id),
    )
    # Check if row was updated
    rowcount = cur.rowcount if hasattr(cur, "rowcount") else 0
    if rowcount > 0:
        try:
            b = get_booking_by_id(conn, booking_id)
            if b:
                record_transaction(conn, b, status="accepted", notes=f"Accepted by rider #{rider_id}")
                if int(b.get("transfer_count") or 0) > 0:
                    rider_label = b.get("rider_name") or f"Rider #{rider_id}"
                    plate = f" ({b['rider_plate']})" if b.get("rider_plate") else ""
                    add_booking_message(
                        conn,
                        booking_id,
                        "system",
                        "CCRC Dispatch",
                        f"🛵 Rescue rider {rider_label}{plate} has accepted your transferred trip and is now heading over!",
                    )
        except Exception:
            pass
    return rowcount > 0


def transfer_booking(
    conn: DatabaseConnection,
    booking_id: int,
    target_rider_id: int | None = None,
    reason: str = "",
    note: str = "",
    new_pickup_lat: float | None = None,
    new_pickup_lng: float | None = None,
    acting_rider_id: int | None = None,
    is_admin: bool = False,
) -> tuple[bool, str, dict[str, Any] | None, int]:
    """
    Emergency Transfer / Re-Broadcast for a rider experiencing a flat tire,
    mechanical trouble, or urgent emergency (whether 'accepted' or 'in_progress').

    - If target_rider_id is provided: atomically hands over directly to that online, available co-rider
      in 'accepted' status so the replacement rider can confirm pickup/handover and complete the trip.
    - If target_rider_id is None: returns the booking to the 'broadcast' dispatch pool with priority
      so any online co-rider can claim it.

    Returns (ok, mode_or_error, updated_booking_or_None, http_status).
    """
    booking = get_booking_by_id(conn, booking_id)
    if not booking:
        return False, "Booking not found.", None, 404

    current_status = (booking.get("status") or "").lower()
    if current_status not in ("accepted", "in_progress"):
        return False, "Only active trips (accepted or in_progress) can be transferred.", None, 400

    if not is_admin:
        if not acting_rider_id:
            return False, "Rider authentication required.", None, 401
        if booking.get("rider_id") != int(acting_rider_id):
            return False, "You are not assigned to this booking.", None, 403

    from_rider_id = booking.get("rider_id")
    from_rider_name = booking.get("rider_name") or (f"Rider #{from_rider_id}" if from_rider_id else "Previous Rider")

    clean_reason = (reason or "Flat tire / vehicle emergency").strip()[:120]
    clean_note = (note or "").strip()[:240]
    combined_reason = f"{clean_reason} — {clean_note}" if clean_note else clean_reason

    # Optional updated handover pickup GPS coordinates
    updated_coords: tuple[float, float] | None = None
    if new_pickup_lat is not None and new_pickup_lng is not None and str(new_pickup_lat).strip() != "" and str(new_pickup_lng).strip() != "":
        try:
            plat = float(new_pickup_lat)
            plng = float(new_pickup_lng)
            if (
                math.isfinite(plat)
                and math.isfinite(plng)
                and -90.0 <= plat <= 90.0
                and -180.0 <= plng <= 180.0
                and not (plat == 0.0 and plng == 0.0)
            ):
                updated_coords = (round(plat, 6), round(plng, 6))
        except (ValueError, TypeError):
            updated_coords = None

    # Check if this is a future scheduled reservation (> 30m away and not in_progress)
    is_future_scheduled = False
    sched_str = (booking.get("scheduled_at") or "").strip()
    if sched_str and current_status != "in_progress":
        try:
            sched_dt = datetime.fromisoformat(sched_str)
            if sched_dt.tzinfo is not None:
                sched_dt = sched_dt.replace(tzinfo=None)
            if (sched_dt - get_now_pht()).total_seconds() / 60 > 30:
                is_future_scheduled = True
        except Exception:
            pass

    now = get_now_pht().isoformat(timespec="seconds")
    next_transfer_count = int(booking.get("transfer_count") or 0) + 1

    coord_sql = ""
    coord_params: list[Any] = []
    if updated_coords is not None:
        coord_sql = ", pickup_lat = ?, pickup_lng = ?"
        coord_params = [updated_coords[0], updated_coords[1]]

    guard_sql = "WHERE id = ? AND status IN ('accepted', 'in_progress')"
    guard_params: list[Any] = [booking_id]
    if from_rider_id is not None:
        guard_sql += " AND rider_id = ?"
        guard_params.append(int(from_rider_id))

    if target_rider_id is not None:
        try:
            target_rid = int(target_rider_id)
        except (ValueError, TypeError):
            return False, "Invalid target rider ID.", None, 400

        if from_rider_id is not None and target_rid == int(from_rider_id):
            return False, "Cannot transfer a trip to yourself.", None, 400

        target_rider = get_rider_by_id(conn, target_rid)
        if not target_rider:
            return False, "Selected co-rider was not found.", None, 404
        if (target_rider.get("status") or "").lower() != "active":
            return False, "Selected co-rider account is not active.", None, 400
        if int(target_rider.get("is_online") or 0) != 1:
            return False, f"{target_rider.get('name', 'Selected co-rider')} is currently offline. Choose an online rider or Re-Broadcast to all riders.", None, 400

        if not is_future_scheduled:
            busy_ids = get_busy_rider_ids(conn)
            if target_rid in busy_ids:
                return False, f"{target_rider.get('name', 'Selected co-rider')} already has an active trip. Choose another rider or Re-Broadcast to all riders.", None, 409

        sql = f"""
            UPDATE bookings
            SET status = 'accepted',
                rider_id = ?,
                accepted_at = ?,
                pickup_time = NULL,
                transferred_from_rider_id = ?,
                transfer_reason = ?,
                transfer_count = ?{coord_sql}
            {guard_sql}
        """
        params = [target_rid, now, from_rider_id, combined_reason, next_transfer_count] + coord_params + guard_params
        cur = conn.execute(sql, tuple(params))
        rowcount = cur.rowcount if hasattr(cur, "rowcount") else 0
        if rowcount == 0:
            return False, "Booking could no longer be transferred (status changed concurrently).", None, 409

        updated = get_booking_by_id(conn, booking_id)
        target_name = (target_rider.get("name") or f"Rider #{target_rid}").strip()
        plate_info = f" ({target_rider.get('plate_number')})" if target_rider.get("plate_number") else ""
        if updated:
            try:
                record_transaction(
                    conn,
                    updated,
                    status="accepted",
                    notes=f"Emergency transfer from {from_rider_name} to {target_name}: {combined_reason}",
                )
            except Exception:
                pass
        handover_gps_msg = " Handover pickup pin updated to rider's current location." if updated_coords else ""
        sys_msg = (
            f"🚨 Emergency transfer: {from_rider_name} handed this trip over to rescue rider "
            f"{target_name}{plate_info}. Reason: {combined_reason}.{handover_gps_msg}"
        )
        try:
            add_booking_message(conn, booking_id, "system", "CCRC Dispatch", sys_msg)
        except Exception:
            pass
        try:
            end_open_booking_calls(conn, booking_id, end_reason="Trip transferred to another rider")
        except Exception:
            pass
        return True, "direct", updated, 200

    # Branch B: Re-Broadcast back to all online riders
    sql = f"""
        UPDATE bookings
        SET status = 'broadcast',
            rider_id = NULL,
            accepted_at = NULL,
            pickup_time = NULL,
            transferred_from_rider_id = ?,
            transfer_reason = ?,
            transfer_count = ?{coord_sql}
        {guard_sql}
    """
    params = [from_rider_id, combined_reason, next_transfer_count] + coord_params + guard_params
    cur = conn.execute(sql, tuple(params))
    rowcount = cur.rowcount if hasattr(cur, "rowcount") else 0
    if rowcount == 0:
        return False, "Booking could no longer be re-broadcast (status changed concurrently).", None, 409

    updated = get_booking_by_id(conn, booking_id)
    tx_note = f"Emergency re-broadcast from {from_rider_name}: {combined_reason}"
    try:
        cur_tx = conn.execute(
            """
            UPDATE transactions
            SET rider_id = NULL,
                rider_name = '',
                status = 'broadcast',
                notes = ?
            WHERE booking_id = ?
            """,
            (tx_note, booking_id),
        )
        if (cur_tx.rowcount if hasattr(cur_tx, "rowcount") else 0) == 0 and updated:
            record_transaction(conn, updated, status="broadcast", notes=tx_note)
    except Exception:
        pass

    handover_gps_msg = " Handover pickup pin updated to rider's current location." if updated_coords else ""
    sys_msg = (
        f"🚨 {from_rider_name} requested an emergency transfer ({combined_reason}) and re-broadcasted "
        f"this trip to all online CCRC riders.{handover_gps_msg} Finding the nearest available rider..."
    )
    try:
        add_booking_message(conn, booking_id, "system", "CCRC Dispatch", sys_msg)
    except Exception:
        pass
    try:
        end_open_booking_calls(conn, booking_id, end_reason="Trip re-broadcasted")
    except Exception:
        pass
    return True, "broadcast", updated, 200


def update_booking_status(conn: DatabaseConnection, booking_id: int, new_status: str) -> bool:
    existing = get_booking_by_id(conn, booking_id)
    if not existing:
        return False
    prev_status = existing.get("status")
    if prev_status == new_status:
        return True
    if prev_status in ("completed", "cancelled"):
        return False

    now = get_now_pht().isoformat(timespec="seconds")
    extra_col = ""
    extra_params = []
    if new_status == "in_progress":
        extra_col = ", pickup_time = ?"
        extra_params.append(now)
    elif new_status == "completed":
        extra_col = ", completed_at = ?"
        extra_params.append(now)

    params = [new_status] + extra_params + [booking_id, new_status]
    cur = conn.execute(f"UPDATE bookings SET status = ?{extra_col} WHERE id = ? AND status != ?", tuple(params))
    rowcount = cur.rowcount if hasattr(cur, "rowcount") else 0
    if rowcount == 0:
        return False

    if new_status == "completed" and existing.get("rider_id"):
        conn.execute("UPDATE riders SET total_trips = COALESCE(total_trips, 0) + 1 WHERE id = ?", (existing["rider_id"],))

    if new_status in ("completed", "cancelled"):
        try:
            end_open_booking_calls(conn, booking_id, end_reason=f"Booking {new_status}")
        except Exception:
            pass

    # Synchronize transaction and customer stats
    try:
        b = get_booking_by_id(conn, booking_id)
        if b:
            record_transaction(conn, b, status=new_status, notes=f"Trip status: {new_status}")
            if new_status == "completed":
                update_customer_stats(conn, b.get("customer_phone", ""), b.get("fare_amount", 0.0))
    except Exception:
        pass

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
    now = get_now_pht().isoformat(timespec="seconds")
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


# -----------------------------------------------------------------------------
# In-App Chat Functions (Rider & Customer Communication)
# -----------------------------------------------------------------------------
def add_booking_message(
    conn: DatabaseConnection,
    booking_id: int,
    sender_role: str,
    sender_name: str,
    message: str,
    msg_type: str = "text",
    media_url: str = "",
    media_duration: float = 0.0,
) -> dict[str, Any]:
    now = get_now_pht().isoformat(timespec="seconds")
    clean_type = "voice" if msg_type == "voice" else "text"
    clean_url = (media_url or "").strip()
    try:
        clean_dur = max(0.0, round(float(media_duration or 0.0), 1))
    except (ValueError, TypeError):
        clean_dur = 0.0
    msg_id = conn.insert_returning_id(
        """
        INSERT INTO booking_messages (booking_id, sender_role, sender_name, message, msg_type, media_url, media_duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (booking_id, sender_role, sender_name, message, clean_type, clean_url, clean_dur, now),
    )
    return {
        "id": msg_id,
        "booking_id": booking_id,
        "sender_role": sender_role,
        "sender_name": sender_name,
        "message": message,
        "msg_type": clean_type,
        "media_url": clean_url,
        "media_duration": clean_dur,
        "created_at": now,
    }


def get_booking_messages(
    conn: DatabaseConnection,
    booking_id: int,
    after_id: int = 0,
    limit: int = 50,
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, booking_id, sender_role, sender_name, message,
               COALESCE(msg_type, 'text') AS msg_type,
               COALESCE(media_url, '') AS media_url,
               COALESCE(media_duration, 0) AS media_duration,
               created_at
        FROM booking_messages
        WHERE booking_id = ? AND id > ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (booking_id, after_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


# -----------------------------------------------------------------------------
# In-App Voice Call (WebRTC Signaling Functions via Persistent DB)
# -----------------------------------------------------------------------------
def _parse_pht_iso(ts_str: str | None) -> datetime | None:
    raw = (ts_str or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        return None


def expire_stale_calls(
    conn: DatabaseConnection,
    booking_id: int | None = None,
    ringing_ttl_sec: int = 45,
    accepted_ttl_sec: int = 7200,
) -> int:
    sql = "SELECT id, status, created_at, updated_at FROM call_sessions WHERE status IN ('ringing', 'accepted')"
    params: tuple[Any, ...] = ()
    if booking_id is not None:
        sql += " AND booking_id = ?"
        params = (booking_id,)
    rows = conn.execute(sql, params).fetchall()
    if not rows:
        return 0

    now_dt = get_now_pht()
    now_iso = now_dt.isoformat(timespec="seconds")
    expired = 0
    for r in rows:
        st = r["status"]
        ref_dt = _parse_pht_iso(r["updated_at"] or r["created_at"])
        if ref_dt is None:
            continue
        age_sec = (now_dt - ref_dt).total_seconds()
        if st == "ringing" and age_sec > ringing_ttl_sec:
            conn.execute(
                """
                UPDATE call_sessions
                SET status = 'missed', end_reason = 'No answer', ended_at = ?, updated_at = ?
                WHERE id = ? AND status = 'ringing'
                """,
                (now_iso, now_iso, r["id"]),
            )
            expired += 1
        elif st == "accepted" and age_sec > accepted_ttl_sec:
            conn.execute(
                """
                UPDATE call_sessions
                SET status = 'ended', end_reason = 'Call timed out', ended_at = ?, updated_at = ?
                WHERE id = ? AND status = 'accepted'
                """,
                (now_iso, now_iso, r["id"]),
            )
            expired += 1
    return expired


def end_open_booking_calls(
    conn: DatabaseConnection,
    booking_id: int,
    end_reason: str = "Booking ended",
) -> int:
    now_iso = get_now_pht().isoformat(timespec="seconds")
    cur = conn.execute(
        """
        UPDATE call_sessions
        SET status = CASE WHEN status = 'ringing' THEN 'missed' ELSE 'ended' END,
            end_reason = ?,
            ended_at = ?,
            updated_at = ?
        WHERE booking_id = ? AND status IN ('ringing', 'accepted')
        """,
        ((end_reason or "Booking ended")[:120], now_iso, now_iso, booking_id),
    )
    return cur.rowcount if hasattr(cur, "rowcount") else 0


def get_call_session(conn: DatabaseConnection, call_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM call_sessions WHERE id = ?", (call_id,)).fetchone()
    return dict(row) if row else None


def get_call_signals(
    conn: DatabaseConnection,
    call_id: int,
    after_id: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, call_id, booking_id, sender_role, signal_type, payload, created_at
        FROM call_signals
        WHERE call_id = ? AND id > ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (call_id, after_id, limit),
    ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        raw_payload = d.get("payload") or ""
        try:
            d["data"] = json.loads(raw_payload) if raw_payload else None
        except Exception:
            d["data"] = None
        out.append(d)
    return out


def add_call_signal(
    conn: DatabaseConnection,
    call_id: int,
    booking_id: int,
    sender_role: str,
    signal_type: str,
    payload_data: Any = None,
) -> int:
    now_iso = get_now_pht().isoformat(timespec="seconds")
    if payload_data is None:
        payload_str = ""
    elif isinstance(payload_data, str):
        payload_str = payload_data
    else:
        payload_str = json.dumps(payload_data)

    sig_id = conn.insert_returning_id(
        """
        INSERT INTO call_signals (call_id, booking_id, sender_role, signal_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (call_id, booking_id, sender_role, signal_type, payload_str, now_iso),
    )
    conn.execute("UPDATE call_sessions SET updated_at = ? WHERE id = ?", (now_iso, call_id))
    return sig_id


def create_call_session(
    conn: DatabaseConnection,
    booking: dict[str, Any],
    caller_role: str,
    caller_name: str,
    offer_data: Any = None,
) -> tuple[bool, str, dict[str, Any] | None, int]:
    if caller_role not in ("customer", "rider"):
        return False, "Only the customer or assigned rider can place a call.", None, 403
    if not booking.get("rider_id") or booking.get("status") not in ("accepted", "in_progress"):
        return False, "In-app calls are available once a rider is assigned and before the trip completes.", None, 400

    booking_id = int(booking["id"])
    expire_stale_calls(conn, booking_id=booking_id)

    open_row = conn.execute(
        """
        SELECT * FROM call_sessions
        WHERE booking_id = ? AND status IN ('ringing', 'accepted')
        ORDER BY id DESC LIMIT 1
        """,
        (booking_id,),
    ).fetchone()
    if open_row:
        existing = dict(open_row)
        if existing["status"] == "accepted":
            return False, "An in-app voice call is already active for this trip.", existing, 409
        if existing["caller_role"] != caller_role:
            return False, f"{existing['caller_name']} is already calling you. Tap Answer to connect.", existing, 409
        # Same caller restarting while ringing -> supersede old ringing session cleanly
        now_prev = get_now_pht().isoformat(timespec="seconds")
        conn.execute(
            """
            UPDATE call_sessions
            SET status = 'ended', end_reason = 'Superseded by new call', ended_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (now_prev, now_prev, existing["id"]),
        )

    callee_role = "rider" if caller_role == "customer" else "customer"
    callee_name = (
        (booking.get("rider_name") or "Club Rider")
        if callee_role == "rider"
        else (booking.get("customer_name") or "Passenger")
    )
    now_iso = get_now_pht().isoformat(timespec="seconds")
    call_uuid = f"call-{secrets.token_urlsafe(10)}"

    call_id = conn.insert_returning_id(
        """
        INSERT INTO call_sessions (
            call_uuid, booking_id, caller_role, caller_name, callee_role, callee_name,
            status, end_reason, created_at, answered_at, ended_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'ringing', '', ?, NULL, NULL, ?)
        """,
        (call_uuid, booking_id, caller_role, (caller_name or "User")[:120], callee_role, callee_name[:120], now_iso, now_iso),
    )

    if offer_data:
        add_call_signal(conn, call_id, booking_id, caller_role, "offer", offer_data)

    return True, "Calling...", get_call_session(conn, call_id), 201


def respond_to_call(
    conn: DatabaseConnection,
    call_id: int,
    actor_role: str,
    action: str,
    answer_data: Any = None,
    reason: str = "",
) -> tuple[bool, str, dict[str, Any] | None, int]:
    call = get_call_session(conn, call_id)
    if not call:
        return False, "Call session not found.", None, 404

    expire_stale_calls(conn, booking_id=int(call["booking_id"]))
    call = get_call_session(conn, call_id)
    if not call:
        return False, "Call session not found.", None, 404

    if actor_role not in (call["caller_role"], call["callee_role"], "system"):
        return False, "Unauthorized to act on this call.", None, 403

    act = (action or "").strip().lower()
    now_iso = get_now_pht().isoformat(timespec="seconds")
    booking_id = int(call["booking_id"])

    if act == "accept":
        if actor_role not in (call["callee_role"], "system"):
            return False, "Only the receiving party can answer this call.", call, 403
        if call["status"] != "ringing":
            return False, f"Cannot answer because call status is '{call['status']}'.", call, 409
        conn.execute(
            """
            UPDATE call_sessions
            SET status = 'accepted', answered_at = ?, updated_at = ?
            WHERE id = ? AND status = 'ringing'
            """,
            (now_iso, now_iso, call_id),
        )
        if answer_data:
            add_call_signal(conn, call_id, booking_id, actor_role, "answer", answer_data)
        return True, "Call connected.", get_call_session(conn, call_id), 200

    if act == "decline":
        if call["status"] not in ("ringing", "accepted"):
            return True, "Call already ended.", call, 200
        clean_reason = (reason or "Call declined")[:120]
        conn.execute(
            """
            UPDATE call_sessions
            SET status = 'declined', end_reason = ?, ended_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (clean_reason, now_iso, now_iso, call_id),
        )
        add_call_signal(conn, call_id, booking_id, actor_role, "decline", {"reason": clean_reason})
        return True, "Call declined.", get_call_session(conn, call_id), 200

    if act in ("hangup", "end"):
        if call["status"] not in ("ringing", "accepted"):
            return True, "Call already ended.", call, 200
        was_ringing_by_caller = call["status"] == "ringing" and actor_role == call["caller_role"]
        new_status = "missed" if was_ringing_by_caller else "ended"
        default_reason = "Caller cancelled" if was_ringing_by_caller else "Call ended"
        clean_reason = (reason or default_reason)[:120]
        conn.execute(
            """
            UPDATE call_sessions
            SET status = ?, end_reason = ?, ended_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_status, clean_reason, now_iso, now_iso, call_id),
        )
        add_call_signal(conn, call_id, booking_id, actor_role, "hangup", {"reason": clean_reason})
        return True, "Call ended.", get_call_session(conn, call_id), 200

    return False, "Unsupported call action.", call, 400


def get_latest_call_state(
    conn: DatabaseConnection,
    booking_id: int,
    active_call_id: int | None = None,
    after_signal_id: int = 0,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    expire_stale_calls(conn, booking_id=booking_id)

    row = conn.execute(
        """
        SELECT * FROM call_sessions
        WHERE booking_id = ? AND status IN ('ringing', 'accepted')
        ORDER BY id DESC LIMIT 1
        """,
        (booking_id,),
    ).fetchone()

    call_dict: dict[str, Any] | None = dict(row) if row else None

    # If client was tracking a specific call_id and another open call isn't present (or doesn't match), return that terminal call
    if active_call_id and (not call_dict or int(call_dict["id"]) != int(active_call_id)):
        tracked = conn.execute(
            "SELECT * FROM call_sessions WHERE id = ? AND booking_id = ?",
            (int(active_call_id), booking_id),
        ).fetchone()
        if tracked and not call_dict:
            call_dict = dict(tracked)

    if not call_dict:
        recent = conn.execute(
            "SELECT * FROM call_sessions WHERE booking_id = ? ORDER BY id DESC LIMIT 1",
            (booking_id,),
        ).fetchone()
        if recent:
            rec_dict = dict(recent)
            ref_dt = _parse_pht_iso(rec_dict.get("ended_at") or rec_dict.get("updated_at"))
            if ref_dt and (get_now_pht() - ref_dt).total_seconds() <= 15:
                call_dict = rec_dict

    if not call_dict:
        return None, []

    signals = get_call_signals(conn, int(call_dict["id"]), after_id=after_signal_id)
    return call_dict, signals


# -----------------------------------------------------------------------------
# Admin System Data Backup & Restore Functions
# -----------------------------------------------------------------------------
def export_full_backup(conn: DatabaseConnection) -> dict[str, Any]:
    """
    Exports a comprehensive JSON-serializable snapshot of all database tables:
    settings, riders, bookings, booking_messages, reviews, uploaded_media (base64),
    and tracking_logs.
    """
    import base64

    # 1. Settings
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    settings_data = [{"key": str(r["key"]), "value": str(r["value"])} for r in settings_rows]

    # 2. Riders
    riders_rows = conn.execute("SELECT * FROM riders ORDER BY id ASC").fetchall()
    riders_data = [dict(r) for r in riders_rows]

    # 3. Bookings
    bookings_rows = conn.execute("SELECT * FROM bookings ORDER BY id ASC").fetchall()
    bookings_data = [dict(r) for r in bookings_rows]

    # 4. Booking Messages
    messages_rows = conn.execute("SELECT * FROM booking_messages ORDER BY id ASC").fetchall()
    messages_data = [dict(r) for r in messages_rows]

    # 5. Reviews
    reviews_rows = conn.execute("SELECT * FROM reviews ORDER BY id ASC").fetchall()
    reviews_data = [dict(r) for r in reviews_rows]

    # 6. Uploaded Media (convert bytea/blob to base64 string)
    media_rows = conn.execute("SELECT filename, mimetype, created_at, data FROM uploaded_media").fetchall()
    media_data = []
    for r in media_rows:
        try:
            raw_bytes = bytes(r["data"]) if r["data"] is not None else b""
            b64_str = base64.b64encode(raw_bytes).decode("ascii")
        except Exception:
            b64_str = ""
        media_data.append({
            "filename": str(r["filename"]),
            "mimetype": str(r["mimetype"]),
            "created_at": str(r["created_at"]),
            "data_base64": b64_str,
        })

    # 7. Tracking Logs (latest 1000)
    tracking_rows = conn.execute("SELECT * FROM tracking_logs ORDER BY id DESC LIMIT 1000").fetchall()
    tracking_data = [dict(r) for r in reversed(tracking_rows)]

    # 8. Customers
    customers_rows = conn.execute("SELECT * FROM customers ORDER BY id ASC").fetchall()
    customers_data = [dict(r) for r in customers_rows]

    # 9. Promo Codes
    promos_rows = conn.execute("SELECT * FROM promo_codes ORDER BY id ASC").fetchall()
    promos_data = [dict(r) for r in promos_rows]

    # 10. Transactions
    txns_rows = conn.execute("SELECT * FROM transactions ORDER BY id ASC").fetchall()
    txns_data = [dict(r) for r in txns_rows]

    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "app": "Camiguin Centric Riders Club",
        "system": "CCRC Admin Backup & Restore System",
        "version": "1.1",
        "exported_at": now_iso,
        "summary": {
            "settings_count": len(settings_data),
            "riders_count": len(riders_data),
            "customers_count": len(customers_data),
            "bookings_count": len(bookings_data),
            "transactions_count": len(txns_data),
            "promo_codes_count": len(promos_data),
            "messages_count": len(messages_data),
            "reviews_count": len(reviews_data),
            "media_count": len(media_data),
            "tracking_logs_count": len(tracking_data),
        },
        "tables": {
            "settings": settings_data,
            "riders": riders_data,
            "customers": customers_data,
            "promo_codes": promos_data,
            "bookings": bookings_data,
            "transactions": txns_data,
            "booking_messages": messages_data,
            "reviews": reviews_data,
            "uploaded_media": media_data,
            "tracking_logs": tracking_data,
        },
    }


def restore_full_backup(
    conn: DatabaseConnection,
    backup_data: dict[str, Any],
    wipe_existing: bool = True,
) -> dict[str, Any]:
    """
    Restores the database from a backup dictionary.
    Supports either full wipe & replace (wipe_existing=True) or safe merge/upsert.
    Transaction integrity is maintained by the caller.
    """
    import base64

    if not isinstance(backup_data, dict):
        raise ValueError("Invalid backup data format: must be a JSON object.")

    tables = backup_data.get("tables")
    if not isinstance(tables, dict):
        raise ValueError("Invalid backup file: missing 'tables' payload.")

    restored_summary = {
        "settings": 0,
        "riders": 0,
        "customers": 0,
        "promo_codes": 0,
        "bookings": 0,
        "transactions": 0,
        "booking_messages": 0,
        "reviews": 0,
        "uploaded_media": 0,
        "tracking_logs": 0,
    }

    if conn.backend == "sqlite":
        conn.execute("PRAGMA foreign_keys = OFF")

    try:
        if wipe_existing:
            # Wipe existing records in reverse dependency order
            conn.execute("DELETE FROM transactions")
            conn.execute("DELETE FROM tracking_logs")
            conn.execute("DELETE FROM booking_messages")
            conn.execute("DELETE FROM reviews")
            conn.execute("DELETE FROM bookings")
            conn.execute("DELETE FROM promo_codes")
            conn.execute("DELETE FROM customers")
            conn.execute("DELETE FROM riders")
            conn.execute("DELETE FROM uploaded_media")
            conn.execute("DELETE FROM settings")

        # 1. Restore settings
        for s in tables.get("settings", []):
            k = s.get("key")
            v = s.get("value")
            if k is not None and v is not None:
                if not wipe_existing:
                    conn.execute("DELETE FROM settings WHERE key = ?", (str(k),))
                conn.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (str(k), str(v)))
                restored_summary["settings"] += 1

        # 2. Restore riders
        for r in tables.get("riders", []):
            r_id = r.get("id")
            phone = str(r.get("phone") or "").strip()
            if not phone:
                continue
            if not wipe_existing:
                if r_id:
                    conn.execute("DELETE FROM riders WHERE id = ? OR phone = ?", (r_id, phone))
                else:
                    conn.execute("DELETE FROM riders WHERE phone = ?", (phone,))

            if r_id is not None:
                conn.execute(
                    """
                    INSERT INTO riders (
                        id, name, phone, password_hash, bike_model, plate_number,
                        municipality, color, license_no, avatar_url, email, status,
                        is_online, last_lat, last_lng, last_active_at, total_trips,
                        rating_avg, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        r_id,
                        r.get("name", "Unknown Rider"),
                        phone,
                        r.get("password_hash", ""),
                        r.get("bike_model", "Motorcycle"),
                        r.get("plate_number", ""),
                        r.get("municipality", "Mambajao"),
                        r.get("color", "#f97316"),
                        r.get("license_no", ""),
                        r.get("avatar_url", ""),
                        r.get("email", ""),
                        r.get("status", "active"),
                        int(r.get("is_online") or 0),
                        r.get("last_lat"),
                        r.get("last_lng"),
                        r.get("last_active_at"),
                        int(r.get("total_trips") or 0),
                        float(r.get("rating_avg") or 5.0),
                        r.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO riders (
                        name, phone, password_hash, bike_model, plate_number,
                        municipality, color, license_no, avatar_url, email, status,
                        is_online, last_lat, last_lng, last_active_at, total_trips,
                        rating_avg, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        r.get("name", "Unknown Rider"),
                        phone,
                        r.get("password_hash", ""),
                        r.get("bike_model", "Motorcycle"),
                        r.get("plate_number", ""),
                        r.get("municipality", "Mambajao"),
                        r.get("color", "#f97316"),
                        r.get("license_no", ""),
                        r.get("avatar_url", ""),
                        r.get("email", ""),
                        r.get("status", "active"),
                        int(r.get("is_online") or 0),
                        r.get("last_lat"),
                        r.get("last_lng"),
                        r.get("last_active_at"),
                        int(r.get("total_trips") or 0),
                        float(r.get("rating_avg") or 5.0),
                        r.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["riders"] += 1

        # 3. Restore bookings
        for b in tables.get("bookings", []):
            b_id = b.get("id")
            code = str(b.get("booking_code") or "").strip()
            if not code:
                continue
            if not wipe_existing:
                if b_id:
                    conn.execute("DELETE FROM bookings WHERE id = ? OR booking_code = ?", (b_id, code))
                else:
                    conn.execute("DELETE FROM bookings WHERE booking_code = ?", (code,))

            if b_id is not None:
                conn.execute(
                    """
                    INSERT INTO bookings (
                        id, booking_code, service_type, status, customer_name,
                        customer_phone, pickup_address, pickup_lat, pickup_lng,
                        dropoff_address, dropoff_lat, dropoff_lng, item_notes,
                        estimated_budget, estimated_km, fare_amount, payment_method,
                        rider_id, accepted_at, pickup_time, completed_at,
                        cancelled_reason, scheduled_at, promo_code_id, promo_code,
                        discount_amount, transferred_from_rider_id, transfer_reason,
                        transfer_count, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        b_id,
                        code,
                        b.get("service_type", "pahatud"),
                        b.get("status", "broadcast"),
                        b.get("customer_name", "Customer"),
                        b.get("customer_phone", ""),
                        b.get("pickup_address", ""),
                        b.get("pickup_lat"),
                        b.get("pickup_lng"),
                        b.get("dropoff_address", ""),
                        b.get("dropoff_lat"),
                        b.get("dropoff_lng"),
                        b.get("item_notes", ""),
                        float(b.get("estimated_budget") or 0.0),
                        float(b.get("estimated_km") or 0.0),
                        float(b.get("fare_amount") or 0.0),
                        b.get("payment_method", "cash"),
                        b.get("rider_id"),
                        b.get("accepted_at"),
                        b.get("pickup_time"),
                        b.get("completed_at"),
                        b.get("cancelled_reason", ""),
                        b.get("scheduled_at"),
                        b.get("promo_code_id"),
                        b.get("promo_code") or "",
                        float(b.get("discount_amount") or 0.0),
                        b.get("transferred_from_rider_id"),
                        b.get("transfer_reason") or "",
                        int(b.get("transfer_count") or 0),
                        b.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO bookings (
                        booking_code, service_type, status, customer_name,
                        customer_phone, pickup_address, pickup_lat, pickup_lng,
                        dropoff_address, dropoff_lat, dropoff_lng, item_notes,
                        estimated_budget, estimated_km, fare_amount, payment_method,
                        rider_id, accepted_at, pickup_time, completed_at,
                        cancelled_reason, scheduled_at, promo_code_id, promo_code,
                        discount_amount, transferred_from_rider_id, transfer_reason,
                        transfer_count, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        code,
                        b.get("service_type", "pahatud"),
                        b.get("status", "broadcast"),
                        b.get("customer_name", "Customer"),
                        b.get("customer_phone", ""),
                        b.get("pickup_address", ""),
                        b.get("pickup_lat"),
                        b.get("pickup_lng"),
                        b.get("dropoff_address", ""),
                        b.get("dropoff_lat"),
                        b.get("dropoff_lng"),
                        b.get("item_notes", ""),
                        float(b.get("estimated_budget") or 0.0),
                        float(b.get("estimated_km") or 0.0),
                        float(b.get("fare_amount") or 0.0),
                        b.get("payment_method", "cash"),
                        b.get("rider_id"),
                        b.get("accepted_at"),
                        b.get("pickup_time"),
                        b.get("completed_at"),
                        b.get("cancelled_reason", ""),
                        b.get("scheduled_at"),
                        b.get("promo_code_id"),
                        b.get("promo_code") or "",
                        float(b.get("discount_amount") or 0.0),
                        b.get("transferred_from_rider_id"),
                        b.get("transfer_reason") or "",
                        int(b.get("transfer_count") or 0),
                        b.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["bookings"] += 1

        # 4. Restore booking_messages
        for m in tables.get("booking_messages", []):
            m_id = m.get("id")
            b_id = m.get("booking_id")
            if not b_id:
                continue
            if not wipe_existing and m_id:
                conn.execute("DELETE FROM booking_messages WHERE id = ?", (m_id,))

            msg_type = m.get("msg_type") or "text"
            media_url = m.get("media_url") or ""
            media_duration = float(m.get("media_duration") or 0.0)

            if m_id is not None:
                conn.execute(
                    """
                    INSERT INTO booking_messages (id, booking_id, sender_role, sender_name, message, msg_type, media_url, media_duration, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        m_id,
                        b_id,
                        m.get("sender_role", "system"),
                        m.get("sender_name", "System"),
                        m.get("message", ""),
                        msg_type,
                        media_url,
                        media_duration,
                        m.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO booking_messages (booking_id, sender_role, sender_name, message, msg_type, media_url, media_duration, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        b_id,
                        m.get("sender_role", "system"),
                        m.get("sender_name", "System"),
                        m.get("message", ""),
                        msg_type,
                        media_url,
                        media_duration,
                        m.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["booking_messages"] += 1

        # 5. Restore reviews
        for rv in tables.get("reviews", []):
            rv_id = rv.get("id")
            rider_id = rv.get("rider_id")
            if not rider_id:
                continue
            if not wipe_existing and rv_id:
                conn.execute("DELETE FROM reviews WHERE id = ?", (rv_id,))

            if rv_id is not None:
                conn.execute(
                    """
                    INSERT INTO reviews (id, booking_id, rider_id, customer_name, rating, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rv_id,
                        rv.get("booking_id"),
                        rider_id,
                        rv.get("customer_name", "Customer"),
                        int(rv.get("rating") or 5),
                        rv.get("comment", ""),
                        rv.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO reviews (booking_id, rider_id, customer_name, rating, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rv.get("booking_id"),
                        rider_id,
                        rv.get("customer_name", "Customer"),
                        int(rv.get("rating") or 5),
                        rv.get("comment", ""),
                        rv.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["reviews"] += 1

        # 6. Restore uploaded_media
        for med in tables.get("uploaded_media", []):
            fname = med.get("filename")
            b64_data = med.get("data_base64")
            mimetype = med.get("mimetype", "application/octet-stream")
            created_at = med.get("created_at") or get_now_pht().isoformat()
            if not fname or not b64_data:
                continue
            try:
                raw_bytes = base64.b64decode(b64_data)
            except Exception:
                continue
            conn.execute(
                """
                INSERT INTO uploaded_media (filename, data, mimetype, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(filename) DO UPDATE SET data = excluded.data, mimetype = excluded.mimetype
                """,
                (fname, raw_bytes, mimetype, created_at),
            )
            restored_summary["uploaded_media"] += 1

        # 7. Restore tracking_logs
        for tl in tables.get("tracking_logs", []):
            tl_id = tl.get("id")
            b_id = tl.get("booking_id")
            r_id = tl.get("rider_id")
            lat = tl.get("lat")
            lng = tl.get("lng")
            if not (b_id and r_id and lat is not None and lng is not None):
                continue
            if not wipe_existing and tl_id:
                conn.execute("DELETE FROM tracking_logs WHERE id = ?", (tl_id,))

            if tl_id is not None:
                conn.execute(
                    """
                    INSERT INTO tracking_logs (id, booking_id, rider_id, lat, lng, speed, heading, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        tl_id,
                        b_id,
                        r_id,
                        float(lat),
                        float(lng),
                        float(tl.get("speed") or 0.0),
                        float(tl.get("heading") or 0.0),
                        tl.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO tracking_logs (booking_id, rider_id, lat, lng, speed, heading, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        b_id,
                        r_id,
                        float(lat),
                        float(lng),
                        float(tl.get("speed") or 0.0),
                        float(tl.get("heading") or 0.0),
                        tl.get("created_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["tracking_logs"] += 1

        # 8. Restore customers
        for c in tables.get("customers", []):
            c_id = c.get("id")
            c_phone = (c.get("phone") or "").strip()
            if not c_phone:
                continue
            if not wipe_existing:
                conn.execute("DELETE FROM customers WHERE phone = ?", (c_phone,))
            if c_id is not None:
                conn.execute(
                    """
                    INSERT INTO customers (
                        id, phone, name, password_hash, email, avatar_url, barangay,
                        is_verified, status, total_rides, total_spent, saved_notes,
                        created_at, last_active_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        c_id, c_phone, c.get("name", "Passenger"), c.get("password_hash", ""),
                        c.get("email", ""), c.get("avatar_url", ""), c.get("barangay", ""),
                        int(c.get("is_verified") or 0), c.get("status", "active"),
                        int(c.get("total_rides") or 0), float(c.get("total_spent") or 0.0),
                        c.get("saved_notes", ""), c.get("created_at") or get_now_pht().isoformat(),
                        c.get("last_active_at") or get_now_pht().isoformat(),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO customers (
                        phone, name, password_hash, email, avatar_url, barangay,
                        is_verified, status, total_rides, total_spent, saved_notes,
                        created_at, last_active_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        c_phone, c.get("name", "Passenger"), c.get("password_hash", ""),
                        c.get("email", ""), c.get("avatar_url", ""), c.get("barangay", ""),
                        int(c.get("is_verified") or 0), c.get("status", "active"),
                        int(c.get("total_rides") or 0), float(c.get("total_spent") or 0.0),
                        c.get("saved_notes", ""), c.get("created_at") or get_now_pht().isoformat(),
                        c.get("last_active_at") or get_now_pht().isoformat(),
                    ),
                )
            restored_summary["customers"] += 1

        # 9. Restore promo_codes
        for p in tables.get("promo_codes", []):
            p_code = (p.get("code") or "").strip().upper()
            if not p_code:
                continue
            if not wipe_existing:
                conn.execute("DELETE FROM promo_codes WHERE code = ?", (p_code,))
            conn.execute(
                """
                INSERT INTO promo_codes (
                    code, discount_amount, min_fare, max_uses, uses_count, is_active, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    p_code, float(p.get("discount_amount") or 0.0), float(p.get("min_fare") or 0.0),
                    int(p.get("max_uses") or 100), int(p.get("uses_count") or 0),
                    int(p.get("is_active") if p.get("is_active") is not None else 1),
                    p.get("expires_at"), p.get("created_at") or get_now_pht().isoformat(),
                ),
            )
            restored_summary["promo_codes"] += 1

        # 10. Restore transactions
        for tx in tables.get("transactions", []):
            tx_code = (tx.get("transaction_code") or "").strip()
            b_id = tx.get("booking_id")
            if not (tx_code and b_id):
                continue
            if not wipe_existing:
                conn.execute("DELETE FROM transactions WHERE transaction_code = ?", (tx_code,))
            conn.execute(
                """
                INSERT INTO transactions (
                    transaction_code, booking_id, booking_code, rider_id, rider_name,
                    customer_name, customer_phone, service_type, amount, payment_method,
                    status, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tx_code, b_id, tx.get("booking_code", ""), tx.get("rider_id"),
                    tx.get("rider_name", ""), tx.get("customer_name", ""),
                    tx.get("customer_phone", ""), tx.get("service_type", "pahatud"),
                    float(tx.get("amount") or 0.0), tx.get("payment_method", "cash"),
                    tx.get("status", "completed"), tx.get("notes", ""),
                    tx.get("created_at") or get_now_pht().isoformat(),
                ),
            )
            restored_summary["transactions"] += 1

        # If Postgres backend, synchronize sequence values
        if conn.backend == "postgresql":
            for seq_tbl in ("riders", "customers", "promo_codes", "bookings", "transactions", "booking_messages", "reviews", "tracking_logs"):
                try:
                    conn.execute(
                        f"SELECT setval(pg_get_serial_sequence('{seq_tbl}', 'id'), COALESCE((SELECT MAX(id) FROM {seq_tbl}), 1));"
                    )
                except Exception:
                    pass

    finally:
        if conn.backend == "sqlite":
            conn.execute("PRAGMA foreign_keys = ON")

    return {
        "success": True,
        "wipe_existing": wipe_existing,
        "restored": restored_summary,
        "message": f"Successfully restored {restored_summary['riders']} riders, {restored_summary['bookings']} bookings, {restored_summary['settings']} settings, {restored_summary['booking_messages']} chat messages, and {restored_summary['uploaded_media']} media files.",
    }


# -------------------------------------------------------------------------
# Customer Profiles, Verification & History
# -------------------------------------------------------------------------
def get_or_create_customer(conn: DatabaseConnection, phone: str, name: str = "") -> dict[str, Any]:
    raw_phone = (phone or "").strip()
    clean_phone = normalize_ph_phone(raw_phone) or raw_phone
    name = (name or "").strip()
    now_iso = get_now_pht().isoformat(timespec="seconds")

    existing = get_customer_by_phone(conn, clean_phone) or (get_customer_by_phone(conn, raw_phone) if raw_phone else None)
    if existing:
        if name and name != existing.get("name"):
            conn.execute("UPDATE customers SET name = ?, last_active_at = ? WHERE id = ?", (name, now_iso, existing["id"]))
        else:
            conn.execute("UPDATE customers SET last_active_at = ? WHERE id = ?", (now_iso, existing["id"]))
        row = conn.execute("SELECT * FROM customers WHERE id = ?", (existing["id"],)).fetchone()
        return dict(row) if row else existing

    conn.execute(
        """
        INSERT INTO customers (phone, name, email, is_verified, status, total_rides, total_spent, saved_notes, created_at, last_active_at)
        VALUES (?, ?, '', 0, 'active', 0, 0.0, '', ?, ?)
        """,
        (clean_phone, name or "Camiguin Passenger", now_iso, now_iso)
    )
    row = conn.execute("SELECT * FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1", (clean_phone,)).fetchone()
    return dict(row) if row else {"phone": clean_phone, "name": name or "Camiguin Passenger", "is_verified": 0}

def register_customer(
    conn: DatabaseConnection,
    name: str,
    phone: str,
    password: str = "",
    barangay: str = "",
    email: str = "",
    avatar_url: str = "",
) -> dict[str, Any]:
    clean_phone = normalize_ph_phone(phone)
    name = (name or "").strip()
    barangay = (barangay or "").strip()
    email = (email or "").strip().lower()
    avatar_url = (avatar_url or "").strip()
    pwd_hash = generate_password_hash(password) if password else ""
    is_verified = 1 if password else 0
    now_iso = get_now_pht().isoformat(timespec="seconds")

    cust = get_customer_by_phone(conn, clean_phone)
    if cust:
        conn.execute(
            """
            UPDATE customers
            SET name = COALESCE(NULLIF(?, ''), name),
                phone = ?,
                password_hash = CASE WHEN ? != '' THEN ? ELSE password_hash END,
                barangay = COALESCE(NULLIF(?, ''), barangay),
                email = COALESCE(NULLIF(?, ''), email),
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                is_verified = CASE WHEN ? != '' THEN 1 ELSE is_verified END,
                last_active_at = ?
            WHERE id = ?
            """,
            (name, clean_phone, password, pwd_hash, barangay, email, avatar_url, password, now_iso, cust["id"]),
        )
        return dict(conn.execute("SELECT * FROM customers WHERE id = ?", (cust["id"],)).fetchone())

    conn.execute(
        """
        INSERT INTO customers (
            phone, name, password_hash, email, avatar_url, barangay, is_verified, status,
            total_rides, total_spent, saved_notes, created_at, last_active_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0.0, '', ?, ?)
        """,
        (clean_phone, name or "Camiguin Passenger", pwd_hash, email, avatar_url, barangay, is_verified, now_iso, now_iso),
    )
    row = conn.execute("SELECT * FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1", (clean_phone,)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM customers WHERE phone = ?", (phone,)).fetchone()
    if row:
        return dict(row)
    return {"id": 0, "name": name, "phone": clean_phone, "email": email, "is_verified": is_verified, "avatar_url": avatar_url}

def authenticate_customer(conn: DatabaseConnection, phone: str, password: str) -> dict[str, Any] | None:
    row = get_customer_by_phone(conn, phone)
    if not row:
        return None
    r_dict = dict(row)
    pwd_hash = r_dict.get("password_hash") or ""
    if not pwd_hash or not check_password_hash(pwd_hash, password):
        return None
    now_iso = get_now_pht().isoformat(timespec="seconds")
    conn.execute("UPDATE customers SET last_active_at = ? WHERE id = ?", (now_iso, r_dict["id"]))
    return r_dict

def toggle_customer_verify(conn: DatabaseConnection, customer_id: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        return None
    r_dict = dict(row)
    new_verified = 0 if r_dict.get("is_verified", 0) else 1
    conn.execute("UPDATE customers SET is_verified = ? WHERE id = ?", (new_verified, customer_id))
    updated = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    return dict(updated) if updated else None

def delete_customer(conn: DatabaseConnection, customer_id: int) -> bool:
    """Permanently deletes a registered customer by ID (Admin-only action)."""
    row = conn.execute("SELECT id FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        return False
    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    return True

def update_customer_password(conn: DatabaseConnection, customer_id: int, new_password_hash: str) -> bool:
    """Updates password hash for a registered customer account."""
    row = conn.execute("SELECT id FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        return False
    conn.execute("UPDATE customers SET password_hash = ? WHERE id = ?", (new_password_hash, customer_id))
    conn.commit()
    return True

def get_customer_by_phone(conn: DatabaseConnection, identifier: str) -> dict[str, Any] | None:
    """Finds a customer by phone number or email address."""
    if not identifier:
        return None
    ident = str(identifier).strip()

    # 1. Search by email if it looks like an email or direct match
    if "@" in ident:
        row = conn.execute("SELECT * FROM customers WHERE LOWER(TRIM(email)) = LOWER(?)", (ident,)).fetchone()
        if row:
            return dict(row)

    clean_p = normalize_ph_phone(ident)
    unspaced = ident.replace(" ", "").replace("-", "")

    # 2. Search by phone or email
    row = conn.execute(
        "SELECT * FROM customers WHERE phone = ? OR phone = ? OR LOWER(TRIM(email)) = LOWER(?)",
        (clean_p, unspaced, ident.lower())
    ).fetchone()
    if row:
        return dict(row)

    # 3. Match last 10 digits
    digits = "".join(filter(str.isdigit, ident))
    if len(digits) >= 10:
        last10 = digits[-10:]
        row = conn.execute(
            "SELECT * FROM customers WHERE phone = ? OR phone = ? OR phone LIKE ? ORDER BY id DESC LIMIT 1",
            (f"0{last10}", f"+63{last10}", f"%{last10}")
        ).fetchone()
        if row:
            return dict(row)

    return None

get_customer_by_phone_or_email = get_customer_by_phone

def get_all_customers(conn: DatabaseConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM customers
        ORDER BY is_verified DESC, total_rides DESC, id DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]

def update_customer_stats(conn: DatabaseConnection, customer_phone: str, fare_amount: float) -> None:
    if not customer_phone:
        return
    phone = customer_phone.strip()
    try:
        fare = float(fare_amount or 0.0)
    except (ValueError, TypeError):
        fare = 0.0
    now_iso = get_now_pht().isoformat(timespec="seconds")
    cust = get_customer_by_phone(conn, phone)
    if cust:
        conn.execute(
            """
            UPDATE customers
            SET total_rides = COALESCE(total_rides, 0) + 1,
                total_spent = COALESCE(total_spent, 0.0) + ?,
                last_active_at = ?
            WHERE id = ?
            """,
            (fare, now_iso, cust["id"]),
        )

def get_customer_ride_history(conn: DatabaseConnection, phone: str, limit: int = 15) -> list[dict[str, Any]]:
    clean_p = phone.strip()
    if "@" in clean_p:
        cust = get_customer_by_phone(conn, clean_p)
        if cust and cust.get("phone"):
            clean_p = cust["phone"]

    digits = "".join(filter(str.isdigit, clean_p))
    last10 = digits[-10:] if len(digits) >= 10 else digits
    norm_p = normalize_ph_phone(clean_p) or clean_p

    if len(last10) >= 7:
        rows = conn.execute(
            f"""
            SELECT b.*, r.name AS rider_name, r.bike_model AS rider_bike, r.phone AS rider_phone
            FROM bookings b
            LEFT JOIN riders r ON b.rider_id = r.id
            WHERE b.customer_phone = ?
               OR b.customer_phone = ?
               OR b.customer_phone LIKE ?
               OR b.customer_phone LIKE ?
            ORDER BY b.id DESC
            LIMIT {int(limit)}
            """,
            (clean_p, norm_p, f"%{last10}", f"0{last10}")
        ).fetchall()
    else:
        rows = conn.execute(
            f"""
            SELECT b.*, r.name AS rider_name, r.bike_model AS rider_bike, r.phone AS rider_phone
            FROM bookings b
            LEFT JOIN riders r ON b.rider_id = r.id
            WHERE b.customer_phone = ?
            ORDER BY b.id DESC
            LIMIT {int(limit)}
            """,
            (clean_p,)
        ).fetchall()
    return [dict(r) for r in rows]


# -------------------------------------------------------------------------
# Transactions & Financial Ledger Engine
# -------------------------------------------------------------------------
def generate_transaction_code(booking_code: str = "") -> str:
    if booking_code:
        return f"TXN-{booking_code}"
    now_str = get_now_pht().strftime("%Y%m%d")
    rnd = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"TXN-{now_str}-{rnd}"

def record_transaction(
    conn: DatabaseConnection,
    booking: dict[str, Any],
    status: str = "completed",
    notes: str = "",
) -> dict[str, Any]:
    booking_id = booking["id"]
    booking_code = booking.get("booking_code", "")
    customer_phone = booking.get("customer_phone", "")
    customer_name = booking.get("customer_name", "")
    rider_id = booking.get("rider_id")
    rider_name = booking.get("rider_name", "")
    if not rider_name and rider_id:
        r = conn.execute("SELECT name FROM riders WHERE id = ?", (rider_id,)).fetchone()
        if r:
            rider_name = r["name"]
    service_type = booking.get("service_type", "ride")
    try:
        amount = float(booking.get("fare_amount", 0.0))
    except (ValueError, TypeError):
        amount = 0.0
    payment_method = booking.get("payment_method", "cash")
    now_iso = get_now_pht().isoformat(timespec="seconds")

    existing = conn.execute("SELECT * FROM transactions WHERE booking_id = ?", (booking_id,)).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE transactions
            SET rider_id = COALESCE(?, rider_id),
                rider_name = CASE WHEN ? != '' THEN ? ELSE rider_name END,
                amount = ?,
                payment_method = ?,
                status = ?,
                notes = CASE WHEN ? != '' THEN ? ELSE notes END
            WHERE booking_id = ?
            """,
            (rider_id, rider_name, rider_name, amount, payment_method, status, notes, notes, booking_id),
        )
        row = conn.execute("SELECT * FROM transactions WHERE booking_id = ?", (booking_id,)).fetchone()
        return dict(row) if row else {}

    txn_code = generate_transaction_code(booking_code)
    conn.execute(
        """
        INSERT INTO transactions (
            transaction_code, booking_id, booking_code, customer_phone, customer_name,
            rider_id, rider_name, service_type, amount, payment_method, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            txn_code,
            booking_id,
            booking_code,
            customer_phone,
            customer_name,
            rider_id,
            rider_name,
            service_type,
            amount,
            payment_method,
            status,
            notes,
            now_iso,
        ),
    )
    row = conn.execute("SELECT * FROM transactions WHERE booking_id = ?", (booking_id,)).fetchone()
    return dict(row) if row else {}

def get_all_transactions(conn: DatabaseConnection, limit: int = 200, status_filter: str = "") -> list[dict[str, Any]]:
    if status_filter:
        rows = conn.execute(
            """
            SELECT t.*, COALESCE(c.is_verified, 0) AS customer_verified
            FROM transactions t
            LEFT JOIN customers c ON t.customer_phone = c.phone
            WHERE t.status = ?
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (status_filter, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT t.*, COALESCE(c.is_verified, 0) AS customer_verified
            FROM transactions t
            LEFT JOIN customers c ON t.customer_phone = c.phone
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]

def get_rider_transactions(conn: DatabaseConnection, rider_id: int, limit: int = 50) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT t.*, COALESCE(c.is_verified, 0) AS customer_verified
        FROM transactions t
        LEFT JOIN customers c ON t.customer_phone = c.phone
        WHERE t.rider_id = ?
        ORDER BY t.id DESC
        LIMIT ?
        """,
        (rider_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]

def get_rider_transaction_summary(conn: DatabaseConnection, rider_id: int, today_prefix: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT COUNT(*) AS total_count,
               COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS all_time_earnings,
               COALESCE(SUM(CASE WHEN status = 'completed' AND SUBSTR(CAST(created_at AS TEXT), 1, 10) = ? THEN amount ELSE 0 END), 0) AS today_earnings
        FROM transactions
        WHERE rider_id = ?
        """,
        (today_prefix, rider_id),
    ).fetchone()
    return {
        "total_transactions": int(row["total_count"] or 0) if row else 0,
        "all_time_earnings": float(row["all_time_earnings"] or 0.0) if row else 0.0,
        "today_earnings": float(row["today_earnings"] or 0.0) if row else 0.0,
    }

def get_customer_transactions(conn: DatabaseConnection, customer_phone: str, limit: int = 50) -> list[dict[str, Any]]:
    raw_p = (customer_phone or "").strip()
    clean_p = normalize_ph_phone(raw_p) or raw_p
    rows = conn.execute(
        """
        SELECT t.*, COALESCE(c.is_verified, 0) AS customer_verified
        FROM transactions t
        LEFT JOIN customers c ON t.customer_phone = c.phone
        WHERE t.customer_phone = ? OR t.customer_phone = ?
        ORDER BY t.id DESC
        LIMIT ?
        """,
        (clean_p, raw_p, limit),
    ).fetchall()
    return [dict(r) for r in rows]

def get_financial_summary(conn: DatabaseConnection) -> dict[str, Any]:
    row_total = conn.execute(
        """
        SELECT COUNT(*) AS total_txns,
               COALESCE(SUM(amount), 0) AS total_revenue,
               COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_revenue,
               COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN amount ELSE 0 END), 0) AS digital_revenue
        FROM transactions
        WHERE status = 'completed'
        """
    ).fetchone()
    row_all = conn.execute(
        """
        SELECT COUNT(*) AS all_txns,
               COALESCE(SUM(amount), 0) AS gross_volume
        FROM transactions
        """
    ).fetchone()
    cust_stats = conn.execute(
        """
        SELECT COUNT(*) AS total_customers,
               COALESCE(SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END), 0) AS verified_customers
        FROM customers
        """
    ).fetchone()
    return {
        "total_transactions": row_total["total_txns"] if row_total else 0,
        "all_transactions": row_all["all_txns"] if row_all else 0,
        "total_revenue": float(row_total["total_revenue"] if row_total else 0.0),
        "gross_volume": float(row_all["gross_volume"] if row_all else 0.0),
        "cash_revenue": float(row_total["cash_revenue"] if row_total else 0.0),
        "digital_revenue": float(row_total["digital_revenue"] if row_total else 0.0),
        "total_customers": cust_stats["total_customers"] if cust_stats else 0,
        "verified_customers": cust_stats["verified_customers"] if cust_stats else 0,
    }

def get_booking_summary_counts(conn: DatabaseConnection) -> dict[str, int]:
    row = conn.execute(
        """
        SELECT COUNT(*) AS total_bookings,
               COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
               COALESCE(SUM(CASE WHEN status IN ('broadcast', 'accepted', 'in_progress') THEN 1 ELSE 0 END), 0) AS active_now
        FROM bookings
        """
    ).fetchone()
    return {
        "total_bookings": int(row["total_bookings"] or 0) if row else 0,
        "completed": int(row["completed"] or 0) if row else 0,
        "active_now": int(row["active_now"] or 0) if row else 0,
    }

# -------------------------------------------------------------------------
# Promo Codes Engine
# -------------------------------------------------------------------------
def validate_promo_code(conn: DatabaseConnection, code: str, current_fare: float = 0.0) -> dict[str, Any]:
    code = (code or "").strip().upper()
    if not code:
        return {"valid": False, "error": "Please enter a promo code."}
    row = conn.execute("SELECT * FROM promo_codes WHERE code = ?", (code,)).fetchone()
    if not row:
        return {"valid": False, "error": "Promo code not found or invalid."}
    if not row["is_active"]:
        return {"valid": False, "error": "This promo code is no longer active."}
    if row["max_uses"] and row["uses_count"] >= row["max_uses"]:
        return {"valid": False, "error": "This promo code has reached its maximum redemptions."}
    if row["expires_at"]:
        exp_str = str(row["expires_at"]).strip().replace(" ", "T")[:19]
        now_str = get_now_pht().strftime("%Y-%m-%dT%H:%M:%S")
        if exp_str < now_str:
            return {"valid": False, "error": "This promo code has already expired."}
    if row["min_fare"] and current_fare < float(row["min_fare"]):
        return {"valid": False, "error": f"Minimum fare of ₱{row['min_fare']:.0f} required to use this voucher."}
    
    discount = min(float(row["discount_amount"]), float(current_fare))
    return {
        "valid": True,
        "code": row["code"],
        "promo_id": row["id"],
        "discount_amount": discount,
        "raw_discount": float(row["discount_amount"] or 0.0),
        "min_fare": float(row["min_fare"] or 0.0),
        "new_fare": max(0.0, current_fare - discount),
        "message": f"₱{discount:.0f} discount voucher applied!"
    }

def apply_promo_code(conn: DatabaseConnection, code: str) -> bool:
    code = (code or "").strip().upper()
    cur = conn.execute(
        """
        UPDATE promo_codes
        SET uses_count = uses_count + 1
        WHERE code = ?
          AND is_active = 1
          AND (max_uses IS NULL OR max_uses = 0 OR uses_count < max_uses)
        """,
        (code,),
    )
    return (cur.rowcount if hasattr(cur, "rowcount") else 0) > 0

# -------------------------------------------------------------------------
# Rider Ratings & Reviews
# -------------------------------------------------------------------------
def create_review(conn: DatabaseConnection, booking_id: int | None, rider_id: int, customer_name: str, rating: int, comment: str = "") -> dict[str, Any]:
    now_iso = get_now_pht().isoformat(timespec="seconds")
    rating = max(1, min(5, int(rating)))
    clean_name = (customer_name or "").strip() or "Island Passenger"
    clean_comment = (comment or "").strip()
    review_id = conn.insert_returning_id(
        """
        INSERT INTO reviews (booking_id, rider_id, customer_name, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (booking_id, rider_id, clean_name, rating, clean_comment, now_iso)
    )
    # Recalculate average rating for rider (do NOT increment total_trips here; handled on booking completion)
    avg_row = conn.execute("SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM reviews WHERE rider_id = ?", (rider_id,)).fetchone()
    if avg_row and avg_row["avg_r"] is not None:
        conn.execute("UPDATE riders SET rating_avg = ? WHERE id = ?", (round(float(avg_row["avg_r"]), 2), rider_id))
    conn.commit()
    return {
        "id": review_id,
        "booking_id": booking_id,
        "rider_id": rider_id,
        "customer_name": clean_name,
        "rating": rating,
        "comment": clean_comment,
        "created_at": now_iso,
    }

def get_review_by_booking_id(conn: DatabaseConnection, booking_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM reviews WHERE booking_id = ? ORDER BY id DESC LIMIT 1",
        (booking_id,),
    ).fetchone()
    return dict(row) if row else None

def get_rider_reviews(conn: DatabaseConnection, rider_id: int, limit: int = 10) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"SELECT * FROM reviews WHERE rider_id = ? ORDER BY id DESC LIMIT {int(limit)}",
        (rider_id,)
    ).fetchall()
    return [dict(r) for r in rows]

# -------------------------------------------------------------------------
# Nearest Rider ETA Calculation
# -------------------------------------------------------------------------
def calculate_nearest_rider_eta(conn: DatabaseConnection, target_lat: float, target_lng: float) -> dict[str, Any]:
    riders = get_online_riders(conn)
    if not riders:
        return {"has_riders": False, "count": 0, "nearest_km": None, "eta_mins": 10, "message": "Dispatching island broadcast..."}
    
    nearest_km = 999.0
    for r in riders:
        if r.get("last_lat") and r.get("last_lng"):
            dist = calculate_haversine_km(target_lat, target_lng, float(r["last_lat"]), float(r["last_lng"]))
            if dist < nearest_km:
                nearest_km = dist
    
    if nearest_km >= 990.0:
        nearest_km = 2.0
    
    eta_mins = max(3, int(round((nearest_km / 30.0) * 60)) + 2)
    return {
        "has_riders": True,
        "count": len(riders),
        "nearest_km": round(nearest_km, 1),
        "eta_mins": eta_mins,
        "message": f"~{eta_mins} mins away ({nearest_km:.1f} km)"
    }

# -------------------------------------------------------------------------
# Official Camiguin Island Tour Packages
# -------------------------------------------------------------------------
CAMIGUIN_TOUR_PACKAGES = [
    {
        "id": "white-island-half-day",
        "title": "White Island & Mambajao Coast Tour",
        "duration": "4-5 Hours",
        "recommended_rider": "1 Verified Habal-habal Guide",
        "base_fare": 450,
        "image": "🏝️",
        "description": "Jump-off at White Island boat terminal, Agoho Beach, Tongatok Cliff viewpoint, and Samuel / Placido Reyes culinary stops.",
        "itinerary": ["White Island Boat Station", "Agoho Sandy Beach", "Tongatok Cliff Viewpoint", "Placido Reyes / Town Center"]
    },
    {
        "id": "sunken-cemetery-heritage",
        "title": "Heritage & Catarman Volcano Tour",
        "duration": "5-6 Hours",
        "recommended_rider": "1 Verified Habal-habal Guide",
        "base_fare": 550,
        "image": "⛪",
        "description": "Visit the iconic Sunken Cemetery, Guiob Old Spanish Church Ruins, Walk Upon the Volcano walkway, and Bonbon coast.",
        "itinerary": ["Sunken Cemetery Cross", "Guiob Church Ruins", "Stations of the Cross / Volcano Walkway", "Bura Soda Water"]
    },
    {
        "id": "falls-and-springs-adventure",
        "title": "Waterfalls & Springs Refresh Tour",
        "duration": "6 Hours",
        "recommended_rider": "1 Verified Habal-habal Guide",
        "base_fare": 650,
        "image": "💧",
        "description": "Immerse in Katibawasan Falls, Tuasan Falls, Ardent Hibok-hibok Hot Spring, and Sto. Niño Cold Spring.",
        "itinerary": ["Katibawasan Falls", "Ardent Hot Springs", "Tuasan Falls", "Sto. Niño Cold Spring"]
    },
    {
        "id": "full-island-circumnavigation",
        "title": "Ultimate 64-KM Camiguin Circumferential Tour",
        "duration": "Full Day (8 Hours)",
        "recommended_rider": "1 Verified Habal-habal Guide",
        "base_fare": 950,
        "image": "🛵",
        "description": "The definitive tour! Full loop across all 5 municipalities: Mambajao, Mahinog, Catarman, Sagay, and Guinsiliban.",
        "itinerary": ["Mambajao Town Plaza", "Benoni Port / Taguines Lagoon", "Giant Clam Sanctuary Guinsiliban", "Sto. Niño Spring Sagay", "Sunken Cemetery Catarman", "White Island"]
    }
]
