const state = {
  file: null,
  fileText: '',
  quiz: null,
  currentQuestion: 0,
  answers: [],
  reviewed: false,
};

const DOM = {
  uploadZone: document.getElementById('uploadZone'),
  fileInput: document.getElementById('fileInput'),
  generateBtn: document.getElementById('generateBtn'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  fileSize: document.getElementById('fileSize'),
  removeFileBtn: document.getElementById('removeFileBtn'),
  numQuestions: document.getElementById('numQuestions'),
  difficulty: document.getElementById('difficulty'),
  language: document.getElementById('language'),

  uploadSection: document.getElementById('uploadSection'),
  loadingSection: document.getElementById('loadingSection'),
  quizSection: document.getElementById('quizSection'),
  resultsSection: document.getElementById('resultsSection'),

  quizTitle: document.getElementById('quizTitle'),
  currentQuestion: document.getElementById('currentQuestion'),
  totalQuestions: document.getElementById('totalQuestions'),
  quizProgressFill: document.getElementById('quizProgressFill'),
  questionsContainer: document.getElementById('questionsContainer'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  submitBtn: document.getElementById('submitBtn'),

  scoreNumber: document.getElementById('scoreNumber'),
  scoreCircle: document.getElementById('scoreCircle'),
  scoreMessage: document.getElementById('scoreMessage'),
  scoreDetails: document.getElementById('scoreDetails'),
  reviewBtn: document.getElementById('reviewBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  newQuizBtn: document.getElementById('newQuizBtn'),
  reviewSection: document.getElementById('reviewSection'),
  reviewContainer: document.getElementById('reviewContainer'),
};

const LABELS_AR = ['أ', 'ب', 'ج', 'د'];
const LABELS_EN = ['A', 'B', 'C', 'D'];

// File upload handling
DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());

DOM.uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.add('drag-over');
});

DOM.uploadZone.addEventListener('dragleave', () => {
  DOM.uploadZone.classList.remove('drag-over');
});

DOM.uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

DOM.fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

DOM.removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resetFile();
});

function handleFile(file) {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('حجم الملف كبير جدًا. الحد الأقصى 10MB');
    return;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'txt'].includes(ext)) {
    alert('يرجى رفع ملف PDF أو TXT فقط');
    return;
  }

  state.file = file;
  DOM.fileName.textContent = file.name;
  DOM.fileSize.textContent = formatSize(file.size);
  DOM.fileInfo.hidden = false;
  DOM.generateBtn.disabled = false;
}

function resetFile() {
  state.file = null;
  state.fileText = '';
  DOM.fileInfo.hidden = true;
  DOM.generateBtn.disabled = true;
  DOM.fileInput.value = '';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Extract text from file
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return await file.text();
  }

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      text += pageText + '\n\n';
    }

    return text.trim();
  }

  throw new Error('Unsupported file format');
}

// Generate quiz
DOM.generateBtn.addEventListener('click', async () => {
  if (!state.file) return;

  DOM.uploadSection.hidden = true;
  DOM.loadingSection.hidden = false;

  try {
    state.fileText = await extractText(state.file);

    if (!state.fileText || state.fileText.length < 20) {
      alert('لم يتم العثور على نص كافٍ في الملف. تأكد من أن الملف يحتوي على محتوى نصي.');
      throw new Error('Insufficient text content');
    }

    const numQuestions = parseInt(DOM.numQuestions.value);
    const difficulty = DOM.difficulty.value;
    const language = DOM.language.value;

    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: state.fileText.substring(0, 30000),
        numQuestions,
        difficulty,
        language,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate quiz');
    }

    state.quiz = await response.json();
    state.answers = new Array(state.quiz.questions.length).fill(null);
    state.currentQuestion = 0;

    DOM.loadingSection.hidden = true;
    const isEnglish = DOM.language.value === 'english';
    DOM.quizSection.classList.toggle('dir-ltr', isEnglish);
    renderQuiz(isEnglish);
    DOM.quizSection.hidden = false;
  } catch (error) {
    DOM.loadingSection.hidden = true;
    DOM.uploadSection.hidden = false;
    alert('حدث خطأ: ' + error.message);
  }
});

