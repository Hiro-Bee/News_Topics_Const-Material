import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TIME_ZONE = "Asia/Tokyo";
const BROWSER_USER_AGENT = "Mozilla/5.0";

const CATEGORIES = [
  "すべて",
  "官公庁・公的統計",
  "業界団体・技術団体",
  "競合メーカー",
  "競合EC",
  "お客様SNS",
  "チャッピーおすすめ"
];

const CATEGORY_ORDER = new Map(
  CATEGORIES.filter((category) => category !== "すべて").map((category, index) => [category, index])
);

const FEEDS = [
  { category: "官公庁・公的統計", query: "建設資材 供給 国土交通省" },
  { category: "業界団体・技術団体", query: "建設資材 高騰 全建総連" },
  { category: "競合メーカー", query: "LIXIL 建材 値上げ OR 永大産業 建材 値上げ" },
  { category: "競合EC", query: "モノタロウ 建材 納期 OR AUN WORKS 建材 OR 建デポ 建材" },
  { category: "チャッピーおすすめ", query: "建築資材 目詰まり OR 建設資材 不足 OR 住宅資材 高騰" },
  { category: "チャッピーおすすめ", query: "ナフサ 建材 価格 OR 住宅資材 納期" }
];

const ARTICLE_URL_OVERRIDES = new Map([
  ["東京都が国交省に「都営住宅用資材の安定供給・高騰対策」で緊急要望", "https://www.jutaku-s.com/news/id/0000038329"],
  ["ノダ、建具・収納など建材製品を値上げ 7月1日出荷分から", "https://www.s-housing.jp/archives/420630"],
  ["チヨダウーテ、ジプスターを不燃仕様に統合 6月1日から受注開始", "https://www.s-housing.jp/archives/420727"],
  ["【不動産投資の落とし穴】 設備が入らなくても引渡し？ 「ナフサショック」で変わる新築・リフォーム投資の注意点", "https://www.kenbiya.com/ar/ns/jiji/legal_knowledge/10153.html"],
  ["ナフサショックとは？製造業に影響する“原材料危機”の正体", "https://mitsudenshi.co.jp/12602/"]
]);

const CRAWL_SOURCES = [
  {
    category: "官公庁・公的統計",
    name: "国土交通省 建築",
    url: "https://www.mlit.go.jp/jutakukentiku/build/",
    keywords: ["建築", "省エネ", "建材", "住宅", "制度", "基準"]
  },
  {
    category: "業界団体・技術団体",
    name: "JACCA",
    url: "https://www.jacca.or.jp/",
    keywords: ["天井", "耐震", "下地", "技術", "施工", "資料"]
  },
  {
    category: "競合EC",
    name: "AUN WORKS",
    url: "https://www.aunworks.jp/",
    keywords: ["建材", "内装", "工具", "特集", "新商品", "キャンペーン"]
  },
  {
    category: "競合EC",
    name: "モノタロウ",
    url: "https://www.monotaro.com/",
    keywords: ["建材", "資材", "現場", "工具", "価格", "納期"]
  },
  {
    category: "競合EC",
    name: "建デポ",
    url: "https://kendepot.co.jp/",
    keywords: ["建材", "店舗", "資材", "キャンペーン", "新着"]
  }
];

const SOCIAL_QUERIES = [
  "建材 納期",
  "建材 価格",
  "建材EC",
  "建材 在庫",
  "建設資材 納期"
];

const TRAFFIC_ROWS = [
  {
    site: "モノタロウ",
    domain: "monotaro.com",
    source: "Semrush公開推定 + 60日週次予測",
    confidence: "公開推定",
    monthlyVisits: 16920000,
    pagesPerVisit: 3.92,
    visits: [3350000, 3480000, 3620000, 3570000, 3740000, 3890000, 3820000, 3970000, 3900000],
    note: "Semrush公開推定値 March 2026 visits 16.92M、pages/visit 3.92 を起点に週次換算。"
  },
  {
    site: "AUN WORKS",
    domain: "aunworks.jp",
    source: "Semrush公開推定 + 60日週次予測",
    confidence: "公開推定",
    monthlyVisits: 185550,
    pagesPerVisit: 3.07,
    visits: [28500, 30200, 31800, 33500, 36100, 38400, 40200, 42700, 43800],
    note: "Semrush公開推定値 March 2026 visits 185.55K、pages/visit 3.07 を起点に週次換算。"
  },
  {
    site: "建デポ",
    domain: "kendepot.co.jp",
    source: "予測モデル",
    confidence: "予測",
    monthlyVisits: 420000,
    pagesPerVisit: 2.4,
    visits: [83000, 86500, 89000, 92200, 94800, 97100, 100500, 97300, 96200],
    note: "店舗検索、キャンペーン閲覧、ブランド指名検索を想定した予測値。実測ではありません。"
  },
  {
    site: "ミラタップ",
    domain: "miratap.co.jp",
    source: "予測モデル",
    confidence: "予測",
    monthlyVisits: 1250000,
    pagesPerVisit: 3.1,
    visits: [246000, 258000, 271000, 289000, 301000, 296000, 310000, 322000, 316000],
    note: "住宅設備・建材ECとしての指名検索、商品閲覧、カタログ閲覧を想定した予測値。実測ではありません。"
  },
  {
    site: "きりいーね",
    domain: "kirii-net.jp",
    source: "予測モデル / GA4差替推奨",
    confidence: "予測",
    monthlyVisits: 32000,
    pagesPerVisit: 2.2,
    visits: [6100, 6450, 6900, 7200, 7350, 7600, 7900, 8200, 8050],
    note: "自社GA4/Search Console未連携時の仮予測値。GA4値を入れると正確な実績グラフに置換できます。"
  }
];

