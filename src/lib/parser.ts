/**
 * 馬上飛名單解析邏輯。
 *
 * 由原 index.html 的 vanilla JS 逐一移植，行為 100% 不變，
 * 並已與 Python skill 對齊（2026.06.11 → 111/36/20、2026.06.13 → 40/10）。
 * 變更任何規則前請先確認不影響上述基準。
 */

export interface Order {
  date: string;    // B 出發日期
  airline: string; // C 航空（無航空時為「團」）
  trip: string;    // D 地點／團名
  name: string;    // J 姓名（最後一組括號內標籤）
  qty: string;     // F 報名人數
  review: boolean; // 是否需人工確認
  raw: string;     // 原始訊息內容
}

export interface Day {
  date: string;
  idx: number;
}

export interface ExtractResult {
  orders: Order[];
  duplicates: number;
}

// 航空公司關鍵字（最長優先；泰亞航/泰越捷必須排在亞航前面）
export const AIRLINES = [
  "大灣區航空", "泰越捷", "泰亞航", "阿聯酋", "泰獅",
  "樂桃", "虎航", "亞航", "酷航", "長榮", "星宇", "星悅", "華航", "MSC",
] as const;

const OPEN_BRACKETS = "（(";
const CLOSE_BRACKETS = "）)";

const reDay = () => /^(\d{4}\.\d{2}\.\d{2})\s*星期./;
const reMsg = () => /^\d{1,2}:\d{2}\s+\S+\s+(.*)$/;
const reDate = () => /(\d{1,2})\/(\d{1,2})/;

/** 掃描日分隔行，回傳 [{date, idx}]。 */
export function indexDays(lines: string[]): Day[] {
  const days: Day[] = [];
  lines.forEach((line, i) => {
    const m = line.trim().match(reDay());
    if (m) days.push({ date: m[1], idx: i });
  });
  return days;
}

/** 從 qty 前最後一個收括號向左做深度配對，回傳對應開括號索引（找不到 -1）。 */
function findTagSpan(text: string, qtyCloseIdx: number): number {
  let depth = 0;
  for (let i = qtyCloseIdx; i >= 0; i--) {
    const ch = text[i];
    if (CLOSE_BRACKETS.includes(ch)) {
      depth++;
    } else if (OPEN_BRACKETS.includes(ch)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 解析單則訂單內容，回傳物件或 null。 */
export function parseOrder(content: string): Order | null {
  if (!reDate().test(content)) return null;
  if (![...CLOSE_BRACKETS].some((c) => content.includes(c))) return null;

  // B 出發日期：去掉開頭「改」，取第一個 M/D
  let body = content.replace(/^\s+/, "");
  if (body.startsWith("改")) body = body.slice(1);
  const m = reDate().exec(body);
  if (!m) return null;
  const date = `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`;

  // 日期之後的剩餘文字；去除「出發」雜訊前綴
  let rest = body.slice(m.index + m[0].length);
  rest = rest.replace(/^\s*出發\s*/, "");

  // 找 qty 前最後一個收括號，做深度配對切出 J / D
  const lastClose = Math.max(rest.lastIndexOf("）"), rest.lastIndexOf(")"));
  if (lastClose === -1) return null;
  const openIdx = findTagSpan(rest, lastClose);
  if (openIdx === -1) return null;

  const name = rest.slice(openIdx + 1, lastClose).trim();   // J 姓名
  const before = rest.slice(0, openIdx);                     // 航空 + 團名
  const qtyRaw = rest.slice(lastClose + 1);                  // 人數區段

  // C 航空 ＋ D 地點／團名
  let airline = "";
  let trip = before;
  for (const air of AIRLINES) {
    if (before.startsWith(air)) {
      airline = air;
      trip = before.slice(air.length);
      break;
    }
  }
  trip = trip.trim();

  // F 報名人數：先去尾端 emoji／符號／空白，再去尾端 位/席位/席
  let qty = qtyRaw.trim();
  qty = qty.replace(/[^\p{L}\p{N}_+＋]+$/u, "").trim();
  qty = qty.replace(/\s*(席位|席|位)\s*$/, "").trim();

  // 找不到航空 → C 欄以「團」替代；仍標記需確認
  // 用 \p{Nd}（含全形數字）對齊 Python 的 \d，避免全形人數被誤標
  const review = airline === "" || !/^\p{Nd}+$/u.test(qty);
  const airlineOut = airline ? airline : "團";

  return { date, airline: airlineOut, trip, name, qty, review, raw: content.trim() };
}

/** 從 startIdx 起逐行解析並去重，回傳 {orders, duplicates}。 */
export function extractOrders(lines: string[], startIdx: number): ExtractResult {
  const orders: Order[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const m = lines[i].match(reMsg());
    if (!m) continue;
    const order = parseOrder(m[1]);
    if (!order) continue;
    const key = [order.date, order.airline, order.trip, order.name, order.qty].join(" ");
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    orders.push(order);
  }
  return { orders, duplicates };
}

/** 產生 B～J 的 TSV（僅 B/C/D/F/J 有值，E/G/H/I 留空）。 */
export function buildTsv(orders: Order[]): string {
  return orders.map((o) =>
    [o.date, o.airline, o.trip, "", o.qty, "", "", "", o.name].join("\t")
  ).join("\n") + "\n";
}

/** 產生需確認清單文字。 */
export function buildReview(reviewRows: Order[]): string {
  let out = `需人工確認清單（共 ${reviewRows.length} 筆）\n`;
  out += "格式：B 出發日期 | C 航空 | D 地點團名 | F 人數 | J 姓名\n";
  out += "=".repeat(60) + "\n\n";
  for (const o of reviewRows) {
    out += `${o.date} | ${o.airline} | ${o.trip} | ${o.qty} | ${o.name}\n`;
    out += `  原文：${o.raw}\n\n`;
  }
  return out;
}