// Render Quiz
function renderQuiz(isEnglish) {
  const questions = state.quiz.questions;
  window._labels = isEnglish ? LABELS_EN : LABELS_AR;
  DOM.quizTitle.textContent = state.quiz.title || 'الامتحان';
  DOM.totalQuestions.textContent = questions.length;
  DOM.submitBtn.hidden = true;

  showQuestion(0);
}

function showQuestion(index) {
  const questions = state.quiz.questions;
  state.currentQuestion = index;

  DOM.currentQuestion.textContent = index + 1;
  DOM.quizProgressFill.style.width = `${((index + 1) / questions.length) * 100}%`;

  DOM.prevBtn.hidden = index === 0;
  DOM.nextBtn.hidden = index === questions.length - 1;
  DOM.submitBtn.hidden = index !== questions.length - 1;

  const q = questions[index];
  const answered = state.answers[index] !== null && state.answers[index] !== undefined;

  DOM.questionsContainer.innerHTML = `
    <div class="question-card">
      <div class="question-number">سؤال ${index + 1}</div>
      <div class="question-text">${q.question}</div>
      <div class="options-list">
        ${q.options.map((opt, i) => `
          <div class="option-item ${answered ? 'disabled' : ''}">
            <input type="radio" name="q${index}" id="q${index}o${i}" value="${i}"
              ${state.answers[index] === i ? 'checked' : ''} ${answered ? 'disabled' : ''} />
            <label class="option-label" for="q${index}o${i}">
              <span class="option-indicator">${window._labels[i]}</span>
              <span class="option-text">${opt}</span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (!answered) {
    DOM.questionsContainer.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', (e) => {
        state.answers[index] = parseInt(e.target.value);
      });
    });
  }
}

// Navigation
DOM.prevBtn.addEventListener('click', () => {
  if (state.currentQuestion > 0) {
    showQuestion(state.currentQuestion - 1);
  }
});

DOM.nextBtn.addEventListener('click', () => {
  if (state.currentQuestion < state.quiz.questions.length - 1) {
    showQuestion(state.currentQuestion + 1);
  }
});

DOM.submitBtn.addEventListener('click', showResults);

// Results
function showResults() {
  const questions = state.quiz.questions;

  const unanswered = state.answers.some((a) => a === null || a === undefined);
  if (unanswered) {
    const confirmed = confirm('هناك أسئلة لم تجب عليها. هل تريد إنهاء الامتحان؟');
    if (!confirmed) return;
  }

  let correct = 0;
  questions.forEach((q, i) => {
    if (state.answers[i] === q.correctAnswer) correct++;
  });

  const score = Math.round((correct / questions.length) * 100);

  DOM.quizSection.hidden = true;
  DOM.resultsSection.hidden = false;

  setTimeout(() => {
    const circumference = 314;
    const offset = circumference - (score / 100) * circumference;
    DOM.scoreCircle.style.strokeDashoffset = offset;
    DOM.scoreNumber.textContent = score;

    let message, color;
    if (score >= 90) { message = 'ممتاز! 🎉'; color = '#22c55e'; }
    else if (score >= 70) { message = 'جيد جدًا! 👍'; color = '#3b82f6'; }
    else if (score >= 50) { message = 'جيد 📚'; color = '#f59e0b'; }
    else { message = 'حاول مرة أخرى 💪'; color = '#ef4444'; }

    DOM.scoreMessage.textContent = message;
    DOM.scoreMessage.style.color = color;
    DOM.scoreCircle.style.stroke = color;
    DOM.scoreDetails.textContent = `${correct} من ${questions.length} إجابات صحيحة`;
  }, 100);

  state.reviewed = false;
  DOM.reviewSection.hidden = true;
}

