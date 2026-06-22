import { useMemo, useState } from 'react';
import { quizBank, studyModules } from './data/reatiControPersona.js';

const REPORTED_KEY = 'momi.penale.reportedQuestions.v2';
const HISTORY_KEY = 'momi.penale.quizHistory.v2';
const SESSION_SIZE = 20;

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function prepareQuestion(question) {
  return {
    ...question,
    options: shuffle(question.options),
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSession(reportedIds) {
  const blocked = new Set(reportedIds);
  const available = quizBank.filter((question) => !blocked.has(question.id));

  return {
    id: createId(),
    startedAt: new Date().toISOString(),
    questions: shuffle(available).slice(0, SESSION_SIZE).map(prepareQuestion),
    currentIndex: 0,
    answers: {},
    completed: false,
  };
}

function ScoreLogo() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="brand-mark">
      <path d="M48 12v64" />
      <path d="M30 76h36" />
      <path d="M38 84h20" />
      <path d="M20 28h56" />
      <path d="M48 20 26 36" />
      <path d="M48 20 70 36" />
      <path d="M26 36 14 60h24L26 36Z" />
      <path d="M70 36 58 60h24L70 36Z" />
      <path d="M14 60c3 6 21 6 24 0" />
      <path d="M58 60c3 6 21 6 24 0" />
    </svg>
  );
}

