const state = {
  file: null,
  fileText: '',
  quiz: null,
  currentQuestion: 0,
  answers: [],
  reviewed: false,
  timer: null,
  timeLeft: 0,
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

  timerBadge: document.getElementById('timerBadge'),
  timerDisplay: document.getElementById('timerDisplay'),

  scoreNumber: document.getElementById('scoreNumber'),
  scoreCircle: document.getElementById('scoreCircle'),
  scoreMessage: document.getElementById('scoreMessage'),
  scoreDetails: document.getElementById('scoreDetails'),
  reviewBtn: document.getElementById('reviewBtn'),
  shareBtn: document.getElementById('shareBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  newQuizBtn: document.getElementById('newQuizBtn'),
  reviewSection: document.getElementById('reviewSection'),
  reviewContainer: document.getElementById('reviewContainer'),

  themeBtn: document.getElementById('themeBtn'),
  themeIcon: document.getElementById('themeIcon'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  historyBtn: document.getElementById('historyBtn'),
  historySection: document.getElementById('historySection'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  backFromHistoryBtn: document.getElementById('backFromHistoryBtn'),
};

const LABELS_AR = ['أ', 'ب', 'ج', 'د'];
const LABELS_EN = ['A', 'B', 'C', 'D'];
const HISTORY_KEY = 'quizmind_history';

// ─── Snackbar ───────────────────────────────────────

function showSnackbar(msg) {
  let el = document.querySelector('.snackbar');
  if (!el) {
    el = document.createElement('div');
    el.className = 'snackbar';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), 2200);
}

// ─── Theme ──────────────────────────────────────────

const savedTheme = localStorage.getItem('quizmind_theme');
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
  document.querySelector('meta[name="theme-color"]').content = '#f5f5f5';
}

DOM.themeBtn.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]').content = '#0d0d0d';
    localStorage.setItem('quizmind_theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    document.querySelector('meta[name="theme-color"]').content = '#f5f5f5';
    localStorage.setItem('quizmind_theme', 'light');
  }
});

// ─── Fullscreen ─────────────────────────────────────

DOM.fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

document.addEventListener('fullscreenchange', () => {
  DOM.fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
});

// ─── History (localStorage) ─────────────────────────

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function addHistory(entry) {
  const list = getHistory();
  list.unshift({ ...entry, date: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

function renderHistory() {
  const list = getHistory();
  DOM.historyEmpty.hidden = list.length > 0;
  DOM.historyList.innerHTML = list.map((e, i) => {
    const pct = Math.round((e.correct / e.total) * 100);
    const cls = pct < 50 ? 'low' : '';
    const date = new Date(e.date).toLocaleDateString('ar-SA');
    return `
      <div class="history-card">
        <div class="history-card-info">
          <h4>${e.title || 'امتحان'}</h4>
          <span>${date} &middot; ${e.difficulty || ''}</span>
        </div>
        <div class="history-card-score ${cls}">${e.correct}/${e.total}</div>
      </div>
    `;
  }).join('');
}

let historySource = 'upload';

DOM.historyBtn.addEventListener('click', () => {
  if (DOM.historySection.hidden) {
    historySource = DOM.uploadSection.hidden ? 'results' : 'upload';
    DOM.historySection.hidden = false;
    if (historySource === 'upload') DOM.uploadSection.hidden = true;
    renderHistory();
  } else {
    DOM.historySection.hidden = true;
    if (historySource === 'upload') DOM.uploadSection.hidden = false;
  }
});

DOM.backFromHistoryBtn.addEventListener('click', () => {
  DOM.historySection.hidden = true;
  if (historySource === 'upload') DOM.uploadSection.hidden = false;
});

DOM.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('حذف جميع الامتحانات السابقة؟')) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showSnackbar('تم الحذف');
  }
});

// ─── File handling ──────────────────────────────────

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

async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt') return await file.text();
  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n\n';
    }
    return text.trim();
  }
  throw new Error('Unsupported file format');
}

