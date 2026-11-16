"""
Database module for Camiguin Centric Riders Club (CCRC).
Supports SQLite for local development/testing and PostgreSQL for Neon/Render cloud deployments.
"""

from __future__ import annotations

import json
import math
import os
import secrets
import sqlite3
import urllib.request
from datetime import datetime, timezone
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


# -------------------------------------------------------------------------
# Camiguin Island Master Landmark & Places Directory (126+ Locations)
# Covers all 5 municipalities, all 57 barangays, stores, supermarkets,
# pharmacies, markets, schools, hospitals, resorts, tourist spots, & streets.
# -------------------------------------------------------------------------
CAMIGUIN_KNOWN_PLACES: list[dict[str, Any]] = [
    # --- Stores, Supermarkets, Groceries & Wholesalers ---
    {"name": "Gaisano Capital Camiguin", "cat": "supermarket", "keywords": ["gaisano", "gaisano capital", "mall", "supermarket", "grocery"], "lat": 9.2475, "lng": 124.6995, "mun": "Mambajao"},
    {"name": "Davilett Store & Supermarket, Mambajao", "cat": "supermarket", "keywords": ["davilett", "davilet", "davi", "supermarket", "grocery"], "lat": 9.2482, "lng": 124.6978, "mun": "Mambajao"},
    {"name": "Nene Uy Store / Wholesaler, Mambajao", "cat": "store", "keywords": ["nene uy", "nene", "wholesaler", "grocery", "supply"], "lat": 9.2480, "lng": 124.6976, "mun": "Mambajao"},
    {"name": "Prince Hypermart Camiguin", "cat": "supermarket", "keywords": ["prince hypermart", "prince", "hypermart"], "lat": 9.2465, "lng": 124.7010, "mun": "Mambajao"},
    {"name": "7-Eleven Mambajao Town Center", "cat": "store", "keywords": ["7-eleven", "7-11", "711", "seven eleven", "convenience store"], "lat": 9.2487, "lng": 124.6979, "mun": "Mambajao"},
    {"name": "7-Eleven Balbagon Port Branch", "cat": "store", "keywords": ["7-eleven balbagon", "711 balbagon", "7 eleven port"], "lat": 9.2558, "lng": 124.7169, "mun": "Mambajao"},
    {"name": "Mercury Drug Camiguin, Mambajao", "cat": "pharmacy", "keywords": ["mercury drug", "mercury", "pharmacy", "botika", "tambal", "drugstore"], "lat": 9.2525, "lng": 124.7164, "mun": "Mambajao"},
    {"name": "Rose Pharmacy Mambajao", "cat": "pharmacy", "keywords": ["rose pharmacy", "rose", "pharmacy", "botika", "tambal"], "lat": 9.2486, "lng": 124.6977, "mun": "Mambajao"},
    {"name": "Julies Bakeshop Mambajao", "cat": "store", "keywords": ["julies", "julies bakeshop", "bakeshop", "panaderia", "tinapay"], "lat": 9.2484, "lng": 124.6974, "mun": "Mambajao"},
    {"name": "Chooks to Go Mambajao", "cat": "food", "keywords": ["chooks", "chooks to go", "manok", "lechon manok"], "lat": 9.2485, "lng": 124.6982, "mun": "Mambajao"},
    {"name": "Andoks Litson Mambajao", "cat": "food", "keywords": ["andoks", "andok", "litson manok"], "lat": 9.2489, "lng": 124.6985, "mun": "Mambajao"},
    {"name": "Dunkin Donuts Camiguin", "cat": "food", "keywords": ["dunkin", "donuts", "dunkin donuts"], "lat": 9.2483, "lng": 124.6981, "mun": "Mambajao"},

    # --- Public Markets ---
    {"name": "Mambajao Public Market", "cat": "market", "keywords": ["mambajao market", "public market", "merkado", "palengke", "wet market", "isda", "karne", "utanon"], "lat": 9.2483, "lng": 124.6975, "mun": "Mambajao"},
    {"name": "Mahinog Public Market", "cat": "market", "keywords": ["mahinog market", "merkado mahinog", "palengke mahinog"], "lat": 9.1535, "lng": 124.7852, "mun": "Mahinog"},
    {"name": "Catarman Public Market", "cat": "market", "keywords": ["catarman market", "merkado catarman", "palengke catarman"], "lat": 9.1275, "lng": 124.6455, "mun": "Catarman"},
    {"name": "Sagay Public Market", "cat": "market", "keywords": ["sagay market", "merkado sagay", "palengke sagay"], "lat": 9.1025, "lng": 124.7205, "mun": "Sagay"},
    {"name": "Guinsiliban Public Market", "cat": "market", "keywords": ["guinsiliban market", "merkado guinsiliban", "palengke guinsiliban"], "lat": 9.0938, "lng": 124.7778, "mun": "Guinsiliban"},

    # --- Restaurants, Cafes & Food Parks ---
    {"name": "Jollibee Camiguin, Mambajao", "cat": "food", "keywords": ["jollibee", "jolibee", "joli", "jolli", "fastfood", "chickenjoy", "burger"], "lat": 9.2488, "lng": 124.6980, "mun": "Mambajao"},
    {"name": "Checkpoint Food Park, Mambajao", "cat": "food", "keywords": ["checkpoint", "food park", "resto bar", "snack"], "lat": 9.2498, "lng": 124.7005, "mun": "Mambajao"},
    {"name": "Hayahay Cafe & Restaurant", "cat": "food", "keywords": ["hayahay cafe", "hayahay", "kainan"], "lat": 9.2512, "lng": 124.6720, "mun": "Mambajao"},
    {"name": "Casa Roces / Guerrera Restaurant, Yumbing", "cat": "food", "keywords": ["guerrera", "casa roces", "asian food", "pad thai"], "lat": 9.2548, "lng": 124.6475, "mun": "Mambajao"},
    {"name": "Northern Lights Cafe, Agoho", "cat": "food", "keywords": ["northern lights", "northern lights cafe"], "lat": 9.2460, "lng": 124.6610, "mun": "Mambajao"},
    {"name": "La Dolce Vita Italian Pizza, Agoho", "cat": "food", "keywords": ["la dolce vita", "dolce vita", "pizza", "pasta"], "lat": 9.2455, "lng": 124.6615, "mun": "Mambajao"},
    {"name": "Penongs Barbeque Mambajao", "cat": "food", "keywords": ["penongs", "penong", "bbq", "barbeque"], "lat": 9.2492, "lng": 124.6990, "mun": "Mambajao"},

    # --- Government, Hospitals, Schools & Buildings ---
    {"name": "Provincial Capitol Compound, Mambajao", "cat": "building", "keywords": ["capitol", "kapitolyo", "provincial capitol", "governor office"], "lat": 9.2510, "lng": 124.7040, "mun": "Mambajao"},
    {"name": "Mambajao Town Plaza / Municipal Hall", "cat": "building", "keywords": ["mambajao plaza", "plaza", "municipal hall", "munisipyo mambajao", "town hall"], "lat": 9.2485, "lng": 124.6972, "mun": "Mambajao"},
    {"name": "Camiguin General Hospital (CGH)", "cat": "hospital", "keywords": ["hospital", "cgh", "camiguin hospital", "emergency room", "clinic", "doktor"], "lat": 9.2495, "lng": 124.7020, "mun": "Mambajao"},
    {"name": "Mahinog Municipal Hall", "cat": "building", "keywords": ["munisipyo mahinog", "mahinog hall", "mahinog plaza"], "lat": 9.1532, "lng": 124.7850, "mun": "Mahinog"},
    {"name": "Catarman Municipal Hall", "cat": "building", "keywords": ["munisipyo catarman", "catarman hall", "catarman plaza"], "lat": 9.1282, "lng": 124.6448, "mun": "Catarman"},
    {"name": "Sagay Municipal Hall", "cat": "building", "keywords": ["munisipyo sagay", "sagay hall", "sagay plaza"], "lat": 9.1022, "lng": 124.7212, "mun": "Sagay"},
    {"name": "Guinsiliban Municipal Hall", "cat": "building", "keywords": ["munisipyo guinsiliban", "guinsiliban hall"], "lat": 9.0942, "lng": 124.7782, "mun": "Guinsiliban"},
    {"name": "Camiguin Polytechnic State College (CPSC)", "cat": "school", "keywords": ["cpsc", "polytechnic", "college", "eskwelahan", "school"], "lat": 9.2520, "lng": 124.7110, "mun": "Mambajao"},
    {"name": "Fatima College of Camiguin", "cat": "school", "keywords": ["fatima college", "fcc", "fatima"], "lat": 9.2478, "lng": 124.6965, "mun": "Mambajao"},
    {"name": "Camiguin Provincial Police Office", "cat": "building", "keywords": ["police", "pnp", "police station", "pulis"], "lat": 9.2505, "lng": 124.7030, "mun": "Mambajao"},

    # --- Transport & Ports ---
    {"name": "Balbagon Port (FastCat & Ferry Wharf)", "cat": "transport", "keywords": ["balbagon port", "balbagon wharf", "balbagon", "fastcat", "ferry", "pantalan"], "lat": 9.2561, "lng": 124.7175, "mun": "Mambajao"},
    {"name": "Benoni Port / Ferry Wharf, Mahinog", "cat": "transport", "keywords": ["benoni port", "benoni wharf", "benoni", "wharf", "port", "pantalan benoni", "ferry wharf"], "lat": 9.1306, "lng": 124.7937, "mun": "Mahinog"},
    {"name": "Guinsiliban Port / Ferry Terminal", "cat": "transport", "keywords": ["guinsiliban port", "pantalan guinsiliban"], "lat": 9.0925, "lng": 124.7815, "mun": "Guinsiliban"},
    {"name": "Camiguin Airport", "cat": "transport", "keywords": ["airport", "tugpahanan", "camiguin airport", "eroplano"], "lat": 9.2530, "lng": 124.7061, "mun": "Mambajao"},

    # --- Tourist Attractions, Nature, Springs & Falls ---
    {"name": "White Island Boat Jump-off, Yumbing", "cat": "tourist", "keywords": ["white island", "jump-off", "jump off", "boat station", "medano"], "lat": 9.2538, "lng": 124.6532, "mun": "Mambajao"},
    {"name": "Mantigue Island Boat Station, San Roque", "cat": "tourist", "keywords": ["mantigue island", "mantigue", "san roque boat", "magsaysay island"], "lat": 9.1720, "lng": 124.7850, "mun": "Mahinog"},
    {"name": "Katibawasan Falls", "cat": "tourist", "keywords": ["katibawasan falls", "katibawasan", "falls", "busay"], "lat": 9.2152, "lng": 124.7188, "mun": "Mambajao"},
    {"name": "Tuasan Falls, Mainit, Catarman", "cat": "tourist", "keywords": ["tuasan falls", "tuasan", "busay"], "lat": 9.1700, "lng": 124.6750, "mun": "Catarman"},
    {"name": "Ardent Hot Spring, Esperanza", "cat": "tourist", "keywords": ["ardent hot spring", "ardent", "hot spring", "init"], "lat": 9.2380, "lng": 124.6610, "mun": "Mambajao"},
    {"name": "Sto. Niño Cold Spring, Catarman", "cat": "tourist", "keywords": ["cold spring", "sto nino", "sto. nino", "sto niño", "bugnaw"], "lat": 9.1550, "lng": 124.6550, "mun": "Catarman"},
    {"name": "Bura Soda Water Park, Catarman", "cat": "tourist", "keywords": ["soda water", "bura soda", "soda swimming", "bura"], "lat": 9.1820, "lng": 124.6380, "mun": "Catarman"},
    {"name": "Sunken Cemetery & Giant Cross, Bonbon", "cat": "tourist", "keywords": ["sunken cemetery", "sunken", "lubnganan", "krus"], "lat": 9.2010, "lng": 124.6300, "mun": "Catarman"},
    {"name": "Old Church Ruins (Gui-ob Church), Bonbon", "cat": "tourist", "keywords": ["church ruins", "guiob", "gui-ob", "old church", "simbahan"], "lat": 9.2050, "lng": 124.6320, "mun": "Catarman"},
    {"name": "Mount Vulcan Daan / Walkway to Old Volcano", "cat": "tourist", "keywords": ["vulcan daan", "old volcano", "walkway", "via crucis"], "lat": 9.2085, "lng": 124.6350, "mun": "Catarman"},
    {"name": "Mount Hibok-Hibok Base Jump-off", "cat": "tourist", "keywords": ["hibok-hibok", "hibok hibok", "volcano hike"], "lat": 9.2030, "lng": 124.6710, "mun": "Mambajao"},
    {"name": "Giant Clam Sanctuary, Cantaan", "cat": "tourist", "keywords": ["giant clam", "clam sanctuary", "cantaan", "taklobo"], "lat": 9.0810, "lng": 124.7860, "mun": "Guinsiliban"},
    {"name": "Taguines Lagoon & Zipline, Benoni", "cat": "tourist", "keywords": ["taguines lagoon", "taguines", "zipline"], "lat": 9.1290, "lng": 124.7910, "mun": "Mahinog"},
    {"name": "Katunggan Mangrove Park, Mahinog", "cat": "tourist", "keywords": ["katunggan", "mangrove park", "bakawan"], "lat": 9.1350, "lng": 124.7920, "mun": "Mahinog"},

    # --- Resorts & Hotels ---
    {"name": "Paras Beach Resort, Yumbing", "cat": "resort", "keywords": ["paras beach", "paras resort", "paras", "hotel"], "lat": 9.2553, "lng": 124.6468, "mun": "Mambajao"},
    {"name": "Balyali Beach Resort, Yumbing", "cat": "resort", "keywords": ["balyali resort", "balyali", "beach resort"], "lat": 9.2588, "lng": 124.6432, "mun": "Mambajao"},
    {"name": "Tongatok Cliff Resort, Yumbing", "cat": "resort", "keywords": ["tongatok cliff", "tongatok", "cliff resort"], "lat": 9.2505, "lng": 124.6341, "mun": "Mambajao"},
    {"name": "Lanzones Resort, Baylao, Mambajao", "cat": "resort", "keywords": ["lanzones resort", "lanzones", "resort baylao"], "lat": 9.2390, "lng": 124.6970, "mun": "Mambajao"},
    {"name": "Camiguin Highland Resort, Soro-soro", "cat": "resort", "keywords": ["highland resort", "highland", "sorosoro", "soro-soro", "soro'soro"], "lat": 9.2310, "lng": 124.6890, "mun": "Mambajao"},
    {"name": "Somewhere Else Boutique Resort", "cat": "resort", "keywords": ["somewhere else", "boutique resort"], "lat": 9.2458, "lng": 124.6625, "mun": "Mambajao"},
    {"name": "Balerin Beach Resort, Agoho", "cat": "resort", "keywords": ["balerin", "balerin resort"], "lat": 9.2445, "lng": 124.6630, "mun": "Mambajao"},

    # --- All Mambajao Barangays ---
    {"name": "Baylao, Mambajao", "cat": "barangay", "keywords": ["baylao", "bailao", "brgy baylao"], "lat": 9.2415, "lng": 124.6910, "mun": "Mambajao"},
    {"name": "Agoho, Mambajao", "cat": "barangay", "keywords": ["agoho", "brgy agoho"], "lat": 9.2450, "lng": 124.6620, "mun": "Mambajao"},
    {"name": "Yumbing, Mambajao", "cat": "barangay", "keywords": ["yumbing", "brgy yumbing"], "lat": 9.2553, "lng": 124.6468, "mun": "Mambajao"},
    {"name": "Kuguita, Mambajao", "cat": "barangay", "keywords": ["kuguita", "cuguita", "brgy kuguita"], "lat": 9.2490, "lng": 124.6850, "mun": "Mambajao"},
    {"name": "Poblacion, Mambajao", "cat": "barangay", "keywords": ["poblacion mambajao", "poblacion", "centro mambajao"], "lat": 9.2483, "lng": 124.6975, "mun": "Mambajao"},
    {"name": "Balbagon, Mambajao", "cat": "barangay", "keywords": ["balbagon", "brgy balbagon"], "lat": 9.2540, "lng": 124.7140, "mun": "Mambajao"},
    {"name": "Magting, Mambajao", "cat": "barangay", "keywords": ["magting", "brgy magting", "barangay magting", "magting mambajao"], "lat": 9.2189, "lng": 124.7560, "mun": "Mambajao"},
    {"name": "Magting Elementary School, Mambajao", "cat": "school", "keywords": ["magting elementary", "magting school", "es magting"], "lat": 9.2242, "lng": 124.7514, "mun": "Mambajao"},
    {"name": "Anito, Mambajao", "cat": "barangay", "keywords": ["anito", "brgy anito", "barangay anito"], "lat": 9.2296, "lng": 124.7444, "mun": "Mambajao"},
    {"name": "Pandan, Mambajao", "cat": "barangay", "keywords": ["pandan", "brgy pandan"], "lat": 9.2460, "lng": 124.7080, "mun": "Mambajao"},
    {"name": "Bug-ong, Mambajao", "cat": "barangay", "keywords": ["bug-ong", "bugong", "brgy bug-ong"], "lat": 9.2530, "lng": 124.6390, "mun": "Mambajao"},
    {"name": "Naasag, Mambajao", "cat": "barangay", "keywords": ["naasag", "brgy naasag"], "lat": 9.2510, "lng": 124.6280, "mun": "Mambajao"},
    {"name": "Soro-soro, Mambajao", "cat": "barangay", "keywords": ["soro-soro", "sorosoro", "brgy soro-soro"], "lat": 9.2310, "lng": 124.6890, "mun": "Mambajao"},
    {"name": "Tagdo, Mambajao", "cat": "barangay", "keywords": ["tagdo", "brgy tagdo"], "lat": 9.2380, "lng": 124.6820, "mun": "Mambajao"},
    {"name": "Tupsan, Mambajao", "cat": "barangay", "keywords": ["tupsan mambajao", "tupsan", "brgy tupsan"], "lat": 9.2019, "lng": 124.7774, "mun": "Mambajao"},
    {"name": "Benhaan, Mambajao", "cat": "barangay", "keywords": ["benhaan", "brgy benhaan"], "lat": 9.2032, "lng": 124.7677, "mun": "Mambajao"},

    # --- All Mahinog Barangays ---
    {"name": "Poblacion, Mahinog", "cat": "barangay", "keywords": ["mahinog", "poblacion mahinog", "centro mahinog"], "lat": 9.1530, "lng": 124.7850, "mun": "Mahinog"},
    {"name": "Benoni, Mahinog", "cat": "barangay", "keywords": ["benoni", "brgy benoni"], "lat": 9.1306, "lng": 124.7937, "mun": "Mahinog"},
    {"name": "Hubangon, Mahinog", "cat": "barangay", "keywords": ["hubangon", "brgy hubangon"], "lat": 9.1680, "lng": 124.7760, "mun": "Mahinog"},
    {"name": "San Roque, Mahinog", "cat": "barangay", "keywords": ["san roque mahinog", "san roque"], "lat": 9.1720, "lng": 124.7850, "mun": "Mahinog"},
    {"name": "Binunsaran, Mahinog", "cat": "barangay", "keywords": ["binunsaran", "brgy binunsaran"], "lat": 9.1420, "lng": 124.7700, "mun": "Mahinog"},
    {"name": "Binuangan, Mahinog", "cat": "barangay", "keywords": ["binuangan", "brgy binuangan"], "lat": 9.1380, "lng": 124.7890, "mun": "Mahinog"},
    {"name": "Catohugan, Mahinog", "cat": "barangay", "keywords": ["catohugan", "brgy catohugan"], "lat": 9.1620, "lng": 124.7810, "mun": "Mahinog"},
    {"name": "Owakan, Mahinog", "cat": "barangay", "keywords": ["owakan", "brgy owakan"], "lat": 9.1510, "lng": 124.7740, "mun": "Mahinog"},
    {"name": "Puntod, Mahinog", "cat": "barangay", "keywords": ["puntod", "brgy puntod"], "lat": 9.1460, "lng": 124.7810, "mun": "Mahinog"},
    {"name": "San Isidro, Mahinog", "cat": "barangay", "keywords": ["san isidro mahinog"], "lat": 9.1650, "lng": 124.7680, "mun": "Mahinog"},
    {"name": "San Jose, Mahinog", "cat": "barangay", "keywords": ["san jose mahinog"], "lat": 9.1580, "lng": 124.7710, "mun": "Mahinog"},
    {"name": "San Miguel, Mahinog", "cat": "barangay", "keywords": ["san miguel mahinog"], "lat": 9.1700, "lng": 124.7790, "mun": "Mahinog"},
    {"name": "Tubod, Mahinog", "cat": "barangay", "keywords": ["tubod mahinog"], "lat": 9.1600, "lng": 124.7750, "mun": "Mahinog"},
    {"name": "Tupsan Pequeño, Mahinog", "cat": "barangay", "keywords": ["tupsan pequeno", "tupsan mahinog"], "lat": 9.1850, "lng": 124.7500, "mun": "Mahinog"},

    # --- All Catarman Barangays ---
    {"name": "Poblacion, Catarman", "cat": "barangay", "keywords": ["catarman", "poblacion catarman", "centro catarman"], "lat": 9.1280, "lng": 124.6450, "mun": "Catarman"},
    {"name": "Bonbon, Catarman", "cat": "barangay", "keywords": ["bonbon", "brgy bonbon"], "lat": 9.2000, "lng": 124.6320, "mun": "Catarman"},
    {"name": "Bura, Catarman", "cat": "barangay", "keywords": ["bura", "brgy bura"], "lat": 9.1820, "lng": 124.6380, "mun": "Catarman"},
    {"name": "Catibac, Catarman", "cat": "barangay", "keywords": ["catibac", "brgy catibac"], "lat": 9.1650, "lng": 124.6420, "mun": "Catarman"},
    {"name": "Compol, Catarman", "cat": "barangay", "keywords": ["compol", "brgy compol"], "lat": 9.1450, "lng": 124.6430, "mun": "Catarman"},
    {"name": "Panghiawan, Catarman", "cat": "barangay", "keywords": ["panghiawan", "brgy panghiawan"], "lat": 9.1150, "lng": 124.6520, "mun": "Catarman"},
    {"name": "Alga, Catarman", "cat": "barangay", "keywords": ["alga", "brgy alga"], "lat": 9.1180, "lng": 124.6550, "mun": "Catarman"},
    {"name": "Lawigan, Catarman", "cat": "barangay", "keywords": ["lawigan", "brgy lawigan"], "lat": 9.1350, "lng": 124.6410, "mun": "Catarman"},
    {"name": "Liloan, Catarman", "cat": "barangay", "keywords": ["liloan", "brgy liloan"], "lat": 9.1400, "lng": 124.6420, "mun": "Catarman"},
    {"name": "Mandawa, Catarman", "cat": "barangay", "keywords": ["mandawa", "brgy mandawa"], "lat": 9.1500, "lng": 124.6430, "mun": "Catarman"},
    {"name": "Mainit, Catarman", "cat": "barangay", "keywords": ["mainit", "brgy mainit"], "lat": 9.1680, "lng": 124.6650, "mun": "Catarman"},
    {"name": "Santo Niño, Catarman", "cat": "barangay", "keywords": ["santo nino brgy", "santo niño"], "lat": 9.1550, "lng": 124.6550, "mun": "Catarman"},
    {"name": "Tangaro, Catarman", "cat": "barangay", "keywords": ["tangaro", "brgy tangaro"], "lat": 9.1220, "lng": 124.6480, "mun": "Catarman"},

    # --- All Sagay Barangays ---
    {"name": "Poblacion, Sagay", "cat": "barangay", "keywords": ["sagay", "poblacion sagay", "centro sagay"], "lat": 9.1020, "lng": 124.7210, "mun": "Sagay"},
    {"name": "Alangilan, Sagay", "cat": "barangay", "keywords": ["alangilan", "brgy alangilan"], "lat": 9.0950, "lng": 124.7080, "mun": "Sagay"},
    {"name": "Bacnit, Sagay", "cat": "barangay", "keywords": ["bacnit", "brgy bacnit"], "lat": 9.1120, "lng": 124.7350, "mun": "Sagay"},
    {"name": "Balite, Sagay", "cat": "barangay", "keywords": ["balite", "brgy balite"], "lat": 9.0980, "lng": 124.7150, "mun": "Sagay"},
    {"name": "Bugang, Sagay", "cat": "barangay", "keywords": ["bugang", "brgy bugang"], "lat": 9.1080, "lng": 124.7280, "mun": "Sagay"},
    {"name": "Cuna, Sagay", "cat": "barangay", "keywords": ["cuna", "brgy cuna"], "lat": 9.1050, "lng": 124.7190, "mun": "Sagay"},
    {"name": "Manuyog, Sagay", "cat": "barangay", "keywords": ["manuyog", "brgy manuyog"], "lat": 9.0880, "lng": 124.6910, "mun": "Sagay"},
    {"name": "Mayana, Sagay", "cat": "barangay", "keywords": ["mayana", "brgy mayana"], "lat": 9.1150, "lng": 124.7120, "mun": "Sagay"},

    # --- All Guinsiliban Barangays ---
    {"name": "Poblacion, Guinsiliban", "cat": "barangay", "keywords": ["guinsiliban", "poblacion guinsiliban", "centro guinsiliban"], "lat": 9.0940, "lng": 124.7780, "mun": "Guinsiliban"},
    {"name": "Cabuan, Guinsiliban", "cat": "barangay", "keywords": ["cabuan", "brgy cabuan"], "lat": 9.1050, "lng": 124.7820, "mun": "Guinsiliban"},
    {"name": "Cantaan, Guinsiliban", "cat": "barangay", "keywords": ["cantaan", "brgy cantaan"], "lat": 9.0810, "lng": 124.7860, "mun": "Guinsiliban"},
    {"name": "Liong, Guinsiliban", "cat": "barangay", "keywords": ["liong", "brgy liong"], "lat": 9.0910, "lng": 124.7720, "mun": "Guinsiliban"},
    {"name": "Maac, Guinsiliban", "cat": "barangay", "keywords": ["maac", "brgy maac"], "lat": 9.1120, "lng": 124.7850, "mun": "Guinsiliban"},
    {"name": "Butay, Guinsiliban", "cat": "barangay", "keywords": ["butay", "brgy butay"], "lat": 9.0990, "lng": 124.7750, "mun": "Guinsiliban"},
    {"name": "North Poblacion, Guinsiliban", "cat": "barangay", "keywords": ["north poblacion guinsiliban"], "lat": 9.0960, "lng": 124.7790, "mun": "Guinsiliban"},
    {"name": "South Poblacion, Guinsiliban", "cat": "barangay", "keywords": ["south poblacion guinsiliban"], "lat": 9.0920, "lng": 124.7770, "mun": "Guinsiliban"},

    # --- Major Streets & Roads ---
    {"name": "Camiguin Circumferential Road, Mambajao", "cat": "street", "keywords": ["circumferential road", "national highway", "highway"], "lat": 9.2480, "lng": 124.6980, "mun": "Mambajao"},
    {"name": "Rizal Street, Mambajao", "cat": "street", "keywords": ["rizal street", "rizal st", "rizal"], "lat": 9.2485, "lng": 124.6970, "mun": "Mambajao"},
    {"name": "Aranas Street, Mambajao", "cat": "street", "keywords": ["aranas street", "aranas st", "aranas"], "lat": 9.2488, "lng": 124.6975, "mun": "Mambajao"},
    {"name": "Burgos Street, Mambajao", "cat": "street", "keywords": ["burgos street", "burgos st", "burgos"], "lat": 9.2482, "lng": 124.6968, "mun": "Mambajao"},
    {"name": "Airport Road, Mambajao", "cat": "street", "keywords": ["airport road", "airport st"], "lat": 9.2520, "lng": 124.7060, "mun": "Mambajao"},
    {"name": "Balbagon Boulevard / Seaside Promenade", "cat": "street", "keywords": ["boulevard", "seaside", "baywalk"], "lat": 9.2550, "lng": 124.7150, "mun": "Mambajao"},
    {"name": "Itum Road / Mountain Route", "cat": "street", "keywords": ["itum road", "itum", "hinterland"], "lat": 9.2250, "lng": 124.6850, "mun": "Mambajao"},
    {"name": "Granelandia Road, Binunsaran", "cat": "street", "keywords": ["granelandia", "granelandia road"], "lat": 9.1450, "lng": 124.7680, "mun": "Mahinog"},
    {"name": "Utopia Road, Soro-soro", "cat": "street", "keywords": ["utopia", "utopia road"], "lat": 9.2290, "lng": 124.6860, "mun": "Mambajao"},
]


