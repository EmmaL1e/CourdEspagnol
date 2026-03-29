class SpanishApp {
    constructor() {
        this.currentTheme = null;
        this.currentMode = null; // 'quiz' or 'revision'
        this.sessionPool = [];
        this.currentQuestionIndex = 0;
        this.wrongQueue = [];
        this.successStreaks = {}; // questionId -> streak (0, 1, 2)
        this.isAllThemes = false;
        
        // DOM Elements
        this.screens = {
            home: document.getElementById('home-screen'),
            quiz: document.getElementById('quiz-screen'),
            revision: document.getElementById('revision-screen'),
            verbModules: document.getElementById('verb-modules-screen'),
            method: document.getElementById('method-screen')
        };
        this.themeGrid = document.getElementById('theme-grid');
        this.modeOverlay = document.getElementById('mode-overlay');
        this.quizCard = document.getElementById('quiz-card');
        this.quizInput = document.getElementById('quiz-input');
        this.validateBtn = document.getElementById('validate-btn');
        this.passBtn = document.getElementById('pass-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.feedback = document.getElementById('feedback');
        
        this.init();
    }

    init() {
        this.renderThemeCards();
        this.setupEventListeners();
    }

    renderThemeCards() {
        const grid = this.themeGrid;
        themesData.forEach(theme => {
            const card = document.createElement('div');
            card.className = 'theme-card';
            card.innerHTML = `
                <div class="icon">${theme.icon}</div>
                <h2>${theme.nameEs}</h2>
                <p>${theme.nameFr}</p>
            `;
            card.onclick = () => this.showModeSelection(theme);
            grid.appendChild(card);
        });

        document.getElementById('all-themes-btn').onclick = () => {
            this.isAllThemes = true;
            this.showModeSelection({ id: 'all', nameEs: 'Todos los temas', nameFr: 'Tous les thèmes' });
        };
    }

    setupEventListeners() {
        this.validateBtn.onclick = () => this.checkAnswer();
        this.passBtn.onclick = () => this.passQuestion();
        this.nextBtn.onclick = () => this.nextQuestion();
        this.quizInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.checkAnswer();
        };
    }

    showModeSelection(theme) {
        this.currentTheme = theme;
        this.modeOverlay.style.display = 'flex';
        document.getElementById('modal-theme-name').innerText = theme.nameEs;
        document.getElementById('modal-theme-desc').innerText = theme.nameFr;

        const stdBtns = document.getElementById('standard-mode-btns');
        const verbBtns = document.getElementById('verb-mode-btns');

        if (theme.id === 'verbs') {
            stdBtns.classList.add('hidden');
            verbBtns.classList.remove('hidden');
        } else {
            stdBtns.classList.remove('hidden');
            verbBtns.classList.add('hidden');
        }
    }

    hideModal() {
        this.modeOverlay.style.display = 'none';
    }

    showHomeScreen() {
        this.isAllThemes = false;
        this.switchScreen('home');
        this.hideModal();
    }

    switchScreen(id) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[id].classList.add('active');
    }

    startRevision() {
        this.currentMode = 'revision';
        this.hideModal();
        this.switchScreen('revision');
        this.renderRevision();
    }

    startVerbMethod() {
        this.hideModal();
        this.switchScreen('method');
        this.renderVerbMethod();
    }

    showVerbModules() {
        this.hideModal();
        this.switchScreen('verbModules');
    }

    renderVerbMethod() {
        const content = document.getElementById('method-content');
        content.innerHTML = '';
        verbSpecialData.methods.forEach(method => {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.innerHTML = `
                <div class="method-header">
                    <h3>${method.title}</h3>
                </div>
                <div class="method-body">
                    <p>${method.content}</p>
                </div>
            `;
            content.appendChild(card);
        });
    }

    renderRevision() {
        const content = document.getElementById('revision-content');
        document.getElementById('revision-title').innerText = this.currentTheme.nameEs + " - Révisions";
        content.innerHTML = '';

        const questions = (this.isAllThemes || this.currentTheme.id === 'all') 
            ? themesData.flatMap(t => t.questions)
            : themesData.find(t => t.id === this.currentTheme.id).questions;

        // Group by category
        const groups = {};
        questions.forEach(q => {
            if (!groups[q.cat]) groups[q.cat] = [];
            groups[q.cat].push(q);
        });

        for (const [cat, items] of Object.entries(groups)) {
            const section = document.createElement('div');
            section.className = 'subtheme-section fade-in';
            section.innerHTML = `<h3 class="subtheme-title">${cat}</h3>`;
            
            const grid = document.createElement('div');
            grid.className = 'revision-grid';
            
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'flashcard';
                card.innerHTML = `
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <span class="lang">Français</span>
                            <div class="word">${item.q}</div>
                        </div>
                        <div class="flashcard-back">
                            <span class="lang">Español</span>
                            <div class="word">${item.a}</div>
                            <div class="mnemonic" style="font-size: 0.8rem; margin-top: 1rem;">${item.m}</div>
                        </div>
                    </div>
                `;
                card.onclick = () => card.classList.toggle('flipped');
                grid.appendChild(card);
            });
            section.appendChild(grid);
            content.appendChild(section);
        }
    }

    startQuiz() {
        this.currentMode = 'quiz';
        this.currentVerbModule = null;
        this.hideModal();
        this.switchScreen('quiz');
        
        // Prepare questions
        const allQuestions = (this.isAllThemes || this.currentTheme.id === 'all') 
            ? themesData.flatMap(t => t.questions)
            : themesData.find(t => t.id === this.currentTheme.id).questions;
        
        this.initQuizSession(allQuestions);
    }

    startVerbFillIn(module) {
        this.currentMode = 'quiz';
        this.currentVerbModule = module;
        this.switchScreen('quiz');
        
        const allQuestions = verbSpecialData.fillIn[module];
        this.initQuizSession(allQuestions);
    }

    initQuizSession(questions) {
        // Select 10 random
        this.sessionPool = this.getRandomSubset(questions, 10).map(q => ({
            ...q,
            id: Math.random().toString(36).substr(2, 9),
            streak: 0,
            completed: false
        }));

        this.currentQuestionIndex = 0;
        this.successStreaks = {};
        this.wrongQueue = [];
        this.loadQuestion();
    }

    getRandomSubset(arr, n) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(n, arr.length));
    }

    loadQuestion() {
        this.quizInput.value = '';
        this.quizInput.disabled = false;
        this.quizInput.classList.remove('feedback-correct', 'feedback-wrong');
        this.feedback.style.display = 'none';
        this.validateBtn.classList.remove('hidden');
        this.passBtn.classList.remove('hidden');
        this.nextBtn.classList.add('hidden');
        
        const q = this.sessionPool[this.currentQuestionIndex];
        
        // Handle Fill-in-the-blank display
        if (q.q.includes('___')) {
            document.getElementById('question-text').innerHTML = q.q.replace('[', '<span class="verb-cue">').replace(']', '</span>');
        } else {
            document.getElementById('question-text').innerText = q.q;
        }
        
        document.getElementById('current-q-num').innerText = this.currentQuestionIndex + 1;
        
        const progress = (this.currentQuestionIndex / this.sessionPool.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progress}%`;
        document.getElementById('quiz-counter').innerText = `${this.currentQuestionIndex + 1}/${this.sessionPool.length}`;
        
        this.quizInput.focus();
    }

    checkAnswer() {
        const q = this.sessionPool[this.currentQuestionIndex];
        const userAnswer = this.quizInput.value.trim().toLowerCase();
        const correctAnswer = q.a.toLowerCase();
        
        if (userAnswer === correctAnswer) {
            this.handleSuccess(q);
        } else {
            this.handleFailure(q);
        }
    }

    passQuestion() {
        const q = this.sessionPool[this.currentQuestionIndex];
        this.handleFailure(q, true);
    }

    handleSuccess(q) {
        // Success logic: 
        // If streak was 0, set to 1. 
        // If streak was 1, set to 2 (completed).
        // If they failed before, they need to reach streak 2.
        
        if (q.streak === undefined) q.streak = 0;
        q.streak++;
        
        this.showFeedback(true, q);
        
        if (q.streak >= 2) {
            q.completed = true;
        } else {
            // Need to repeat once more
            this.wrongQueue.push(q); 
        }
    }

    handleFailure(q, passed = false) {
        q.streak = 0; // Reset streak
        this.showFeedback(false, q, passed);
        this.wrongQueue.push(q);
    }

    showFeedback(isCorrect, q, passed = false) {
        this.feedback.style.display = 'block';
        this.feedback.className = 'feedback-container ' + (isCorrect ? 'feedback-correct' : 'feedback-wrong');
        
        const msg = document.getElementById('feedback-message');
        const mnem = document.getElementById('mnemonic-text');
        
        if (isCorrect) {
            msg.innerHTML = `<strong>¡Estupendo!</strong> - La réponse est bien <em>${q.a}</em>`;
            mnem.innerText = "";
        } else {
            msg.innerHTML = `<strong>${passed ? 'Passé' : 'Oups !'}</strong> - La réponse était <em>${q.a}</em>`;
            mnem.innerText = "Moyen mnémotechnique : " + q.m;
        }
        
        this.quizInput.disabled = true;
        this.validateBtn.classList.add('hidden');
        this.passBtn.classList.add('hidden');
        this.nextBtn.classList.remove('hidden');
        this.nextBtn.focus();
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        
        if (this.currentQuestionIndex < this.sessionPool.length) {
            this.loadQuestion();
        } else {
            this.finishSeries();
        }
    }

    finishSeries() {
        const itemsToRepeat = this.sessionPool.filter(q => !q.completed);
        
        let allQuestions;
        if (this.currentVerbModule) {
            allQuestions = verbSpecialData.fillIn[this.currentVerbModule];
        } else {
            allQuestions = this.isAllThemes 
                ? themesData.flatMap(t => t.questions)
                : themesData.find(t => t.id === this.currentTheme.id).questions;
        }
            
        const usedAnswers = new Set(this.sessionPool.map(q => q.a));
        const availableNew = allQuestions.filter(q => !usedAnswers.has(q.a));
        
        const nextPoolSize = 10;
        const newSubsetCount = Math.max(0, nextPoolSize - itemsToRepeat.length);
        const newSubset = this.getRandomSubset(availableNew, newSubsetCount);
        
        const nextPool = [
            ...itemsToRepeat,
            ...newSubset.map(q => ({...q, id: Math.random().toString(36).substr(2, 9), streak: 0, completed: false}))
        ];

        if (nextPool.length === 0) {
            alert("¡Muy bien! Vous avez maîtrisé tout le vocabulaire de cette section.");
            this.showHomeScreen();
            return;
        }

        // Show a quick transition message
        this.quizCard.innerHTML = `
            <div class="fade-in">
                <h2 style="font-size: 3rem; margin-bottom: 1rem;">¡Excelente!</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Série terminée.</p>
                <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
                    <p>Questions à revoir : ${itemsToRepeat.length}</p>
                    <p>Nouvelles questions : ${newSubset.length}</p>
                </div>
                <button class="btn btn-primary" id="continue-btn" style="width: 100%;">Continuer la prochaine série</button>
            </div>
        `;
        
        document.getElementById('continue-btn').onclick = () => {
            this.sessionPool = nextPool;
            this.currentQuestionIndex = 0;
            this.restoreQuizCard();
            this.loadQuestion();
        };
    }

    restoreQuizCard() {
        this.quizCard.innerHTML = `
            <div class="question-label">Question <span id="current-q-num">1</span>/10</div>
            <div class="question-text" id="question-text">Pistolet</div>
            
            <div class="input-group">
                <input type="text" autocomplete="off" class="quiz-input" id="quiz-input" placeholder="Réponse en espagnol...">
            </div>

            <div id="feedback" class="feedback-container">
                <div id="feedback-message"></div>
                <div id="mnemonic-text" class="mnemonic"></div>
            </div>

            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
                <button class="btn btn-secondary" id="pass-btn">Passer la question</button>
                <button class="btn btn-primary" id="validate-btn">Valider</button>
                <button class="btn btn-primary hidden" id="next-btn">Question suivante</button>
            </div>
        `;
        // Re-bind elements since they were destroyed
        this.quizInput = document.getElementById('quiz-input');
        this.validateBtn = document.getElementById('validate-btn');
        this.passBtn = document.getElementById('pass-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.feedback = document.getElementById('feedback');
        this.setupEventListeners();
    }
}

// Initialize App
const app = new SpanishApp();
