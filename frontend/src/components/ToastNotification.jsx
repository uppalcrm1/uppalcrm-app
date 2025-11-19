import { useState, useEffect } from 'react';
import { X, MessageSquare, Phone, CheckCircle, AlertCircle, Info } from 'lucide-react';

const icons = {
  sms: MessageSquare,
  call: Phone,
  success: CheckCircle,
  error: AlertCircle,
  info: Info
};

const colors = {
  sms: 'bg-blue-50 border-blue-200 text-blue-800',
  call: 'bg-purple-50 border-purple-200 text-purple-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-gray-50 border-gray-200 text-gray-800'
};

const iconColors = {
  sms: 'text-blue-500',
  call: 'text-purple-500',
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-gray-500'
};

export function Toast({ id, type = 'info', title, message, onDismiss, onClick, duration = 5000 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);

    // Auto dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(id);
    }, 300);
  };

  const Icon = icons[type] || icons.info;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        max-w-sm w-full ${colors[type]} border rounded-lg shadow-lg pointer-events-auto
        ${onClick ? 'cursor-pointer hover:shadow-xl' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${iconColors[type]}`} />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            {message && (
              <p className="mt-1 text-sm opacity-80 truncate">{message}</p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
