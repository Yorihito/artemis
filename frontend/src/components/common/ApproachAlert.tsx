"use client";

interface Props {
  approachType: "moon" | "earth";
  onSelectInterval: (ms: number) => void;
  onDismiss: () => void;
}

const OPTIONS = [
  { label: "30s", value: 30_000 },
  { label: "10s", value: 10_000 },
  { label: "5s",  value: 5_000 },
];

export function ApproachAlert({ approachType, onSelectInterval, onDismiss }: Props) {
  const target = approachType === "moon" ? "Moon" : "Earth";
  const emoji = approachType === "moon" ? "🌙" : "🌍";

  return (
    <div className="bg-orange-950 border border-orange-700 text-orange-200 px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-orange-300">
          Approaching {target}!
        </div>
        <div className="text-sm text-orange-400">
          Consider increasing the polling frequency
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              onSelectInterval(opt.value);
              onDismiss();
            }}
            className="text-xs bg-orange-800 hover:bg-orange-700 text-orange-100 px-3 py-1.5 rounded font-mono transition"
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={onDismiss}
          className="text-xs text-orange-500 hover:text-orange-300 px-2"
        >
          Later
        </button>
      </div>
    </div>
  );
}
