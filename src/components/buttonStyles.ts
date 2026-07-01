/* 共用按鈕樣式：統一過場（150ms）、按壓回饋（active scale）與 focus ring。
   - accent：最關鍵 CTA（整理、對帳、複製待貼上表格、複製金額欄），橘色。
   - primary：主要動作，天空藍實心。
   - ghost：次要動作（下載、清除），藍框白底。 */

const base =
  "inline-flex items-center justify-center gap-1.5 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-[colors,transform] duration-150 active:scale-[.98] focus:ring-2 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btnAccent = `${base} bg-accent text-white hover:bg-accent-hover`;

export const btnPrimary = `${base} bg-primary text-white hover:bg-primary-hover`;

export const btnGhost = `${base} border border-primary bg-white text-primary hover:bg-sky-50`;

/* 原生 file input 樣式（非按鈕，但風格對齊）。 */
export const fileInput =
  "cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm transition-colors file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 hover:file:bg-slate-200 focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none";
