import { useCallback, useRef, useState } from "react";
import { useToast } from "../hooks/useToast";
import {
  buildAmountColumn,
  readPerfWorkbook,
  readLinkWorkbook,
  reconcile,
  writeBack,
  type ReconcileResult,
  type RowStatus,
} from "../lib/reconcile";
import { downloadBlob } from "../lib/download";
import Toast from "./Toast";
import PrivacyNote from "./PrivacyNote";
import StepHeading from "./StepHeading";
import { AlertTriangleIcon } from "./icons";
import { btnAccent, btnGhost, fileInput } from "./buttonStyles";

const STATUS_CONFIG: Record<RowStatus, { label: string; style: string }> = {
  filled: { label: "已填", style: "bg-emerald-100 text-emerald-700" },
  review: { label: "需確認", style: "bg-amber-100 text-amber-700" },
  none: { label: "查無", style: "bg-slate-100 text-slate-500" },
};

/** 刷卡對帳功能頁：用業績表姓名查 LinkPay 交易金額並回填。 */
export default function ReconcileTab() {
  const [perfFile, setPerfFile] = useState<File | null>(null);
  const [linkFile, setLinkFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState("");
  const [toast, showToast] = useToast();
  const perfInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const clearAll = useCallback(() => {
    setPerfFile(null);
    setLinkFile(null);
    setResult(null);
    setError("");
    if (perfInputRef.current) perfInputRef.current.value = "";
    if (linkInputRef.current) linkInputRef.current.value = "";
  }, []);

  const run = useCallback(async () => {
    if (!perfFile || !linkFile) return;
    setError("");
    try {
      const [perfWb, linkWb] = await Promise.all([
        readPerfWorkbook(perfFile),
        readLinkWorkbook(linkFile),
      ]);
      setResult(reconcile(perfWb, linkWb));
    } catch {
      setResult(null);
      setError("讀取或解析檔案失敗，請確認上傳的是業績表與 LinkPay 訂單查詢檔。");
    }
  }, [perfFile, linkFile]);

  const copyAmounts = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildAmountColumn(result));
      showToast("已複製，到業績表第一筆姓名列的金額欄貼上");
    } catch {
      showToast("複製失敗，請改用「下載回填後 xlsx」");
    }
  }, [result, showToast]);

  const downloadXlsx = useCallback(async () => {
    if (!result) return;
    try {
      downloadBlob("業績表_已回填金額.xlsx", await writeBack(result));
    } catch {
      showToast("下載失敗，請重新對帳後再試");
    }
  }, [result, showToast]);

  const reviewRows = result?.rows.filter((r) => r.status === "review") ?? [];

  return (
    <>
      <h2 className="text-xl font-bold">刷卡對帳（LinkPay → 業績表）</h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">
        用業績表的姓名，去 LinkPay 訂單查詢檔的「付款名稱」找出對應的交易金額，回填到業績表金額欄。
      </p>

      <PrivacyNote>
        兩份檔案都只在你的瀏覽器內處理，<strong>不會上傳到任何伺服器</strong>。
      </PrivacyNote>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
        <StepHeading step={1} title="上傳兩份檔案" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-28 text-sm text-slate-500">業績表（.xlsx）</label>
            <input
              ref={perfInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setPerfFile(e.target.files?.[0] ?? null)}
              className={fileInput}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-28 text-sm text-slate-500">LinkPay 訂單（.xls／.xlsx）</label>
            <input
              ref={linkInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setLinkFile(e.target.files?.[0] ?? null)}
              className={fileInput}
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={run}
              disabled={!perfFile || !linkFile}
              className={btnAccent}
            >
              對帳
            </button>
            {(perfFile || linkFile || result) && (
              <button type="button" onClick={clearAll} className={btnGhost}>
                清除
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      {result && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <StepHeading step={2} title="結果" />
          <p className="mb-1">
            共 <b className="text-primary">{result.rows.length}</b> 列，已回填{" "}
            <b className="text-emerald-700">{result.filledCount}</b> 筆，需確認{" "}
            <b className="text-amber-700">{result.reviewCount}</b> 筆，查無{" "}
            <b className="text-slate-500">{result.noneCount}</b> 筆。
          </p>

          <div className="my-3 flex flex-wrap gap-2.5">
            <button type="button" onClick={copyAmounts} className={btnAccent}>
              複製金額欄
            </button>
            <button type="button" onClick={downloadXlsx} className={btnGhost}>
              下載回填後 xlsx
            </button>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            「複製金額欄」可無損貼回原試算表（對齊第一筆姓名列的金額欄）；下載 xlsx 會保留原始樣式與公式。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-3">姓名</th>
                  <th className="py-1.5 pr-3">日期</th>
                  <th className="py-1.5 pr-3">航空</th>
                  <th className="py-1.5 pr-3 text-right">原金額</th>
                  <th className="py-1.5 pr-3 text-right">LinkPay 金額</th>
                  <th className="py-1.5">狀態</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.sheetRow} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3">{row.date}</td>
                    <td className="py-1.5 pr-3">{row.airline}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{row.originalAmount}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {row.matchedAmount ?? ""}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CONFIG[row.status].style}`}
                      >
                        {STATUS_CONFIG[row.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reviewRows.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" />
                需確認（{reviewRows.length}）
              </p>
              <ul className="list-disc pl-5 text-amber-800">
                {reviewRows.map((row) => (
                  <li key={row.sheetRow}>
                    {row.name}（{row.date} {row.airline}）— {row.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.unmatchedLink.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-1 font-semibold text-slate-600">
                LinkPay 有付款成功、但業績表查無（{result.unmatchedLink.length}）
              </p>
              <ul className="list-disc pl-5 text-slate-500">
                {result.unmatchedLink.map((raw, i) => (
                  <li key={i}>{raw}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <Toast message={toast} />
    </>
  );
}
