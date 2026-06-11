/** Tiny dependency-free area chart for the ROI portfolio series. */
export function Sparkline({
  values,
  positive,
  className = "",
}: {
  values: number[];
  positive: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;

  const W = 600;
  const H = 140;
  const PAD = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M${pts[0][0]},${H} L${line.replace(/ /g, " L")} L${pts[pts.length - 1][0]},${H} Z`;
  const stroke = positive ? "#1F7A33" : "#C03538";
  const fill = positive ? "rgba(46,158,68,0.16)" : "rgba(229,72,77,0.14)";
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="Portfolio value over time"
      preserveAspectRatio="none"
    >
      <path d={area} fill={fill} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="5" fill={stroke} stroke="#FFFCF2" strokeWidth="2" />
    </svg>
  );
}
