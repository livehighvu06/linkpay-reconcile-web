import { useState } from "react";
import mascot from "../assets/back-to-top.png";

/** 右下角常駐浮動吉祥物：節拍器式擺動，點擊彈跳一次。 */
export default function FloatingMascot() {
  const [bouncing, setBouncing] = useState(false);

  return (
    // 滿版裁切層：吉祥物擺到極角時超出畫面的部分會被裁掉，避免產生水平捲動。
    // pointer-events-none 讓點擊穿透，只有按鈕本身可互動。
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* 與 main 同寬（max-w-3xl + px-4）的置中欄：把吉祥物定位在內容欄右下角，
          而非螢幕邊緣，寬螢幕上才會緊貼內容區。 */}
      <div className="relative mx-auto h-full max-w-3xl px-4">
        <button
          type="button"
          aria-label="馬上飛吉祥物（點我會彈跳）"
          onClick={() => setBouncing(true)}
          onAnimationEnd={() => setBouncing(false)}
          className={`pointer-events-auto absolute right-4 bottom-6 cursor-pointer rounded-2xl focus:ring-2 focus:ring-ring focus:outline-none ${
            bouncing ? "mascot-bounce" : ""
          }`}
        >
          {/* 內層負責擺動（支點在底部），與外層的彈跳 transform 不衝突 */}
          <span className="mascot-swing block">
            <img
              src={mascot}
              alt=""
              width={96}
              height={121}
              draggable={false}
              className="h-auto w-24 select-none drop-shadow-md"
            />
          </span>
        </button>
      </div>
    </div>
  );
}
