# CLAUDE.md

LinkPay 刷卡對帳：純前端工具，用業績表姓名比對 LinkPay 訂單金額並回填。

所有處理都在瀏覽器內完成，**業績表與 LinkPay 資料不上傳任何伺服器**——維持這個隱私承諾。

## 技術棧

- Vite + React 19 + TypeScript
- Tailwind CSS v4（`@tailwindcss/vite`，於 `src/index.css` 以 `@import "tailwindcss"` 引入）
- ExcelJS：讀寫業績表 `.xlsx`（保留樣式）
- SheetJS（`xlsx`）：讀取 LinkPay 訂單查詢檔（支援 `.xls`）

## 常用指令

```bash
npm run dev          # 本機開發伺服器（base path：/linkpay-reconcile-web/）
npm run build        # tsc -b 型別檢查 + Vite 打包到 dist/
npm run preview      # 預覽 build 產物
```

## 架構

```
src/
├── main.tsx                  進入點
├── App.tsx                   頁首 + 刷卡對帳頁 + 浮動吉祥物（單一功能，無分頁/路由）
├── components/
│   └── ReconcileTab.tsx      上傳兩檔、預覽、回填輸出
└── lib/
    ├── parser.ts             ★ 解析核心（出發日期/航空/姓名標籤），與姊妹站 line-to-sheet-web 共用同一套規則
    ├── reconcile.ts          ★ 刷卡對帳核心（讀 Excel、比對、回填）
    └── download.ts           下載工具（downloadText / downloadBlob）
```

`AppHeader`、`FloatingMascot`、`Toast`、`PrivacyNote`、`StepHeading`、`icons.tsx`、
`buttonStyles.ts` 是與 [line-to-sheet-web](https://github.com/livehighvu06/line-to-sheet-web)
共用的通用視覺元件，維持樣式一致，不要各自改版。

## 重要約束（`src/lib/reconcile.ts`）

- **重用 `parseOrder()`**（`src/lib/parser.ts`）解析 LinkPay 的「付款名稱」（訂單描述格式同
  LINE 名單），取出括號標籤當姓名。**`parser.ts` 與姊妹站共用**，調整規則需同步確認兩邊行為
  一致（姊妹站有 `npm run test:parser` 基準測試，這裡沒有）。
- 比對鍵＝**日期＋航空＋姓名標籤**（團名有「天/日」等差異，不納入鍵）。
- LinkPay 先**依訂單號去重**（避免重複列金額翻倍）、只取**付款成功**。
- 業績表一列一筆刷卡；同鍵多筆（分次刷卡）依金額排序對應同鍵多列**各自回填、不加總**。
  LinkPay 筆數**多於**業績表列數時取金額較小的前 N 筆回填、多餘者列入查無業績表清單；
  LinkPay 筆數**少於**業績表列數則列入需確認、不自動回填。
- 欄位以**標題文字偵測**（業績表找「姓名」「金額」「航空」「出發」；LinkPay 找「付款名稱」
  「交易金額」「付款狀態」「訂單號碼」），找不到才退回硬編欄位 index。
- 輸出：`writeBack()` 產回填後 xlsx（社群版可能不保留樣式/公式）、`buildAmountColumn()`
  產可無損貼回的金額欄。

## 部署

推送到 `main` 觸發 `.github/workflows/deploy.yml`，自動 build 並發佈到 GitHub Pages。
`vite.config.ts` 的 `base: '/linkpay-reconcile-web/'` 須與 repo 名稱一致。
