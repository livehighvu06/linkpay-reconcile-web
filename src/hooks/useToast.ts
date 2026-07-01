import { useCallback, useRef, useState } from "react";

export function useToast(duration = 1600) {
  const [toast, setToast] = useState("");
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = window.setTimeout(() => {
      setToast("");
      timerRef.current = null;
    }, duration);
  }, [duration]);

  return [toast, showToast] as const;
}
