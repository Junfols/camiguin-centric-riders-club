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

  // Camiguin Master Places Directory (126+ Locations)
  let CAMIGUIN_PLACES = [
  {
    "name": "Petron Gas Station Mambajao (Balbagon)",
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
    "full_address": "Balbagon Highway, Mambajao"
  },
  {
    "name": "Petron Gas Station Poblacion Mambajao",
    "cat": "fuel",
    "keywords": [
      "petron",
      "petron poblacion",
      "gasolinahan",
      "gas station",
      "fuel",
      "gasolina",
      "tubil"
    ],
    "lat": 9.2485,
    "lng": 124.7185,
    "mun": "Mambajao",
    "full_address": "Poblacion Mambajao"
  },
  {
    "name": "Shell Gas Station Mambajao (Tupsan)",
    "cat": "fuel",
    "keywords": [
      "shell",
      "shell mambajao",
      "shell tupsan",
      "gasolinahan",
      "gas station",
      "fuel",
      "gasolina",
      "tubil"
    ],
    "lat": 9.20656,
    "lng": 124.77516,
    "mun": "Mambajao",
    "full_address": "Tupsan Highway, Mambajao"
  },
  {
    "name": "Phoenix Gas Station Mambajao (Lakas)",
    "cat": "fuel",
    "keywords": [
      "phoenix",
      "phoenix mambajao",
      "phoenix lakas",
      "gasolinahan",
      "gas station",
      "fuel",
      "tubil"
    ],
    "lat": 9.249,
    "lng": 124.723,
    "mun": "Mambajao",
    "full_address": "Lakas, Poblacion, Mambajao"
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
    "full_address": "Poblacion Catarman"
  },
  {
    "name": "Petron Gas Station Mahinog (Benoni)",
    "cat": "fuel",
    "keywords": [
      "petron mahinog",
      "petron benoni",
      "gasolinahan",
      "gas station",
      "fuel",
      "tubil"
    ],
    "lat": 9.132,
    "lng": 124.793,
    "mun": "Mahinog",
    "full_address": "Benoni Highway, Mahinog"
  },
  {
    "name": "Highway Fuel Station Agoho",
    "cat": "fuel",
    "keywords": [
      "gasolinahan agoho",
      "gas station agoho",
      "gasolinahan",
      "fuel",
      "tubil"
    ],
    "lat": 9.244,
    "lng": 124.685,
    "mun": "Mambajao",
    "full_address": "Agoho Highway, Mambajao"
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
    "full_address": "General Bonifacio Aranas Street, Poblacion, Mambajao"
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
    "lat": 9.25083,
    "lng": 124.71408,
    "mun": "Mambajao",
    "full_address": "Poblacion Mambajao"
  },
  {
    "name": "Camiguin Polytechnic State College (CPSC / CSU Mambajao)",
    "cat": "school",
    "keywords": [
      "cpsc",
      "csu",
      "camiguin state university",
      "camiguin polytechnic",
      "college",
      "school"
    ],
    "lat": 9.2472,
    "lng": 124.7291,
    "mun": "Mambajao",
    "full_address": "Balbagon, Mambajao"
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
    "lat": 9.11666,
    "lng": 124.68764,
    "mun": "Catarman",
    "full_address": "Catarman"
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
    "lat": 9.1295,
    "lng": 124.67217,
    "mun": "Catarman",
    "full_address": "Catarman"
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
    "lat": 9.24378,
    "lng": 124.66394,
    "mun": "Mambajao",
    "full_address": "Yumbing, Mambajao"
  },
  {
    "name": "Magting Elementary School",
    "cat": "school",
    "keywords": [
      "magting elementary",
      "magting school",
      "school",
      "elementary"
    ],
    "lat": 9.222,
    "lng": 124.762,
    "mun": "Mambajao",
    "full_address": "Magting, Mambajao"
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
    "lat": 9.245,
    "lng": 124.662,
    "mun": "Mambajao",
    "full_address": "Agoho, Mambajao"
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
    "lat": 9.243,
    "lng": 124.738,
    "mun": "Mambajao",
    "full_address": "Balbagon, Mambajao"
  },
  {
    "name": "Catarman Central School",
    "cat": "school",
    "keywords": [
      "catarman central school",
      "catarman elementary",
      "school"
    ],
    "lat": 9.128,
    "lng": 124.645,
    "mun": "Catarman",
    "full_address": "Poblacion Catarman"
  },
  {
    "name": "Mahinog Central School",
    "cat": "school",
    "keywords": [
      "mahinog central school",
      "mahinog school",
      "school"
    ],
    "lat": 9.153,
    "lng": 124.785,
    "mun": "Mahinog",
    "full_address": "Poblacion Mahinog"
  },
  {
    "name": "Sagay Central School",
    "cat": "school",
    "keywords": [
      "sagay central school",
      "sagay school",
      "school"
    ],
    "lat": 9.102,
    "lng": 124.721,
    "mun": "Sagay",
    "full_address": "Poblacion Sagay"
  },
  {
    "name": "Guinsiliban Central School",
    "cat": "school",
    "keywords": [
      "guinsiliban central school",
      "guinsiliban school",
      "school"
    ],
    "lat": 9.094,
    "lng": 124.778,
    "mun": "Guinsiliban",
    "full_address": "Poblacion Guinsiliban"
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
    "lat": 9.2514,
    "lng": 124.717,
    "mun": "Mambajao",
    "full_address": "Poblacion Mambajao"
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
    "full_address": "Poblacion Mambajao"
  },
  {
    "name": "Iglesia Ni Cristo (INC), Mambajao",
    "cat": "church",
    "keywords": [
      "inc",
      "iglesia ni cristo",
      "iglesia",
      "church"
    ],
    "lat": 9.23866,
    "lng": 124.65569,
    "mun": "Mambajao",
    "full_address": "Mambajao"
  },
  {
    "name": "San Roque Parish Church, Mahinog",
    "cat": "church",
    "keywords": [
      "san roque parish",
      "mahinog church",
      "simbahan sa mahinog",
      "catholic church",
      "church"
    ],
    "lat": 9.1532,
    "lng": 124.785,
    "mun": "Mahinog",
    "full_address": "Poblacion Mahinog"
  },
  {
    "name": "San Antonio de Padua Parish Church, Bonbon",
    "cat": "church",
    "keywords": [
      "san antonio parish",
      "bonbon church",
      "catarman church",
      "church"
    ],
    "lat": 9.207,
    "lng": 124.632,
    "mun": "Catarman",
    "full_address": "Bonbon, Catarman"
  },
  {
    "name": "Our Lady of Mount Carmel Parish Church, Catarman",
    "cat": "church",
    "keywords": [
      "catarman parish",
      "mount carmel church",
      "simbahan sa catarman",
      "church"
    ],
    "lat": 9.1282,
    "lng": 124.6448,
    "mun": "Catarman",
    "full_address": "Poblacion Catarman"
  },
  {
    "name": "Holy Rosary Parish Church, Sagay",
    "cat": "church",
    "keywords": [
      "sagay parish",
      "holy rosary church",
      "simbahan sa sagay",
      "church"
    ],
    "lat": 9.1022,
    "lng": 124.7212,
    "mun": "Sagay",
    "full_address": "Poblacion Sagay"
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
    "lat": 9.0942,
    "lng": 124.7782,
    "mun": "Guinsiliban",
    "full_address": "Poblacion Guinsiliban"
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
    "lat": 9.2415,
    "lng": 124.691,
    "mun": "Mambajao",
    "full_address": "Baylao, Mambajao"
  },
  {
    "name": "Moonflower Garden and Restaurant, Baylao",
    "cat": "food",
    "keywords": [
      "moonflower",
      "moonflower garden",
      "moonflower restaurant",
      "moonflower garden and restaurant",
      "moonflower gardern and restaurant",
      "moonflower gardern",
      "moonflower baylao",
      "moonflower garden baylao",
      "baylao moonflower",
      "baylao restaurant",
      "ice cream",
      "restaurant baylao",
      "food",
      "resto",
      "restaurant"
    ],
    "lat": 9.25057,
    "lng": 124.7011,
    "mun": "Mambajao",
    "full_address": "Baylao, Mambajao, Camiguin"
  },
  {
    "name": "Samuel Restaurant, Mambajao",
    "cat": "food",
    "keywords": [
      "samuel",
      "samuel restaurant",
      "placido reyes",
      "resto",
      "restaurant",
      "food"
    ],
    "lat": 9.2528,
    "lng": 124.71574,
    "mun": "Mambajao",
    "full_address": "Placido Reyes Street, Poblacion, Mambajao"
  },
  {
    "name": "Kurma Eco Restaurant & Cafe, Yumbing",
    "cat": "food",
    "keywords": [
      "kurma",
      "kurma cafe",
      "kurma restaurant",
      "yumbing",
      "cafe",
      "food"
    ],
    "lat": 9.24144,
    "lng": 124.65996,
    "mun": "Mambajao",
    "full_address": "Yumbing, Mambajao"
  },
  {
    "name": "Julie's Bakeshop, Mambajao",
    "cat": "food",
    "keywords": [
      "julies",
      "julies bakeshop",
      "tinapay",
      "bakery",
      "bakeshop"
    ],
    "lat": 9.25188,
    "lng": 124.71615,
    "mun": "Mambajao",
    "full_address": "Poblacion Mambajao"
  },
  {
    "name": "Goldilocks Bakeshop, Mambajao",
    "cat": "food",
    "keywords": [
      "goldilocks",
      "goldilocks mambajao",
      "cake",
      "bakeshop",
      "bakery"
    ],
    "lat": 9.2518,
    "lng": 124.7167,
    "mun": "Mambajao",
    "full_address": "Poblacion Mambajao"
  },
  {
    "name": "CheckPoint Food Park, Mambajao",
    "cat": "food",
    "keywords": [
      "checkpoint",
      "checkpoint food park",
      "food park",
      "restaurant",
      "food"
    ],
    "lat": 9.24227,
    "lng": 124.6634,
    "mun": "Mambajao",
    "full_address": "Agoho / Yumbing Highway, Mambajao"
  },
  {
    "name": "Gaisano Capital Camiguin (Placido Reyes St)",
    "cat": "supermarket",
    "keywords": [
      "gaisano",
      "gaisano capital",
      "placido reyes",
      "p. reyes",
      "placido reyes street",
      "gaisano camiguin",
      "mall",
      "supermarket",
      "grocery"
    ],
    "lat": 9.25290,
    "lng": 124.71613,
    "mun": "Mambajao",
    "full_address": "Placido Reyes Street, Mabini, Poblacion, Mambajao"
  },
  {
    "name": "Placido Reyes Street, Mambajao",
    "cat": "street",
    "keywords": [
      "placido reyes",
      "placido reyes street",
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
      "jollibee street",
      "burgos st"
    ],
    "lat": 9.25058,
    "lng": 124.71712,
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
      "aranas"
    ],
    "lat": 9.24931,
    "lng": 124.71982,
    "mun": "Mambajao",
    "full_address": "General Bonifacio Aranas Street, Poblacion, Mambajao"
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
    "lat": 9.25411,
    "lng": 124.71813,
    "mun": "Mambajao",
    "full_address": "Plaridel Street, Lagundi, Poblacion, Mambajao"
  },
  {
    "name": "Rizal Street, Mambajao",
    "cat": "street",
    "keywords": [
      "rizal",
      "rizal street",
      "j.p. rizal",
      "rizal st"
    ],
    "lat": 9.24673,
    "lng": 124.71578,
    "mun": "Mambajao",
    "full_address": "Rizal Street, Poblacion, Mambajao"
  },
  {
    "name": "Mabini Street, Mambajao",
    "cat": "street",
    "keywords": [
      "mabini",
      "mabini street",
      "mabini st"
    ],
    "lat": 9.24477,
    "lng": 124.71328,
    "mun": "Mambajao",
    "full_address": "Mabini Street, Poblacion, Mambajao"
  },
  {
    "name": "Davilett Store & Supermarket, Mambajao",
    "cat": "supermarket",
    "keywords": [
      "davilett",
      "davilet",
      "davi",
      "supermarket",
      "grocery"
    ],
    "lat": 9.2518,
    "lng": 124.7167,
    "mun": "Mambajao"
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
    "lat": 9.2516,
    "lng": 124.7166,
    "mun": "Mambajao"
  },
  {
    "name": "Prince Hypermart Camiguin",
    "cat": "supermarket",
    "keywords": [
      "prince hypermart",
      "prince",
      "hypermart"
    ],
    "lat": 9.2495,
    "lng": 124.718,
    "mun": "Mambajao"
  },
  {
    "name": "7-Eleven Mambajao Town Center",
    "cat": "store",
    "keywords": [
      "7-eleven",
      "7-11",
      "711",
      "seven eleven",
      "convenience store"
    ],
    "lat": 9.2505,
    "lng": 124.7165,
    "mun": "Mambajao"
  },
  {
    "name": "7-Eleven Balbagon Port Branch",
    "cat": "store",
    "keywords": [
      "7-eleven balbagon",
      "711 balbagon",
      "7 eleven port"
    ],
    "lat": 9.2558,
    "lng": 124.7169,
    "mun": "Mambajao"
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
    "mun": "Mambajao"
  },
  {
    "name": "Rose Pharmacy Mambajao",
    "cat": "pharmacy",
    "keywords": [
      "rose pharmacy",
      "rose",
      "pharmacy",
      "botika",
      "tambal"
    ],
    "lat": 9.252,
    "lng": 124.7165,
    "mun": "Mambajao"
  },
  {
    "name": "Julies Bakeshop Mambajao",
    "cat": "store",
    "keywords": [
      "julies",
      "julies bakeshop",
      "bakeshop",
      "panaderia",
      "tinapay"
    ],
    "lat": 9.251,
    "lng": 124.7166,
    "mun": "Mambajao"
  },
  {
    "name": "Chooks to Go Mambajao",
    "cat": "food",
    "keywords": [
      "chooks",
      "chooks to go",
      "manok",
      "lechon manok"
    ],
    "lat": 9.2508,
    "lng": 124.7167,
    "mun": "Mambajao"
  },
  {
    "name": "Andoks Litson Mambajao",
    "cat": "food",
    "keywords": [
      "andoks",
      "andok",
      "litson manok"
    ],
    "lat": 9.2506,
    "lng": 124.7168,
    "mun": "Mambajao"
  },
  {
    "name": "Dunkin Donuts Camiguin",
    "cat": "food",
    "keywords": [
      "dunkin",
      "donuts",
      "dunkin donuts"
    ],
    "lat": 9.2502,
    "lng": 124.7166,
    "mun": "Mambajao"
  },
  {
    "name": "Mambajao Public Market",
    "cat": "market",
    "keywords": [
      "mambajao market",
      "public market",
      "merkado",
      "palengke",
      "wet market",
      "isda",
      "karne",
      "utanon"
    ],
    "lat": 9.25319,
    "lng": 124.7166,
    "mun": "Mambajao"
  },
  {
    "name": "Mahinog Public Market",
    "cat": "market",
    "keywords": [
      "mahinog market",
      "merkado mahinog",
      "palengke mahinog"
    ],
    "lat": 9.1535,
    "lng": 124.7852,
    "mun": "Mahinog"
  },
  {
    "name": "Catarman Public Market",
    "cat": "market",
    "keywords": [
      "catarman market",
      "merkado catarman",
      "palengke catarman"
    ],
    "lat": 9.1275,
    "lng": 124.6455,
    "mun": "Catarman"
  },
  {
    "name": "Sagay Public Market",
    "cat": "market",
    "keywords": [
      "sagay market",
      "merkado sagay",
      "palengke sagay"
    ],
    "lat": 9.1025,
    "lng": 124.7205,
    "mun": "Sagay"
  },
  {
    "name": "Guinsiliban Public Market",
    "cat": "market",
    "keywords": [
      "guinsiliban market",
      "merkado guinsiliban",
      "palengke guinsiliban"
    ],
    "lat": 9.0938,
    "lng": 124.7778,
    "mun": "Guinsiliban"
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
    "mun": "Mambajao"
  },
  {
    "name": "Checkpoint Food Park, Mambajao",
    "cat": "food",
    "keywords": [
      "checkpoint",
      "food park",
      "resto bar",
      "kaonan"
    ],
    "lat": 9.2499,
    "lng": 124.7182,
    "mun": "Mambajao"
  },
  {
    "name": "Hayahay Cafe & Restaurant",
    "cat": "food",
    "keywords": [
      "hayahay cafe",
      "hayahay",
      "cafe"
    ],
    "lat": 9.2512,
    "lng": 124.672,
    "mun": "Mambajao"
  },
  {
    "name": "Casa Roces / Guerrera Restaurant, Yumbing",
    "cat": "food",
    "keywords": [
      "guerrera",
      "casa roces",
      "asian food",
      "rice paddy"
    ],
    "lat": 9.2548,
    "lng": 124.6475,
    "mun": "Mambajao"
  },
  {
    "name": "Northern Lights Cafe, Agoho",
    "cat": "food",
    "keywords": [
      "northern lights",
      "cafe",
      "kape"
    ],
    "lat": 9.246,
    "lng": 124.661,
    "mun": "Mambajao"
  },
  {
    "name": "La Dolce Vita Italian Pizza, Agoho",
    "cat": "food",
    "keywords": [
      "la dolce vita",
      "pizza",
      "italian",
      "pasta"
    ],
    "lat": 9.2455,
    "lng": 124.6615,
    "mun": "Mambajao"
  },
  {
    "name": "Penongs Barbeque Mambajao",
    "cat": "food",
    "keywords": [
      "penongs",
      "penong",
      "bbq",
      "chicken bbq",
      "inasal"
    ],
    "lat": 9.2496,
    "lng": 124.7172,
    "mun": "Mambajao"
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
    "mun": "Mambajao"
  },
  {
    "name": "Mambajao Town Plaza / Municipal Hall",
    "cat": "building",
    "keywords": [
      "mambajao plaza",
      "plaza",
      "municipal hall",
      "munisipyo",
      "mayor"
    ],
    "lat": 9.2515,
    "lng": 124.7168,
    "mun": "Mambajao"
  },
  {
    "name": "Camiguin General Hospital (CGH)",
    "cat": "hospital",
    "keywords": [
      "hospital",
      "cgh",
      "clinic",
      "doktor",
      "emergency",
      "pagamutan"
    ],
    "lat": 9.24847,
    "lng": 124.72159,
    "mun": "Mambajao"
  },
  {
    "name": "Mahinog Municipal Hall",
    "cat": "building",
    "keywords": [
      "munisipyo mahinog",
      "mahinog hall",
      "mayor mahinog"
    ],
    "lat": 9.1532,
    "lng": 124.785,
    "mun": "Mahinog"
  },
  {
    "name": "Catarman Municipal Hall",
    "cat": "building",
    "keywords": [
      "munisipyo catarman",
      "catarman hall",
      "mayor catarman"
    ],
    "lat": 9.1282,
    "lng": 124.6448,
    "mun": "Catarman"
  },
  {
    "name": "Sagay Municipal Hall",
    "cat": "building",
    "keywords": [
      "munisipyo sagay",
      "sagay hall",
      "mayor sagay"
    ],
    "lat": 9.1022,
    "lng": 124.7212,
    "mun": "Sagay"
  },
  {
    "name": "Guinsiliban Municipal Hall",
    "cat": "building",
    "keywords": [
      "munisipyo guinsiliban",
      "guinsiliban hall"
    ],
    "lat": 9.0942,
    "lng": 124.7782,
    "mun": "Guinsiliban"
  },
  {
    "name": "Camiguin Polytechnic State College (CPSC)",
    "cat": "school",
    "keywords": [
      "cpsc",
      "polytechnic",
      "college",
      "state college",
      "eskwela"
    ],
    "lat": 9.252,
    "lng": 124.711,
    "mun": "Mambajao"
  },
  {
    "name": "Fatima College of Camiguin",
    "cat": "school",
    "keywords": [
      "fatima college",
      "fcc",
      "fatima"
    ],
    "lat": 9.2522,
    "lng": 124.7145,
    "mun": "Mambajao"
  },
  {
    "name": "Camiguin Provincial Police Office",
    "cat": "building",
    "keywords": [
      "police",
      "pnp",
      "pulis",
      "police station",
      "istasyon"
    ],
    "lat": 9.2489,
    "lng": 124.7225,
    "mun": "Mambajao"
  },
  {
    "name": "Balbagon Port (FastCat & Ferry Wharf)",
    "cat": "transport",
    "keywords": [
      "balbagon port",
      "balbagon",
      "fastcat",
      "super shuttle",
      "ferry",
      "barko",
      "pantalan",
      "pantalan balbagon"
    ],
    "lat": 9.2561,
    "lng": 124.7175,
    "mun": "Mambajao"
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
      "terminal",
      "passenger",
      "benoni port",
      "pantalan benoni",
      "ferry terminal",
      "wharf",
      "port",
      "pantalan",
      "transport"
    ],
    "lat": 9.1306,
    "lng": 124.7937,
    "mun": "Mahinog",
    "full_address": "Benoni Port, Mahinog, Camiguin"
  },
  {
    "name": "Benoni Port / Ferry Wharf, Mahinog",
    "cat": "transport",
    "keywords": [
      "benoni port",
      "benoni passenger terminal",
      "benoni terminal",
      "passenger terminal",
      "benoni",
      "wharf",
      "port",
      "pantalan",
      "ferry mahinog",
      "barko benoni",
      "pantalan benoni"
    ],
    "lat": 9.1306,
    "lng": 124.7937,
    "mun": "Mahinog"
  },
  {
    "name": "Guinsiliban Port / Ferry Terminal",
    "cat": "transport",
    "keywords": [
      "guinsiliban port",
      "pantalan guinsiliban",
      "ferry guinsiliban"
    ],
    "lat": 9.0925,
    "lng": 124.7815,
    "mun": "Guinsiliban"
  },
  {
    "name": "Camiguin Airport",
    "cat": "transport",
    "keywords": [
      "airport",
      "camiguin airport",
      "tugpahanan",
      "eroplano",
      "flight"
    ],
    "lat": 9.253,
    "lng": 124.7061,
    "mun": "Mambajao"
  },
  {
    "name": "White Island Boat Jump-off, Yumbing",
    "cat": "tourist",
    "keywords": [
      "white island",
      "white island boat",
      "jump-off",
      "medano",
      "island"
    ],
    "lat": 9.2538,
    "lng": 124.6532,
    "mun": "Mambajao"
  },
  {
    "name": "Mantigue Island Boat Station, San Roque",
    "cat": "tourist",
    "keywords": [
      "mantigue island",
      "mantigue",
      "boat station",
      "san roque mantigue"
    ],
    "lat": 9.172,
    "lng": 124.785,
    "mun": "Mahinog"
  },
  {
    "name": "Katibawasan Falls",
    "cat": "tourist",
    "keywords": [
      "katibawasan falls",
      "katibawasan",
      "busay",
      "waterfall"
    ],
    "lat": 9.2152,
    "lng": 124.7188,
    "mun": "Mambajao"
  },
  {
    "name": "Tuasan Falls, Mainit, Catarman",
    "cat": "tourist",
    "keywords": [
      "tuasan falls",
      "tuasan",
      "busay catarman"
    ],
    "lat": 9.17,
    "lng": 124.675,
    "mun": "Catarman"
  },
  {
    "name": "Ardent Hot Spring, Esperanza",
    "cat": "tourist",
    "keywords": [
      "ardent hot spring",
      "ardent",
      "hot spring",
      "esperanza hot spring"
    ],
    "lat": 9.238,
    "lng": 124.661,
    "mun": "Mambajao"
  },
  {
    "name": "Sto. Ni\u00f1o Cold Spring, Catarman",
    "cat": "tourist",
    "keywords": [
      "cold spring",
      "sto nino",
      "sto. nino",
      "sto ni\u00f1o",
      "bugnaw spring"
    ],
    "lat": 9.155,
    "lng": 124.655,
    "mun": "Catarman"
  },
  {
    "name": "Bura Soda Water Park, Catarman",
    "cat": "tourist",
    "keywords": [
      "soda water",
      "bura soda",
      "soda swimming",
      "bura"
    ],
    "lat": 9.182,
    "lng": 124.638,
    "mun": "Catarman"
  },
  {
    "name": "Sunken Cemetery & Giant Cross, Bonbon",
    "cat": "tourist",
    "keywords": [
      "sunken cemetery",
      "sunken",
      "giant cross",
      "lubnganan",
      "krus"
    ],
    "lat": 9.201,
    "lng": 124.63,
    "mun": "Catarman"
  },
  {
    "name": "Old Church Ruins (Gui-ob Church), Bonbon",
    "cat": "tourist",
    "keywords": [
      "church ruins",
      "guiob",
      "gui-ob",
      "old church",
      "simbahan"
    ],
    "lat": 9.205,
    "lng": 124.632,
    "mun": "Catarman"
  },
  {
    "name": "Mount Vulcan Daan / Walkway to Old Volcano",
    "cat": "tourist",
    "keywords": [
      "vulcan daan",
      "old volcano",
      "walkway",
      "via crucis"
    ],
    "lat": 9.2085,
    "lng": 124.635,
    "mun": "Catarman"
  },
  {
    "name": "Mount Hibok-Hibok Base Jump-off",
    "cat": "tourist",
    "keywords": [
      "hibok-hibok",
      "hibok hibok",
      "volcano hike"
    ],
    "lat": 9.203,
    "lng": 124.671,
    "mun": "Mambajao"
  },
  {
    "name": "Giant Clam Sanctuary, Cantaan",
    "cat": "tourist",
    "keywords": [
      "giant clam",
      "clam sanctuary",
      "cantaan",
      "taklobo"
    ],
    "lat": 9.081,
    "lng": 124.786,
    "mun": "Guinsiliban"
  },
  {
    "name": "Taguines Lagoon & Zipline, Benoni",
    "cat": "tourist",
    "keywords": [
      "taguines lagoon",
      "taguines",
      "zipline"
    ],
    "lat": 9.129,
    "lng": 124.791,
    "mun": "Mahinog"
  },
  {
    "name": "Katunggan Mangrove Park, Mahinog",
    "cat": "tourist",
    "keywords": [
      "katunggan",
      "mangrove park",
      "bakawan"
    ],
    "lat": 9.135,
    "lng": 124.792,
    "mun": "Mahinog"
  },
  {
    "name": "Paras Beach Resort, Yumbing",
    "cat": "resort",
    "keywords": [
      "paras beach",
      "paras resort",
      "paras",
      "hotel"
    ],
    "lat": 9.2553,
    "lng": 124.6468,
    "mun": "Mambajao"
  },
  {
    "name": "Balyali Beach Resort, Yumbing",
    "cat": "resort",
    "keywords": [
      "balyali resort",
      "balyali",
      "beach resort"
    ],
    "lat": 9.2588,
    "lng": 124.6432,
    "mun": "Mambajao"
  },
  {
    "name": "Tongatok Cliff Resort, Yumbing",
    "cat": "resort",
    "keywords": [
      "tongatok cliff",
      "tongatok",
      "cliff resort"
    ],
    "lat": 9.2505,
    "lng": 124.6341,
    "mun": "Mambajao"
  },
  {
    "name": "Lanzones Resort, Baylao, Mambajao",
    "cat": "resort",
    "keywords": [
      "lanzones resort",
      "lanzones",
      "resort baylao"
    ],
    "lat": 9.239,
    "lng": 124.697,
    "mun": "Mambajao"
  },
  {
    "name": "Camiguin Highland Resort, Soro-soro",
    "cat": "resort",
    "keywords": [
      "highland resort",
      "highland",
      "sorosoro",
      "soro-soro",
      "soro'soro"
    ],
    "lat": 9.231,
    "lng": 124.689,
    "mun": "Mambajao"
  },
  {
    "name": "Somewhere Else Boutique Resort, Agoho",
    "cat": "resort",
    "keywords": [
      "somewhere else",
      "boutique resort"
    ],
    "lat": 9.2458,
    "lng": 124.6625,
    "mun": "Mambajao"
  },
  {
    "name": "Balerin Beach Resort, Agoho",
    "cat": "resort",
    "keywords": [
      "balerin",
      "balerin resort"
    ],
    "lat": 9.2445,
    "lng": 124.663,
    "mun": "Mambajao"
  },
  {
    "name": "Pabua's Cottages, Yumbing",
    "cat": "resort",
    "keywords": [
      "pabuas",
      "pabua",
      "cottages"
    ],
    "lat": 9.254,
    "lng": 124.646,
    "mun": "Mambajao"
  },
  {
    "name": "Medano Island Resort, Yumbing",
    "cat": "resort",
    "keywords": [
      "medano",
      "medano resort"
    ],
    "lat": 9.2565,
    "lng": 124.645,
    "mun": "Mambajao"
  },
  {
    "name": "Agoho, Mambajao",
    "cat": "barangay",
    "keywords": [
      "agoho",
      "brgy agoho",
      "barangay agoho"
    ],
    "lat": 9.245,
    "lng": 124.662,
    "mun": "Mambajao"
  },
  {
    "name": "Anito, Mambajao",
    "cat": "barangay",
    "keywords": [
      "anito",
      "brgy anito",
      "barangay anito"
    ],
    "lat": 9.2296,
    "lng": 124.7444,
    "mun": "Mambajao"
  },
  {
    "name": "Balbagon, Mambajao",
    "cat": "barangay",
    "keywords": [
      "balbagon",
      "brgy balbagon",
      "barangay balbagon"
    ],
    "lat": 9.254,
    "lng": 124.714,
    "mun": "Mambajao"
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
    "lat": 9.2415,
    "lng": 124.691,
    "mun": "Mambajao"
  },
  {
    "name": "Benhaan, Mambajao",
    "cat": "barangay",
    "keywords": [
      "benhaan",
      "brgy benhaan",
      "barangay benhaan"
    ],
    "lat": 9.2032,
    "lng": 124.7677,
    "mun": "Mambajao"
  },
  {
    "name": "Bug-ong, Mambajao",
    "cat": "barangay",
    "keywords": [
      "bug-ong",
      "bugong",
      "brgy bug-ong",
      "barangay bugong"
    ],
    "lat": 9.253,
    "lng": 124.639,
    "mun": "Mambajao"
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
    "lat": 9.249,
    "lng": 124.685,
    "mun": "Mambajao"
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
    "lat": 9.2189,
    "lng": 124.756,
    "mun": "Mambajao"
  },
  {
    "name": "Magting Elementary School, Mambajao",
    "cat": "school",
    "keywords": [
      "magting elementary",
      "magting school",
      "es magting"
    ],
    "lat": 9.2242,
    "lng": 124.7514,
    "mun": "Mambajao"
  },
  {
    "name": "Naasag, Mambajao",
    "cat": "barangay",
    "keywords": [
      "naasag",
      "brgy naasag",
      "barangay naasag"
    ],
    "lat": 9.251,
    "lng": 124.628,
    "mun": "Mambajao"
  },
  {
    "name": "Pandayan, Mambajao",
    "cat": "barangay",
    "keywords": [
      "pandayan",
      "brgy pandayan",
      "barangay pandayan",
      "pandayan mambajao"
    ],
    "lat": 9.247,
    "lng": 124.708,
    "mun": "Mambajao"
  },
  {
    "name": "Boloc-boloc, Mambajao",
    "cat": "barangay",
    "keywords": [
      "boloc boloc",
      "boloc-boloc",
      "bolocboloc",
      "bolok bolok",
      "bolok-bolok",
      "bolokbolok",
      "boloc",
      "bolok",
      "sitio boloc-boloc",
      "sitio boloc boloc",
      "boloc boloc mambajao",
      "bolocboloc mambajao",
      "poblacion boloc boloc"
    ],
    "lat": 9.25725,
    "lng": 124.70658,
    "mun": "Mambajao",
    "full_address": "Sitio Boloc-boloc, Poblacion, Mambajao, Camiguin"
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
      "spring"
    ],
    "lat": 9.2211,
    "lng": 124.7034,
    "mun": "Mambajao",
    "full_address": "Quipasa, Mambajao, Camiguin"
  },
  {
    "name": "Poblacion, Mambajao",
    "cat": "barangay",
    "keywords": [
      "poblacion mambajao",
      "poblacion",
      "centro mambajao",
      "mambajao proper"
    ],
    "lat": 9.25405,
    "lng": 124.71636,
    "mun": "Mambajao"
  },
  {
    "name": "Soro-soro, Mambajao",
    "cat": "barangay",
    "keywords": [
      "soro-soro",
      "sorosoro",
      "soro soro",
      "brgy sorosoro"
    ],
    "lat": 9.231,
    "lng": 124.689,
    "mun": "Mambajao"
  },
  {
    "name": "Tagdo, Mambajao",
    "cat": "barangay",
    "keywords": [
      "tagdo",
      "brgy tagdo",
      "barangay tagdo"
    ],
    "lat": 9.238,
    "lng": 124.682,
    "mun": "Mambajao"
  },
  {
    "name": "Tupsan, Mambajao",
    "cat": "barangay",
    "keywords": [
      "tupsan",
      "tupsan mambajao",
      "brgy tupsan"
    ],
    "lat": 9.2019,
    "lng": 124.7774,
    "mun": "Mambajao"
  },
  {
    "name": "Yumbing, Mambajao",
    "cat": "barangay",
    "keywords": [
      "yumbing",
      "brgy yumbing",
      "barangay yumbing"
    ],
    "lat": 9.2553,
    "lng": 124.6468,
    "mun": "Mambajao"
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
    "lat": 9.1306,
    "lng": 124.7937,
    "mun": "Mahinog"
  },
  {
    "name": "Binitinan, Mahinog",
    "cat": "barangay",
    "keywords": [
      "binitinan",
      "brgy binitinan",
      "barangay binitinan",
      "binitinan mahinog"
    ],
    "lat": 9.16,
    "lng": 124.765,
    "mun": "Mahinog"
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
    "lat": 9.162,
    "lng": 124.778,
    "mun": "Mahinog"
  },
  {
    "name": "Hubangon, Mahinog",
    "cat": "barangay",
    "keywords": [
      "hubangon",
      "brgy hubangon",
      "barangay hubangon"
    ],
    "lat": 9.168,
    "lng": 124.776,
    "mun": "Mahinog"
  },
  {
    "name": "Owakan, Mahinog",
    "cat": "barangay",
    "keywords": [
      "owakan",
      "brgy owakan",
      "barangay owakan"
    ],
    "lat": 9.151,
    "lng": 124.774,
    "mun": "Mahinog"
  },
  {
    "name": "Poblacion, Mahinog",
    "cat": "barangay",
    "keywords": [
      "poblacion mahinog",
      "mahinog centro",
      "centro mahinog",
      "mahinog proper"
    ],
    "lat": 9.153,
    "lng": 124.785,
    "mun": "Mahinog"
  },
  {
    "name": "Puntod, Mahinog",
    "cat": "barangay",
    "keywords": [
      "puntod",
      "brgy puntod",
      "barangay puntod"
    ],
    "lat": 9.146,
    "lng": 124.781,
    "mun": "Mahinog"
  },
  {
    "name": "San Isidro, Mahinog",
    "cat": "barangay",
    "keywords": [
      "san isidro",
      "san isidro mahinog",
      "brgy san isidro"
    ],
    "lat": 9.165,
    "lng": 124.768,
    "mun": "Mahinog"
  },
  {
    "name": "San Jose, Mahinog",
    "cat": "barangay",
    "keywords": [
      "san jose",
      "san jose mahinog",
      "brgy san jose"
    ],
    "lat": 9.158,
    "lng": 124.771,
    "mun": "Mahinog"
  },
  {
    "name": "San Miguel, Mahinog",
    "cat": "barangay",
    "keywords": [
      "san miguel",
      "san miguel mahinog",
      "brgy san miguel"
    ],
    "lat": 9.17,
    "lng": 124.779,
    "mun": "Mahinog"
  },
  {
    "name": "San Roque, Mahinog",
    "cat": "barangay",
    "keywords": [
      "san roque",
      "san roque mahinog",
      "brgy san roque"
    ],
    "lat": 9.172,
    "lng": 124.785,
    "mun": "Mahinog"
  },
  {
    "name": "Tubod, Mahinog",
    "cat": "barangay",
    "keywords": [
      "tubod",
      "tubod mahinog",
      "brgy tubod"
    ],
    "lat": 9.16,
    "lng": 124.775,
    "mun": "Mahinog"
  },
  {
    "name": "Tupsan Peque\u00f1o, Mahinog",
    "cat": "barangay",
    "keywords": [
      "tupsan pequeno",
      "tupsan pequeo",
      "tupsan mahinog"
    ],
    "lat": 9.185,
    "lng": 124.75,
    "mun": "Mahinog"
  },
  {
    "name": "Alangilan, Catarman",
    "cat": "barangay",
    "keywords": [
      "alangilan catarman",
      "brgy alangilan catarman"
    ],
    "lat": 9.158,
    "lng": 124.638,
    "mun": "Catarman"
  },
  {
    "name": "Biga, Catarman",
    "cat": "barangay",
    "keywords": [
      "biga",
      "brgy biga",
      "barangay biga",
      "biga catarman"
    ],
    "lat": 9.138,
    "lng": 124.642,
    "mun": "Catarman"
  },
  {
    "name": "Bonbon, Catarman",
    "cat": "barangay",
    "keywords": [
      "bonbon",
      "bonbon catarman",
      "brgy bonbon"
    ],
    "lat": 9.201,
    "lng": 124.63,
    "mun": "Catarman"
  },
  {
    "name": "Bura, Catarman",
    "cat": "barangay",
    "keywords": [
      "bura",
      "bura catarman",
      "brgy bura"
    ],
    "lat": 9.182,
    "lng": 124.638,
    "mun": "Catarman"
  },
  {
    "name": "Catibac, Catarman",
    "cat": "barangay",
    "keywords": [
      "catibac",
      "brgy catibac",
      "barangay catibac"
    ],
    "lat": 9.165,
    "lng": 124.642,
    "mun": "Catarman"
  },
  {
    "name": "Compol, Catarman",
    "cat": "barangay",
    "keywords": [
      "compol",
      "brgy compol",
      "barangay compol"
    ],
    "lat": 9.145,
    "lng": 124.643,
    "mun": "Catarman"
  },
  {
    "name": "Lawigan, Catarman",
    "cat": "barangay",
    "keywords": [
      "lawigan",
      "brgy lawigan",
      "barangay lawigan"
    ],
    "lat": 9.135,
    "lng": 124.641,
    "mun": "Catarman"
  },
  {
    "name": "Licoan, Catarman",
    "cat": "barangay",
    "keywords": [
      "licoan",
      "brgy licoan",
      "barangay licoan",
      "licoan catarman"
    ],
    "lat": 9.142,
    "lng": 124.644,
    "mun": "Catarman"
  },
  {
    "name": "Mainit, Catarman",
    "cat": "barangay",
    "keywords": [
      "mainit",
      "mainit catarman",
      "brgy mainit"
    ],
    "lat": 9.168,
    "lng": 124.665,
    "mun": "Catarman"
  },
  {
    "name": "Mandawa, Catarman",
    "cat": "barangay",
    "keywords": [
      "mandawa",
      "brgy mandawa",
      "barangay mandawa"
    ],
    "lat": 9.15,
    "lng": 124.643,
    "mun": "Catarman"
  },
  {
    "name": "Panghiawan, Catarman",
    "cat": "barangay",
    "keywords": [
      "panghiawan",
      "brgy panghiawan",
      "barangay panghiawan"
    ],
    "lat": 9.115,
    "lng": 124.652,
    "mun": "Catarman"
  },
  {
    "name": "Poblacion, Catarman",
    "cat": "barangay",
    "keywords": [
      "poblacion catarman",
      "catarman centro",
      "centro catarman",
      "catarman proper"
    ],
    "lat": 9.128,
    "lng": 124.645,
    "mun": "Catarman"
  },
  {
    "name": "Santo Ni\u00f1o, Catarman",
    "cat": "barangay",
    "keywords": [
      "santo nino",
      "santo nio",
      "sto nino catarman",
      "brgy sto nino"
    ],
    "lat": 9.155,
    "lng": 124.655,
    "mun": "Catarman"
  },
  {
    "name": "Tangaro, Catarman",
    "cat": "barangay",
    "keywords": [
      "tangaro",
      "brgy tangaro",
      "barangay tangaro"
    ],
    "lat": 9.122,
    "lng": 124.648,
    "mun": "Catarman"
  },
  {
    "name": "Alangilan, Sagay",
    "cat": "barangay",
    "keywords": [
      "alangilan sagay",
      "brgy alangilan sagay"
    ],
    "lat": 9.095,
    "lng": 124.708,
    "mun": "Sagay"
  },
  {
    "name": "Bacnit, Sagay",
    "cat": "barangay",
    "keywords": [
      "bacnit",
      "brgy bacnit",
      "barangay bacnit"
    ],
    "lat": 9.112,
    "lng": 124.735,
    "mun": "Sagay"
  },
  {
    "name": "Balite, Sagay",
    "cat": "barangay",
    "keywords": [
      "balite",
      "balite sagay",
      "brgy balite"
    ],
    "lat": 9.098,
    "lng": 124.715,
    "mun": "Sagay"
  },
  {
    "name": "Bonbon, Sagay",
    "cat": "barangay",
    "keywords": [
      "bonbon sagay",
      "brgy bonbon sagay"
    ],
    "lat": 9.108,
    "lng": 124.718,
    "mun": "Sagay"
  },
  {
    "name": "Bugang, Sagay",
    "cat": "barangay",
    "keywords": [
      "bugang",
      "brgy bugang",
      "barangay bugang"
    ],
    "lat": 9.108,
    "lng": 124.728,
    "mun": "Sagay"
  },
  {
    "name": "Cuna, Sagay",
    "cat": "barangay",
    "keywords": [
      "cuna",
      "brgy cuna",
      "barangay cuna"
    ],
    "lat": 9.105,
    "lng": 124.719,
    "mun": "Sagay"
  },
  {
    "name": "Manuyog, Sagay",
    "cat": "barangay",
    "keywords": [
      "manuyog",
      "brgy manuyog",
      "barangay manuyog"
    ],
    "lat": 9.088,
    "lng": 124.691,
    "mun": "Sagay"
  },
  {
    "name": "Mayana, Sagay",
    "cat": "barangay",
    "keywords": [
      "mayana",
      "brgy mayana",
      "barangay mayana"
    ],
    "lat": 9.115,
    "lng": 124.712,
    "mun": "Sagay"
  },
  {
    "name": "Poblacion, Sagay",
    "cat": "barangay",
    "keywords": [
      "poblacion sagay",
      "sagay centro",
      "centro sagay",
      "sagay proper"
    ],
    "lat": 9.102,
    "lng": 124.721,
    "mun": "Sagay"
  },
  {
    "name": "Butay, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "butay",
      "brgy butay",
      "barangay butay"
    ],
    "lat": 9.099,
    "lng": 124.775,
    "mun": "Guinsiliban"
  },
  {
    "name": "Cabuan, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "cabuan",
      "brgy cabuan",
      "barangay cabuan"
    ],
    "lat": 9.105,
    "lng": 124.782,
    "mun": "Guinsiliban"
  },
  {
    "name": "Cantaan, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "cantaan",
      "brgy cantaan",
      "barangay cantaan"
    ],
    "lat": 9.081,
    "lng": 124.786,
    "mun": "Guinsiliban"
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
    "lat": 9.091,
    "lng": 124.772,
    "mun": "Guinsiliban"
  },
  {
    "name": "Maac, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "maac",
      "brgy maac",
      "barangay maac"
    ],
    "lat": 9.112,
    "lng": 124.785,
    "mun": "Guinsiliban"
  },
  {
    "name": "North Poblacion, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "north poblacion",
      "north poblacion guinsiliban",
      "poblacion guinsiliban"
    ],
    "lat": 9.096,
    "lng": 124.779,
    "mun": "Guinsiliban"
  },
  {
    "name": "South Poblacion, Guinsiliban",
    "cat": "barangay",
    "keywords": [
      "south poblacion",
      "south poblacion guinsiliban"
    ],
    "lat": 9.092,
    "lng": 124.777,
    "mun": "Guinsiliban"
  }
];

    function matchCamiguinPlace(str) {
    if (!str) return null;
    const s = str.trim().toLowerCase();
    const qWords = s.replace(/,/g, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean);

    // 1. Exact match on name or keywords
    for (const p of CAMIGUIN_PLACES) {
      if (s === p.name.toLowerCase()) return p;
      for (const k of p.keywords) {
        if (s === k.toLowerCase()) return p;
      }
    }

    // 2. Starts with query
    for (const p of CAMIGUIN_PLACES) {
      if (p.name.toLowerCase().startsWith(s)) return p;
      for (const k of p.keywords) {
        if (k.toLowerCase().startsWith(s)) return p;
      }
    }

    // 3. Word token matching
    for (const p of CAMIGUIN_PLACES) {
      const nameWords = new Set(p.name.toLowerCase().replace(/,/g, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean));
      const kwWords = new Set();
      p.keywords.forEach(k => k.toLowerCase().replace(/-/g, " ").split(/\s+/).forEach(w => kwWords.add(w)));

      const allWords = new Set([...nameWords, ...kwWords]);
      if (qWords.every(qw => [...allWords].some(nw => nw === qw || nw.startsWith(qw)))) {
        return p;
      }
    }

    // 4. Substring fallback (if input length >= 3)
    if (s.length >= 3) {
      for (const p of CAMIGUIN_PLACES) {
        if (p.name.toLowerCase().includes(s)) return p;
        for (const k of p.keywords) {
          if (k.toLowerCase().includes(s)) return p;
        }
      }
    }

    return null;
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

    // 2. If in Poblacion Mambajao core (around 9.246-9.252, 124.694-124.704), prioritize town center / landmarks
    if (lat >= 9.2460 && lng >= 124.6940 && nearestLandmark && minLandmarkDist < 0.005) {
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
  [optLargeStore, optExtraStores, optHinterland, estimatedBudgetInput].forEach((el) => {
    if (el) {
      el.addEventListener("change", recalculateFare);
      el.addEventListener("input", recalculateFare);
    }
  });

  // Handle typing inside Pickup and Dropoff inputs with immediate map center & flyTo!
  function handleTypedAddress(isPickup) {
    const input = isPickup ? pickupInput : dropoffInput;
    const text = input.value.trim();
    if (text.length >= 2) {
      const found = matchCamiguinPlace(text);
      if (found) {
        if (isPickup) {
          pickupLatInput.value = found.lat;
          pickupLngInput.value = found.lng;
          setPickupPoint(found.lat, found.lng, found.name);
          if (map) {
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }
          if (pickupMarker) {
            pickupMarker.bindPopup(`<strong>🟢 Pickup:</strong><br>${escapeHtml(found.name)}`).openPopup();
          }
          showMapToast(`🟢 Pickup Na-pin sa: ${found.name}`);
        } else {
          dropoffLatInput.value = found.lat;
          dropoffLngInput.value = found.lng;
          setDropoffPoint(found.lat, found.lng, found.name);
          if (map) {
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }
          if (dropoffMarker) {
            dropoffMarker.bindPopup(`<strong>🏁 Drop-off:</strong><br>${escapeHtml(found.name)}`).openPopup();
          }
          showMapToast(`🏁 Drop-off Na-pin sa: ${found.name}`);
        }
        updateRouteLine();
      }
    }
    recalculateFare();
  }

  let typeTimer = null;
  if (pickupInput) {
    pickupInput.addEventListener("input", () => {
      updateClearBtn(pickupInput, clearPickupBtn);
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(true), 250);
    });
    pickupInput.addEventListener("change", () => {
      updateClearBtn(pickupInput, clearPickupBtn);
      handleTypedAddress(true);
    });
  }

  if (dropoffInput) {
    dropoffInput.addEventListener("input", () => {
      updateClearBtn(dropoffInput, clearDropoffBtn);
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(false), 250);
    });
    dropoffInput.addEventListener("change", () => {
      updateClearBtn(dropoffInput, clearDropoffBtn);
      handleTypedAddress(false);
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
      showMapToast("Pickup na-erase na.");
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
      showMapToast("Drop-off na-erase na.");
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

      // Case A: If user already typed or selected a known place name
      if (found) {
        setDropoffPoint(found.lat, found.lng, found.name);
        if (dropoffMarker) {
          dropoffMarker.setLatLng([found.lat, found.lng]);
          dropoffMarker.bindPopup(`<strong>🏁 Drop-off Destination:</strong><br>${escapeHtml(found.name)}`).openPopup();
        }
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }, 60);
        }
        showMapToast(`🏁 Drop-off Na-pin sa: ${found.name}`);
        updateRouteLine();
        recalculateFare();
        return;
      }

      // Case B: If existing valid pinned coordinates exist
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
        showMapToast(`🏁 Kasamtangang Drop-off Pin sa mapa`);
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
      showMapToast("👇 Palihug i-tap o i-click ang mapa aron mapili ang Drop-off!");
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

      // Case A: If user already typed or selected a known place
      if (found) {
        setPickupPoint(found.lat, found.lng, found.name);
        if (pickupMarker) {
          pickupMarker.setLatLng([found.lat, found.lng]);
          pickupMarker.bindPopup(`<strong>🟢 Pickup Meeting Point:</strong><br>${escapeHtml(found.name)}`).openPopup();
        }
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            map.flyTo([found.lat, found.lng], 16, { duration: 0.8 });
          }, 60);
        }
        showMapToast(`🟢 Pickup Na-pin sa: ${found.name}`);
        updateRouteLine();
        recalculateFare();
        return;
      }

      // Case B: If existing valid pinned coordinates exist
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
        showMapToast(`🟢 Kasamtangang Pickup Pin sa mapa`);
        return;
      }

      // Case C: Box is BLANK - DO NOT DROP A PIN IN THE SEA!
      if (map) {
        setTimeout(() => {
          map.invalidateSize();
          map.setView([9.24971, 124.71667], 14);
        }, 60);
      }
      showMapToast("👇 Palihug i-tap o i-click ang mapa aron mapili ang Pickup!");
    };

    pinPickupMapBtn.addEventListener("click", handlePinPickupClick);
    pinPickupMapBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  // Autocomplete Dropdown Search & Instant Pinning
  function setupPlacesAutocomplete(inputEl, dropdownEl, isPickup) {
    if (!inputEl || !dropdownEl) return;
    let debounceTimer = null;

    async function searchAndRender() {
      const q = inputEl.value.trim();
      if (q.length < 1) {
        dropdownEl.classList.add("hidden");
        dropdownEl.innerHTML = "";
        return;
      }

      const qLower = q.toLowerCase();
      const localMatches = [];
      for (const p of CAMIGUIN_PLACES) {
        const nLower = p.name.toLowerCase();
        if (nLower.includes(qLower) || p.keywords.some((k) => k.includes(qLower) || qLower.includes(k))) {
          localMatches.push(p);
          if (localMatches.length >= 8) break;
        }
      }

      renderResults(localMatches);

      if (q.length >= 2) {
        try {
          const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.places && data.places.length > 0) {
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
        const handleSelect = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const item = items[idx];
          if (!item) return;

          inputEl.value = item.name;
          dropdownEl.classList.add("hidden");

          // MUDIRITSO DAYUN PAG PIN ANG MAP SA EXACT PLACE!
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

          showMapToast(`${isPickup ? "🟢 Pickup" : "🏁 Drop-off"} Na-pin sa: ${item.name}`);
          updateRouteLine();
          recalculateFare();
        };

        el.addEventListener("pointerdown", handleSelect);
        el.addEventListener("mousedown", handleSelect);
        el.addEventListener("click", handleSelect);
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
      setTimeout(() => dropdownEl.classList.add("hidden"), 350);
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

      // Sulod ra gyud sa Isla sa Camiguin ang pwede ma-pin
      if (lat < 9.05 || lat > 9.29 || lng < 124.58 || lng > 124.83) {
        showMapToast("⚠️ Sulod lamang sa Isla sa Camiguin ang pag-pin sa mapa.");
        return;
      }

      // Check distance to nearest Camiguin land/place - reject clicks out at deep sea
      let minDist = Infinity;
      for (const p of CAMIGUIN_PLACES) {
        const d = Math.hypot(lat - p.lat, lng - p.lng);
        if (d < minDist) minDist = d;
      }
      if (minDist > 0.035) { // ~3.8km out at sea
        showMapToast("⚠️ Naa sa dagat ang imong na-click. Palihug i-tap sa yuta o kalsada sa Camiguin!");
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
    showMapToast(layerType === "satellite" ? "🛰️ Naka-on ang Satellite Aerial View" : "🗺️ Naka-on ang Standard Kalsada Map");
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      showMapToast("Dili suportado ang Geolocation sa imong device.");
      return;
    }
    showMapToast("🔍 Gina-detect ang imong GPS location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));

        if (lat < 9.05 || lat > 9.29 || lng < 124.58 || lng > 124.83) {
          showMapToast("⚠️ Ang imong GPS naa sa gawas sa Isla sa Camiguin.");
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
        setPickupPoint(lat, lng, `📍 Akong Lokasyon (${lat}, ${lng})`);
        showMapToast("✅ Na-pin ang imong GPS location isip Pickup!");
      },
      (err) => {
        showMapToast("⚠️ Dili ma-access ang GPS. Palihug i-allow ang Location sa browser.");
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
      b.innerHTML = isFs ? "<span>✕</span> I-close" : "<span>⛶</span> Padak-a";
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

  async function recalculateFare(overrideRoadKm) {
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);
    const service = serviceTypeInput.value;
    const isLarge = optLargeStore ? optLargeStore.checked : false;
    const extraStores = optExtraStores ? parseInt(optExtraStores.value || "0", 10) : 0;
    const isHinterland = optHinterland ? optHinterland.checked : false;
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
      if (fareDisplay) fareDisplay.textContent = "40";
      if (fareKmDisplay) fareKmDisplay.textContent = "~0.0 km (Pilia ang Lokasyon)";
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
          service_type: service,
          is_large_store: isLarge,
          extra_stores_count: extraStores,
          is_bulky_or_high_value: isBulky,
          is_hinterland: isHinterland,
        }),
      });
      const data = await res.json();
      if (data && data.fare_amount) {
        if (fareDisplay) fareDisplay.textContent = Math.round(data.fare_amount);
        if (fareKmDisplay) fareKmDisplay.textContent = `~${data.estimated_km} km (Kalsada / Road Distance)`;

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

      showMapToast(`🏁 Drop-off Na-set: ${name}`);
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

  // Clean Map Boot - Inputs start 100% BLANK as requested!
  function bootBookingMap() {
    initMap();
    if (pickupInput) pickupInput.value = "";
    if (dropoffInput) dropoffInput.value = "";
    if (pickupLatInput) pickupLatInput.value = "";
    if (pickupLngInput) pickupLngInput.value = "";
    if (dropoffLatInput) dropoffLatInput.value = "";
    if (dropoffLngInput) dropoffLngInput.value = "";
    updateClearBtn(pickupInput, clearPickupBtn);
    updateClearBtn(dropoffInput, clearDropoffBtn);
    recalculateFare();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBookingMap);
  } else {
    bootBookingMap();
  }

  // Booking Form Submission
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorMsg) {
        errorMsg.classList.add("hidden");
        errorMsg.textContent = "";
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Broadcasting booking to riders...";

      const budgetVal = estimatedBudgetInput ? parseFloat(estimatedBudgetInput.value || 0) : 0;
      const payload = {
        service_type: serviceTypeInput.value,
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
        is_hinterland: optHinterland ? optHinterland.checked : false,
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
        submitBtn.disabled = false;
        submitBtn.textContent = "Broadcast Request to Active Riders 🛵 →";
        if (errorMsg) {
          errorMsg.innerHTML = "⚠️ <strong>Kinahanglan mo-Sign In o mag-Register una!</strong><br>Aron lehitimo ug ma-verify ang imong account sa mga riders, palihug pag-sign in o pag-register sa popup sa ubos.";
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
        const custModal = document.getElementById("customer-auth-modal");
        if (custModal) custModal.classList.remove("hidden");
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
        try {
          localStorage.setItem("ccrc_active_booking", b.booking_code);
          if (payload.customer_phone) localStorage.setItem("ccrc_customer_phone", payload.customer_phone);
          if (payload.customer_name) localStorage.setItem("ccrc_customer_name", payload.customer_name);
          if (payload.customer_password) {
            localStorage.setItem("ccrc_customer_session", JSON.stringify({
              name: payload.customer_name,
              phone: payload.customer_phone,
              barangay: payload.customer_barangay,
              is_verified: 1,
            }));
          }
        } catch (_) {}

        updateActiveTripNavLinks(b.booking_code);
        if (typeof window.playDispatchChime === "function") window.playDispatchChime();

        if (modalBookingCode) modalBookingCode.textContent = b.booking_code;
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
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Broadcast Booking to Active Riders 🛵 →";
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
    const promoDiscountRow = document.getElementById("promo-discount-row");
    const promoDiscountVal = document.getElementById("promo-discount-val");

    if (applyPromoBtn && promoInput) {
      applyPromoBtn.addEventListener("click", async () => {
        const code = promoInput.value.trim().toUpperCase();
        if (!code) return;
        const currentFareText = document.getElementById("fare-display")?.textContent || "40";
        const currentFare = parseFloat(currentFareText) || 40.0;

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
            promoFeedback.textContent = `✓ ${data.promo.message}`;
            promoFeedback.style.color = "#16a34a";
            promoFeedback.classList.remove("hidden");
            if (promoDiscountRow && promoDiscountVal) {
              promoDiscountVal.textContent = `-₱${data.promo.discount_amount}`;
              promoDiscountRow.classList.remove("hidden");
            }
            if (document.getElementById("fare-display")) {
              document.getElementById("fare-display").textContent = data.promo.new_fare;
            }
          } else {
            promoFeedback.textContent = `✕ ${data.error || "Invalid promo code."}`;
            promoFeedback.style.color = "#dc2626";
            promoFeedback.classList.remove("hidden");
          }
        } catch (err) {
          promoFeedback.textContent = "Could not validate code.";
          promoFeedback.style.color = "#dc2626";
          promoFeedback.classList.remove("hidden");
        } finally {
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = "Apply";
        }
      });
    }

    // Prefill from URL query params (e.g. from Island Tours)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const prefillDrop = urlParams.get("dropoff");
      const prefillPick = urlParams.get("pickup");
      const prefillNotes = urlParams.get("notes");
      const dropInput = document.getElementById("dropoff-address");
      const pickInput = document.getElementById("pickup-address");
      if (prefillDrop && dropInput) {
        dropInput.value = prefillDrop;
        dropInput.dispatchEvent(new Event("input"));
      }
      if (prefillPick && pickInput) {
        pickInput.value = prefillPick;
        pickInput.dispatchEvent(new Event("input"));
      }
      if (prefillNotes && document.getElementById("item-notes")) {
        document.getElementById("item-notes").value = prefillNotes;
      }
    } catch (_) {}
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

  function renderCustomerActiveCard(b) {
    const card = document.getElementById("customer-active-ride-card");
    if (!card) return;

    const codeEl = document.getElementById("active-card-code");
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

    if (codeEl) codeEl.textContent = b.booking_code;
    if (pickupEl) pickupEl.textContent = b.pickup_address;
    if (dropoffEl) dropoffEl.textContent = b.dropoff_address;
    if (fareEl) fareEl.textContent = `₱${Math.round(b.fare_amount || 0).toLocaleString()}`;
    if (trackBtnEl) trackBtnEl.href = `/track/${encodeURIComponent(b.booking_code)}`;

    if (badgeEl) {
      if (b.status === "accepted") {
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
        riderBikeEl.innerHTML = `${b.rider_bike || "Island Express Bike"}${b.rider_plate ? ` &bull; Plate: <strong>${b.rider_plate}</strong>` : ""}`;
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
        if (b.rider_avatar) {
          riderAvatarEl.innerHTML = `<img src="${b.rider_avatar}" alt="Rider" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
          riderAvatarEl.textContent = (b.rider_name || "R")[0].toUpperCase();
        }
      }
    } else {
      if (riderInfoEl) riderInfoEl.classList.add("hidden");
    }

    card.classList.remove("hidden");
    updateActiveTripNavLinks(b.booking_code);
  }

  async function checkCustomerActiveBooking() {
    let activeCode = null;
    try {
      activeCode = localStorage.getItem("ccrc_active_booking");
    } catch (_) {}
    if (!activeCode && window.SERVER_ACTIVE_BOOKING) {
      activeCode = window.SERVER_ACTIVE_BOOKING.booking_code;
    }
    let phone = null;
    try {
      phone = localStorage.getItem("ccrc_customer_phone");
    } catch (_) {}

    if (!activeCode && !phone) return;

    let query = "";
    if (activeCode) query = `code=${encodeURIComponent(activeCode)}`;
    else if (phone) query = `phone=${encodeURIComponent(phone)}`;

    try {
      const res = await fetch(`/api/customer/active-booking?${query}`);
      const data = await res.json();
      if (data.active && data.booking) {
        try {
          localStorage.setItem("ccrc_active_booking", data.booking.booking_code);
        } catch (_) {}
        renderCustomerActiveCard(data.booking);
      } else {
        if (data.booking && (data.booking.status === "completed" || data.booking.status === "cancelled")) {
          try {
            localStorage.removeItem("ccrc_active_booking");
          } catch (_) {}
          const card = document.getElementById("customer-active-ride-card");
          if (card) card.classList.add("hidden");
          updateActiveTripNavLinks(null);
        }
      }
    } catch (_) {}
  }

  // Check active booking immediately on load and poll every 6s
  checkCustomerActiveBooking();
  setInterval(checkCustomerActiveBooking, 6000);

  // ---------------------------------------------------------------------------
  // Customer Authentication & Legit Verification Controller
  // ---------------------------------------------------------------------------
  const customerAuthBtn = document.getElementById("customer-auth-btn");
  const customerAuthBtnText = document.getElementById("customer-auth-btn-text");
  const customerAuthModal = document.getElementById("customer-auth-modal");
  const unauthedView = document.getElementById("cust-auth-unauthed-view");
  const authedView = document.getElementById("cust-auth-authed-view");
  const tabLogin = document.getElementById("cust-tab-login");
  const tabRegister = document.getElementById("cust-tab-register");
  const loginForm = document.getElementById("cust-login-form");
  const registerForm = document.getElementById("cust-register-form");
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
    try {
      const raw = localStorage.getItem("ccrc_customer_session");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setStoredCustomer(cust) {
    try {
      if (cust) {
        localStorage.setItem("ccrc_customer_session", JSON.stringify(cust));
        if (cust.phone) localStorage.setItem("ccrc_customer_phone", cust.phone);
        if (cust.name) localStorage.setItem("ccrc_customer_name", cust.name);
        if (cust.avatar_url) localStorage.setItem("ccrc_customer_avatar", cust.avatar_url);
      } else {
        localStorage.removeItem("ccrc_customer_session");
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
    const signInBtn = document.getElementById("customer-signin-btn") || document.getElementById("customer-auth-btn");
    const loggedPill = document.getElementById("customer-logged-pill");
    const pillName = document.getElementById("customer-pill-name");

    if (cust && cust.phone) {
      const avatarUrl = cust.avatar_url || localStorage.getItem("ccrc_customer_avatar");

      // Hide Sign In button completely!
      if (signInBtn) {
        signInBtn.style.setProperty("display", "none", "important");
        signInBtn.classList.add("hidden");
      }
      if (loggedPill) {
        loggedPill.style.setProperty("display", "inline-flex", "important");
        loggedPill.classList.remove("hidden");
      }
      if (pillName) pillName.textContent = (cust.name ? cust.name.split(" ")[0] : "Account") + " ✓";
      if (customerAuthBtnText) customerAuthBtnText.textContent = cust.name ? cust.name.split(" ")[0] + " ✓" : "Account ✓";
      if (custBadge) custBadge.classList.remove("hidden");
      if (regOption) regOption.classList.add("hidden");

      // Header avatar sync
      const headerAvatarImg = document.getElementById("header-cust-avatar-img");
      const headerPlaceholder = document.getElementById("header-cust-placeholder");
      if (headerAvatarImg && avatarUrl) {
        headerAvatarImg.src = avatarUrl;
        headerAvatarImg.classList.remove("hidden");
        if (headerPlaceholder) headerPlaceholder.classList.add("hidden");
      } else if (headerPlaceholder) {
        headerPlaceholder.classList.remove("hidden");
        if (headerAvatarImg) headerAvatarImg.classList.add("hidden");
      }

      if (nameInput && !nameInput.value) nameInput.value = cust.name || "";
      if (phoneInput && !phoneInput.value) phoneInput.value = cust.phone || "";

      if (unauthedView) unauthedView.classList.add("hidden");
      if (authedView) {
        authedView.classList.remove("hidden");
        const pName = document.getElementById("c-profile-name");
        const pPhone = document.getElementById("c-profile-phone");
        const pEmail = document.getElementById("c-profile-email");
        const pRides = document.getElementById("c-profile-rides");
        const pSpent = document.getElementById("c-profile-spent");
        if (pName) pName.textContent = cust.name || "Customer";
        if (pPhone) pPhone.textContent = cust.phone || "";
        if (pEmail && cust.email) pEmail.textContent = cust.email;
        if (pRides) pRides.textContent = cust.total_rides || 0;
        if (pSpent) pSpent.textContent = `₱${Number(cust.total_spent || 0).toFixed(2)}`;

        // Customer Avatar in Profile Modal
        const profImg = document.getElementById("c-profile-avatar-img");
        const profPlaceholder = document.getElementById("c-profile-avatar-placeholder");
        if (profImg && avatarUrl) {
          profImg.src = avatarUrl;
          profImg.classList.remove("hidden");
          if (profPlaceholder) profPlaceholder.classList.add("hidden");
        } else if (profPlaceholder) {
          profPlaceholder.classList.remove("hidden");
          if (profImg) profImg.classList.add("hidden");
        }
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

      // Hide bottom-right rider icon when customer is logged in
      const bottomRiderNav = document.getElementById("bottom-nav-rider");
      if (bottomRiderNav) {
        bottomRiderNav.style.setProperty("display", "none", "important");
        bottomRiderNav.classList.add("hidden");
      }

      loadCustomerHomeHistory();
    } else {
      // Show Sign In button!
      if (signInBtn) {
        signInBtn.style.setProperty("display", "inline-flex", "important");
        signInBtn.classList.remove("hidden");
      }
      if (loggedPill) {
        loggedPill.style.setProperty("display", "none", "important");
        loggedPill.classList.add("hidden");
      }
      if (customerAuthBtnText) customerAuthBtnText.textContent = "Sign In";
      if (custBadge) custBadge.classList.add("hidden");
      if (regOption) regOption.classList.remove("hidden");
      if (unauthedView) unauthedView.classList.remove("hidden");
      if (authedView) authedView.classList.add("hidden");
      const historyCard = document.getElementById("customer-home-history-card");
      if (historyCard) historyCard.classList.add("hidden");

      // Show bottom-right rider icon when customer is NOT logged in
      const bottomRiderNav = document.getElementById("bottom-nav-rider");
      if (bottomRiderNav) {
        bottomRiderNav.style.removeProperty("display");
        bottomRiderNav.classList.remove("hidden");
      }
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

      if (tripsCountEl) tripsCountEl.textContent = `${totalTrips} ka biyahe`;
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
              Wala pa kay nahuman nga biyahe. Pag-book karon aron makasugod sa imong travel record!
            </div>
          `;
        } else {
          feedEl.innerHTML = list.slice(0, 3).map(b => {
            const isCompleted = b.status === 'completed';
            return `
              <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-weight:700;font-size:0.88rem;color:#f8fafc;display:flex;align-items:center;gap:6px;">
                    <span style="font-family:monospace;color:#38bdf8;">${escapeHtml(b.booking_code)}</span>
                    <span class="badge badge-accent" style="font-size:0.7rem;text-transform:uppercase;">${escapeHtml(b.service_type)}</span>
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
                    <a href="/track/${encodeURIComponent(b.booking_code)}" class="btn btn-sm" style="font-size:0.72rem;padding:2px 8px;background:#1e293b;color:white;border:1px solid #475569;text-decoration:none;">
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

  // Open Customer Modal
  const signInBtnElem = document.getElementById("customer-signin-btn") || document.getElementById("customer-auth-btn");
  if (signInBtnElem && customerAuthModal) {
    signInBtnElem.addEventListener("click", () => {
      updateCustomerAuthUI();
      customerAuthModal.classList.remove("hidden");
    });
  }

  const custProfileBtn = document.getElementById("customer-profile-btn");
  if (custProfileBtn && customerAuthModal) {
    custProfileBtn.addEventListener("click", () => {
      updateCustomerAuthUI();
      customerAuthModal.classList.remove("hidden");
    });
  }

  const headerCustLogoutBtn = document.getElementById("header-cust-logout-btn");
  if (headerCustLogoutBtn) {
    headerCustLogoutBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to log out of your customer account?")) {
        try {
          await fetch("/api/customer/logout", { method: "POST" });
        } catch (_) {}
        setStoredCustomer(null);
        window.location.reload();
      }
    });
  }

  // Tab switching
  if (tabLogin && tabRegister && loginForm && registerForm) {
    tabLogin.addEventListener("click", () => {
      tabLogin.style.borderBottom = "3px solid var(--primary)";
      tabLogin.style.color = "var(--primary)";
      tabLogin.style.fontWeight = "700";
      tabRegister.style.borderBottom = "3px solid transparent";
      tabRegister.style.color = "#64748b";
      tabRegister.style.fontWeight = "600";
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.style.borderBottom = "3px solid var(--primary)";
      tabRegister.style.color = "var(--primary)";
      tabRegister.style.fontWeight = "700";
      tabLogin.style.borderBottom = "3px solid transparent";
      tabLogin.style.color = "#64748b";
      tabLogin.style.fontWeight = "600";
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    });
  }

  // Handle Customer Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("c-login-err");
      if (errEl) errEl.classList.add("hidden");
      const phone = document.getElementById("c-login-phone")?.value.trim();
      const password = document.getElementById("c-login-pwd")?.value;
      const btn = document.getElementById("c-login-btn");
      btn.disabled = true;
      btn.textContent = "Logging in...";

      try {
        const res = await fetch("/api/customer/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        setStoredCustomer(data.customer);
        if (customerAuthModal) customerAuthModal.classList.add("hidden");
        alert(`Welcome back, ${data.customer.name}! Your account is verified.`);
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.classList.remove("hidden");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Log In to CCRC →";
      }
    });
  }

  // Customer Registration Photo Handler (Camera & Gallery)
  let currentCustAvatarBase64 = "";
  const cCamBtn = document.getElementById("c-photo-camera-btn");
  const cGalBtn = document.getElementById("c-photo-gallery-btn");
  const cCamInput = document.getElementById("c-reg-file-camera");
  const cGalInput = document.getElementById("c-reg-file-gallery");
  const cPhotoImg = document.getElementById("c-reg-photo-img");
  const cPhotoPlaceholder = document.getElementById("c-reg-photo-placeholder");
  const cPhotoStatus = document.getElementById("c-photo-status");

  if (cCamBtn && cCamInput) {
    cCamBtn.addEventListener("click", () => cCamInput.click());
  }
  if (cGalBtn && cGalInput) {
    cGalBtn.addEventListener("click", () => cGalInput.click());
  }

  function handleCustPhotoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        currentCustAvatarBase64 = canvas.toDataURL("image/jpeg", 0.85);

        if (cPhotoImg) {
          cPhotoImg.src = currentCustAvatarBase64;
          cPhotoImg.classList.remove("hidden");
        }
        if (cPhotoPlaceholder) {
          cPhotoPlaceholder.classList.add("hidden");
        }
        if (cPhotoStatus) {
          cPhotoStatus.textContent = "✓ Litrato napili (" + Math.round(currentCustAvatarBase64.length / 1024) + " KB)";
          cPhotoStatus.style.color = "#16a34a";
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  if (cCamInput) {
    cCamInput.addEventListener("change", function() {
      if (this.files && this.files[0]) handleCustPhotoFile(this.files[0]);
    });
  }
  if (cGalInput) {
    cGalInput.addEventListener("change", function() {
      if (this.files && this.files[0]) handleCustPhotoFile(this.files[0]);
    });
  }

  // Handle Customer Register
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("c-reg-err");
      if (errEl) errEl.classList.add("hidden");
      const name = document.getElementById("c-reg-name")?.value.trim();
      const phone = document.getElementById("c-reg-phone")?.value.trim();
      const email = document.getElementById("c-reg-email")?.value.trim();
      const barangay = document.getElementById("c-reg-barangay")?.value;
      const password = document.getElementById("c-reg-pwd")?.value;

      if (!email || !email.includes("@") || !email.includes(".")) {
        if (errEl) {
          errEl.textContent = "Palihug ibutang ang imong saktong Email Address (e.g. maria@gmail.com).";
          errEl.classList.remove("hidden");
        }
        return;
      }
      if (!currentCustAvatarBase64) {
        if (errEl) {
          errEl.textContent = "Palihug pagkuha o pagpili og litrato (Camera o Gallery) para sa imong customer verification.";
          errEl.classList.remove("hidden");
        }
        return;
      }

      const btn = document.getElementById("c-reg-btn");
      btn.disabled = true;
      btn.textContent = "Registering...";

      try {
        const res = await fetch("/api/customer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            email,
            barangay,
            password,
            avatar_base64: currentCustAvatarBase64,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        setStoredCustomer(data.customer);
        if (customerAuthModal) customerAuthModal.classList.add("hidden");
        alert(`Congratulations ${data.customer.name}! You are now a Verified CCRC Passenger (🛡️ Verified Badge).`);
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.classList.remove("hidden");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Register & Get Verified Badge 🛡️";
      }
    });
  }

  // Customer Logout
  const custLogoutBtn = document.getElementById("c-profile-logout-btn");
  if (custLogoutBtn) {
    custLogoutBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to log out of your customer account?")) {
        try {
          await fetch("/api/customer/logout", { method: "POST" });
        } catch (_) {}
        setStoredCustomer(null);
        if (customerAuthModal) customerAuthModal.classList.add("hidden");
        window.location.reload();
      }
    });
  }

  // Initialize customer session check on load
  updateCustomerAuthUI();
})();
