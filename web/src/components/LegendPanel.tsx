'use client';

const LEGEND_ITEMS = [
  { color: '#22c55e', label: 'Quiet', range: '< 50 dB' },
  { color: '#eab308', label: 'Moderate', range: '50 – 70 dB' },
  { color: '#f97316', label: 'Loud', range: '70 – 85 dB' },
  { color: '#ef4444', label: 'Very Loud', range: '> 85 dB' },
];

export default function LegendPanel() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-[#e94560]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        Legend
      </h2>

      <div className="space-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex justify-between w-full">
              <span className="text-sm font-medium text-gray-700">
                {item.label}
              </span>
              <span className="text-xs text-gray-500">{item.range}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
