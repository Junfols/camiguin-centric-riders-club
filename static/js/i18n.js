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

    // --- Auth & Account ---
    "Passenger Account": {
      ceb: "Account sa Pasahero",
      fil: "Account ng Pasahero",
      zh: "乘客账户",
      ja: "乗客アカウント",
    },
    "Log In": {
      ceb: "Log In",
      fil: "Mag-Log In",
      zh: "登录",
      ja: "ログイン",
    },
    "Register (Legit Badge 🛡️)": {
      ceb: "Pag-register (Legit Badge 🛡️)",
      fil: "Mag-register (Legit Badge 🛡️)",
      zh: "注册（认证徽章 🛡️）",
      ja: "登録（認証バッジ 🛡️）",
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
    "Log Out of Rider Account": {
      ceb: "Log Out sa Rider Account",
      fil: "Mag-Log Out sa Rider Account",
      zh: "退出骑手账号",
      ja: "ライダーアカウントからログアウト",
    },
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
    "📞 Call": {
      ceb: "📞 Tawag",
      fil: "📞 Tawag",
      zh: "📞 通话",
      ja: "📞 通話",
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
    "✓ Delivered (Mark as Completed)": {
      ceb: "✓ Nahuman Na (Mark as Completed)",
      fil: "✓ Naihatid Na (Mark as Completed)",
      zh: "✓ 已送达（标记完成）",
      ja: "✓ 配達完了（完了にする）",
    },
    "Rate Your Island Rider": {
      ceb: "I-rate ang Imong Rider",
      fil: "I-rate ang Iyong Rider",
      zh: "为您的骑手评分",
      ja: "ライダーを評価する",
    },
    "Submit 5-Star Rating →": {
      ceb: "Ipasa ang 5-Star Rating →",
      fil: "Isumite ang 5-Star Rating →",
      zh: "提交五星好评 →",
      ja: "5つ星評価を送信 →",
    },

    // --- Complete Rider Portal & Dashboard Translations ---
    "Rider Dispatch Portal": {
      ceb: "Rider Dispatch Portal",
      fil: "Rider Dispatch Portal",
      zh: "骑手调度中心",
      ja: "ライダー配車ポータル",
    },
    "Log in with your registered mobile number to receive island booking dispatches in Camiguin.": {
      ceb: "Pag-log in gamit ang imong rehistradong mobile number o email aron makadawat og mga booking sa Camiguin.",
      fil: "Mag-log in gamit ang iyong rehistradong mobile number o email upang makatanggap ng mga booking sa Camiguin.",
      zh: "使用您注册的手机号或邮箱登录以接收甘米银岛派单。",
      ja: "登録済みの携帯番号またはメールでログインしてカミギン島の配車依頼を受信します。",
    },
    "Back to Main Dashboard / Book a Ride": {
      ceb: "Balik sa Main Dashboard / Book a Ride",
      fil: "Bumalik sa Main Dashboard / Mag-book",
      zh: "返回主页 / 立即叫车",
      ja: "メイン画面・配車予約に戻る",
    },
    "Driver's License Number *": {
      ceb: "Numero sa Driver's License *",
      fil: "Numero ng Driver's License *",
      zh: "驾驶证号码 *",
      ja: "運転免許証番号 *",
    },
    "Rider Profile Picture (Photo) *": {
      ceb: "Litrato sa Rider (Profile Photo) *",
      fil: "Larawan ng Rider (Profile Photo) *",
      zh: "骑手头像照片 *",
      ja: "ライダープロフィール写真 *",
    },
    "Clear face photo for passenger safety and club verification.": {
      ceb: "Klaro nga litrato sa nawong para sa kaluwasan sa pasahero ug club verification.",
      fil: "Malinaw na larawan ng mukha para sa kaligtasan ng pasahero at club verification.",
      zh: "清晰的正面照片，用于乘客安全和俱乐部认证。",
      ja: "乗客の安全とクラブ認証のため、顔がはっきり写った写真を使用してください。",
    },
    "Motorcycle Model *": {
      ceb: "Modelo sa Motorsiklo *",
      fil: "Modelo ng Motorsiklo *",
      zh: "摩托车型号 *",
      ja: "バイクの車種 *",
    },
    "Plate Number *": {
      ceb: "Plate Number *",
      fil: "Plate Number *",
      zh: "车牌号 *",
      ja: "ナンバープレート *",
    },
    "Camiguin Municipality *": {
      ceb: "Munisipyo sa Camiguin *",
      fil: "Munisipalidad sa Camiguin *",
      zh: "甘米银所属市镇 *",
      ja: "カミギン島の市町 *",
    },
    "Password (min 6 chars) *": {
      ceb: "Password (labing menos 6 ka letra) *",
      fil: "Password (hindi bababa sa 6 na character) *",
      zh: "密码（至少6位）*",
      ja: "パスワード（6文字以上）*",
    },
    "Register as CCRC Rider": {
      ceb: "Pag-register isip CCRC Rider",
      fil: "Mag-register bilang CCRC Rider",
      zh: "注册成为 CCRC 骑手",
      ja: "CCRCライダーとして登録",
    },
    "CCRC Verified Rider": {
      ceb: "CCRC Verified nga Rider",
      fil: "CCRC Beripikadong Rider",
      zh: "CCRC 认证骑手",
      ja: "CCRC認証済みライダー",
    },
    "View / Print CCRC ID": {
      ceb: "Tan-awa / I-print ang CCRC ID",
      fil: "Tingnan / I-print ang CCRC ID",
      zh: "查看 / 打印 CCRC 证件",
      ja: "CCRC IDを表示・印刷",
    },
    "🟢 ONLINE": {
      ceb: "🟢 ONLINE",
      fil: "🟢 ONLINE",
      zh: "🟢 在线接单中",
      ja: "🟢 オンライン",
    },
    "⚪ OFFLINE": {
      ceb: "⚪ OFFLINE",
      fil: "⚪ OFFLINE",
      zh: "⚪ 离线休息",
      ja: "⚪ オフライン",
    },
    "Live GPS Beacon: Active & streaming location": {
      ceb: "Live GPS Beacon: Aktibo ug nagpadala sa lokasyon",
      fil: "Live GPS Beacon: Aktibo at nagpapadala ng lokasyon",
      zh: "实时 GPS 定位：已开启并持续更新位置",
      ja: "ライブGPSビーコン：有効・位置情報送信中",
    },
    "Sync GPS": {
      ceb: "I-sync ang GPS",
      fil: "I-sync ang GPS",
      zh: "同步定位",
      ja: "GPS同期",
    },
    "Screen Awake:": {
      ceb: "Screen Awake:",
      fil: "Screen Awake:",
      zh: "屏幕常亮：",
      ja: "画面常時点灯：",
    },
    "Active (Prevents screen sleep while riding)": {
      ceb: "Aktibo (Dili mapalong ang screen samtang nagdagan)",
      fil: "Aktibo (Hindi mamamatay ang screen habang nagmamaneho)",
      zh: "已开启（骑行时防止屏幕熄灭）",
      ja: "有効（走行中の画面スリープを防止）",
    },
    "Paused (Standard phone screen lock)": {
      ceb: "Naka-pause (Standard phone screen lock)",
      fil: "Naka-pause (Standard phone screen lock)",
      zh: "已暂停（恢复手机默认锁屏）",
      ja: "一時停止（通常の画面ロック）",
    },
    "Awake: ON": {
      ceb: "Awake: ON",
      fil: "Awake: ON",
      zh: "常亮: 开",
      ja: "常時点灯: ON",
    },
    "Awake: OFF": {
      ceb: "Awake: OFF",
      fil: "Awake: OFF",
      zh: "常亮: 关",
      ja: "常時点灯: OFF",
    },
    "Today's Completed Earnings": {
      ceb: "Kita Karon nga Adlaw",
      fil: "Kita Ngayong Araw",
      zh: "今日已完成收入",
      ja: "本日の完了収益",
    },
    "All-Time Earnings": {
      ceb: "Tibuok Kita (All-Time)",
      fil: "Kabuuang Kita (All-Time)",
      zh: "累计总收入",
      ja: "累計総収益",
    },
    "Transactions recorded in DB": {
      ceb: "ka Transaksyon ang natala",
      fil: "na Transaksyon ang nakatala",
      zh: "笔交易记录",
      ja: "件の取引記録",
    },
    "View Transactions Ledger": {
      ceb: "Tan-awa ang Talaan sa Kita",
      fil: "Tingnan ang Talaan ng Kita",
      zh: "查看收入明细",
      ja: "取引明細を見る",
    },
    "My Reserved Advance Bookings": {
      ceb: "Akong Naka-reserve nga Advance Bookings",
      fil: "Aking Nakareserbang Advance Bookings",
      zh: "我的预约行程",
      ja: "予約済みの事前配車",
    },
    "Ongoing Active Trip": {
      ceb: "Kasamtangang Aktibo nga Biyahe",
      fil: "Kasalukuyang Aktibong Biyahe",
      zh: "当前进行中的行程",
      ja: "進行中の乗車",
    },
    "🧾 View Receipt": {
      ceb: "🧾 Tan-awa ang Resibo",
      fil: "🧾 Tingnan ang Resibo",
      zh: "🧾 查看收据",
      ja: "🧾 領収書を見る",
    },
    "Pickup / Store:": {
      ceb: "Pickup / Tindahan:",
      fil: "Pickup / Tindahan:",
      zh: "上车点 / 商店：",
      ja: "乗車地 / 店舗：",
    },
    "Dropoff / Destination:": {
      ceb: "Dropoff / Destinasyon:",
      fil: "Dropoff / Destinasyon:",
      zh: "送达点 / 目的地：",
      ja: "降車地 / 目的地：",
    },
    "🗺️ Navigate in Google Maps": {
      ceb: "🗺️ Ablihi sa Google Maps",
      fil: "🗺️ Buksan sa Google Maps",
      zh: "🗺️ 使用 Google 地图导航",
      ja: "🗺️ Googleマップでナビ",
    },
    "Shopping List / Notes:": {
      ceb: "Listahan sa Paliton / Tugon:",
      fil: "Listahan ng Bibilhin / Bilin:",
      zh: "购物清单 / 备注：",
      ja: "買い物リスト / メモ：",
    },
    "Customer:": {
      ceb: "Pasahero / Customer:",
      fil: "Pasahero / Customer:",
      zh: "乘客：",
      ja: "乗客：",
    },
    "🔊 Free In-App Call Customer": {
      ceb: "🔊 Libreng Tawag sa Customer",
      fil: "🔊 Libreng Tawag sa Customer",
      zh: "🔊 免费应用内呼叫乘客",
      ja: "🔊 乗客に無料アプリ内通話",
    },
    "Receipt / Proof of Purchase:": {
      ceb: "Resibo / Ebidensya sa Pagpalit:",
      fil: "Resibo / Katibayan ng Pagbili:",
      zh: "收据 / 购买凭证：",
      ja: "レシート / 購入証明：",
    },
    "No Receipt Yet": {
      ceb: "Walay Resibo Pa",
      fil: "Wala Pang Resibo",
      zh: "暂无收据",
      ja: "レシート未登録",
    },
    "✅ Receipt Uploaded": {
      ceb: "✅ Na-upload na ang Resibo",
      fil: "✅ Na-upload na ang Resibo",
      zh: "✅ 收据已上传",
      ja: "✅ レシートアップロード済み",
    },
    "Take / Upload Receipt": {
      ceb: "Kuhaa / I-upload ang Resibo",
      fil: "Kunan / I-upload ang Resibo",
      zh: "拍照 / 上传收据",
      ja: "レシートを撮影・アップロード",
    },
    "Replace Photo": {
      ceb: "Ilisi ang Litrato",
      fil: "Palitan ang Larawan",
      zh: "更换照片",
      ja: "写真を変更",
    },
    "Take a photo of the official store receipt (Gaisano, Pharmacy, Grocery) or proof of parcel handover.": {
      ceb: "Kuhaa og litrato ang opisyal nga resibo (Gaisano, Botika, Grocery) o ebidensya sa paghatod.",
      fil: "Kunan ng larawan ang opisyal na resibo (Gaisano, Botika, Grocery) o katibayan ng paghatid.",
      zh: "请拍摄商店正式收据（Gaisano、药店、杂货店）或包裹交接凭证。",
      ja: "店舗の公式レシート（Gaisano、薬局、スーパー）または荷物受け渡しの証拠写真を撮影してください。",
    },
    "🚀 Picked Up / Heading to Destination": {
      ceb: "🚀 Nakuha Na / Paingon sa Destinasyon",
      fil: "🚀 Nakuha Na / Papunta sa Destinasyon",
      zh: "🚀 已接到乘客 / 前往目的地",
      ja: "🚀 乗車完了 / 目的地へ出発",
    },
    "Direct in-app messaging": {
      ceb: "Direkta nga chat sulod sa app",
      fil: "Direktang chat sa loob ng app",
      zh: "应用内直接聊天",
      ja: "アプリ内ダイレクトチャット",
    },
    "Active Chat": {
      ceb: "Aktibo nga Chat",
      fil: "Aktibong Chat",
      zh: "聊天中",
      ja: "チャット中",
    },
    "Customer chat messages will appear here in real-time.": {
      ceb: "Makit-an dinhi dayon ang mga mensahe sa pasahero.",
      fil: "Lalabas dito nang real-time ang mga mensahe ng customer.",
      zh: "乘客的聊天消息将在此实时显示。",
      ja: "乗客からのメッセージがここにリアルタイムで表示されます。",
    },
    "Reply to customer...": {
      ceb: "Tubaga ang pasahero...",
      fil: "Sumagot sa customer...",
      zh: "回复乘客...",
      ja: "乗客に返信...",
    },
    "Send": {
      ceb: "Ipasa",
      fil: "Ipadala",
      zh: "发送",
      ja: "送信",
    },
    "Available Island Booking Requests": {
      ceb: "Mga Bakante nga Booking sa Camiguin",
      fil: "Mga Bakanteng Booking sa Camiguin",
      zh: "甘米银岛待接单请求",
      ja: "カミギン島の募集中配車リクエスト",
    },
    "Scanning for new rides & delivery requests in Camiguin...": {
      ceb: "Nangita og bag-ong sakay ug padala sa Camiguin...",
      fil: "Naghahanap ng bagong sakay at padala sa Camiguin...",
      zh: "正在搜索甘米银岛新的乘车与配送订单...",
      ja: "カミギン島の新しい配車・配送リクエストを検索中...",
    },
    "No bookings currently waiting in Camiguin.": {
      ceb: "Walay naghulat nga booking sa Camiguin karon.",
      fil: "Walang naghihintay na booking sa Camiguin ngayon.",
      zh: "当前甘米银岛暂无待接单请求。",
      ja: "現在カミギン島で待機中の予約はありません。",
    },
    "Your phone will play a sound alert when a customer books!": {
      ceb: "Motunog ang imong selpon kung naay customer nga mag-book!",
      fil: "Tutunog ang iyong telepono kapag may customer na nag-book!",
      zh: "有乘客下单时您的手机将发出提示音！",
      ja: "乗客が予約すると通知音が鳴ります！",
    },
    "Accept This Booking 🛵": {
      ceb: "Dawata Kini nga Booking 🛵",
      fil: "Tanggapin ang Booking na Ito 🛵",
      zh: "接受此订单 🛵",
      ja: "この予約を受注する 🛵",
    },
    "Active on-duty club riders across Camiguin": {
      ceb: "Mga aktibo nga kaubang rider sa tibuok Camiguin",
      fil: "Mga aktibong kasamang rider sa buong Camiguin",
      zh: "甘米银全岛在线值班骑手",
      ja: "カミギン島内で稼働中のクラブライダー",
    },
    "🗺️ Radar Map": {
      ceb: "🗺️ Radar Map",
      fil: "🗺️ Radar Map",
      zh: "🗺️ 雷达地图",
      ja: "🗺️ レーダーマップ",
    },
    "✕ Close Map": {
      ceb: "✕ Sirad-i ang Mapa",
      fil: "✕ Isara ang Mapa",
      zh: "✕ 关闭地图",
      ja: "✕ 地図を閉じる",
    },
    "Center": {
      ceb: "I-sentro",
      fil: "I-sentro",
      zh: "居中",
      ja: "中央へ",
    },
    "Scanning for fellow online riders in Camiguin...": {
      ceb: "Nangita sa mga kauban nga online riders sa Camiguin...",
      fil: "Naghahanap ng mga kasamang online rider sa Camiguin...",
      zh: "正在搜索甘米银岛在线骑手伙伴...",
      ja: "カミギン島内のオンライン仲間ライダーを検索中...",
    },
    "You are the only online rider right now. Waiting for fellow riders!": {
      ceb: "Ikaw pa lang ang online rider karon. Paabota ang imong mga kauban!",
      fil: "Ikaw pa lang ang online rider ngayon. Hintayin ang iyong mga kasama!",
      zh: "当前仅您一位骑手在线，正在等待其他伙伴上线！",
      ja: "現在オンラインのライダーはあなただけです。仲間の参加をお待ちください！",
    },
    "You": {
      ceb: "Ikaw",
      fil: "Ikaw",
      zh: "您",
      ja: "あなた",
    },
    "Passenger Ratings & Feedback": {
      ceb: "Mga Rating ug Komento sa Pasahero",
      fil: "Mga Rating at Komento ng Pasahero",
      zh: "乘客评分与反馈",
      ja: "乗客からの評価とフィードバック",
    },
    "Ratings and feedback from your passengers": {
      ceb: "Mga bituon ug komento gikan sa imong mga pasahero",
      fil: "Mga rating at komento mula sa iyong mga pasahero",
      zh: "来自乘客的星级评分与评价",
      ja: "乗客からの星評価とコメント",
    },
    "No passenger ratings yet. Star ratings and feedback will appear here after completed trips!": {
      ceb: "Wala pay rating gikan sa pasahero. Makit-an dinhi ang bituon ug komento human sa biyahe!",
      fil: "Wala pang rating ng pasahero. Lalabas dito ang mga bituin at komento pagkatapos ng biyahe!",
      zh: "暂无乘客评分。完成行程后，星级评分与评价将显示在此处！",
      ja: "まだ評価はありません。乗車完了後に星評価とコメントがここに表示されます！",
    },
    "No written comment": {
      ceb: "Walay gisulat nga komento",
      fil: "Walang nakasulat na komento",
      zh: "无文字评价",
      ja: "コメントなし",
    },
    "My Earnings & Transactions": {
      ceb: "Akong Kita ug mga Transaksyon",
      fil: "Aking Kita at mga Transaksyon",
      zh: "我的收入与交易记录",
      ja: "収益と取引履歴",
    },
    "Loading your transactions...": {
      ceb: "Gikarga ang imong mga transaksyon...",
      fil: "Nilo-load ang iyong mga transaksyon...",
      zh: "正在加载交易记录...",
      ja: "取引履歴を読み込み中...",
    },

    // --- Post-Trip Rating Popup Translations ---
    "Trip Completed! Rate Your Rider": {
      ceb: "Nahuman na ang Biyahe! I-rate ang Imong Rider",
      fil: "Tapos na ang Biyahe! I-rate ang Iyong Rider",
      zh: "行程已完成！请评价您的骑手",
      ja: "乗車完了！ライダーを評価してください",
    },
    "How was your trip with": {
      ceb: "Kumusta ang imong biyahe uban ni",
      fil: "Kumusta ang iyong biyahe kasama si",
      zh: "您对本次骑手的服务满意吗：",
      ja: "今回の乗車はいかがでしたか：",
    },
    "★★★★★ Excellent Service!": {
      ceb: "★★★★★ Maayo Kaayo nga Serbisyo!",
      fil: "★★★★★ Napakahusay na Serbisyo!",
      zh: "★★★★★ 非常满意！",
      ja: "★★★★★ 素晴らしいサービス！",
    },
    "😊 Polite & Respectful": {
      ceb: "😊 Buotan ug Matinahuron",
      fil: "😊 Mabait at Magalang",
      zh: "😊 礼貌热情",
      ja: "😊 丁寧で礼儀正しい",
    },
    "🛵 Safe Driver": {
      ceb: "🛵 Luwas Mo-drive",
      fil: "🛵 Ligtas Magmaneho",
      zh: "🛵 驾驶平稳安全",
      ja: "🛵 安全運転",
    },
    "⚡ Fast Pickup": {
      ceb: "⚡ Paspas Niabot",
      fil: "⚡ Mabilis Dumating",
      zh: "⚡ 接驾准时快速",
      ja: "⚡ 迎えが早い",
    },
    "✨ Clean Bike": {
      ceb: "✨ Limpyo ang Motor",
      fil: "✨ Malinis ang Motor",
      zh: "✨ 车辆整洁舒适",
      ja: "✨ バイクが清潔",
    },
    "Submit Rating ⭐ →": {
      ceb: "Ipasa ang Rating ⭐ →",
      fil: "Isumite ang Rating ⭐ →",
      zh: "提交评分 ⭐ →",
      ja: "評価を送信 ⭐ →",
    },
    "Maybe Later (Close)": {
      ceb: "Unya Na (Sirad-i)",
      fil: "Mamaya Na (Isara)",
      zh: "稍后再说（关闭）",
      ja: "あとで（閉じる）",
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
