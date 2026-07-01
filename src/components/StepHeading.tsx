interface Props {
  step: number;
  title: string;
}

/** 卡片內步驟標題：圓形數字徽章 + 標題。 */
export default function StepHeading({ step, title }: Props) {
  return (
    <h3 className="mb-3 flex items-center gap-2.5 text-base font-semibold text-slate-800">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white tabular-nums">
        {step}
      </span>
      {title}
    </h3>
  );
}
