import { createContext, useContext, useState, useEffect } from 'react';

const FONT_SIZE_KEY = 'restaurant-font-size';

const FONT_SIZES = {
  sm: { label: 'Small', base: '14px', class: 'font-sm' },
  md: { label: 'Medium', base: '16px', class: 'font-md' },
  lg: { label: 'Large', base: '18px', class: 'font-lg' },
  xl: { label: 'Extra Large', base: '20px', class: 'font-xl' },
};

const TABLE_DENSITIES = {
  compact: { label: 'Compact', class: 'table-compact' },
  normal: { label: 'Normal', class: 'table-normal' },
  comfortable: { label: 'Comfortable', class: 'table-comfortable' },
};

const FontSizeContext = createContext();

export const FontSizeProvider = ({ children }) => {
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem(FONT_SIZE_KEY) || 'md';
  });

  const [tableDensity, setTableDensity] = useState(() => {
    return localStorage.getItem('restaurant-table-density') || 'normal';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all font size classes
    root.classList.remove('font-sm', 'font-md', 'font-lg', 'font-xl');
    // Add the selected font size class
    root.classList.add(FONT_SIZES[fontSize]?.class || 'font-md');
    localStorage.setItem(FONT_SIZE_KEY, fontSize);

    // Apply CSS variable for base font size
    const baseSize = FONT_SIZES[fontSize]?.base || '16px';
    root.style.setProperty('--app-font-size', baseSize);
    root.style.fontSize = baseSize;
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('table-compact', 'table-normal', 'table-comfortable');
    root.classList.add(TABLE_DENSITIES[tableDensity]?.class || 'table-normal');
    localStorage.setItem('restaurant-table-density', tableDensity);
  }, [tableDensity]);

  const value = {
    fontSize,
    setFontSize,
    tableDensity,
    setTableDensity,
    fontSizes: FONT_SIZES,
    tableDensities: TABLE_DENSITIES,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

export default FontSizeContext;