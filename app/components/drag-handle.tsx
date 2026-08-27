export function DragHandle() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 1, 2, 3, 4, 5].map((dot) => (
        <circle
          key={dot}
          cx={dot % 2 === 0 ? 3 : 9}
          cy={2 + Math.floor(dot / 2) * 6}
          r="1.4"
          fill="#8c9196"
        />
      ))}
    </svg>
  );
}
