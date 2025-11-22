'use client';

interface ErrorMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  showIcon?: boolean;
}

export default function ErrorMessage({ 
  message, 
  type = 'error', 
  className = "",
  showIcon = true 
}: ErrorMessageProps) {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeClasses = () => {
    switch (type) {
      case 'error':
        return 'form-error-message';
      case 'warning':
        return 'text-xs text-yellow-600 mt-1 flex items-center gap-1';
      case 'info':
        return 'text-xs text-blue-600 mt-1 flex items-center gap-1';
      default:
        return 'form-error-message';
    }
  };

  return (
    <div className={`${getTypeClasses()} ${className}`}>
      {showIcon && getIcon()}
      <span>{message}</span>
    </div>
  );
}













