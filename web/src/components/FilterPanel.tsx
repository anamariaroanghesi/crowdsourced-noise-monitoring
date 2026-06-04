'use client';

import { useState } from 'react';

interface Filters {
  time_window: string;
  min_db?: number;
  max_db?: number;
}

interface Props {
  onFilterChange: (filters: Filters) => void;
}

const TIME_WINDOWS = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
];

export default function FilterPanel({ onFilterChange }: Props) {
  const [timeWindow, setTimeWindow] = useState('7d');
  const [minDb, setMinDb] = useState<string>('');
  const [maxDb, setMaxDb] = useState<string>('');

  function handleApply() {
    const filters: Filters = { time_window: timeWindow };
    const min = parseFloat(minDb);
    const max = parseFloat(maxDb);
    if (!isNaN(min) && min >= 20) filters.min_db = min;
    if (!isNaN(max) && max <= 130) filters.max_db = max;
    onFilterChange(filters);
  }

  function handleReset() {
    setTimeWindow('7d');
    setMinDb('');
    setMaxDb('');
    onFilterChange({ time_window: '7d' });
  }

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
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.828V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-3.172a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z"
          />
        </svg>
        Filters
      </h2>

      <div className="space-y-4">
        {/* Time window */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Time window
          </label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] focus:border-transparent text-gray-800 bg-white"
          >
            {TIME_WINDOWS.map((tw) => (
              <option key={tw.value} value={tw.value}>
                {tw.label}
              </option>
            ))}
          </select>
        </div>

        {/* dB range */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            dB range (20 – 130)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={20}
              max={130}
              placeholder="Min"
              value={minDb}
              onChange={(e) => setMinDb(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] focus:border-transparent text-gray-800 placeholder-gray-400"
            />
            <span className="text-gray-400 flex-shrink-0">–</span>
            <input
              type="number"
              min={20}
              max={130}
              placeholder="Max"
              value={maxDb}
              onChange={(e) => setMaxDb(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560] focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleApply}
            className="flex-1 py-2 text-sm bg-[#e94560] hover:bg-[#c73652] text-white font-semibold rounded-lg transition"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="flex-1 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
