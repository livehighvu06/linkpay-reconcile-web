import type { ReactNode } from "react";
import { LockIcon } from "./icons";

interface Props {
  children: ReactNode;
}

/** 隱私提示橫幅：鎖頭圖示 + 文案（兩個功能頁共用）。 */
export default function PrivacyNote({ children }: Props) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
      <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </p>
  );
}