const FALLBACK_ARTICLES = [
  {
    id: "2026-05-24-gov-001",
    category: "官公庁・公的統計",
    title: "建築物省エネ法・建築基準法関連の最新資料を確認",
    source: "国土交通省",
    url: "https://www.mlit.go.jp/jutakukentiku/build/r4kaisei_document.html",
    summary: "国交省の改正建築物省エネ法・建築基準法関連資料は、工務店や設計者にとって継続確認が必要な重要情報です。きりいーねでは制度そのものの説明ではなく、断熱材、下地材、副資材、現場確認項目に翻訳した実務チェックリスト化が有効です。",
    analysis: "官公庁資料は信頼性が高い一方、現場担当者がそのまま読むには難しい場合があります。制度解説を入口に、商品カテゴリや現場チェックリストへ接続すると、ECとしての実務支援価値が高まります。",
    action: "省エネ法対応の建材・副資材チェックリストを作成し、断熱材、気密部材、下地材、点検口などの関連カテゴリへ導線を追加します。",
    imageLabel: "官公庁資料"
  },
  {
    id: "2026-05-24-assoc-001",
    category: "業界団体・技術団体",
    title: "耐震天井・下地技術の基礎情報を住宅向けに再編集",
    source: "技術団体・業界団体資料",
    url: "https://www.jacca.or.jp/",
    summary: "耐震天井や軽天下地の技術情報は非住宅向けの印象が強い一方、戸建てやリフォームでも下地選定、納まり、施工ミス防止の情報ニーズがあります。専門情報を住宅工務店向けの読み物や図解に直すことで、きりいーねの専門性を伝えられます。",
    analysis: "専門知識を商品説明、FAQ、カテゴリLPに翻訳することで、単なる建材ECではなく、現場支援型ECとして差別化できます。",
    action: "軽天下地、床下地、壁下地、天井下地の4カテゴリで、よくある失敗、選定項目、副資材、商品導線を整理します。",
    imageLabel: "技術団体"
  },
  {
    id: "2026-05-24-maker-001",
    category: "競合メーカー",
    title: "建材メーカーのSNS・YouTubeは施工手順と製品理解の入口になる",
    source: "競合メーカー公式サイト・SNS・YouTube",
    url: "https://www.youtube.com/",
    summary: "建材メーカーのSNSやYouTubeでは、新商品紹介だけでなく施工手順、納まり、メンテナンス、比較ポイントなどが発信されています。きりいーねでは商品ページに動画や図解への導線を持たせ、購入前の不安を減らすコンテンツ設計が必要です。",
    analysis: "動画や現場写真はスペック表では伝わりにくい選定理由を補完します。商品ページへ関連動画を接続すると、滞在時間や購入前理解の改善が期待できます。",
    action: "主要メーカーごとに公式ニュース、YouTube、X、Instagramを確認し、商品ページにメーカー公式動画と施工手順リンクを追加します。",
    imageLabel: "メーカー発信"
  },
  {
    id: "2026-05-24-ec-001",
    category: "競合EC",
    title: "AUN WORKS、モノタロウ、建デポ、ミラタップの導線比較が必要",
    source: "競合EC公式サイト・SNS",
    url: "https://www.aunworks.jp/",
    summary: "競合ECは品揃え、価格、納期、法人向け機能、レビュー、用途別導線で差別化しています。きりいーねは商品点数で全面勝負するのではなく、戸建て工務店が迷わず買える用途別導線、買い忘れ防止、現場別まとめ買いで勝つべきです。",
    analysis: "競合ECは商品、価格、在庫だけでなく、検索導線、レビュー、送料条件、買い合わせ提案まで観察する必要があります。",
    action: "競合ECの新着、キャンペーン、カテゴリ追加を毎朝差分取得し、真似すべき点、避けるべき点、差別化できる点に分類します。",
    imageLabel: "競合EC"
  },
  {
    id: "2026-05-24-sns-001",
    category: "お客様SNS",
    title: "建材EC利用者の不満は探しにくさ、納期、買い忘れに集約されやすい",
    source: "X・レビュー・口コミ",
    url: "https://x.com/search?q=%E5%BB%BA%E6%9D%90EC",
    summary: "建材ECに関する顧客投稿では、商品が多く探しにくい、送料や納期が分かりにくい、現場で必要な副資材を買い忘れる、といった不満が出やすいと想定されます。これらはきりいーねの改善テーマとして優先度が高いです。",
    analysis: "SNSやレビューは顧客が実際に使う言葉を拾える情報源です。検索語句、FAQ、商品ページ改善、CRM配信テーマに転用できます。",
    action: "建材EC、送料、納期、買い忘れ、型番、下地材などのキーワードで投稿を確認し、週次で顧客不満トップ10を作成します。",
    imageLabel: "顧客投稿"
  },
  {
    id: "2026-05-24-reco-001",
    category: "チャッピーおすすめ",
    title: "建材価格・納期・供給制限を早期発注リストに変換する",
    source: "建設・住宅業界メディア",
    url: "https://souken.craft-bank.com/analisys/zairyoneage/",
    summary: "建材価格の改定や供給不安は、工務店の発注判断に直結します。単なるニュースとして読むだけでなく、値上げ前に買うべき商品、代替品、在庫確認、早期発注リストに変換すれば、きりいーねの実務支援価値が高まります。",
    analysis: "価格改定や納期不安は購買行動に近いテーマです。ニュースを商品カテゴリと連動させると、早期発注や代替品提案につなげられます。",
    action: "今月の値上げ・納期リスク速報を月次コンテンツ化し、対象カテゴリ、改定時期、代替品、在庫確認リンクをまとめます。",
    imageLabel: "価格・納期"
  }
];

function jstDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function labelForDate(date) {
  const [year, month, day] = date.split("-");
  return `${year}年${month}月${day}日号`;
}

function safeIsoDate(value) {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return decodeXml(String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " "));
}

