/**
 * CampusCash AI - Smart Student Finance Companion
 * Data layer backed by a custom Node.js/Express API.
 *
 * Expected REST endpoints (base = API_BASE_URL):
 *   GET    /user            -> { name, stayType, pocketMoney, monthlyBudget, semesterBudget, semesterEnd, semesterStart }
 *   PUT    /user            -> update user profile (body = full user object)
 *   GET    /transactions    -> [ { id, category, icon, amount, note, date, timestamp } ]
 *   POST   /transactions    -> create one transaction (body = transaction), returns saved transaction
 *   PUT    /transactions/:id-> update one transaction
 *   DELETE /transactions/:id-> delete one transaction
 *   PUT    /transactions    -> replace all transactions (used by import)
 *   GET    /savings         -> { name, target, saved, startDate }
 *   PUT    /savings         -> update savings
 *   GET    /reminders       -> [ reminder ]
 *   POST   /reminders       -> create reminder, returns saved reminder
 *   DELETE /reminders/:id   -> delete reminder
 *   PUT    /reminders       -> replace all reminders (used by import)
 *   GET    /events          -> [ event ]
 *   POST   /events          -> create event, returns saved event
 *   DELETE /events/:id      -> delete event
 *   PUT    /events          -> replace all events (used by import)
 *   GET    /exam            -> { enabled, budget, expenses: [] }
 *   PUT    /exam            -> update exam state
 *   GET    /settings        -> { theme, notifications, aiInsights, autoSave }
 *   PUT    /settings        -> update settings
 *   DELETE /reset           -> wipe all server-side data
 */

const API_BASE_URL = "http://localhost:5000/api";

// ============================================
// API CLIENT
// ============================================

const Api = {
    async request(path, options = {}) {
        const url = `${API_BASE_URL}${path}`;
        let res;
        try {
            res = await fetch(url, {
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                ...options
            });
        } catch (networkErr) {
            throw new Error(`Cannot reach server at ${API_BASE_URL}. Is your API running? (${networkErr.message})`);
        }

        if (!res.ok) {
            let detail = res.statusText;
            try { detail = (await res.json()).message || detail; } catch (_) { try { detail = await res.text(); } catch (_) {} }
            throw new Error(`Request failed (${res.status}): ${detail}`);
        }

        // 204 No Content
        if (res.status === 204) return null;
        return await res.json();
    },

    // User / balance
    getUser() { return this.request('/user'); },
    updateUser(user) { return this.request('/user', { method: 'PUT', body: JSON.stringify(user) }); },

    // Transactions (expenses)
    getTransactions() { return this.request('/transactions'); },
    addTransaction(tx) { return this.request('/transactions', { method: 'POST', body: JSON.stringify(tx) }); },
    updateTransaction(id, tx) { return this.request(`/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(tx) }); },
    deleteTransaction(id) { return this.request(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    replaceTransactions(list) { return this.request('/transactions', { method: 'PUT', body: JSON.stringify(list) }); },

    // Savings
    getSavings() { return this.request('/savings'); },
    updateSavings(savings) { return this.request('/savings', { method: 'PUT', body: JSON.stringify(savings) }); },

    // Reminders
    getReminders() { return this.request('/reminders'); },
    addReminder(reminder) { return this.request('/reminders', { method: 'POST', body: JSON.stringify(reminder) }); },
    deleteReminder(id) { return this.request(`/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    replaceReminders(list) { return this.request('/reminders', { method: 'PUT', body: JSON.stringify(list) }); },

    // Events
    getEvents() { return this.request('/events'); },
    addEvent(event) { return this.request('/events', { method: 'POST', body: JSON.stringify(event) }); },
    deleteEvent(id) { return this.request(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    replaceEvents(list) { return this.request('/events', { method: 'PUT', body: JSON.stringify(list) }); },

    // Exam
    getExam() { return this.request('/exam'); },
    updateExam(exam) { return this.request('/exam', { method: 'PUT', body: JSON.stringify(exam) }); },

    // Settings
    getSettings() { return this.request('/settings'); },
    updateSettings(settings) { return this.request('/settings', { method: 'PUT', body: JSON.stringify(settings) }); },

    // Reset
    resetAll() { return this.request('/reset', { method: 'DELETE' }); }
};

function handleApiError(err, fallbackMsg = 'Something went wrong') {
    console.error(err);
    const msg = err && err.message ? err.message : fallbackMsg;
    alert(`${fallbackMsg}: ${msg}`);
    showNotification(msg, 'error');
}

// ============================================
// APP STATE
// ============================================

let appState = {
    user: null,
    expenses: [],
    savings: null,
    reminders: [],
    events: [],
    exam: null,
    settings: {
        theme: 'light',
        notifications: true
    },
    currentExpenseCategory: null,
    currentExpenseIcon: null,
    currentReminderType: null,
    currentEventType: null,
    currentExamCategory: null,
    currentEditSetting: null,
    setupListenersAttached: false,
    charts: {},
    dataLoaded: false
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount) {
    return '₹' + (amount || 0).toLocaleString('en-IN');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFullDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2 - d1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    await loadAllData();
    applyTheme();
    showSplash(() => {
        if (appState.user) {
            showMainApp();
        } else {
            showSetup();
        }
        setupEventListeners();
    });
}

function showSplash(callback) {
    const splash = document.getElementById('splash-screen');
    if (!splash) { callback(); return; }
    splash.style.display = 'flex';
    const bar = splash.querySelector('.splash-bar');
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
        splash.classList.add('splash-exit');
        setTimeout(() => {
            splash.style.display = 'none';
            callback();
        }, 600);
    }, 2200);
}

async function loadAllData() {
    try {
        const [user, expenses, savings, reminders, events, exam, settings] = await Promise.all([
            Api.getUser().catch(() => null),
            Api.getTransactions().catch(() => []),
            Api.getSavings().catch(() => null),
            Api.getReminders().catch(() => []),
            Api.getEvents().catch(() => []),
            Api.getExam().catch(() => null),
            Api.getSettings().catch(() => null)
        ]);

        appState.user = user;
        appState.expenses = Array.isArray(expenses) ? expenses : [];
        appState.savings = savings || { name: null, target: 0, saved: 0, startDate: null };
        appState.reminders = Array.isArray(reminders) ? reminders : [];
        appState.events = Array.isArray(events) ? events : [];
        appState.exam = exam || { enabled: false, budget: 0, expenses: [] };
        if (settings) appState.settings = settings;
        appState.dataLoaded = true;
    } catch (err) {
        appState.dataLoaded = false;
        handleApiError(err, 'Failed to load data from server');
    }
}

// ============================================
// SETUP WIZARD
// ============================================

function showSetup() {
    const setupEl = document.getElementById('setup-screen');
    const mainEl = document.getElementById('main-app');
    setupEl.classList.remove('hidden');
    setupEl.style.opacity = '0';
    mainEl.classList.add('hidden');
    document.getElementById('fab-add').style.display = 'none';
    requestAnimationFrame(() => {
        setupEl.style.transition = 'opacity 0.5s ease';
        setupEl.style.opacity = '1';
    });
    initSetupForm();
}

function initSetupForm() {
    let currentStep = 1;
    const totalSteps = 3;

    const nextBtn = document.getElementById('next-step');
    const prevBtn = document.getElementById('prev-step');
    const finishBtn = document.getElementById('finish-setup');
    const steps = document.querySelectorAll('.setup-step');
    const progressSteps = document.querySelectorAll('.progress-step');

    function updateStep(step) {
        steps.forEach(s => s.classList.remove('active'));
        steps[step - 1].classList.add('active');

        progressSteps.forEach((ps, i) => {
            ps.classList.remove('active', 'completed');
            if (i < step - 1) ps.classList.add('completed');
            if (i === step - 1) ps.classList.add('active');
        });

        prevBtn.style.display = step > 1 ? 'block' : 'none';
        nextBtn.style.display = step < totalSteps ? 'block' : 'none';
        finishBtn.style.display = step === totalSteps ? 'block' : 'none';
    }

    currentStep = 1;
    updateStep(1);

    if (!appState.setupListenersAttached) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (validateStep(currentStep)) {
                currentStep++;
                updateStep(currentStep);
            }
        });

        prevBtn.addEventListener('click', () => {
            currentStep--;
            updateStep(currentStep);
        });

        document.getElementById('setup-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateStep(3)) {
                completeSetup();
            }
        });

        document.querySelectorAll('.choice-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                document.getElementById('stay-type').value = card.dataset.value;
            });
        });

        document.querySelectorAll('.goal-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                document.querySelectorAll('.goal-preset').forEach(p => p.classList.remove('selected'));
                preset.classList.add('selected');

                if (preset.dataset.goal === 'custom') {
                    document.getElementById('custom-goal-inputs').classList.remove('hidden');
                } else {
                    document.getElementById('custom-goal-inputs').classList.add('hidden');
                    appState.savings.name = preset.dataset.goal;
                    appState.savings.target = parseInt(preset.dataset.amount);
                }
            });
        });

        appState.setupListenersAttached = true;
    }

    function showSetupError(msg) {
        let errEl = document.getElementById('setup-error-msg');
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.id = 'setup-error-msg';
            errEl.style.cssText = 'color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;font-size:0.875rem;margin-top:12px;animation:fadeIn 0.3s ease;';
            const form = document.getElementById('setup-form');
            form.insertBefore(errEl, form.firstChild);
        }
        errEl.textContent = msg;
        setTimeout(() => { if (errEl.parentNode) errEl.remove(); }, 3500);
    }

    function validateStep(step) {
        if (step === 1) {
            const name = document.getElementById('student-name').value.trim();
            const stay = document.getElementById('stay-type').value;
            if (!name) {
                showSetupError('Please enter your name');
                document.getElementById('student-name').focus();
                return false;
            }
            if (!stay) {
                showSetupError('Please select your accommodation type');
                return false;
            }
            return true;
        }

        if (step === 2) {
            const pocketMoney = document.getElementById('pocket-money').value;
            const monthlyBudget = document.getElementById('monthly-budget').value;
            const semesterBudget = document.getElementById('semester-budget').value;
            const semesterEnd = document.getElementById('semester-end').value;

            if (!pocketMoney || !monthlyBudget || !semesterBudget || !semesterEnd) {
                showSetupError('Please fill all budget fields');
                return false;
            }

            if (parseInt(monthlyBudget) > parseInt(pocketMoney)) {
                showSetupError('Monthly budget should not exceed pocket money');
                return false;
            }

            return true;
        }

        if (step === 3) {
            const selectedGoal = document.querySelector('.goal-preset.selected');
            if (selectedGoal && selectedGoal.dataset.goal === 'custom') {
                const goalName = document.getElementById('goal-name').value.trim();
                const goalAmount = document.getElementById('goal-amount').value;
                if (goalName && goalAmount) {
                    appState.savings.name = goalName;
                    appState.savings.target = parseInt(goalAmount);
                }
            }
            return true;
        }

        return true;
    }

    async function completeSetup() {
        appState.user = {
            name: document.getElementById('student-name').value.trim(),
            stayType: document.getElementById('stay-type').value,
            pocketMoney: parseInt(document.getElementById('pocket-money').value),
            monthlyBudget: parseInt(document.getElementById('monthly-budget').value),
            semesterBudget: parseInt(document.getElementById('semester-budget').value),
            semesterEnd: document.getElementById('semester-end').value,
            semesterStart: new Date().toISOString().split('T')[0]
        };

        appState.savings.startDate = new Date().toISOString().split('T')[0];

        try {
            await Promise.all([
                Api.updateUser(appState.user),
                Api.updateSavings(appState.savings),
                Api.updateSettings(appState.settings)
            ]);
            showMainApp();
            showNotification('Welcome to CampusCash AI! Let\'s manage your finances together.', 'success');
        } catch (err) {
            handleApiError(err, 'Failed to save your profile');
        }
    }
}

