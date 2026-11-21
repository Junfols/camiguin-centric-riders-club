(function () {
  "use strict";

  // If a rider is logged in, redirect them directly to Rider Hub (hide Book a Ride)
  try {
    const savedRider = localStorage.getItem("ccrc_rider_session");
    if (savedRider && (window.location.pathname === "/" || window.location.pathname === "/customer" || window.location.pathname === "/bookings")) {
      window.location.replace("/rider");
      return;
    }
  } catch (_) {}

  // Elements
  const serviceTabs = document.querySelectorAll(".service-tab-btn");
  const serviceTypeInput = document.getElementById("service-type-input");
  const pickupInput = document.getElementById("pickup-address");
  const pickupLatInput = document.getElementById("pickup-lat");
  const pickupLngInput = document.getElementById("pickup-lng");
  const dropoffInput = document.getElementById("dropoff-address");
  const dropoffLatInput = document.getElementById("dropoff-lat");
  const dropoffLngInput = document.getElementById("dropoff-lng");
  const clearPickupBtn = document.getElementById("clear-pickup-btn");
  const clearDropoffBtn = document.getElementById("clear-dropoff-btn");

  function updateClearBtn(inputEl, btnEl) {
    if (!btnEl) return;
    if (inputEl && inputEl.value && inputEl.value.trim().length > 0) {
      btnEl.classList.remove("hidden");
    } else {
      btnEl.classList.add("hidden");
    }
  }
  const budgetGroup = document.getElementById("budget-group");
  const notesLabel = document.getElementById("notes-label");
  const fareDisplay = document.getElementById("fare-display");
  const fareKmDisplay = document.getElementById("fare-km-display");
  const fareBreakdownBadges = document.getElementById("fare-breakdown-badges");
  const fareHintText = document.getElementById("fare-hint-text");
  const bookingForm = document.getElementById("booking-request-form");
  const submitBtn = document.getElementById("submit-booking-btn");
  const errorMsg = document.getElementById("form-error-msg");
  const landmarkChips = document.getElementById("quick-landmark-chips");
  const locatePickupGpsBtn = document.getElementById("locate-pickup-gps-btn");
  const pinPickupMapBtn = document.getElementById("pin-pickup-map-btn");
  const locateDropoffGpsBtn = document.getElementById("locate-dropoff-gps-btn");
  const pickupSuggestions = document.getElementById("pickup-suggestions");
  const dropoffSuggestions = document.getElementById("dropoff-suggestions");
  const mapToastPill = document.getElementById("map-toast-pill");
  const targetModeButtons = document.querySelectorAll("[data-target-mode]");
  const successModal = document.getElementById("broadcast-success-modal");
  const modalBookingCode = document.getElementById("modal-booking-code");
  const modalTrackLink = document.getElementById("modal-track-link");

  // Options & Matrix Modal
  const optLargeStore = document.getElementById("opt-large-store");
  const optExtraStores = document.getElementById("opt-extra-stores");
  const optHinterland = document.getElementById("opt-hinterland");
  const estimatedBudgetInput = document.getElementById("estimated-budget");
  const itemNotesField = document.getElementById("item-notes");
  const openMatrixBtn = document.getElementById("open-matrix-btn");
  const closeMatrixBtn = document.getElementById("close-matrix-btn");
  const fareMatrixModal = document.getElementById("fare-matrix-modal");

  // HTML Entity Escaper for Safe Popups & Badges
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Camiguin Master Places Directory (Synced with db.py Verified OSM Coordinates)
  let CAMIGUIN_PLACES = [
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
];

  function normalizePlaceTokens(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[,()\-/&.]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function searchCamiguinPlacesLocal(str, limit = 10) {
    if (!str) return [];
    const s = str.trim().toLowerCase();
    if (!s) return [];
    const qWords = normalizePlaceTokens(s);
    const scored = [];

    for (let idx = 0; idx < CAMIGUIN_PLACES.length; idx++) {
      const p = CAMIGUIN_PLACES[idx];
      const nameLower = p.name.toLowerCase();
      const kws = (p.keywords || []).map((k) => k.toLowerCase());
      const munLower = (p.mun || "").toLowerCase();
      const catLower = (p.cat || "").toLowerCase();
      let score = 0;

      if (s === nameLower) {
        score = 1000;
      } else if (kws.some((k) => s === k)) {
        score = 900;
      } else if (nameLower.startsWith(s)) {
        score = 750;
      } else if (kws.some((k) => k.startsWith(s))) {
        score = 650;
      } else if (qWords.length > 0) {
        const nameWords = new Set(normalizePlaceTokens(nameLower));
        const munWords = new Set(normalizePlaceTokens(munLower));
        const kwWords = new Set();
        kws.forEach((k) => normalizePlaceTokens(k).forEach((w) => kwWords.add(w)));
        const nameAndKw = new Set([...nameWords, ...kwWords]);
        const allWords = new Set([...nameAndKw, ...munWords]);

        if (qWords.every((qw) => [...allWords].some((nw) => nw === qw || nw.startsWith(qw)))) {
          if (qWords.every((qw) => [...nameAndKw].some((nw) => nw === qw || nw.startsWith(qw)))) {
            score = 520;
          } else {
            score = 480;
          }
        } else if (s.length >= 3 && (nameLower.includes(s) || kws.some((k) => k.includes(s)))) {
          score = 300;
        }
      } else if (s.length >= 3 && (nameLower.includes(s) || kws.some((k) => k.includes(s)))) {
        score = 300;
      }

      if (score > 0) {
        if (catLower === "barangay" || catLower === "neighborhood") score += 40;
        else if (catLower === "transport" || catLower === "tourist" || catLower === "building" || catLower === "hospital") score += 15;
        scored.push({ place: p, score, idx });
      }
    }

    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
    return scored.slice(0, limit).map((item) => item.place);
  }

  function matchCamiguinPlace(str) {
    const matches = searchCamiguinPlacesLocal(str, 1);
    return matches.length > 0 ? matches[0] : null;
  }

  function getNearestCamiguinPlace(lat, lng) {
    let nearestLandmark = null;
    let minLandmarkDist = Infinity;
    let nearestBrgy = null;
    let minBrgyDist = Infinity;

    for (const p of CAMIGUIN_PLACES) {
      const d = Math.hypot(lat - p.lat, lng - p.lng);
      const isBrgy = p.cat === "barangay";
      if (!isBrgy) {
        if (d < minLandmarkDist) {
          minLandmarkDist = d;
          nearestLandmark = p;
        }
      } else {
        if (d < minBrgyDist) {
          minBrgyDist = d;
          nearestBrgy = p;
        }
      }
    }

    // 1. If within ~250m (0.0025 deg) of a specific landmark/store (like Jollibee, Market, etc.), prioritize landmark!
    if (nearestLandmark && minLandmarkDist < 0.0025) {
      return nearestLandmark.name;
    }

    // 2. If in Poblacion Mambajao core (9.2435-9.2565, 124.7120-124.7240), prioritize town center / landmarks
    if (lat >= 9.2435 && lat <= 9.2565 && lng >= 124.7120 && lng <= 124.7240 && nearestLandmark && minLandmarkDist < 0.005) {
      return nearestLandmark.name;
    }

    // 3. Otherwise barangay within ~700m (0.007 deg)
    if (nearestBrgy && minBrgyDist < 0.007) {
      return nearestBrgy.name;
    }

    if (nearestLandmark && minLandmarkDist < 0.007) {
      return nearestLandmark.name;
    }

    return null;
  }

  let map;
  let pickupMarker = null;
  let dropoffMarker = null;
  let routeLine = null;
  let routeBgLine = null;

  // Safe Leaflet [lat, lng] coordinate normalizer (ensures first number is always latitude ~9.x)
  function normalizeRouteCoords(coords) {
    if (!Array.isArray(coords)) return [];
    return coords
      .map((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        const n1 = parseFloat(pt[0]);
        const n2 = parseFloat(pt[1]);
        if (isNaN(n1) || isNaN(n2)) return null;
        // If first is ~124 and second is ~9, flip them to [lat, lng]
        if (n1 > 50 && n2 < 50) {
          return [n2, n1];
        }
        return [n1, n2];
      })
      .filter(Boolean);
  }
  let currentTargetMode = "pickup"; // 'pickup' or 'dropoff'

  // Service Type Switcher
  const serviceExtraFields = document.getElementById("service-extra-fields");
  const fareOptionsAccordion = document.getElementById("fare-options-accordion") || document.querySelector(".fare-options-accordion");

  serviceTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      serviceTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const service = tab.getAttribute("data-service");
      serviceTypeInput.value = service;

      if (service === "pahatud") {
        // Passenger ride: strictly HIDE package/errand details and special route options & stops
        if (serviceExtraFields) serviceExtraFields.classList.add("hidden");
        if (fareOptionsAccordion) {
          fareOptionsAccordion.classList.add("hidden");
          fareOptionsAccordion.open = false;
        }
        if (fareHintText) fareHintText.textContent = "Official Tariff: 1-2 km = ₱40 base, ₱18 per succeeding km.";
      } else if (service === "pabili") {
        if (serviceExtraFields) serviceExtraFields.classList.remove("hidden");
        if (fareOptionsAccordion) fareOptionsAccordion.classList.remove("hidden");
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Shopping List & Store Names *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Buy For Me fee.";
      } else if (service === "pasugo") {
        if (serviceExtraFields) serviceExtraFields.classList.remove("hidden");
        if (fareOptionsAccordion) fareOptionsAccordion.classList.remove("hidden");
        if (budgetGroup) budgetGroup.classList.add("hidden");
        if (notesLabel) notesLabel.textContent = "Parcel Description / Cargo Details *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Courier delivery fee.";
      } else if (service === "pabayad") {
        if (serviceExtraFields) serviceExtraFields.classList.remove("hidden");
        if (fareOptionsAccordion) fareOptionsAccordion.classList.remove("hidden");
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Payment Details / Port Cargo Claim Number *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Port claim fee.";
      } else {
        if (serviceExtraFields) serviceExtraFields.classList.add("hidden");
        if (fareOptionsAccordion) fareOptionsAccordion.classList.add("hidden");
        if (fareHintText) fareHintText.textContent = "Official Tariff: 1-2 km = ₱40 base, ₱18 per succeeding km.";
      }
      recalculateFare();
    });
  });

  // Re-calculate when options change
  [optLargeStore, optExtraStores, estimatedBudgetInput].forEach((el) => {
    if (el) {
      el.addEventListener("change", () => recalculateFare());
      el.addEventListener("input", () => recalculateFare());
    }
  });
  if (optHinterland) {
    optHinterland.addEventListener("change", () => {
      optHinterland.dataset.manual = optHinterland.checked ? "1" : "";
      optHinterland.dataset.autoApplied = "";
      recalculateFare();
    });
  }
  if (itemNotesField) {
    itemNotesField.addEventListener("change", () => recalculateFare());
  }

  // Resolve coordinates on explicit commit (Enter / blur after typing) WITHOUT overwriting user text
  function handleTypedAddress(isPickup, shouldFlyMap) {
    const input = isPickup ? pickupInput : dropoffInput;
    const latInput = isPickup ? pickupLatInput : dropoffLatInput;
    const lngInput = isPickup ? pickupLngInput : dropoffLngInput;
    const text = input ? input.value.trim() : "";

    if (!text) {
      if (latInput) latInput.value = "";
      if (lngInput) lngInput.value = "";
      recalculateFare();
      return;
    }

    // If coordinates were already set via dropdown click/map pin/chip, just recalculate
    if (latInput && lngInput && latInput.value && lngInput.value) {
      recalculateFare();
      return;
    }

    if (text.length >= 3) {
      const found = matchCamiguinPlace(text);
      if (found) {
        if (isPickup) {
          pickupLatInput.value = found.lat;
          pickupLngInput.value = found.lng;
          // Pass null as label so the user's typed text is NEVER auto-replaced
          setPickupPoint(found.lat, found.lng, null);
          if (pickupMarker) {
            pickupMarker.bindPopup(`<strong>🟢 Pickup:</strong><br>${escapeHtml(text)}`);
            if (shouldFlyMap) pickupMarker.openPopup();
          }
          if (shouldFlyMap && map) {
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
            showMapToast(`🟢 Pickup pinned near: ${found.name}`);
          }
        } else {
          dropoffLatInput.value = found.lat;
          dropoffLngInput.value = found.lng;
          // Pass null as label so the user's typed text is NEVER auto-replaced
          setDropoffPoint(found.lat, found.lng, null);
          if (dropoffMarker) {
            dropoffMarker.bindPopup(`<strong>🏁 Drop-off:</strong><br>${escapeHtml(text)}`);
            if (shouldFlyMap) dropoffMarker.openPopup();
          }
          if (shouldFlyMap && map) {
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
            showMapToast(`🏁 Drop-off pinned near: ${found.name}`);
          }
        }
        updateRouteLine();
        return;
      }
    }

    recalculateFare();
  }

  if (pickupInput) {
    pickupInput.addEventListener("input", () => {
      updateClearBtn(pickupInput, clearPickupBtn);
      // Clear stale coordinates whenever user edits the address text, without auto-inserting
      if (pickupLatInput) pickupLatInput.value = "";
      if (pickupLngInput) pickupLngInput.value = "";
    });
    pickupInput.addEventListener("change", () => {
      updateClearBtn(pickupInput, clearPickupBtn);
      const recentPick = Date.now() - Number(pickupInput.dataset.lastSelectedAt || 0) < 600;
      if (!recentPick) {
        handleTypedAddress(true, false);
      }
    });
    pickupInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (pickupSuggestions) pickupSuggestions.classList.add("hidden");
        handleTypedAddress(true, true);
      }
    });
  }

  if (dropoffInput) {
    dropoffInput.addEventListener("input", () => {
      updateClearBtn(dropoffInput, clearDropoffBtn);
      // Clear stale coordinates & active chip whenever user edits the address text, without auto-inserting
      if (dropoffLatInput) dropoffLatInput.value = "";
      if (dropoffLngInput) dropoffLngInput.value = "";
      document.querySelectorAll(".chip-pill").forEach((p) => p.classList.remove("active"));
    });
    dropoffInput.addEventListener("change", () => {
      updateClearBtn(dropoffInput, clearDropoffBtn);
      const recentPick = Date.now() - Number(dropoffInput.dataset.lastSelectedAt || 0) < 600;
      if (!recentPick) {
        handleTypedAddress(false, false);
      }
    });
    dropoffInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (dropoffSuggestions) dropoffSuggestions.classList.add("hidden");
        handleTypedAddress(false, true);
      }
    });
  }
  // Clear 'X' Button Handlers for Pickup and Drop-off
  if (clearPickupBtn) {
    clearPickupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pickupInput) pickupInput.value = "";
      if (pickupLatInput) pickupLatInput.value = "";
      if (pickupLngInput) pickupLngInput.value = "";
      if (pickupSuggestions) {
        pickupSuggestions.innerHTML = "";
        pickupSuggestions.classList.add("hidden");
      }
      if (pickupMarker && map) {
        map.removeLayer(pickupMarker);
        pickupMarker = null;
      }
      if (routeBgLine && map) {
        map.removeLayer(routeBgLine);
        routeBgLine = null;
      }
      if (routeLine && map) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      currentRoadKm = null;
      updateClearBtn(pickupInput, clearPickupBtn);
      if (pickupInput) pickupInput.focus();
      updateRouteLine();
      recalculateFare();
      showMapToast("Pickup cleared.");
    });
  }

  if (clearDropoffBtn) {
    clearDropoffBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropoffInput) dropoffInput.value = "";
      if (dropoffLatInput) dropoffLatInput.value = "";
      if (dropoffLngInput) dropoffLngInput.value = "";
      if (dropoffSuggestions) {
        dropoffSuggestions.innerHTML = "";
        dropoffSuggestions.classList.add("hidden");
      }
      document.querySelectorAll(".chip-pill").forEach((p) => p.classList.remove("active"));
      if (dropoffMarker && map) {
        map.removeLayer(dropoffMarker);
        dropoffMarker = null;
      }
      if (routeBgLine && map) {
        map.removeLayer(routeBgLine);
        routeBgLine = null;
      }
      if (routeLine && map) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      currentRoadKm = null;
      updateClearBtn(dropoffInput, clearDropoffBtn);
      if (dropoffInput) dropoffInput.focus();
      updateRouteLine();
      recalculateFare();
      showMapToast("Drop-off cleared.");
    });
  }


  // Matrix Modal Controls
  if (openMatrixBtn && fareMatrixModal) {
    openMatrixBtn.addEventListener("click", () => {
      fareMatrixModal.classList.remove("hidden");
    });
  }
  if (closeMatrixBtn && fareMatrixModal) {
    closeMatrixBtn.addEventListener("click", () => {
      fareMatrixModal.classList.add("hidden");
    });
  }
  if (fareMatrixModal) {
    fareMatrixModal.addEventListener("click", (e) => {
      if (e.target === fareMatrixModal) fareMatrixModal.classList.add("hidden");
    });
  }

  // Pin on Map Handlers ("Dili ibutang sa dagat kung blangko, magpa-tap sa user sa mapa")
  if (locateDropoffGpsBtn) {
    const handleLocateDropoffClick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 1. Switch mode to dropoff
      targetModeButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff")
      );
      currentTargetMode = "dropoff";

      const currentVal = dropoffInput ? dropoffInput.value.trim() : "";
      const found = currentVal ? matchCamiguinPlace(currentVal) : null;

      const mapContainer = document.getElementById("map-canvas-container") || document.getElementById("booking-map");
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Case A: If existing valid pinned/selected coordinates exist, center directly on them
      if (dropoffLatInput && dropoffLngInput && dropoffLatInput.value && dropoffLngInput.value && parseFloat(dropoffLatInput.value) !== 0) {
        const tLat = parseFloat(dropoffLatInput.value);
        const tLng = parseFloat(dropoffLngInput.value);
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([tLat, tLng], 16, { duration: 0.8 });
            if (dropoffMarker) dropoffMarker.openPopup();
          }, 60);
        }
        showMapToast("🏁 Current Drop-off Pin on map");
        return;
      }

      // Case B: If user typed a place name without picking from dropdown, center near match without overwriting text
      if (found) {
        setDropoffPoint(found.lat, found.lng, null);
        if (dropoffMarker) {
          dropoffMarker.setLatLng([found.lat, found.lng]);
          dropoffMarker.bindPopup(`<strong>🏁 Drop-off Destination:</strong><br>${escapeHtml(currentVal || found.name)}`).openPopup();
        }
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }, 60);
        }
        showMapToast(`🏁 Drop-off pinned at: ${found.name}`);
        updateRouteLine();
        recalculateFare();
        return;
      }

      // Case C: Box is BLANK - DO NOT DROP A PIN IN THE SEA!
      // Center map on Poblacion Mambajao and instruct user to tap the map!
      if (map) {
        setTimeout(() => {
          map.invalidateSize();
          map.setView([9.24971, 124.71667], 14);
        }, 60);
      }
      showMapToast("👇 Please tap or click the map to choose your Drop-off!");
    };

    locateDropoffGpsBtn.addEventListener("click", handleLocateDropoffClick);
    locateDropoffGpsBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  if (pinPickupMapBtn) {
    const handlePinPickupClick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 1. Switch mode to pickup
      targetModeButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-target-mode") === "pickup")
      );
      currentTargetMode = "pickup";

      const currentVal = pickupInput ? pickupInput.value.trim() : "";
      const found = currentVal ? matchCamiguinPlace(currentVal) : null;

      const mapContainer = document.getElementById("map-canvas-container") || document.getElementById("booking-map");
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Case A: If existing valid pinned/selected coordinates exist, center directly on them
      if (pickupLatInput && pickupLngInput && pickupLatInput.value && pickupLngInput.value && parseFloat(pickupLatInput.value) !== 0) {
        const tLat = parseFloat(pickupLatInput.value);
        const tLng = parseFloat(pickupLngInput.value);
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([tLat, tLng], 16, { duration: 0.8 });
            if (pickupMarker) pickupMarker.openPopup();
          }, 60);
        }
        showMapToast("🟢 Current Pickup Pin on map");
        return;
      }

      // Case B: If user typed a place name without picking from dropdown, center near match without overwriting text
      if (found) {
        setPickupPoint(found.lat, found.lng, null);
        if (pickupMarker) {
          pickupMarker.setLatLng([found.lat, found.lng]);
          pickupMarker.bindPopup(`<strong>🟢 Pickup Meeting Point:</strong><br>${escapeHtml(currentVal || found.name)}`).openPopup();
        }
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }, 60);
        }
        showMapToast(`🟢 Pickup pinned at: ${found.name}`);
        updateRouteLine();
        recalculateFare();
        return;
      }

      // Case C: Box is BLANK - DO NOT DROP A PIN IN THE SEA!
      if (map) {
        setTimeout(() => {
          map.invalidateSize();
          map.setView([9.24971, 124.71667], 14);
        }, 60);
      }
      showMapToast("👇 Please tap or click the map to choose your Pickup!");
    };

    pinPickupMapBtn.addEventListener("click", handlePinPickupClick);
    pinPickupMapBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  // Autocomplete Dropdown Search & Explicit-Click Pinning
  function setupPlacesAutocomplete(inputEl, dropdownEl, isPickup) {
    if (!inputEl || !dropdownEl) return;
    let debounceTimer = null;
    let blurHideTimer = null;
    let isTouchingDropdown = false;
    let touchMovedInDropdown = false;
    let touchStartX = 0;
    let touchStartY = 0;

    dropdownEl.addEventListener("mousedown", (e) => {
      // Keep focus in input on desktop mouse click so blur/change don't race before click
      e.preventDefault();
    });

    dropdownEl.addEventListener("touchstart", (e) => {
      isTouchingDropdown = true;
      touchMovedInDropdown = false;
      const t = e.touches && e.touches[0];
      if (t) {
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      }
      clearTimeout(blurHideTimer);
    }, { passive: true });

    dropdownEl.addEventListener("touchmove", (e) => {
      const t = e.touches && e.touches[0];
      if (t && (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10)) {
        touchMovedInDropdown = true;
      }
    }, { passive: true });

    dropdownEl.addEventListener("touchend", () => {
      setTimeout(() => {
        isTouchingDropdown = false;
      }, 350);
    }, { passive: true });

    document.addEventListener("click", (e) => {
      if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
        dropdownEl.classList.add("hidden");
      }
    });

    async function searchAndRender() {
      const q = inputEl.value.trim();
      if (q.length < 1) {
        dropdownEl.classList.add("hidden");
        dropdownEl.innerHTML = "";
        return;
      }

      const localMatches = searchCamiguinPlacesLocal(q, 8);

      renderResults(localMatches);

      if (q.length >= 2) {
        try {
          const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            const justSelected = Date.now() - Number(inputEl.dataset.lastSelectedAt || 0) < 600;
            if (data && data.places && data.places.length > 0 && inputEl.value.trim() === q && !justSelected) {
              const seen = new Set(localMatches.map((m) => m.name.toLowerCase()));
              for (const item of data.places) {
                if (!seen.has(item.name.toLowerCase())) {
                  localMatches.push(item);
                  seen.add(item.name.toLowerCase());
                }
              }
              renderResults(localMatches);
            }
          }
        } catch (_) {}
      }
    }

    function renderResults(items) {
      if (!items || items.length === 0) {
        dropdownEl.classList.add("hidden");
        dropdownEl.innerHTML = "";
        return;
      }

      const catIcons = {
        store: "🏪",
        supermarket: "🛒",
        pharmacy: "💊",
        food: "🍽️",
        market: "🏬",
        barangay: "🏘️",
        neighborhood: "🏘️",
        resort: "🏖️",
        tourist: "🏝️",
        building: "🏛️",
        hospital: "🏥",
        school: "🏫",
        church: "⛪",
        fuel: "⛽",
        transport: "⛴️",
        street: "🛣️",
        landmark: "📍"
      };

      dropdownEl.innerHTML = items
        .slice(0, 10)
        .map((item, idx) => {
          const icon = catIcons[item.cat || item.category] || "📍";
          const catLabel = item.cat || item.category || "Place";
          const munLabel = item.mun ? `(${item.mun})` : "";
          const subtitle = item.full_address || munLabel || "Camiguin Island";
          return `
            <div class="places-item" data-idx="${idx}">
              <div class="places-item-info">
                <div class="places-item-name">${icon} ${escapeHtml(item.name)}</div>
                <div class="places-item-sub">${escapeHtml(subtitle)}</div>
              </div>
              <span class="places-cat-badge">${escapeHtml(catLabel)}</span>
            </div>
          `;
        })
        .join("");

      dropdownEl.classList.remove("hidden");

      dropdownEl.querySelectorAll(".places-item").forEach((el, idx) => {
        el.addEventListener("click", (e) => {
          if (touchMovedInDropdown) {
            touchMovedInDropdown = false;
            return;
          }
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const item = items[idx];
          if (!item) return;

          inputEl.dataset.lastSelectedAt = String(Date.now());
          inputEl.value = item.name;
          dropdownEl.classList.add("hidden");

          // Pin exact selected place on map ONLY after explicit click
          if (isPickup) {
            pickupLatInput.value = item.lat;
            pickupLngInput.value = item.lng;
            setPickupPoint(item.lat, item.lng, item.name);
            if (pickupMarker) {
              pickupMarker.bindPopup(`<strong>🟢 Pickup:</strong><br>${escapeHtml(item.name)}`).openPopup();
            }
          } else {
            dropoffLatInput.value = item.lat;
            dropoffLngInput.value = item.lng;
            setDropoffPoint(item.lat, item.lng, item.name);
            if (dropoffMarker) {
              dropoffMarker.bindPopup(`<strong>🏁 Drop-off:</strong><br>${escapeHtml(item.name)}`).openPopup();
            }
          }

          if (map) {
            map.flyTo([item.lat, item.lng], 16, { duration: 0.8 });
          }

          showMapToast(`${isPickup ? "🟢 Pickup" : "🏁 Drop-off"} pinned at: ${item.name}`);
          updateRouteLine();
          recalculateFare();
        });
      });
    }

    inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(searchAndRender, 150);
    });

    inputEl.addEventListener("focus", () => {
      if (inputEl.value.trim().length >= 1) searchAndRender();
    });

    inputEl.addEventListener("blur", () => {
      clearTimeout(blurHideTimer);
      blurHideTimer = setTimeout(() => {
        if (!isTouchingDropdown) {
          dropdownEl.classList.add("hidden");
        }
      }, 320);
    });
  }

  setupPlacesAutocomplete(pickupInput, pickupSuggestions, true);
  setupPlacesAutocomplete(dropoffInput, dropoffSuggestions, false);

  // Target Mode Toggles (Pickup vs Dropoff)
  targetModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      targetModeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTargetMode = btn.getAttribute("data-target-mode");
    });
  });

  // Map Layer Objects & Enhanced Controls
  let streetLayer = null;
  let satGroup = null;
  let currentTileLayer = "street";
  let userGpsMarker = null;

  // Map Initialization (Camiguin Center with Dual Street/Satellite Support)
  function initMap() {
    const mapEl = document.getElementById("booking-map");
    if (!mapEl || typeof L === "undefined") return;

    const CAMIGUIN_BOUNDS = [
      [9.0500, 124.5800], // Habagatan (Guinsiliban South)
      [9.2900, 124.8300]  // Amihanan (White Island / Mantigue / Mambajao)
    ];

    map = L.map(mapEl, {
      zoomControl: true,
      minZoom: 11,               // Dili na maka-zoom out lampas sa Isla sa Camiguin
      maxZoom: 19,               // Pwede maka-zoom in sa kalsada, eskinita, ug tindahan
      maxBounds: CAMIGUIN_BOUNDS, // Bounded strictly sulod sa Camiguin
      maxBoundsViscosity: 1.0,   // Solid lock: Dili ma-drag o ma-pan gawas sa Camiguin
      bounceAtZoomLimits: true
    }).fitBounds(CAMIGUIN_BOUNDS);

    // 1. Street Layer (OpenStreetMap)
    streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // 2. Satellite Hybrid (Esri World Imagery + Places & Boundaries)
    const satImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    });

    const satLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      pane: "overlayPane",
    });

    satGroup = L.layerGroup([satImagery, satLabels]);

    // Add default street layer
    streetLayer.addTo(map);

    // Layer Switcher Buttons ([data-layer-target])
    document.querySelectorAll("[data-layer-target]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const layerType = btn.getAttribute("data-layer-target");
        switchMapLayer(layerType);
      });
    });

    // Locate Me Buttons (.btn-locate-me)
    document.querySelectorAll(".btn-locate-me").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleLocateMe();
      });
    });

    // Fullscreen Toggle Buttons (.btn-fullscreen-toggle)
    document.querySelectorAll(".btn-fullscreen-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMapFullscreen();
      });
    });

    // Fullscreen Mode Buttons (Pickup/Dropoff toggle inside fullscreen topbar)
    document.querySelectorAll(".fs-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute("data-target-mode");
        currentTargetMode = mode;
        document.querySelectorAll("[data-target-mode]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-target-mode") === mode);
        });
      });
    });

    // Close fullscreen on ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const container = document.getElementById("map-canvas-container");
        if (container && container.classList.contains("is-fullscreen")) {
          toggleMapFullscreen();
        }
      }
    });

    // Click on map to place pin (Strict Camiguin Island only & No ocean clicking!)
    map.on("click", (e) => {
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));

      // Only allow pinning within Camiguin Island
      if (lat < 9.05 || lat > 9.29 || lng < 124.58 || lng > 124.83) {
        showMapToast("⚠️ Pinning is only allowed within Camiguin Island.");
        return;
      }

      // Check distance to nearest Camiguin land/place - reject clicks out at deep sea
      let minDist = Infinity;
      for (const p of CAMIGUIN_PLACES) {
        const d = Math.hypot(lat - p.lat, lng - p.lng);
        if (d < minDist) minDist = d;
      }
      if (minDist > 0.035) { // ~3.8km out at sea
        showMapToast("⚠️ You clicked in the water. Please tap on land or a road in Camiguin!");
        return;
      }

      const nearestName = getNearestCamiguinPlace(lat, lng);

      if (currentTargetMode === "pickup") {
        const label = nearestName ? `${nearestName} (📍 Pinned)` : `Pinned Pickup (${lat}, ${lng})`;
        setPickupPoint(lat, lng, label);
        if (!dropoffLatInput.value) {
          document.querySelectorAll("[data-target-mode]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff"));
          currentTargetMode = "dropoff";
        }
      } else {
        const label = nearestName ? `${nearestName} (📍 Pinned)` : `Pinned Dropoff (${lat}, ${lng})`;
        setDropoffPoint(lat, lng, label);
      }
    });
  }

  function switchMapLayer(layerType) {
    if (!map || layerType === currentTileLayer) return;
    if (layerType === "satellite") {
      map.removeLayer(streetLayer);
      satGroup.addTo(map);
      currentTileLayer = "satellite";
    } else {
      map.removeLayer(satGroup);
      streetLayer.addTo(map);
      currentTileLayer = "street";
    }
    document.querySelectorAll("[data-layer-target]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-layer-target") === layerType);
    });
    showMapToast(layerType === "satellite" ? "🛰️ Satellite Aerial View enabled" : "🗺️ Standard Street Map enabled");
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      showMapToast("Geolocation is not supported on your device.");
      return;
    }
    showMapToast("🔍 Detecting your GPS location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));

        if (lat < 9.05 || lat > 9.29 || lng < 124.58 || lng > 124.83) {
          showMapToast("⚠️ Your GPS location is outside Camiguin Island.");
          return;
        }

        if (userGpsMarker) map.removeLayer(userGpsMarker);
        userGpsMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "user-gps-beacon-icon",
            html: `<div class="user-gps-beacon"><div class="gps-pulse-ring"></div><div class="gps-dot"></div></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          }),
          zIndexOffset: 900
        }).addTo(map);

        map.flyTo([lat, lng], 15, { duration: 1.2 });
        setPickupPoint(lat, lng, `📍 My Location (${lat}, ${lng})`);
        showMapToast("✅ Your GPS location is pinned as Pickup!");
      },
      (err) => {
        showMapToast("⚠️ Unable to access GPS. Please allow Location access in your browser.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function toggleMapFullscreen() {
    const container = document.getElementById("map-canvas-container");
    if (!container) return;
    const isFs = container.classList.toggle("is-fullscreen");
    document.body.style.overflow = isFs ? "hidden" : "";
    document.querySelectorAll(".btn-fullscreen-toggle").forEach((b) => {
      b.innerHTML = isFs ? "<span>✕</span> Close" : "<span>⛶</span> Expand";
    });
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);
  }

  function setPickupPoint(lat, lng, label) {
    pickupLatInput.value = lat;
    pickupLngInput.value = lng;
    if (label) pickupInput.value = label;
    updateClearBtn(pickupInput, clearPickupBtn);

    if (!pickupMarker) {
      const greenIcon = L.divIcon({
        className: "custom-pin-enhanced",
        html: `
          <div class="custom-pin-badge pin-pickup">🟢 Pickup (A)</div>
          <div class="custom-pin-arrow"></div>
        `,
        iconSize: [90, 32],
        iconAnchor: [45, 32],
      });
      pickupMarker = L.marker([lat, lng], { icon: greenIcon, draggable: true }).addTo(map);
      pickupMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        let nLat = parseFloat(pos.lat.toFixed(5));
        let nLng = parseFloat(pos.lng.toFixed(5));
        if (nLat < 9.05) nLat = 9.05;
        if (nLat > 9.29) nLat = 9.29;
        if (nLng < 124.58) nLng = 124.58;
        if (nLng > 124.83) nLng = 124.83;
        e.target.setLatLng([nLat, nLng]);
        const nPlace = getNearestCamiguinPlace(nLat, nLng);
        const newLabel = nPlace ? `${nPlace} (📍 Pinned)` : `Pinned Pickup (${nLat}, ${nLng})`;
        setPickupPoint(nLat, nLng, newLabel);
      });
    } else {
      pickupMarker.setLatLng([lat, lng]);
    }

    if (label) {
      pickupMarker.bindPopup(`<strong>🟢 Pickup:</strong><br>${escapeHtml(label)}`);
    }

    updateRouteLine();
  }

  function setDropoffPoint(lat, lng, label) {
    dropoffLatInput.value = lat;
    dropoffLngInput.value = lng;
    if (label) dropoffInput.value = label;
    updateClearBtn(dropoffInput, clearDropoffBtn);

    if (!dropoffMarker) {
      const redIcon = L.divIcon({
        className: "custom-pin-enhanced",
        html: `
          <div class="custom-pin-badge pin-dropoff">🏁 Dropoff (B)</div>
          <div class="custom-pin-arrow"></div>
        `,
        iconSize: [95, 32],
        iconAnchor: [47, 32],
      });
      dropoffMarker = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);
      dropoffMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        let nLat = parseFloat(pos.lat.toFixed(5));
        let nLng = parseFloat(pos.lng.toFixed(5));
        if (nLat < 9.05) nLat = 9.05;
        if (nLat > 9.29) nLat = 9.29;
        if (nLng < 124.58) nLng = 124.58;
        if (nLng > 124.83) nLng = 124.83;
        e.target.setLatLng([nLat, nLng]);
        const nPlace = getNearestCamiguinPlace(nLat, nLng);
        const newLabel = nPlace ? `${nPlace} (📍 Pinned)` : `Pinned Dropoff (${nLat}, ${nLng})`;
        setDropoffPoint(nLat, nLng, newLabel);
      });
    } else {
      dropoffMarker.setLatLng([lat, lng]);
    }

    if (label) {
      dropoffMarker.bindPopup(`<strong>🏁 Drop-off:</strong><br>${escapeHtml(label)}`);
    }

    updateRouteLine();
  }

  let currentRoadKm = null;
  let osrmAbortCtrl = null;

  async function updateRouteLine() {
    if (!map) return;
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);

    if (pLat && pLng && dLat && dLng) {
      // 1. Immediately draw instant RED LINE fallback so map is NEVER without a redline!
      if (routeBgLine) map.removeLayer(routeBgLine);
      if (routeLine) map.removeLayer(routeLine);

      const immediateCoords = [[pLat, pLng], [dLat, dLng]];
      routeBgLine = L.polyline(immediateCoords, {
        color: "#991b1b",
        weight: 8,
        opacity: 0.40,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      routeLine = L.polyline(immediateCoords, {
        color: "#ef4444", // BOLD VIBRANT RED LINE
        weight: 5,
        opacity: 1.0,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      try {
        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
      } catch (_) {}

      if (osrmAbortCtrl) {
        osrmAbortCtrl.abort();
      }
      osrmAbortCtrl = new AbortController();

      try {
        // Query backend proxy to get exact road routing ("kalsada mismo kung asa ni agi")
        const routeUrl = `/api/road-route?p_lat=${pLat}&p_lng=${pLng}&d_lat=${dLat}&d_lng=${dLng}`;
        const res = await fetch(routeUrl, { signal: osrmAbortCtrl.signal });
        if (res.ok) {
          const routeData = await res.json();
          if (routeData && routeData.road_km) {
            const roadKmVal = parseFloat(routeData.road_km.toFixed(2));
            currentRoadKm = roadKmVal;

            let rawPts = [];
            if (routeData.route_coords && routeData.route_coords.length > 0) {
              rawPts = routeData.route_coords;
            } else {
              rawPts = [[pLat, pLng], [dLat, dLng]];
            }

            const cleanRoadCoords = normalizeRouteCoords(rawPts);
            if (cleanRoadCoords.length >= 2) {
              if (routeBgLine) map.removeLayer(routeBgLine);
              if (routeLine) map.removeLayer(routeLine);

              // Bold Red Road Polyline snapping exactly to Camiguin streets & highway
              routeBgLine = L.polyline(cleanRoadCoords, {
                color: "#7f1d1d",
                weight: 9,
                opacity: 0.45,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(map);

              routeLine = L.polyline(cleanRoadCoords, {
                color: "#ef4444", // PURE VIBRANT REDLINE
                weight: 5,
                opacity: 1.0,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(map);

              map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
            }

            // Recalculate fare using the exact road distance
            recalculateFare(roadKmVal);
            return;
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.log("Route query error:", err);
        }
      }
    } else {
      if (routeBgLine) {
        map.removeLayer(routeBgLine);
        routeBgLine = null;
      }
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      currentRoadKm = null;
    }

    recalculateFare();
  }

  let lastBaseFare = 40;
  let appliedPromo = null;

  const ridersCountInput = document.getElementById("riders-count-input");
  const ridersCountVal = document.getElementById("riders-count-val");
  const ridersCountUnit = document.getElementById("riders-count-unit");
  const ridersCountBadge = document.getElementById("riders-count-badge");
  const ridersCountDec = document.getElementById("riders-count-dec");
  const ridersCountInc = document.getElementById("riders-count-inc");
  const ridersPresetBtns = document.querySelectorAll("[data-riders-preset]");

  function getRidersCount() {
    const raw = ridersCountInput ? parseInt(ridersCountInput.value || "1", 10) : 1;
    if (!Number.isFinite(raw) || raw < 1) return 1;
    if (raw > 10) return 10;
    return raw;
  }

  function updateRidersCountUI(nextCount) {
    let count = parseInt(nextCount, 10);
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > 10) count = 10;

    if (ridersCountInput) ridersCountInput.value = String(count);
    if (ridersCountVal) ridersCountVal.textContent = String(count);
    if (ridersCountUnit) ridersCountUnit.textContent = count === 1 ? "rider" : "riders";
    if (ridersCountBadge) {
      ridersCountBadge.textContent = count === 1 ? "1 Rider (Solo)" : `${count} Riders Simultaneous`;
    }
    if (ridersCountDec) ridersCountDec.disabled = count <= 1;
    if (ridersCountInc) ridersCountInc.disabled = count >= 10;

    ridersPresetBtns.forEach((btn) => {
      const pVal = parseInt(btn.getAttribute("data-riders-preset") || "0", 10);
      btn.classList.toggle("active", pVal === count);
    });

    if (submitBtn && !submitBtn.disabled) {
      const spanEl = submitBtn.querySelector("span:first-child");
      const label = count === 1
        ? "Broadcast Request to Active Riders 🛵"
        : `Broadcast Request to ${count} Riders 🛵`;
      if (spanEl) {
        spanEl.textContent = label;
      } else {
        submitBtn.textContent = `${label} →`;
      }
    }

    applyPromoPreviewToFare();
  }

  if (ridersCountDec) {
    ridersCountDec.addEventListener("click", () => updateRidersCountUI(getRidersCount() - 1));
  }
  if (ridersCountInc) {
    ridersCountInc.addEventListener("click", () => updateRidersCountUI(getRidersCount() + 1));
  }
  ridersPresetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const pVal = parseInt(btn.getAttribute("data-riders-preset") || "1", 10);
      updateRidersCountUI(pVal);
    });
  });

  function applyPromoPreviewToFare() {
    const discountRow = document.getElementById("promo-discount-row");
    const discountVal = document.getElementById("promo-discount-val");
    const promoFeedback = document.getElementById("promo-feedback");
    const groupSummaryRow = document.getElementById("fare-group-summary-row");
    const groupSummaryVal = document.getElementById("fare-group-summary-val");
    const fareEstLabel = document.getElementById("fare-estimate-label");

    const perRiderBase = Math.max(0, Math.round(Number(lastBaseFare || 40)));
    const ridersCount = getRidersCount();
    const baseFare = perRiderBase * ridersCount;

    if (fareEstLabel) {
      fareEstLabel.textContent = ridersCount > 1 ? "Estimated Group Total" : "Estimated Fare";
    }
    if (groupSummaryRow) {
      groupSummaryRow.classList.toggle("hidden", ridersCount <= 1);
    }
    if (groupSummaryVal && ridersCount > 1) {
      groupSummaryVal.textContent = `₱${perRiderBase.toLocaleString()} per rider × ${ridersCount} riders = ₱${baseFare.toLocaleString()}`;
    }

    if (!appliedPromo) {
      if (discountRow) discountRow.classList.add("hidden");
      if (discountVal) discountVal.textContent = "-₱0";
      if (fareDisplay) fareDisplay.textContent = String(baseFare);
      return;
    }

    const minFare = Number(appliedPromo.min_fare || 0);
    if (minFare > 0 && baseFare < minFare) {
      if (discountRow) discountRow.classList.add("hidden");
      if (discountVal) discountVal.textContent = "-₱0";
      if (fareDisplay) fareDisplay.textContent = String(baseFare);
      if (promoFeedback) {
        promoFeedback.textContent = `✕ Minimum fare of ₱${Math.round(minFare)} required for ${appliedPromo.code}.`;
        promoFeedback.style.color = "#dc2626";
        promoFeedback.classList.remove("hidden");
      }
      return;
    }

    const rawDiscount = Math.max(0, Number(appliedPromo.discount_amount || 0));
    const effectiveDiscount = Math.min(rawDiscount, baseFare);
    const discountedFare = Math.max(0, Math.round(baseFare - effectiveDiscount));

    if (fareDisplay) fareDisplay.textContent = String(discountedFare);
    if (discountVal) discountVal.textContent = `-₱${Math.round(effectiveDiscount)}`;
    if (discountRow) discountRow.classList.remove("hidden");
    if (promoFeedback) {
      promoFeedback.textContent = `✓ ₱${Math.round(effectiveDiscount)} discount voucher applied!`;
      promoFeedback.style.color = "#16a34a";
      promoFeedback.classList.remove("hidden");
    }
  }

  let fareReqSeq = 0;

  function renderFareBreakdownBadges(breakdown, autoHinterland) {
    if (!fareBreakdownBadges) return;
    if (!breakdown) {
      fareBreakdownBadges.innerHTML = "";
      fareBreakdownBadges.classList.add("hidden");
      return;
    }
    const serviceFee = Number(breakdown.service_fee || 0);
    const queuingFee = Number(breakdown.queuing_fee || 0);
    const extraStoresFee = Number(breakdown.extra_stores_fee || 0);
    const bulkyFee = Number(breakdown.bulky_fee || 0);
    const hinterlandFee = Number(breakdown.hinterland_fee || 0);
    const hasExtras = serviceFee > 0 || queuingFee > 0 || extraStoresFee > 0 || bulkyFee > 0 || hinterlandFee > 0;

    if (!hasExtras) {
      fareBreakdownBadges.innerHTML = "";
      fareBreakdownBadges.classList.add("hidden");
      return;
    }

    const pills = [];
    pills.push(
      `<span class="fare-pill-item"><span>Meter Fare:</span> ₱${Math.round(Number(breakdown.meter_fare || 0))}</span>`
    );
    if (serviceFee > 0) {
      pills.push(`<span class="fare-pill-item"><span>Service Fee:</span> +₱${Math.round(serviceFee)}</span>`);
    }
    if (queuingFee > 0) {
      pills.push(`<span class="fare-pill-item"><span>Supermarket Queue:</span> +₱${Math.round(queuingFee)}</span>`);
    }
    if (extraStoresFee > 0) {
      pills.push(`<span class="fare-pill-item"><span>Extra Stops:</span> +₱${Math.round(extraStoresFee)}</span>`);
    }
    if (bulkyFee > 0) {
      pills.push(`<span class="fare-pill-item"><span>Bulky Order:</span> +₱${Math.round(bulkyFee)}</span>`);
    }
    if (hinterlandFee > 0) {
      const uplandLabel = autoHinterland ? "Steep / Upland Route (Auto-Added)" : "Mountain / Steep Route";
      pills.push(
        `<span class="fare-pill-item fare-pill-upland">⛰️ +₱${Math.round(hinterlandFee)} <span>${uplandLabel}</span></span>`
      );
    }

    fareBreakdownBadges.innerHTML = pills.join("");
    fareBreakdownBadges.classList.remove("hidden");
  }

  async function recalculateFare(overrideRoadKm) {
    const reqId = ++fareReqSeq;
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);
    const service = serviceTypeInput.value;
    const isLarge = optLargeStore ? optLargeStore.checked : false;
    const extraStores = optExtraStores ? parseInt(optExtraStores.value || "0", 10) : 0;
    const isHinterland = optHinterland ? (optHinterland.checked && optHinterland.dataset.manual === "1") : false;
    const budgetVal = estimatedBudgetInput ? parseFloat(estimatedBudgetInput.value || 0) : 0;
    const isBulky = budgetVal >= 2000;
    const roadKmToSend = typeof overrideRoadKm === "number" ? overrideRoadKm : currentRoadKm;

    if (!pLat || !pLng || !dLat || !dLng) {
      if (routeBgLine && map) {
        map.removeLayer(routeBgLine);
        routeBgLine = null;
      }
      if (routeLine && map) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      currentRoadKm = null;
      lastBaseFare = 40;
      applyPromoPreviewToFare();
      if (fareKmDisplay) fareKmDisplay.textContent = "~0.0 km (Select Location)";
      renderFareBreakdownBadges(null, false);
      if (optHinterland && optHinterland.dataset.autoApplied === "1" && !optHinterland.dataset.manual) {
        optHinterland.checked = false;
        optHinterland.dataset.autoApplied = "";
      }
      return;
    }

    try {
      const res = await fetch("/api/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pLat || null,
          pickup_lng: pLng || null,
          dropoff_lat: dLat || null,
          dropoff_lng: dLng || null,
          road_km: roadKmToSend,
          pickup_address: pickupInput ? pickupInput.value.trim() : "",
          dropoff_address: dropoffInput ? dropoffInput.value.trim() : "",
          item_notes: itemNotesField ? itemNotesField.value.trim() : "",
          service_type: service,
          is_large_store: isLarge,
          extra_stores_count: extraStores,
          is_bulky_or_high_value: isBulky,
          is_hinterland: isHinterland,
        }),
      });
      const data = await res.json();
      if (reqId !== fareReqSeq) return;
      if (data && data.fare_amount) {
        lastBaseFare = Math.round(Number(data.fare_amount));
        applyPromoPreviewToFare();
        if (fareKmDisplay) fareKmDisplay.textContent = `~${data.estimated_km} km (Road Distance)`;

        renderFareBreakdownBadges(data.breakdown, Boolean(data.auto_hinterland));
        if (optHinterland) {
          if (data.auto_hinterland) {
            optHinterland.checked = true;
            optHinterland.dataset.autoApplied = "1";
          } else if (optHinterland.dataset.autoApplied === "1" && !optHinterland.dataset.manual) {
            optHinterland.checked = false;
            optHinterland.dataset.autoApplied = "";
          }
        }

        // If backend resolved coordinates that were missing, update markers & inputs
        let hasNewCoords = false;
        if (data.resolved_pickup && (!pLat || !pLng)) {
          pickupLatInput.value = data.resolved_pickup.lat;
          pickupLngInput.value = data.resolved_pickup.lng;
          if (pickupMarker) {
            pickupMarker.setLatLng([data.resolved_pickup.lat, data.resolved_pickup.lng]);
          } else if (map) {
            setPickupPoint(data.resolved_pickup.lat, data.resolved_pickup.lng, null);
          }
          hasNewCoords = true;
        }
        if (data.resolved_dropoff && (!dLat || !dLng)) {
          dropoffLatInput.value = data.resolved_dropoff.lat;
          dropoffLngInput.value = data.resolved_dropoff.lng;
          if (dropoffMarker) {
            dropoffMarker.setLatLng([data.resolved_dropoff.lat, data.resolved_dropoff.lng]);
          } else if (map) {
            setDropoffPoint(data.resolved_dropoff.lat, data.resolved_dropoff.lng, null);
          }
          hasNewCoords = true;
        }

        // If backend sent route coordinates and frontend hasn't drawn yet
        if (data.route_coords && data.route_coords.length > 0 && (!currentRoadKm || hasNewCoords)) {
          const cleanRoadCoords = normalizeRouteCoords(data.route_coords);
          if (cleanRoadCoords.length >= 2) {
            if (routeBgLine) map.removeLayer(routeBgLine);
            if (routeLine) map.removeLayer(routeLine);

            routeBgLine = L.polyline(cleanRoadCoords, {
              color: "#7f1d1d",
              weight: 9,
              opacity: 0.45,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);

            routeLine = L.polyline(cleanRoadCoords, {
              color: "#ef4444", // BOLD REDLINE
              weight: 5,
              opacity: 1.0,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
          }
        }
      }
    } catch (_) {}
  }

  // Quick Landmark Chips (Popular Destinations)
  // "DAPAT PAG CLICK NAKO SA POPULAR DESTINATION MO AUTO INPUT SA DROP OFF"
  if (landmarkChips) {
    landmarkChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip-pill, .chip-btn");
      if (!chip) return;
      const name = chip.getAttribute("data-name");
      const lat = parseFloat(chip.getAttribute("data-lat"));
      const lng = parseFloat(chip.getAttribute("data-lng"));
      if (!lat || !lng) return;

      // 1. Highlight active chip
      document.querySelectorAll(".chip-pill").forEach((p) => p.classList.remove("active"));
      chip.classList.add("active");

      // 2. ALWAYS Auto-input directly to DESTINATION / DROP-OFF!
      if (dropoffInput) dropoffInput.value = name;
      dropoffLatInput.value = lat;
      dropoffLngInput.value = lng;
      setDropoffPoint(lat, lng, name);

      // 3. Switch target mode buttons to Dropoff (Red Pin active)
      targetModeButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff")
      );
      currentTargetMode = "dropoff";

      // 4. Update marker & popup
      if (dropoffMarker) {
        dropoffMarker.setLatLng([lat, lng]);
        dropoffMarker.bindPopup(`<strong>🏁 Drop-off Destination:</strong><br>${escapeHtml(name)}`).openPopup();
      }

      // 5. Instantly fly map right to the pinned destination (Zoom 16)
      if (map) {
        map.flyTo([lat, lng], 16, { duration: 0.8 });
      }

      // 6. Smoothly scroll map into view so user immediately sees the pin
      const mapContainer = document.getElementById("map-canvas-container") || document.getElementById("booking-map");
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      showMapToast(`🏁 Drop-off set: ${name}`);
      updateRouteLine();
      recalculateFare();
    });
  }

  // GPS Locate Pickup
  if (locatePickupGpsBtn) {
    locatePickupGpsBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }
      locatePickupGpsBtn.textContent = "📍 Locating GPS...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locatePickupGpsBtn.textContent = "📍 My Current GPS";
          const lat = parseFloat(pos.coords.latitude.toFixed(5));
          const lng = parseFloat(pos.coords.longitude.toFixed(5));
          setPickupPoint(lat, lng, "My Current GPS Location");
          if (map) map.setView([lat, lng], 14);
        },
        () => {
          locatePickupGpsBtn.textContent = "📍 My Current GPS";
          alert("Unable to retrieve GPS coordinates. Please grant Location permission.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Clean Map Boot - Inputs start 100% BLANK unless prefilled by URL query params!
  function bootBookingMap() {
    initMap();
    if (pickupInput) pickupInput.value = "";
    if (dropoffInput) dropoffInput.value = "";
    if (pickupLatInput) pickupLatInput.value = "";
    if (pickupLngInput) pickupLngInput.value = "";
    if (dropoffLatInput) dropoffLatInput.value = "";
    if (dropoffLngInput) dropoffLngInput.value = "";
    if (optHinterland) {
      optHinterland.checked = false;
      optHinterland.dataset.manual = "";
      optHinterland.dataset.autoApplied = "";
    }
    updateClearBtn(pickupInput, clearPickupBtn);
    updateClearBtn(dropoffInput, clearDropoffBtn);

    // Prefill from URL query params (e.g. from Island Tours) AFTER clearing
    let hasPrefill = false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const prefillDrop = (urlParams.get("dropoff") || "").trim();
      const prefillPick = (urlParams.get("pickup") || "").trim();
      const prefillNotes = (urlParams.get("notes") || "").trim();
      if (prefillPick && pickupInput) {
        const matchedPick = matchCamiguinPlace(prefillPick);
        if (matchedPick) {
          setPickupPoint(matchedPick.lat, matchedPick.lng, prefillPick);
          hasPrefill = true;
        } else {
          pickupInput.value = prefillPick;
          updateClearBtn(pickupInput, clearPickupBtn);
        }
      }
      if (prefillDrop && dropoffInput) {
        const matchedDrop = matchCamiguinPlace(prefillDrop);
        if (matchedDrop) {
          setDropoffPoint(matchedDrop.lat, matchedDrop.lng, prefillDrop);
          hasPrefill = true;
        } else {
          dropoffInput.value = prefillDrop;
          updateClearBtn(dropoffInput, clearDropoffBtn);
        }
      }
      const itemNotesInput = document.getElementById("item-notes");
      if (prefillNotes && itemNotesInput) {
        itemNotesInput.value = prefillNotes;
      }
    } catch (_) {}

    if (!hasPrefill) {
      recalculateFare();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBookingMap);
  } else {
    bootBookingMap();
  }

  // Booking Form Submission
  function restoreSubmitBtnLabel() {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    const count = getRidersCount();
    const label = count === 1
      ? "Broadcast Request to Active Riders 🛵"
      : `Broadcast Request to ${count} Riders 🛵`;
    const spanEl = submitBtn.querySelector("span:first-child");
    if (spanEl) {
      spanEl.textContent = label;
    } else {
      submitBtn.textContent = `${label} →`;
    }
  }

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorMsg) {
        errorMsg.classList.add("hidden");
        errorMsg.textContent = "";
      }

      const ridersCount = getRidersCount();
      submitBtn.disabled = true;
      const submitSpan = submitBtn.querySelector("span:first-child");
      if (submitSpan) {
        submitSpan.textContent = ridersCount > 1
          ? `Broadcasting to ${ridersCount} riders...`
          : "Broadcasting booking to riders...";
      } else {
        submitBtn.textContent = ridersCount > 1
          ? `Broadcasting to ${ridersCount} riders...`
          : "Broadcasting booking to riders...";
      }

      const budgetVal = estimatedBudgetInput ? parseFloat(estimatedBudgetInput.value || 0) : 0;
      const payload = {
        service_type: serviceTypeInput.value,
        riders_count: ridersCount,
        pickup_address: pickupInput.value.trim(),
        pickup_lat: pickupLatInput.value ? parseFloat(pickupLatInput.value) : null,
        pickup_lng: pickupLngInput.value ? parseFloat(pickupLngInput.value) : null,
        dropoff_address: dropoffInput.value.trim(),
        dropoff_lat: dropoffLatInput.value ? parseFloat(dropoffLatInput.value) : null,
        dropoff_lng: dropoffLngInput.value ? parseFloat(dropoffLngInput.value) : null,
        road_km: currentRoadKm,
        customer_name: document.getElementById("customer-name").value.trim(),
        customer_phone: document.getElementById("customer-phone").value.trim(),
        item_notes: document.getElementById("item-notes").value.trim(),
        estimated_budget: budgetVal,
        is_large_store: optLargeStore ? optLargeStore.checked : false,
        extra_stores_count: optExtraStores ? parseInt(optExtraStores.value || "0", 10) : 0,
        is_hinterland: optHinterland ? (optHinterland.checked && optHinterland.dataset.manual === "1") : false,
        is_bulky_or_high_value: budgetVal >= 2000,
        payment_method: document.querySelector('input[name="payment_method"]:checked')?.value || "cash",
        scheduled_at: (document.querySelector('input[name="ride_timing"]:checked')?.value === "later") ? (document.getElementById("scheduled-at")?.value || "") : "",
        promo_code: (document.getElementById("promo-code-input")?.value || "").trim().toUpperCase(),
      };

      const regToggle = document.getElementById("reg-during-booking-toggle");
      const regPwd = document.getElementById("reg-booking-pwd");
      const regMun = document.getElementById("reg-booking-mun");
      if (regToggle && regToggle.checked && regPwd && regPwd.value.trim()) {
        payload.customer_password = regPwd.value.trim();
        payload.customer_barangay = regMun ? regMun.value : "";
      }

      // MANDATORY: Customer must be signed in or registering with password to broadcast!
      const currentCust = getStoredCustomer();
      const isRegisteringNow = regToggle && regToggle.checked && regPwd && regPwd.value.trim().length >= 6;

      if (!currentCust && !isRegisteringNow) {
        restoreSubmitBtnLabel();
        if (errorMsg) {
          errorMsg.innerHTML = "⚠️ <strong>Please Sign In or Register first!</strong><br>To verify your account for our riders, please sign in or register in the popup below.";
          errorMsg.classList.remove("hidden");
          errorMsg.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        // Pre-fill phone and name into login/register forms
        const cLoginPhone = document.getElementById("c-login-phone");
        const cRegName = document.getElementById("c-reg-name");
        const cRegPhone = document.getElementById("c-reg-phone");
        if (cLoginPhone && payload.customer_phone) cLoginPhone.value = payload.customer_phone;
        if (cRegPhone && payload.customer_phone) cRegPhone.value = payload.customer_phone;
        if (cRegName && payload.customer_name) cRegName.value = payload.customer_name;

        // Open modal
        if (window.CCRCAuth && typeof window.CCRCAuth.openModal === "function") {
          window.CCRCAuth.openModal("login");
        } else {
          const custModal = document.getElementById("customer-auth-modal");
          if (custModal) custModal.classList.remove("hidden");
        }
        return;
      }

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not process booking.");
        }

        const b = data.booking;
        const activeRef = (data.group_code && Number(data.riders_count || 1) > 1) ? data.group_code : b.booking_code;
        try {
          localStorage.setItem("ccrc_active_booking", activeRef);
          if (payload.customer_phone) localStorage.setItem("ccrc_customer_phone", payload.customer_phone);
          if (payload.customer_name) localStorage.setItem("ccrc_customer_name", payload.customer_name);
        } catch (_) {}
        if (payload.customer_password) {
          setStoredCustomer({
            name: payload.customer_name,
            phone: payload.customer_phone,
            barangay: payload.customer_barangay,
            is_verified: 1,
          });
        }

        updateActiveTripNavLinks(activeRef);
        if (typeof window.playDispatchChime === "function") window.playDispatchChime();

        if (modalBookingCode) modalBookingCode.textContent = activeRef;
        const modalGroupNote = document.getElementById("modal-group-note");
        if (modalGroupNote) {
          if (data.group_code && Number(data.riders_count || 1) > 1) {
            modalGroupNote.textContent = `👥 Dispatched ${data.riders_count} linked rider slots (₱${Math.round(Number(data.per_rider_fare || b.fare_amount || 0)).toLocaleString()} per rider • Total ₱${Math.round(Number(data.total_fare || 0)).toLocaleString()}).`;
            modalGroupNote.classList.remove("hidden");
          } else {
            modalGroupNote.classList.add("hidden");
          }
        }
        if (modalTrackLink) modalTrackLink.href = data.tracking_url;
        if (successModal) successModal.classList.remove("hidden");

        // Seamless transition to live tracking after 1.5 seconds
        setTimeout(() => {
          window.location.href = data.tracking_url;
        }, 1500);
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err.message;
          errorMsg.classList.remove("hidden");
        }
        restoreSubmitBtnLabel();
      }
    });

    // Timing Selector (Now vs Later)
    const timingRadios = document.querySelectorAll('input[name="ride_timing"]');
    const scheduleWrap = document.getElementById("schedule-datetime-wrap");
    timingRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        document.querySelectorAll(".timing-radio-card").forEach(c => {
          c.classList.remove("active");
          c.style.borderColor = "#cbd5e1";
          c.style.background = "#f8fafc";
        });
        const card = e.target.closest(".timing-radio-card");
        if (card) {
          card.classList.add("active");
          card.style.borderColor = "var(--primary)";
          card.style.background = "#fff7ed";
        }
        if (e.target.value === "later") {
          scheduleWrap?.classList.remove("hidden");
        } else {
          scheduleWrap?.classList.add("hidden");
        }
      });
    });

    // Payment Selector (Cash, GCash, Maya)
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    paymentRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        document.querySelectorAll(".payment-card").forEach(c => {
          c.classList.remove("active");
          c.style.borderColor = "#cbd5e1";
          c.style.background = "#f8fafc";
        });
        const card = e.target.closest(".payment-card");
        if (card) {
          card.classList.add("active");
          card.style.borderColor = "var(--primary)";
          card.style.background = "#fff7ed";
        }
      });
    });

    // Promo Code Live Validation
    const applyPromoBtn = document.getElementById("apply-promo-btn");
    const promoInput = document.getElementById("promo-code-input");
    const promoFeedback = document.getElementById("promo-feedback");

    if (promoInput) {
      promoInput.addEventListener("input", () => {
        const curCode = promoInput.value.trim().toUpperCase();
        if (!curCode || (appliedPromo && curCode !== appliedPromo.code)) {
          appliedPromo = null;
          if (promoFeedback) promoFeedback.classList.add("hidden");
          applyPromoPreviewToFare();
        }
      });
    }

    if (applyPromoBtn && promoInput) {
      applyPromoBtn.addEventListener("click", async () => {
        const code = promoInput.value.trim().toUpperCase();
        if (!code) {
          appliedPromo = null;
          if (promoFeedback) promoFeedback.classList.add("hidden");
          applyPromoPreviewToFare();
          return;
        }
        const currentFare = Math.max(0, Math.round(Number(lastBaseFare || 40))) * getRidersCount();

        try {
          applyPromoBtn.disabled = true;
          applyPromoBtn.textContent = "...";
          const res = await fetch("/api/promo/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: code, fare_amount: currentFare }),
          });
          const data = await res.json();
          if (data.success && data.promo) {
            appliedPromo = {
              code: data.promo.code || code,
              discount_amount: Number(data.promo.raw_discount ?? data.promo.discount_amount ?? 0),
              min_fare: Number(data.promo.min_fare ?? 0),
            };
            applyPromoPreviewToFare();
          } else {
            appliedPromo = null;
            applyPromoPreviewToFare();
            if (promoFeedback) {
              promoFeedback.textContent = `✕ ${data.error || "Invalid promo code."}`;
              promoFeedback.style.color = "#dc2626";
              promoFeedback.classList.remove("hidden");
            }
          }
        } catch (err) {
          appliedPromo = null;
          applyPromoPreviewToFare();
          if (promoFeedback) {
            promoFeedback.textContent = "Could not validate code.";
            promoFeedback.style.color = "#dc2626";
            promoFeedback.classList.remove("hidden");
          }
        } finally {
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = "Apply";
        }
      });
    }

  }

  // ---------------------------------------------------------------------------
  // Customer Active Booking Persistence & Live Banner Tracking
  // ---------------------------------------------------------------------------
  function updateActiveTripNavLinks(bookingCode) {
    const navPill = document.getElementById("nav-active-trip-pill");
    const bottomPill = document.getElementById("bottom-active-trip-item");
    if (bookingCode) {
      const url = `/track/${encodeURIComponent(bookingCode)}`;
      if (navPill) {
        navPill.href = url;
        navPill.style.display = "inline-flex";
      }
      if (bottomPill) {
        bottomPill.href = url;
        bottomPill.style.display = "flex";
      }
    } else {
      if (navPill) navPill.style.display = "none";
      if (bottomPill) bottomPill.style.display = "none";
    }
  }

  function renderExtraActiveTrips(trips) {
    const extraWrap = document.getElementById("customer-active-trips-extra");
    if (!extraWrap) return;
    if (!Array.isArray(trips) || trips.length <= 1) {
      extraWrap.innerHTML = "";
      extraWrap.classList.add("hidden");
      return;
    }
    extraWrap.innerHTML = trips.slice(1).map((trip) => {
      const b = trip.booking || {};
      const summary = trip.group_summary || null;
      const codeLabel = trip.is_group && trip.group_code ? trip.group_code : (b.booking_code || "");
      const trackUrl = trip.tracking_url || `/track/${encodeURIComponent(codeLabel)}`;
      const fareTotal = summary
        ? (Number(summary.cancelled_count || 0) > 0 && summary.active_total_fare !== undefined
          ? Number(summary.active_total_fare || 0)
          : Number(summary.total_fare || 0))
        : Number(b.fare_amount || 0);
      const statusText = summary
        ? `👥 ${summary.assigned_count}/${summary.total_riders} Riders Assigned`
        : escapeHtml(b.status || "active");
      return `
        <div class="active-extra-trip-card">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong style="font-family:monospace;color:#9a3412;">${escapeHtml(codeLabel)}</strong>
              <span class="badge" style="background:#dbeafe;color:#1d4ed8;font-size:0.72rem;font-weight:700;">${statusText}</span>
            </div>
            <small class="text-muted" style="display:block;margin-top:2px;">
              ${escapeHtml(b.pickup_address || "")} &rarr; ${escapeHtml(b.dropoff_address || "")} &bull; <strong>₱${Math.round(fareTotal).toLocaleString()}</strong>
            </small>
          </div>
          <a href="${escapeHtml(trackUrl)}" class="btn btn-sm btn-primary" style="white-space:nowrap;">Track &rarr;</a>
        </div>
      `;
    }).join("");
    extraWrap.classList.remove("hidden");
  }

  function renderCustomerActiveCard(b, tripMeta) {
    const card = document.getElementById("customer-active-ride-card");
    if (!card || !b) return;

    const summary = tripMeta && tripMeta.group_summary ? tripMeta.group_summary : null;
    const isGroup = Boolean(summary && summary.total_riders > 1);
    const activeCode = (isGroup && tripMeta.group_code) ? tripMeta.group_code : b.booking_code;
    const trackingUrl = (tripMeta && tripMeta.tracking_url) ? tripMeta.tracking_url : `/track/${encodeURIComponent(activeCode)}`;

    const codeEl = document.getElementById("active-card-code");
    const groupBadgeEl = document.getElementById("active-card-group-badge");
    const groupProgressEl = document.getElementById("active-card-group-progress");
    const badgeEl = document.getElementById("active-card-status-badge");
    const riderInfoEl = document.getElementById("active-card-rider-info");
    const riderAvatarEl = document.getElementById("active-card-rider-avatar");
    const riderNameEl = document.getElementById("active-card-rider-name");
    const riderBikeEl = document.getElementById("active-card-rider-bike");
    const callBtnEl = document.getElementById("active-card-call-btn");
    const pickupEl = document.getElementById("active-card-pickup");
    const dropoffEl = document.getElementById("active-card-dropoff");
    const fareEl = document.getElementById("active-card-fare");
    const trackBtnEl = document.getElementById("active-card-track-btn");

    if (codeEl) codeEl.textContent = activeCode;
    if (groupBadgeEl) {
      if (isGroup) {
        groupBadgeEl.textContent = `👥 Group Ride (${summary.total_riders} Riders) • ${summary.assigned_count}/${summary.total_riders} Assigned`;
        groupBadgeEl.classList.remove("hidden");
      } else {
        groupBadgeEl.classList.add("hidden");
      }
    }
    if (groupProgressEl) {
      if (isGroup) {
        groupProgressEl.textContent = `(${summary.open_count} open, ${summary.completed_count} completed)`;
        groupProgressEl.classList.remove("hidden");
      } else {
        groupProgressEl.classList.add("hidden");
      }
    }
    if (pickupEl) pickupEl.textContent = b.pickup_address;
    if (dropoffEl) dropoffEl.textContent = b.dropoff_address;
    if (fareEl) {
      const displayFare = isGroup
        ? (Number(summary.cancelled_count || 0) > 0 && summary.active_total_fare !== undefined
          ? summary.active_total_fare
          : summary.total_fare)
        : b.fare_amount;
      fareEl.textContent = `₱${Math.round(displayFare || 0).toLocaleString()}`;
    }
    if (trackBtnEl) trackBtnEl.href = trackingUrl;

    if (badgeEl) {
      if (isGroup) {
        if (summary.assigned_count >= summary.total_riders) {
          badgeEl.textContent = `🛵 All ${summary.total_riders} Riders Assigned!`;
          badgeEl.style.background = summary.in_progress_count > 0 ? "#16a34a" : "#ea580c";
        } else if (summary.assigned_count > 0) {
          badgeEl.textContent = `🛵 ${summary.assigned_count}/${summary.total_riders} Riders Assigned`;
          badgeEl.style.background = "#ea580c";
        } else {
          badgeEl.textContent = `⏳ Waiting for ${summary.total_riders} Riders...`;
          badgeEl.style.background = "#0284c7";
        }
      } else if (b.status === "accepted") {
        badgeEl.textContent = "🛵 Rider Accepted & Heading to Pickup!";
        badgeEl.style.background = "#ea580c";
      } else if (b.status === "in_progress") {
        badgeEl.textContent = "🚀 In Transit / Heading to Destination!";
        badgeEl.style.background = "#16a34a";
      } else {
        badgeEl.textContent = "⏳ Looking for Available Island Rider...";
        badgeEl.style.background = "#0284c7";
      }
    }

    if (b.rider_id) {
      if (riderInfoEl) riderInfoEl.classList.remove("hidden");
      if (riderNameEl) riderNameEl.textContent = b.rider_name || "Club Rider";
      if (riderBikeEl) {
        riderBikeEl.textContent = b.rider_bike || "Island Express Bike";
        if (b.rider_plate) {
          riderBikeEl.appendChild(document.createTextNode(" • Plate: "));
          const strongPlate = document.createElement("strong");
          strongPlate.textContent = b.rider_plate;
          riderBikeEl.appendChild(strongPlate);
        }
      }
      if (callBtnEl) {
        if (b.rider_phone) {
          callBtnEl.href = `tel:${b.rider_phone}`;
          callBtnEl.classList.remove("hidden");
        } else {
          callBtnEl.classList.add("hidden");
        }
      }
      if (riderAvatarEl) {
        riderAvatarEl.innerHTML = "";
        if (b.rider_avatar && (/^https?:\/\//i.test(b.rider_avatar) || b.rider_avatar.startsWith("/"))) {
          const img = document.createElement("img");
          img.src = b.rider_avatar;
          img.alt = "Rider";
          img.style.cssText = "width:100%;height:100%;object-fit:cover;";
          riderAvatarEl.appendChild(img);
        } else {
          riderAvatarEl.textContent = (b.rider_name || "R")[0].toUpperCase();
        }
      }
    } else {
      if (riderInfoEl) riderInfoEl.classList.add("hidden");
    }

    card.classList.remove("hidden");
    updateActiveTripNavLinks(activeCode);
  }

  async function checkCustomerActiveBooking() {
    let activeCode = null;
    try {
      activeCode = localStorage.getItem("ccrc_active_booking");
    } catch (_) {}
    if (!activeCode && Array.isArray(window.SERVER_ACTIVE_TRIPS) && window.SERVER_ACTIVE_TRIPS.length > 0) {
      const firstTrip = window.SERVER_ACTIVE_TRIPS[0];
      activeCode = (firstTrip.is_group && firstTrip.group_code) ? firstTrip.group_code : (firstTrip.booking ? firstTrip.booking.booking_code : null);
    } else if (!activeCode && window.SERVER_ACTIVE_BOOKING) {
      activeCode = window.SERVER_ACTIVE_BOOKING.group_code && Number(window.SERVER_ACTIVE_BOOKING.group_size || 1) > 1
        ? window.SERVER_ACTIVE_BOOKING.group_code
        : window.SERVER_ACTIVE_BOOKING.booking_code;
    }
    let phone = null;
    try {
      phone = localStorage.getItem("ccrc_customer_phone");
    } catch (_) {}

    if (Array.isArray(window.SERVER_ACTIVE_TRIPS) && window.SERVER_ACTIVE_TRIPS.length > 0) {
      renderExtraActiveTrips(window.SERVER_ACTIVE_TRIPS);
    }

    if (!activeCode && !phone) return;

    let query = "";
    if (activeCode) query = `code=${encodeURIComponent(activeCode)}`;
    else if (phone) query = `phone=${encodeURIComponent(phone)}`;

    try {
      const res = await fetch(`/api/customer/active-booking?${query}`);
      const data = await res.json();
      if (data.active && data.booking) {
        const activeRef = (data.is_group && data.group_code) ? data.group_code : data.booking.booking_code;
        try {
          localStorage.setItem("ccrc_active_booking", activeRef);
        } catch (_) {}
        renderCustomerActiveCard(data.booking, data);
        renderExtraActiveTrips(data.active_trips || []);
      } else {
        if (data.booking && (!data.active_trips || data.active_trips.length === 0)) {
          const allDone = data.group_summary
            ? Number(data.group_summary.active_count || 0) === 0
            : (data.booking.status === "completed" || data.booking.status === "cancelled");
          if (allDone) {
            try {
              localStorage.removeItem("ccrc_active_booking");
            } catch (_) {}
            const card = document.getElementById("customer-active-ride-card");
            if (card) card.classList.add("hidden");
            renderExtraActiveTrips([]);
            updateActiveTripNavLinks(null);
          }
        }
      }
    } catch (_) {}
  }

  // Check active booking immediately on load and poll every 6s
  checkCustomerActiveBooking();
  setInterval(checkCustomerActiveBooking, 6000);

  // ---------------------------------------------------------------------------
  // Customer Authentication & Legit Verification Controller (Delegated to CCRCAuth)
  // ---------------------------------------------------------------------------
  const regDuringToggle = document.getElementById("reg-during-booking-toggle");
  const regDuringFields = document.getElementById("reg-during-booking-fields");

  if (regDuringToggle && regDuringFields) {
    regDuringToggle.addEventListener("change", () => {
      if (regDuringToggle.checked) {
        regDuringFields.classList.remove("hidden");
      } else {
        regDuringFields.classList.add("hidden");
      }
    });
  }

  function getStoredCustomer() {
    if (window.CCRCAuth && typeof window.CCRCAuth.getStoredCustomer === "function") {
      return window.CCRCAuth.getStoredCustomer();
    }
    try {
      const raw = localStorage.getItem("ccrc_customer_session") || localStorage.getItem("ccrc_customer_user");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.phone ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function setStoredCustomer(cust) {
    if (window.CCRCAuth && typeof window.CCRCAuth.setStoredCustomer === "function") {
      window.CCRCAuth.setStoredCustomer(cust);
      return;
    }
    try {
      if (cust && cust.phone) {
        localStorage.setItem("ccrc_customer_session", JSON.stringify(cust));
        localStorage.setItem("ccrc_customer_phone", cust.phone);
        if (cust.name) localStorage.setItem("ccrc_customer_name", cust.name);
        if (cust.avatar_url) localStorage.setItem("ccrc_customer_avatar", cust.avatar_url);
      } else {
        localStorage.removeItem("ccrc_customer_session");
        localStorage.removeItem("ccrc_customer_user");
        localStorage.removeItem("ccrc_customer_phone");
        localStorage.removeItem("ccrc_customer_name");
        localStorage.removeItem("ccrc_customer_avatar");
      }
    } catch (_) {}
    updateCustomerAuthUI();
  }

  function updateCustomerAuthUI() {
    const cust = getStoredCustomer();
    const custBadge = document.getElementById("booking-cust-auth-badge");
    const regOption = document.getElementById("booking-register-option");
    const nameInput = document.getElementById("customer-name");
    const phoneInput = document.getElementById("customer-phone");

    if (cust && cust.phone) {
      let avatarUrl = cust.avatar_url || "";
      try {
        if (!avatarUrl) avatarUrl = localStorage.getItem("ccrc_customer_avatar") || "";
      } catch (_) {}

      if (custBadge) custBadge.classList.remove("hidden");
      if (regOption) regOption.classList.add("hidden");

      if (nameInput && !nameInput.value) nameInput.value = cust.name || "";
      if (phoneInput && !phoneInput.value) phoneInput.value = cust.phone || "";

      // Logged-in customers: collapse the big Passenger/Sender card into one compact line
      const fullCard = document.querySelector(".customer-info-card");
      const compact = document.getElementById("customer-compact-card");
      const editBtn = document.getElementById("customer-compact-edit");
      if (editBtn && !editBtn.dataset.bound) {
        editBtn.dataset.bound = "1";
        editBtn.addEventListener("click", () => {
          if (compact) { compact.dataset.expanded = "1"; compact.classList.add("hidden"); }
          if (fullCard) fullCard.classList.remove("hidden");
        });
      }
      if (fullCard && compact && !compact.dataset.expanded
          && nameInput && phoneInput && nameInput.value.trim() && phoneInput.value.trim()) {
        const cn = document.getElementById("customer-compact-name");
        const cp = document.getElementById("customer-compact-phone");
        if (cn) cn.textContent = nameInput.value.trim();
        if (cp) cp.textContent = phoneInput.value.trim();
        fullCard.classList.add("hidden");
        compact.classList.remove("hidden");
      }

      // Customer Avatar in Home Card
      const homeImg = document.getElementById("cust-home-avatar-img");
      const homePlaceholder = document.getElementById("cust-home-placeholder");
      if (homeImg && avatarUrl) {
        homeImg.src = avatarUrl;
        homeImg.classList.remove("hidden");
        if (homePlaceholder) homePlaceholder.classList.add("hidden");
      } else if (homePlaceholder) {
        homePlaceholder.classList.remove("hidden");
        if (homeImg) homeImg.classList.add("hidden");
      }

      loadCustomerHomeHistory();
    } else {
      if (custBadge) custBadge.classList.add("hidden");
      if (regOption) regOption.classList.remove("hidden");
      const guestFullCard = document.querySelector(".customer-info-card");
      const guestCompact = document.getElementById("customer-compact-card");
      if (guestFullCard) guestFullCard.classList.remove("hidden");
      if (guestCompact) { guestCompact.classList.add("hidden"); delete guestCompact.dataset.expanded; }
      const historyCard = document.getElementById("customer-home-history-card");
      if (historyCard) historyCard.classList.add("hidden");
    }

    if (window.CCRCAuth && typeof window.CCRCAuth.syncUI === "function") {
      window.CCRCAuth.syncUI();
    }
  }

  // Load Customer Home Booking History & Stats Card (same as Rider)
  async function loadCustomerHomeHistory() {
    const cust = getStoredCustomer();
    const historyCard = document.getElementById("customer-home-history-card");
    if (!historyCard) return;

    if (!cust || !cust.phone) {
      historyCard.classList.add("hidden");
      return;
    }

    try {
      const res = await fetch(`/api/customer/history/${encodeURIComponent(cust.phone)}`);
      if (!res.ok) return;
      const data = await res.json();
      historyCard.classList.remove("hidden");

      const tripsCountEl = document.getElementById("customer-home-trips-count");
      const spentEl = document.getElementById("customer-home-spent-amount");
      const nameEl = document.getElementById("customer-home-name");
      const feedEl = document.getElementById("customer-home-recent-feed");

      const totalTrips = (data.customer && data.customer.total_rides !== undefined && data.customer.total_rides !== null) ? data.customer.total_rides : (data.total_rides !== undefined ? data.total_rides : (data.history ? data.history.length : 0));
      const totalSpent = (data.customer && data.customer.total_spent) ? Number(data.customer.total_spent) : 0;

      if (tripsCountEl) tripsCountEl.textContent = `${totalTrips} trip${totalTrips === 1 ? "" : "s"}`;
      if (spentEl) spentEl.textContent = `₱${totalSpent.toFixed(2)}`;
      if (nameEl) nameEl.textContent = (data.customer && data.customer.name) || cust.name || "Passenger";

      const fetchedAvatar = (data.customer && data.customer.avatar_url) || cust.avatar_url;
      if (fetchedAvatar) {
        try { localStorage.setItem("ccrc_customer_avatar", fetchedAvatar); } catch(_) {}
        const hImg = document.getElementById("cust-home-avatar-img");
        const hPlaceholder = document.getElementById("cust-home-placeholder");
        if (hImg) {
          hImg.src = fetchedAvatar;
          hImg.classList.remove("hidden");
          if (hPlaceholder) hPlaceholder.classList.add("hidden");
        }
      }

      const list = data.history || data.rides || [];
      if (feedEl) {
        if (!list || list.length === 0) {
          feedEl.innerHTML = `
            <div style="padding:12px;text-align:center;color:#94a3b8;font-size:0.82rem;">
              You haven't completed any trips yet. Book a ride now to start your travel record!
            </div>
          `;
        } else {
          feedEl.innerHTML = list.slice(0, 3).map(b => {
            const isCompleted = b.status === 'completed';
            const groupSize = Number(b.group_size || 1);
            const isGroup = Boolean(groupSize > 1 && b.group_code);
            const trackHref = isGroup
              ? `/track/${encodeURIComponent(b.group_code)}?slot=${encodeURIComponent(b.booking_code)}`
              : `/track/${encodeURIComponent(b.booking_code)}`;
            return `
              <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:0.88rem;color:#f8fafc;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:monospace;color:#38bdf8;">${escapeHtml(b.booking_code)}</span>
                    <span class="badge badge-accent" style="font-size:0.7rem;text-transform:uppercase;">${escapeHtml(b.service_type)}</span>
                    ${isGroup ? `<span class="badge" style="background:#1e3a8a;color:#93c5fd;font-size:0.68rem;">👥 ${escapeHtml(b.group_code)} • Slot ${Number(b.rider_slot || 1)}/${groupSize}</span>` : ''}
                  </div>
                  <div style="color:#94a3b8;font-size:0.78rem;margin-top:2px;">
                    🟢 ${escapeHtml(b.pickup_address)} &rarr; 🏁 ${escapeHtml(b.dropoff_address)}
                  </div>
                  <div style="color:#64748b;font-size:0.74rem;margin-top:2px;">
                    ${b.created_at ? b.created_at.slice(0, 16).replace('T', ' ') : ''} ${b.rider_name ? `&bull; Rider: <strong style="color:#cbd5e1;">${escapeHtml(b.rider_name)}</strong>` : ''}
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="color:#4ade80;font-weight:700;font-size:1.05rem;">₱${Math.round(b.fare_amount || 0)}</div>
                  <span class="badge ${isCompleted ? 'badge-success' : 'badge-primary'}" style="font-size:0.7rem;margin-top:2px;">
                    ${escapeHtml(b.status)}
                  </span>
                  <div style="margin-top:4px;">
                    <a href="${trackHref}" class="btn btn-sm" style="font-size:0.72rem;padding:2px 8px;background:#1e293b;color:white;border:1px solid #475569;text-decoration:none;">
                      Receipt 🧾
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    } catch (_) {}
  }

  window.addEventListener("ccrc:customer-auth-changed", updateCustomerAuthUI);

  // Initialize customer session check on load
  updateCustomerAuthUI();
})();