// ─── Generate quiz ──────────────────────────────────

DOM.generateBtn.addEventListener('click', async () => {
  if (!state.file) return;

  DOM.uploadSection.hidden = true;
  DOM.loadingSection.hidden = false;
  DOM.historySection.hidden = true;

  try {
    state.fileText = await extractText(state.file);
    if (!state.fileText || state.fileText.length < 20) {
      alert('لم يتم العثور على نص كافٍ في الملف.');
      throw new Error('Insufficient text');
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
      let msg;
      try {
        const err = await response.json();
        msg = err.error || 'خطأ في الخادم';
      } catch {
        const text = await response.text();
        if (text.includes('<html') || text.includes('<HTML')) {
          msg = 'انتهت مهلة الطلب. جرب عدد أسئلة أقل.';
        } else {
          msg = text.substring(0, 100) || 'خطأ غير معروف';
        }
      }
      throw new Error(msg);
    }

    state.quiz = await response.json();
    state.answers = new Array(state.quiz.questions.length).fill(null);
    state.currentQuestion = 0;

    DOM.loadingSection.hidden = true;
    const isEnglish = DOM.language.value === 'english';
    DOM.quizSection.classList.toggle('dir-ltr', isEnglish);
    renderQuiz(isEnglish);
    DOM.quizSection.hidden = false;

    startTimer(state.quiz.questions.length);
  } catch (error) {
    DOM.loadingSection.hidden = true;
    DOM.uploadSection.hidden = false;
    alert('حدث خطأ: ' + error.message);
  }
});

// ─── Timer ──────────────────────────────────────────

function startTimer(questionCount) {
  stopTimer();
  state.timeLeft = questionCount * 30;
  DOM.timerBadge.hidden = false;
  DOM.timerBadge.classList.remove('warning');
  renderTimer();
  state.timer = setInterval(() => {
    state.timeLeft--;
    renderTimer();
    if (state.timeLeft <= 10) DOM.timerBadge.classList.add('warning');
    if (state.timeLeft <= 0) {
      stopTimer();
      showResults();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  DOM.timerBadge.hidden = true;
}

function renderTimer() {
  const m = String(Math.floor(state.timeLeft / 60)).padStart(2, '0');
  const s = String(state.timeLeft % 60).padStart(2, '0');
  DOM.timerDisplay.textContent = `${m}:${s}`;
}

// ─── Render quiz ────────────────────────────────────

function renderQuiz(isEnglish) {
  window._labels = isEnglish ? LABELS_EN : LABELS_AR;
  DOM.quizTitle.textContent = state.quiz.title || 'الامتحان';
  DOM.totalQuestions.textContent = state.quiz.questions.length;
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

// ─── Navigation ─────────────────────────────────────

DOM.prevBtn.addEventListener('click', () => {
  if (state.currentQuestion > 0) showQuestion(state.currentQuestion - 1);
});

DOM.nextBtn.addEventListener('click', () => {
  if (state.currentQuestion < state.quiz.questions.length - 1)
    showQuestion(state.currentQuestion + 1);
});

DOM.submitBtn.addEventListener('click', showResults);

// ─── Keyboard shortcuts ────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (!state.quiz || DOM.quizSection.hidden) return;

  const idx = state.currentQuestion;
  const q = state.quiz.questions[idx];
  const answered = state.answers[idx] !== null && state.answers[idx] !== undefined;

  if (e.key >= '1' && e.key <= '4' && !answered) {
    const i = parseInt(e.key) - 1;
    if (i < q.options.length) {
      state.answers[idx] = i;
      showQuestion(idx);
    }
    return;
  }

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (idx < state.quiz.questions.length - 1) showQuestion(idx + 1);
    return;
  }

  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx > 0) showQuestion(idx - 1);
    return;
  }

  if (e.key === 'Enter') {
    if (!DOM.submitBtn.hidden) showResults();
    else if (idx < state.quiz.questions.length - 1) showQuestion(idx + 1);
  }
});