function limitText(value, maxLength = 220) {
  const text = stripHtml(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeArticleText(value = "") {
  return stripHtml(value)
    .replace(/※このニュースの記事本文は[^。]*。?/g, " ")
    .replace(/この記事はいかがでしたか[\s\S]*$/u, "")
    .replace(/続きを読む|関連ニュース|関連記事|関連記事はこちら|コメント|シェア|ポスト|ログイン|会員登録|広告|PR|TREK|試読会員|無料体験|著作権の利用手続き/g, " ")
    .replace(/PDF形式のファイルをご覧いただくためには[\s\S]*?ください。?/g, " ")
    .replace(/Adobe Acrobat Reader[^。]*。?/g, " ")
    .replace(/住宅ビジネスに関する情報は[^。]*。?/g, " ")
    .replace(/中東情勢[―-]受注・供給動向、各社対応まとめ/g, " ")
    .replace(/Copyright[^。]*。?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMarkerText(value = "") {
  return stripHtml(value)
    .replace(/\bSTART\b/g, "")
    .replace(/\bEND\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNewsTitle(value = "") {
  return cleanMarkerText(value)
    .replace(/\s+-\s+.{2,80}$/u, "")
    .trim();
}

function titleTerms(title = "") {
  return cleanNewsTitle(title)
    .replace(/[【】「」（）()［］\[\]、。・:：!?！？]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !/ニュース|報道|記事|解説|Yahoo|NEWS/i.test(term))
    .slice(0, 8);
}

function splitSentences(text = "") {
  const normalized = normalizeArticleText(text);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[。！？])\s*/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18)
    .filter((sentence) => !/Cookie|JavaScript|ブラウザ|有料会員|購読|個人情報|利用規約|広告|ランキング|ポータルサイト|ECサイト|オンラインで完結|過去記事|リーダーアプリ|化学の力で/.test(sentence))
    .filter((sentence) => !/\.\.\.|…\s*(化学|工業団地|過去記事|その日のニュース|オンライン|日刊工業新聞社のEC)/.test(sentence));
}

function buildArticleSummary({ title, source, description = "", body = "" }) {
  const cleanTitle = cleanNewsTitle(title);
  const terms = titleTerms(cleanTitle);
  const candidates = [...splitSentences(body), ...splitSentences(description)];
  const unique = [];
  const seen = new Set();
  for (const sentence of candidates) {
    const compact = sentence.replace(/\s/g, "");
    if (seen.has(compact)) continue;
    if (cleanTitle && compact.includes(cleanTitle.replace(/\s/g, ""))) continue;
    if (/記事は|取り上げています|扱っています|読みどころ|報道の中心|確認が必要|必要があります|反映します|追加してください/.test(sentence)) continue;
    if (/Yahoo! JAPAN|ご覧になろうとしているページ|検索した結果|現在表示できません|ヒットしました/.test(sentence)) continue;
    seen.add(compact);
    unique.push(sentence);
  }

  const scored = unique.map((sentence, index) => {
    const relevance = terms.filter((term) => sentence.includes(term)).length * 10
      + (/価格|高騰|値上げ|納期|供給|不足|建材|資材|住宅|建築|施工|国交省|LIXIL|EC|工務店|メーカー|原材料|ナフサ|補助金|制度/.test(sentence) ? 7 : 0)
      + (index < 4 ? 4 : 0);
    return { sentence, index, relevance, score: relevance - (index * 0.15) };
  });
  const hasRelevant = scored.some((item) => item.relevance >= 7);
  const pool = (hasRelevant ? scored.filter((item) => item.relevance >= 7) : scored)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  let length = 0;
  for (const item of pool) {
    if (selected.length >= 5) break;
    selected.push(item);
    length += item.sentence.length;
    if (length >= 240) break;
  }
  const ordered = selected.sort((a, b) => a.index - b.index).map((item) => item.sentence);
  let summary = ordered.join("");

  if (!summary) return "";

  if (summary.length > 300) {
    const clipped = summary.slice(0, 300);
    const boundary = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("！"), clipped.lastIndexOf("？"));
    summary = boundary >= 180 ? clipped.slice(0, boundary + 1) : `${summary.slice(0, 299)}…`;
  }
  return summary.trim();
}

function hasSubstantialSummary(summary = "", { minLength = 180 } = {}) {
  const text = normalizeArticleText(summary);
  if (text.length < minLength) return false;
  if (/記事は|取り上げています|扱っています|読みどころ|報道の中心|確認が必要|必要があります|反映します|追加してください/.test(text)) return false;
  if (/Yahoo! JAPAN|ご覧になろうとしているページ|検索した結果|現在表示できません|ヒットしました/.test(text)) return false;
  if (/PDF形式のファイル|Adobe Acrobat Reader|トップページ|政策、報道発表資料、統計情報/.test(text)) return false;
  if (/」←|【福岡発】|関連記事.*関連記事/.test(text)) return false;
  if ((text.match(/。/g) || []).length < 2 && text.length < 240) return false;
  return true;
}

function makeAnalysis(article) {
  const text = `${article.title} ${article.summary}`;
  if (/納期|供給|不足|目詰まり|遅れ|調達/.test(text)) {
    return "納期や供給不安は、購入直前の離脱や問い合わせ増加に直結します。カテゴリページと商品ページで在庫・納期・代替候補を明確に出す優先度が高いです。";
  }
  if (/価格|高騰|値上げ|コスト|ナフサ/.test(text)) {
    return "価格上昇ニュースは、早期発注、まとめ買い、代替材検討につながる購買シグナルです。値上げ対象カテゴリと影響時期を整理する価値があります。";
  }
  if (/省エネ|断熱|補助金|ZEB|CASBEE|脱炭素/i.test(text)) {
    return "制度・補助金系の情報は、断熱材、省エネ建材、施工部材の需要喚起につながります。制度解説から商品カテゴリへ誘導する導線が重要です。";
  }
  if (/EC|モノタロウ|AUN|建デポ|ミラタップ/i.test(text)) {
    return "競合ECの動きは、価格、納期、特集、検索導線、買い合わせ提案の比較材料になります。きりいーねで勝てる用途別導線に落とし込むべきです。";
  }
  return "建材市場の変化を示す情報です。商品、物流、価格、コンテンツ、営業対応のどこに影響するかを確認し、実行タスクへ分解してください。";
}

function makeAction(article) {
  const text = `${article.title} ${article.summary}`;
  if (/納期|供給|不足|目詰まり|遅れ|調達/.test(text)) {
    return "対象カテゴリを洗い出し、在庫・納期注意の表示、代替品リンク、問い合わせテンプレート、早期発注案内を追加してください。";
  }
  if (/価格|高騰|値上げ|コスト|ナフサ/.test(text)) {
    return "値上げ影響が出る商品群を確認し、価格改定予定、まとめ買い推奨、代替材候補を一覧化してメルマガや営業資料に展開してください。";
  }
  if (/省エネ|断熱|補助金|ZEB|CASBEE|脱炭素/i.test(text)) {
    return "制度対象の建材カテゴリ、施工条件、補助対象の確認ポイントをFAQ化し、関連商品への導線を設置してください。";
  }
  return "記事内容を商品カテゴリ、顧客問い合わせ、価格・納期、競合施策の4観点で確認し、該当する改善バックログへ登録してください。";
}

function attr(tagText, name) {
  const match = tagText.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*(?:name|property)=["']${escaped}["'])[^>]*>`, "i");
  const match = html.match(pattern);
  return match ? attr(match[0], "content") : "";
}

function imageFromRssItem(item) {
  const media = item.match(/<(?:media:content|media:thumbnail)\b[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (media?.[1]) return decodeXml(media[1]);
  const enclosure = item.match(/<enclosure\b(?=[^>]*type=["']image\/)[^>]*url=["']([^"']+)["'][^>]*>/i);
  return enclosure?.[1] ? decodeXml(enclosure[1]) : "";
}

function isGoogleNewsImage(url = "") {
  return /googleusercontent\.com|gstatic\.com\/gnews|google_news/i.test(url);
}

function isGoogleNewsUrl(url = "") {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function isHomepageUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOgImage(url) {
  if (!url) return "";
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": BROWSER_USER_AGENT }
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return "";
    const html = await response.text();
    const image = metaContent(html, "og:image")
      || metaContent(html, "twitter:image")
      || metaContent(html, "twitter:image:src");
    const absolute = image ? absoluteUrl(response.url || url, image) : "";
    return isGoogleNewsImage(absolute) ? "" : absolute;
  } catch {
    return "";
  }
}

function jsonLdArticleBody(html = "") {
  const blocks = [...html.matchAll(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(decodeXml(block[1]).trim());
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      for (const item of items.flat()) {
        const body = item?.articleBody || item?.description;
        if (typeof body === "string" && normalizeArticleText(body).length > 80) return body;
      }
    } catch {
      // Ignore malformed publisher JSON-LD.
    }
  }
  return "";
}

function extractArticleBody(html = "") {
  const jsonBody = jsonLdArticleBody(html);
  if (jsonBody) return jsonBody;
  const articleMatch = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || html;
  const paragraphs = [...articleMatch.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeArticleText(match[1]))
    .filter((text) => text.length >= 25)
    .filter((text) => !/関連記事|関連リンク|プロフィール|この記事の画像|写真を見る|一覧へ|トップへ/.test(text));
  return paragraphs.slice(0, 8).join(" ");
}

async function fetchArticleText(url) {
  if (!url || isGoogleNewsUrl(url)) return { description: "", body: "" };
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": BROWSER_USER_AGENT }
    });
    if (!response.ok) return { description: "", body: "" };
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { description: "", body: "" };
    const html = await response.text();
    return {
      description: metaContent(html, "description")
        || metaContent(html, "og:description")
        || metaContent(html, "twitter:description"),
      body: extractArticleBody(html)
    };
  } catch {
    return { description: "", body: "" };
  }
}

function decodeDuckDuckGoUrl(url = "") {
  try {
    const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname === "/l/") {
      return parsed.searchParams.get("uddg") || "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function hostOf(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function candidateMatchesSource(candidate, source, sourceUrl) {
  const host = hostOf(candidate);
  const sourceHost = hostOf(sourceUrl);
  const sourceText = String(source || "").toLowerCase();
  if (sourceHost && (host === sourceHost || host.endsWith(`.${sourceHost}`))) return true;
  if (sourceText && host.includes(sourceText.replace(/^www\./, "").replace(/ニュース|新聞|株式会社/g, "").trim())) return true;
  if (/yahoo/i.test(sourceText) && host === "news.yahoo.co.jp") return true;
  if (/itmedia/i.test(sourceText) && host.endsWith("itmedia.co.jp")) return true;
  if (/reuters/i.test(sourceText) && host.endsWith("reuters.com")) return true;
  if (/時事|jiji/i.test(sourceText) && host.endsWith("jiji.com")) return true;
  return false;
}

function cleanSearchCandidate(url = "") {
  const cleaned = decodeXml(url).replace(/\\u002F/g, "/");
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.endsWith("yahoo.co.jp") && parsed.pathname.includes("/RU=")) {
      const match = parsed.pathname.match(/\/RU=([^/]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function usableArticleCandidate(url = "") {
  const host = hostOf(url);
  if (!host || isGoogleNewsUrl(url)) return false;
  if (/search\.yahoo\.co\.jp|duckduckgo\.com|bing\.com|google\.com|yimg\.jp|w3\.org|ogp\.me/.test(host)) return false;
  if (/^(x\.com|twitter\.com|facebook\.com|www\.facebook\.com)$/.test(host)) return false;
  if (/\.(css|js|ico|png|jpe?g|gif|svg|webp)(\?|$)/i.test(url)) return false;
  return true;
}

async function findWithYahooSearch(queries, source, sourceUrl) {
  for (const query of queries) {
    const url = new URL("https://search.yahoo.co.jp/search");
    url.searchParams.set("p", query);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": BROWSER_USER_AGENT }
    });
    if (!response.ok) continue;
    const html = await response.text();
    const candidates = [...html.matchAll(/https?:\/\/[^"'<> ]+/g)]
      .map((match) => cleanSearchCandidate(match[0]))
      .filter((candidate) => usableArticleCandidate(candidate) && !isHomepageUrl(candidate));
    const sourceMatch = candidates.find((candidate) => candidateMatchesSource(candidate, source, sourceUrl));
    if (sourceMatch) return sourceMatch;
    if (candidates[0]) return candidates[0];
    await sleep(350);
  }
  return "";
}

async function fetchSearchSnippetText(title, source) {
  const cleanTitle = cleanNewsTitle(title);
  const queries = [`${cleanTitle} ${source}`.trim(), cleanTitle].filter(Boolean);
  for (const query of queries) {
    try {
      const url = new URL("https://search.yahoo.co.jp/search");
      url.searchParams.set("p", query);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": BROWSER_USER_AGENT }
      });
      if (!response.ok) continue;
      const text = normalizeArticleText(await response.text());
      const snippets = [...text.matchAll(/(?:\d+時間前|\d+日前|\d+分前)\s*-\s*([^。]{30,220}(?:。|…)?)/g)]
        .map((match) => match[1].trim())
        .filter((snippet) => !snippet.includes("検索した結果"));
      if (snippets.length > 0) return snippets.slice(0, 3).join("。");
      const key = cleanTitle.slice(0, Math.min(18, cleanTitle.length));
      const index = key ? text.indexOf(key) : -1;
      const snippet = index >= 0 ? text.slice(index, index + 900) : text.slice(0, 700);
      if (snippet.length > 80) return snippet;
    } catch {
      // Search snippets are a fallback only.
    }
  }
  return "";
}

async function findWithDuckDuckGo(queries) {
  for (const query of queries) {
    const url = new URL("https://duckduckgo.com/html/");
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": BROWSER_USER_AGENT }
    });
    if (!response.ok) continue;
    const html = await response.text();
    const matches = [...html.matchAll(/class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const match of matches) {
      const candidate = decodeDuckDuckGoUrl(decodeXml(match[1]));
      if (usableArticleCandidate(candidate) && !isHomepageUrl(candidate)) return candidate;
    }
    await sleep(350);
  }
  return "";
}

async function findOriginalArticleUrl(title, source, sourceUrl = "") {
  const cleanTitle = cleanNewsTitle(title);
  if (ARTICLE_URL_OVERRIDES.has(cleanTitle)) return ARTICLE_URL_OVERRIDES.get(cleanTitle);
  const queries = [
    `${cleanTitle} ${source}`.trim(),
    sourceUrl ? `site:${hostOf(sourceUrl)} ${cleanTitle}` : "",
    cleanTitle
  ].filter(Boolean);
  try {
    return await findWithYahooSearch(queries, source, sourceUrl)
      || await findWithDuckDuckGo(queries);
  } catch {
    return "";
  }
  return "";
}

function absoluteUrl(base, href) {
  try {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return "";
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function isRelevant(text, keywords) {
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function tag(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

async function fetchGoogleNews(feed, date) {
  const url = new URL("https://news.google.com/rss/search");
  const today = jstDate();
  const queryDatePart = date === today ? "when:7d" : `after:${date} before:${addDays(date, 1)}`;
  url.searchParams.set("q", `${feed.query} ${queryDatePart}`);
  url.searchParams.set("hl", "ja");
  url.searchParams.set("gl", "JP");
  url.searchParams.set("ceid", "JP:ja");

  const response = await fetch(url, {
    headers: { "User-Agent": "kirii-daily-news/1.0" }
  });
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

  const xml = await response.text();
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  const parsed = [];
  for (const [index, match] of items.slice(0, 4).entries()) {
    const item = match[0];
    const title = tag(item, "title");
    const sourceTag = item.match(/<source\b[^>]*>/i)?.[0] || "";
    const source = tag(item, "source") || "Google News";
    const sourceUrl = attr(sourceTag, "url");
    const summary = tag(item, "description") || title;
    const googleNewsUrl = tag(item, "link");
    const originalUrl = await findOriginalArticleUrl(title, source, sourceUrl);
    const articleUrl = originalUrl || googleNewsUrl;
    if (isGoogleNewsUrl(articleUrl) || isHomepageUrl(articleUrl)) {
      console.warn(`Skipped unresolved article URL: ${cleanNewsTitle(title)}`);
      await sleep(500);
      continue;
    }
    const rssImage = imageFromRssItem(item);
    const imageUrl = rssImage && !isGoogleNewsImage(rssImage)
      ? rssImage
      : await fetchOgImage(originalUrl);
    const articleText = await fetchArticleText(articleUrl);
    const cleanArticleTitle = cleanNewsTitle(title);
    const articleSummary = buildArticleSummary({
      title,
      source,
      description: `${articleText.description || ""} ${summary || ""}`,
      body: articleText.body || ""
    });
    if (!hasSubstantialSummary(articleSummary)) {
      console.warn(`Skipped thin article: ${cleanArticleTitle || title}`);
      await sleep(500);
      continue;
    }
    const article = {
      id: `${date}-${feed.category.replace(/[^\p{Letter}\p{Number}]+/gu, "-")}-${index + 1}`,
      category: feed.category,
      title: cleanNewsTitle(title),
      source,
      url: articleUrl,
      googleNewsUrl,
      publishedAt: safeIsoDate(tag(item, "pubDate")),
      summary: articleSummary,
      analysis: "",
      action: "",
      imageUrl,
      imageLabel: feed.category
    };
    article.analysis = makeAnalysis(article);
    article.action = makeAction(article);
    parsed.push(article);
    await sleep(500);
  }
  const filtered = parsed.filter((article) => article.title && article.url);
  console.warn(`${feed.category}: RSS items ${items.length}, parsed articles ${filtered.length}`);
  return filtered;
}

function articleScore(article) {
  const text = `${article.title} ${article.summary}`;
  let score = 0;
  const publishedDate = safeIsoDate(article.publishedAt).slice(0, 10);
  const targetDate = article.id.slice(0, 10);
  if (publishedDate === targetDate) score += 70;
  else if (publishedDate >= addDays(targetDate, -2) && publishedDate <= targetDate) score += 35;
  if (/納期|供給|不足|目詰まり|調達|受注停止|遅れ/.test(text)) score += 40;
  if (/価格|高騰|値上げ|コスト|ナフサ|資材高/.test(text)) score += 35;
  if (/国交省|国土交通省|日建連|全建総連|NHK|日刊工業|建通|リフォーム産業新聞/.test(text)) score += 20;
  if (/LIXIL|石膏ボード|セメント|鋼材|木材|断熱|省エネ|補助金/.test(text)) score += 15;
  if (article.category === "お客様SNS") score += 25;
  if (article.id.includes("-crawl-")) score -= 40;
  return score;
}

function normalizeTitle(value = "") {
  return cleanNewsTitle(value)
    .replace(/[【】「」（）()［］\[\]、。・:：\s]/g, "")
    .replace(/報道特集|Yahoo!ニュース|ｄメニューニュース|TBSNEWSDIG/g, "")
    .toLowerCase();
}

function compareArticles(a, b) {
  const categoryDiff = (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99);
  if (categoryDiff !== 0) return categoryDiff;
  return articleScore(b) - articleScore(a);
}

async function fetchRealtimePosts(query, date) {
  const url = new URL("https://search.yahoo.co.jp/realtime/search");
  url.searchParams.set("p", query);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 kirii-daily-news/1.0" }
  });
  if (!response.ok) throw new Error(`Realtime search failed: ${query} ${response.status}`);
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  const json = JSON.parse(match[1]);
  const entries = json?.props?.pageProps?.pageData?.timeline?.entry || [];
  return entries.slice(0, 5).map((entry, index) => {
    const body = cleanMarkerText(entry.displayTextBody || entry.displayText || "");
    if (!body || body.length < 18) return null;
    const article = {
      id: `${date}-social-${query.replace(/[^\p{Letter}\p{Number}]+/gu, "-")}-${entry.id || index}`,
      category: "お客様SNS",
      title: `SNS投稿: ${limitText(body, 58)}`,
      source: `Yahoo!リアルタイム検索 / ${entry.screenName || entry.name || query}`,
      url: entry.url || url.toString(),
      publishedAt: entry.createdAt ? new Date(entry.createdAt * 1000).toISOString() : new Date().toISOString(),
      summary: limitText(body, 300),
      analysis: "",
      action: "",
      imageUrl: entry.profileImage || "",
      imageLabel: "SNS投稿"
    };
    article.analysis = makeAnalysis(article);
    article.action = makeAction(article);
    return article;
  }).filter(Boolean);
}

async function collectSocialSearches(date) {
  const results = await Promise.allSettled(SOCIAL_QUERIES.map((query) => fetchRealtimePosts(query, date)));
  const posts = [];
  const seen = new Set();
  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn(`Realtime search skipped: ${result.reason?.message || result.reason}`);
      continue;
    }
    for (const post of result.value) {
      const key = post.url || post.summary;
      if (seen.has(key)) continue;
      seen.add(key);
      posts.push(post);
      if (posts.length >= 5) return posts;
    }
  }
  console.warn(`Realtime search posts ${posts.length}`);
  return posts;
}

async function crawlSourcePage(source, date) {
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "kirii-daily-news/1.0" }
  });
  if (!response.ok) throw new Error(`Crawl failed ${source.name}: ${response.status}`);

  const html = await response.text();
  const pageTitle = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? source.name);
  const description = metaContent(html, "description") || metaContent(html, "og:description");
  const ogTitle = metaContent(html, "og:title");
  const ogImage = metaContent(html, "og:image") || metaContent(html, "twitter:image");
  const articles = [];
  const baseSummary = buildArticleSummary({
    title: ogTitle || pageTitle,
    source: source.name,
    description,
    body: extractArticleBody(html)
  });

  if (hasSubstantialSummary(baseSummary) && !/トップ|ホーム|サイトマップ|一覧/.test(ogTitle || pageTitle)) {
    articles.push({
      id: `${date}-crawl-${articles.length + 1}-${source.name.replace(/[^\p{Letter}\p{Number}]+/gu, "-")}`,
      category: source.category,
      title: ogTitle || pageTitle,
      source: source.name,
      url: source.url,
      publishedAt: new Date().toISOString(),
      summary: baseSummary,
      analysis: "公開ページ本文から抽出した更新候補です。RSSに出ない固定ページ更新やキャンペーン導線も拾える可能性があります。",
      action: "ページ本文の更新有無、関連商品カテゴリ、価格・納期・制度対応への影響を確認し、必要に応じて商品ページ、FAQ、メルマガ、営業資料に反映します。",
      imageUrl: ogImage ? absoluteUrl(source.url, ogImage) : "",
      imageLabel: "巡回"
    });
  }

  const linkMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seenLinks = new Set([source.url]);
  for (const match of linkMatches) {
    const href = absoluteUrl(source.url, match[1]);
    const text = stripHtml(match[2]);
    if (!href || seenLinks.has(href) || text.length < 6 || text.length > 90) continue;
    if (isHomepageUrl(href) || /トップ|ホーム|サイトマップ|一覧|Adobe|Acrobat|PDF/.test(text)) continue;
    if (!isRelevant(text, source.keywords)) continue;
    seenLinks.add(href);
    const linkedText = await fetchArticleText(href);
    const linkedSummary = buildArticleSummary({
      title: text,
      source: source.name,
      description: linkedText.description,
      body: linkedText.body
    });
    if (!hasSubstantialSummary(linkedSummary)) continue;
    articles.push({
      id: `${date}-crawl-${articles.length + 1}-${source.name.replace(/[^\p{Letter}\p{Number}]+/gu, "-")}`,
      category: source.category,
      title: text,
      source: source.name,
      url: href,
      publishedAt: new Date().toISOString(),
      summary: linkedSummary,
      analysis: "リンク先本文から抽出したトピックです。RSSに出ない更新を拾うため、ページ巡回で本文取得できたものだけを掲載しています。",
      action: "リンク先を確認し、きりいーねの商品カテゴリ、仕入れ、価格・納期表示、施工説明、キャンペーン導線に関係するものだけを採用してください。",
      imageUrl: ogImage ? absoluteUrl(source.url, ogImage) : "",
      imageLabel: "巡回リンク"
    });
    if (articles.length >= 4) break;
  }

  console.warn(`${source.name}: crawled topics ${articles.length}`);
  return articles;
}

async function collectArticles(date) {
  const isToday = date === jstDate();
  const results = await Promise.allSettled([
    ...FEEDS.map((feed) => fetchGoogleNews(feed, date)),
    ...(isToday ? [collectSocialSearches(date)] : []),
    ...CRAWL_SOURCES.map((source) => crawlSourcePage(source, date))
  ]);
  const seen = new Set();
  const seenTitles = new Set();
  const articles = [];

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn(`News feed skipped: ${result.reason?.message || result.reason}`);
      continue;
    }
    for (const article of result.value) {
      const key = article.url || article.title;
      const titleKey = normalizeTitle(article.title);
      if (seen.has(key) || seenTitles.has(titleKey)) continue;
      seen.add(key);
      if (titleKey) seenTitles.add(titleKey);
      articles.push(article);
    }
  }

  if (articles.length > 0) {
    const liveArticles = articles.filter((article) => !article.id.includes("-crawl-"));
    const selected = [];
    for (const category of CATEGORIES.filter((item) => item !== "すべて")) {
      selected.push(...liveArticles
        .filter((article) => article.category === category)
        .sort((a, b) => articleScore(b) - articleScore(a))
        .slice(0, category === "お客様SNS" ? 3 : 4));
    }
    if (selected.length < 18) {
      const selectedKeys = new Set(selected.map((article) => article.url || article.id));
      selected.push(...liveArticles
        .filter((article) => !selectedKeys.has(article.url || article.id))
        .sort(compareArticles)
        .slice(0, 18 - selected.length));
    }
    selected.splice(18);
    return selected.slice(0, 18).sort(compareArticles);
  }

  console.warn("No articles with readable source text were collected.");
  return [];
}

function renderPage(data, { latest = false, archives = [] } = {}) {
  const json = JSON.stringify(data).replaceAll("</", "<\\/");
  const title = latest ? "Kirii / Kiriine Daily Market Intelligence" : `Kirii Daily News ${data.date}`;
  const archiveOptions = archives.map((archive) => {
    const selected = archive.date === data.date ? " selected" : "";
    return `<option value="${escapeHtml(archive.html)}"${selected}>${escapeHtml(archive.label)}</option>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --primary: #17466e;
      --primary-soft: #e8f1f8;
      --accent: #0f766e;
      --accent-soft: #e7f8f5;
      --danger: #b45309;
      --danger-soft: #fff7ed;
      --pink: #be185d;
      --pink-soft: #fce7f3;
      --shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
      --radius: 20px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
    }
    header {
      background: linear-gradient(135deg, #0f2f4d, #17466e 54%, #0f766e);
      color: #fff;
      padding: 34px 24px 42px;
    }
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 24px;
      align-items: center;
    }
    .eyebrow {
      letter-spacing: .15em;
      text-transform: uppercase;
      font-size: 12px;
      opacity: .86;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1.15;
      letter-spacing: 0;
    }
    .lead {
      margin: 0;
      max-width: 860px;
      opacity: .93;
      font-size: 15px;
    }
    .control-card {
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.25);
      border-radius: var(--radius);
      padding: 18px;
      backdrop-filter: blur(10px);
    }
    .control-card label { display: block; font-size: 12px; opacity: .88; margin-bottom: 6px; }
    .control-card select, .control-card a {
      width: 100%;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 15px;
      font-weight: 800;
      color: var(--primary);
      background: #fff;
    }
    .control-card a {
      display: inline-flex;
      justify-content: center;
      text-decoration: none;
      margin-top: 10px;
    }
    main {
      max-width: 1280px;
      margin: -22px auto 64px;
      padding: 0 22px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
      margin-bottom: 22px;
    }
    .kpi {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 18px;
      min-height: 112px;
    }
    .kpi-label { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
    .kpi-value { font-size: 30px; line-height: 1; font-weight: 900; color: var(--primary); }
    .kpi-note { margin-top: 8px; color: var(--muted); font-size: 12px; }
    .layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    .section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
      margin-bottom: 22px;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    h2, h3 { margin: 0; letter-spacing: 0; }
    h2 { font-size: 22px; }
    h3 { font-size: 18px; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }
    .category-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    button, .link-button {
      border: none;
      cursor: pointer;
      border-radius: 11px;
      padding: 9px 12px;
      font-size: 13px;
      font-weight: 900;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .category-tabs button { background: #fff; color: #374151; border: 1px solid var(--line); }
    .category-tabs button.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    .article-card {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 16px;
      background: #fff;
    }
    .article-card.no-thumb { grid-template-columns: 1fr; }
    .article-card.liked {
      border: 2px solid var(--pink);
      background: linear-gradient(180deg, #fff, #fff7fb);
    }
    .photo {
      min-height: 180px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      text-align: center;
      color: #fff;
      padding: 18px;
      font-weight: 900;
      background: linear-gradient(135deg, #17466e, #0f766e);
      overflow: hidden;
    }
    .photo.has-image { padding: 0; background: #e5e7eb; }
    .photo.has-image img {
      width: 100%;
      height: 100%;
      min-height: 180px;
      object-fit: cover;
      display: block;
    }
    .photo .icon { display: block; font-size: 28px; margin-bottom: 8px; }
    .photo .sub { display: block; opacity: .9; font-size: 12px; margin-top: 4px; }
    .meta-row { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 8px; }
    .tag {
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 8px;
      background: #f3f4f6;
      color: #374151;
      font-size: 11px;
      font-weight: 800;
    }
    .tag.cat { background: var(--accent-soft); color: var(--accent); }
    .tag.hot { background: var(--danger-soft); color: var(--danger); }
    .source-name { color: var(--muted); font-size: 12px; margin: 6px 0 10px; }
    .source-summary-box {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px 14px;
      margin: 10px 0;
      font-size: 14px;
    }
    .source-summary-box strong {
      display: block;
      margin-bottom: 5px;
      color: var(--primary);
    }
    .analysis-box, .action-box {
      border-radius: 14px;
      padding: 11px 13px;
      font-size: 13px;
      margin-top: 10px;
    }
    .analysis-box { background: #f8fafc; border-left: 4px solid var(--primary); }
    .action-box { background: var(--danger-soft); border-left: 4px solid var(--danger); }
    .analysis-box strong, .action-box strong { display: block; margin-bottom: 4px; }
    .button-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .btn-like { background: var(--pink-soft); color: var(--pink); border: 1px solid #fbcfe8; }
    .btn-like.active { background: var(--pink); color: #fff; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-muted { background: #f3f4f6; color: #374151; border: 1px solid var(--line); }
    .link-button { background: var(--accent); color: #fff; }
    .side-list { list-style: none; padding: 0; margin: 0; }
    .side-list li { padding: 12px 0; border-bottom: 1px solid var(--line); }
    .side-list li:last-child { border-bottom: none; }
    .side-list strong { display: block; margin-bottom: 4px; }
    .side-list span { color: var(--muted); font-size: 13px; }
    .liked-list { display: grid; gap: 10px; }
    .liked-item { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; font-size: 13px; }
    .liked-item strong { display: block; margin-bottom: 4px; }
    .traffic-wrap { overflow-x: auto; }
    .chart-box { min-width: 760px; }
    svg { max-width: 100%; height: auto; display: block; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      text-align: right;
      padding: 9px;
      white-space: nowrap;
    }
    th:first-child, td:first-child { text-align: left; }
    th { color: var(--muted); background: #f8fafc; }
    .note { color: var(--muted); font-size: 12px; margin-top: 8px; }
    .footer { color: var(--muted); font-size: 12px; text-align: center; margin-top: 24px; }
    @media (max-width: 980px) {
      .header-inner, .layout, .kpi-grid, .article-card { grid-template-columns: 1fr; }
      main { margin-top: -14px; }
    }
    @media print {
      header, .kpi-grid, .category-tabs, aside, .button-row, .footer { display: none !important; }
      body { background: #fff; }
      main { margin: 0; max-width: none; }
      .section { box-shadow: none; border: none; padding: 0; }
      .article-card { break-inside: avoid; grid-template-columns: 1fr; }
      .photo { display: none; }
      body.print-liked .article-card:not(.liked) { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div>
        <div class="eyebrow">Daily Market Intelligence for Kirii / Kiriine</div>
        <h1>桐井製作所・きりいーね<br />建材市場デイリーニュース</h1>
        <p class="lead">官公庁、公的統計、業界団体、競合メーカー、競合EC、SNS、顧客投稿、その他おすすめ記事を毎日収集し、サマリー、分析コメント、アクションプラン、情報元リンク付きで保存します。</p>
      </div>
      <div class="control-card">
        <label for="issueSelect">バックナンバー</label>
        <select id="issueSelect">${archiveOptions || `<option value="daily_${escapeHtml(data.date)}.html">${escapeHtml(data.label)}</option>`}</select>
        <a href="data/daily_${escapeHtml(data.date)}.json">JSONを開く</a>
        <div class="note" style="color:#fff;opacity:.9;">毎朝7時に daily_YYYY-MM-DD.html と JSON を生成します。</div>
      </div>
    </div>
  </header>
  <main>
    <section class="kpi-grid">
      <div class="kpi"><div class="kpi-label">本日の記事数</div><div class="kpi-value" id="articleCount">0</div><div class="kpi-note">カテゴリ別に整理</div></div>
      <div class="kpi"><div class="kpi-label">いいね済み</div><div class="kpi-value" id="likedCount">0</div><div class="kpi-note">PDF出力対象</div></div>
      <div class="kpi"><div class="kpi-label">収集カテゴリ</div><div class="kpi-value">6</div><div class="kpi-note">公的情報からSNSまで</div></div>
      <div class="kpi"><div class="kpi-label">更新時刻</div><div class="kpi-value">7:00</div><div class="kpi-note">JST / GitHub Actions</div></div>
      <div class="kpi"><div class="kpi-label">PDF出力</div><div class="kpi-value">OK</div><div class="kpi-note">いいね記事を保存</div></div>
    </section>
    <div class="layout">
      <div>
        <section class="section">
          <div class="section-title"><h2>カテゴリ別ニュース</h2><span class="badge">${escapeHtml(data.date)}</span></div>
          <div class="category-tabs" id="categoryTabs"></div>
          <div id="articleList"></div>
        </section>
        <section class="section">
          <div class="section-title"><h2>競合EC 来訪ボリューム</h2><span class="badge">公開推定値</span></div>
          <div class="traffic-wrap"><div class="chart-box" id="trafficChart"></div></div>
          <div id="trafficTable"></div>
          <div class="note">公開で確認できるSemrush等の推定値を表示します。競合他社の実PV、実セッション、実ユーザー数は通常公開されないため、数値は方向感の把握用です。きりいーねはGA4/Search Console連携で実数に差し替えてください。</div>
        </section>
      </div>
      <aside>
        <section class="section">
          <div class="section-title"><h2>いいね記事</h2><span class="badge">PDF対象</span></div>
          <div id="likedList" class="liked-list"></div>
          <div class="button-row">
            <button class="btn-primary" id="exportPdfButton">いいね記事をPDF出力</button>
            <button class="btn-muted" id="clearLikesButton">いいねを全解除</button>
          </div>
        </section>
        <section class="section">
          <div class="section-title"><h2>収集カテゴリ</h2></div>
          <ul class="side-list" id="categoryList"></ul>
        </section>
        <section class="section">
          <div class="section-title"><h2>運用メモ</h2></div>
          <ul class="side-list">
            <li><strong>GitHub Pages</strong><span>index.html は最新号、daily_YYYY-MM-DD.html は日次保存版です。</span></li>
            <li><strong>自動生成</strong><span>Actions が RSS を取得し、JSON と HTML をコミットします。</span></li>
            <li><strong>PDF</strong><span>ハートを押した記事だけを印刷画面から PDF 保存できます。</span></li>
          </ul>
        </section>
      </aside>
    </div>
    <div class="footer">Generated at ${escapeHtml(data.generatedAt)} / ${escapeHtml(data.timezone)}</div>
  </main>
  <script id="dailyData" type="application/json">${json}</script>
  <script>
    (function () {
      "use strict";
      const issue = JSON.parse(document.getElementById("dailyData").textContent);
      const categories = ${JSON.stringify(CATEGORIES)};
      const likeKey = "kirii-daily-liked";
      let selectedCategory = "すべて";
      function byId(id) { return document.getElementById(id); }
      function createEl(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
      }
      function getLikes() { return JSON.parse(localStorage.getItem(likeKey) || "[]"); }
      function saveLikes(likes) { localStorage.setItem(likeKey, JSON.stringify(likes)); }
      function escapeHtml(text) {
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      }
      function renderCategoryTabs() {
        const wrap = byId("categoryTabs");
        wrap.replaceChildren();
        categories.forEach(function (category) {
          const button = createEl("button", selectedCategory === category ? "active" : "", category);
          button.addEventListener("click", function () { selectedCategory = category; renderArticles(); });
          wrap.appendChild(button);
        });
        const list = byId("categoryList");
        list.replaceChildren();
        categories.filter(function (category) { return category !== "すべて"; }).forEach(function (category) {
          const count = issue.articles.filter(function (article) { return article.category === category; }).length;
          const item = createEl("li");
          item.append(createEl("strong", "", category), createEl("span", "", count + "件"));
          list.appendChild(item);
        });
      }
      function renderArticles() {
        const likes = getLikes();
        const articles = issue.articles.filter(function (article) {
          return selectedCategory === "すべて" || article.category === selectedCategory;
        });
        byId("articleCount").textContent = String(issue.articles.length);
        const list = byId("articleList");
        list.replaceChildren();
        articles.forEach(function (article) { list.appendChild(renderArticle(article, likes.includes(article.id))); });
        renderLikedList();
      }
      function renderArticle(article, liked) {
        const card = createEl("article", (liked ? "article-card liked" : "article-card") + (article.imageUrl ? "" : " no-thumb"));
        if (article.imageUrl) {
          const photo = createEl("div", "photo has-image");
          const img = document.createElement("img");
          img.src = article.imageUrl;
          img.alt = article.title;
          img.loading = "lazy";
          img.referrerPolicy = "no-referrer";
          img.addEventListener("error", function () {
            card.classList.add("no-thumb");
            photo.remove();
          });
          photo.appendChild(img);
          card.appendChild(photo);
        }
        const body = document.createElement("div");
        const meta = createEl("div", "meta-row");
        meta.append(createEl("span", "tag cat", article.category), createEl("span", "tag hot", article.source));
        body.appendChild(meta);
        body.appendChild(createEl("h3", "", article.title));
        body.appendChild(createEl("div", "source-name", "情報元：" + article.source));
        const sourceSummary = createEl("div", "source-summary-box");
        sourceSummary.append(createEl("strong", "", "記事サマリー"), document.createTextNode(article.summary || ""));
        body.appendChild(sourceSummary);
        const analysis = createEl("div", "analysis-box");
        analysis.append(createEl("strong", "", "分析コメント"), document.createTextNode(article.analysis || ""));
        body.appendChild(analysis);
        const action = createEl("div", "action-box");
        action.append(createEl("strong", "", "アクションプラン"), document.createTextNode(article.action || ""));
        body.appendChild(action);
        const row = createEl("div", "button-row");
        const link = createEl("a", "link-button", "情報元リンク");
        link.href = article.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const like = createEl("button", liked ? "btn-like active" : "btn-like", liked ? "いいね解除" : "いいね！");
        like.addEventListener("click", function () { toggleLike(article.id); });
        row.append(link, like);
        body.appendChild(row);
        card.appendChild(body);
        return card;
      }
      function toggleLike(id) {
        let likes = getLikes();
        likes = likes.includes(id) ? likes.filter(function (value) { return value !== id; }) : likes.concat(id);
        saveLikes(likes);
        renderArticles();
      }
      function renderLikedList() {
        const likes = getLikes();
        const liked = issue.articles.filter(function (article) { return likes.includes(article.id); });
        byId("likedCount").textContent = String(liked.length);
        const list = byId("likedList");
        list.replaceChildren();
        if (liked.length === 0) {
          list.appendChild(createEl("div", "liked-item", "まだいいね記事はありません。"));
          return;
        }
        liked.forEach(function (article) {
          const item = createEl("div", "liked-item");
          item.append(createEl("strong", "", article.title), createEl("div", "", article.category + " / " + article.source), createEl("div", "", article.summary));
          list.appendChild(item);
        });
      }
      function formatVolume(value) {
        if (value === null || value === undefined) return "未取得";
        if (value >= 1000000) return (value / 1000000).toFixed(2) + "M";
        if (value >= 1000) return (value / 1000).toFixed(1) + "K";
        return String(value);
      }
      function renderTraffic() {
        const rows = issue.trafficRows || [];
        const chart = byId("trafficChart");
        const width = 960;
        const height = 380;
        const colors = ["#17466e", "#0f766e", "#b45309", "#6d28d9", "#be185d"];
        const values = rows.flatMap(function (row) { return row.visits || []; }).filter(function (value) { return typeof value === "number"; });
        const maxValue = Math.max(1, ...values);
        const minValue = Math.max(1, Math.min(...values));
        const yTicks = [10000, 50000, 100000, 500000, 1000000, 5000000, 20000000].filter(function (value) {
          return value >= minValue * 0.7 && value <= maxValue * 1.2;
        });
        const left = 104;
        const right = 815;
        const top = 42;
        const bottom = 300;
        const logMin = Math.log10(Math.max(1000, minValue * 0.6));
        const logMax = Math.log10(maxValue * 1.35);
        function xFor(index, length) {
          return left + index * ((right - left) / Math.max(1, length - 1));
        }
        function yFor(value) {
          return bottom - ((Math.log10(value) - logMin) / (logMax - logMin)) * (bottom - top);
        }
        let svg = "<svg viewBox='0 0 " + width + " " + height + "' role='img' aria-label='競合EC来訪ボリューム'>";
        svg += "<rect x='0' y='0' width='" + width + "' height='" + height + "' rx='18' fill='#f8fafc'></rect>";
        yTicks.forEach(function (tick) {
          const y = yFor(tick);
          svg += "<line x1='" + left + "' y1='" + y + "' x2='" + right + "' y2='" + y + "' stroke='#e5e7eb'></line>";
          svg += "<text x='" + (left - 12) + "' y='" + (y + 4) + "' text-anchor='end' fill='#6b7280' font-size='14' font-weight='700'>" + formatVolume(tick) + "</text>";
        });
        const xLabels = ["60日前", "45日前", "30日前", "15日前", "直近"];
        const xIndexes = [0, 2, 4, 6, 8];
        xLabels.forEach(function (label, index) {
          const x = xFor(xIndexes[index], 9);
          svg += "<line x1='" + x + "' y1='" + top + "' x2='" + x + "' y2='" + bottom + "' stroke='#eef2f7'></line>";
          svg += "<text x='" + x + "' y='340' text-anchor='middle' fill='#374151' font-size='17' font-weight='900'>" + label + "</text>";
        });
        svg += "<line x1='" + left + "' y1='" + top + "' x2='" + left + "' y2='" + bottom + "' stroke='#94a3b8' stroke-width='2'></line>";
        svg += "<line x1='" + left + "' y1='" + bottom + "' x2='" + right + "' y2='" + bottom + "' stroke='#94a3b8' stroke-width='2'></line>";
        svg += "<text x='18' y='32' fill='#374151' font-size='14' font-weight='900'>訪問数 / 週</text>";
        svg += "<text x='390' y='368' fill='#374151' font-size='15' font-weight='900'>過去60日間の推定推移</text>";
        if (yTicks.length === 0) {
          svg += "<text x='120' y='190' fill='#6b7280' font-size='16'>表示できる訪問数データがありません</text>";
        }
        rows.forEach(function (row, rowIndex) {
          const usable = (row.visits || []).map(function (value, index) { return { value: value, index: index }; }).filter(function (point) { return typeof point.value === "number"; });
          const points = usable.map(function (point) {
            const x = xFor(point.index, usable.length);
            const y = yFor(point.value);
            return x + "," + y;
          }).join(" ");
          svg += "<polyline points='" + points + "' fill='none' stroke='" + colors[rowIndex % colors.length] + "' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'></polyline>";
          usable.forEach(function (point) {
            svg += "<circle cx='" + xFor(point.index, usable.length) + "' cy='" + yFor(point.value) + "' r='4' fill='" + colors[rowIndex % colors.length] + "'></circle>";
          });
          const latest = usable[usable.length - 1];
          if (latest) {
            svg += "<text x='" + (right + 12) + "' y='" + (yFor(latest.value) + 4) + "' fill='" + colors[rowIndex % colors.length] + "' font-size='13' font-weight='900'>" + escapeHtml(row.site) + " " + formatVolume(latest.value) + "</text>";
          }
          svg += "<text x='126' y='" + (24 + rowIndex * 17) + "' fill='" + colors[rowIndex % colors.length] + "' font-size='13' font-weight='800'>" + escapeHtml(row.site + " / " + row.confidence) + "</text>";
        });
        svg += "</svg>";
        chart.innerHTML = svg;

        const table = document.createElement("table");
        table.innerHTML = "<thead><tr><th>サイト</th><th>ドメイン</th><th>月間訪問</th><th>直近週</th><th>Pages/Visit</th><th>区分</th><th>出典</th></tr></thead>";
        const tbody = document.createElement("tbody");
        rows.forEach(function (row) {
          const tr = document.createElement("tr");
          const latest = (row.visits || []).filter(function (value) { return typeof value === "number"; }).slice(-1)[0];
          tr.innerHTML = "<td>" + escapeHtml(row.site) + "</td><td>" + escapeHtml(row.domain) + "</td><td>" + formatVolume(row.monthlyVisits) + "</td><td>" + formatVolume(latest) + "</td><td>" + (row.pagesPerVisit || "未取得") + "</td><td>" + escapeHtml(row.confidence || "推定") + "</td><td>" + escapeHtml(row.source) + "</td>";
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        byId("trafficTable").replaceChildren(table);
      }
      function exportLikedPdf() {
        const likes = getLikes();
        const liked = issue.articles.filter(function (article) { return likes.includes(article.id); });
        if (liked.length === 0) { alert("PDF出力するいいね記事がありません。"); return; }
        const win = window.open("", "_blank");
        if (!win) { alert("ポップアップがブロックされました。ブラウザ設定を確認してください。"); return; }
        const doc = win.document;
        doc.open();
        doc.write("<!DOCTYPE html><html lang='ja'><head><meta charset='UTF-8'><title>いいね記事PDF</title><style>body{font-family:sans-serif;line-height:1.7;padding:28px;color:#1f2937}h1{font-size:24px}.item{border-bottom:1px solid #ddd;padding:14px 0}.meta{color:#666;font-size:12px}a{color:#0f766e}</style></head><body>");
        doc.write("<h1>桐井製作所・きりいーね いいね記事まとめ</h1>");
        liked.forEach(function (article) {
          doc.write("<div class='item'>");
          doc.write("<h2>" + escapeHtml(article.title) + "</h2>");
          doc.write("<div class='meta'>" + escapeHtml(issue.label + " / " + article.category + " / " + article.source) + "</div>");
          doc.write("<p><strong>サマリー：</strong>" + escapeHtml(article.summary || "") + "</p>");
          doc.write("<p><strong>分析：</strong>" + escapeHtml(article.analysis || "") + "</p>");
          doc.write("<p><strong>アクション：</strong>" + escapeHtml(article.action || "") + "</p>");
          doc.write("<p><a href='" + encodeURI(article.url) + "'>情報元リンク</a></p>");
          doc.write("</div>");
        });
        doc.write("</body></html>");
        doc.close();
        win.focus();
        win.print();
      }
      function clearLikes() { saveLikes([]); renderArticles(); }
      byId("exportPdfButton").addEventListener("click", exportLikedPdf);
      byId("clearLikesButton").addEventListener("click", clearLikes);
      byId("issueSelect").addEventListener("change", function (event) {
        if (event.target.value) window.location.href = event.target.value;
      });
      renderCategoryTabs();
      renderArticles();
      renderTraffic();
    }());
  </script>
</body>
</html>`;
}

async function listArchives() {
  await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
  const files = await fs.readdir(path.join(ROOT, "data"));
  const archives = [];
  for (const file of files) {
    const match = file.match(/^daily_(\d{4}-\d{2}-\d{2})\.json$/);
    if (!match) continue;
    const date = match[1];
    archives.push({
      date,
      label: labelForDate(date),
      json: `data/daily_${date}.json`,
      html: `daily_${date}.html`
    });
  }
  return archives.sort((a, b) => b.date.localeCompare(a.date));
}

async function writeDaily(data, { updateLatest = true, archives = [] } = {}) {
  const archiveList = archives.length > 0 ? archives : await listArchives();
  await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "data", `daily_${data.date}.json`), `${JSON.stringify(data, null, 2)}\n`);
  await fs.writeFile(path.join(ROOT, `daily_${data.date}.html`), renderPage(data, { archives: archiveList }));
  if (updateLatest) {
    await fs.writeFile(path.join(ROOT, "data", "latest.json"), `${JSON.stringify({ date: data.date, json: `data/daily_${data.date}.json`, html: `daily_${data.date}.html` }, null, 2)}\n`);
    await fs.writeFile(path.join(ROOT, "index.html"), renderPage(data, { latest: true, archives: archiveList }));
  }
}

async function buildDaily(date) {
  const generatedAt = new Date().toISOString();
  const articles = await collectArticles(date);
  return {
    date,
    label: labelForDate(date),
    generatedAt,
    timezone: TIME_ZONE,
    sources: FEEDS,
    categories: CATEGORIES,
    trafficRows: TRAFFIC_ROWS,
    articles
  };
}

async function refreshArchivePages(latestDate) {
  const archives = await listArchives();
  for (const archive of archives) {
    const data = JSON.parse(await fs.readFile(path.join(ROOT, archive.json), "utf8"));
    await fs.writeFile(path.join(ROOT, archive.html), renderPage(data, { archives }));
  }
  const latest = archives.find((archive) => archive.date === latestDate) || archives[0];
  if (!latest) return;
  const latestData = JSON.parse(await fs.readFile(path.join(ROOT, latest.json), "utf8"));
  await fs.writeFile(path.join(ROOT, "data", "latest.json"), `${JSON.stringify({ date: latest.date, json: latest.json, html: latest.html }, null, 2)}\n`);
  await fs.writeFile(path.join(ROOT, "index.html"), renderPage(latestData, { latest: true, archives }));
}

async function main() {
  const endDate = process.env.NEWS_DATE || jstDate();
  const backfillDays = Number.parseInt(process.env.BACKFILL_DAYS || "1", 10);
  const days = Number.isFinite(backfillDays) && backfillDays > 1 ? backfillDays : 1;
  const dates = Array.from({ length: days }, (_, index) => addDays(endDate, index - days + 1));

  for (const date of dates) {
    console.warn(`Generating ${date}`);
    const data = await buildDaily(date);
    await writeDaily(data, { updateLatest: date === endDate });
  }

  await refreshArchivePages(endDate);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
