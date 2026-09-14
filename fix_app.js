import fs from 'fs';
let file = fs.readFileSync('src/App.tsx', 'utf8');

const oldHandleRecordScore = `  const handleRecordScore = (score: number, total: number, modeName: string, department?: string, courseId?: string, sectionId?: string) => {
    const percentage = Math.round((score / total) * 100);
    const scoreRec = {
      score,
      total,
      percentage,
      mode: modeName,
      department,
      courseId,
      sectionId,
      date: new Date().toISOString()
    };
    
    saveProgressToDb(undefined, scoreRec);

    setProgress((prev) => ({
      ...prev,
      quizCompleted: true,
      bestScore: Math.max(prev.bestScore || 0, percentage),
      totalQuestionsAnswered: (prev.totalQuestionsAnswered || 0) + total,
      quizHistory: [
        {
          date: new Date().toLocaleDateString('uk-UA'),
          score,
          total,
          mode: modeName,
          percentage,
          department,
          courseId,
          sectionId,
        },
        ...prev.quizHistory,
      ],
    }));
  };`;

const newHandleRecordScore = `  const handleRecordScore = (score: number, total: number, modeName: string, department?: string, courseId?: string, sectionId?: string) => {
    const percentage = Math.round((score / total) * 100);
    const scoreRec = {
      score,
      total,
      percentage,
      mode: modeName,
      department,
      courseId,
      sectionId,
      date: new Date().toISOString()
    };
    
    saveProgressToDb(undefined, scoreRec);

    setProgress((prev) => {
      let updatedCertificates = [...(prev.certificates || [])];
      
      // If passed course that has a certificate, add to local state immediately
      if (percentage >= 80 && courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course && course.hasCertificate) {
          const validityYears = course.certificateValidityYears || 1;
          const issuedAt = new Date();
          const expiresAt = new Date();
          expiresAt.setFullYear(issuedAt.getFullYear() + validityYears);
          
          const existingIndex = updatedCertificates.findIndex(c => c.courseId === course.id);
          if (existingIndex >= 0) {
            updatedCertificates[existingIndex] = { ...updatedCertificates[existingIndex], issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
          } else {
            updatedCertificates.push({
              courseId: course.id,
              courseTitle: course.title,
              issuedAt: issuedAt.toISOString(),
              expiresAt: expiresAt.toISOString()
            });
          }
        }
      }

      return {
        ...prev,
        quizCompleted: true,
        bestScore: Math.max(prev.bestScore || 0, percentage),
        totalQuestionsAnswered: (prev.totalQuestionsAnswered || 0) + total,
        certificates: updatedCertificates,
        quizHistory: [
          {
            date: new Date().toLocaleDateString('uk-UA'),
            score,
            total,
            mode: modeName,
            percentage,
            department,
            courseId,
            sectionId,
          },
          ...prev.quizHistory,
        ],
      };
    });
  };`;

file = file.replace(oldHandleRecordScore, newHandleRecordScore);
fs.writeFileSync('src/App.tsx', file);