// ============================================
// MAIN APP
// ============================================

async function showMainApp() {
    document.getElementById('setup-screen').classList.add('hidden');
    const mainEl = document.getElementById('main-app');
    mainEl.classList.remove('hidden');
    mainEl.style.opacity = '0';
    requestAnimationFrame(() => {
        mainEl.style.transition = 'opacity 0.5s ease';
        mainEl.style.opacity = '1';
    });
    document.getElementById('fab-add').style.display = 'flex';
    updateUI();
    initCharts();
    navigateTo('dashboard');
    setTimeout(checkNotifications, 1500);
}

function updateUI() {
    if (!appState.user) return;

    document.getElementById('greeting-text').textContent = getGreeting() + ', ' + appState.user.name + '!';
    document.getElementById('greeting-name').textContent = 'Welcome back';

    document.getElementById('sidebar-name').textContent = appState.user.name;
    document.getElementById('user-avatar').textContent = appState.user.name.charAt(0).toUpperCase();

    document.getElementById('setting-name').textContent = appState.user.name;
    document.getElementById('setting-stay').textContent = appState.user.stayType === 'hosteller' ? 'Hosteller' : 'Day Scholar';
    document.getElementById('setting-pocket').textContent = formatCurrency(appState.user.pocketMoney);
    document.getElementById('setting-budget').textContent = formatCurrency(appState.user.monthlyBudget);
    document.getElementById('setting-semester').textContent = formatCurrency(appState.user.semesterBudget);
    document.getElementById('setting-semester-end').textContent = formatFullDate(appState.user.semesterEnd);

    const sdAvatar = document.getElementById('sd-avatar');
    if (sdAvatar) sdAvatar.textContent = appState.user.name.charAt(0).toUpperCase();
    const sdName = document.getElementById('sd-name');
    if (sdName) sdName.textContent = appState.user.name;
    const sdStay = document.getElementById('sd-stay-badge');
    if (sdStay) sdStay.textContent = appState.user.stayType === 'hosteller' ? '🏠 Hosteller' : '🏡 Day Scholar';
    const sdGoal = document.getElementById('sd-savings-goal');
    if (sdGoal) sdGoal.textContent = appState.savings.name ? `${appState.savings.name} — ${formatCurrency(appState.savings.target)}` : 'Not set';

    document.getElementById('dark-mode-toggle').checked = appState.settings.theme === 'dark';
    const notifToggle = document.getElementById('notif-toggle');
    if (notifToggle) notifToggle.checked = appState.settings.notifications !== false;
    const aiToggle = document.getElementById('ai-toggle');
    if (aiToggle) aiToggle.checked = appState.settings.aiInsights !== false;
    const autosaveToggle = document.getElementById('autosave-toggle');
    if (autosaveToggle) autosaveToggle.checked = appState.settings.autoSave !== false;
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    if (!appState.user) return;

    const metrics = calculateMetrics();

    animateCounter(document.getElementById('current-balance'), metrics.currentBalance);
    document.getElementById('budget-percent').textContent = metrics.budgetPercent + '%';

    const ring = document.getElementById('balance-ring');
    const circumference = 2 * Math.PI * 60;
    const offset = circumference - (metrics.budgetPercent / 100) * circumference;
    ring.style.strokeDashoffset = offset;

    document.getElementById('safe-spend').textContent = formatCurrency(metrics.safeSpend);

    document.getElementById('health-score').textContent = metrics.healthScore;
    document.getElementById('score-fill').style.width = metrics.healthScore + '%';

    document.getElementById('semester-days').textContent = metrics.semesterDaysLeft + ' days left';
    document.getElementById('semester-left').textContent = formatCurrency(metrics.semesterRemaining);
    document.getElementById('semester-spent').textContent = formatCurrency(metrics.semesterSpent);
    document.getElementById('semester-progress-bar').style.width = metrics.semesterPercent + '%';

    if (appState.savings.name && appState.savings.target > 0) {
        document.getElementById('goal-badge').textContent = appState.savings.name;
        document.getElementById('goal-saved').textContent = formatCurrency(appState.savings.saved);
        document.getElementById('goal-target').textContent = 'of ' + formatCurrency(appState.savings.target);
        const goalPercent = Math.min(100, (appState.savings.saved / appState.savings.target) * 100);
        document.getElementById('goal-progress-bar').style.width = goalPercent + '%';

        if (appState.savings.saved >= appState.savings.target) {
            document.getElementById('goal-eta').textContent = 'Goal achieved!';
        } else {
            const monthsToGoal = goalPercent > 0 ? Math.ceil((appState.savings.target - appState.savings.saved) / (appState.savings.saved / metrics.monthsSaved || 100)) : '--';
            document.getElementById('goal-eta').textContent = monthsToGoal !== '--' ? `Est. ${monthsToGoal} months to reach goal` : 'Keep saving to track progress';
        }
    }

    document.getElementById('weekly-spend').textContent = formatCurrency(metrics.weeklySpend);
    document.getElementById('monthly-spend').textContent = formatCurrency(metrics.monthlySpend);
    document.getElementById('avg-daily').textContent = formatCurrency(metrics.avgDaily);
    document.getElementById('total-saved').textContent = formatCurrency(metrics.totalSaved);

    const aiInsights = generateAIInsights(metrics);
    const aiInsightsList = document.getElementById('ai-insights-list');
    aiInsightsList.innerHTML = aiInsights.map(insight => `
        <div class="ai-insight-item ${insight.type}">
            <span class="ai-insight-icon">${insight.icon}</span>
            <span>${insight.text}</span>
        </div>
    `).join('') || '<div class="ai-insight-item info"><span class="ai-insight-icon">💡</span><span>Add some expenses to unlock AI insights</span></div>';

    renderAlerts(metrics);
    updateUpcomingReminders();
}

