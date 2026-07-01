/**
 * 刷卡對帳核心邏輯。
 *
 * 用業績表的「姓名」（J 欄）對到 LinkPay「付款名稱」訂單描述裡的括號標籤，
 * 取出該筆「交易金額」回填業績表的金額欄（G）。
 *
 * 比對鍵＝日期＋航空＋姓名（標籤）；LinkPay 先依訂單號去重、只取付款成功。
 * 同一鍵有多筆（分次刷卡）時，依金額排序與業績表同鍵多列逐一對應；
 * LinkPay 筆數多於業績表列數時，取金額較小的前 N 筆回填，多餘者列入查無業績表清單；
 * LinkPay 筆數少於業績表列數則列入需確認、不自動回填。
 *
 * 業績表用 ExcelJS 讀寫以保留儲存格樣式（顏色、欄寬）；
 * LinkPay 用 SheetJS 讀取以支援 .xls 格式。
 */
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { parseOrder } from "./parser";

export type RowStatus = "filled" | "review" | "none";

export interface ReconcileRow {
  sheetRow: number; // ExcelJS 1-based 列號，寫回用
  name: string;
  date: string;
  airline: string;
  trip: string;
  originalAmount: string;
  matchedAmount: number | null;
  status: RowStatus;
  note?: string;
}

export interface ReconcileResult {
  rows: ReconcileRow[];
  filledCount: number;
  reviewCount: number;
  noneCount: number;
  unmatchedLink: string[]; // LinkPay 付款成功但業績表查無
  workbook: ExcelJS.Workbook; // 業績表（供寫回下載）
  sheetName: string;
  amountCol: number; // 金額欄 ExcelJS 1-based
}

interface LinkTxn {
  amount: number;
  raw: string;
}

/** 讀業績表（.xlsx）成 ExcelJS 工作簿，保留完整樣式。 */
export function readPerfWorkbook(file: File): Promise<ExcelJS.Workbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(reader.result as ArrayBuffer);
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** 讀 LinkPay 訂單（.xls / .xlsx）成 SheetJS 工作簿。 */
export function readLinkWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(XLSX.read(reader.result as ArrayBuffer, { type: "array" }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, "");

function keyOf(date: string, airline: string, name: string): string {
  return [norm(date), norm(airline), norm(name)].join("|");
}

/** 取金額數字（去千分位逗號、貨幣符號）。 */
function toAmount(v: unknown): number {
  return Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
}

/** ExcelJS 儲存格值 → 日期 M/D 字串。 */
function toMonthDay(v: unknown): string {
  if (v instanceof Date) return `${v.getMonth() + 1}/${v.getDate()}`;
  const n = Number(v);
  if (!isNaN(n) && n > 1000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  }
  const m = /(\d{1,2})\/(\d{1,2})/.exec(String(v ?? ""));
  return m ? `${+m[1]}/${+m[2]}` : String(v ?? "");
}

/** 從 ExcelJS Cell 取出純值（處理公式、富文字、連結等包裝型別）。 */
function cellVal(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("formula" in v || "sharedFormula" in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      // 公式計算結果本身也可能是錯誤物件（如 #N/A），需額外判斷
      if (r != null && typeof r === "object" && "error" in r) return null;
      return r ?? null;
    }
    if ("richText" in v)
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if ("error" in v) return null;
  }
  return v;
}

/** 在 ExcelJS 標題列找符合 predicate 的欄位（回傳 1-based），找不到回傳 fallback。 */
function findColExcel(
  headerRow: ExcelJS.Row,
  predicate: (h: string) => boolean,
  fallback: number
): number {
  let found = -1;
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (found < 0 && predicate(String(cellVal(cell) ?? ""))) found = colNumber;
  });
  return found >= 0 ? found : fallback;
}

/** 在 SheetJS 標題列找符合 predicate 的欄位（回傳 0-based），找不到回傳 fallback。 */
function findColXlsx(
  header: unknown[],
  predicate: (h: string) => boolean,
  fallback: number
): number {
  const idx = header.findIndex((h) => predicate(String(h ?? "")));
  return idx >= 0 ? idx : fallback;
}

/** 由 LinkPay 工作簿建立「比對鍵 → 交易清單」索引。 */
function indexLinkPay(wb: XLSX.WorkBook): {
  groups: Map<string, LinkTxn[]>;
  rawByKey: Map<string, string>;
} {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });
  const header = rows[0] ?? [];
  const descCol = findColXlsx(header, (h) => h.includes("付款名稱"), 4);
  const amountCol = findColXlsx(header, (h) => h.includes("交易金額") || h.includes("金額"), 6);
  const statusCol = findColXlsx(header, (h) => h.includes("付款狀態"), 8);
  const idCol = findColXlsx(header, (h) => h.includes("訂單號碼"), 3);

  const groups = new Map<string, LinkTxn[]>();
  const rawByKey = new Map<string, string>();
  const seenId = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const id = String(r[idCol] ?? "");
    if (id && seenId.has(id)) continue; // 依訂單號去重（只對付款成功去重，見下方）
    if (String(r[statusCol] ?? "") !== "付款成功") continue;
    if (id) seenId.add(id);

    const desc = String(r[descCol] ?? "");
    const order = parseOrder(desc);
    if (!order) continue;
    const key = keyOf(order.date, order.airline, order.name);
    const list = groups.get(key) ?? [];
    list.push({ amount: toAmount(r[amountCol]), raw: desc });
    groups.set(key, list);
    if (!rawByKey.has(key)) rawByKey.set(key, desc);
  }
  return { groups, rawByKey };
}

