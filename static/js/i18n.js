/**
 * Camiguin Centric Riders Club — Multi-Language i18n Engine
 * Supports: English (en), Cebuano (ceb), Filipino (fil), Chinese (zh), Japanese (ja)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "ccrc_lang";
  const SUPPORTED_LANGS = ["en", "ceb", "fil", "zh", "ja"];

  const HTML_LANG_MAP = {
    en: "en",
    ceb: "ceb",
    fil: "tl",
    zh: "zh-CN",
    ja: "ja",
  };

  // Dictionary keyed by exact normalized English string
  const DICT = {
    // --- Navigation & Header ---
    "Book a Ride 🛵": {
      ceb: "Pag-book og Sakay 🛵",
      fil: "Mag-book ng Sakay 🛵",
      zh: "立即叫车 🛵",
      ja: "配車を予約 🛵",
    },
    "Live Trip 🛵": {
      ceb: "Live nga Biyahe 🛵",
      fil: "Live na Biyahe 🛵",
      zh: "实时行程 🛵",
      ja: "現在の乗車 🛵",
    },
    "Island Tours 🏝️": {
      ceb: "Island Tours 🏝️",
      fil: "Island Tours 🏝️",
      zh: "环岛游 🏝️",
      ja: "アイランドツアー 🏝️",
    },
    "Ride History 📜": {
      ceb: "History sa Biyahe 📜",
      fil: "Kasaysayan ng Biyahe 📜",
      zh: "行程记录 📜",
      ja: "乗車履歴 📜",
    },
    "Rider Hub 📱": {
      ceb: "Rider Hub 📱",
      fil: "Rider Hub 📱",
      zh: "骑手中心 📱",
      ja: "ライダーハブ 📱",
    },
    "Rider Dispatch Portal 📱": {
      ceb: "Rider Dispatch Portal 📱",
      fil: "Rider Dispatch Portal 📱",
      zh: "骑手调度中心 📱",
      ja: "ライダー配車ポータル 📱",
    },
    "Sign In": {
      ceb: "Pag-Sign In",
      fil: "Mag-Sign In",
      zh: "登录",
      ja: "ログイン",
    },
    "Install App": {
      ceb: "I-install ang App",
      fil: "I-install ang App",
      zh: "安装应用",
      ja: "アプリをインストール",
    },
    "Log Out 🚪": {
      ceb: "Log Out 🚪",
      fil: "Mag-Log Out 🚪",
      zh: "退出登录 🚪",
      ja: "ログアウト 🚪",
    },
    "Log Out": {
      ceb: "Log Out",
      fil: "Mag-Log Out",
      zh: "退出登录",
      ja: "ログアウト",
    },
    "Book": {
      ceb: "Sakay",
      fil: "Mag-book",
      zh: "叫车",
      ja: "予約",
    },
    "Live Trip": {
      ceb: "Live Biyahe",
      fil: "Live Biyahe",
      zh: "实时行程",
      ja: "乗車中",
    },
    "Tours": {
      ceb: "Tours",
      fil: "Tours",
      zh: "旅游",
      ja: "ツアー",
    },
    "History": {
      ceb: "History",
      fil: "Kasaysayan",
      zh: "记录",
      ja: "履歴",
    },
    "Riders": {
      ceb: "Riders",
      fil: "Mga Rider",
      zh: "骑手",
      ja: "ライダー",
    },
    "Refresh": {
      ceb: "I-refresh",
      fil: "I-refresh",
      zh: "刷新",
      ja: "更新",
    },
    "Camiguin Island On-Demand Express": {
      ceb: "On-Demand Express sa Isla sa Camiguin",
      fil: "On-Demand Express sa Isla ng Camiguin",
      zh: "甘米银岛即时出行与配送",
      ja: "カミギン島オンデマンド配車・配送",
    },

    // --- Footer ---
    "🏝️ Island Tours": {
      ceb: "🏝️ Island Tours",
      fil: "🏝️ Island Tours",
      zh: "🏝️ 环岛游",
      ja: "🏝️ アイランドツアー",
    },
    "📜 Ride History": {
      ceb: "📜 History sa Biyahe",
      fil: "📜 Kasaysayan ng Biyahe",
      zh: "📜 行程记录",
      ja: "📜 乗車履歴",
    },
    "ℹ️ About Us": {
      ceb: "ℹ️ Mahitungod Kanamo",
      fil: "ℹ️ Tungkol sa Amin",
      zh: "ℹ️ 关于我们",
      ja: "ℹ️ 私たちについて",
    },
    "❓ FAQs": {
      ceb: "❓ Mga Pangutana (FAQs)",
      fil: "❓ Mga Madalas Itanong",
      zh: "❓ 常见问题",
      ja: "❓ よくある質問",
    },
    "📋 Terms & Safety": {
      ceb: "📋 Mga Lagda ug Kaluwasan",
      fil: "📋 Mga Tuntunin at Kaligtasan",
      zh: "📋 条款与安全",
      ja: "📋 利用規約と安全",
    },

    // --- Home / Booking Hero & Services ---
    "CCRC Riders Online in Camiguin": {
      ceb: "ka CCRC Riders Online sa Camiguin",
      fil: "na CCRC Rider ang Online sa Camiguin",
      zh: "位 CCRC 骑手在甘米银在线",
      ja: "名のCCRCライダーがカミギンでオンライン中",
    },
    "Where are you heading today?": {
      ceb: "Asa ka padulong karon?",
      fil: "Saan ka pupunta ngayon?",
      zh: "今天您要去哪里？",
      ja: "今日はどこへ行きますか？",
    },
    "Fast, verified on-demand island transport, deliveries & errands across Camiguin Island.": {
      ceb: "Paspas ug kasaligan nga sakay, padala, ug pabili sa tibuok Isla sa Camiguin.",
      fil: "Mabilis at beripikadong sakay, padala, at pabili sa buong Isla ng Camiguin.",
      zh: "甘米银全岛快速、认证的即时摩的出行、快递与代购服务。",
      ja: "カミギン島全域で迅速・認証済みのバイク配車、配送、おつかいサービス。",
    },
    "Passenger": {
      ceb: "Pasahero",
      fil: "Pasahero",
      zh: "乘客出行",
      ja: "乗客",
    },
    "Motorcycle Ride": {
      ceb: "Habal-habal",
      fil: "Sakay sa Motor",
      zh: "摩的接送",
      ja: "バイク配車",
    },
    "Courier": {
      ceb: "Padala",
      fil: "Padala",
      zh: "同城快递",
      ja: "宅配・配送",
    },
    "Delivery (+₱20)": {
      ceb: "Hatod (+₱20)",
      fil: "Paghatid (+₱20)",
      zh: "配送 (+₱20)",
      ja: "配送 (+₱20)",
    },
    "Errand": {
      ceb: "Pabili",
      fil: "Pabili",
      zh: "跑腿代购",
      ja: "おつかい",
    },
    "Shopping (+₱20)": {
      ceb: "Palit (+₱20)",
      fil: "Pamimili (+₱20)",
      zh: "代购 (+₱20)",
      ja: "買い物代行 (+₱20)",
    },
    "Port & Bills": {
      ceb: "Port ug Bayad",
      fil: "Port at Bayarin",
      zh: "港口与缴费",
      ja: "港・支払い",
    },
    "Baggage (+₱20)": {
      ceb: "Bagahe (+₱20)",
      fil: "Bagahe (+₱20)",
      zh: "行李 (+₱20)",
      ja: "荷物 (+₱20)",
    },

    // --- Booking Form & Route Box ---
    "PICKUP / MEETING POINT": {
      ceb: "ASA KUHAON (PICKUP)",
      fil: "LUGAR NG PICKUP",
      zh: "上车 / 取件地点",
      ja: "乗車 / 集荷場所",
    },
    "DESTINATION / DROP-OFF": {
      ceb: "ASA IHATOD (DROP-OFF)",
      fil: "DESTINASYON / DROP-OFF",
      zh: "目的地 / 送达地点",
      ja: "目的地 / 降車場所",
    },
    "Where should the rider pick you up?": {
      ceb: "Asa ka kuhaon sa rider?",
      fil: "Saan ka susunduin ng rider?",
      zh: "骑手应该在哪里接您？",
      ja: "どこでピックアップしますか？",
    },
    "Where are you going in Camiguin?": {
      ceb: "Asa ka padulong sa Camiguin?",
      fil: "Saan ka pupunta sa Camiguin?",
      zh: "您在甘米银要去哪里？",
      ja: "カミギンのどこへ行きますか？",
    },
    "My GPS": {
      ceb: "Akong GPS",
      fil: "Aking GPS",
      zh: "我的定位",
      ja: "現在地GPS",
    },
    "Map": {
      ceb: "Mapa",
      fil: "Mapa",
      zh: "地图",
      ja: "地図",
    },
    "Pin Map": {
      ceb: "I-pin sa Mapa",
      fil: "I-pin sa Mapa",
      zh: "地图选点",
      ja: "地図で指定",
    },
    "Popular Destinations:": {
      ceb: "Mga Sikat nga Adtoan:",
      fil: "Mga Sikat na Destinasyon:",
      zh: "热门目的地：",
      ja: "人気の目的地：",
    },
    "📦 Package / Errand Details": {
      ceb: "📦 Detalye sa Padala / Pabili",
      fil: "📦 Detalye ng Padala / Pabili",
      zh: "📦 包裹 / 代购详情",
      ja: "📦 荷物・おつかいの詳細",
    },
    "Item / Store Description *": {
      ceb: "Deskripsyon sa Paliton / Ipadala *",
      fil: "Detalye ng Bibilhin / Ipapadala *",
      zh: "物品 / 商店说明 *",
      ja: "商品・店舗の詳細 *",
    },
    "List food items, grocery items, store names, or special instructions...": {
      ceb: "Ilista ang pagkaon, grocery, ngalan sa tindahan, o espesyal nga tugon...",
      fil: "Ilista ang pagkain, grocery, pangalan ng tindahan, o espesyal na bilin...",
      zh: "请列出食品、日用品、商店名称或特殊说明...",
      ja: "食品、日用品、店名、または特別な指示を入力してください...",
    },
    "👤 Passenger / Sender Information": {
      ceb: "👤 Impormasyon sa Pasahero / Nagpadala",
      fil: "👤 Impormasyon ng Pasahero / Nagpadala",
      zh: "👤 乘客 / 寄件人信息",
      ja: "👤 乗客 / 依頼者情報",
    },
    "Your Full Name *": {
      ceb: "Imong Tibuok Ngalan *",
      fil: "Iyong Buong Pangalan *",
      zh: "您的全名 *",
      ja: "お名前（フルネーム）*",
    },
    "Mobile / WhatsApp Number *": {
      ceb: "Numero sa Mobile / WhatsApp *",
      fil: "Numero sa Mobile / WhatsApp *",
      zh: "手机 / WhatsApp 号码 *",
      ja: "携帯 / WhatsApp 番号 *",
    },
    "🔒 Secure and verify this phone number with a Password (Verified Passenger Badge 🛡️)": {
      ceb: "🔒 I-secure ug i-verify kini nga phone number gamit ang Password (Verified Badge 🛡️)",
      fil: "🔒 I-secure at i-verify ang numerong ito gamit ang Password (Verified Badge 🛡️)",
      zh: "🔒 使用密码保护并验证此手机号（认证乘客徽章 🛡️）",
      ja: "🔒 パスワードでこの電話番号を保護・認証する（認証済みバッジ 🛡️）",
    },
    "⏰ Ride Timing": {
      ceb: "⏰ Oras sa Biyahe",
      fil: "⏰ Oras ng Biyahe",
      zh: "⏰ 用车时间",
      ja: "⏰ 配車時間",
    },
    "Now (On-Demand)": {
      ceb: "Karon Dayon",
      fil: "Ngayon Na",
      zh: "现在立即出发",
      ja: "今すぐ（即時配車）",
    },
    "Nearest rider dispatches right away": {
      ceb: "Pinakaduol nga rider mo-biyahe dayon",
      fil: "Pinakamalapit na rider ay aalis agad",
      zh: "最近的骑手将立即接单出发",
      ja: "最寄りのライダーがすぐに向かいます",
    },
    "Schedule Later 📅": {
      ceb: "I-schedule Unya 📅",
      fil: "I-schedule Mamaya 📅",
      zh: "预约稍后出发 📅",
      ja: "日時を予約 📅",
    },
    "Set date & pickup time": {
      ceb: "Pilia ang petsa ug oras",
      fil: "Itakda ang petsa at oras",
      zh: "设置日期和上车时间",
      ja: "日付と乗車時刻を指定",
    },
    "💳 Payment Method": {
      ceb: "💳 Pamaagi sa Bayad",
      fil: "💳 Paraan ng Pagbabayad",
      zh: "💳 支付方式",
      ja: "💳 お支払い方法",
    },
    "Cash": {
      ceb: "Cash (Kwarta)",
      fil: "Cash",
      zh: "现金",
      ja: "現金",
    },
    "Pay upon arrival": {
      ceb: "Bayad inig abot",
      fil: "Bayad pagdating",
      zh: "到达后付款",
      ja: "到着時にお支払い",
    },
    "🎟️ Promo Code Voucher": {
      ceb: "🎟️ Promo Code Voucher",
      fil: "🎟️ Promo Code Voucher",
      zh: "🎟️ 优惠码",
      ja: "🎟️ プロモコード",
    },
    "Apply": {
      ceb: "Gamita",
      fil: "Ilapat",
      zh: "应用",
      ja: "適用",
    },
    "🏝️ Planning an Island Tour?": {
      ceb: "🏝️ Nagplano og Island Tour?",
      fil: "🏝️ Nagpaplano ng Island Tour?",
      zh: "🏝️ 计划环岛游吗？",
      ja: "🏝️ アイランドツアーをご計画ですか？",
    },
    "Explore White Island, Sunken Cemetery, & Falls packages.": {
      ceb: "Tan-awa ang mga package sa White Island, Sunken Cemetery, ug Falls.",
      fil: "Tuklasin ang mga package para sa White Island, Sunken Cemetery, at Falls.",
      zh: "探索白岛、沉没公墓及瀑布套餐。",
      ja: "ホワイトアイランド、サンケンセメトリー、滝巡りプランを見る。",
    },
    "View Tours →": {
      ceb: "Tan-awa ang Tours →",
      fil: "Tingnan ang Tours →",
      zh: "查看套餐 →",
      ja: "ツアーを見る →",
    },
    "Estimated Fare": {
      ceb: "Gibanabana nga Plete",
      fil: "Tinatayang Pamasahe",
      zh: "预估车费",
      ja: "予想料金",
    },
    "Meter Fare:": {
      ceb: "Base sa Metro:",
      fil: "Metro ng Pamasahe:",
      zh: "基础里程费：",
      ja: "基本メーター：",
    },
    "Service Fee:": {
      ceb: "Bayad sa Serbisyo:",
      fil: "Bayad sa Serbisyo:",
      zh: "服务费：",
      ja: "サービス料：",
    },
    "Supermarket Queue:": {
      ceb: "Linya sa Tindahan:",
      fil: "Pila sa Supermarket:",
      zh: "商超排队费：",
      ja: "スーパー待ち料金：",
    },
    "Extra Stops:": {
      ceb: "Dugang Hunongan:",
      fil: "Dagdag na Hinto:",
      zh: "额外停靠点：",
      ja: "追加立ち寄り：",
    },
    "Bulky Order:": {
      ceb: "Dagko nga Order:",
      fil: "Malaking Order:",
      zh: "大件订单费：",
      ja: "大型注文料：",
    },
    "Steep / Upland Route (Auto-Added)": {
      ceb: "Tungason / Bukid nga Dalan (Auto-Added)",
      fil: "Matarik / Bundok na Ruta (Auto-Added)",
      zh: "陡坡 / 山地路段（已自动加收）",
      ja: "急坂・山岳ルート（自動加算）",
    },
    "Mountain / Steep Route": {
      ceb: "Bukid / Tungason nga Dalan",
      fil: "Bundok / Matarik na Ruta",
      zh: "山地 / 陡坡路段",
      ja: "山岳・急坂ルート",
    },
    "Hinterland / Mountain Route (+₱30)": {
      ceb: "Bukid / Tungason nga Ruta (+₱30)",
      fil: "Bundok / Matarik na Ruta (+₱30)",
      zh: "山地 / 陡坡路段 (+₱30)",
      ja: "山岳・急坂ルート (+₱30)",
    },
    "Auto-added for steep climbs: Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon": {
      ceb: "Awtomatikong dugang sa mga tungason: Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon",
      fil: "Awtomatikong idinaragdag sa matatarik na ruta: Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon",
      zh: "陡坡路段自动加收：Soro-soro、Utopia、Highland、Ardent、Katibawasan、Binunsaran、Tagdo、Timogsay、Upper Cogon",
      ja: "急坂エリア自動適用：Soro-soro、Utopia、Highland、Ardent、Katibawasan、Binunsaran、Tagdo、Timogsay、Upper Cogon",
    },
    "+₱30 auto-added for steep climbs (Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon, etc.)": {
      ceb: "+₱30 awtomatikong dugang sa mga tungason (Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon, uban pa)",
      fil: "+₱30 awtomatikong idinaragdag sa matatarik na ruta (Soro-soro, Utopia, Highland, Ardent, Katibawasan, Binunsaran, Tagdo, Timogsay, Upper Cogon, atbp.)",
      zh: "陡坡路段自动加收 +₱30（Soro-soro、Utopia、Highland、Ardent、Katibawasan、Binunsaran、Tagdo、Timogsay、Upper Cogon 等）",
      ja: "急坂ルートで自動加算 +₱30（Soro-soro、Utopia、Highland、Ardent、Katibawasan、Binunsaran、Tagdo、Timogsay、Upper Cogon など）",
    },
    "🛣️ Road Route": {
      ceb: "🛣️ Ruta sa Kalsada",
      fil: "🛣️ Ruta sa Kalsada",
      zh: "🛣️ 道路路线",
      ja: "🛣️ 道路ルート",
    },
    "Official Island Tariff: 1-2 km = ₱40 base, ₱18 per succeeding road km. Follows real road routes!": {
      ceb: "Opisyal nga Taripa: 1-2 km = ₱40 base, ₱18 matag dugang km sa kalsada. Subay sa tinuod nga rota!",
      fil: "Opisyal na Taripa: 1-2 km = ₱40 base, ₱18 bawat dagdag na km sa kalsada. Tunay na ruta!",
      zh: "官方岛屿收费标准：1-2公里起步价 ₱40，之后每公里 ₱18，按实际道路计算！",
      ja: "公式島内料金：1〜2km基本料金₱40、以降1kmごとに₱18。実際の道路ルートで計算！",
    },
    "📋 View Official Island Tariff Matrix": {
      ceb: "📋 Tan-awa ang Opisyal nga Taripa Matrix",
      fil: "📋 Tingnan ang Opisyal na Taripa Matrix",
      zh: "📋 查看官方收费标准表",
      ja: "📋 公式料金表を見る",
    },
    "Broadcast Request to Active Riders 🛵": {
      ceb: "I-broadcast ang Request sa mga Riders 🛵",
      fil: "I-broadcast ang Request sa mga Rider 🛵",
      zh: "向在线骑手发送订单 🛵",
      ja: "オンラインのライダーにリクエスト送信 🛵",
    },

    // --- Map Controls & Legend ---
    "Tap Map to Set:": {
      ceb: "I-tap ang Mapa para sa:",
      fil: "I-tap ang Mapa upang Itakda:",
      zh: "点击地图设置：",
      ja: "地図をタップして設定：",
    },
    "🟢 Pickup": {
      ceb: "🟢 Pickup",
      fil: "🟢 Pickup",
      zh: "🟢 上车点",
      ja: "🟢 乗車地",
    },
    "🔴 Drop-off": {
      ceb: "🔴 Drop-off",
      fil: "🔴 Drop-off",
      zh: "🔴 目的地",
      ja: "🔴 目的地",
    },
    "🗺️ Street": {
      ceb: "🗺️ Kalsada",
      fil: "🗺️ Kalsada",
      zh: "🗺️ 街道",
      ja: "🗺️ 地図",
    },
    "🛰️ Satellite": {
      ceb: "🛰️ Satellite",
      fil: "🛰️ Satellite",
      zh: "🛰️ 卫星",
      ja: "🛰️ 航空写真",
    },
    "My Location": {
      ceb: "Akong Lokasyon",
      fil: "Aking Lokasyon",
      zh: "我的位置",
      ja: "現在地",
    },
    "Expand": {
      ceb: "Padak-a",
      fil: "Palakihin",
      zh: "全屏",
      ja: "拡大",
    },
    "Close": {
      ceb: "Sirad-i",
      fil: "Isara",
      zh: "关闭",
      ja: "閉じる",
    },
    "Pickup": {
      ceb: "Pickup",
      fil: "Pickup",
      zh: "上车点",
      ja: "乗車地",
    },
    "Drop-off": {
      ceb: "Drop-off",
      fil: "Drop-off",
      zh: "目的地",
      ja: "目的地",
    },
    "Road Route": {
      ceb: "Ruta sa Kalsada",
      fil: "Ruta sa Kalsada",
      zh: "道路路线",
      ja: "道路ルート",
    },
    "Verified Rider": {
      ceb: "Verified nga Rider",
      fil: "Beripikadong Rider",
      zh: "认证骑手",
      ja: "認証済みライダー",
    },

    // --- Customer Auth Modal ---
    "Passenger Sign In & Verification": {
      ceb: "Sign In ug Verification sa Pasahero",
      fil: "Pag-Sign In at Beripikasyon ng Pasahero",
      zh: "乘客登录与认证",
      ja: "乗客ログイン・認証",
    },
    "Register": {
      ceb: "Pag-register",
      fil: "Mag-register",
      zh: "注册",
      ja: "新規登録",
    },
    "Phone Number or Email *": {
      ceb: "Numero sa Phone o Email *",
      fil: "Numero ng Telepono o Email *",
      zh: "手机号或邮箱 *",
      ja: "電話番号またはメール *",
    },
    "Password *": {
      ceb: "Password *",
      fil: "Password *",
      zh: "密码 *",
      ja: "パスワード *",
    },
    "Forgot Password?": {
      ceb: "Nakalimot sa Password?",
      fil: "Nakalimutan ang Password?",
      zh: "忘记密码？",
      ja: "パスワードをお忘れですか？",
    },
    "Log In to CCRC →": {
      ceb: "Log In sa CCRC →",
      fil: "Mag-Log In sa CCRC →",
      zh: "登录 CCRC →",
      ja: "CCRCにログイン →",
    },
    "Full Name *": {
      ceb: "Tibuok Ngalan *",
      fil: "Buong Pangalan *",
      zh: "全名 *",
      ja: "氏名 *",
    },
    "Philippine Mobile Number *": {
      ceb: "Numero sa Mobile sa Pilipinas *",
      fil: "Numero ng Mobile sa Pilipinas *",
      zh: "菲律宾手机号码 *",
      ja: "フィリピン携帯番号 *",
    },
    "Email Address *": {
      ceb: "Email Address *",
      fil: "Email Address *",
      zh: "电子邮箱 *",
      ja: "メールアドレス *",
    },
    "Passenger Profile Picture *": {
      ceb: "Litrato sa Pasahero *",
      fil: "Larawan ng Pasahero *",
      zh: "乘客头像 *",
      ja: "プロフィール写真 *",
    },
    "📷 Camera": {
      ceb: "📷 Kamera",
      fil: "📷 Kamera",
      zh: "📷 拍照",
      ja: "📷 カメラ",
    },
    "🖼️ Gallery": {
      ceb: "🖼️ Gallery",
      fil: "🖼️ Gallery",
      zh: "🖼️ 相册",
      ja: "🖼️ ギャラリー",
    },
    "Take a photo with your camera or choose from gallery.": {
      ceb: "Kuhaa sa kamera o pagpili sa gallery.",
      fil: "Kumuha ng larawan gamit ang kamera o pumili sa gallery.",
      zh: "使用相机拍照或从相册选择。",
      ja: "カメラで撮影するかギャラリーから選択してください。",
    },
    "Register & Get Verified Badge 🛡️": {
      ceb: "Pag-register ug Kuhaa ang Verified Badge 🛡️",
      fil: "Mag-register at Kunin ang Verified Badge 🛡️",
      zh: "注册并获取认证徽章 🛡️",
      ja: "登録して認証バッジを取得 🛡️",
    },
    "Save New Password →": {
      ceb: "I-save ang Bag-ong Password →",
      fil: "I-save ang Bagong Password →",
      zh: "保存新密码 →",
      ja: "新しいパスワードを保存 →",
    },
    "← Back to Log In": {
      ceb: "← Balik sa Log In",
      fil: "← Bumalik sa Log In",
      zh: "← 返回登录",
      ja: "← ログインに戻る",
    },

    // --- Customer Home History & History Page ---
    "Total Rides Booked": {
      ceb: "Total nga Biyahe",
      fil: "Kabuuang Biyahe",
      zh: "累计叫车次数",
      ja: "累計予約回数",
    },
    "Total Spent (Fare)": {
      ceb: "Total nga Nagasto",
      fil: "Kabuuang Nagastos",
      zh: "累计消费车费",
      ja: "累計利用料金",
    },
    "📜 View Full History →": {
      ceb: "📜 Tan-awa ang Tibuok History →",
      fil: "📜 Tingnan ang Buong Kasaysayan →",
      zh: "📜 查看完整记录 →",
      ja: "📜 すべての履歴を見る →",
    },
    "Total Trips": {
      ceb: "Total nga Biyahe",
      fil: "Kabuuang Biyahe",
      zh: "总行程数",
      ja: "総乗車回数",
    },

    // --- Tours Page ---
    "🏝️ Camiguin Island Tour Packages": {
      ceb: "🏝️ Mga Island Tour Package sa Camiguin",
      fil: "🏝️ Mga Island Tour Package sa Camiguin",
      zh: "🏝️ 甘米银岛环岛游套餐",
      ja: "🏝️ カミギン島ツアーパッケージ",
    },
    "Club Riders Available for Island Tours": {
      ceb: "ka Club Riders Andam para sa Island Tours",
      fil: "na Club Rider ang Handa para sa Island Tours",
      zh: "位俱乐部骑手可提供环岛游服务",
      ja: "名のクラブライダーがツアー対応可能",
    },
    "Book This Island Tour →": {
      ceb: "I-book Kini nga Tour →",
      fil: "I-book ang Tour na Ito →",
      zh: "预订此环岛游 →",
      ja: "このツアーを予約 →",
    },
    "Custom Ride Booking →": {
      ceb: "Custom nga Biyahe →",
      fil: "Custom na Pag-book →",
      zh: "定制路线叫车 →",
      ja: "カスタム配車を予約 →",
    },

    // --- Track Page ---
    "Focus on Rider": {
      ceb: "I-focus sa Rider",
      fil: "I-focus sa Rider",
      zh: "定位骑手",
      ja: "ライダーに焦点",
    },
    "📞 Call Rider": {
      ceb: "📞 Tawagi ang Rider",
      fil: "📞 Tawagan ang Rider",
      zh: "📞 致电骑手",
      ja: "📞 ライダーに電話",
    },
    "💬 Send SMS": {
      ceb: "💬 Padala og SMS",
      fil: "💬 Magpadala ng SMS",
      zh: "💬 发送短信",
      ja: "💬 SMS送信",
    },
    "Live Chat with Rider": {
      ceb: "Live Chat sa Rider",
      fil: "Live Chat sa Rider",
      zh: "与骑手实时聊天",
      ja: "ライダーとチャット",
    },
    "Rate Your Island Rider": {
      ceb: "I-rate ang Imong Rider",
      fil: "I-rate ang Iyong Rider",
      zh: "评价您的骑手",
      ja: "ライダーを評価",
    },
    "Submit 5-Star Rating →": {
      ceb: "Ipasa ang 5-Star Rating →",
      fil: "Isumite ang 5-Star Rating →",
      zh: "提交五星好评 →",
      ja: "5つ星評価を送信 →",
    },
    "✓ Delivered! Thank you for using CCRC.": {
      ceb: "✓ Nahuman na! Daghang salamat sa paggamit sa CCRC.",
      fil: "✓ Naihatid na! Salamat sa paggamit ng CCRC.",
      zh: "✓ 已送达！感谢您使用 CCRC。",
      ja: "✓ 完了しました！CCRCをご利用いただきありがとうございます。",
    },
    "Back to Dashboard": {
      ceb: "Balik sa Dashboard",
      fil: "Bumalik sa Dashboard",
      zh: "返回主页",
      ja: "ダッシュボードに戻る",
    },
    "View Ride History": {
      ceb: "Tan-awa ang Ride History",
      fil: "Tingnan ang Kasaysayan",
      zh: "查看行程记录",
      ja: "乗車履歴を見る",
    },

    // --- Rider Portal ---
    "Log In as Rider →": {
      ceb: "Log In isip Rider →",
      fil: "Mag-Log In bilang Rider →",
      zh: "骑手登录 →",
      ja: "ライダーとしてログイン →",
    },
    "New Rider? Register Here": {
      ceb: "Bag-ong Rider? Pag-register Dinhi",
      fil: "Bagong Rider? Mag-register Dito",
      zh: "新骑手？点击注册",
      ja: "新規ライダー登録はこちら",
    },
    "Route": {
      ceb: "Ruta",
      fil: "Ruta",
      zh: "路线",
      ja: "ルート",
    },
    "Fellow Online Riders": {
      ceb: "Kauban nga Online Riders",
      fil: "Mga Kasamang Online na Rider",
      zh: "在线骑手伙伴",
      ja: "オンライン中の仲間ライダー",
    },
    "⭐ Customer Ratings & Feedback": {
      ceb: "⭐ Mga Rating ug Komento sa Pasahero",
      fil: "⭐ Mga Rating at Komento ng Pasahero",
      zh: "⭐ 乘客评分与评价",
      ja: "⭐ 乗客からの評価・フィードバック",
    },
    "Comments and star ratings from your passengers": {
      ceb: "Mga komento ug grado gikan sa imong mga pasahero",
      fil: "Mga komento at star rating mula sa iyong mga pasahero",
      zh: "来自乘客的评价与星级评分",
      ja: "乗客からのコメントと星評価",
    },
    "No customer reviews yet. Complete trips to start receiving 5-star ratings!": {
      ceb: "Wala pay customer review. Kompletoha ang mga biyahe aron makadawat og 5-star ratings!",
      fil: "Wala pang review ng customer. Kumpletuhin ang mga biyahe upang makatanggap ng 5-star rating!",
      zh: "暂无乘客评价。完成订单即可获得五星好评！",
      ja: "まだレビューはありません。乗車を完了して5つ星評価を受け取りましょう！",
    },
    "Log Out of Rider Account": {
      ceb: "Log Out sa Rider Account",
      fil: "Mag-Log Out sa Rider Account",
      zh: "退出骑手账号",
      ja: "ライダーアカウントからログアウト",
    },

    // --- Emergency Transfer / Re-Broadcast ---
    "⚠️ Flat Tire / Emergency Transfer": {
      ceb: "⚠️ Na-flat / Emergency Transfer",
      fil: "⚠️ Na-flat / Emergency Transfer",
      zh: "⚠️ 爆胎 / 紧急转单",
      ja: "⚠️ パンク・緊急引き継ぎ",
    },
    "🔄 Emergency Transfer / Handover Trip": {
      ceb: "🔄 Emergency Transfer / Puli nga Biyahe",
      fil: "🔄 Emergency Transfer / Salong Biyahe",
      zh: "🔄 紧急转单 / 行程交接",
      ja: "🔄 緊急引き継ぎ・交代配車",
    },
    "🚨 Rider Emergency Handover Notice": {
      ceb: "🚨 Pahibalo sa Emergency Rider Handover",
      fil: "🚨 Abiso sa Emergency Rider Handover",
      zh: "🚨 骑手紧急交接通知",
      ja: "🚨 ライダー緊急引き継ぎのお知らせ",
    },
    "Emergency Transfer / Re-Broadcast": {
      ceb: "Emergency Transfer / I-Broadcast Pag-usab",
      fil: "Emergency Transfer / I-Broadcast Muli",
      zh: "紧急转单 / 重新广播派单",
      ja: "緊急引き継ぎ / 再ブロードキャスト",
    },
    "Hand over this trip safely to another CCRC rider": {
      ceb: "Ipasa kini nga biyahe nga luwas ngadto sa laing CCRC rider",
      fil: "Ipasa nang ligtas ang biyaheng ito sa ibang CCRC rider",
      zh: "安全地将此订单交接给另一位 CCRC 骑手",
      ja: "この乗車を他のCCRCライダーへ安全に引き継ぎます",
    },
    "Reason for Transfer *": {
      ceb: "Rason sa Pag-transfer *",
      fil: "Dahilan ng Pag-transfer *",
      zh: "转单原因 *",
      ja: "引き継ぎ理由 *",
    },
    "Exact Meetup Note for Rescue Rider & Customer (Optional)": {
      ceb: "Detalye sa Lugar para sa Mopuli nga Rider ug Pasahero (Opsyonal)",
      fil: "Eksaktong Lugar para sa Sasalo na Rider at Pasahero (Opsyonal)",
      zh: "给接替骑手和乘客的具体碰面说明（可选）",
      ja: "交代ライダーと乗客への待ち合わせメモ（任意）",
    },
    "e.g., Waiting near Balbagon Crossing sari-sari store...": {
      ceb: "pananglitan: Naghulat duol sa Balbagon Crossing tindahan...",
      fil: "halimbawa: Naghihintay malapit sa tindahan sa Balbagon Crossing...",
      zh: "例如：在 Balbagon Crossing 小店附近等候...",
      ja: "例：Balbagon Crossingの売店付近で待機中...",
    },
    "Update pickup pin to my current GPS location": {
      ceb: "I-update ang pickup pin sa akong karon nga GPS location",
      fil: "I-update ang pickup pin sa kasalukuyan kong lokasyon ng GPS",
      zh: "将上车点位置更新为我当前的 GPS 位置",
      ja: "ピックアップ地点を現在のGPS位置に更新する",
    },
    "Useful if you already picked up the passenger or stopped along the road.": {
      ceb: "Gamit kini kung nakasakay na ang pasahero o nihunong ka sa daplin sa dalan.",
      fil: "Gamitin ito kung nakasakay na ang pasahero o huminto ka sa daan.",
      zh: "若已接到乘客或在路边停车等待交接，建议勾选此项。",
      ja: "すでに乗客を乗せている場合や路肩で待機している場合に便利です。",
    },
    "Set my status to Offline after transfer": {
      ceb: "Himoon nga Offline akong status pagkahuman sa transfer",
      fil: "Gawing Offline ang status ko pagkatapos ng transfer",
      zh: "转单后将我的状态设为离线",
      ja: "引き継ぎ後にステータスをオフラインにする",
    },
    "Prevents new dispatch alerts while you fix your motorcycle.": {
      ceb: "Aron dili na mag-alert samtang nag-ayo pa ka sa imong motor.",
      fil: "Para hindi makatanggap ng bagong alert habang inaayos ang motor.",
      zh: "防止您在修车期间收到新的派单提醒。",
      ja: "バイク修理中に新しい配車通知が届かないようにします。",
    },
    "Option 1: Direct Transfer to Nearby Co-Rider": {
      ceb: "Opsyon 1: Direkta nga Transfer sa Duol nga Kauban nga Rider",
      fil: "Opsyon 1: Direktang Transfer sa Malapit na Kasamang Rider",
      zh: "方式 1：直接转交附近的在线骑手",
      ja: "方法1：近くの仲間ライダーへ直接引き継ぎ",
    },
    "Checking online co-riders...": {
      ceb: "Nagsusi sa mga online nga kauban nga riders...",
      fil: "Sinusuri ang mga online na kasamang rider...",
      zh: "正在查看在线骑手伙伴...",
      ja: "オンラインの仲間ライダーを確認中...",
    },
    "Option 2: Urgent Broadcast to All Online Riders": {
      ceb: "Opsyon 2: Dalian nga Broadcast sa Tanang Online Riders",
      fil: "Opsyon 2: Agarang Broadcast sa Lahat ng Online na Rider",
      zh: "方式 2：向所有在线骑手紧急重新广播",
      ja: "方法2：全オンラインライダーへ緊急再ブロードキャスト",
    },
    "📡 Re-Broadcast to All Online Riders (Urgent)": {
      ceb: "📡 I-Broadcast Pag-usab sa Tanang Online Riders (Urgent)",
      fil: "📡 I-Broadcast Muli sa Lahat ng Online na Rider (Urgent)",
      zh: "📡 向所有在线骑手紧急重新广播",
      ja: "📡 全オンラインライダーへ緊急再配信",
    },
    "Original fare stays unchanged and the customer will be notified automatically.": {
      ceb: "Magpabilin ang orihinal nga plete ug awtomatikong pahibal-on ang pasahero.",
      fil: "Mananatili ang orihinal na pamasahe at awtomatikong aabisuhan ang pasahero.",
      zh: "原车费保持不变，系统将自动通知乘客。",
      ja: "元の料金は変更されず、乗客にも自動で通知されます。",
    },
    "Transfer Now": {
      ceb: "I-transfer Karon",
      fil: "I-transfer Ngayon",
      zh: "立即转交",
      ja: "今すぐ引き継ぐ",
    },
    "Busy": {
      ceb: "Naa pay Biyahe",
      fil: "May Biyahe Pa",
      zh: "忙碌中",
      ja: "対応中",
    },
    "Available": {
      ceb: "Bakante",
      fil: "Bakante",
      zh: "空闲可接单",
      ja: "空き",
    },
    "🚨 EMERGENCY TRANSFER": {
      ceb: "🚨 EMERGENCY TRANSFER",
      fil: "🚨 EMERGENCY TRANSFER",
      zh: "🚨 紧急转单",
      ja: "🚨 緊急引き継ぎ",
    },
    "🔄 Transfer to Rider": {
      ceb: "🔄 Ipasa sa Laing Rider",
      fil: "🔄 Ilipat sa Ibang Rider",
      zh: "🔄 转单给其他骑手",
      ja: "🔄 他のライダーへ引き継ぐ",
    },
    "⚠️ Transfer to Rider (Flat / Emergency)": {
      ceb: "⚠️ Ipasa sa Laing Rider (Na-flat / Emergency)",
      fil: "⚠️ Ilipat sa Ibang Rider (Na-flat / Emergency)",
      zh: "⚠️ 转单给其他骑手（爆胎 / 紧急情况）",
      ja: "⚠️ 他のライダーへ引き継ぐ（パンク・緊急）",
    },
    "Transfer Booking to Rider": {
      ceb: "Ipasa ang Booking sa Laing Rider",
      fil: "Ilipat ang Booking sa Ibang Rider",
      zh: "将订单转交给其他骑手",
      ja: "予約を他のライダーへ引き継ぐ",
    },
    "Select an online rider or re-broadcast this trip": {
      ceb: "Pilia ang online rider o i-broadcast pag-usab kining biyahe",
      fil: "Pumili ng online rider o i-broadcast muli ang biyaheng ito",
      zh: "选择一位在线骑手或重新广播此订单",
      ja: "オンラインのライダーを選択するか再配信してください",
    },
    "Option 1: Direct Transfer to Online Rider": {
      ceb: "Opsyon 1: Direkta nga Transfer sa Online Rider",
      fil: "Opsyon 1: Direktang Transfer sa Online Rider",
      zh: "方式 1：直接转交在线骑手",
      ja: "方法1：オンラインライダーへ直接引き継ぎ",
    },
    "Option 2: Broadcast to All Online Riders": {
      ceb: "Opsyon 2: I-Broadcast sa Tanang Online Riders",
      fil: "Opsyon 2: I-Broadcast sa Lahat ng Online na Rider",
      zh: "方式 2：向所有在线骑手广播",
      ja: "方法2：全オンラインライダーへ配信",
    },
    "Actions": {
      ceb: "Mga Aksyon",
      fil: "Mga Aksyon",
      zh: "操作",
      ja: "操作",
    },
    "Accept a booking or select an active/scheduled trip to enable direct emergency trip transfer to an online co-rider.": {
      ceb: "Pagdawat una og booking o ablihi ang aktibo/naka-schedule nga biyahe aron ma-enable ang direkta nga pagpasa sa kauban nga online rider.",
      fil: "Tumanggap muna ng booking o pumili ng aktibo/naka-schedule na biyahe upang ma-enable ang direktang paglipat sa online na kasamang rider.",
      zh: "接单或选择进行中/预约行程后，即可直接将订单转交给在线骑手伙伴。",
      ja: "予約を受注するか進行中・予約済みの乗車を選択すると、オンラインの仲間ライダーへ直接引き継ぎできます。",
    },

    // --- Free In-App Voice Call & Voice Messages ---
    "Free In-App Voice Call": {
      ceb: "Libreng Tawag sa App",
      fil: "Libreng Tawag sa App",
      zh: "免费应用内语音通话",
      ja: "アプリ内無料音声通話",
    },
    "🔊 Free In-App Call": {
      ceb: "🔊 Libreng Tawag sa App",
      fil: "🔊 Libreng Tawag sa App",
      zh: "🔊 免费语音通话",
      ja: "🔊 無料アプリ内通話",
    },
    "📞 Phone Call": {
      ceb: "📞 Tawag sa Cellphone",
      fil: "📞 Tawag sa Telepono",
      zh: "📞 手机电话拨打",
      ja: "📞 通常電話でかける",
    },
    "📞 Call": {
      ceb: "📞 Tawag",
      fil: "📞 Tawag",
      zh: "📞 通话",
      ja: "📞 通話",
    },
    "Start Free In-App Voice Call": {
      ceb: "Sugdi ang Libreng Tawag sa App",
      fil: "Simulan ang Libreng Tawag sa App",
      zh: "发起免费应用内语音通话",
      ja: "アプリ内無料通話を開始",
    },
    "Connecting...": {
      ceb: "Nagkonektar...",
      fil: "Kumokonekta...",
      zh: "正在连接...",
      ja: "接続中...",
    },
    "Calling...": {
      ceb: "Nagtawag...",
      fil: "Tumatawag...",
      zh: "正在呼叫...",
      ja: "発信中...",
    },
    "✕ Decline": {
      ceb: "✕ Balibaran",
      fil: "✕ Tanggihan",
      zh: "✕ 拒绝",
      ja: "✕ 拒否",
    },
    "📞 Answer": {
      ceb: "📞 Tubaga",
      fil: "📞 Sagutin",
      zh: "📞 接听",
      ja: "📞 応答",
    },
    "🎙️ Mute": {
      ceb: "🎙️ I-mute",
      fil: "🎙️ I-mute",
      zh: "🎙️ 静音",
      ja: "🎙️ ミュート",
    },
    "🔇 Muted": {
      ceb: "🔇 Naka-mute",
      fil: "🔇 Naka-mute",
      zh: "🔇 已静音",
      ja: "🔇 ミュート中",
    },
    "📵 End Call": {
      ceb: "📵 I-end ang Tawag",
      fil: "📵 Tapusin ang Tawag",
      zh: "📵 挂断",
      ja: "📵 通話終了",
    },
    "📞 Regular Phone Call (Backup)": {
      ceb: "📞 Regular nga Tawag sa CP (Backup)",
      fil: "📞 Regular na Tawag sa Telepono (Backup)",
      zh: "📞 普通手机通话（备用）",
      ja: "📞 通常の電話通話（予備）",
    },
    "🎙️ Send Voice Message Instead": {
      ceb: "🎙️ Padala na Lang og Voice Message",
      fil: "🎙️ Magpadala na Lang ng Voice Message",
      zh: "🎙️ 改发语音消息",
      ja: "🎙️ 代わりにボイスメッセージを送る",
    },
    "Recording Voice...": {
      ceb: "Nag-record og Tingog...",
      fil: "Nagre-record ng Boses...",
      zh: "正在录音...",
      ja: "録音中...",
    },
    "Cancel": {
      ceb: "Kanselahon",
      fil: "Kanselahin",
      zh: "取消",
      ja: "キャンセル",
    },
    "Send Voice ✈️": {
      ceb: "Ipasa ang Tingog ✈️",
      fil: "Ipadala ang Boses ✈️",
      zh: "发送语音 ✈️",
      ja: "音声を送信 ✈️",
    },
    "Record Voice Message": {
      ceb: "Mag-record og Voice Message",
      fil: "Mag-record ng Voice Message",
      zh: "录制语音消息",
      ja: "ボイスメッセージを録音",
    },
    "🎤 Voice Message": {
      ceb: "🎤 Voice Message",
      fil: "🎤 Voice Message",
      zh: "🎤 语音消息",
      ja: "🎤 ボイスメッセージ",
    },
    "Club Rider": {
      ceb: "Club Rider",
      fil: "Club Rider",
      zh: "俱乐部骑手",
      ja: "クラブライダー",
    },
    "CCRC Member": {
      ceb: "Miyembro sa CCRC",
      fil: "Miyembro ng CCRC",
      zh: "CCRC 成员",
      ja: "CCRCメンバー",
    },
    "🟢 Connected (Free In-App Voice)": {
      ceb: "🟢 Konektado na (Libreng Tawag sa App)",
      fil: "🟢 Konektado na (Libreng Tawag sa App)",
      zh: "🟢 已接通（免费应用内通话）",
      ja: "🟢 通話中（無料アプリ内音声）",
    },
    "⚠️ Weak mobile signal prevented audio link. Try Regular Phone Call or Voice Message below.": {
      ceb: "⚠️ Hinay ang signal maong wala madayon ang tingog. Gamita ang Regular Phone Call o Voice Message sa ubos.",
      fil: "⚠️ Mahina ang signal kaya hindi makakonekta ang audio. Subukan ang Regular Phone Call o Voice Message sa ibaba.",
      zh: "⚠️ 移动网络信号较弱导致语音未能接通，请尝试下方的普通电话或发送语音消息。",
      ja: "⚠️ 電波が弱いため音声接続できませんでした。下の通常電話またはボイスメッセージをお試しください。",
    },
    "Free in-app calls are available once a rider is assigned and before the trip completes.": {
      ceb: "Magamit ang libreng tawag kung naa nay naka-assign nga rider ug wala pa nahuman ang biyahe.",
      fil: "Magagamit ang libreng tawag kapag may nakatalagang rider na at bago matapos ang biyahe.",
      zh: "分配骑手后至行程结束前均可使用免费应用内通话。",
      ja: "ライダーが割り当てられてから乗車完了まで無料通話をご利用いただけます。",
    },
    "⚠️ Live in-app calling requires an HTTPS connection and microphone access. Use Regular Phone Call or Voice Message below.": {
      ceb: "⚠️ Nagkinahanglan og HTTPS ug mikropono ang libreng tawag. Gamita ang Regular Phone Call o Voice Message sa ubos.",
      fil: "⚠️ Kailangan ng HTTPS at mikropono para sa live in-app call. Gamitin ang Regular Phone Call o Voice Message sa ibaba.",
      zh: "⚠️ 实时应用内通话需要 HTTPS 连接和麦克风权限。请使用下方的普通电话或语音消息。",
      ja: "⚠️ アプリ内通話にはHTTPS接続とマイクの許可が必要です。下の通常電話またはボイスメッセージをご利用ください。",
    },
    "🎙️ Requesting microphone access...": {
      ceb: "🎙️ Nangayo og permiso sa mikropono...",
      fil: "🎙️ Humihingi ng pahintulot sa mikropono...",
      zh: "🎙️ 正在请求麦克风权限...",
      ja: "🎙️ マイクへのアクセスを要求中...",
    },
    "🎙️ Microphone permission denied. Allow microphone access in browser settings, or use the backup options below.": {
      ceb: "🎙️ Wala gitugotan ang mikropono. I-allow kini sa browser settings o gamita ang backup options sa ubos.",
      fil: "🎙️ Tinanggihan ang mikropono. Payagan ito sa browser settings o gamitin ang backup options sa ibaba.",
      zh: "🎙️ 麦克风权限被拒绝。请在浏览器设置中允许，或使用下方备用方式。",
      ja: "🎙️ マイクの許可が拒否されました。ブラウザ設定で許可するか、下の予備手段をご利用ください。",
    },
    "🎙️ Microphone not available on this device. Use the backup options below.": {
      ceb: "🎙️ Walay makit-an nga mikropono sa device. Gamita ang backup options sa ubos.",
      fil: "🎙️ Walang mahanap na mikropono sa device. Gamitin ang backup options sa ibaba.",
      zh: "🎙️ 此设备未检测到可用麦克风，请使用下方备用方式。",
      ja: "🎙️ この端末ではマイクを利用できません。下の予備手段をご利用ください。",
    },
    "📞 Calling... Waiting for answer": {
      ceb: "📞 Nagtawag... Naghulat nga tubagon",
      fil: "📞 Tumatawag... Naghihintay ng sagot",
      zh: "📞 正在呼叫... 等待对方接听",
      ja: "📞 発信中... 応答をお待ちしています",
    },
    "A call is already active.": {
      ceb: "Naa pay kasamtangang tawag karon.",
      fil: "May kasalukuyang tawag pa ngayon.",
      zh: "当前已有正在进行的通话。",
      ja: "すでに通話が進行中です。",
    },
    "Could not start in-app call.": {
      ceb: "Dili masugdan ang tawag sa app.",
      fil: "Hindi masimulan ang tawag sa app.",
      zh: "无法发起应用内通话。",
      ja: "アプリ内通話を開始できませんでした。",
    },
    "Unable to start in-app call.": {
      ceb: "Napakyas pagsugod sa tawag.",
      fil: "Nabigong simulan ang tawag.",
      zh: "无法发起通话。",
      ja: "通話を開始できません。",
    },
    "🎙️ Connecting audio...": {
      ceb: "🎙️ Nagkonektar sa tingog...",
      fil: "🎙️ Ikinokonekta ang audio...",
      zh: "🎙️ 正在连接语音...",
      ja: "🎙️ 音声を接続中...",
    },
    "🎙️ Microphone permission denied. Please enable microphone access to answer.": {
      ceb: "🎙️ Wala gitugotan ang mikropono. I-enable kini aron makatubag sa tawag.",
      fil: "🎙️ Tinanggihan ang mikropono. I-enable ang mikropono upang makasagot.",
      zh: "🎙️ 麦克风权限被拒绝，请开启麦克风权限后再接听。",
      ja: "🎙️ マイクの許可が拒否されました。応答するにはマイクを有効にしてください。",
    },
    "🎙️ Microphone unavailable on this device.": {
      ceb: "🎙️ Dili magamit ang mikropono niini nga device.",
      fil: "🎙️ Hindi magamit ang mikropono sa device na ito.",
      zh: "🎙️ 此设备上麦克风不可用。",
      ja: "🎙️ この端末ではマイクを利用できません。",
    },
    "Call offer expired. Please try calling back.": {
      ceb: "Na-expire ang signal sa tawag. Palihug tawag pag-usab.",
      fil: "Nag-expire ang imbitasyon sa tawag. Pakisubukan muling tumawag.",
      zh: "通话请求已过期，请重新回拨。",
      ja: "通話リクエストが期限切れになりました。かけ直してください。",
    },
    "Call is no longer ringing.": {
      ceb: "Wala na nag-ring ang tawag.",
      fil: "Hindi na nagri-ring ang tawag.",
      zh: "通话已停止响铃。",
      ja: "呼び出しはすでに終了しています。",
    },
    "Could not connect call.": {
      ceb: "Wala makakonektar ang tawag.",
      fil: "Hindi maikonekta ang tawag.",
      zh: "无法接通通话。",
      ja: "通話を接続できませんでした。",
    },
    "📵 Call ended.": {
      ceb: "📵 Nahuman ang tawag.",
      fil: "📵 Natapos ang tawag.",
      zh: "📵 通话已结束。",
      ja: "📵 通話が終了しました。",
    },
    "📵 Call was declined.": {
      ceb: "📵 Gibalibaran ang tawag.",
      fil: "📵 Tinanggihan ang tawag.",
      zh: "📵 对方已拒接。",
      ja: "📵 通話が拒否されました。",
    },
    "📵 No answer.": {
      ceb: "📵 Walay mitubag.",
      fil: "📵 Walang sumagot.",
      zh: "📵 对方无人接听。",
      ja: "📵 応答がありませんでした。",
    },
    "📞 Incoming Free In-App Voice Call...": {
      ceb: "📞 Naa kay Libreng Tawag sa App...",
      fil: "📞 May Pumapasok na Libreng Tawag sa App...",
      zh: "📞 收到免费应用内语音来电...",
      ja: "📞 アプリ内無料通話の着信...",
    },
    "🔄 Connecting voice audio...": {
      ceb: "🔄 Nagkonektar sa tingog...",
      fil: "🔄 Kinokonekta ang audio ng boses...",
      zh: "🔄 正在连接音频...",
      ja: "🔄 音声オーディオを接続中...",
    },
    "Voice recording requires HTTPS / modern mobile browser": {
      ceb: "Nagkinahanglan og HTTPS / modernong browser ang voice record",
      fil: "Kailangan ng HTTPS / modernong browser para sa voice recording",
      zh: "语音录制需要 HTTPS 和现代手机浏览器",
      ja: "音声録音にはHTTPS対応の最新ブラウザが必要です",
    },
    "Voice recording requires HTTPS and microphone support on your browser.": {
      ceb: "Nagkinahanglan og HTTPS ug mikropono sa imong browser ang pag-record og tingog.",
      fil: "Kailangan ng HTTPS at suporta ng mikropono sa browser para sa pag-record ng boses.",
      zh: "语音录制需要浏览器支持 HTTPS 和麦克风权限。",
      ja: "音声録音にはHTTPS接続とブラウザのマイク対応が必要です。",
    },
    "Sending...": {
      ceb: "Nagpadala...",
      fil: "Ipinapadala...",
      zh: "发送中...",
      ja: "送信中...",
    },
    "Please end your live voice call first before recording a voice message.": {
      ceb: "I-end una ang live voice call sa dili pa mag-record og voice message.",
      fil: "Tapusin muna ang live voice call bago mag-record ng voice message.",
      zh: "请先挂断当前语音通话，然后再录制语音消息。",
      ja: "ボイスメッセージを録音する前に、現在の音声通話を終了してください。",
    },
    "Could not access microphone. Please allow Microphone permission in your browser.": {
      ceb: "Dili ma-access ang mikropono. I-allow ang Microphone permission sa imong browser.",
      fil: "Hindi ma-access ang mikropono. Pakipayagan ang Microphone permission sa browser.",
      zh: "无法访问麦克风，请在浏览器中允许麦克风权限。",
      ja: "マイクにアクセスできません。ブラウザでマイクの許可を有効にしてください。",
    },
    "Voice recording was too short. Please hold/speak for at least 1 second.": {
      ceb: "Mubo ra kaayo ang voice recording. Palihug sulti labing menos 1 ka segundo.",
      fil: "Masyadong maikli ang voice recording. Magsalita nang kahit 1 segundo.",
      zh: "录音时间太短，请至少说话 1 秒钟。",
      ja: "録音が短すぎます。1秒以上話してください。",
    },
    "Could not upload voice message.": {
      ceb: "Napakyas pagpadala sa voice message.",
      fil: "Hindi maipadala ang voice message.",
      zh: "无法上传语音消息。",
      ja: "ボイスメッセージを送信できませんでした。",
    },

    // --- Official GCash Payment, QR Code & Completion Gate ---
    "Pay via Official GCash": {
      ceb: "Bayad gamit ang Opisyal nga GCash",
      fil: "Magbayad gamit ang Opisyal na GCash",
      zh: "使用官方 GCash 付款",
      ja: "公式GCashでお支払い",
    },
    "Scan or send fare directly to your assigned rider's GCash": {
      ceb: "I-scan ang QR o ipadala ang plete diretso sa GCash sa rider",
      fil: "I-scan o ipadala ang pamasahe direkta sa GCash ng rider",
      zh: "扫描二维码或直接转入骑手的 GCash 账户",
      ja: "QRコードをスキャンするか、担当ライダーのGCashへ直接送金してください",
    },
    "⏳ Waiting for GCash Payment": {
      ceb: "⏳ Naghulat sa Bayad sa GCash",
      fil: "⏳ Naghihintay ng Bayad sa GCash",
      zh: "⏳ 等待 GCash 付款",
      ja: "⏳ GCashのお支払い待ち",
    },
    "📲 Sent — Awaiting Rider Confirmation": {
      ceb: "📲 Napadala Na — Naghulat sa Kumpirmasyon sa Rider",
      fil: "📲 Naipadala Na — Hinihintay ang Kumpirmasyon ng Rider",
      zh: "📲 已付款 — 等待骑手确认",
      ja: "📲 送金済み — ライダーの確認待ち",
    },
    "✅ GCash Verified & Paid": {
      ceb: "✅ Nakumpirma ug Nabayran na ang GCash",
      fil: "✅ Beripikado at Bayad na ang GCash",
      zh: "✅ GCash 已确认付款",
      ja: "✅ GCash支払い確認済み",
    },
    "Exact Fare Amount to Send via GCash": {
      ceb: "Eksaktong Kantidad nga Ipadala sa GCash",
      fil: "Eksaktong Halagang Ipapadala sa GCash",
      zh: "需通过 GCash 支付的准确车费",
      ja: "GCashでお支払いいただく正確な料金",
    },
    "⏳ Waiting for a club rider to accept your booking so their official GCash QR code & number appear here.": {
      ceb: "⏳ Naghulat nga naay rider nga modawat sa booking aron makita ang iyang opisyal nga GCash QR code ug numero.",
      fil: "⏳ Naghihintay ng rider na tatanggap sa booking upang lumabas ang kanyang GCash QR code at numero.",
      zh: "⏳ 等待骑手接单后，将在此显示其官方 GCash 收款码与号码。",
      ja: "⏳ ライダーが予約を承認すると、公式GCash QRコードと番号がここに表示されます。",
    },
    "Rider's GCash Account": {
      ceb: "GCash Account sa Rider",
      fil: "GCash Account ng Rider",
      zh: "骑手的 GCash 账户",
      ja: "ライダーのGCashアカウント",
    },
    "📋 Copy Number": {
      ceb: "📋 Kopyaha ang Numero",
      fil: "📋 Kopyahin ang Numero",
      zh: "📋 复制号码",
      ja: "📋 番号をコピー",
    },
    "✓ Copied!": {
      ceb: "✓ Nakopya na!",
      fil: "✓ Nakopya na!",
      zh: "✓ 已复制！",
      ja: "✓ コピーしました！",
    },
    "💾 Save QR Image": {
      ceb: "💾 I-save ang QR Image",
      fil: "💾 I-save ang QR Image",
      zh: "💾 保存二维码图片",
      ja: "💾 QR画像を保存",
    },
    "Open Official GCash": {
      ceb: "Ablihi ang Opisyal nga GCash",
      fil: "Buksan ang Opisyal na GCash",
      zh: "打开官方 GCash",
      ja: "公式GCashアプリを開く",
    },
    "Opens the official GCash app on your phone.": {
      ceb: "Moabli kini sa opisyal nga GCash app sa imong selpon.",
      fil: "Magbubukas ito ng opisyal na GCash app sa iyong telepono.",
      zh: "将在您的手机上打开官方 GCash 应用。",
      ja: "お使いのスマホで公式GCashアプリを開きます。",
    },
    "GCash Reference No. (Optional — helps rider verify faster)": {
      ceb: "GCash Reference No. (Opsyonal — makatabang sa paspas nga pag-verify sa rider)",
      fil: "GCash Reference No. (Opsyonal — mas mabilis na beripikasyon ng rider)",
      zh: "GCash 参考号（选填 — 方便骑手更快核对）",
      ja: "GCash 照会番号（任意 — ライダーが確認しやすくなります）",
    },
    "✓ I've Sent GCash Payment": {
      ceb: "✓ Napadala na Nako ang Bayad sa GCash",
      fil: "✓ Naipadala Ko na ang Bayad sa GCash",
      zh: "✓ 我已通过 GCash 付款",
      ja: "✓ GCashで送金しました",
    },
    "🔄 Update Reference No.": {
      ceb: "🔄 I-update ang Reference No.",
      fil: "🔄 I-update ang Reference No.",
      zh: "🔄 更新参考号",
      ja: "🔄 照会番号を更新",
    },
    "✅ GCash payment confirmed by your rider!": {
      ceb: "✅ Nakumpirma na sa rider ang imong bayad sa GCash!",
      fil: "✅ Nakumpirma na ng rider ang iyong bayad sa GCash!",
      zh: "✅ 骑手已确认收到您的 GCash 付款！",
      ja: "✅ ライダーがGCashでのお支払いを確認しました！",
    },
    "Opening Official GCash...": {
      ceb: "Giablihan ang Opisyal nga GCash...",
      fil: "Binubuksan ang Opisyal na GCash...",
      zh: "正在打开官方 GCash...",
      ja: "公式GCashを開いています...",
    },
    "Rider GCash number copied:": {
      ceb: "Nakopya ang GCash number sa rider:",
      fil: "Nakopya ang GCash number ng rider:",
      zh: "已复制骑手 GCash 号码：",
      ja: "ライダーのGCash番号をコピーしました：",
    },
    "GCash payment notice sent to your rider for confirmation!": {
      ceb: "Napadala na sa rider ang pahibalo sa imong GCash payment aron ma-confirm niya!",
      fil: "Naipadala na sa rider ang abiso ng iyong bayad sa GCash para makumpirma!",
      zh: "已通知骑手核对您的 GCash 付款！",
      ja: "ライダーにGCash送金完了を通知しました！",
    },
    "Trip transferred to a new rider. Please pay using the new rider's GCash details above.": {
      ceb: "Na-transfer ang biyahe sa bag-ong rider. Palihug bayad gamit ang iyang GCash details sa ibabaw.",
      fil: "Nailipat ang biyahe sa bagong rider. Mangyaring magbayad gamit ang kanyang GCash details sa itaas.",
      zh: "行程已转派给新骑手，请使用上方新骑手的 GCash 账户付款。",
      ja: "新しいライダーへ引き継がれました。上記の新しいライダーのGCash宛にお支払いください。",
    },
    "If GCash did not open automatically, switch to the GCash app manually or install it from the App Store link above.": {
      ceb: "Kung wala moabli dayon ang GCash, ablihi ang GCash app sa imong phone o i-install gikan sa link sa ibabaw.",
      fil: "Kung hindi kusang bumukas ang GCash, buksan nang manu-mano ang GCash app o i-install mula sa link sa itaas.",
      zh: "如果未自动跳转，请手动切换至 GCash 应用或通过上方商店链接安装。",
      ja: "GCashが自動で開かない場合は、手動でGCashアプリを開くか上のストアリンクからインストールしてください。",
    },
    "My Official GCash QR & Number": {
      ceb: "Akong Opisyal nga GCash QR ug Numero",
      fil: "Aking Opisyal na GCash QR at Numero",
      zh: "我的官方 GCash 收款码与号码",
      ja: "自分の公式GCash QRコードと番号",
    },
    "No GCash QR uploaded yet — upload your QR so customers can pay via GCash.": {
      ceb: "Walay na-upload nga GCash QR pa — pag-upload aron makabayad ang customer sa GCash.",
      fil: "Wala pang na-upload na GCash QR — mag-upload upang makapagbayad ang customer gamit ang GCash.",
      zh: "尚未上传 GCash 收款码 — 上传后乘客即可通过 GCash 扫码付款。",
      ja: "GCash QRコードが未登録です — 登録すると乗客がGCashで支払えるようになります。",
    },
    "⚙️ Setup / Update GCash QR": {
      ceb: "⚙️ I-setup / I-update ang GCash QR",
      fil: "⚙️ I-setup / I-update ang GCash QR",
      zh: "⚙️ 设置 / 更新 GCash 收款码",
      ja: "⚙️ GCash QRを設定・更新",
    },
    "📱 GCash QR": {
      ceb: "📱 GCash QR",
      fil: "📱 GCash QR",
      zh: "📱 GCash 收款码",
      ja: "📱 GCash QR",
    },
    "GCash Payment Verification Required": {
      ceb: "Kinahanglan og Kumpirmasyon sa Bayad sa GCash",
      fil: "Kailangan ng Kumpirmasyon sa Bayad sa GCash",
      zh: "需确认 GCash 收款",
      ja: "GCash支払いの確認が必要です",
    },
    "⏳ Waiting Customer GCash": {
      ceb: "⏳ Naghulat sa GCash sa Customer",
      fil: "⏳ Naghihintay sa GCash ng Customer",
      zh: "⏳ 等待乘客 GCash 付款",
      ja: "⏳ 乗客のGCash支払い待ち",
    },
    "Exact GCash Fare:": {
      ceb: "Eksaktong Plete sa GCash:",
      fil: "Eksaktong Pamasahe sa GCash:",
      zh: "应收 GCash 车费：",
      ja: "GCash請求額：",
    },
    "📱 Show My GCash QR": {
      ceb: "📱 Ipakita Akong GCash QR",
      fil: "📱 Ipakita ang Aking GCash QR",
      zh: "📱 出示我的 GCash 收款码",
      ja: "📱 自分のGCash QRを表示",
    },
    "📲 Customer Sent — Verify Now": {
      ceb: "📲 Nagpadala Na ang Customer — I-verify Karon",
      fil: "📲 Nagpadala Na ang Customer — Beripikahin Ngayon",
      zh: "📲 乘客已转款 — 请立即确认",
      ja: "📲 乗客が送金済み — 確認してください",
    },
    "✅ GCash Paid & Confirmed": {
      ceb: "✅ Nabayran ug Nakumpirma ang GCash",
      fil: "✅ Bayad at Nakumpirma ang GCash",
      zh: "✅ GCash 已收款并确认",
      ja: "✅ GCash支払い確認済み",
    },
    "✅ GCash Paid & Verified": {
      ceb: "✅ Nabayran ug Nakumpirma ang GCash",
      fil: "✅ Bayad at Nakumpirma ang GCash",
      zh: "✅ GCash 已收款并验证",
      ja: "✅ GCash支払い確認済み",
    },
    "📲 Customer Marked Payment Sent": {
      ceb: "📲 Gikumpirma sa Customer nga Napadala Na",
      fil: "📲 Minarkahan ng Customer na Naipadala Na",
      zh: "📲 乘客已标记付款完成",
      ja: "📲 乗客が送金完了を通知しました",
    },
    "✓ Verify Customer GCash / QR": {
      ceb: "✓ I-verify ang GCash / QR",
      fil: "✓ Beripikahin ang GCash / QR",
      zh: "✓ 核实乘客付款 / 收款码",
      ja: "✓ GCash送金を確認 / QR表示",
    },
    "✓ GCash Verified (View QR)": {
      ceb: "✓ Nabayran na (Tan-awa ang QR)",
      fil: "✓ Bayad na (Tingnan ang QR)",
      zh: "✓ 已收款（查看二维码）",
      ja: "✓ 確認済み（QRを見る）",
    },
    '🔒 Confirm GCash payment via "Show My GCash QR" above before marking this trip Delivered / Completed.': {
      ceb: '🔒 Ipakita una ang GCash QR ug i-confirm ang bayad gamit ang "Ipakita Akong GCash QR" sa ibabaw sa dili pa ma-complete ang biyahe.',
      fil: '🔒 Kumpirmahin muna ang bayad sa GCash sa "Ipakita ang Aking GCash QR" bago markahang Completed ang biyahe.',
      zh: '🔒 请先通过上方的“出示我的 GCash 收款码”确认已收到乘客付款，再完成订单。',
      ja: '🔒 配達完了にする前に、上の「自分のGCash QRを表示」からGCashの入金確認を行ってください。',
    },
    "🔒 Locked Until GCash Paid (Show QR / Confirm)": {
      ceb: "🔒 Naka-lock Hangtod Nabayran sa GCash (Ipakita QR / I-confirm)",
      fil: "🔒 Naka-lock Hanggang Bayad sa GCash (Ipakita QR / Kumpirmahin)",
      zh: "🔒 需确认 GCash 已收款后方可完成（点此出示二维码/确认）",
      ja: "🔒 GCash入金確認までロック中（QR表示 / 確認）",
    },
    "✓ Delivered (Mark as Completed)": {
      ceb: "✓ Nahuman Na (Mark as Completed)",
      fil: "✓ Naihatid Na (Mark as Completed)",
      zh: "✓ 已送达（标记完成）",
      ja: "✓ 配達完了（完了にする）",
    },
    "Official GCash QR & Account Setup": {
      ceb: "Setup sa Opisyal nga GCash QR ug Numero",
      fil: "Setup ng Opisyal na GCash QR at Account",
      zh: "官方 GCash 收款码与账号设置",
      ja: "公式GCash QRと口座設定",
    },
    "Shown automatically to GCash passengers & in your Show QR modal": {
      ceb: "Awtomatikong makita sa mga pasahero nga mag-GCash ug sa imong Show QR button",
      fil: "Kusang ipinapakita sa mga pasaherong naka-GCash at sa iyong Show QR modal",
      zh: "将自动展示给选择 GCash 的乘客并用于您的收款码弹窗",
      ja: "GCash払いの乗客に自動表示され、あなたのQRモーダルにも使われます",
    },
    "Registered GCash Mobile Number": {
      ceb: "Rehistradong Numero sa GCash",
      fil: "Rehistradong Numero sa GCash",
      zh: "已注册的 GCash 手机号",
      ja: "登録済みのGCash携帯番号",
    },
    "Upload Your Official GCash QR Code Image": {
      ceb: "I-upload ang Imong Opisyal nga GCash QR Code Image",
      fil: "I-upload ang Iyong Opisyal na GCash QR Code Image",
      zh: "上传您的官方 GCash 收款码图片",
      ja: "公式GCash QRコード画像をアップロード",
    },
    "🗑️ Remove Uploaded QR": {
      ceb: "🗑️ Kuhaa ang Na-upload nga QR",
      fil: "🗑️ Alisin ang Na-upload na QR",
      zh: "🗑️ 移除已上传的二维码",
      ja: "🗑️ アップロード済みQRを削除",
    },
    "💾 Save GCash QR & Details": {
      ceb: "💾 I-save ang GCash QR ug Detalye",
      fil: "💾 I-save ang GCash QR at Detalye",
      zh: "💾 保存 GCash 收款码与资料",
      ja: "💾 GCash QRと詳細を保存",
    },
    "Collect GCash Fare Payment": {
      ceb: "Pagkolekta sa Bayad sa GCash",
      fil: "Pagkolekta ng Bayad sa GCash",
      zh: "收取 GCash 车费",
      ja: "GCash運賃の受取・確認",
    },
    "Let your passenger scan this official GCash QR code:": {
      ceb: "Ipa-scan sa pasahero kining imong opisyal nga GCash QR code:",
      fil: "Ipa-scan sa pasahero ang opisyal mong GCash QR code:",
      zh: "请让乘客扫描此官方 GCash 收款码：",
      ja: "乗客にこの公式GCash QRコードをスキャンしてもらってください：",
    },
    "GCash Number:": {
      ceb: "Numero sa GCash:",
      fil: "Numero ng GCash:",
      zh: "GCash 号码：",
      ja: "GCash番号：",
    },
    "⚠️ You haven't uploaded your GCash QR code yet.": {
      ceb: "⚠️ Wala ka pa naka-upload sa imong GCash QR code.",
      fil: "⚠️ Hindi ka pa nakakapag-upload ng iyong GCash QR code.",
      zh: "⚠️ 您尚未上传 GCash 收款码。",
      ja: "⚠️ GCash QRコードがまだアップロードされていません。",
    },
    "⚙️ Upload My GCash QR Now": {
      ceb: "⚙️ I-upload Akong GCash QR Karon",
      fil: "⚙️ I-upload ang Aking GCash QR Ngayon",
      zh: "⚙️ 立即上传我的 GCash 收款码",
      ja: "⚙️ 今すぐGCash QRをアップロード",
    },
    "GCash Reference No. (Optional / From Customer Receipt)": {
      ceb: "GCash Reference No. (Opsyonal / Gikan sa Resibo sa Customer)",
      fil: "GCash Reference No. (Opsyonal / Mula sa Resibo ng Customer)",
      zh: "GCash 参考号（选填 / 来自乘客付款凭证）",
      ja: "GCash 照会番号（任意 / 乗客の領収画面より）",
    },
    "Verified GCash receipt in person": {
      ceb: "Nakita na nako sa personal ang GCash receipt nga niabot",
      fil: "Nakita at naberipika nang personal ang resibo ng GCash",
      zh: "已当面核实乘客 GCash 付款成功",
      ja: "対面でGCashの入金完了画面を確認済み",
    },
    "Check this if the customer scanned your QR right beside you and you checked the GCash amount arrived in your app.": {
      ceb: "I-tsek kini kung nag-scan ang pasahero sa imong tupad ug nakita nimo sa imong GCash app nga niabot na ang bayad.",
      fil: "Lagyan ng tsek kung nag-scan ang customer sa tabi mo at nakita mong pumasok na ang pera sa GCash app mo.",
      zh: "如果乘客在您身旁扫码支付且您已在 GCash 应用确认到账，请勾选此项。",
      ja: "乗客がすぐ横でQRをスキャンし、GCashアプリへの着金を確認した場合はチェックしてください。",
    },
    "✓ Confirm GCash Payment Received": {
      ceb: "✓ Nakadawat Ko sa Bayad sa GCash",
      fil: "✓ Nakumpirmang Natanggap ang Bayad sa GCash",
      zh: "✓ 确认已收到 GCash 付款",
      ja: "✓ GCashの入金を確認しました",
    },
    "✅ GCash Payment Verified & Confirmed! You may now mark this trip as Delivered / Completed.": {
      ceb: "✅ Nakumpirma na ang Bayad sa GCash! Pwede na nimo i-mark ang biyahe nga Delivered / Completed.",
      fil: "✅ Beripikado at Nakumpirma na ang Bayad sa GCash! Maaari nang markahang Completed ang biyahe.",
      zh: "✅ GCash 收款已核实确认！现在可以将此行程标记为已完成。",
      ja: "✅ GCashの支払いが確認されました！この乗車を完了にできます。",
    },
    "Ready ✓ GCash:": {
      ceb: "Andam ✓ GCash:",
      fil: "Handa ✓ GCash:",
      zh: "已就绪 ✓ GCash：",
      ja: "準備完了 ✓ GCash：",
    },
    "QR code uploaded": {
      ceb: "Na-upload na ang QR code",
      fil: "Na-upload na ang QR code",
      zh: "二维码已上传",
      ja: "QRコード登録済み",
    },
    "QR code uploaded ✓ — Add your GCash mobile number so customers can copy it.": {
      ceb: "Na-upload na ang QR ✓ — Idugang sab ang imong GCash number aron makopya sa pasahero.",
      fil: "Na-upload na ang QR ✓ — Idagdag din ang GCash number mo para makopya ng pasahero.",
      zh: "二维码已上传 ✓ — 建议同时填写 GCash 手机号方便乘客复制。",
      ja: "QRコード登録済み ✓ — 乗客がコピーできるようGCash番号も登録してください。",
    },
    "Please upload your GCash QR code image.": {
      ceb: "Palihug i-upload ang imong GCash QR code image.",
      fil: "Pakisuyong i-upload ang larawan ng iyong GCash QR code.",
      zh: "请上传您的 GCash 收款码图片。",
      ja: "GCash QRコード画像をアップロードしてください。",
    },
    "Wait for the customer to mark payment as sent, or check 'Verified GCash receipt in person' if you saw the GCash transfer complete beside you.": {
      ceb: "Hulata una nga i-mark sa customer nga napadala na, o i-tsek ang 'Nakita na nako sa personal ang GCash receipt' kung nakita nimo nga niabot na sa imong app.",
      fil: "Hintaying markahan ng customer na naipadala na, o lagyan ng tsek ang 'Verified GCash receipt in person' kung nakitang pumasok na sa GCash app mo.",
      zh: "请等待乘客点击“我已付款”，或当面确认到账后勾选上方“已当面核实”。",
      ja: "乗客の送金通知を待つか、対面で着金を確認した場合は上のチェックボックスをオンにしてください。",
    },
    "Confirming...": {
      ceb: "Gikumpirma...",
      fil: "Kinukumpirma...",
      zh: "正在确认...",
      ja: "確認中...",
    },
    "Saving...": {
      ceb: "Gi-save...",
      fil: "Sine-save...",
      zh: "正在保存...",
      ja: "保存中...",
    },
    "Your GCash QR & Account (Optional — Needed for GCash Bookings)": {
      ceb: "Imong GCash QR ug Numero (Opsyonal — Gamiton sa GCash Bookings)",
      fil: "Iyong GCash QR at Account (Opsyonal — Para sa GCash Bookings)",
      zh: "您的 GCash 收款码与账号（选填 — 接 GCash 订单需要）",
      ja: "GCash QRと口座情報（任意 — GCash払いの予約で必要）",
    },
    "Registered GCash Mobile Number (Optional)": {
      ceb: "Rehistradong Numero sa GCash (Opsyonal)",
      fil: "Rehistradong Numero sa GCash (Opsyonal)",
      zh: "已注册 GCash 手机号（选填）",
      ja: "登録済みGCash携帯番号（任意）",
    },
    "Upload Official GCash QR Code Image (Optional)": {
      ceb: "I-upload ang Opisyal nga GCash QR Code (Opsyonal)",
      fil: "I-upload ang Opisyal na GCash QR Code (Opsyonal)",
      zh: "上传官方 GCash 收款码图片（选填）",
      ja: "公式GCash QRコード画像をアップロード（任意）",
    },
    "💙 Official GCash QR:": {
      ceb: "💙 Opisyal nga GCash QR:",
      fil: "💙 Opisyal na GCash QR:",
      zh: "💙 官方 GCash 收款码：",
      ja: "💙 公式GCash QR：",
    },
    "💙 GCash Payment Receiving Setup (Optional — can add later)": {
      ceb: "💙 Setup sa Pagdawat og Bayad sa GCash (Opsyonal — pwede idugang unya)",
      fil: "💙 Setup sa Pagtanggap ng Bayad sa GCash (Opsyonal — pwedeng idagdag mamaya)",
      zh: "💙 GCash 收款设置（选填 — 之后再填亦可）",
      ja: "💙 GCash受取設定（任意 — 後から設定可能）",
    },
    "GCash Mobile Number (Optional)": {
      ceb: "Numero sa GCash (Opsyonal)",
      fil: "Numero sa GCash (Opsyonal)",
      zh: "GCash 手机号（选填）",
      ja: "GCash携帯番号（任意）",
    },
    "My Official GCash QR Code Image (Optional)": {
      ceb: "Akong Opisyal nga GCash QR Code Image (Opsyonal)",
      fil: "Aking Opisyal na GCash QR Code Image (Opsyonal)",
      zh: "我的官方 GCash 收款码图片（选填）",
      ja: "自分の公式GCash QRコード画像（任意）",
    },
    "👥 Number of Riders Needed (1–10)": {
      ceb: "👥 Pila ka Rider ang Kinahanglan (1–10)",
      fil: "👥 Ilang Rider ang Kailangan (1–10)",
      zh: "👥 需要几名骑手（1–10名）",
      ja: "👥 必要なライダー数（1〜10名）",
    },
    "1 Rider (Solo)": {
      ceb: "1 ka Rider (Solo)",
      fil: "1 Rider (Solo)",
      zh: "1 名骑手（单人）",
      ja: "ライダー1名（ソロ）",
    },
    "Book 1 rider for solo trips, or up to 10 riders simultaneously for families & groups. Each rider gets paid directly.": {
      ceb: "Pag-book og 1 ka rider kung ikaw ra usa, o hangtod 10 ka rider dungan para sa pamilya ug grupo. Diretso ang bayad sa matag rider.",
      fil: "Mag-book ng 1 rider para sa solo biyahe, o hanggang 10 rider nang sabay para sa pamilya at grupo. Direkta ang bayad sa bawat rider.",
      zh: "单人出行选 1 名骑手，家庭或团队出行可同时预约最多 10 名骑手。每位骑手分别直接收款。",
      ja: "ソロ移動は1名、ご家族やグループでは最大10名まで同時手配できます。各ライダーへ直接お支払いください。",
    },
    "Estimated Group Fare": {
      ceb: "Gibanabanang Plete sa Grupo",
      fil: "Tinatayang Pamasahe ng Grupo",
      zh: "团队预估总车费",
      ja: "グループ予想運賃合計",
    },
    "👥 Group Fare Breakdown:": {
      ceb: "👥 Bahin sa Plete sa Grupo:",
      fil: "👥 Detalye ng Pamasahe ng Grupo:",
      zh: "👥 团队车费明细：",
      ja: "👥 グループ運賃内訳：",
    },
    "Book Another Ride +": {
      ceb: "Pag-book og Lain +",
      fil: "Mag-book ng Iba +",
      zh: "再约一单 +",
      ja: "別の予約をする +",
    },
    "👥 Multi-Rider Group Booking": {
      ceb: "👥 Grupo nga Pag-book (Daghan ka Rider)",
      fil: "👥 Group Booking (Maraming Rider)",
      zh: "👥 多骑手团体订单",
      ja: "👥 複数ライダー・グループ予約",
    },
    "Total Group Fare": {
      ceb: "Tibouk Plete sa Grupo",
      fil: "Kabuuang Pamasahe ng Grupo",
      zh: "团体总车费",
      ja: "グループ合計運賃",
    },
    "✕ Cancel Open Slot": {
      ceb: "✕ Kanselahon ang Bakante nga Slot",
      fil: "✕ Kanselahin ang Bukas na Slot",
      zh: "✕ 取消空缺名额",
      ja: "✕ 空き枠をキャンセル",
    },
    "Focus": {
      ceb: "Tan-awa",
      fil: "Tingnan",
      zh: "查看",
      ja: "表示",
    },
    "⏳ Open": {
      ceb: "⏳ Bakante",
      fil: "⏳ Bukas",
      zh: "⏳ 待接单",
      ja: "⏳ 募集中",
    },
    "🛵 Assigned": {
      ceb: "🛵 Nakuha na",
      fil: "🛵 Nakatalaga",
      zh: "🛵 已接单",
      ja: "🛵 確定済み",
    },
    "🚀 Transit": {
      ceb: "🚀 Nagbiyahe",
      fil: "🚀 Nasa Byahe",
      zh: "🚀 配送中",
      ja: "🚀 移動中",
    },
    "✅ Done": {
      ceb: "✅ Nahuman",
      fil: "✅ Tapos na",
      zh: "✅ 已完成",
      ja: "✅ 完了",
    },
    "✕ Cancelled": {
      ceb: "✕ Nakansela",
      fil: "✕ Nakansela",
      zh: "✕ 已取消",
      ja: "✕ キャンセル",
    },
    "Waiting for rider": {
      ceb: "Naghulat og rider",
      fil: "Naghihintay ng rider",
      zh: "等待骑手接单",
      ja: "ライダー待機中",
    },
    "Slot Fare:": {
      ceb: "Plete niini nga Rider:",
      fil: "Pamasahe sa Slot:",
      zh: "本单车费：",
      ja: "この枠の運賃：",
    },
    "Total Fare:": {
      ceb: "Tibouk Plete:",
      fil: "Kabuuang Pamasahe:",
      zh: "总车费：",
      ja: "合計運賃：",
    },
    "Cancel this open unassigned rider slot? Only open slots waiting for a rider can be cancelled.": {
      ceb: "Kanselahon kini nga bakante nga slot? Ang mga slot lang nga wala pa nakuha sa rider ang makansela.",
      fil: "Kanselahin ang bukas na slot na ito? Tanging mga slot na naghihintay pa ng rider ang pwedeng ikansela.",
      zh: "确认取消此待接单名额吗？仅尚未被骑手接单的空缺名额可以取消。",
      ja: "この未割当の枠をキャンセルしますか？ライダー未確定の枠のみキャンセル可能です。",
    },
    "Could not cancel open slot.": {
      ceb: "Dili makansela ang bakante nga slot.",
      fil: "Hindi makansela ang bukas na slot.",
      zh: "无法取消该待接单名额。",
      ja: "空き枠をキャンセルできませんでした。",
    },
    "Network error cancelling open slot.": {
      ceb: "May problema sa internet samtang gikansela ang slot.",
      fil: "Nagkaproblema sa koneksyon habang kinakansela ang slot.",
      zh: "取消名额时网络出错。",
      ja: "キャンセル中にネットワークエラーが発生しました。",
    },
    "✓ Already Joined Group": {
      ceb: "✓ Nakasulod Na sa Grupo",
      fil: "✓ Kasali Na sa Grupo",
      zh: "✓ 您已加入该团体单",
      ja: "✓ このグループに参加済み",
    },
    "Accept Group Slot 🛵": {
      ceb: "Dawata ang Slot sa Grupo 🛵",
      fil: "Tanggapin ang Group Slot 🛵",
      zh: "接此团体单名额 🛵",
      ja: "グループ枠を受ける 🛵",
    },
    "Accepting Booking": {
      ceb: "Nagdawat og Booking",
      fil: "Tumatanggap ng Booking",
      zh: "正在接单",
      ja: "配車受付中",
    },
    "Heading Destination": {
      ceb: "Padulong sa Destinasyon",
      fil: "Papunta sa Destinasyon",
      zh: "前往目的地",
      ja: "目的地へ移動中",
    },
    "Heading to Destination": {
      ceb: "Padulong sa Destinasyon",
      fil: "Papunta sa Destinasyon",
      zh: "Papunta sa Destinasyon",
      ja: "目的地へ移動中",
    },
    "Heading to pickup": {
      ceb: "Padulong sa pick-up",
      fil: "Papunta sa pick-up",
      zh: "前往上车点",
      ja: "乗車地へ移動中",
    },
    "Accepting booking &bull; Heading to pickup": {
      ceb: "Gidawat ang booking &bull; Padulong sa pick-up",
      fil: "Tinanggap ang booking &bull; Papunta sa pick-up",
      zh: "已接单 &bull; 正在前往上车点",
      ja: "配車受付 &bull; 乗車地へ移動中",
    },
    "Heading to destination": {
      ceb: "Padulong sa destinasyon",
      fil: "Papunta sa destinasyon",
      zh: "前往目的地",
      ja: "目的地へ移動中",
    },
    "Ready to take bookings": {
      ceb: "Andam modawat og mga booking",
      fil: "Handang tumanggap ng mga booking",
      zh: "空闲 &bull; 可随时接单",
      ja: "空車 &bull; 新規予約を受付可能",
    },
    "Completed trip &bull; Ready for next booking": {
      ceb: "Nahuman ang biyahe &bull; Andam na sa sunod booking",
      fil: "Natapos ang biyahe &bull; Handa na sa susunod na booking",
      zh: "行程已完成 &bull; 可接下一单",
      ja: "乗車完了 &bull; 次の予約受付可能",
    },
    "Available (Completed ✓)": {
      ceb: "Bakante (Nahuman ✓)",
      fil: "Available (Tapos na ✓)",
      zh: "空闲（已完单 ✓）",
      ja: "空車（完了 ✓）",
    },
    "Heading Dest": {
      ceb: "Padulong Dest",
      fil: "Papunta Dest",
      zh: "前往终点",
      ja: "目的地へ",
    },
    "Rider heading to destination": {
      ceb: "Ang rider padulong na sa destinasyon",
      fil: "Ang rider ay papunta na sa destinasyon",
      zh: "骑手正在前往目的地",
      ja: "ライダーは目的地へ移動中です",
    },
    "Rider is accepting a booking": {
      ceb: "Ang rider nagdawat og booking ug padulong sa pick-up",
      fil: "Ang rider ay tumatanggap ng booking at papunta sa pick-up",
      zh: "骑手已接单正在前往接客",
      ja: "ライダーは配車受付中で乗車地へ向かっています",
    },
    "Rider currently has an active trip": {
      ceb: "Ang rider aduna pay aktibong biyahe",
      fil: "May aktibong biyahe pa ang rider",
      zh: "骑手当前已有进行中的行程",
      ja: "ライダーは現在乗車対応中です",
    },
  };

  function getStoredLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (_) {}
    return "en";
  }

  function setStoredLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }

  function normalizeText(str) {
    return String(str || "").replace(/\s+/g, " ").trim();
  }

  function translateString(enText, lang) {
    if (!lang || lang === "en") return enText;
    const norm = normalizeText(enText);
    const entry = DICT[norm];
    if (entry && entry[lang]) {
      return entry[lang];
    }
    return enText;
  }

  window.ccrcT = function (enText) {
    return translateString(enText, getStoredLang());
  };

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "PRE", "CODE", "DATALIST", "SELECT", "OPTION"]);

  function applyLanguageToTree(root, lang) {
    if (!root) return;

    // 1. Walk text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        const tag = node.parentElement.tagName;
        if (SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest("#ccrc-lang-select")) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      textNodes.push(current);
    }

    textNodes.forEach((node) => {
      if (node._ccrcOrig === undefined) {
        node._ccrcOrig = node.nodeValue;
      }
      const orig = node._ccrcOrig;
      const norm = normalizeText(orig);
      if (!DICT[norm]) return;

      if (lang === "en") {
        if (node.nodeValue !== orig) node.nodeValue = orig;
      } else {
        const translated = DICT[norm][lang];
        if (translated) {
          const lead = orig.match(/^\s*/)[0];
          const trail = orig.match(/\s*$/)[0];
          const nextVal = lead + translated + trail;
          if (node.nodeValue !== nextVal) node.nodeValue = nextVal;
        }
      }
    });

    // 2. Translate placeholder & title attributes
    const attrEls = root.querySelectorAll
      ? root.querySelectorAll("[placeholder], [title]")
      : [];
    attrEls.forEach((el) => {
      if (el.hasAttribute("placeholder")) {
        if (el.dataset.i18nOrigPh === undefined) {
          el.dataset.i18nOrigPh = el.getAttribute("placeholder");
        }
        const origPh = el.dataset.i18nOrigPh;
        const nextPh = translateString(origPh, lang);
        if (el.getAttribute("placeholder") !== nextPh) {
          el.setAttribute("placeholder", nextPh);
        }
      }
      if (el.hasAttribute("title")) {
        if (el.dataset.i18nOrigTitle === undefined) {
          el.dataset.i18nOrigTitle = el.getAttribute("title");
        }
        const origTitle = el.dataset.i18nOrigTitle;
        const nextTitle = translateString(origTitle, lang);
        if (el.getAttribute("title") !== nextTitle) {
          el.setAttribute("title", nextTitle);
        }
      }
    });
  }

  let isApplying = false;

  window.applyCcrcLanguage = function (lang) {
    const targetLang = SUPPORTED_LANGS.includes(lang) ? lang : "en";
    setStoredLang(targetLang);
    document.documentElement.lang = HTML_LANG_MAP[targetLang] || "en";

    const selectEl = document.getElementById("ccrc-lang-select");
    if (selectEl && selectEl.value !== targetLang) {
      selectEl.value = targetLang;
    }

    isApplying = true;
    try {
      applyLanguageToTree(document.body, targetLang);
    } finally {
      isApplying = false;
    }
  };

  function initI18n() {
    const selectEl = document.getElementById("ccrc-lang-select");
    const initialLang = getStoredLang();
    if (selectEl) {
      selectEl.value = initialLang;
      selectEl.addEventListener("change", (e) => {
        window.applyCcrcLanguage(e.target.value);
      });
    }

    window.applyCcrcLanguage(initialLang);

    // Re-apply when dynamic content is rendered (e.g., reviews, history, co-riders)
    let timer = null;
    const observer = new MutationObserver(() => {
      if (isApplying) return;
      const currentLang = getStoredLang();
      if (currentLang === "en") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        window.applyCcrcLanguage(currentLang);
      }, 120);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initI18n);
  } else {
    initI18n();
  }
})();