function calculateMetrics() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];

    const monthlyExpenses = appState.expenses.filter(e => {
        const date = new Date(e.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const weeklyExpenses = appState.expenses.filter(e => {
        const weekNum = getWeekNumber(e.date);
        return weekNum === getWeekNumber(today);
    });

    const todayExpenses = appState.expenses.filter(e => e.date === today);

    const monthlySpend = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const weeklySpend = weeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todaySpend = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    const semesterStart = new Date(appState.user.semesterStart);
    const semesterEnd = new Date(appState.user.semesterEnd);
    const semesterExpenses = appState.expenses.filter(e => {
        const date = new Date(e.date);
        return date >= semesterStart && date <= semesterEnd;
    });
    const semesterSpent = semesterExpenses.reduce((sum, e) => sum + e.amount, 0);

    const currentBalance = appState.user.monthlyBudget - monthlySpend;
    const budgetPercent = Math.round((monthlySpend / appState.user.monthlyBudget) * 100);

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const semesterDaysLeft = Math.max(0, getDaysBetween(today, appState.user.semesterEnd));
    const semesterDaysTotal = getDaysBetween(appState.user.semesterStart, appState.user.semesterEnd);
    const semesterDaysElapsed = semesterDaysTotal - semesterDaysLeft;

    const safeSpend = Math.max(0, Math.floor(currentBalance / daysRemaining));

    const daysWithData = monthlyExpenses.length > 0 ?
        Math.ceil((now - new Date(currentYear, currentMonth, 1)) / (1000 * 60 * 60 * 24)) : 1;
    const avgDaily = Math.round(monthlySpend / daysWithData);

    const semesterPercent = Math.round((semesterSpent / appState.user.semesterBudget) * 100);

    let healthScore = 100;

    if (budgetPercent > 80) healthScore -= 30;
    else if (budgetPercent > 60) healthScore -= 15;
    else if (budgetPercent > 40) healthScore -= 5;

    const semesterTimePercent = (semesterDaysElapsed / semesterDaysTotal) * 100;
    if (semesterPercent > semesterTimePercent + 20) healthScore -= 20;
    else if (semesterPercent > semesterTimePercent + 10) healthScore -= 10;

    if (appState.savings.saved > 0) healthScore += 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    const reservedAmount = appState.events.reduce((sum, e) => sum + e.amount, 0);
    const semesterRemaining = appState.user.semesterBudget - semesterSpent - reservedAmount;

    const allTimeSpend = appState.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSaved = appState.user.pocketMoney - allTimeSpend;

    const monthsSaved = appState.savings.startDate ?
        Math.max(1, getDaysBetween(appState.savings.startDate, today) / 30) : 0;

    return {
        currentBalance, budgetPercent, safeSpend, healthScore,
        monthlySpend, weeklySpend, avgDaily, todaySpend,
        semesterSpent, semesterRemaining, semesterDaysLeft, semesterPercent,
        totalSaved, monthsSaved, daysRemaining
    };
}

// ============================================
// AI FINANCIAL INSIGHTS
// ============================================

function generateAIInsights(metrics) {
    const insights = [];

    if (metrics.budgetPercent >= 90) {
        insights.push({ type: 'error', icon: '🚨', text: `Critical: You've used ${metrics.budgetPercent}% of your budget. Only ${formatCurrency(metrics.currentBalance)} left for ${metrics.daysRemaining} days.` });
    } else if (metrics.budgetPercent >= 75) {
        insights.push({ type: 'warning', icon: '⚠️', text: `Budget alert: ${metrics.budgetPercent}% used. Limit daily spending to ${formatCurrency(metrics.safeSpend)} to stay on track.` });
    } else if (metrics.budgetPercent < 40) {
        insights.push({ type: 'success', icon: '✅', text: `Great discipline! Only ${metrics.budgetPercent}% of budget used. You're saving more than expected.` });
    }

    if (metrics.safeSpend > 0 && metrics.budgetPercent < 90) {
        insights.push({ type: 'info', icon: '💡', text: `Safe to spend ${formatCurrency(metrics.safeSpend)}/day for the rest of this month.` });
    } else if (metrics.safeSpend === 0 && metrics.daysRemaining > 0) {
        insights.push({ type: 'warning', icon: '🛑', text: 'Monthly budget exhausted! Consider pausing non-essential spending.' });
    }

    if (metrics.semesterDaysLeft > 0 && metrics.semesterRemaining > 0) {
        const dailySemBudget = Math.floor(metrics.semesterRemaining / metrics.semesterDaysLeft);
        if (metrics.avgDaily > dailySemBudget * 1.3) {
            const daysShort = Math.ceil((metrics.avgDaily * metrics.semesterDaysLeft - metrics.semesterRemaining) / metrics.avgDaily);
            insights.push({ type: 'warning', icon: '📉', text: `At current pace, semester budget may run out ${daysShort} days early. Daily target: ${formatCurrency(dailySemBudget)}.` });
        } else if (metrics.avgDaily < dailySemBudget * 0.7 && metrics.avgDaily > 0) {
            insights.push({ type: 'success', icon: '📈', text: `You're underspending by ${formatCurrency(dailySemBudget - metrics.avgDaily)}/day. Semester surplus projected!` });
        }
    }

    if (appState.savings.saved > 0 && appState.savings.target > 0) {
        const savingsPercent = Math.round((appState.savings.saved / appState.savings.target) * 100);
        if (savingsPercent >= 100) {
            insights.push({ type: 'success', icon: '🎉', text: `Goal achieved! You've saved ${formatCurrency(appState.savings.saved)} for ${appState.savings.name}. Time to set a new target?` });
        } else if (savingsPercent >= 75) {
            insights.push({ type: 'success', icon: '🎯', text: `${savingsPercent}% of your ${appState.savings.name} goal reached. Just ${formatCurrency(appState.savings.target - appState.savings.saved)} to go!` });
        } else {
            insights.push({ type: 'info', icon: '🐷', text: `${savingsPercent}% of ${appState.savings.name} goal saved. Steady progress at ${formatCurrency(appState.savings.saved)}.` });
        }
    }

    const categoryTotals = {};
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    appState.expenses.filter(e => new Date(e.date) >= thisWeek).forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
        const catName = topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1);
        const weekTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
        const catShare = Math.round((topCategory[1] / weekTotal) * 100);
        insights.push({ type: 'info', icon: '🔍', text: `${catName} is your top category this week (${catShare}% of ${formatCurrency(weekTotal)} spent).` });
    }

    if (appState.expenses.length >= 5) {
        const recent5 = appState.expenses.slice(-5);
        const avgRecent = recent5.reduce((s, e) => s + e.amount, 0) / 5;
        if (avgRecent > metrics.avgDaily * 1.5 && metrics.avgDaily > 0) {
            insights.push({ type: 'warning', icon: '⚡', text: `Recent spending spike detected: averaging ${formatCurrency(Math.round(avgRecent))}/expense vs ${formatCurrency(metrics.avgDaily)}/day normal.` });
        }
    }

    if (metrics.healthScore >= 80) {
        insights.push({ type: 'success', icon: '💪', text: `Financial health score: ${metrics.healthScore}/100. Excellent management!` });
    } else if (metrics.healthScore < 50) {
        insights.push({ type: 'warning', icon: '🔧', text: `Health score ${metrics.healthScore}/100 needs attention. Focus on reducing top categories.` });
    }

    return insights.slice(0, 5);
}