/** 執行對帳。 */
export function reconcile(perfWb: ExcelJS.Workbook, linkWb: XLSX.WorkBook): ReconcileResult {
  const { groups: linkGroups, rawByKey } = indexLinkPay(linkWb);

  const ws = perfWb.worksheets[0];
  const sheetName = ws.name;
  const headerRow = ws.getRow(1);

  const dateCol    = findColExcel(headerRow, (h) => h.includes("出發"), 2);
  const airlineCol = findColExcel(headerRow, (h) => h.includes("航空"), 3);
  const tripCol    = findColExcel(headerRow, (h) => h.includes("團名") || h.includes("地點"), 4);
  const amountCol  = findColExcel(headerRow, (h) => h.includes("金額"), 7);
  const nameCol    = findColExcel(headerRow, (h) => h.includes("姓名"), 10);

  const dataRows: ReconcileRow[] = [];
  const byKey = new Map<string, ReconcileRow[]>();

  for (let i = 2; i <= ws.rowCount; i++) {
    const r = ws.getRow(i);
    const nameVal = cellVal(r.getCell(nameCol));
    if (nameVal === null || nameVal === undefined || nameVal === "") continue;
    const row: ReconcileRow = {
      sheetRow: i,
      name: String(nameVal),
      date: toMonthDay(cellVal(r.getCell(dateCol))),
      airline: String(cellVal(r.getCell(airlineCol)) ?? ""),
      trip: String(cellVal(r.getCell(tripCol)) ?? ""),
      originalAmount: String(cellVal(r.getCell(amountCol)) ?? ""),
      matchedAmount: null,
      status: "none",
    };
    dataRows.push(row);
    const key = keyOf(row.date, row.airline, row.name);
    const g = byKey.get(key) ?? [];
    g.push(row);
    byKey.set(key, g);
  }

  const usedKeys = new Set<string>();
  const extraUnmatchedRaws: string[] = [];
  for (const [key, group] of byKey) {
    const txns = linkGroups.get(key);
    if (!txns) continue;
    usedKeys.add(key);
    if (txns.length >= group.length) {
      // LinkPay 筆數較多或相等：取金額由小到大前 N 筆回填，多餘的列入待確認清單
      const sortedTxns = [...txns].sort((a, b) => a.amount - b.amount);
      const used = sortedTxns.slice(0, group.length);
      const leftover = sortedTxns.slice(group.length);
      leftover.forEach((t) => extraUnmatchedRaws.push(t.raw));

      const sortedRows = [...group]
        .map((row) => ({ row, amt: toAmount(row.originalAmount) }))
        .sort((a, b) => a.amt - b.amt)
        .map(({ row }) => row);
      sortedRows.forEach((row, idx) => {
        row.matchedAmount = used[idx].amount;
        row.status = "filled";
      });
    } else {
      for (const row of group) {
        row.status = "review";
        row.note = `LinkPay ${txns.length} 筆／業績表 ${group.length} 列，數量不符`;
      }
    }
  }

  const unmatchedLink: string[] = [...extraUnmatchedRaws];
  for (const [key, raw] of rawByKey) {
    if (!usedKeys.has(key)) unmatchedLink.push(raw);
  }

  const filledCount = dataRows.filter((r) => r.status === "filled").length;
  const reviewCount = dataRows.filter((r) => r.status === "review").length;
  const noneCount   = dataRows.filter((r) => r.status === "none").length;

  return { rows: dataRows, filledCount, reviewCount, noneCount, unmatchedLink, workbook: perfWb, sheetName, amountCol };
}

/** 把已比對金額寫回業績表金額欄，回傳可下載的 xlsx Blob（保留原始樣式）。 */
export async function writeBack(result: ReconcileResult): Promise<Blob> {
  const ws = result.workbook.getWorksheet(result.sheetName)!;
  for (const row of result.rows) {
    if (row.status !== "filled" || row.matchedAmount === null) continue;
    ws.getCell(row.sheetRow, result.amountCol).value = row.matchedAmount;
  }
  const buffer = await result.workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * 產生可貼回金額欄的單欄文字：涵蓋第一筆到最後一筆姓名列之間的每一列，
 * 已比對者填新金額、其餘保留原值，貼上時對齊第一筆姓名所在列的金額欄。
 */
export function buildAmountColumn(result: ReconcileResult): string {
  if (result.rows.length === 0) return "";
  const first = result.rows[0].sheetRow;
  const last = result.rows[result.rows.length - 1].sheetRow;
  const byRow = new Map<number, ReconcileRow>();
  for (const r of result.rows) byRow.set(r.sheetRow, r);
  const lines: string[] = [];
  for (let r = first; r <= last; r++) {
    const row = byRow.get(r);
    if (row && row.status === "filled" && row.matchedAmount !== null) {
      lines.push(String(row.matchedAmount));
    } else {
      lines.push(row ? row.originalAmount : "");
    }
  }
  return lines.join("\n") + "\n";
}
