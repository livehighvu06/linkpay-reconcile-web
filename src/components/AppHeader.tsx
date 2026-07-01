import { PaperPlaneIcon } from "./icons";

/** 全站品牌頁首：紙飛機標記 + 標題 + 一句說明。 */
export default function AppHeader() {
  return (
    <header className="border-b border-sky-100 bg-gradient-to-b from-sky-100 to-background">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <PaperPlaneIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">馬上飛工具箱</h1>
        </div>
      </div>
    </header>
  );
}
