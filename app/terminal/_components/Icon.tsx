export function TokenIcon({ symbol, color }: { symbol: string; color: string }) {
  const letter = symbol[0];
  return (
    <div
      className={`${color} h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
    >
      {letter}
    </div>
  );
}