// Review
DOM.reviewBtn.addEventListener('click', () => {
  if (state.reviewed) {
    DOM.reviewSection.hidden = !DOM.reviewSection.hidden;
    return;
  }

  state.reviewed = true;
  DOM.reviewSection.hidden = false;

  const questions = state.quiz.questions;
  DOM.reviewContainer.innerHTML = questions.map((q, i) => {
    const isCorrect = state.answers[i] === q.correctAnswer;
    const userAnswer = state.answers[i];

    return `
      <div class="review-card">
        <div class="review-status ${isCorrect ? 'correct' : 'wrong'}">
          ${isCorrect ? '✓ صحيح' : '✗ خطأ'}
          ${!isCorrect && userAnswer !== null ? `(${window._labels[userAnswer]})` : ''}
          ${userAnswer === null ? '(لم تجب)' : ''}
        </div>
        <div class="question-text">${q.question}</div>
        <div class="options-list">
          ${q.options.map((opt, j) => `
            <div class="option-item disabled ${j === q.correctAnswer ? 'correct' : (j === userAnswer && !isCorrect ? 'wrong' : '')}">
              <input type="radio" disabled ${j === userAnswer ? 'checked' : ''} />
              <label class="option-label">
                <span class="option-indicator">${window._labels[j]}</span>
                <span class="option-text">${opt} ${j === q.correctAnswer ? '✓' : ''}</span>
              </label>
            </div>
          `).join('')}
        </div>
        ${q.explanation ? `<div class="explanation-box"><strong>شرح:</strong> ${q.explanation}</div>` : ''}
      </div>
    `;
  }).join('');
});

// Download PDF
DOM.downloadPdfBtn.addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const questions = state.quiz.questions;
  const title = state.quiz.title || 'Quiz';
  const isEnglish = DOM.language.value === 'english';

  let correct = 0;
  questions.forEach((q, i) => {
    if (state.answers[i] === q.correctAnswer) correct++;
  });

  const wrapper = document.createElement('div');
  wrapper.id = 'pdf-export';
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:48px;font-family:'Cairo',sans-serif;direction:${isEnglish ? 'ltr' : 'rtl'};text-align:${isEnglish ? 'left' : 'right'}`;
  wrapper.innerHTML = `
    <div style="text-align:center;margin-bottom:32px;border-bottom:2px solid #f59e0b;padding-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px">
        <svg width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#f59e0b"/><path d="M5 10l4 4 6-6" stroke="#000" stroke-width="2" fill="none"/></svg>
        <span style="font-size:18px;font-weight:700;color:#111">QuizMind</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:8px 0">${title}</h1>
      <p style="color:#666;font-size:14px">النتيجة: ${correct}/${questions.length} — ${Math.round((correct / questions.length) * 100)}%</p>
      <p style="color:#999;font-size:12px">${new Date().toLocaleDateString('ar-SA')}</p>
    </div>
    ${questions.map((q, i) => {
      const isCorrect = state.answers[i] === q.correctAnswer;
      const userAnswer = state.answers[i];
      const userLabel = window._labels[userAnswer] ?? '—';
      const correctLabel = window._labels[q.correctAnswer];
      return `
        <div style="margin-bottom:20px;padding:12px 16px;border:1px solid #e0e0e0;border-radius:8px;${!isCorrect ? 'background:#fef2f2' : 'background:#f0fdf4'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:600;color:${isCorrect ? '#22c55e' : '#ef4444'};font-size:12px">
              ${isCorrect ? '✓ صحيح' : '✗ خطأ'}
            </span>
            <span style="color:#999;font-size:11px">سؤال ${i + 1}</span>
          </div>
          <p style="font-weight:600;color:#111;margin:0 0 8px;font-size:14px">${q.question}</p>
          <div style="font-size:13px;color:#333;line-height:1.6">
            <span style="color:#666">إجابتك:</span> ${userLabel}
            ${!isCorrect ? `<span style="color:#666;margin-right:12px">الإجابة الصحيحة:</span> ${correctLabel}` : ''}
          </div>
          ${q.explanation ? `<div style="margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;color:#555"><strong style="color:#f59e0b">شرح:</strong> ${q.explanation}</div>` : ''}
        </div>
      `;
    }).join('')}
    <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;color:#999;font-size:11px">
      QuizMind &mdash; تم الإنشاء في ${new Date().toLocaleDateString('ar-SA')}
    </div>
  `;
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, { scale: 1, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.7);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`QuizMind-${title.substring(0, 30).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '')}.pdf`);
  } catch (err) {
    alert('حدث خطأ أثناء إنشاء PDF');
  } finally {
    wrapper.remove();
  }
});

// New Quiz
DOM.newQuizBtn.addEventListener('click', () => {
  state.quiz = null;
  state.answers = [];
  state.currentQuestion = 0;
  state.reviewed = false;

  DOM.resultsSection.hidden = true;
  DOM.reviewSection.hidden = true;
  DOM.quizSection.hidden = true;
  DOM.uploadSection.hidden = false;
  DOM.scoreCircle.style.strokeDashoffset = 314;
  resetFile();
});