// ─── Results ────────────────────────────────────────

function showResults() {
  stopTimer();

  const questions = state.quiz.questions;
  const unanswered = state.answers.some((a) => a === null || a === undefined);
  if (unanswered) {
    const confirmed = confirm('هناك أسئلة لم تجب عليها. هل تريد إنهاء الامتحان؟');
    if (!confirmed) { startTimer(questions.length); return; }
  }

  let correct = 0;
  questions.forEach((q, i) => {
    if (state.answers[i] === q.correctAnswer) correct++;
  });

  const score = Math.round((correct / questions.length) * 100);

  addHistory({
    title: state.quiz.title,
    correct,
    total: questions.length,
    difficulty: DOM.difficulty.value,
  });

  DOM.quizSection.hidden = true;
  DOM.resultsSection.hidden = false;

  const circumference = 314;
  setTimeout(() => {
    const offset = circumference - (score / 100) * circumference;
    DOM.scoreCircle.style.strokeDashoffset = offset;
    DOM.scoreNumber.textContent = score;

    let message, color;
    if (score >= 90) { message = 'ممتاز! 🎉'; color = '#22c55e'; }
    else if (score >= 70) { message = 'جيد جدًا! 👍'; color = '#3b82f6'; }
    else if (score >= 50) { message = 'جيد 📚'; color = '#10b981'; }
    else { message = 'حاول مرة أخرى 💪'; color = '#ef4444'; }

    DOM.scoreMessage.textContent = message;
    DOM.scoreMessage.style.color = color;
    DOM.scoreCircle.style.stroke = color;
    DOM.scoreDetails.textContent = `${correct} من ${questions.length} إجابات صحيحة`;
  }, 100);

  state.reviewed = false;
  DOM.reviewSection.hidden = true;
}

// ─── Share ──────────────────────────────────────────

DOM.shareBtn.addEventListener('click', () => {
  const questions = state.quiz.questions;
  let correct = 0;
  questions.forEach((q, i) => {
    if (state.answers[i] === q.correctAnswer) correct++;
  });

  const text = [
    `🧠 QuizMind - نتيجة الامتحان`,
    `━━━━━━━━━━━━━━━━`,
    `${state.quiz.title || ''}`,
    `النتيجة: ${correct}/${questions.length} (${Math.round((correct / questions.length) * 100)}%)`,
    `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
  ].join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showSnackbar('تم نسخ النتيجة');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showSnackbar('تم نسخ النتيجة'); }
  catch { alert('تعذر النسخ'); }
  ta.remove();
}

// ─── Review ─────────────────────────────────────────

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

// ─── Download PDF ───────────────────────────────────

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
    <div style="text-align:center;margin-bottom:32px;border-bottom:2px solid #10b981;padding-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px">
        <svg width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#10b981"/><path d="M5 10l4 4 6-6" stroke="#000" stroke-width="2" fill="none"/></svg>
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
          ${q.explanation ? `<div style="margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;color:#555"><strong style="color:#10b981">شرح:</strong> ${q.explanation}</div>` : ''}
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
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }
    const fname = `QuizMind-${title.substring(0, 30).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '')}.pdf`;
    pdf.save(fname);
  } catch (err) {
    alert('حدث خطأ أثناء إنشاء PDF');
  } finally {
    wrapper.remove();
  }
});

// ─── New Quiz ───────────────────────────────────────

DOM.newQuizBtn.addEventListener('click', () => {
  stopTimer();
  state.quiz = null;
  state.answers = [];
  state.currentQuestion = 0;
  state.reviewed = false;

  DOM.resultsSection.hidden = true;
  DOM.reviewSection.hidden = true;
  DOM.quizSection.hidden = true;
  DOM.historySection.hidden = true;
  DOM.uploadSection.hidden = false;
  DOM.scoreCircle.style.strokeDashoffset = 314;
  resetFile();
});
