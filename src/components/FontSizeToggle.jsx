import { useState, useRef, useEffect } from 'react';
import { Type, ChevronDown } from 'lucide-react';
import { useFontSize } from '../context/FontSizeContext';

const FontSizeToggle = () => {
  const { fontSize, setFontSize, tableDensity, setTableDensity, fontSizes, tableDensities } = useFontSize();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0"
        title="Font Size & Table Density"
        aria-label="Font size settings"
      >
        <Type className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-3 z-50 animate-in origin-top-right">
          <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Font Size</p>
          </div>
          <div className="px-3 py-2 space-y-1">
            {Object.entries(fontSizes).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => { setFontSize(key); setOpen(false); }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  fontSize === key
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span>{label}</span>
                {fontSize === key && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Table Density</p>
          </div>
          <div className="px-3 pb-2 space-y-1">
            {Object.entries(tableDensities).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => { setTableDensity(key); setOpen(false); }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  tableDensity === key
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span>{label}</span>
                {tableDensity === key && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FontSizeToggle;