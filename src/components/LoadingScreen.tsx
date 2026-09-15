import React from 'react';
import { BookOpen } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Завантаження...' }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
        <div className="absolute inset-2 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 tracking-tight">ТОВ «ВІАТЕК»</h2>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-0.5">Навчальний портал</p>

      <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-500">
        <span>{message}</span>
        <span className="flex items-end gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  );
};
