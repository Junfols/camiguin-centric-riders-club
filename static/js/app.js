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

  // Camiguin Master Places Directory (126+ Locations)
  let CAMIGUIN_PLACES = [
    // Stores & Supermarkets
    { name: "Gaisano Capital Camiguin", cat: "supermarket", keywords: ["gaisano", "gaisano capital", "mall", "supermarket", "grocery"], lat: 9.2475, lng: 124.6995, mun: "Mambajao" },
    { name: "Davilett Store & Supermarket, Mambajao", cat: "supermarket", keywords: ["davilett", "davilet", "davi", "supermarket"], lat: 9.2482, lng: 124.6978, mun: "Mambajao" },
    { name: "Nene Uy Store / Wholesaler, Mambajao", cat: "store", keywords: ["nene uy", "nene", "wholesaler", "grocery"], lat: 9.2480, lng: 124.6976, mun: "Mambajao" },
    { name: "Prince Hypermart Camiguin", cat: "supermarket", keywords: ["prince hypermart", "prince", "hypermart"], lat: 9.2465, lng: 124.7010, mun: "Mambajao" },
    { name: "7-Eleven Mambajao Town Center", cat: "store", keywords: ["7-eleven", "7-11", "711", "seven eleven"], lat: 9.2487, lng: 124.6979, mun: "Mambajao" },
    { name: "7-Eleven Balbagon Port Branch", cat: "store", keywords: ["7-eleven balbagon", "711 balbagon"], lat: 9.2558, lng: 124.7169, mun: "Mambajao" },
    { name: "Mercury Drug Camiguin, Mambajao", cat: "pharmacy", keywords: ["mercury drug", "mercury", "pharmacy", "botika", "tambal"], lat: 9.2525, lng: 124.7164, mun: "Mambajao" },
    { name: "Rose Pharmacy Mambajao", cat: "pharmacy", keywords: ["rose pharmacy", "rose", "pharmacy", "botika"], lat: 9.2486, lng: 124.6977, mun: "Mambajao" },
    { name: "Julies Bakeshop Mambajao", cat: "store", keywords: ["julies", "julies bakeshop", "bakeshop", "tinapay"], lat: 9.2484, lng: 124.6974, mun: "Mambajao" },
    { name: "Chooks to Go Mambajao", cat: "food", keywords: ["chooks", "chooks to go", "manok"], lat: 9.2485, lng: 124.6982, mun: "Mambajao" },
    { name: "Andoks Litson Mambajao", cat: "food", keywords: ["andoks", "andok", "litson"], lat: 9.2489, lng: 124.6985, mun: "Mambajao" },
    { name: "Dunkin Donuts Camiguin", cat: "food", keywords: ["dunkin", "donuts"], lat: 9.2483, lng: 124.6981, mun: "Mambajao" },

    // Markets & Food
    { name: "Jollibee Camiguin, Mambajao", cat: "food", keywords: ["jollibee", "jolibee", "joli", "jolli", "fastfood"], lat: 9.2488, lng: 124.6980, mun: "Mambajao" },
    { name: "Mambajao Public Market", cat: "market", keywords: ["mambajao market", "public market", "merkado", "palengke", "wet market"], lat: 9.2483, lng: 124.6975, mun: "Mambajao" },
    { name: "Mahinog Public Market", cat: "market", keywords: ["mahinog market", "merkado mahinog"], lat: 9.1535, lng: 124.7852, mun: "Mahinog" },
    { name: "Catarman Public Market", cat: "market", keywords: ["catarman market", "merkado catarman"], lat: 9.1275, lng: 124.6455, mun: "Catarman" },
    { name: "Sagay Public Market", cat: "market", keywords: ["sagay market", "merkado sagay"], lat: 9.1025, lng: 124.7205, mun: "Sagay" },
    { name: "Guinsiliban Public Market", cat: "market", keywords: ["guinsiliban market", "merkado guinsiliban"], lat: 9.0938, lng: 124.7778, mun: "Guinsiliban" },
    { name: "Checkpoint Food Park, Mambajao", cat: "food", keywords: ["checkpoint", "food park", "resto bar"], lat: 9.2498, lng: 124.7005, mun: "Mambajao" },
    { name: "Hayahay Cafe & Restaurant", cat: "food", keywords: ["hayahay cafe", "hayahay"], lat: 9.2512, lng: 124.6720, mun: "Mambajao" },
    { name: "Casa Roces / Guerrera Restaurant, Yumbing", cat: "food", keywords: ["guerrera", "casa roces"], lat: 9.2548, lng: 124.6475, mun: "Mambajao" },
    { name: "Northern Lights Cafe, Agoho", cat: "food", keywords: ["northern lights"], lat: 9.2460, lng: 124.6610, mun: "Mambajao" },
    { name: "La Dolce Vita Italian Pizza, Agoho", cat: "food", keywords: ["la dolce vita", "pizza"], lat: 9.2455, lng: 124.6615, mun: "Mambajao" },
    { name: "Penongs Barbeque Mambajao", cat: "food", keywords: ["penongs", "bbq"], lat: 9.2492, lng: 124.6990, mun: "Mambajao" },

    // Government, Hospital, Schools & Ports
    { name: "Provincial Capitol Compound, Mambajao", cat: "building", keywords: ["capitol", "kapitolyo"], lat: 9.2510, lng: 124.7040, mun: "Mambajao" },
    { name: "Mambajao Town Plaza / Municipal Hall", cat: "building", keywords: ["mambajao plaza", "plaza", "municipal hall", "munisipyo"], lat: 9.2485, lng: 124.6972, mun: "Mambajao" },
    { name: "Camiguin General Hospital (CGH)", cat: "hospital", keywords: ["hospital", "cgh", "clinic", "doktor"], lat: 9.2495, lng: 124.7020, mun: "Mambajao" },
    { name: "Mahinog Municipal Hall", cat: "building", keywords: ["munisipyo mahinog"], lat: 9.1532, lng: 124.7850, mun: "Mahinog" },
    { name: "Catarman Municipal Hall", cat: "building", keywords: ["munisipyo catarman"], lat: 9.1282, lng: 124.6448, mun: "Catarman" },
    { name: "Sagay Municipal Hall", cat: "building", keywords: ["munisipyo sagay"], lat: 9.1022, lng: 124.7212, mun: "Sagay" },
    { name: "Guinsiliban Municipal Hall", cat: "building", keywords: ["munisipyo guinsiliban"], lat: 9.0942, lng: 124.7782, mun: "Guinsiliban" },
    { name: "Camiguin Polytechnic State College (CPSC)", cat: "school", keywords: ["cpsc", "polytechnic", "college"], lat: 9.2520, lng: 124.7110, mun: "Mambajao" },
    { name: "Fatima College of Camiguin", cat: "school", keywords: ["fatima college", "fcc"], lat: 9.2478, lng: 124.6965, mun: "Mambajao" },
    { name: "Camiguin Provincial Police Office", cat: "building", keywords: ["police", "pnp", "pulis"], lat: 9.2505, lng: 124.7030, mun: "Mambajao" },
    { name: "Balbagon Port (FastCat & Ferry Wharf)", cat: "transport", keywords: ["balbagon port", "balbagon", "fastcat", "pantalan"], lat: 9.2561, lng: 124.7175, mun: "Mambajao" },
    { name: "Benoni Port / Ferry Wharf, Mahinog", cat: "transport", keywords: ["benoni port", "benoni", "wharf", "port", "pantalan benoni"], lat: 9.1306, lng: 124.7937, mun: "Mahinog" },
    { name: "Guinsiliban Port / Ferry Terminal", cat: "transport", keywords: ["guinsiliban port"], lat: 9.0925, lng: 124.7815, mun: "Guinsiliban" },
    { name: "Camiguin Airport", cat: "transport", keywords: ["airport", "tugpahanan"], lat: 9.2530, lng: 124.7061, mun: "Mambajao" },

    // Tourist Spots, Falls & Resorts
    { name: "White Island Boat Jump-off, Yumbing", cat: "tourist", keywords: ["white island", "jump-off"], lat: 9.2538, lng: 124.6532, mun: "Mambajao" },
    { name: "Mantigue Island Boat Station, San Roque", cat: "tourist", keywords: ["mantigue island", "mantigue"], lat: 9.1720, lng: 124.7850, mun: "Mahinog" },
    { name: "Katibawasan Falls", cat: "tourist", keywords: ["katibawasan falls", "katibawasan", "busay"], lat: 9.2152, lng: 124.7188, mun: "Mambajao" },
    { name: "Tuasan Falls, Mainit, Catarman", cat: "tourist", keywords: ["tuasan falls", "tuasan"], lat: 9.1700, lng: 124.6750, mun: "Catarman" },
    { name: "Ardent Hot Spring, Esperanza", cat: "tourist", keywords: ["ardent hot spring", "ardent"], lat: 9.2380, lng: 124.6610, mun: "Mambajao" },
    { name: "Sto. Niño Cold Spring, Catarman", cat: "tourist", keywords: ["cold spring", "sto nino", "sto. nino"], lat: 9.1550, lng: 124.6550, mun: "Catarman" },
    { name: "Bura Soda Water Park, Catarman", cat: "tourist", keywords: ["soda water", "bura soda", "bura"], lat: 9.1820, lng: 124.6380, mun: "Catarman" },
    { name: "Sunken Cemetery & Giant Cross, Bonbon", cat: "tourist", keywords: ["sunken cemetery", "sunken"], lat: 9.2010, lng: 124.6300, mun: "Catarman" },
    { name: "Old Church Ruins (Gui-ob), Bonbon", cat: "tourist", keywords: ["church ruins", "guiob", "gui-ob"], lat: 9.2050, lng: 124.6320, mun: "Catarman" },
    { name: "Mount Vulcan Daan / Walkway to Old Volcano", cat: "tourist", keywords: ["vulcan daan", "old volcano"], lat: 9.2085, lng: 124.6350, mun: "Catarman" },
    { name: "Mount Hibok-Hibok Base Jump-off", cat: "tourist", keywords: ["hibok-hibok", "hibok hibok"], lat: 9.2030, lng: 124.6710, mun: "Mambajao" },
    { name: "Giant Clam Sanctuary, Cantaan", cat: "tourist", keywords: ["giant clam", "cantaan"], lat: 9.0810, lng: 124.7860, mun: "Guinsiliban" },
    { name: "Taguines Lagoon & Zipline, Benoni", cat: "tourist", keywords: ["taguines lagoon", "taguines"], lat: 9.1290, lng: 124.7910, mun: "Mahinog" },
    { name: "Katunggan Mangrove Park, Mahinog", cat: "tourist", keywords: ["katunggan", "mangrove park"], lat: 9.1350, lng: 124.7920, mun: "Mahinog" },
    { name: "Paras Beach Resort, Yumbing", cat: "resort", keywords: ["paras beach", "paras resort", "paras"], lat: 9.2553, lng: 124.6468, mun: "Mambajao" },
    { name: "Balyali Beach Resort, Yumbing", cat: "resort", keywords: ["balyali resort", "balyali"], lat: 9.2588, lng: 124.6432, mun: "Mambajao" },
    { name: "Tongatok Cliff Resort, Yumbing", cat: "resort", keywords: ["tongatok cliff", "tongatok"], lat: 9.2505, lng: 124.6341, mun: "Mambajao" },
    { name: "Lanzones Resort, Baylao, Mambajao", cat: "resort", keywords: ["lanzones resort", "lanzones"], lat: 9.2390, lng: 124.6970, mun: "Mambajao" },
    { name: "Camiguin Highland Resort, Soro-soro", cat: "resort", keywords: ["highland resort", "highland", "sorosoro", "soro-soro", "soro'soro"], lat: 9.2310, lng: 124.6890, mun: "Mambajao" },

    // All 57 Barangays
    { name: "Baylao, Mambajao", cat: "barangay", keywords: ["baylao", "bailao"], lat: 9.2415, lng: 124.6910, mun: "Mambajao" },
    { name: "Agoho, Mambajao", cat: "barangay", keywords: ["agoho"], lat: 9.2450, lng: 124.6620, mun: "Mambajao" },
    { name: "Yumbing, Mambajao", cat: "barangay", keywords: ["yumbing"], lat: 9.2553, lng: 124.6468, mun: "Mambajao" },
    { name: "Kuguita, Mambajao", cat: "barangay", keywords: ["kuguita", "cuguita"], lat: 9.2490, lng: 124.6850, mun: "Mambajao" },
    { name: "Poblacion, Mambajao", cat: "barangay", keywords: ["poblacion mambajao", "poblacion", "centro"], lat: 9.2483, lng: 124.6975, mun: "Mambajao" },
    { name: "Balbagon, Mambajao", cat: "barangay", keywords: ["balbagon"], lat: 9.2540, lng: 124.7140, mun: "Mambajao" },
    { name: "Magting, Mambajao", cat: "barangay", keywords: ["magting", "brgy magting", "barangay magting", "magting mambajao"], lat: 9.2189, lng: 124.7560, mun: "Mambajao" },
    { name: "Magting Elementary School, Mambajao", cat: "school", keywords: ["magting elementary", "magting school", "es magting"], lat: 9.2242, lng: 124.7514, mun: "Mambajao" },
    { name: "Anito, Mambajao", cat: "barangay", keywords: ["anito", "brgy anito", "barangay anito"], lat: 9.2296, lng: 124.7444, mun: "Mambajao" },
    { name: "Pandan, Mambajao", cat: "barangay", keywords: ["pandan", "brgy pandan"], lat: 9.2460, lng: 124.7080, mun: "Mambajao" },
    { name: "Bug-ong, Mambajao", cat: "barangay", keywords: ["bug-ong", "bugong"], lat: 9.2530, lng: 124.6390, mun: "Mambajao" },
    { name: "Naasag, Mambajao", cat: "barangay", keywords: ["naasag"], lat: 9.2510, lng: 124.6280, mun: "Mambajao" },
    { name: "Soro-soro, Mambajao", cat: "barangay", keywords: ["soro-soro", "sorosoro"], lat: 9.2310, lng: 124.6890, mun: "Mambajao" },
    { name: "Tagdo, Mambajao", cat: "barangay", keywords: ["tagdo"], lat: 9.2380, lng: 124.6820, mun: "Mambajao" },
    { name: "Tupsan, Mambajao", cat: "barangay", keywords: ["tupsan mambajao", "tupsan", "brgy tupsan"], lat: 9.2019, lng: 124.7774, mun: "Mambajao" },
    { name: "Benhaan, Mambajao", cat: "barangay", keywords: ["benhaan", "brgy benhaan"], lat: 9.2032, lng: 124.7677, mun: "Mambajao" },
    { name: "Poblacion, Mahinog", cat: "barangay", keywords: ["mahinog", "poblacion mahinog"], lat: 9.1530, lng: 124.7850, mun: "Mahinog" },
    { name: "Benoni, Mahinog", cat: "barangay", keywords: ["benoni"], lat: 9.1306, lng: 124.7937, mun: "Mahinog" },
    { name: "Hubangon, Mahinog", cat: "barangay", keywords: ["hubangon"], lat: 9.1680, lng: 124.7760, mun: "Mahinog" },
    { name: "San Roque, Mahinog", cat: "barangay", keywords: ["san roque mahinog", "san roque"], lat: 9.1720, lng: 124.7850, mun: "Mahinog" },
    { name: "Binunsaran, Mahinog", cat: "barangay", keywords: ["binunsaran"], lat: 9.1420, lng: 124.7700, mun: "Mahinog" },
    { name: "Binuangan, Mahinog", cat: "barangay", keywords: ["binuangan"], lat: 9.1380, lng: 124.7890, mun: "Mahinog" },
    { name: "Catohugan, Mahinog", cat: "barangay", keywords: ["catohugan"], lat: 9.1620, lng: 124.7810, mun: "Mahinog" },
    { name: "Owakan, Mahinog", cat: "barangay", keywords: ["owakan"], lat: 9.1510, lng: 124.7740, mun: "Mahinog" },
    { name: "Puntod, Mahinog", cat: "barangay", keywords: ["puntod"], lat: 9.1460, lng: 124.7810, mun: "Mahinog" },
    { name: "San Isidro, Mahinog", cat: "barangay", keywords: ["san isidro mahinog"], lat: 9.1650, lng: 124.7680, mun: "Mahinog" },
    { name: "San Jose, Mahinog", cat: "barangay", keywords: ["san jose mahinog"], lat: 9.1580, lng: 124.7710, mun: "Mahinog" },
    { name: "San Miguel, Mahinog", cat: "barangay", keywords: ["san miguel mahinog"], lat: 9.1700, lng: 124.7790, mun: "Mahinog" },
    { name: "Tubod, Mahinog", cat: "barangay", keywords: ["tubod mahinog"], lat: 9.1600, lng: 124.7750, mun: "Mahinog" },
    { name: "Tupsan Pequeño, Mahinog", cat: "barangay", keywords: ["tupsan pequeno"], lat: 9.1850, lng: 124.7500, mun: "Mahinog" },
    { name: "Poblacion, Catarman", cat: "barangay", keywords: ["catarman", "poblacion catarman"], lat: 9.1280, lng: 124.6450, mun: "Catarman" },
    { name: "Bonbon, Catarman", cat: "barangay", keywords: ["bonbon"], lat: 9.2000, lng: 124.6320, mun: "Catarman" },
    { name: "Bura, Catarman", cat: "barangay", keywords: ["bura"], lat: 9.1820, lng: 124.6380, mun: "Catarman" },
    { name: "Catibac, Catarman", cat: "barangay", keywords: ["catibac"], lat: 9.1650, lng: 124.6420, mun: "Catarman" },
    { name: "Compol, Catarman", cat: "barangay", keywords: ["compol"], lat: 9.1450, lng: 124.6430, mun: "Catarman" },
    { name: "Panghiawan, Catarman", cat: "barangay", keywords: ["panghiawan"], lat: 9.1150, lng: 124.6520, mun: "Catarman" },
    { name: "Alga, Catarman", cat: "barangay", keywords: ["alga"], lat: 9.1180, lng: 124.6550, mun: "Catarman" },
    { name: "Lawigan, Catarman", cat: "barangay", keywords: ["lawigan"], lat: 9.1350, lng: 124.6410, mun: "Catarman" },
    { name: "Liloan, Catarman", cat: "barangay", keywords: ["liloan"], lat: 9.1400, lng: 124.6420, mun: "Catarman" },
    { name: "Mandawa, Catarman", cat: "barangay", keywords: ["mandawa"], lat: 9.1500, lng: 124.6430, mun: "Catarman" },
    { name: "Mainit, Catarman", cat: "barangay", keywords: ["mainit"], lat: 9.1680, lng: 124.6650, mun: "Catarman" },
    { name: "Santo Niño, Catarman", cat: "barangay", keywords: ["santo nino brgy", "santo niño"], lat: 9.1550, lng: 124.6550, mun: "Catarman" },
    { name: "Tangaro, Catarman", cat: "barangay", keywords: ["tangaro"], lat: 9.1220, lng: 124.6480, mun: "Catarman" },
    { name: "Poblacion, Sagay", cat: "barangay", keywords: ["sagay", "poblacion sagay"], lat: 9.1020, lng: 124.7210, mun: "Sagay" },
    { name: "Alangilan, Sagay", cat: "barangay", keywords: ["alangilan"], lat: 9.0950, lng: 124.7080, mun: "Sagay" },
    { name: "Bacnit, Sagay", cat: "barangay", keywords: ["bacnit"], lat: 9.1120, lng: 124.7350, mun: "Sagay" },
    { name: "Balite, Sagay", cat: "barangay", keywords: ["balite"], lat: 9.0980, lng: 124.7150, mun: "Sagay" },
    { name: "Bugang, Sagay", cat: "barangay", keywords: ["bugang"], lat: 9.1080, lng: 124.7280, mun: "Sagay" },
    { name: "Cuna, Sagay", cat: "barangay", keywords: ["cuna"], lat: 9.1050, lng: 124.7190, mun: "Sagay" },
    { name: "Manuyog, Sagay", cat: "barangay", keywords: ["manuyog"], lat: 9.0880, lng: 124.6910, mun: "Sagay" },
    { name: "Mayana, Sagay", cat: "barangay", keywords: ["mayana"], lat: 9.1150, lng: 124.7120, mun: "Sagay" },
    { name: "Poblacion, Guinsiliban", cat: "barangay", keywords: ["guinsiliban", "poblacion guinsiliban"], lat: 9.0940, lng: 124.7780, mun: "Guinsiliban" },
    { name: "Cabuan, Guinsiliban", cat: "barangay", keywords: ["cabuan"], lat: 9.1050, lng: 124.7820, mun: "Guinsiliban" },
    { name: "Cantaan, Guinsiliban", cat: "barangay", keywords: ["cantaan"], lat: 9.0810, lng: 124.7860, mun: "Guinsiliban" },
    { name: "Liong, Guinsiliban", cat: "barangay", keywords: ["liong"], lat: 9.0910, lng: 124.7720, mun: "Guinsiliban" },
    { name: "Maac, Guinsiliban", cat: "barangay", keywords: ["maac"], lat: 9.1120, lng: 124.7850, mun: "Guinsiliban" },
    { name: "Butay, Guinsiliban", cat: "barangay", keywords: ["butay"], lat: 9.0990, lng: 124.7750, mun: "Guinsiliban" },
    { name: "North Poblacion, Guinsiliban", cat: "barangay", keywords: ["north poblacion guinsiliban"], lat: 9.0960, lng: 124.7790, mun: "Guinsiliban" },
    { name: "South Poblacion, Guinsiliban", cat: "barangay", keywords: ["south poblacion guinsiliban"], lat: 9.0920, lng: 124.7770, mun: "Guinsiliban" },

    // Streets & Roads
    { name: "Camiguin Circumferential Road, Mambajao", cat: "street", keywords: ["circumferential road", "national highway", "highway"], lat: 9.2480, lng: 124.6980, mun: "Mambajao" },
    { name: "Rizal Street, Mambajao", cat: "street", keywords: ["rizal street", "rizal st", "rizal"], lat: 9.2485, lng: 124.6970, mun: "Mambajao" },
    { name: "Aranas Street, Mambajao", cat: "street", keywords: ["aranas street", "aranas st", "aranas"], lat: 9.2488, lng: 124.6975, mun: "Mambajao" },
    { name: "Burgos Street, Mambajao", cat: "street", keywords: ["burgos street", "burgos st", "burgos"], lat: 9.2482, lng: 124.6968, mun: "Mambajao" },
    { name: "Airport Road, Mambajao", cat: "street", keywords: ["airport road", "airport st"], lat: 9.2520, lng: 124.7060, mun: "Mambajao" },
    { name: "Balbagon Boulevard / Seaside Promenade", cat: "street", keywords: ["boulevard", "seaside", "baywalk"], lat: 9.2550, lng: 124.7150, mun: "Mambajao" },
    { name: "Itum Road / Mountain Route", cat: "street", keywords: ["itum road", "itum", "hinterland"], lat: 9.2250, lng: 124.6850, mun: "Mambajao" },
    { name: "Granelandia Road, Binunsaran", cat: "street", keywords: ["granelandia", "granelandia road"], lat: 9.1450, lng: 124.7680, mun: "Mahinog" },
    { name: "Utopia Road, Soro-soro", cat: "street", keywords: ["utopia", "utopia road"], lat: 9.2290, lng: 124.6860, mun: "Mambajao" }
  ];

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  let toastTimer = null;
  function showMapToast(msg) {
    if (!mapToastPill) return;
    mapToastPill.textContent = msg;
    mapToastPill.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      mapToastPill.classList.add("hidden");
    }, 3500);
  }

  function matchCamiguinPlace(str) {
    if (!str) return null;
    const s = str.trim().toLowerCase();
    // 1. Exact match
    for (const p of CAMIGUIN_PLACES) {
      if (s === p.name.toLowerCase()) return p;
      for (const k of p.keywords) {
        if (s === k) return p;
      }
    }
    // 2. Word/Substring match
    for (const p of CAMIGUIN_PLACES) {
      for (const k of p.keywords) {
        if (s.includes(k) || k.includes(s)) return p;
      }
      if (p.name.toLowerCase().includes(s)) return p;
    }
    return null;
  }

  let map;
  let pickupMarker = null;
  let dropoffMarker = null;
  let routeLine = null;
  let currentTargetMode = "pickup"; // 'pickup' or 'dropoff'

  // Service Type Switcher
  serviceTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      serviceTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const service = tab.getAttribute("data-service");
      serviceTypeInput.value = service;

      if (service === "pabili") {
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Shopping List & Store Names *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Buy For Me fee.";
      } else if (service === "pasugo") {
        if (budgetGroup) budgetGroup.classList.add("hidden");
        if (notesLabel) notesLabel.textContent = "Parcel Description / Cargo Details *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Courier delivery fee.";
      } else if (service === "pabayad") {
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Payment Details / Port Cargo Claim Number *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Port claim fee.";
      } else {
        if (budgetGroup) budgetGroup.classList.add("hidden");
        if (notesLabel) notesLabel.textContent = "Special Requests / Landmark Note";
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

  // Handle typing inside Pickup and Dropoff inputs
  function handleTypedAddress(isPickup) {
    const input = isPickup ? pickupInput : dropoffInput;
    const text = input.value.trim();
    if (text.length >= 2) {
      const found = matchCamiguinPlace(text);
      if (found) {
        if (isPickup) {
          pickupLatInput.value = found.lat;
          pickupLngInput.value = found.lng;
          if (pickupMarker) {
            pickupMarker.setLatLng([found.lat, found.lng]);
          } else if (map) {
            setPickupPoint(found.lat, found.lng, null);
          }
        } else {
          dropoffLatInput.value = found.lat;
          dropoffLngInput.value = found.lng;
          if (dropoffMarker) {
            dropoffMarker.setLatLng([found.lat, found.lng]);
          } else if (map) {
            setDropoffPoint(found.lat, found.lng, null);
          }
        }
        updateRouteLine();
      }
    }
    recalculateFare();
  }

  let typeTimer = null;
  if (pickupInput) {
    pickupInput.addEventListener("input", () => {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(true), 250);
    });
    pickupInput.addEventListener("change", () => handleTypedAddress(true));
  }

  if (dropoffInput) {
    dropoffInput.addEventListener("input", () => {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(false), 250);
    });
    dropoffInput.addEventListener("change", () => handleTypedAddress(false));
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

  // Pin on Map Handlers ("mudiritso dayun pag pin ang map")
  if (locateDropoffGpsBtn) {
    locateDropoffGpsBtn.addEventListener("click", () => {
      targetModeButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff")
      );
      currentTargetMode = "dropoff";

      const currentVal = dropoffInput ? dropoffInput.value.trim() : "";
      const found = currentVal ? matchCamiguinPlace(currentVal) : null;
      let targetLat = null;
      let targetLng = null;

      if (found) {
        targetLat = found.lat;
        targetLng = found.lng;
      } else if (dropoffLatInput.value && dropoffLngInput.value) {
        targetLat = parseFloat(dropoffLatInput.value);
        targetLng = parseFloat(dropoffLngInput.value);
      } else if (map) {
        const c = map.getCenter();
        targetLat = parseFloat(c.lat.toFixed(5));
        targetLng = parseFloat(c.lng.toFixed(5));
      } else {
        targetLat = 9.2189;
        targetLng = 124.7560;
      }

      const displayLabel = found ? found.name : (currentVal || `Pinned Drop-off (${targetLat}, ${targetLng})`);
      setDropoffPoint(targetLat, targetLng, displayLabel);
      if (map) {
        map.flyTo([targetLat, targetLng], 15, { duration: 0.8 });
      }

      const mapCard = document.querySelector(".map-column-card") || document.getElementById("booking-map");
      if (mapCard) {
        mapCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      showMapToast(`🏁 Drop-off Pinned: ${displayLabel}`);
    });
  }

  if (pinPickupMapBtn) {
    pinPickupMapBtn.addEventListener("click", () => {
      targetModeButtons.forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-target-mode") === "pickup")
      );
      currentTargetMode = "pickup";

      const currentVal = pickupInput ? pickupInput.value.trim() : "";
      const found = currentVal ? matchCamiguinPlace(currentVal) : null;
      let targetLat = null;
      let targetLng = null;

      if (found) {
        targetLat = found.lat;
        targetLng = found.lng;
      } else if (pickupLatInput.value && pickupLngInput.value) {
        targetLat = parseFloat(pickupLatInput.value);
        targetLng = parseFloat(pickupLngInput.value);
      } else if (map) {
        const c = map.getCenter();
        targetLat = parseFloat(c.lat.toFixed(5));
        targetLng = parseFloat(c.lng.toFixed(5));
      } else {
        targetLat = 9.2483;
        targetLng = 124.6975;
      }

      const displayLabel = found ? found.name : (currentVal || `Pinned Pickup (${targetLat}, ${targetLng})`);
      setPickupPoint(targetLat, targetLng, displayLabel);
      if (map) {
        map.flyTo([targetLat, targetLng], 15, { duration: 0.8 });
      }

      const mapCard = document.querySelector(".map-column-card") || document.getElementById("booking-map");
      if (mapCard) {
        mapCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      showMapToast(`🟢 Pickup Pinned: ${displayLabel}`);
    });
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
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const item = items[idx];
          if (!item) return;

          inputEl.value = item.name;
          dropdownEl.classList.add("hidden");

          // MUDIRITSO DAYUN PAG PIN ANG MAP!
          if (isPickup) {
            setPickupPoint(item.lat, item.lng, item.name);
          } else {
            setDropoffPoint(item.lat, item.lng, item.name);
          }

          if (map) {
            map.flyTo([item.lat, item.lng], 14, { duration: 0.8 });
          }

          showMapToast(`${isPickup ? "🟢 Pickup" : "🏁 Drop-off"} Pinned: ${item.name}`);
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
      setTimeout(() => dropdownEl.classList.add("hidden"), 200);
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

    map = L.map(mapEl, {
      zoomControl: true,
      maxBounds: [
        [8.90, 124.40],
        [9.50, 125.05]
      ]
    }).setView([9.2000, 124.7200], 11);

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

    // Click on map to place pin
    map.on("click", (e) => {
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));

      if (currentTargetMode === "pickup") {
        setPickupPoint(lat, lng, `Pinned Pickup (${lat}, ${lng})`);
        if (!dropoffLatInput.value) {
          document.querySelectorAll("[data-target-mode]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff"));
          currentTargetMode = "dropoff";
        }
      } else {
        setDropoffPoint(lat, lng, `Pinned Dropoff (${lat}, ${lng})`);
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
        setPickupPoint(parseFloat(pos.lat.toFixed(5)), parseFloat(pos.lng.toFixed(5)), null);
      });
    } else {
      pickupMarker.setLatLng([lat, lng]);
    }

    updateRouteLine();
  }

  function setDropoffPoint(lat, lng, label) {
    dropoffLatInput.value = lat;
    dropoffLngInput.value = lng;
    if (label) dropoffInput.value = label;

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
        setDropoffPoint(parseFloat(pos.lat.toFixed(5)), parseFloat(pos.lng.toFixed(5)), null);
      });
    } else {
      dropoffMarker.setLatLng([lat, lng]);
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
      if (routeLine) map.removeLayer(routeLine);

      // 1. Initial dashed connecting line as immediate feedback
      routeLine = L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: "#f97316",
        weight: 3,
        dashArray: "4, 6",
        opacity: 0.5,
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      // 2. Query OSRM to get the actual road path ("kalsada mismo kung asa ni agi")
      if (osrmAbortCtrl) {
        osrmAbortCtrl.abort();
      }
      osrmAbortCtrl = new AbortController();

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl, { signal: osrmAbortCtrl.signal });
        if (res.ok) {
          const osrmData = await res.json();
          if (osrmData && osrmData.code === "Ok" && osrmData.routes && osrmData.routes.length > 0) {
            const bestRoute = osrmData.routes[0];
            const roadCoords = bestRoute.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
            const roadMeters = bestRoute.distance;
            const roadKmVal = parseFloat((roadMeters / 1000.0).toFixed(2));
            currentRoadKm = roadKmVal;

            if (routeLine) map.removeLayer(routeLine);
            // Draw real road polyline snapping to Camiguin highway and local streets
            routeLine = L.polyline(roadCoords, {
              color: "#ea580c",
              weight: 5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

            // Recalculate fare using the exact road distance
            recalculateFare(roadKmVal);
            return;
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.log("OSRM client fallback to server road engine");
        }
      }
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
        if (fareKmDisplay) fareKmDisplay.textContent = `~${data.estimated_km} km (Road Distance)`;

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

        // If backend sent route coordinates (from server-side road engine) and frontend hasn't drawn yet
        if (data.route_coords && data.route_coords.length > 0 && (!currentRoadKm || hasNewCoords)) {
          const roadCoords = data.route_coords.map((pt) => [pt[1], pt[0]]);
          if (routeLine) map.removeLayer(routeLine);
          routeLine = L.polyline(roadCoords, {
            color: "#ea580c",
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
          map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
        }
      }
    } catch (_) {}
  }

  // Quick Landmark Chips
  if (landmarkChips) {
    landmarkChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip-btn");
      if (!chip) return;
      const name = chip.getAttribute("data-name");
      const lat = parseFloat(chip.getAttribute("data-lat"));
      const lng = parseFloat(chip.getAttribute("data-lng"));

      if (currentTargetMode === "pickup") {
        setPickupPoint(lat, lng, name);
        if (!dropoffLatInput.value) {
          targetModeButtons.forEach((b) => b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff"));
          currentTargetMode = "dropoff";
        }
      } else {
        setDropoffPoint(lat, lng, name);
      }
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

  // Default initial points in Mambajao
  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    setPickupPoint(9.2483, 124.6975, "Mambajao Public Market");
    setDropoffPoint(9.2553, 124.6468, "Paras Beach Resort (Yumbing)");
  });

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
      };

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
        if (modalBookingCode) modalBookingCode.textContent = b.booking_code;
        if (modalTrackLink) modalTrackLink.href = data.tracking_url;
        if (successModal) successModal.classList.remove("hidden");
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
  }
})();