function App() {
  const [view, setView] = useState('menu');
  const [reportedIds, setReportedIds] = useState(() => readJson(REPORTED_KEY, []));
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, []));
  const [session, setSession] = useState(null);

  const moduleTitle = studyModules[0]?.title ?? 'Diritto penale';

  const currentQuestion = session?.questions[session.currentIndex];
  const answeredCount = session ? Object.keys(session.answers).length : 0;
  const score = useMemo(() => {
    if (!session) return 0;
    return session.questions.reduce((total, question) => {
      return total + (session.answers[question.id] === question.answer ? 1 : 0);
    }, 0);
  }, [session]);

  function startQuiz() {
    const nextSession = createSession(reportedIds);
    setSession(nextSession);
    setView('quiz');
  }

  function chooseAnswer(option) {
    if (!currentQuestion) return;
    setSession((previous) => {
      if (!previous || previous.answers[currentQuestion.id]) return previous;
      return {
        ...previous,
        answers: {
          ...previous.answers,
          [currentQuestion.id]: option,
        },
      };
    });
  }

  function finishSession(nextSession) {
    const result = {
      id: nextSession.id,
      date: new Date().toISOString(),
      score: nextSession.questions.reduce((total, question) => {
        return total + (nextSession.answers[question.id] === question.answer ? 1 : 0);
      }, 0),
      total: nextSession.questions.length,
    };
    const nextHistory = [result, ...history].slice(0, 20);
    setHistory(nextHistory);
    writeJson(HISTORY_KEY, nextHistory);
    setSession(nextSession);
  }

  function goNext() {
    if (!session) return;
    if (session.currentIndex < session.questions.length - 1) {
      setSession({ ...session, currentIndex: session.currentIndex + 1 });
      return;
    }

    finishSession({ ...session, completed: true });
  }

  function reportCurrentQuestion() {
    if (!currentQuestion || !session) return;

    const nextReportedIds = Array.from(new Set([...reportedIds, currentQuestion.id]));
    setReportedIds(nextReportedIds);
    writeJson(REPORTED_KEY, nextReportedIds);

    setSession((previous) => {
      if (!previous) return previous;

      const nextQuestions = previous.questions.filter((question) => question.id !== currentQuestion.id);
      const alreadyInSession = new Set(nextQuestions.map((question) => question.id));
      const blocked = new Set(nextReportedIds);
      const replacement = shuffle(
        quizBank.filter((question) => !blocked.has(question.id) && !alreadyInSession.has(question.id)),
      ).map(prepareQuestion)[0];

      const refilledQuestions =
        replacement && nextQuestions.length < SESSION_SIZE ? [...nextQuestions, replacement] : nextQuestions;

      const nextAnswers = { ...previous.answers };
      delete nextAnswers[currentQuestion.id];

      if (refilledQuestions.length === 0) {
        return {
          ...previous,
          questions: [],
          answers: nextAnswers,
          currentIndex: 0,
          completed: true,
        };
      }

      return {
        ...previous,
        questions: refilledQuestions,
        answers: nextAnswers,
        currentIndex: Math.min(previous.currentIndex, refilledQuestions.length - 1),
      };
    });
  }

  function backToMenu() {
    setView('menu');
    setSession(null);
  }

  if (view === 'quiz' && session) {
    if (session.completed || !currentQuestion) {
      return (
        <div className="app-shell">
          <header className="topbar compact">
            <button className="ghost-button" type="button" onClick={backToMenu}>
              Menu
            </button>
            <span>{moduleTitle}</span>
          </header>

          <main className="result-panel">
            <p className="eyebrow">Sessione completata</p>
            <h1>
              {score}/{session.questions.length}
            </h1>
            <p className="result-copy">
              Domande segnalate escluse dalle prossime sessioni: {reportedIds.length}.
            </p>
            <div className="actions-row">
              <button type="button" className="primary-button" onClick={startQuiz}>
                Nuova sessione
              </button>
              <button type="button" className="secondary-button" onClick={backToMenu}>
                Torna al menu
              </button>
            </div>
          </main>
        </div>
      );
    }

    const selectedAnswer = session.answers[currentQuestion.id];
    const isCorrect = selectedAnswer === currentQuestion.answer;
    const canAdvance = Boolean(selectedAnswer);

    return (
      <div className="app-shell">
        <header className="topbar compact">
          <button className="ghost-button" type="button" onClick={backToMenu}>
            Menu
          </button>
          <span>
            {session.currentIndex + 1}/{session.questions.length}
          </span>
        </header>

        <main className="quiz-layout">
          <section className="question-bubble">
            <p className="eyebrow">{currentQuestion.topic}</p>
            <h1>{currentQuestion.question}</h1>
            <button
              className="report-question"
              type="button"
              aria-label="Segnala questa domanda"
              title="Segnala questa domanda"
              onClick={reportCurrentQuestion}
            >
              x
            </button>
          </section>

          <section className="answer-list" aria-label="Risposte">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const isAnswer = currentQuestion.answer === option;
              const stateClass = selectedAnswer
                ? isAnswer
                  ? 'correct'
                  : isSelected
                    ? 'wrong'
                    : 'muted'
                : '';

              return (
                <button
                  key={option}
                  className={`answer-option ${stateClass}`}
                  type="button"
                  disabled={Boolean(selectedAnswer)}
                  onClick={() => chooseAnswer(option)}
                >
                  {option}
                </button>
              );
            })}
          </section>

          <footer className="quiz-footer">
            <div>
              <span className="small-label">Punteggio</span>
              <strong>
                {score}/{answeredCount}
              </strong>
            </div>
            {selectedAnswer && (
              <p className={isCorrect ? 'feedback good' : 'feedback bad'}>
                {isCorrect ? 'Corretta' : `Corretta: ${currentQuestion.answer}`}
              </p>
            )}
            <button type="button" className="primary-button" disabled={!canAdvance} onClick={goNext}>
              {session.currentIndex === session.questions.length - 1 ? 'Chiudi' : 'Avanti'}
            </button>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="brand-header">
        <ScoreLogo />
        <div className="brand-copy">
          <h1>La palestra di Momi</h1>
          <p>per diritto penale</p>
        </div>
      </header>

      <main className="menu-layout">
        <section className="tile-grid" aria-label="Menu principale">
          <button type="button" className="menu-tile active" onClick={startQuiz}>
            <span>QUIZ</span>
          </button>
          <button type="button" className="menu-tile">
            <span>PLACEHOLDER 2</span>
          </button>
          <button type="button" className="menu-tile">
            <span>PLACEHOLDER 3</span>
          </button>
          <button type="button" className="menu-tile">
            <span>PLACEHOLDER 4</span>
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