// ============================================
// ALERTS & NOTIFICATIONS PANEL
// ============================================

function renderAlerts(metrics) {
    const alerts = [];

    if (metrics.budgetPercent >= 100) {
        alerts.push({ type: 'critical', icon: '🚨', text: `Monthly budget exceeded by ${formatCurrency(metrics.monthlySpend - appState.user.monthlyBudget)}!` });
    } else if (metrics.budgetPercent >= 80) {
        alerts.push({ type: 'warning', icon: '⚠️', text: `Budget ${metrics.budgetPercent}% used. Only ${formatCurrency(metrics.currentBalance)} remaining.` });
    }

    if (metrics.semesterPercent >= 90) {
        alerts.push({ type: 'critical', icon: '📉', text: `Semester budget ${metrics.semesterPercent}% consumed with ${metrics.semesterDaysLeft} days remaining.` });
    } else if (metrics.semesterPercent >= 75) {
        alerts.push({ type: 'warning', icon: '📊', text: `Semester budget ${metrics.semesterPercent}% used. ${metrics.semesterDaysLeft} days left.` });
    }

    const today = new Date();
    appState.reminders.forEach(r => {
        const daysUntil = getDaysBetween(today, r.date);
        if (daysUntil < 0) {
            alerts.push({ type: 'critical', icon: '⏰', text: `${r.name} (${formatCurrency(r.amount)}) is overdue!` });
        } else if (daysUntil === 0) {
            alerts.push({ type: 'warning', icon: '⏰', text: `${r.name} (${formatCurrency(r.amount)}) is due today!` });
        } else if (daysUntil <= 3) {
            alerts.push({ type: 'info', icon: '📅', text: `${r.name} (${formatCurrency(r.amount)}) due in ${daysUntil} days.` });
        }
    });

    if (appState.savings.saved >= appState.savings.target && appState.savings.target > 0) {
        alerts.push({ type: 'success', icon: '🎉', text: `Savings goal "${appState.savings.name}" achieved!` });
    }

    if (metrics.healthScore < 40) {
        alerts.push({ type: 'critical', icon: '💔', text: `Financial health critical (${metrics.healthScore}/100). Immediate action needed.` });
    }

    if (metrics.budgetPercent < 30 && metrics.monthlySpend > 0) {
        alerts.push({ type: 'success', icon: '✨', text: `Well done! Only ${metrics.budgetPercent}% of budget used this month.` });
    }

    const alertsList = document.getElementById('alerts-list');
    const alertsCount = document.getElementById('alerts-count');

    if (alertsCount) {
        alertsCount.textContent = alerts.length;
        alertsCount.style.display = alerts.length > 0 ? 'inline-block' : 'none';
    }

    if (alertsList) {
        if (alerts.length === 0) {
            alertsList.innerHTML = '<div class="alert-item success"><span class="alert-icon">✅</span><span class="alert-text">All clear! No alerts at this time.</span></div>';
        } else {
            alertsList.innerHTML = alerts.map(a => `
                <div class="alert-item ${a.type}">
                    <span class="alert-icon">${a.icon}</span>
                    <span class="alert-text">${a.text}</span>
                </div>
            `).join('');
        }
    }
}

