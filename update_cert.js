import fs from 'fs';

let file = fs.readFileSync('src/components/CertificateView.tsx', 'utf8');

// Add import for html2pdf
file = file.replace(
  "import { Download, Printer, ArrowLeft, Award } from 'lucide-react';",
  "import { Download, Printer, ArrowLeft, Award, FileDown } from 'lucide-react';\nimport html2pdf from 'html2pdf.js';"
);

// Add handleDownload method
file = file.replace(
  "  const handlePrint = () => {",
  `  const certificateRef = useRef<HTMLDivElement>(null);\n\n  const handleDownloadPdf = () => {\n    if (!certificateRef.current) return;\n    const element = certificateRef.current;\n    const opt = {\n      margin:       0,\n      filename:     \`Certificate_\${certificate.courseTitle}.pdf\`,\n      image:        { type: 'jpeg', quality: 0.98 },\n      html2canvas:  { scale: 2 },\n      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }\n    };\n    html2pdf().set(opt).from(element).save();\n  };\n\n  const handlePrint = () => {`
);

// Fix the layout and add the PDF download button
file = file.replace(
  '<div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto">',
  '<div className="fixed inset-0 z-50 bg-slate-900/50 p-4 print:p-0 print:bg-white overflow-y-auto flex items-start justify-center md:items-center">'
);

file = file.replace(
  '<div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl relative print:shadow-none print:w-[297mm] print:h-[210mm] print:landscape overflow-hidden">',
  '<div className="bg-white rounded-2xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl relative print:shadow-none print:w-[297mm] print:h-[210mm] print:landscape overflow-y-auto shrink-0">'
);

file = file.replace(
  '        {/* Controls - Hidden when printing */}\n        <div className="absolute top-4 right-4 flex gap-2 print:hidden z-10">',
  `        {/* Controls - Hidden when printing */}\n        <div className="sticky top-0 right-0 p-4 flex justify-end gap-2 print:hidden z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">\n          <button onClick={handleDownloadPdf} className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition flex items-center gap-1 text-sm font-bold" title="Завантажити PDF">\n            <FileDown className="w-4 h-4" />\n            <span>Завантажити PDF</span>\n          </button>`
);

file = file.replace(
  '        {/* Certificate Content */}\n        <div className="p-12 sm:p-24 relative bg-slate-50 min-h-[600px] flex flex-col justify-center items-center border-[16px] border-double border-slate-300 m-4 rounded-xl print:m-0 print:min-h-full print:border-[20px]">',
  `        {/* Certificate Content */}\n        <div ref={certificateRef} className="p-12 sm:p-24 relative bg-slate-50 min-h-[600px] flex flex-col justify-center items-center border-[16px] border-double border-slate-300 m-4 shrink-0 rounded-xl print:m-0 print:min-h-full print:border-[20px]">`
);

fs.writeFileSync('src/components/CertificateView.tsx', file);
