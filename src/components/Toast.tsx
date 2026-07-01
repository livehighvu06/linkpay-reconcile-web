interface Props {
  message: string;
}

/** 畫面底部的短暫提示。message 為空字串時隱藏。 */
export default function Toast({ message }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white transition-opacity duration-200 ${
        message ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
