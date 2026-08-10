import { createContext, useContext, useState, useEffect } from 'react';

const LANGUAGE_KEY = 'restaurant-language';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem(LANGUAGE_KEY) || 'en';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.setAttribute('data-lang', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'kh' : 'en'));
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    isKhmer: language === 'kh',
    isEnglish: language === 'en',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

/**
 * Helper function to get the display name based on current language.
 * Checks multiple possible key casings (Oracle vs Eloquent).
 *
 * @param {object} item - The data object
 * @param {string} enField - English field name e.g. 'category_name' or 'Category_Name'
 * @param {string} khField - Khmer field name e.g. 'NAME_KH' or 'name_kh'
 * @param {string} lang - Current language ('en' or 'kh')
 * @returns {string} The display value
 */
export const getDisplayName = (item, enField, khField, lang) => {
  if (!item) return '';

  // Try Khmer first if language is 'kh'
  if (lang === 'kh') {
    const khValue = item[khField] || item[khField?.toUpperCase()] || item[khField?.toLowerCase()];
    if (khValue) return khValue;
  }

  // Fallback to English
  const enValue = item[enField] || item[enField?.toUpperCase()] || item[enField?.toLowerCase()];
  return enValue || '';
};

/**
 * Get a field value from an object using multiple possible key casings.
 */
export const getField = (obj, ...keys) => {
  if (!obj) return '';
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return '';
};

export default LanguageContext;