import React, { useRef } from 'react';
import { Download, Printer, ArrowLeft, Award, FileDown, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
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
  onDelete?: () => void;
}

export function CertificateView({ certificate, employeeInfo, onClose, onDelete }: CertificateViewProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = () => {
    if (!certificateRef.current) return;
    const element = certificateRef.current;
    const opt = {
      margin:       0,
      filename:     `Certificate_${certificate.courseTitle}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedIssue = new Date(certificate.issuedAt).toLocaleDateString('uk-UA');
  const formattedExpire = new Date(certificate.expiresAt).toLocaleDateString('uk-UA');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 print:p-0 print:bg-white overflow-y-auto flex items-start justify-center md:items-center">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl relative print:shadow-none print:w-[297mm] print:h-[210mm] print:landscape overflow-y-auto shrink-0">
        
        {/* Controls - Hidden when printing */}
        <div className="sticky top-0 right-0 p-4 flex flex-wrap justify-end gap-2 print:hidden z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
          {onDelete && (
            <button 
              onClick={onDelete} 
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition flex items-center gap-1.5 text-sm font-bold mr-auto sm:mr-2" 
              title="Анулювати сертифікат"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Анулювати сертифікат</span>
            </button>
          )}
          <button onClick={handleDownloadPdf} className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition flex items-center gap-1 text-sm font-bold" title="Завантажити PDF">
            <FileDown className="w-4 h-4" />
            <span>Завантажити PDF</span>
          </button>
          <button onClick={handlePrint} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="Роздрукувати">
            <Printer className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition" title="Закрити">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Content */}
        <div ref={certificateRef} className="p-12 sm:p-24 relative bg-slate-50 min-h-[600px] flex flex-col justify-center items-center border-[16px] border-double border-slate-300 m-4 shrink-0 rounded-xl print:m-0 print:min-h-full print:border-[20px]">
          
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