def search_camiguin_places(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Comprehensive island search: barangays, stores, supermarkets, pharmacies, streets,
    buildings, resorts, ports, schools, hospitals, tourist spots.
    Combines pre-indexed local directory with live OpenStreetMap Nominatim for 100% coverage.
    """
    if not query:
        return []
    q = query.strip().lower()
    results: list[dict[str, Any]] = []
    seen_names: set[str] = set()

    # 1. Exact or keyword match
    for p in CAMIGUIN_KNOWN_PLACES:
        name_lower = p["name"].lower()
        if q == name_lower or any(q == kw for kw in p.get("keywords", [])):
            if p["name"] not in seen_names:
                results.append(p)
                seen_names.add(p["name"])

    # 2. Starts with query
    for p in CAMIGUIN_KNOWN_PLACES:
        name_lower = p["name"].lower()
        if name_lower.startswith(q) or any(kw.startswith(q) for kw in p.get("keywords", [])):
            if p["name"] not in seen_names:
                results.append(p)
                seen_names.add(p["name"])

    # 3. Substring match
    for p in CAMIGUIN_KNOWN_PLACES:
        name_lower = p["name"].lower()
        if q in name_lower or any(q in kw or kw in q for kw in p.get("keywords", [])):
            if p["name"] not in seen_names:
                results.append(p)
                seen_names.add(p["name"])

    # 4. If fewer than limit and query >= 2 chars, query OpenStreetMap Nominatim bounded to Camiguin
    if len(results) < limit and len(q) >= 2:
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
                headers={"User-Agent": "CamiguinCentricRidersClub/1.0 (Island Courier & Ride Logistics)"},
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


def calculate_road_km(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> tuple[float, list[list[float]] | None]:
    """
    Calculate actual driving road distance along Camiguin's road network using OSRM routing.
    Measures the real road distance ("ang kalsada mismo kung asa ni agi") rather than straight line.
    Falls back gracefully to realistic island winding road factor if offline or unreachable.
    Returns (road_km, route_coordinates).
    """
    cache_key = (round(lat1, 4), round(lng1, 4), round(lat2, 4), round(lng2, 4))
    if cache_key in _ROAD_ROUTE_CACHE:
        return _ROAD_ROUTE_CACHE[cache_key]

    url = f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "CamiguinCentricRidersClub/1.0 (Island Courier & Ride Logistics)"
            },
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") == "Ok" and data.get("routes"):
                meters = data["routes"][0]["distance"]
                road_km = round(meters / 1000.0, 2)
                coords = data["routes"][0].get("geometry", {}).get("coordinates", [])
                result = (road_km, coords)
                _ROAD_ROUTE_CACHE[cache_key] = result
                return result
    except Exception:
        pass

    straight_km = calculate_haversine_km(lat1, lng1, lat2, lng2)
    # Camiguin island roads typically add ~25-35% due to coastline curvature and terrain
    road_km = round(max(straight_km * 1.30, straight_km + 0.35), 2)
    result = (road_km, None)
    _ROAD_ROUTE_CACHE[cache_key] = result
    return result


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
    - Hinterland / Mountain route (Soro-soro, Highland, Utopia, Binunsaran, Granelandia, Itum Road, etc.): +₱30.00
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
    try:
        conn.execute("ALTER TABLE riders ADD COLUMN license_no TEXT DEFAULT ''")
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS booking_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_booking ON booking_messages(booking_id, id)")
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
            license_no VARCHAR(64) DEFAULT '',
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS booking_messages (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_role VARCHAR(32) NOT NULL,
            sender_name VARCHAR(120) NOT NULL,
            message TEXT NOT NULL,
            created_at VARCHAR(32) NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_booking ON booking_messages(booking_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracking_booking ON tracking_logs(booking_id)")


def _seed_initial_data(conn: DatabaseConnection) -> None:
    now = datetime.now().isoformat(timespec="seconds")

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
    license_no: str = "",
    avatar_url: str = "",
) -> int:
    clean_phone = phone.strip().replace(" ", "").replace("-", "")
    pwd_hash = generate_password_hash(password)
    now = datetime.now().isoformat(timespec="seconds")
    return conn.insert_returning_id(
        """
        INSERT INTO riders (
            name, phone, password_hash, bike_model, plate_number,
            municipality, license_no, avatar_url, status, is_online, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
        """,
        (name.strip(), clean_phone, pwd_hash, bike_model.strip(), plate_number.strip().upper(), municipality, license_no.strip().upper(), avatar_url.strip(), now),
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
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
               r.avatar_url AS rider_avatar, r.license_no AS rider_license
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
               r.last_lng AS rider_lng, r.rating_avg AS rider_rating,
               r.avatar_url AS rider_avatar, r.license_no AS rider_license
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


# -----------------------------------------------------------------------------
# In-App Chat Functions (Rider & Customer Communication)
# -----------------------------------------------------------------------------
def add_booking_message(
    conn: DatabaseConnection,
    booking_id: int,
    sender_role: str,
    sender_name: str,
    message: str,
) -> dict[str, Any]:
    now = datetime.now().isoformat(timespec="seconds")
    cur = conn.execute(
        """
        INSERT INTO booking_messages (booking_id, sender_role, sender_name, message, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (booking_id, sender_role, sender_name, message, now),
    )
    msg_id = cur.lastrowid
    return {
        "id": msg_id,
        "booking_id": booking_id,
        "sender_role": sender_role,
        "sender_name": sender_name,
        "message": message,
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
        SELECT id, booking_id, sender_role, sender_name, message, created_at
        FROM booking_messages
        WHERE booking_id = ? AND id > ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (booking_id, after_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]
