import React, { useRef } from 'react';
import { Download, Printer, ArrowLeft, Award } from 'lucide-react';
import { UserProgress } from '../types';

interface CertificateViewProps {
  certificate: {
    courseId: string;
    courseTitle: string;
    issuedAt: string;
    expiresAt: string;
  };
  employeeInfo: UserProgress['employeeInfo'];
  onClose: () => void;
}

export function CertificateView({ certificate, employeeInfo, onClose }: CertificateViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const formattedIssue = new Date(certificate.issuedAt).toLocaleDateString('uk-UA');
  const formattedExpire = new Date(certificate.expiresAt).toLocaleDateString('uk-UA');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl relative print:shadow-none print:w-[297mm] print:h-[210mm] print:landscape overflow-hidden">
        
        {/* Controls - Hidden when printing */}
        <div className="absolute top-4 right-4 flex gap-2 print:hidden z-10">
          <button onClick={handlePrint} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="Роздрукувати">
            <Printer className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition" title="Закрити">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Content */}
        <div className="p-12 sm:p-24 relative bg-slate-50 min-h-[600px] flex flex-col justify-center items-center border-[16px] border-double border-slate-300 m-4 rounded-xl print:m-0 print:min-h-full print:border-[20px]">
          
          <div className="absolute top-12 left-12 opacity-10">
            <Award className="w-64 h-64 text-blue-600" />
          </div>
          <div className="absolute bottom-12 right-12 opacity-10">
            <Award className="w-64 h-64 text-blue-600" />
          </div>

          <div className="text-center relative z-10 space-y-6 max-w-2xl">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Award className="w-12 h-12 text-white" />
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 uppercase tracking-widest">Сертифікат</h1>
            <p className="text-xl text-slate-500 uppercase tracking-widest font-semibold mt-2">успішного завершення</p>

            <div className="my-12">
              <p className="text-lg text-slate-600 mb-2">Цим сертифікатом підтверджується, що</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-blue-600 border-b-2 border-slate-200 pb-4 inline-block px-12">
                {employeeInfo.fullName || 'Співробітник'}
              </h2>
              <p className="text-md text-slate-500 mt-2">{employeeInfo.position} ({employeeInfo.department})</p>
            </div>

            <div className="my-8">
              <p className="text-lg text-slate-600 mb-2">успішно пройшов(ла) корпоративний курс та склав(ла) тестування:</p>
              <h3 className="text-2xl font-bold text-slate-800">«{certificate.courseTitle}»</h3>
            </div>

            <div className="flex justify-between items-end mt-16 pt-8 border-t border-slate-200 w-full px-8 text-left">
              <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider font-bold mb-1">Дата видачі</p>
                <p className="font-semibold text-slate-900">{formattedIssue}</p>
                <p className="text-sm text-rose-500 mt-1 font-medium">Дійсний до: {formattedExpire}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-bold mb-1">Підпис керівника</p>
                <div className="w-48 h-8 border-b border-slate-400 mt-4"></div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
