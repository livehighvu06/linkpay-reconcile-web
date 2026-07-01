/** 以 Blob 觸發瀏覽器下載。 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 以純文字內容觸發瀏覽器下載。 */
export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
}
