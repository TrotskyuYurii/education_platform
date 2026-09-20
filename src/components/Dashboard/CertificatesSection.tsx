import React from 'react';
import { Award, AlertTriangle, FileCheck, Trash2 } from 'lucide-react';

interface CertificateItem {
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  expiresAt: string;
}

interface CertificatesSectionProps {
  certificates: CertificateItem[];
  selectedUserId: string | null;
  isAdmin: boolean;
  onViewCertificate: (cert: CertificateItem) => void;
  onDeleteCertificate: (courseId: string) => void;
}

/**
 * Працює в парі зі стабілізованими через useCallback обробниками в Dashboard:
 * без них memo не спрацював би, бо кожен рендер створював би нові функції.
 */
export const CertificatesSection = React.memo<CertificatesSectionProps>(({
  certificates,
  selectedUserId,
  isAdmin,
  onViewCertificate,
  onDeleteCertificate,
}) => {
  const now = new Date();
  const warningDays = 30;

  if (certificates.length === 0) {
    if (selectedUserId) {
      return (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <Award className="w-4 h-4 text-slate-400" />
            Співробітник ще не має виданих сертифікатів (необхідно пройти курс на 80%+ балів).
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Award className="w-6 h-6 text-purple-600" /> 
        {selectedUserId ? `Сертифікати користувача (${certificates.length})` : 'Ваші сертифікати'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificates.map((cert, idx) => {
          const expDate = new Date(cert.expiresAt);
          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          const isWarning = daysLeft <= warningDays && daysLeft > 0;
          const isExpired = daysLeft <= 0;

          return (
            <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800 pr-4">{cert.courseTitle}</h4>
                {isExpired ? (
                  <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg shrink-0" title="Прострочено">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                ) : isWarning ? (
                  <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0" title={`Спливає через ${daysLeft} дн.`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                )}
              </div>
              
              <div className="text-sm text-slate-500 space-y-1 mb-4">
                <p>Отримано: {new Date(cert.issuedAt).toLocaleDateString('uk-UA')}</p>
                <p className={isExpired ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-600 font-bold' : ''}>
                  Дійсний до: {expDate.toLocaleDateString('uk-UA')}
                </p>
              </div>

              {isExpired || isWarning ? (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 mb-4">
                  {isExpired ? 'Сертифікат недійсний.' : 'Термін дії сертифіката скоро спливає.'}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button 
                  onClick={() => onViewCertificate(cert)}
                  className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Переглянути сертифікат
                </button>
                {isAdmin && selectedUserId && (
                  <button
                    onClick={() => onDeleteCertificate(cert.courseId)}
                    className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-100 transition"
                    title="Анулювати сертифікат"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
});
CertificatesSection.displayName = 'CertificatesSection';
