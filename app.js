(() => {
  'use strict';
  const STORAGE_KEY = 'practice-room-v1';
  const ATTEMPT_KEY = 'practice-room-attempt-v1';
  const THEME_KEY = 'practice-room-theme-v1';
  const defaults = { title: 'My mock test', duration: 30, correctMarks: 1, wrongMarks: 0.25, questions: [], sectionOrder: [], sectionTimes: {} };
  let data = loadData();
  let attempt = loadAttempt();
  let toastTimer;
  let tickTimer;
  let currentQuestionId = null;
  let storageWarningShown = false;

  const $ = (id) => document.getElementById(id);
  const views = { setup: $('setup-view'), exam: $('exam-view'), result: $('result-view') };
  const example = {
    title: 'Science practice',
    durationMinutes: 20,
    marks: { correct: 1, incorrect: 0.25 },
    sections: [
      { name: 'Biology', timeLimitMinutes: 5, questions: [
        { question: 'Which part of a plant cell carries out photosynthesis?', options: ['Nucleus', 'Chloroplast', 'Ribosome', 'Vacuole'], answer: 'Chloroplast', explanation: 'Chloroplasts contain chlorophyll and are where photosynthesis takes place.' }
      ] },
      { name: 'Chemistry', timeLimitMinutes: 5, questions: [
        { question: 'What is the chemical symbol for sodium?', options: ['So', 'S', 'Na', 'N'], answer: 'Na' }
      ] }
    ]
  };

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return structuredClone(defaults);
      return { ...structuredClone(defaults), ...saved, questions: Array.isArray(saved.questions) ? saved.questions : [], sectionOrder: Array.isArray(saved.sectionOrder) ? saved.sectionOrder : [], sectionTimes: saved.sectionTimes && typeof saved.sectionTimes === 'object' && !Array.isArray(saved.sectionTimes) ? saved.sectionTimes : {} };
    } catch { return structuredClone(defaults); }
  }
  function loadAttempt() {
    try {
      const value = JSON.parse(localStorage.getItem(ATTEMPT_KEY) || 'null');
      return value && ['running', 'complete'].includes(value.status) ? value : null;
    } catch { return null; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch {
      if (!storageWarningShown) { storageWarningShown = true; toast('Browser storage is unavailable. Your changes may not persist after closing this page.'); }
    }
  }
  function persistAttempt() {
    try {
      if (attempt) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
      else localStorage.removeItem(ATTEMPT_KEY);
    } catch {
      if (!storageWarningShown) { storageWarningShown = true; toast('Browser storage is unavailable. Your changes may not persist after closing this page.'); }
    }
  }
  function getSavedTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  }
  function applyTheme(theme, save = false) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme-toggle').innerHTML = dark ? '☀ <span>Light mode</span>' : '☾ <span>Dark mode</span>';
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
    $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    if (save) {
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); }
      catch { /* Theme remains active for this page even when storage is unavailable. */ }
    }
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function id() {
    return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function round2(num) { return Math.round((num + Number.EPSILON) * 100) / 100; }
  function numberText(num) { return Number.isInteger(num) ? String(num) : String(round2(num)); }
  function sectionsFrom(items = data.questions, order = data.sectionOrder) {
    const found = [...new Set(items.map((q) => q.section || 'General'))];
    const sorted = [...order.filter((s) => found.includes(s)), ...found.filter((s) => !order.includes(s))];
    return sorted;
  }
  function orderedQuestions(items = data.questions, order = data.sectionOrder) {
    const sects = sectionsFrom(items, order);
    return sects.flatMap((s) => items.filter((q) => (q.section || 'General') === s));
  }
  function saveSettings() {
    const title = $('test-title').value.trim();
    data.title = title || 'My mock test';
    const duration = Number($('duration').value);
    const correct = Number($('correct-marks').value);
    const wrong = Number($('wrong-marks').value);
    if (Number.isFinite(duration) && duration >= 1 && duration <= 600) data.duration = duration;
    if (Number.isFinite(correct) && correct >= 0 && correct <= 1000) data.correctMarks = correct;
    if (Number.isFinite(wrong) && wrong >= 0 && wrong <= 1000) data.wrongMarks = wrong;
    persist(); updateOverview();
  }
  function hydrateSettings() {
    $('test-title').value = data.title === 'My mock test' ? '' : data.title;
    $('duration').value = data.duration;
    $('correct-marks').value = data.correctMarks;
    $('wrong-marks').value = data.wrongMarks;
    $('json-example').textContent = JSON.stringify(example, null, 2);
    renderBank(); updateOverview();
  }
  function updateOverview() {
    const sects = sectionsFrom();
    const sectionTimeValues = sects.map((section) => Number(data.sectionTimes?.[section]));
    const allSectionTimesSet = sects.length > 0 && sectionTimeValues.every((minutes) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 600);
    const someSectionTimesSet = sectionTimeValues.some((minutes) => Number.isFinite(minutes) && minutes > 0);
    $('question-count').textContent = data.questions.length;
    $('overview-questions').textContent = data.questions.length;
    $('overview-sections').textContent = sects.length;
    $('overview-time').textContent = allSectionTimesSet ? `${sectionTimeValues.reduce((sum, minutes) => sum + minutes, 0)} min total` : someSectionTimesSet ? 'Finish setup' : `${data.duration} min`;
    $('overview-time-label').textContent = allSectionTimesSet ? 'Section total' : someSectionTimesSet ? 'Timer mode' : 'Overall limit';
    $('overview-scoring').textContent = `+${numberText(data.correctMarks)} · −${numberText(data.wrongMarks)}`;
    $('start-test').disabled = data.questions.length === 0;
    $('start-test-mobile').disabled = data.questions.length === 0;
  }
  function renderBank() {
    const empty = data.questions.length === 0;
    $('empty-bank').classList.toggle('hidden', !empty);
    $('bank-content').classList.toggle('hidden', empty);
    if (empty) { updateOverview(); return; }
    const sections = sectionsFrom();
    const counts = Object.fromEntries(sections.map((section) => [section, data.questions.filter((q) => q.section === section).length]));
    $('section-list').innerHTML = sections.map((section, index) => `
      <div class="section-row" data-section="${esc(section)}">
        <span class="section-number">${String(index + 1).padStart(2, '0')}</span>
        <input type="text" aria-label="Section name" value="${esc(section)}" maxlength="50" data-section-name="${esc(section)}" />
        <div class="section-actions"><span class="section-count">${counts[section]} ${counts[section] === 1 ? 'question' : 'questions'}</span><label class="section-time-field"><input type="number" min="1" max="600" step="1" placeholder="—" aria-label="${esc(section)} time limit in minutes" title="Time limit in minutes" data-section-time="${esc(section)}" value="${esc(data.sectionTimes?.[section] ?? '')}"><span>min</span></label><button type="button" data-move-section="up" data-section="${esc(section)}" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-section="down" data-section="${esc(section)}" title="Move down" ${index === sections.length - 1 ? 'disabled' : ''}>↓</button></div>
      </div>`).join('');
    const previous = $('question-filter').value;
    $('question-filter').innerHTML = '<option value="all">All sections</option>' + sections.map((section) => `<option value="${esc(section)}">${esc(section)}</option>`).join('');
    if ([...$('question-filter').options].some((o) => o.value === previous)) $('question-filter').value = previous;
    $('section-suggestions').innerHTML = sections.map((section) => `<option value="${esc(section)}"></option>`).join('');
    renderQuestionList(); updateOverview();
  }
  function renderQuestionList() {
    const filter = $('question-filter').value;
    const questions = orderedQuestions().filter((q) => filter === 'all' || q.section === filter);
    if (!questions.length) {
      $('question-list').innerHTML = '<div class="empty-filter">No questions in this section yet.</div>'; return;
    }
    $('question-list').innerHTML = questions.map((q, index) => `
      <article class="question-row">
        <span class="question-row-number">${String(index + 1).padStart(2, '0')}</span>
        <div class="question-row-content"><div class="question-row-top"><span class="section-tag">${esc(q.section)}</span></div><strong>${esc(q.prompt)}</strong><div class="question-meta">${q.options.length} options · Answer: ${esc(q.options[q.answerIndex] ?? 'Not set')}</div></div>
        <div class="question-row-actions"><button type="button" data-edit-question="${esc(q.id)}" aria-label="Edit question">Edit</button><button type="button" data-delete-question="${esc(q.id)}" aria-label="Delete question">Delete</button></div>
      </article>`).join('');
  }
  function showView(name) {
    Object.entries(views).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function toast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2700);
  }
  function openEditor(question = null) {
    $('question-form').reset(); $('editing-id').value = question?.id || '';
    $('editor-heading').textContent = question ? 'Edit question' : 'Add a question';
    $('question-section').value = question?.section || sectionsFrom()[0] || '';
    $('question-prompt').value = question?.prompt || '';
    $('question-explanation').value = question?.explanation || '';
    const opts = question?.options || ['', '', '', ''];
    $('option-editor-list').innerHTML = '';
    opts.forEach((option, i) => addOptionRow(option, i === (question?.answerIndex ?? 0)));
    $('question-editor').classList.remove('hidden');
    $('question-editor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('question-prompt').focus({ preventScroll: true });
  }
  function addOptionRow(value = '', checked = false) {
    const rows = $('option-editor-list');
    if (rows.children.length >= 8) { toast('A question can have up to 8 options.'); return; }
    const row = document.createElement('div'); row.className = 'option-edit-row';
    row.innerHTML = `<input type="radio" name="correct-option" aria-label="Mark as correct answer" ${checked ? 'checked' : ''}><input type="text" maxlength="300" aria-label="Answer option" placeholder="Option ${rows.children.length + 1}" value="${esc(value)}" required><button class="remove-option" type="button" aria-label="Remove option">×</button>`;
    row.querySelector('.remove-option').addEventListener('click', () => {
      if (rows.children.length <= 2) { toast('Keep at least two options.'); return; }
      const wasChecked = row.querySelector('input[type=radio]').checked;
      row.remove(); if (wasChecked) rows.querySelector('input[type=radio]').checked = true;
      [...rows.children].forEach((child, i) => child.querySelector('input[type=text]').placeholder = `Option ${i + 1}`);
    });
    rows.appendChild(row);
  }
  function normalizeImport(input) {
    let title = input.title || input.testTitle;
    let duration = input.durationMinutes ?? input.duration;
    let correctMarks = input.marks?.correct ?? input.correctMarks;
    let wrongMarks = input.marks?.incorrect ?? input.marks?.wrong ?? input.wrongMarks ?? input.negativeMarks;
    const suppliedSectionTimes = input.sectionTimes ?? input.sectionDurations ?? {};
    if (!suppliedSectionTimes || typeof suppliedSectionTimes !== 'object' || Array.isArray(suppliedSectionTimes)) throw new Error('"sectionTimes" must be an object mapping section names to minutes.');
    const sectionTimes = {};
    const addSectionTime = (name, value) => {
      if (value === undefined || value === null || value === '') return;
      const minutes = Number(value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error(`The time limit for "${name}" must be a whole number from 1 to 600 minutes.`);
      sectionTimes[name] = minutes;
    };
    Object.entries(suppliedSectionTimes).forEach(([name, value]) => addSectionTime(name, value));
    const raw = [];
    if (Array.isArray(input.questions)) {
      input.questions.forEach((q) => raw.push({ ...q, section: q.section || 'General' }));
    } else if (Array.isArray(input.sections)) {
      input.sections.forEach((section) => {
        const name = String(typeof section === 'string' ? section : (section.name || section.title || 'General')).trim() || 'General';
        if (typeof section === 'object' && section) addSectionTime(name, section.timeLimitMinutes ?? section.durationMinutes ?? section.timeMinutes ?? section.minutes);
        (section.questions || []).forEach((q) => raw.push({ ...q, section: q.section || name }));
      });
    } else throw new Error('Add a "questions" array or a "sections" array to your JSON file.');
    if (raw.length === 0) throw new Error('The file does not contain any questions.');
    const normalized = raw.map((q, index) => {
      const prompt = q.prompt ?? q.question ?? q.text;
      const options = q.options ?? q.choices;
      if (typeof prompt !== 'string' || !prompt.trim()) throw new Error(`Question ${index + 1} needs question text.`);
      if (!Array.isArray(options) || options.length < 2 || options.length > 8 || options.some((o) => typeof o !== 'string' || !o.trim())) throw new Error(`Question ${index + 1} must have 2–8 non-empty text options.`);
      let answer = q.answer ?? q.correctAnswer ?? q.correct ?? q.answerIndex;
      let answerIndex;
      if (Number.isInteger(answer)) answerIndex = answer;
      else if (typeof answer === 'string') {
        const exact = options.findIndex((option) => option.trim() === answer.trim());
        const letter = /^[A-H]$/i.test(answer.trim()) ? answer.trim().toUpperCase().charCodeAt(0) - 65 : -1;
        answerIndex = exact >= 0 ? exact : letter;
      }
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) throw new Error(`Question ${index + 1} needs a valid answer (option text, A–H, or a 0-based answer index).`);
      return { id: id(), section: String(q.section || 'General').trim() || 'General', prompt: prompt.trim(), options: options.map((o) => o.trim()), answerIndex, explanation: String(q.explanation || '').trim() };
    });
    return { title, duration, correctMarks, wrongMarks, questions: normalized, sectionTimes };
  }
  function importQuestions(parsed) {
    const normalized = normalizeImport(parsed);
    const append = $('import-mode').value === 'append';
    data.questions = append ? [...data.questions, ...normalized.questions] : normalized.questions;
    if (!append) { data.sectionOrder = []; data.sectionTimes = {}; }
    const importedSectionNames = new Set(normalized.questions.map((question) => question.section));
    Object.entries(normalized.sectionTimes).forEach(([section, minutes]) => {
      if (importedSectionNames.has(section)) data.sectionTimes[section] = minutes;
    });
    if (normalized.title && !append) data.title = String(normalized.title).slice(0, 80);
    if (Number.isFinite(Number(normalized.duration)) && Number(normalized.duration) >= 1 && Number(normalized.duration) <= 600 && !append) data.duration = Number(normalized.duration);
    if (Number.isFinite(Number(normalized.correctMarks)) && Number(normalized.correctMarks) >= 0 && !append) data.correctMarks = Number(normalized.correctMarks);
    if (Number.isFinite(Number(normalized.wrongMarks)) && Number(normalized.wrongMarks) >= 0 && !append) data.wrongMarks = Number(normalized.wrongMarks);
    data.sectionOrder = sectionsFrom(data.questions, data.sectionOrder);
    data.sectionTimes = Object.fromEntries(Object.entries(data.sectionTimes).filter(([section]) => data.questions.some((question) => question.section === section)));
    persist(); hydrateSettings();
    toast(`Imported ${normalized.questions.length} ${normalized.questions.length === 1 ? 'question' : 'questions'}.`);
  }
  function currentAttemptQuestions() { return attempt?.questions || []; }
  function startTest() {
    saveSettings();
    if (!data.questions.length) { toast('Add or import questions before starting.'); return; }
    if (attempt?.status === 'running') {
      const activeDeadline = attempt.sectionTimed ? attempt.sectionDeadline : attempt.deadline;
      if (activeDeadline > Date.now()) {
        const resume = confirm('A test is already in progress. Resume it? Choose Cancel to discard it and start over.');
        if (resume) { enterExam(); return; }
        attempt = null; persistAttempt();
      } else {
        enterExam(); return;
      }
    }
    const sections = sectionsFrom(data.questions, data.sectionOrder);
    const configuredTimes = sections.map((section) => Number(data.sectionTimes?.[section]));
    const hasSectionTimes = configuredTimes.some((minutes) => Number.isFinite(minutes) && minutes > 0);
    const allSectionTimesSet = sections.length > 0 && configuredTimes.every((minutes) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 600);
    if (hasSectionTimes && !allSectionTimesSet) {
      toast('Set a valid time for every section, or clear all section times to use the overall timer.'); return;
    }
    const questions = orderedQuestions().map((q) => ({ ...q, options: [...q.options] }));
    const now = Date.now();
    const sectionDurations = Object.fromEntries(sections.map((section, index) => [section, configuredTimes[index]]));
    attempt = {
      status: 'running', title: data.title, duration: data.duration, correctMarks: data.correctMarks, wrongMarks: data.wrongMarks,
      questions, sections, sectionTimed: allSectionTimesSet && hasSectionTimes, sectionDurations,
      activeSectionIndex: 0, sectionDeadline: allSectionTimesSet && hasSectionTimes ? now + sectionDurations[sections[0]] * 60_000 : null,
      answers: {}, flagged: [], currentQuestionId: questions[0].id,
      startedAt: now, deadline: allSectionTimesSet && hasSectionTimes ? null : now + data.duration * 60_000
    };
    currentQuestionId = questions[0].id; persistAttempt(); enterExam();
  }
  function enterExam() {
    if (!attempt || attempt.status !== 'running') return;
    if (attempt.sectionTimed && attempt.sectionDeadline <= Date.now()) {
      advanceSection(true, attempt.sectionDeadline);
      if (!attempt || attempt.status !== 'running') return;
    } else if (!attempt.sectionTimed && attempt.deadline <= Date.now()) { finishTest(true); return; }
    currentQuestionId = attempt.currentQuestionId || attempt.questions[0]?.id;
    $('exam-title').textContent = attempt.title;
    showView('exam'); renderExam(); updateTimer();
    clearInterval(tickTimer); tickTimer = setInterval(updateTimer, 300);
  }
  function updateTimer() {
    if (!attempt || attempt.status !== 'running') return;
    const deadline = attempt.sectionTimed ? attempt.sectionDeadline : attempt.deadline;
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const min = Math.floor(seconds / 60); const sec = seconds % 60;
    if (attempt.sectionTimed) {
      const section = attempt.sections[attempt.activeSectionIndex];
      $('timer-context').textContent = `${section} time`;
      $('timer').title = `Time remaining in ${section}`;
    } else {
      $('timer-context').textContent = 'Time left';
      $('timer').title = 'Overall time remaining';
    }
    $('timer-value').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    $('timer').classList.toggle('is-low', seconds <= 60);
    if (seconds <= 0) {
      if (attempt.sectionTimed) advanceSection(true, deadline);
      else { clearInterval(tickTimer); finishTest(true); }
    }
  }
  function advanceSection(auto = false, startedAt = Date.now()) {
    if (!attempt || attempt.status !== 'running' || !attempt.sectionTimed) return;
    const nextIndex = attempt.activeSectionIndex + 1;
    if (nextIndex >= attempt.sections.length) { finishTest(auto); return; }
    attempt.activeSectionIndex = nextIndex;
    const section = attempt.sections[nextIndex];
    const nextDeadline = startedAt + attempt.sectionDurations[section] * 60_000;
    attempt.sectionDeadline = nextDeadline;
    const firstQuestion = attempt.questions.find((question) => questionSection(question) === section);
    if (firstQuestion) { attempt.currentQuestionId = firstQuestion.id; currentQuestionId = firstQuestion.id; }
    persistAttempt();
    if (nextDeadline <= Date.now()) { advanceSection(true, nextDeadline); return; }
    renderExam(); updateTimer();
  }
  function activeQuestion() { return currentAttemptQuestions().find((q) => q.id === currentQuestionId) || currentAttemptQuestions()[0]; }
  function questionSection(q) { return q?.section || 'General'; }
  function answeredCount() { return currentAttemptQuestions().filter((q) => Object.hasOwn(attempt.answers, q.id) && attempt.answers[q.id] !== null).length; }
  function renderExam() {
    if (!attempt || !attempt.questions.length) return;
    const sections = attempt.sections || [...new Set(attempt.questions.map(questionSection))];
    const q = activeQuestion(); if (!q) return;
    attempt.currentQuestionId = q.id; currentQuestionId = q.id;
    const activeSection = questionSection(q);
    $('exam-section-nav').innerHTML = sections.map((section) => {
      const count = attempt.questions.filter((item) => questionSection(item) === section).length;
      const locked = attempt.sectionTimed && section !== activeSection;
      return `<button class="exam-section-link ${section === activeSection ? 'active' : ''}" type="button" data-jump-section="${esc(section)}" ${locked ? 'disabled aria-label="Locked until the current section ends"' : ''}><span>${esc(section)}</span><span>${count}</span></button>`;
    }).join('');
    $('exam-section-caption').textContent = activeSection;
    const sectionQuestions = attempt.questions.filter((item) => questionSection(item) === activeSection);
    $('map-count').textContent = sectionQuestions.length;
    $('question-map').innerHTML = sectionQuestions.map((item, index) => {
      const isAnswered = Object.hasOwn(attempt.answers, item.id) && attempt.answers[item.id] !== null;
      const isFlagged = attempt.flagged.includes(item.id);
      return `<button class="map-button ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''} ${item.id === q.id ? 'current' : ''}" type="button" data-jump-question="${esc(item.id)}" aria-label="Question ${index + 1}${isAnswered ? ', answered' : ''}${isFlagged ? ', marked for review' : ''}">${index + 1}</button>`;
    }).join('');
    const index = attempt.questions.findIndex((item) => item.id === q.id);
    const sectionIndex = sectionQuestions.findIndex((item) => item.id === q.id);
    const answer = attempt.answers[q.id];
    $('exam-question-card').innerHTML = `
      <div class="question-kicker"><span>QUESTION ${String(sectionIndex + 1).padStart(2, '0')} <span style="font-weight:400">/ ${sectionQuestions.length}</span></span><span class="section-tag">${esc(activeSection)}</span></div>
      <h2>${esc(q.prompt)}</h2>
      <div class="choice-list">${q.options.map((option, optionIndex) => `<label class="choice-option ${answer === optionIndex ? 'selected' : ''}"><input type="radio" name="exam-answer" value="${optionIndex}" ${answer === optionIndex ? 'checked' : ''}><span class="choice-letter">${String.fromCharCode(65 + optionIndex)}</span><span class="choice-text">${esc(option)}</span></label>`).join('')}</div>
      ${answer !== undefined && answer !== null ? '<button class="clear-response" type="button">Clear response</button>' : ''}`;
    $('exam-question-card').querySelectorAll('input[name=exam-answer]').forEach((input) => input.addEventListener('change', () => {
      attempt.answers[q.id] = Number(input.value); persistAttempt(); renderExam();
    }));
    $('exam-question-card').querySelector('.clear-response')?.addEventListener('click', () => {
      attempt.answers[q.id] = null; persistAttempt(); renderExam();
    });
    $('progress-text').textContent = `${answeredCount()} of ${attempt.questions.length} answered`;
    $('progress-fill').style.width = `${(answeredCount() / attempt.questions.length) * 100}%`;
    $('previous-question').disabled = attempt.sectionTimed ? sectionIndex === 0 : index === 0;
    if (attempt.sectionTimed && sectionIndex === sectionQuestions.length - 1 && attempt.activeSectionIndex < sections.length - 1) {
      $('next-question').innerHTML = 'Next section <span aria-hidden="true">→</span>';
    } else if ((!attempt.sectionTimed && index === attempt.questions.length - 1) || (attempt.sectionTimed && sectionIndex === sectionQuestions.length - 1)) {
      $('next-question').innerHTML = 'Finish <span aria-hidden="true">→</span>';
    } else $('next-question').innerHTML = 'Next <span aria-hidden="true">→</span>';
    const flagged = attempt.flagged.includes(q.id);
    $('flag-question').classList.toggle('is-flagged', flagged);
    $('flag-question').querySelector('span').textContent = flagged ? 'Marked for review' : 'Mark for review';
    persistAttempt();
  }
  function moveRelative(delta) {
    const questions = currentAttemptQuestions();
    const index = questions.findIndex((q) => q.id === currentQuestionId);
    if (attempt.sectionTimed) {
      const current = questions[index];
      const sectionQuestions = questions.filter((question) => questionSection(question) === questionSection(current));
      const sectionIndex = sectionQuestions.findIndex((question) => question.id === currentQuestionId);
      const next = sectionQuestions[sectionIndex + delta];
      if (next) { currentQuestionId = next.id; attempt.currentQuestionId = next.id; persistAttempt(); renderExam(); return; }
      if (delta < 0) return;
      const unanswered = sectionQuestions.filter((question) => !Object.hasOwn(attempt.answers, question.id) || attempt.answers[question.id] === null).length;
      if (unanswered && !confirm(`End this section early? ${unanswered} ${unanswered === 1 ? 'question is' : 'questions are'} still unanswered.`)) return;
      if (attempt.activeSectionIndex < attempt.sections.length - 1) advanceSection(false);
      else requestSubmit();
      return;
    }
    const next = questions[index + delta];
    if (next) { currentQuestionId = next.id; attempt.currentQuestionId = next.id; persistAttempt(); renderExam(); }
    else if (delta > 0) requestSubmit();
  }
  function jumpToSection(section) {
    if (attempt.sectionTimed && section !== attempt.sections[attempt.activeSectionIndex]) return;
    const target = currentAttemptQuestions().find((q) => questionSection(q) === section);
    if (target) { currentQuestionId = target.id; attempt.currentQuestionId = target.id; persistAttempt(); renderExam(); }
  }
  function toggleFlag() {
    const list = attempt.flagged; const index = list.indexOf(currentQuestionId);
    if (index >= 0) list.splice(index, 1); else list.push(currentQuestionId);
    persistAttempt(); renderExam();
  }
  function requestSubmit() {
    const unanswered = attempt.questions.length - answeredCount();
    $('submit-summary').textContent = unanswered ? `${unanswered} ${unanswered === 1 ? 'question is' : 'questions are'} unanswered. You can still go back, or submit now.` : 'All questions have an answer. You can still go back, or submit now.';
    $('submit-dialog').showModal();
  }
  function calculateResults() {
    const counts = { correct: 0, wrong: 0, unanswered: 0 };
    const results = attempt.questions.map((q) => {
      const answer = Object.hasOwn(attempt.answers, q.id) ? attempt.answers[q.id] : null;
      const outcome = answer === null ? 'unanswered' : answer === q.answerIndex ? 'correct' : 'wrong';
      counts[outcome]++;
      return { question: q, answer, outcome };
    });
    const score = round2(counts.correct * attempt.correctMarks - counts.wrong * attempt.wrongMarks);
    return { counts, results, score };
  }
  function finishTest(auto = false) {
    if (!attempt || attempt.status !== 'running') return;
    attempt.status = 'complete'; attempt.completedAt = Date.now(); attempt.autoSubmitted = auto;
    persistAttempt(); clearInterval(tickTimer);
    if ($('submit-dialog').open) $('submit-dialog').close();
    const result = calculateResults(); renderResults(result); showView('result');
  }
  function renderResults(result = calculateResults()) {
    const percent = attempt.questions.length ? round2((result.counts.correct / attempt.questions.length) * 100) : 0;
    const sections = attempt.sections || [...new Set(attempt.questions.map(questionSection))];
    const sectionBlocks = sections.map((section) => {
      const entries = result.results.filter((item) => questionSection(item.question) === section);
      const right = entries.filter((item) => item.outcome === 'correct').length;
      const wrong = entries.filter((item) => item.outcome === 'wrong').length;
      const blank = entries.filter((item) => item.outcome === 'unanswered').length;
      const score = round2(right * attempt.correctMarks - wrong * attempt.wrongMarks);
      return `<section class="result-section"><div class="result-section-heading"><h2>${esc(section)}</h2><span>${numberText(score)} points</span></div><div class="result-section-stats"><span><strong>${right}</strong> correct</span><span><strong>${wrong}</strong> wrong</span><span><strong>${blank}</strong> unanswered</span></div>${entries.map((item, i) => {
        const q = item.question; const chosen = item.answer === null ? 'No answer' : `${String.fromCharCode(65 + item.answer)}. ${q.options[item.answer]}`;
        const correctAnswer = `${String.fromCharCode(65 + q.answerIndex)}. ${q.options[q.answerIndex]}`;
        return `<article class="review-question"><div class="review-question-title">${i + 1}. ${esc(q.prompt)}</div><div class="review-answer-line ${item.outcome === 'correct' ? 'answer-good' : item.outcome === 'wrong' ? 'answer-bad' : ''}">Your answer: <strong>${esc(chosen)}</strong></div>${item.outcome !== 'correct' ? `<div class="review-answer-line answer-good">Correct answer: <strong>${esc(correctAnswer)}</strong></div>` : ''}${q.explanation ? `<div class="review-explanation">${esc(q.explanation)}</div>` : ''}</article>`;
      }).join('')}</section>`;
    }).join('');
    const elapsedMinutes = Math.max(1, Math.round(((attempt.completedAt || Date.now()) - attempt.startedAt) / 60_000));
    $('result-content').innerHTML = `
      <div class="result-hero"><div class="result-check">✓</div><p class="eyebrow">${attempt.autoSubmitted ? 'TIME IS UP' : 'TEST COMPLETE'}</p><h1>${esc(attempt.title)}</h1><p>${attempt.autoSubmitted ? 'Your answers were submitted automatically.' : 'You submitted your mock test.'} · ${elapsedMinutes} min</p></div>
      <div class="score-panel"><div class="score-main"><strong>${numberText(result.score)}</strong><span>Score out of ${numberText(attempt.questions.length * attempt.correctMarks)} possible · ${numberText(percent)}% correct</span></div><div class="score-divider"></div><div class="score-breakdown"><div><strong class="correct">${result.counts.correct}</strong><span>Correct</span></div><div><strong class="incorrect">${result.counts.wrong}</strong><span>Wrong</span></div><div><strong class="unanswered">${result.counts.unanswered}</strong><span>Unanswered</span></div></div></div>
      ${sectionBlocks}<div class="result-actions"><button class="button button-secondary" id="review-setup" type="button">Back to setup</button><button class="button button-primary" id="retry-test" type="button">Try again <span aria-hidden="true">→</span></button></div>`;
    $('review-setup').addEventListener('click', () => { attempt = null; persistAttempt(); showView('setup'); hydrateSettings(); });
    $('retry-test').addEventListener('click', () => { attempt = null; persistAttempt(); startTest(); });
  }
  function renameSection(oldName, newName) {
    newName = newName.trim(); if (!newName || oldName === newName) { renderBank(); return; }
    if (sectionsFrom().some((section) => section === newName)) { toast('That section name already exists.'); renderBank(); return; }
    data.questions.forEach((q) => { if (q.section === oldName) q.section = newName; });
    if (Object.hasOwn(data.sectionTimes, oldName)) { data.sectionTimes[newName] = data.sectionTimes[oldName]; delete data.sectionTimes[oldName]; }
    data.sectionOrder = sectionsFrom(data.questions, data.sectionOrder.map((s) => s === oldName ? newName : s));
    persist(); renderBank();
  }
  function moveSection(section, direction) {
    const sections = sectionsFrom(); const index = sections.indexOf(section); const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]]; data.sectionOrder = sections; persist(); renderBank();
  }

  // Settings and question authoring
  ['test-title', 'duration', 'correct-marks', 'wrong-marks'].forEach((idName) => $(idName).addEventListener('change', saveSettings));
  $('test-title').addEventListener('input', () => { data.title = $('test-title').value.trim() || 'My mock test'; persist(); updateOverview(); });
  ['start-test', 'start-test-mobile'].forEach((idName) => $(idName).addEventListener('click', startTest));
  $('add-question-toggle').addEventListener('click', () => openEditor());
  $('close-editor').addEventListener('click', () => $('question-editor').classList.add('hidden'));
  $('cancel-question').addEventListener('click', () => $('question-editor').classList.add('hidden'));
  $('add-option').addEventListener('click', () => addOptionRow());
  $('question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const rows = [...$('option-editor-list').children];
    const answerIndex = rows.findIndex((row) => row.querySelector('input[type=radio]').checked);
    const question = { id: $('editing-id').value || id(), section: $('question-section').value.trim() || 'General', prompt: $('question-prompt').value.trim(), options: rows.map((row) => row.querySelector('input[type=text]').value.trim()), answerIndex: answerIndex < 0 ? 0 : answerIndex, explanation: $('question-explanation').value.trim() };
    if (question.options.length < 2 || question.options.some((option) => !option)) { toast('Fill in at least two options.'); return; }
    const old = data.questions.findIndex((item) => item.id === question.id);
    if (old >= 0) data.questions[old] = question; else data.questions.push(question);
    data.sectionOrder = sectionsFrom(data.questions, data.sectionOrder);
    persist(); $('question-editor').classList.add('hidden'); renderBank(); toast(old >= 0 ? 'Question updated.' : 'Question added.');
  });
  $('question-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { importQuestions(JSON.parse(await file.text())); }
    catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : (error.message || 'Could not import that question file.')); }
    event.target.value = '';
  });
  $('question-filter').addEventListener('change', renderQuestionList);
  $('section-list').addEventListener('change', (event) => {
    const input = event.target.closest('[data-section-name]'); if (input) renameSection(input.dataset.sectionName, input.value);
    const timeInput = event.target.closest('[data-section-time]');
    if (timeInput) {
      const section = timeInput.dataset.sectionTime;
      const rawMinutes = timeInput.value.trim();
      if (!rawMinutes) delete data.sectionTimes[section];
      else {
        const minutes = Number(rawMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) { toast('Section time must be a whole number from 1 to 600 minutes.'); renderBank(); return; }
        data.sectionTimes[section] = minutes;
      }
      persist(); updateOverview();
    }
  });
  $('section-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-move-section]'); if (button) moveSection(button.dataset.section, button.dataset.moveSection);
  });
  $('question-list').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-question]'); const remove = event.target.closest('[data-delete-question]');
    if (edit) { const question = data.questions.find((q) => q.id === edit.dataset.editQuestion); if (question) openEditor(question); }
    if (remove && confirm('Remove this question from your bank?')) { data.questions = data.questions.filter((q) => q.id !== remove.dataset.deleteQuestion); data.sectionOrder = sectionsFrom(data.questions, data.sectionOrder); data.sectionTimes = Object.fromEntries(Object.entries(data.sectionTimes).filter(([section]) => data.questions.some((question) => question.section === section))); persist(); renderBank(); toast('Question removed.'); }
  });
  $('load-sample').addEventListener('click', () => {
    try { importQuestions(example); } catch (error) { toast(error.message); }
  });
  $('reset-all').addEventListener('click', () => {
    if (!confirm('Clear the saved question bank, settings, and current test from this browser?')) return;
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ATTEMPT_KEY); } catch { /* Continue with an in-memory reset if storage is unavailable. */ }
    clearInterval(tickTimer); data = structuredClone(defaults); attempt = null; hydrateSettings(); showView('setup'); toast('Saved data cleared.');
  });
  $('theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
  $('brand-home').addEventListener('click', (event) => { event.preventDefault(); if (attempt?.status === 'running') { enterExam(); } else { showView('setup'); } });

  // Test taking
  $('previous-question').addEventListener('click', () => moveRelative(-1));
  $('next-question').addEventListener('click', () => moveRelative(1));
  $('flag-question').addEventListener('click', toggleFlag);
  $('submit-test').addEventListener('click', requestSubmit);
  $('confirm-submit').addEventListener('click', (event) => { event.preventDefault(); $('submit-dialog').close(); finishTest(false); });
  $('leave-test').addEventListener('click', () => {
    if (!attempt) { showView('setup'); return; }
    const leave = confirm('Your answers and timer will keep running while you return to setup. Leave the test?');
    if (leave) showView('setup');
  });
  $('exam-section-nav').addEventListener('click', (event) => { const button = event.target.closest('[data-jump-section]'); if (button) jumpToSection(button.dataset.jumpSection); });
  $('question-map').addEventListener('click', (event) => { const button = event.target.closest('[data-jump-question]'); if (button) { currentQuestionId = button.dataset.jumpQuestion; attempt.currentQuestionId = currentQuestionId; persistAttempt(); renderExam(); } });
  window.addEventListener('keydown', (event) => {
    if (views.exam.classList.contains('hidden') || event.target.matches('input,textarea,select,button')) return;
    if (event.key === 'ArrowLeft') moveRelative(-1);
    if (event.key === 'ArrowRight') moveRelative(1);
  });

  applyTheme(getSavedTheme());
  hydrateSettings();
  if (attempt?.status === 'running') enterExam();
  else if (attempt?.status === 'complete') { renderResults(); showView('result'); }
  else showView('setup');
})();
