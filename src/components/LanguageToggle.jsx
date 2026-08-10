import { useLanguage } from '../context/LanguageContext';

const LanguageToggle = () => {
  const { language, toggleLanguage, isKhmer, isEnglish } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="relative w-[88px] h-[36px] sm:w-[120px] sm:h-[44px] rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-1 group select-none flex-shrink-0"
      title={isEnglish ? 'Switch to Khmer' : 'ប្តូរទៅភាសាអង់គ្លេស'}
      aria-label={isEnglish ? 'Switch language to Khmer' : 'ប្តូរភាសាទៅជាអង់គ្លេស'}
      role="switch"
      aria-checked={isKhmer}
    >
      {/* Track background — dark mode friendly gradient */}
      <div className={`
        absolute inset-0 rounded-full transition-all duration-500 ease-in-out overflow-hidden
        ${isKhmer
          ? 'bg-gradient-to-r from-blue-700 via-red-600 to-blue-700'
          : 'bg-gradient-to-r from-blue-600 via-white to-red-500'
        }
        shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_-1px_2px_rgba(255,255,255,0.1)]
      `}>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.12),transparent_70%)]" />
      </div>

      {/* Left side — English label */}
      <div className={`
        absolute left-0 top-0 w-[44px] sm:w-[60px] h-full flex items-center justify-center gap-1.5
        transition-all duration-300 z-10
      `}>
        <span className="text-[10px] sm:text-xs font-black tracking-wider leading-none drop-shadow-sm"
          style={{ color: isKhmer ? 'rgba(255,255,255,0.5)' : '#fff' }}>
          EN
        </span>
      </div>

      {/* Right side — Khmer label */}
      <div className={`
        absolute right-0 top-0 w-[44px] sm:w-[60px] h-full flex items-center justify-center gap-1.5
        transition-all duration-300 z-10
      `}>
        <span className="text-[10px] sm:text-xs font-black tracking-wider leading-none drop-shadow-sm"
          style={{ color: isKhmer ? '#fff' : 'rgba(0,0,0,0.5)' }}>
          KH
        </span>
      </div>

      {/* Slider handle — contains flag of active language */}
      <div className={`
        absolute top-[3px] sm:top-[4px] w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] rounded-full
        transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        flex items-center justify-center
        shadow-[0_2px_8px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.25)]
        ${isKhmer ? 'left-[55px] sm:left-[80px]' : 'left-[3px] sm:left-[4px]'}
      `}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-50 dark:to-gray-200" />
        <div className="absolute inset-[2px] rounded-full bg-gradient-to-b from-white/90 to-transparent opacity-60" />
        {/* Flag icon inside the handle */}
        <span className="relative z-10 text-sm sm:text-base leading-none drop-shadow-sm">
          {isKhmer ? '🇰🇭' : '🇬🇧'}
        </span>
      </div>
    </button>
  );
};

export default LanguageToggle;