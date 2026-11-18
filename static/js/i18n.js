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
    "My GPS": {
      ceb: "Akong GPS",
      fil: "Aking GPS",
      zh: "我的定位",
      ja: "現在地GPS",
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