function updateUpcomingReminders() {
    const container = document.getElementById('upcoming-reminders');
    const today = new Date();
    const upcoming = appState.reminders
        .filter(r => new Date(r.date) >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 3);

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><span>No upcoming reminders</span></div>';
        return;
    }

    container.innerHTML = upcoming.map(r => {
        const daysUntil = getDaysBetween(today, r.date);
        const isOverdue = daysUntil < 0;
        return `
            <div class="reminder-item ${isOverdue ? 'overdue' : ''}">
                <div class="reminder-icon">${getReminderIcon(r.type)}</div>
                <div class="reminder-content">
                    <span class="reminder-title">${r.name}</span>
                    <span class="reminder-date">${formatDate(r.date)} (${daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`})</span>
                </div>
                <span class="reminder-amount">${formatCurrency(r.amount)}</span>
            </div>
        `;
    }).join('');
}

function getReminderIcon(type) {
    const icons = {
        'hostel-fee': '🏠', 'mess-fee': '🍜', 'mobile': '📱',
        'exam-fee': '📝', 'event': '🎉', 'custom': '⭐'
    };
    return icons[type] || '📌';
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        appState.settings.theme = e.target.checked ? 'dark' : 'light';
        applyTheme();
        Api.updateSettings(appState.settings).catch(err => handleApiError(err, 'Failed to save theme'));
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    document.querySelectorAll('.see-all').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    document.getElementById('quick-add-btn').addEventListener('click', openAddExpense);
    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn) addExpenseBtn.addEventListener('click', openAddExpense);

    document.getElementById('cancel-quick-add').addEventListener('click', closeQuickAdd);
    document.querySelectorAll('.quick-cat').forEach(cat => {
        cat.addEventListener('click', () => selectQuickCategory(cat));
    });
    document.querySelectorAll('#quick-add-modal .preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('quick-amount');
            if (input) input.value = btn.dataset.amount;
        });
    });
    document.getElementById('confirm-quick-add').addEventListener('click', confirmQuickAdd);

    const searchInput = document.getElementById('expense-search');
    if (searchInput) searchInput.addEventListener('input', debounce(() => renderExpenses(), 200));
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) categoryFilter.addEventListener('change', () => renderExpenses());
    const monthFilter = document.getElementById('month-filter');
    if (monthFilter) monthFilter.addEventListener('change', () => renderExpenses());

    document.getElementById('add-savings-btn').addEventListener('click', openAddSavings);
    document.getElementById('edit-goal-btn').addEventListener('click', openEditGoal);
    document.getElementById('confirm-savings').addEventListener('click', addSavings);
    document.getElementById('save-goal').addEventListener('click', saveGoal);

    document.getElementById('add-reminder-btn').addEventListener('click', openAddReminder);
    document.querySelectorAll('.reminder-preset').forEach(preset => {
        preset.addEventListener('click', () => selectReminderPreset(preset));
    });
    document.getElementById('save-reminder').addEventListener('click', saveReminder);

    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => openEventModal(card.dataset.event));
    });
    document.getElementById('save-event').addEventListener('click', saveEvent);

    document.getElementById('exam-mode-toggle').addEventListener('change', toggleExamMode);
    document.getElementById('start-exam-mode').addEventListener('click', startExamMode);
    document.querySelectorAll('.exam-cat').forEach(cat => {
        cat.addEventListener('click', () => openExamExpense(cat.dataset.cat));
    });
    document.getElementById('confirm-exam-expense').addEventListener('click', addExamExpense);

    document.querySelectorAll('.sd-item-edit').forEach(btn => {
        if (btn.id === 'sd-edit-goal-nav') {
            btn.addEventListener('click', () => { closeSettingsDrawer(); navigateTo('savings'); });
        } else {
            btn.addEventListener('click', () => openEditSetting(btn.dataset.setting));
        }
    });
    document.getElementById('sd-edit-profile-btn').addEventListener('click', () => openEditSetting('name'));
    document.getElementById('save-setting').addEventListener('click', saveSettingEdit);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('reset-data').addEventListener('click', resetAllData);
    document.getElementById('download-report').addEventListener('click', downloadExpenseReport);
    document.getElementById('close-settings-drawer').addEventListener('click', closeSettingsDrawer);
    document.getElementById('settings-overlay').addEventListener('click', closeSettingsDrawer);
    const openDrawerBtn = document.getElementById('open-settings-drawer');
    if (openDrawerBtn) openDrawerBtn.addEventListener('click', openSettingsDrawer);

    document.getElementById('fab-add').addEventListener('click', openAddExpense);

    const notifToggle = document.getElementById('notif-toggle');
    if (notifToggle) notifToggle.addEventListener('change', (e) => {
        appState.settings.notifications = e.target.checked;
        Api.updateSettings(appState.settings).catch(err => handleApiError(err, 'Failed to save preference'));
        showNotification(e.target.checked ? 'Notifications enabled' : 'Notifications disabled', 'info');
    });
    const aiToggle = document.getElementById('ai-toggle');
    if (aiToggle) aiToggle.addEventListener('change', (e) => {
        appState.settings.aiInsights = e.target.checked;
        Api.updateSettings(appState.settings).catch(err => handleApiError(err, 'Failed to save preference'));
        showNotification(e.target.checked ? 'AI Insights enabled' : 'AI Insights disabled', 'info');
    });
    const autosaveToggle = document.getElementById('autosave-toggle');
    if (autosaveToggle) autosaveToggle.addEventListener('change', (e) => {
        appState.settings.autoSave = e.target.checked;
        Api.updateSettings(appState.settings).catch(err => handleApiError(err, 'Failed to save preference'));
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
    if (page === 'settings') {
        openSettingsDrawer();
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    window.scrollTo(0, 0);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    if (page === 'dashboard') updateDashboard();
    if (page === 'analytics') updateCharts();
    if (page === 'expenses') renderExpenses();
    if (page === 'semester') updateSemesterPage();
    if (page === 'savings') updateSavingsPage();
    if (page === 'reminders') renderReminders();
    if (page === 'events') renderEvents();
    if (page === 'exam') updateExamPage();
}

// ============================================
// ADD EXPENSE (POST /transactions)
// ============================================

function openAddExpense() {
    document.getElementById('quick-add-modal').classList.add('active');
    document.getElementById('quick-add-amount').classList.add('hidden');
    document.querySelectorAll('.quick-cat').forEach(c => c.classList.remove('selected'));
    appState.currentExpenseCategory = null;
}

function closeQuickAdd() {
    document.getElementById('quick-add-modal').classList.remove('active');
    document.getElementById('quick-amount').value = '';
    document.getElementById('quick-note').value = '';
    appState.currentExpenseCategory = null;
}

function selectQuickCategory(cat) {
    document.querySelectorAll('.quick-cat').forEach(c => c.classList.remove('selected'));
    cat.classList.add('selected');

    appState.currentExpenseCategory = cat.dataset.category;
    appState.currentExpenseIcon = cat.dataset.icon;

    document.getElementById('selected-cat-display').textContent = cat.dataset.icon + ' ' + cat.querySelector('.cat-name').textContent;
    document.getElementById('quick-add-amount').classList.remove('hidden');
    document.getElementById('quick-amount').focus();
}

async function confirmQuickAdd() {
    const amount = parseInt(document.getElementById('quick-amount').value);
    const note = document.getElementById('quick-note').value.trim();

    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'warning');
        return;
    }

    if (!appState.currentExpenseCategory) {
        showNotification('Please select a category', 'warning');
        return;
    }

    const expense = {
        category: appState.currentExpenseCategory,
        icon: appState.currentExpenseIcon,
        amount: amount,
        note: note,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
    };

    try {
        const saved = await Api.addTransaction(expense);
        appState.expenses.push(saved || { ...expense, id: generateId() });
        closeQuickAdd();
        refreshAll();
        showNotification(`Added ${appState.currentExpenseIcon} expense of ${formatCurrency(amount)}`, 'success');
    } catch (err) {
        handleApiError(err, 'Failed to add expense');
    }
}

// ============================================
// REFRESH ALL
// ============================================

function refreshAll() {
    updateDashboard();
    updateCharts();
    if (document.getElementById('page-expenses') && document.getElementById('page-expenses').classList.contains('active')) {
        renderExpenses();
    }
    if (document.getElementById('page-savings') && document.getElementById('page-savings').classList.contains('active')) {
        updateSavingsPage();
    }
    if (document.getElementById('page-semester') && document.getElementById('page-semester').classList.contains('active')) {
        updateSemesterPage();
    }
}

// ============================================
// EXPENSES PAGE
// ============================================

function renderExpenses() {
    const container = document.getElementById('expenses-list');
    if (!container) return;

    const searchInput = document.getElementById('expense-search');
    const categoryFilter = document.getElementById('category-filter');
    const monthFilter = document.getElementById('month-filter');

    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
    const selectedMonth = monthFilter ? monthFilter.value : 'all';

    let filtered = [...appState.expenses];

    if (searchTerm) {
        filtered = filtered.filter(e =>
            (e.category && e.category.toLowerCase().includes(searchTerm)) ||
            (e.note && e.note.toLowerCase().includes(searchTerm))
        );
    }

    if (selectedCategory && selectedCategory !== 'all') {
        filtered = filtered.filter(e => e.category === selectedCategory);
    }

    if (selectedMonth && selectedMonth !== 'all') {
        const now = new Date();
        if (selectedMonth === 'this-month') {
            filtered = filtered.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (selectedMonth === 'last-month') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            filtered = filtered.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
            });
        } else if (selectedMonth === 'this-week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            filtered = filtered.filter(e => new Date(e.date) >= weekAgo);
        } else if (selectedMonth === 'today') {
            const today = now.toISOString().split('T')[0];
            filtered = filtered.filter(e => e.date === today);
        }
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    const count = filtered.length;
    const avg = count > 0 ? Math.round(total / count) : 0;

    const totalEl = document.getElementById('expense-total');
    const countEl = document.getElementById('expense-count');
    const avgEl = document.getElementById('expense-avg');
    if (totalEl) totalEl.textContent = formatCurrency(total);
    if (countEl) countEl.textContent = count;
    if (avgEl) avgEl.textContent = formatCurrency(avg);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                <h4>No expenses found</h4>
                <p>${appState.expenses.length === 0 ? 'Start tracking with Add Expense' : 'Try adjusting your search or filters'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(expense => `
        <div class="expense-card" data-id="${expense.id}">
            <div class="expense-card-top">
                <div class="expense-card-icon">${expense.icon || '📦'}</div>
                <div class="expense-card-info">
                    <div class="expense-card-title">${expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}</div>
                    <div class="expense-card-cat">${expense.note || 'No note'}</div>
                </div>
            </div>
            <div class="expense-card-bottom">
                <div>
                    <div class="expense-card-amount">${formatCurrency(expense.amount)}</div>
                    <div class="expense-card-date">${formatDate(expense.date)}</div>
                </div>
                <div class="expense-card-actions">
                    <button class="expense-btn" onclick="editExpense('${expense.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="expense-btn delete" onclick="deleteExpense('${expense.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function editExpense(id) {
    const expense = appState.expenses.find(e => e.id === id);
    if (!expense) return;

    const newAmount = prompt('Enter new amount:', expense.amount);
    if (!newAmount || isNaN(parseInt(newAmount))) return;

    const updated = { ...expense, amount: parseInt(newAmount) };
    try {
        await Api.updateTransaction(id, updated);
        expense.amount = parseInt(newAmount);
        refreshAll();
        showNotification('Expense updated', 'success');
    } catch (err) {
        handleApiError(err, 'Failed to update expense');
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;

    try {
        await Api.deleteTransaction(id);
        appState.expenses = appState.expenses.filter(e => e.id !== id);
        refreshAll();
        showNotification('Expense deleted', 'info');
    } catch (err) {
        handleApiError(err, 'Failed to delete expense');
    }
}

// ============================================
// ANALYTICS CHARTS
// ============================================

function initCharts() {
    const ctx1 = document.getElementById('monthlyChart');
    const ctx2 = document.getElementById('categoryChart');
    const ctx3 = document.getElementById('weeklyChart');
    const ctx4 = document.getElementById('savingsChart');

    if (!ctx1) return;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
            x: { grid: { display: false } }
        }
    };

    appState.charts.monthly = new Chart(ctx1, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 8 }] },
        options: chartOptions
    });

    appState.charts.category = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{ data: [], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    appState.charts.weekly = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ data: [0,0,0,0,0,0,0], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }]
        },
        options: chartOptions
    });

    appState.charts.savings = new Chart(ctx4, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{ data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }]
        },
        options: chartOptions
    });

    updateCharts();
}

