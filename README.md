# LinkPay 刷卡對帳（React 版）

用業績表的姓名，比對 LinkPay 訂單查詢檔的交易金額，自動回填業績表金額欄。
**純前端**，所有處理都在瀏覽器內完成，業績表與 LinkPay 資料不會上傳到任何伺服器。

線上版：**https://livehighvu06.github.io/linkpay-reconcile-web/**

## 技術棧

- Vite + React 19 + TypeScript
- Tailwind CSS v4（`@tailwindcss/vite`）
- ExcelJS：讀寫業績表 `.xlsx`（保留原始樣式）
- SheetJS（`xlsx`）：讀取 LinkPay 訂單查詢檔（`.xls`／`.xlsx`）

## 開發

```bash
npm install
npm run dev            # 本機開發伺服器
npm run build           # 型別檢查 + 打包到 dist/
npm run preview         # 預覽 build 產物
```

## 專案結構

```
src/
├── main.tsx              React 進入點
├── App.tsx                頁首 + 刷卡對帳頁 + 浮動吉祥物
├── index.css              @import "tailwindcss"
├── lib/
│   ├── parser.ts          解析 LinkPay「付款名稱」訂單描述（日期/航空/姓名標籤），與 LINE 名單轉表格站共用同一套規則
│   ├── reconcile.ts       ★ 刷卡對帳核心（讀 Excel、比對、回填）
│   └── download.ts        下載工具
└── components/            AppHeader、FloatingMascot、Toast、PrivacyNote、StepHeading、icons、buttonStyles、ReconcileTab
```

## 使用方式

1. 上傳業績表（`.xlsx`）與 LinkPay 訂單查詢檔（`.xls`／`.xlsx`）。
2. 按「對帳」，畫面列出每一列的比對結果與狀態（已填／需確認／查無）。
3. 「複製金額欄」可無損貼回原業績表（對齊第一筆姓名列的金額欄）；
   或「下載回填後 xlsx」取得已回填、保留原始樣式的檔案。

## 比對規則摘要

- **重用 `parseOrder()`** 解析 LinkPay 的「付款名稱」（訂單描述格式同 LINE 名單），取出括號標籤當姓名。
- 比對鍵＝**日期＋航空＋姓名標籤**（團名有「天/日」等差異，不納入鍵）。
- LinkPay 先**依訂單號去重**（避免重複列金額翻倍）、只取**付款成功**。
- 業績表一列一筆刷卡；同鍵多筆（分次刷卡）依金額排序對應同鍵多列**各自回填、不加總**。
  LinkPay 筆數**多於**業績表列數時取金額較小的前 N 筆回填、多餘者列入查無業績表清單；
  LinkPay 筆數**少於**業績表列數則列入需確認、不自動回填。
- 欄位以**標題文字偵測**（業績表找「姓名」「金額」「航空」「出發」；LinkPay 找「付款名稱」
  「交易金額」「付款狀態」「訂單號碼」），找不到才退回硬編欄位 index。

## 部署（GitHub Actions → Pages）

推送到 `main` 會觸發 `.github/workflows/deploy.yml`：自動 `npm ci`、`npm run build`，
再把 `dist/` 發佈到 GitHub Pages。Pages 來源需設為 **GitHub Actions**。

`vite.config.ts` 的 `base: '/linkpay-reconcile-web/'` 對應 repo 名稱，請與儲存庫名稱一致。

## 注意事項

- `src/lib/parser.ts` 與姊妹站 [line-to-sheet-web](https://github.com/livehighvu06/line-to-sheet-web)
  的解析核心相同，調整規則時請同步確認兩邊行為一致。
