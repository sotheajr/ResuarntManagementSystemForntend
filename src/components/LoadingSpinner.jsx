const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-[5px]',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[200px] w-full bg-gradient-to-br from-amber-400 via-rose-400 to-pink-500 rounded-2xl dark:bg-gradient-to-br dark:from-amber-400 dark:via-rose-400 dark:to-pink-500">
      {/* Glow backdrop */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 bg-white/20 rounded-full blur-xl animate-pulse"></div>
        <div
          className={`${sizeClasses[size] || sizeClasses.md} border-amber-200/50 border-t-white rounded-full drop-shadow-md relative z-10`}
          style={{ animation: 'spin-gradient 0.8s linear infinite' }}
        ></div>
      </div>
      {message && (
        <p className="text-white font-medium text-sm tracking-wide animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;