function updateCharts() {
    if (!appState.charts.monthly) return;

    const monthlyData = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-IN', { month: 'short' });
        monthlyData[key] = 0;
    }

    appState.expenses.forEach(e => {
        const date = new Date(e.date);
        const key = date.toLocaleDateString('en-IN', { month: 'short' });
        if (monthlyData.hasOwnProperty(key)) {
            monthlyData[key] += e.amount;
        }
    });

    appState.charts.monthly.data.labels = Object.keys(monthlyData);
    appState.charts.monthly.data.datasets[0].data = Object.values(monthlyData);
    appState.charts.monthly.update();

    const categoryData = {};
    appState.expenses.forEach(e => {
        categoryData[e.category] = (categoryData[e.category] || 0) + e.amount;
    });

    appState.charts.category.data.labels = Object.keys(categoryData).map(c => c.charAt(0).toUpperCase() + c.slice(1));
    appState.charts.category.data.datasets[0].data = Object.values(categoryData);
    appState.charts.category.update();

    const weekDays = [0, 0, 0, 0, 0, 0, 0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    appState.expenses.filter(e => new Date(e.date) >= weekStart).forEach(e => {
        const day = new Date(e.date).getDay();
        weekDays[day === 0 ? 6 : day - 1] += e.amount;
    });

    appState.charts.weekly.data.datasets[0].data = weekDays;
    appState.charts.weekly.update();

    const savingsTrend = {};
    if (appState.savings.startDate && appState.savings.saved > 0) {
        const startDate = new Date(appState.savings.startDate);
        const months = [];
        const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (cur <= now) {
            months.push(new Date(cur));
            cur.setMonth(cur.getMonth() + 1);
        }

        const totalMonths = months.length || 1;
        const monthlyContribution = appState.savings.saved / totalMonths;
        let cumulative = 0;
        months.forEach(m => {
            cumulative += monthlyContribution;
            const key = m.toLocaleDateString('en-IN', { month: 'short' });
            savingsTrend[key] = Math.round(cumulative);
        });
    }

    appState.charts.savings.data.labels = Object.keys(savingsTrend);
    appState.charts.savings.data.datasets[0].data = Object.values(savingsTrend);
    appState.charts.savings.update();

    const sortedCategories = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topCategoriesEl = document.getElementById('top-categories');

    if (topCategoriesEl) {
        if (sortedCategories.length === 0) {
            topCategoriesEl.innerHTML = '<div class="empty-state-small">Add expenses to see top categories</div>';
        } else {
            const maxVal = sortedCategories[0][1];
            const categoryIcons = {
                canteen: '🍔', tea: '☕', bus: '🚌', books: '📚', printout: '🖨',
                mess: '🍜', food: '🍕', entertainment: '🎬', medical: '💊',
                shopping: '🛒', grocery: '🛍', other: '📦'
            };

            topCategoriesEl.innerHTML = sortedCategories.map(([cat, amount]) => {
                const percent = (amount / maxVal) * 100;
                return `
                    <div class="top-category-item">
                        <span class="top-category-icon">${categoryIcons[cat] || '📦'}</span>
                        <div class="top-category-info">
                            <span class="top-category-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                            <div class="top-category-bar">
                                <div class="top-category-fill" style="width: ${percent}%"></div>
                            </div>
                        </div>
                        <span class="top-category-amount">${formatCurrency(amount)}</span>
                    </div>
                `;
            }).join('');
        }
    }
}

// ============================================
// SEMESTER PAGE
// ============================================

function updateSemesterPage() {
    if (!appState.user) return;

    const metrics = calculateMetrics();
    const today = new Date();
    const semesterDaysTotal = getDaysBetween(appState.user.semesterStart, appState.user.semesterEnd);
    const semesterDaysElapsed = getDaysBetween(appState.user.semesterStart, today);
    const progressPercent = Math.min(100, (semesterDaysElapsed / semesterDaysTotal) * 100);

    document.getElementById('semester-total').textContent = formatCurrency(appState.user.semesterBudget);
    document.getElementById('semester-spent-detail').textContent = formatCurrency(metrics.semesterSpent);
    document.getElementById('semester-remaining').textContent = formatCurrency(metrics.semesterRemaining);
    document.getElementById('semester-percent').textContent = metrics.semesterPercent + '%';

    const ring = document.getElementById('semester-ring');
    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (metrics.semesterPercent / 100) * circumference;
    ring.style.strokeDashoffset = offset;

    document.getElementById('days-left').textContent = metrics.semesterDaysLeft;
    document.getElementById('per-day').textContent = formatCurrency(Math.floor(metrics.semesterRemaining / Math.max(1, metrics.semesterDaysLeft)));
    document.getElementById('avg-semester-daily').textContent = formatCurrency(Math.round(metrics.semesterSpent / Math.max(1, semesterDaysElapsed)));

    document.getElementById('timeline-fill').style.width = progressPercent + '%';
    document.getElementById('timeline-marker').style.left = progressPercent + '%';
    document.getElementById('timeline-date').textContent = formatFullDate(today);
}

// ============================================
// SAVINGS PAGE
// ============================================

function updateSavingsPage() {
    document.getElementById('goal-name-display').textContent = appState.savings.name || 'Set a Goal';
    document.getElementById('savings-saved').textContent = formatCurrency(appState.savings.saved);
    document.getElementById('savings-target').textContent = formatCurrency(appState.savings.target);
    document.getElementById('savings-remaining').textContent = formatCurrency(Math.max(0, appState.savings.target - appState.savings.saved));

    const progress = appState.savings.target > 0 ? (appState.savings.saved / appState.savings.target) * 100 : 0;
    document.getElementById('savings-progress-fill').style.width = progress + '%';

    if (appState.savings.name && appState.savings.startDate) {
        document.getElementById('goal-dates').textContent = 'Started ' + formatFullDate(appState.savings.startDate);
    }

    if (progress >= 100) {
        document.getElementById('savings-eta').textContent = 'Goal achieved!';
    } else if (progress > 0) {
        const monthsToGoal = Math.ceil((appState.savings.target - appState.savings.saved) / (appState.savings.saved / Math.max(1, getDaysBetween(appState.savings.startDate, new Date()) / 30)));
        document.getElementById('savings-eta').textContent = `Est. ${monthsToGoal} months to reach goal`;
    } else {
        document.getElementById('savings-eta').textContent = 'Add to savings to see ETA';
    }
}

function openAddSavings() {
    document.getElementById('savings-modal').classList.add('active');
    document.getElementById('add-savings-amount').value = '';

    document.querySelectorAll('#savings-modal .preset-btn').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('add-savings-amount').value = btn.dataset.amount;
        };
    });
}

async function addSavings() {
    const amount = parseInt(document.getElementById('add-savings-amount').value);
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'warning');
        return;
    }

    appState.savings.saved += amount;
    try {
        await Api.updateSavings(appState.savings);
        document.getElementById('savings-modal').classList.remove('active');
        refreshAll();

        if (appState.savings.saved >= appState.savings.target && appState.savings.name) {
            showNotification(`Congratulations! You've reached your ${appState.savings.name} goal! 🎉`, 'success');
            launchConfetti();
        } else {
            showNotification(`Added ${formatCurrency(amount)} to savings`, 'success');
        }
    } catch (err) {
        appState.savings.saved -= amount; // rollback optimistic update
        handleApiError(err, 'Failed to add savings');
    }
}

function openEditGoal() {
    document.getElementById('goal-modal').classList.add('active');
    document.getElementById('edit-goal-name').value = appState.savings.name || '';
    document.getElementById('edit-goal-amount').value = appState.savings.target || '';
}

async function saveGoal() {
    const name = document.getElementById('edit-goal-name').value.trim();
    const target = parseInt(document.getElementById('edit-goal-amount').value);

    if (!name || !target || target <= 0) {
        showNotification('Please fill all fields correctly', 'warning');
        return;
    }

    const previous = { ...appState.savings };
    appState.savings.name = name;
    appState.savings.target = target;
    if (!appState.savings.startDate) {
        appState.savings.startDate = new Date().toISOString().split('T')[0];
    }

    try {
        await Api.updateSavings(appState.savings);
        document.getElementById('goal-modal').classList.remove('active');
        refreshAll();
        showNotification('Savings goal updated', 'success');
    } catch (err) {
        appState.savings = previous; // rollback
        handleApiError(err, 'Failed to update savings goal');
    }
}

// ============================================
// REMINDERS
// ============================================

function openAddReminder() {
    document.getElementById('reminder-modal').classList.add('active');
    document.getElementById('reminder-form').classList.add('hidden');
    document.querySelectorAll('.reminder-preset').forEach(p => p.classList.remove('selected'));
}

