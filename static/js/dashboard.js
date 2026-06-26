/**
 * STUDENT DASHBOARD CONTROLLER - KOLEKAR'S ACADEMY
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Authenticate and load profile info
    currentUser = await checkAuth();
    if (!currentUser) return;

    // Load initial student details
    loadStudentDashboard();
    setupProfileForm();
    setupDoubtForm();
});

// View Routing Switcher
function showView(viewId) {
    // Manage active states in navbar
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(l => l.classList.remove('active'));
    
    const targetLink = document.getElementById(`nav-${viewId}`);
    if (targetLink) targetLink.classList.add('active');

    // Manage views visibility
    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    // Header Content updates
    const titleEl = document.getElementById('view-title');
    const subEl = document.getElementById('view-subtitle');

    if (viewId === 'overview') {
        titleEl.textContent = 'Dashboard Overview';
        subEl.textContent = 'Welcome back to your academic workstation';
        loadStudentDashboard();
    } else if (viewId === 'attendance') {
        titleEl.textContent = 'My Attendance Log';
        subEl.textContent = 'Track your daily classroom presence average';
        loadStudentAttendance();
    } else if (viewId === 'tests') {
        titleEl.textContent = 'Mock Exams Workstation';
        subEl.textContent = 'Solve online mock test papers and review feedback';
        loadStudentMockTests();
    } else if (viewId === 'doubts') {
        titleEl.textContent = 'Academic Doubt Solver';
        subEl.textContent = 'Submit your syllabus questions directly to Prof. Kolekar';
        loadStudentDoubts();
    } else if (viewId === 'profile') {
        titleEl.textContent = 'Profile Information';
        subEl.textContent = 'Keep your contact parameters and residential details updated';
        loadProfileFields();
    }
}

// Load basic student profile and batch details
async function loadStudentDashboard() {
    // Populate header details
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-avatar-initial').textContent = currentUser.name.charAt(0);

    const { data, error } = await secureFetch('/api/student/profile');
    if (error) {
        showToast('Failed to load profile details.', 'error');
        return;
    }

    if (data) {
        document.getElementById('stat-batch').textContent = data.batch_name;
        document.getElementById('stat-course').textContent = data.course_name;
        document.getElementById('stat-attendance').textContent = `${data.attendance_rate.toFixed(1)}%`;
    }
}

// Load Profile Settings Tab Fields
async function loadProfileFields() {
    const { data, error } = await secureFetch('/api/student/profile');
    if (error) return;

    if (data) {
        document.getElementById('profile-name').value = currentUser.name;
        document.getElementById('profile-email').value = currentUser.email;
        document.getElementById('profile-phone').value = data.phone || '';
        document.getElementById('profile-parent-phone').value = data.parent_phone || '';
        document.getElementById('profile-address').value = data.address || '';
    }
}

// Setup profile save form
function setupProfileForm() {
    const form = document.getElementById('profile-form');
    const alertBox = document.getElementById('profile-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phone = document.getElementById('profile-phone').value.trim();
        const parent_phone = document.getElementById('profile-parent-phone').value.trim();
        const address = document.getElementById('profile-address').value.trim();

        if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
            alertBox.textContent = 'Invalid student phone number.';
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        if (parent_phone && !/^\+?[0-9]{10,15}$/.test(parent_phone)) {
            alertBox.textContent = 'Invalid parent phone number.';
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        const { data, error } = await secureFetch('/api/student/profile', {
            method: 'POST',
            body: JSON.stringify({ phone, parent_phone, address })
        });

        if (error) {
            alertBox.textContent = error;
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        alertBox.textContent = 'Profile settings updated successfully!';
        alertBox.className = 'form-message success';
        alertBox.style.display = 'block';
        
        setTimeout(() => { alertBox.style.display = 'none'; }, 3000);
    });
}


// Doubt Solver Methods
async function loadStudentDoubts() {
    const container = document.getElementById('doubts-list-container');
    const { data, error } = await secureFetch('/api/student/doubts');

    if (error || !data || data.length === 0) {
        container.innerHTML = `<div class="text-center" style="padding:2rem; color:var(--text-muted);">No doubts submitted yet. Click above to raise one.</div>`;
        return;
    }

    container.innerHTML = '';
    data.forEach(d => {
        const item = document.createElement('div');
        item.className = 'doubt-item';

        const header = document.createElement('div');
        header.className = 'doubt-item-header';

        const title = document.createElement('h4');
        title.className = 'doubt-item-title';
        title.textContent = d.title;

        const badge = document.createElement('span');
        if (d.status === 'resolved') {
            badge.className = 'badge badge-success';
            badge.textContent = 'Resolved';
        } else {
            badge.className = 'badge badge-warning';
            badge.textContent = 'Pending';
        }

        header.appendChild(title);
        header.appendChild(badge);

        const desc = document.createElement('p');
        desc.className = 'doubt-item-desc';
        desc.textContent = d.description;

        item.appendChild(header);
        item.appendChild(desc);

        // Render response if resolved
        if (d.status === 'resolved' && d.answer) {
            const ansDiv = document.createElement('div');
            ansDiv.className = 'doubt-item-answer';

            const ansHeader = document.createElement('div');
            ansHeader.className = 'answer-header';

            const author = document.createElement('span');
            author.className = 'answer-author';
            author.textContent = `Response from ${d.answered_by_name || 'Faculty'}`;

            ansHeader.appendChild(author);

            const ansText = document.createElement('p');
            ansText.className = 'answer-text';
            ansText.textContent = d.answer;

            ansDiv.appendChild(ansHeader);
            ansDiv.appendChild(ansText);
            item.appendChild(ansDiv);
        }

        container.appendChild(item);
    });
}

// Modal controls
function openDoubtModal() {
    document.getElementById('doubt-modal').classList.add('active');
}

function closeDoubtModal() {
    document.getElementById('doubt-modal').classList.remove('active');
    document.getElementById('doubt-form').reset();
    document.getElementById('modal-alert').style.display = 'none';
}

function setupDoubtForm() {
    const form = document.getElementById('doubt-form');
    const alertBox = document.getElementById('modal-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const subject = document.getElementById('doubt-subject').value;
        const topic = document.getElementById('doubt-topic').value.trim();
        const description = document.getElementById('doubt-desc').value.trim();

        if (!subject || !topic || !description) {
            alertBox.textContent = 'All fields are required.';
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        const title = `${subject}: ${topic}`;

        const { data, error } = await secureFetch('/api/student/doubts', {
            method: 'POST',
            body: JSON.stringify({ title, description })
        });

        if (error) {
            alertBox.textContent = error;
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        showToast('Doubt submitted successfully!');
        closeDoubtModal();
        loadStudentDoubts(); // Refresh doubts log list
    });
}

// Logout actions
async function handleLogout() {
    const { error } = await secureFetch('/api/auth/logout', { method: 'POST' });
    if (error) {
        showToast('Logout failed. Try again.', 'error');
        return;
    }
    showToast('Signed out successfully.');
    setTimeout(() => { window.location.href = '/auth'; }, 500);
}


// ----------------- ATTENDANCE AND MOCK TEST SYSTEM LOGIC -----------------

let activeTest = null;
let activeTestQuestions = [];
let activeQuestionIndex = 0;
let studentAnswers = {};
let testTimerInterval = null;
let timeRemainingSeconds = 0;

// 1. Student Attendance Log Loader
async function loadStudentAttendance() {
    const rateEl = document.getElementById('attendance-rate-display');
    const tbody = document.getElementById('student-attendance-table-body');
    if (!rateEl || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:2rem;">Loading attendance log...</td></tr>';

    const { data, error } = await secureFetch('/api/student/attendance');
    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center" style="padding:2rem; color: var(--primary);">${error || 'Failed to load attendance.'}</td></tr>`;
        return;
    }

    rateEl.textContent = `${data.attendance_rate}%`;
    if (data.records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:2rem;">No attendance records registered yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.records.forEach(r => {
        const row = document.createElement('tr');
        
        const dateTd = document.createElement('td');
        dateTd.textContent = r.date;

        const statusTd = document.createElement('td');
        statusTd.style.fontWeight = '600';
        
        const badge = document.createElement('span');
        badge.style.padding = '0.3rem 0.8rem';
        badge.style.borderRadius = '4px';
        badge.style.fontSize = '0.85rem';
        
        if (r.status === 'present') {
            badge.textContent = 'Present';
            badge.style.background = 'rgba(16, 185, 129, 0.1)';
            badge.style.color = '#10b981';
        } else {
            badge.textContent = 'Absent';
            badge.style.background = 'rgba(239, 68, 68, 0.1)';
            badge.style.color = 'var(--primary)';
        }

        statusTd.appendChild(badge);
        row.appendChild(dateTd);
        row.appendChild(statusTd);
        tbody.appendChild(row);
    });
}

// 2. Student Mock Test Workstation
async function loadStudentMockTests() {
    const tbody = document.getElementById('student-tests-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;">Loading batch mock exams...</td></tr>';

    const { data: tests, error } = await secureFetch('/api/student/tests');
    if (error || !tests) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:2rem; color: var(--primary);">${error || 'Failed to load exams.'}</td></tr>`;
        return;
    }

    if (tests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;">No mock tests are assigned to your batch.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    tests.forEach(t => {
        const row = document.createElement('tr');
        
        const subTd = document.createElement('td');
        subTd.textContent = t.subject;
        subTd.style.fontWeight = '600';

        const titleTd = document.createElement('td');
        titleTd.textContent = t.title;

        const durTd = document.createElement('td');
        durTd.textContent = `${t.duration} Mins`;

        const statusTd = document.createElement('td');
        const actTd = document.createElement('td');

        const badge = document.createElement('span');
        badge.style.padding = '0.3rem 0.8rem';
        badge.style.borderRadius = '4px';
        badge.style.fontSize = '0.85rem';
        badge.style.fontWeight = '500';

        if (t.status === 'completed') {
            badge.textContent = 'Solved';
            badge.style.background = 'rgba(16, 185, 129, 0.1)';
            badge.style.color = '#10b981';
            
            statusTd.appendChild(badge);
            
            actTd.textContent = `Score: ${t.score} / ${t.total_questions}`;
            actTd.style.fontWeight = '600';
        } else {
            badge.textContent = 'Pending';
            badge.style.background = 'rgba(245, 158, 11, 0.1)';
            badge.style.color = '#f59e0b';
            
            statusTd.appendChild(badge);

            const startBtn = document.createElement('button');
            startBtn.className = 'btn btn-primary';
            startBtn.style.padding = '0.3rem 0.8rem';
            startBtn.style.fontSize = '0.85rem';
            startBtn.textContent = 'Start Test';
            startBtn.onclick = () => startMockTest(t.id);
            actTd.appendChild(startBtn);
        }

        row.appendChild(subTd);
        row.appendChild(titleTd);
        row.appendChild(durTd);
        row.appendChild(statusTd);
        row.appendChild(actTd);
        tbody.appendChild(row);
    });
}

// 3. Test Taking Modal Logic & Anti-Copy prevention
function disableTestingKeyCombos(e) {
    const ctrlKey = e.ctrlKey || e.metaKey;
    // Block Ctrl+C (67), Ctrl+X (88), Ctrl+U (85), F12 (123)
    if (ctrlKey && (e.keyCode === 67 || e.keyCode === 88 || e.keyCode === 85)) {
        e.preventDefault();
        showToast('Copying question contents is strictly disabled!', 'error');
        return false;
    }
    if (e.keyCode === 123) { // F12
        e.preventDefault();
        showToast('Developer console inspections are disabled!', 'error');
        return false;
    }
}

async function startMockTest(testId) {
    showToast('Loading test workstation...', 'info');
    
    const { data, error } = await secureFetch(`/api/student/tests/${testId}`);
    if (error || !data) {
        showToast(error || 'Failed to fetch test details.', 'error');
        return;
    }

    // Initialize test variables
    activeTest = data;
    activeTestQuestions = data.questions;
    activeQuestionIndex = 0;
    studentAnswers = {};
    timeRemainingSeconds = data.duration * 60;

    // Reset warnings alert
    const alertBox = document.getElementById('test-modal-alert');
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }

    // Set UI Title details
    document.getElementById('test-modal-title').textContent = data.title;
    document.getElementById('test-modal-subject').textContent = data.subject;
    
    // Bind Key Event Blockers for Copy paste / devtools prevention
    document.addEventListener('keydown', disableTestingKeyCombos);

    // Render Question & Start Timer
    renderTestQuestion();
    updateTimerDisplay();
    
    // Open Modal
    document.getElementById('test-taking-modal').style.display = 'flex';
    
    clearInterval(testTimerInterval);
    testTimerInterval = setInterval(() => {
        timeRemainingSeconds--;
        updateTimerDisplay();
        if (timeRemainingSeconds <= 0) {
            clearInterval(testTimerInterval);
            showToast('Time has expired! Auto-submitting answers.', 'warning');
            submitTestAnswers(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('test-modal-timer');
    if (!timerDisplay) return;

    const mins = Math.floor(timeRemainingSeconds / 60);
    const secs = timeRemainingSeconds % 60;
    
    const displayMins = mins < 10 ? '0' + mins : mins;
    const displaySecs = secs < 10 ? '0' + secs : secs;
    
    timerDisplay.textContent = `${displayMins}:${displaySecs}`;
    
    // Alert when less than 1 minute remains
    if (timeRemainingSeconds === 60) {
        timerDisplay.style.color = 'var(--primary)';
        showToast('Only 1 minute remaining!', 'warning');
    }
}

function renderTestQuestion() {
    const q = activeTestQuestions[activeQuestionIndex];
    if (!q) return;

    // Populate question metadata
    document.getElementById('test-question-num').textContent = `Question ${activeQuestionIndex + 1} of ${activeTestQuestions.length}`;
    document.getElementById('test-question-text').textContent = q.question_text;

    // Populate choices choices container
    const container = document.getElementById('test-options-container');
    container.innerHTML = '';

    const options = [
        { key: 'A', val: q.option_a },
        { key: 'B', val: q.option_b },
        { key: 'C', val: q.option_c },
        { key: 'D', val: q.option_d }
    ];

    options.forEach(opt => {
        const choiceBlock = document.createElement('div');
        choiceBlock.style.display = 'flex';
        choiceBlock.style.alignItems = 'center';
        choiceBlock.style.gap = '1rem';
        choiceBlock.style.padding = '1rem';
        choiceBlock.style.border = '1px solid var(--border-color)';
        choiceBlock.style.borderRadius = '8px';
        choiceBlock.style.cursor = 'pointer';
        choiceBlock.style.background = studentAnswers[q.id] === opt.key ? 'rgba(217, 4, 41, 0.05)' : 'transparent';
        choiceBlock.style.borderColor = studentAnswers[q.id] === opt.key ? 'var(--primary)' : 'var(--border-color)';
        choiceBlock.style.transition = 'var(--transition)';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `option-choice-${q.id}`;
        radio.value = opt.key;
        radio.checked = studentAnswers[q.id] === opt.key;
        radio.style.cursor = 'pointer';
        
        const label = document.createElement('span');
        label.textContent = `${opt.key}. ${opt.val}`;
        label.style.fontSize = '1rem';
        label.style.color = 'var(--text-main)';

        choiceBlock.appendChild(radio);
        choiceBlock.appendChild(label);
        
        // Clicking option card selects the choice
        choiceBlock.onclick = () => {
            radio.checked = true;
            studentAnswers[q.id] = opt.key;
            // Redraw highlighting
            document.querySelectorAll('#test-options-container > div').forEach(div => {
                div.style.background = 'transparent';
                div.style.borderColor = 'var(--border-color)';
            });
            choiceBlock.style.background = 'rgba(217, 4, 41, 0.05)';
            choiceBlock.style.borderColor = 'var(--primary)';
        };

        container.appendChild(choiceBlock);
    });

    // Update navigation controls
    const prevBtn = document.getElementById('btn-test-prev');
    const nextBtn = document.getElementById('btn-test-next');
    const submitBtn = document.getElementById('btn-test-submit');

    prevBtn.disabled = activeQuestionIndex === 0;

    if (activeQuestionIndex === activeTestQuestions.length - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
    } else {
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
    }
}

function testPrevQuestion() {
    if (activeQuestionIndex > 0) {
        activeQuestionIndex--;
        renderTestQuestion();
    }
}

function testNextQuestion() {
    if (activeQuestionIndex < activeTestQuestions.length - 1) {
        activeQuestionIndex++;
        renderTestQuestion();
    }
}

async function submitTestAnswers(isAutoSubmit = false) {
    if (!isAutoSubmit && !confirm('Are you sure you want to finish and submit your answers?')) {
        return;
    }

    clearInterval(testTimerInterval);
    
    // Unbind security keyboard filters
    document.removeEventListener('keydown', disableTestingKeyCombos);

    const alertBox = document.getElementById('test-modal-alert');
    if (alertBox) {
        alertBox.style.display = 'none';
    }

    showToast('Evaluating and submitting test answers...', 'info');

    const { data, error } = await secureFetch(`/api/student/tests/${activeTest.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: studentAnswers })
    });

    if (error) {
        showToast(error, 'error');
        // Re-bind listeners if API error occurred so user doesn't cheat before fixing
        document.addEventListener('keydown', disableTestingKeyCombos);
        if (alertBox) {
            alertBox.textContent = error;
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
        }
        return;
    }

    // Hide Modal & Alert Score
    document.getElementById('test-taking-modal').style.display = 'none';
    
    showToast(`Exam completed! Score: ${data.score} / ${data.total_questions} (${data.percentage}%)`, 'success');
    
    // Reload tests dashboard list
    loadStudentMockTests();
}