function selectReminderPreset(preset) {
    document.querySelectorAll('.reminder-preset').forEach(p => p.classList.remove('selected'));
    preset.classList.add('selected');

    document.getElementById('reminder-form').classList.remove('hidden');
    if (preset.dataset.type !== 'custom') {
        document.getElementById('reminder-name').value = preset.querySelector('span:last-child').textContent;
    } else {
        document.getElementById('reminder-name').value = '';
    }

    appState.currentReminderType = preset.dataset.type;
}

async function saveReminder() {
    const name = document.getElementById('reminder-name').value.trim();
    const amount = parseInt(document.getElementById('reminder-amount').value);
    const date = document.getElementById('reminder-date').value;

    if (!name || !amount || !date) {
        showNotification('Please fill all fields', 'warning');
        return;
    }

    const reminder = {
        type: appState.currentReminderType || 'custom',
        name, amount, date,
        createdAt: Date.now()
    };

    try {
        const saved = await Api.addReminder(reminder);
        appState.reminders.push(saved || { ...reminder, id: generateId() });
        document.getElementById('reminder-modal').classList.remove('active');
        renderReminders();
        updateDashboard();
        showNotification('Reminder added', 'success');
    } catch (err) {
        handleApiError(err, 'Failed to add reminder');
    }
}

function renderReminders() {
    const container = document.getElementById('reminders-list');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...appState.reminders].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                <h4>No reminders</h4>
                <p>Set up payment reminders to stay on track</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sorted.map(r => {
        const daysUntil = getDaysBetween(today, r.date);
        const isOverdue = daysUntil < 0;
        return `
            <div class="reminder-item ${isOverdue ? 'overdue' : ''}">
                <div class="reminder-icon">${getReminderIcon(r.type)}</div>
                <div class="reminder-content">
                    <span class="reminder-title">${r.name}</span>
                    <span class="reminder-date">${formatFullDate(r.date)} (${isOverdue ? 'Overdue' : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`})</span>
                </div>
                <span class="reminder-amount">${formatCurrency(r.amount)}</span>
                <button class="expense-btn delete" onclick="deleteReminder('${r.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

async function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return;
    try {
        await Api.deleteReminder(id);
        appState.reminders = appState.reminders.filter(r => r.id !== id);
        renderReminders();
        updateDashboard();
        showNotification('Reminder deleted', 'info');
    } catch (err) {
        handleApiError(err, 'Failed to delete reminder');
    }
}

// ============================================
// EVENTS
// ============================================

function openEventModal(eventType) {
    document.getElementById('event-modal').classList.add('active');
    const eventNames = {
        fest: 'College Fest', trip: 'Trip', birthday: 'Birthday',
        hackathon: 'Hackathon', workshop: 'Workshop', custom: 'Custom Event'
    };
    document.getElementById('event-modal-title').textContent = 'Reserve for ' + eventNames[eventType];
    document.getElementById('event-name').value = eventNames[eventType] || '';
    document.getElementById('event-amount').value = '';
    appState.currentEventType = eventType;
}

async function saveEvent() {
    const name = document.getElementById('event-name').value.trim();
    const amount = parseInt(document.getElementById('event-amount').value);

    if (!name || !amount || amount <= 0) {
        showNotification('Please fill all fields correctly', 'warning');
        return;
    }

    const event = {
        type: appState.currentEventType,
        name, amount,
        createdAt: Date.now()
    };

    try {
        const saved = await Api.addEvent(event);
        appState.events.push(saved || { ...event, id: generateId() });
        document.getElementById('event-modal').classList.remove('active');
        renderEvents();
        updateDashboard();
        showNotification(`Reserved ${formatCurrency(amount)} for ${name}`, 'success');
    } catch (err) {
        handleApiError(err, 'Failed to reserve event budget');
    }
}

function renderEvents() {
    const totalReserved = appState.events.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('reserved-amount').textContent = formatCurrency(totalReserved);

    const container = document.getElementById('events-list');

    if (appState.events.length === 0) {
        container.innerHTML = '<div class="empty-state-small">No events reserved</div>';
        return;
    }

    const eventIcons = {
        fest: '🎪', trip: '✈️', birthday: '🎂', hackathon: '💻', workshop: '🔧', custom: '⭐'
    };

    container.innerHTML = appState.events.map(e => `
        <div class="event-item">
            <div class="event-item-info">
                <span class="event-item-icon">${eventIcons[e.type] || '⭐'}</span>
                <span class="event-item-name">${e.name}</span>
            </div>
            <span class="event-item-amount">${formatCurrency(e.amount)}</span>
            <button class="event-item-remove" onclick="deleteEvent('${e.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `).join('');
}

async function deleteEvent(id) {
    try {
        await Api.deleteEvent(id);
        appState.events = appState.events.filter(e => e.id !== id);
        renderEvents();
        updateDashboard();
    } catch (err) {
        handleApiError(err, 'Failed to delete event');
    }
}

// ============================================
// EXAM MODE
// ============================================

function toggleExamMode(e) {
    const enabled = e.target.checked;
    document.getElementById('exam-status').textContent = enabled ? 'Active' : 'Disabled';
    document.getElementById('exam-budget-input').classList.toggle('hidden', !enabled || appState.exam.budget > 0);
    document.getElementById('exam-active-content').classList.toggle('hidden', !(enabled && appState.exam.budget > 0));
}

async function startExamMode() {
    const budget = parseInt(document.getElementById('exam-budget-amount').value);
    if (!budget || budget <= 0) {
        showNotification('Please enter a valid budget', 'warning');
        return;
    }

    const previous = { ...appState.exam };
    appState.exam.enabled = true;
    appState.exam.budget = budget;
    appState.exam.expenses = [];

    try {
        await Api.updateExam(appState.exam);
        document.getElementById('exam-budget-input').classList.add('hidden');
        document.getElementById('exam-active-content').classList.remove('hidden');
        updateExamPage();
        showNotification('Exam mode activated!', 'success');
    } catch (err) {
        appState.exam = previous;
        handleApiError(err, 'Failed to start exam mode');
    }
}

function updateExamPage() {
    const spent = appState.exam.expenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = appState.exam.budget - spent;

    document.getElementById('exam-budget-display').textContent = formatCurrency(appState.exam.budget);
    document.getElementById('exam-spent').textContent = formatCurrency(spent);
    document.getElementById('exam-remaining').textContent = formatCurrency(remaining);

    const container = document.getElementById('exam-expenses-content');
    if (appState.exam.expenses.length === 0) {
        container.innerHTML = '<div class="empty-state-small">No exam expenses yet</div>';
        return;
    }

    container.innerHTML = appState.exam.expenses.map(e => `
        <div class="exam-expense-item">
            <div class="exam-expense-cat">
                <span>${e.icon}</span>
                <span>${e.category}</span>
            </div>
            <span class="exam-expense-amount">${formatCurrency(e.amount)}</span>
        </div>
    `).join('');
}

function openExamExpense(category) {
    const categoryNames = {
        books: '📚 Books', stationery: '✏️ Stationery', printouts: '🖨 Printouts',
        lab: '🔬 Lab Materials', project: '📊 Project', other: '📦 Other'
    };

    document.getElementById('exam-expense-modal').classList.add('active');
    document.getElementById('exam-expense-title').textContent = 'Add ' + (categoryNames[category] || 'Expense');
    document.getElementById('exam-expense-amount').value = '';
    document.getElementById('exam-expense-note').value = '';

    appState.currentExamCategory = category;
}

async function addExamExpense() {
    const amount = parseInt(document.getElementById('exam-expense-amount').value);
    const note = document.getElementById('exam-expense-note').value.trim();

    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'warning');
        return;
    }

    const categoryNames = {
        books: 'Books', stationery: 'Stationery', printouts: 'Printouts',
        lab: 'Lab Materials', project: 'Project', other: 'Other'
    };

    const categoryIcons = {
        books: '📚', stationery: '✏️', printouts: '🖨',
        lab: '🔬', project: '📊', other: '📦'
    };

    const expense = {
        id: generateId(),
        category: categoryNames[appState.currentExamCategory] || 'Other',
        icon: categoryIcons[appState.currentExamCategory] || '📦',
        amount, note,
        timestamp: Date.now()
    };

    const previousExpenses = [...appState.exam.expenses];
    appState.exam.expenses.push(expense);

    try {
        await Api.updateExam(appState.exam);
        document.getElementById('exam-expense-modal').classList.remove('active');
        updateExamPage();
        showNotification('Exam expense added', 'success');
    } catch (err) {
        appState.exam.expenses = previousExpenses;
        handleApiError(err, 'Failed to add exam expense');
    }
}

// ============================================
// SETTINGS
// ============================================

function openEditSetting(setting) {
    document.getElementById('edit-setting-modal').classList.add('active');
    const title = document.getElementById('edit-setting-title');
    const content = document.getElementById('edit-setting-content');

    const settingLabels = {
        name: 'Name', stay: 'Stay Type', pocket: 'Monthly Pocket Money',
        budget: 'Monthly Budget', semester: 'Semester Budget', 'semester-end': 'Semester End Date'
    };

    title.textContent = 'Edit ' + settingLabels[setting];

    if (setting === 'name') {
        content.innerHTML = `<input type="text" id="setting-input" value="${appState.user.name}" style="width:100%;padding:12px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);color:var(--text-primary);">`;
    } else if (setting === 'stay') {
        content.innerHTML = `
            <select id="setting-input" style="width:100%;padding:12px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);color:var(--text-primary);">
                <option value="hosteller" ${appState.user.stayType === 'hosteller' ? 'selected' : ''}>Hosteller</option>
                <option value="dayscholar" ${appState.user.stayType === 'dayscholar' ? 'selected' : ''}>Day Scholar</option>
            </select>
        `;
    } else if (setting === 'pocket' || setting === 'budget' || setting === 'semester') {
        const values = { pocket: appState.user.pocketMoney, budget: appState.user.monthlyBudget, semester: appState.user.semesterBudget };
        content.innerHTML = `
            <div style="position:relative;">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-weight:600;">₹</span>
                <input type="number" id="setting-input" value="${values[setting]}" style="width:100%;padding:12px 12px 12px 36px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);color:var(--text-primary);">
            </div>
        `;
    } else if (setting === 'semester-end') {
        content.innerHTML = `<input type="date" id="setting-input" value="${appState.user.semesterEnd}" style="width:100%;padding:12px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);color:var(--text-primary);">`;
    }

    appState.currentEditSetting = setting;
}

async function saveSettingEdit() {
    const input = document.getElementById('setting-input');
    const value = input.value;

    if (!value) {
        showNotification('Please enter a value', 'warning');
        return;
    }

    const setting = appState.currentEditSetting;
    const previousUser = { ...appState.user };

    if (setting === 'name') appState.user.name = value;
    else if (setting === 'stay') appState.user.stayType = value;
    else if (setting === 'pocket') appState.user.pocketMoney = parseInt(value);
    else if (setting === 'budget') appState.user.monthlyBudget = parseInt(value);
    else if (setting === 'semester') appState.user.semesterBudget = parseInt(value);
    else if (setting === 'semester-end') appState.user.semesterEnd = value;

    try {
        await Api.updateUser(appState.user);
        document.getElementById('edit-setting-modal').classList.remove('active');
        updateUI();
        refreshAll();
        showNotification('Setting updated', 'success');
    } catch (err) {
        appState.user = previousUser;
        handleApiError(err, 'Failed to update setting');
    }
}

function exportData() {
    const data = {
        user: appState.user, expenses: appState.expenses, savings: appState.savings,
        reminders: appState.reminders, events: appState.events, exam: appState.exam,
        settings: appState.settings, exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campuscash_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Data exported successfully', 'success');
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!data.user) throw new Error('Invalid data format');

            appState.user = data.user;
            appState.expenses = data.expenses || [];
            appState.savings = data.savings || { name: null, target: 0, saved: 0 };
            appState.reminders = data.reminders || [];
            appState.events = data.events || [];
            appState.exam = data.exam || { enabled: false, budget: 0, expenses: [] };
            appState.settings = data.settings || { theme: 'light' };

            await Promise.all([
                Api.updateUser(appState.user),
                Api.replaceTransactions(appState.expenses),
                Api.updateSavings(appState.savings),
                Api.replaceReminders(appState.reminders),
                Api.replaceEvents(appState.events),
                Api.updateExam(appState.exam),
                Api.updateSettings(appState.settings)
            ]);

            applyTheme();
            updateUI();
            refreshAll();
            showNotification('Data imported successfully', 'success');
        } catch (err) {
            handleApiError(err, 'Failed to import data');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

async function resetAllData() {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) return;
    if (!confirm('Really? All your expenses, savings, and settings will be deleted.')) return;

    try {
        await Api.resetAll();
        appState.user = null;
        appState.expenses = [];
        appState.savings = { name: null, target: 0, saved: 0, startDate: null };
        appState.reminders = [];
        appState.events = [];
        appState.exam = { enabled: false, budget: 0, expenses: [] };
        closeSettingsDrawer();
        showSetup();
        showNotification('All data has been reset', 'info');
    } catch (err) {
        handleApiError(err, 'Failed to reset data');
    }
}

// ============================================
// THEME MANAGEMENT
// ============================================

async function toggleTheme() {
    appState.settings.theme = appState.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    document.getElementById('dark-mode-toggle').checked = appState.settings.theme === 'dark';
    try {
        await Api.updateSettings(appState.settings);
    } catch (err) {
        handleApiError(err, 'Failed to save theme');
    }
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', appState.settings.theme);
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    const container = document.getElementById('toast-container') || document.getElementById('notifications');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `notification-card ${type}`;

    const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
    toast.innerHTML = `
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content"><span class="notification-text">${message}</span></div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(110%)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function checkNotifications() {
    if (!appState.user) return;

    const metrics = calculateMetrics();
    const notifications = [];

    if (metrics.budgetPercent >= 80) {
        notifications.push({ text: `You've used ${metrics.budgetPercent}% of your monthly budget!`, type: 'warning' });
    }

    if (metrics.budgetPercent >= 100) {
        notifications.push({ text: 'Monthly budget exceeded! Consider reducing expenses.', type: 'error' });
    }

    if (appState.savings.name && appState.savings.saved >= appState.savings.target) {
        notifications.push({ text: `You've reached your ${appState.savings.name} savings goal!`, type: 'success' });
    }

    if (metrics.semesterDaysLeft <= 7 && metrics.semesterDaysLeft > 0) {
        notifications.push({ text: `Semester ending in ${metrics.semesterDaysLeft} days. Budget remaining: ${formatCurrency(metrics.semesterRemaining)}`, type: 'info' });
    }

    const today = new Date();
    appState.reminders.forEach(r => {
        const daysUntil = getDaysBetween(today, r.date);
        if (daysUntil === 0) {
            notifications.push({ text: `${r.name} payment of ${formatCurrency(r.amount)} is due today!`, type: 'warning' });
        } else if (daysUntil === 1) {
            notifications.push({ text: `${r.name} payment of ${formatCurrency(r.amount)} is due tomorrow.`, type: 'info' });
        }
    });

    notifications.forEach((n, i) => {
        setTimeout(() => showNotification(n.text, n.type), i * 1000);
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', init);

window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.deleteReminder = deleteReminder;
window.deleteEvent = deleteEvent;

// ============================================
// SETTINGS DRAWER
// ============================================

function openSettingsDrawer() {
    updateUI();
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    overlay.classList.add('active');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('settings-overlay');
    drawer.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function downloadExpenseReport() {
    if (appState.expenses.length === 0) {
        showNotification('No expenses to export', 'warning');
        return;
    }
    const header = 'Date,Category,Note,Amount\n';
    const rows = appState.expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(e => `${e.date},${e.category},"${(e.note || '').replace(/"/g, '""')}",${e.amount}`)
        .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campuscash_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Expense report downloaded', 'success');
}

// ============================================
// CONFETTI
// ============================================

function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const pieces = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        vr: (Math.random() - 0.5) * 0.1
    }));

    let frame = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
            p.x += p.vx; p.y += p.vy; p.rot += p.vr;
            if (p.y > canvas.height) p.y = -20;
        });
        frame++;
        if (frame < 180) requestAnimationFrame(draw);
        else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
        }
    }
    draw();
}

// ============================================
// ANIMATED COUNTERS
// ============================================

function animateCounter(el, target, duration = 800) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(start + (target - start) * eased);
        el.textContent = '₹' + value.toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}
