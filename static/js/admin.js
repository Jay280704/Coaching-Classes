/**
 * ADMIN COMMAND CENTER CONTROLLER - KOLEKAR'S ACADEMY
 */

let currentUser = null;
let allBatches = [];
let allStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Authenticate and load profile info
    currentUser = await checkAuth();
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) {
        window.location.href = '/auth';
        return;
    }

    if (currentUser.role === 'teacher') {
        adjustUIForTeacher();
    } else {
        loadAdminStats();
        setupTopperForm();
        setupTeacherForm();
        setupCourseForm();
    }
    setupAnswerForm();
    initAttendanceAndTests();
});

// View switcher routing
function showView(viewId) {
    if (currentUser && currentUser.role === 'teacher' && ['overview', 'students', 'enquiries', 'toppers', 'teachers', 'courses'].includes(viewId)) {
        showView('doubts');
        return;
    }

    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(l => l.classList.remove('active'));
    
    const targetLink = document.getElementById(`nav-${viewId}`);
    if (targetLink) targetLink.classList.add('active');

    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    const titleEl = document.getElementById('view-title');
    const subEl = document.getElementById('view-subtitle');

    if (viewId === 'overview') {
        titleEl.textContent = 'Admin Command Center';
        subEl.textContent = 'Overview stats and configuration guidelines';
        loadAdminStats();
    } else if (viewId === 'students') {
        titleEl.textContent = 'Admissions Database';
        subEl.textContent = 'Approve pending signups and assign students to active batches';
        loadStudentsAndBatches();
    } else if (viewId === 'attendance') {
        titleEl.textContent = 'Track Batch Attendance';
        subEl.textContent = 'Log student daily attendance records';
        loadAttendanceBatches();
    } else if (viewId === 'tests') {
        titleEl.textContent = 'Mock Test Command';
        subEl.textContent = 'Publish mock exams and audit student scores';
        loadMockTestsPanel();
    } else if (viewId === 'doubts') {
        titleEl.textContent = 'Doubt Solver Portal';
        subEl.textContent = 'View and reply to student query posts';
        loadAdminDoubts();
    } else if (viewId === 'enquiries') {
        titleEl.textContent = 'Public Enquiries Inbox';
        subEl.textContent = 'Manage registration enquiries submitted from landing contact form';
        loadAdminEnquiries();
    } else if (viewId === 'toppers') {
        titleEl.textContent = 'Manage Class Toppers';
        subEl.textContent = 'Add or remove toppers showcase on landing page';
        loadAdminToppers();
    } else if (viewId === 'teachers') {
        titleEl.textContent = 'Manage Teacher Accounts';
        subEl.textContent = 'Add, view, and delete subject teachers';
        loadAdminTeachers();
    } else if (viewId === 'courses') {
        titleEl.textContent = 'Manage Course Programs';
        subEl.textContent = 'Add, modify, or retire coaching programs';
        loadAdminCourses();
    }
}

// Load statistics widgets
async function loadAdminStats() {
    const { data, error } = await secureFetch('/api/admin/stats');
    if (error) {
        showToast('Failed to load stats dashboard.', 'error');
        return;
    }

    if (data) {
        document.getElementById('stat-total-students').textContent = data.total_students;
        document.getElementById('stat-pending').textContent = data.pending_students;
        document.getElementById('stat-open-doubts').textContent = data.open_doubts;
        document.getElementById('stat-enquiries').textContent = data.new_enquiries;
    }
}

// Fetch lists of batches & students to load the tables
async function loadStudentsAndBatches() {
    // 1. Fetch batches first
    const batchesRes = await secureFetch('/api/batches');
    if (batchesRes.error) {
        showToast('Failed to load batches list.', 'error');
        return;
    }
    allBatches = batchesRes.data || [];

    // 2. Fetch student profiles
    const studentsRes = await secureFetch('/api/admin/students');
    if (studentsRes.error) {
        showToast('Failed to load students directory.', 'error');
        return;
    }
    allStudents = studentsRes.data || [];

    renderStudentsTable();
}

// Render the students administration table
function renderStudentsTable() {
    const tbody = document.getElementById('admin-students-table-body');
    if (!tbody) return;

    if (allStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:2rem;">No students registered.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    allStudents.forEach(student => {
        const row = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.style.fontWeight = '600';
        nameTd.textContent = student.name;

        const emailTd = document.createElement('td');
        emailTd.textContent = student.email;

        const phoneTd = document.createElement('td');
        phoneTd.textContent = student.profile ? student.profile.phone : 'N/A';

        // Status badge
        const statusTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `badge ${student.status === 'approved' ? 'badge-success' : 'badge-warning'}`;
        badge.textContent = student.status;
        statusTd.appendChild(badge);

        // Batch Dropdown Selection
        const batchTd = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'form-control';
        select.style.padding = '0.4rem 0.8rem';
        select.style.fontSize = '0.85rem';

        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = 'Not Assigned';
        select.appendChild(optDefault);

        allBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (${b.timing})`;
            
            // Mark selected if matches
            if (student.profile && student.profile.batch_id === b.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        // Trigger batch update API call on dropdown change
        select.addEventListener('change', async () => {
            const batchId = select.value ? parseInt(select.value) : null;
            const { data, error } = await secureFetch(`/api/admin/students/${student.id}/batch`, {
                method: 'POST',
                body: JSON.stringify({ batch_id: batchId })
            });

            if (error) {
                showToast(error, 'error');
                // Reload list to revert dropdown state
                loadStudentsAndBatches();
            } else {
                showToast('Batch assignment updated successfully!');
            }
        });

        batchTd.appendChild(select);

        // Action Column (Approve buttons)
        const actionTd = document.createElement('td');
        if (student.status === 'pending') {
            const btnApprove = document.createElement('button');
            btnApprove.className = 'btn btn-accent';
            btnApprove.style.padding = '0.4rem 1rem';
            btnApprove.style.fontSize = '0.8rem';
            btnApprove.textContent = 'Approve';
            btnApprove.addEventListener('click', async () => {
                const { data, error } = await secureFetch(`/api/admin/students/${student.id}/approve`, { method: 'POST' });
                if (error) {
                    showToast(error, 'error');
                } else {
                    showToast(data.message);
                    loadStudentsAndBatches(); // Refresh table
                }
            });
            actionTd.appendChild(btnApprove);
        } else {
            actionTd.textContent = 'Active';
            actionTd.style.fontSize = '0.9rem';
            actionTd.style.color = 'var(--text-muted)';
        }

        row.appendChild(nameTd);
        row.appendChild(emailTd);
        row.appendChild(phoneTd);
        row.appendChild(statusTd);
        row.appendChild(batchTd);
        row.appendChild(actionTd);

        tbody.appendChild(row);
    });
}


// Load submitted student doubt items
async function loadAdminDoubts() {
    const container = document.getElementById('admin-doubts-container');
    const { data, error } = await secureFetch('/api/admin/doubts');

    if (error || !data || data.length === 0) {
        container.innerHTML = `<div class="text-center" style="padding:2rem; color:var(--text-muted);">No doubts logs submitted by students.</div>`;
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
        title.textContent = `${d.student_name}: ${d.title}`;

        const badge = document.createElement('span');
        badge.className = `badge ${d.status === 'resolved' ? 'badge-success' : 'badge-warning'}`;
        badge.textContent = d.status;

        header.appendChild(title);
        header.appendChild(badge);

        const desc = document.createElement('p');
        desc.className = 'doubt-item-desc';
        desc.textContent = d.description;

        item.appendChild(header);
        item.appendChild(desc);

        if (d.status === 'resolved') {
            const ansDiv = document.createElement('div');
            ansDiv.className = 'doubt-item-answer';

            const ansHeader = document.createElement('div');
            ansHeader.className = 'answer-header';
            ansHeader.textContent = `Solution logged by: ${d.answered_by_name || 'Admin'}`;

            const ansText = document.createElement('p');
            ansText.className = 'answer-text';
            ansText.textContent = d.answer;

            ansDiv.appendChild(ansHeader);
            ansDiv.appendChild(ansText);
            item.appendChild(ansDiv);
        } else {
            // Include Answer Action button
            const btnAnswer = document.createElement('button');
            btnAnswer.className = 'btn btn-primary';
            btnAnswer.style.padding = '0.5rem 1.2rem';
            btnAnswer.style.fontSize = '0.85rem';
            btnAnswer.style.marginTop = '0.5rem';
            btnAnswer.textContent = 'Write Response';
            btnAnswer.addEventListener('click', () => {
                openAnswerModal(d.id, d.title, d.description, d.student_name);
            });
            item.appendChild(btnAnswer);
        }

        container.appendChild(item);
    });
}

// Answer Modal display controllers
function openAnswerModal(id, title, desc, studentName) {
    document.getElementById('answer-doubt-id').value = id;
    document.getElementById('answer-modal-student').textContent = `Student: ${studentName}`;
    document.getElementById('answer-modal-title').textContent = title;
    document.getElementById('answer-modal-desc').textContent = desc;

    document.getElementById('answer-modal').classList.add('active');
}

function closeAnswerModal() {
    document.getElementById('answer-modal').classList.remove('active');
    document.getElementById('answer-form').reset();
    document.getElementById('answer-alert').style.display = 'none';
}

function setupAnswerForm() {
    const form = document.getElementById('answer-form');
    const alertBox = document.getElementById('answer-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('answer-doubt-id').value;
        const answer = document.getElementById('answer-text').value.trim();

        if (!id || !answer) {
            alertBox.textContent = 'Please draft a solution text before submitting.';
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        const { data, error } = await secureFetch(`/api/admin/doubts/${id}/answer`, {
            method: 'POST',
            body: JSON.stringify({ answer })
        });

        if (error) {
            alertBox.textContent = error;
            alertBox.className = 'form-message error';
            alertBox.style.display = 'block';
            return;
        }

        showToast('Solution submitted successfully!');
        closeAnswerModal();
        loadAdminDoubts(); // Refresh logs
    });
}

// Load enquiries list
async function loadAdminEnquiries() {
    const tbody = document.getElementById('admin-enquiries-table-body');
    if (!tbody) return;

    const { data, error } = await secureFetch('/api/admin/enquiries');
    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem;">No enquiries inbox entries logged.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    data.forEach(e => {
        const row = document.createElement('tr');

        const dateTd = document.createElement('td');
        dateTd.textContent = e.created_at.substring(0, 10);

        const nameTd = document.createElement('td');
        nameTd.style.fontWeight = '600';
        nameTd.textContent = e.name;

        const contactTd = document.createElement('td');
        contactTd.innerHTML = `${e.email}<br><span style="font-size:0.8rem; color:var(--text-muted);">${e.phone}</span>`;

        const courseTd = document.createElement('td');
        courseTd.textContent = e.course_interest || 'General';

        const msgTd = document.createElement('td');
        msgTd.style.maxWidth = '250px';
        msgTd.style.overflow = 'hidden';
        msgTd.style.textOverflow = 'ellipsis';
        msgTd.style.whiteSpace = 'nowrap';
        msgTd.textContent = e.message;
        msgTd.title = e.message; // Hover tooltip

        const statusTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `badge ${e.status === 'resolved' ? 'badge-success' : 'badge-warning'}`;
        badge.textContent = e.status;
        statusTd.appendChild(badge);

        const actionTd = document.createElement('td');
        if (e.status === 'new') {
            const btnResolve = document.createElement('button');
            btnResolve.className = 'btn btn-primary';
            btnResolve.style.padding = '0.4rem 0.8rem';
            btnResolve.style.fontSize = '0.8rem';
            btnResolve.textContent = 'Resolve';
            btnResolve.addEventListener('click', async () => {
                const { data, error } = await secureFetch(`/api/admin/enquiries/${e.id}/resolve`, { method: 'POST' });
                if (error) {
                    showToast(error, 'error');
                } else {
                    showToast('Enquiry resolved.');
                    loadAdminEnquiries(); // Refresh table
                }
            });
            actionTd.appendChild(btnResolve);
        } else {
            actionTd.textContent = 'Resolved';
            actionTd.style.fontSize = '0.9rem';
            actionTd.style.color = 'var(--text-muted)';
        }

        row.appendChild(dateTd);
        row.appendChild(nameTd);
        row.appendChild(contactTd);
        row.appendChild(courseTd);
        row.appendChild(msgTd);
        row.appendChild(statusTd);
        row.appendChild(actionTd);

        tbody.appendChild(row);
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

let creatorQuestionIndex = 0;

// Initialize form controls and details
function initAttendanceAndTests() {
    // Set date input to today
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Set up test creator form submit
    const testForm = document.getElementById('test-creator-form');
    if (testForm) {
        testForm.addEventListener('submit', handlePublishTest);
    }
}

// 1. Attendance Management
async function loadAttendanceBatches() {
    const { data: batches, error } = await secureFetch('/api/batches');
    const select = document.getElementById('attendance-batch-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose Batch --</option>';
    if (error || !batches) {
        showToast('Failed to load batches for attendance.', 'error');
        return;
    }

    batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name} (${b.timing})`;
        select.appendChild(opt);
    });
}

async function loadAttendanceList() {
    const batchId = document.getElementById('attendance-batch-select').value;
    const date = document.getElementById('attendance-date').value;
    const tbody = document.getElementById('attendance-table-body');
    const actionsDiv = document.getElementById('attendance-actions');
    const alertBox = document.getElementById('attendance-alert');

    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }

    if (!batchId || !date) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:2rem;">Please select a batch and date.</td></tr>';
        if (actionsDiv) actionsDiv.style.display = 'none';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:2rem;">Loading student registry...</td></tr>';
    if (actionsDiv) actionsDiv.style.display = 'none';

    const { data, error } = await secureFetch(`/api/admin/attendance?batch_id=${batchId}&date=${date}`);
    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center" style="padding:2rem; color: var(--primary);">${error || 'Failed to load students.'}</td></tr>`;
        return;
    }

    if (data.students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:2rem;">No students assigned to this batch.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.students.forEach(s => {
        const row = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        nameTd.textContent = s.name;
        nameTd.style.fontWeight = '500';

        const statusTd = document.createElement('td');
        
        // Present Radio
        const labelPresent = document.createElement('label');
        labelPresent.style.marginRight = '1.5rem';
        labelPresent.style.cursor = 'pointer';
        labelPresent.style.display = 'inline-flex';
        labelPresent.style.alignItems = 'center';
        labelPresent.style.gap = '0.4rem';
        
        const radPresent = document.createElement('input');
        radPresent.type = 'radio';
        radPresent.name = `att-status-${s.id}`;
        radPresent.value = 'present';
        radPresent.checked = s.status === 'present';
        
        labelPresent.appendChild(radPresent);
        labelPresent.appendChild(document.createTextNode('Present'));

        // Absent Radio
        const labelAbsent = document.createElement('label');
        labelAbsent.style.cursor = 'pointer';
        labelAbsent.style.display = 'inline-flex';
        labelAbsent.style.alignItems = 'center';
        labelAbsent.style.gap = '0.4rem';
        
        const radAbsent = document.createElement('input');
        radAbsent.type = 'radio';
        radAbsent.name = `att-status-${s.id}`;
        radAbsent.value = 'absent';
        radAbsent.checked = s.status === 'absent';
        
        labelAbsent.appendChild(radAbsent);
        labelAbsent.appendChild(document.createTextNode('Absent'));

        statusTd.appendChild(labelPresent);
        statusTd.appendChild(labelAbsent);

        row.appendChild(nameTd);
        row.appendChild(statusTd);
        tbody.appendChild(row);
    });

    if (actionsDiv) actionsDiv.style.display = 'block';
}

async function saveAttendance() {
    const batchId = document.getElementById('attendance-batch-select').value;
    const date = document.getElementById('attendance-date').value;
    const alertBox = document.getElementById('attendance-alert');
    
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }

    const rows = document.querySelectorAll('#attendance-table-body tr');
    const records = [];

    rows.forEach(row => {
        const presentRad = row.querySelector('input[value="present"]');
        const absentRad = row.querySelector('input[value="absent"]');
        if (!presentRad || !absentRad) return;

        const studentId = presentRad.name.split('-').pop();
        let status = '';
        if (presentRad.checked) status = 'present';
        else if (absentRad.checked) status = 'absent';

        if (status) {
            records.push({ student_id: parseInt(studentId), status });
        }
    });

    if (records.length === 0) {
        showToast('No student attendance statuses marked.', 'warning');
        return;
    }

    showToast('Saving batch attendance...', 'info');

    const { data, error } = await secureFetch('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({ batch_id: parseInt(batchId), date, records })
    });

    if (error) {
        if (alertBox) {
            alertBox.className = 'form-message error';
            alertBox.textContent = error;
            alertBox.style.display = 'block';
        }
        showToast('Failed to save attendance.', 'error');
        return;
    }

    if (alertBox) {
        alertBox.className = 'form-message success';
        alertBox.textContent = data.message;
        alertBox.style.display = 'block';
    }
    showToast('Attendance updated successfully.');
}

// 2. Mock Test Panel
async function loadMockTestsPanel() {
    toggleTestPanel('list');
    
    // Load Batch Selectors
    const { data: batches, error } = await secureFetch('/api/batches');
    const select = document.getElementById('test-batch-select');
    if (select) {
        select.innerHTML = '<option value="">-- Target Batch --</option>';
        if (batches) {
            batches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.name} (${b.timing})`;
                select.appendChild(opt);
            });
        }
    }

    // Load Tests Table
    const tbody = document.getElementById('admin-tests-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;">Loading mock tests list...</td></tr>';

    const { data: tests, error: errTests } = await secureFetch('/api/admin/tests');
    if (errTests || !tests) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:2rem; color: var(--primary);">${errTests || 'Failed to load tests.'}</td></tr>`;
        return;
    }

    if (tests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;">No mock tests have been published yet.</td></tr>';
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

        const batchTd = document.createElement('td');
        batchTd.textContent = t.batch_name;

        const durTd = document.createElement('td');
        durTd.textContent = `${t.duration} Mins`;

        const actTd = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-primary';
        viewBtn.style.padding = '0.3rem 0.8rem';
        viewBtn.style.fontSize = '0.85rem';
        viewBtn.textContent = 'View Scores';
        viewBtn.onclick = () => loadTestSubmissions(t.id, t.title);

        actTd.appendChild(viewBtn);

        row.appendChild(subTd);
        row.appendChild(titleTd);
        row.appendChild(batchTd);
        row.appendChild(durTd);
        row.appendChild(actTd);
        tbody.appendChild(row);
    });
}

function toggleTestPanel(panel) {
    const listPanel = document.getElementById('test-list-panel');
    const createPanel = document.getElementById('test-create-panel');
    const subContainer = document.getElementById('test-submissions-container');

    if (panel === 'list') {
        listPanel.style.display = 'block';
        createPanel.style.display = 'none';
    } else {
        listPanel.style.display = 'none';
        createPanel.style.display = 'block';
        if (subContainer) subContainer.style.display = 'none';
        
        // Reset Creator Form
        const form = document.getElementById('test-creator-form');
        if (form) form.reset();
        document.getElementById('questions-builder-container').innerHTML = '';
        creatorQuestionIndex = 0;
        addCreatorQuestion(); // Add first default question
    }
}

function addCreatorQuestion() {
    creatorQuestionIndex++;
    const container = document.getElementById('questions-builder-container');
    if (!container) return;

    const div = document.createElement('div');
    div.id = `creator-q-block-${creatorQuestionIndex}`;
    div.className = 'creator-q-card';
    div.style.background = 'rgba(0,0,0,0.01)';
    div.style.border = '1px solid var(--border-color)';
    div.style.padding = '1.5rem';
    div.style.borderRadius = '12px';
    div.style.marginBottom = '1.5rem';
    div.style.position = 'relative';

    div.innerHTML = `
        <button type="button" class="btn" style="position: absolute; top: 1rem; right: 1rem; padding: 0.2rem 0.6rem; color: var(--primary); font-size: 0.85rem;" onclick="removeCreatorQuestion(${creatorQuestionIndex})">Remove</button>
        <h5 style="margin-bottom: 1rem; color: var(--accent); font-size: 1rem;">Question #${creatorQuestionIndex}</h5>
        
        <div class="form-group">
            <label>Question Description / Equation</label>
            <textarea class="form-control q-text" placeholder="e.g. Find the derivative of f(x) = sin(x^2)" required style="min-height:70px;"></textarea>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Option A</label>
                <input type="text" class="form-control q-a" placeholder="Option A" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Option B</label>
                <input type="text" class="form-control q-b" placeholder="Option B" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Option C</label>
                <input type="text" class="form-control q-c" placeholder="Option C" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Option D</label>
                <input type="text" class="form-control q-d" placeholder="Option D" required>
            </div>
        </div>
        
        <div class="form-group" style="max-width: 250px; margin-bottom: 0;">
            <label>Correct Answer Key</label>
            <select class="form-control q-correct" required>
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
            </select>
        </div>
    `;
    container.appendChild(div);
}

function removeCreatorQuestion(index) {
    const block = document.getElementById(`creator-q-block-${index}`);
    if (block) block.remove();
}

async function handlePublishTest(e) {
    e.preventDefault();

    const title = document.getElementById('test-title').value.trim();
    const subject = document.getElementById('test-subject').value;
    const batchId = document.getElementById('test-batch-select').value;
    const duration = document.getElementById('test-duration').value;
    const alertBox = document.getElementById('test-create-alert');

    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }

    const questionBlocks = document.querySelectorAll('#questions-builder-container > div');
    const questions = [];

    questionBlocks.forEach(block => {
        const text = block.querySelector('.q-text').value.trim();
        const a = block.querySelector('.q-a').value.trim();
        const b = block.querySelector('.q-b').value.trim();
        const c = block.querySelector('.q-c').value.trim();
        const d = block.querySelector('.q-d').value.trim();
        const correct = block.querySelector('.q-correct').value;

        if (text && a && b && c && d && correct) {
            questions.push({
                question_text: text,
                option_a: a,
                option_b: b,
                option_c: c,
                option_d: d,
                correct_option: correct
            });
        }
    });

    if (questions.length === 0) {
        showToast('Please add at least one question.', 'warning');
        return;
    }

    showToast('Publishing mock test...', 'info');

    const { data, error } = await secureFetch('/api/admin/tests', {
        method: 'POST',
        body: JSON.stringify({
            title,
            subject,
            batch_id: parseInt(batchId),
            duration: parseInt(duration),
            questions
        })
    });

    if (error) {
        if (alertBox) {
            alertBox.className = 'form-message error';
            alertBox.textContent = error;
            alertBox.style.display = 'block';
        }
        showToast('Failed to publish mock test.', 'error');
        return;
    }

    showToast('Mock test published successfully!');
    toggleTestPanel('list');
    loadMockTestsPanel();
}

async function loadTestSubmissions(testId, testTitle) {
    const container = document.getElementById('test-submissions-container');
    const titleEl = document.getElementById('submissions-panel-title');
    const tbody = document.getElementById('test-submissions-table-body');

    if (!container || !tbody) return;

    titleEl.textContent = `Score Reports: ${testTitle}`;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:1.5rem;">Loading submissions...</td></tr>';
    container.style.display = 'block';

    const { data, error } = await secureFetch(`/api/admin/tests/${testId}/submissions`);
    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding:1.5rem; color: var(--primary);">${error || 'Failed to load submissions.'}</td></tr>`;
        return;
    }

    if (data.submissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:1.5rem;">No students have solved this mock test yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.submissions.forEach(s => {
        const row = document.createElement('tr');
        
        const dateTd = document.createElement('td');
        const d = new Date(s.submitted_at);
        dateTd.textContent = d.toLocaleString();

        const nameTd = document.createElement('td');
        nameTd.textContent = s.student_name;
        nameTd.style.fontWeight = '500';

        const scoreTd = document.createElement('td');
        scoreTd.textContent = `${s.score} / ${s.total_questions}`;

        const pctTd = document.createElement('td');
        pctTd.textContent = `${s.percentage}%`;
        pctTd.style.fontWeight = '600';
        pctTd.style.color = s.percentage >= 40 ? '#10b981' : 'var(--primary)';

        row.appendChild(dateTd);
        row.appendChild(nameTd);
        row.appendChild(scoreTd);
        row.appendChild(pctTd);
        tbody.appendChild(row);
    });
}

// TOPPER MANAGEMENT FUNCTIONS
async function loadAdminToppers() {
    const tbody = document.getElementById('admin-toppers-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem;">Loading toppers list...</td></tr>';

    const { data, error } = await secureFetch('/api/toppers');
    if (error) {
        showToast('Failed to load toppers.', 'error');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem; color:var(--primary);">Failed to load toppers list.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem; color:var(--text-muted);">No toppers added yet. Add your first topper above!</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(t => {
        const tr = document.createElement('tr');

        // Image TD
        const imgTd = document.createElement('td');
        const img = document.createElement('img');
        img.src = t.image_path;
        img.alt = t.name;
        img.style.width = '45px';
        img.style.height = '45px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        img.style.border = '2px solid var(--border-color)';
        imgTd.appendChild(img);

        // Name TD
        const nameTd = document.createElement('td');
        nameTd.textContent = t.name;
        nameTd.style.fontWeight = '600';

        // Score TD
        const scoreTd = document.createElement('td');
        scoreTd.textContent = t.score;

        // Exam TD
        const examTd = document.createElement('td');
        examTd.textContent = t.exam;

        // Year TD
        const yearTd = document.createElement('td');
        yearTd.textContent = t.year;

        // Action TD (Delete button)
        const actionTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-primary';
        delBtn.style.padding = '0.4rem 0.8rem';
        delBtn.style.fontSize = '0.85rem';
        delBtn.style.background = 'var(--primary)';
        delBtn.style.border = 'none';
        delBtn.textContent = 'Remove';
        delBtn.onclick = () => deleteTopper(t.id);
        actionTd.appendChild(delBtn);

        tr.appendChild(imgTd);
        tr.appendChild(nameTd);
        tr.appendChild(scoreTd);
        tr.appendChild(examTd);
        tr.appendChild(yearTd);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
    });
}

function setupTopperForm() {
    const form = document.getElementById('add-topper-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

        showToast('Uploading and adding topper...', 'info');

        try {
            const response = await fetch('/api/admin/toppers', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                showToast(result.error || 'Failed to add topper.', 'error');
                return;
            }

            showToast('Topper added successfully!', 'success');
            form.reset();
            loadAdminToppers();
        } catch (err) {
            console.error(err);
            showToast('Network error adding topper.', 'error');
        }
    });
}

async function deleteTopper(topperId) {
    if (!confirm('Are you sure you want to remove this topper?')) return;

    showToast('Deleting topper...', 'info');

    const { data, error } = await secureFetch(`/api/admin/toppers/${topperId}`, {
        method: 'DELETE'
    });

    if (error) {
        showToast(error, 'error');
        return;
    }

    showToast('Topper deleted successfully!', 'success');
    loadAdminToppers();
}

// ----------------- TEACHER MANAGEMENT SYSTEM LOGIC -----------------

function adjustUIForTeacher() {
    // Hide all elements with the 'admin-only' class
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = 'none');

    // Update user role UI element in the sidebar footer
    const roleSpan = document.querySelector('.user-role');
    if (roleSpan) {
        roleSpan.textContent = `Teacher (${currentUser.subject})`;
    }

    // Adjust Mock Tests Creator Form subject selection
    const testSubjectSelect = document.getElementById('test-subject');
    if (testSubjectSelect) {
        testSubjectSelect.value = currentUser.subject;
        testSubjectSelect.disabled = true; // Disable editing
    }

    // Set default active view to doubts
    showView('doubts');
}

async function loadAdminTeachers() {
    const tbody = document.getElementById('admin-teachers-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;">Loading teachers list...</td></tr>';

    const { data, error } = await secureFetch('/api/admin/teachers');
    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding:2rem; color: var(--primary);">${error || 'Failed to load teachers.'}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No teacher accounts created yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(t => {
        const row = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = t.name;
        nameTd.style.fontWeight = '600';

        const emailTd = document.createElement('td');
        emailTd.textContent = t.email;

        const subjectTd = document.createElement('td');
        subjectTd.textContent = t.subject;
        subjectTd.style.fontWeight = '500';

        const actionTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-primary';
        delBtn.style.padding = '0.4rem 0.8rem';
        delBtn.style.fontSize = '0.85rem';
        delBtn.textContent = 'Delete';
        delBtn.onclick = () => deleteTeacher(t.id);
        actionTd.appendChild(delBtn);

        row.appendChild(nameTd);
        row.appendChild(emailTd);
        row.appendChild(subjectTd);
        row.appendChild(actionTd);
        tbody.appendChild(row);
    });
}

function setupTeacherForm() {
    const form = document.getElementById('add-teacher-form');
    const alertBox = document.getElementById('teacher-create-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (alertBox) {
            alertBox.style.display = 'none';
            alertBox.textContent = '';
        }

        const name = document.getElementById('teacher-name').value.trim();
        const email = document.getElementById('teacher-email').value.trim();
        const password = document.getElementById('teacher-password').value;
        const subject = document.getElementById('teacher-subject').value;

        if (!name || !email || !password || !subject) {
            showToast('All fields are required.', 'error');
            return;
        }

        showToast('Creating teacher account...', 'info');

        const { data, error } = await secureFetch('/api/admin/teachers', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, subject })
        });

        if (error) {
            if (alertBox) {
                alertBox.className = 'form-message error';
                alertBox.textContent = error;
                alertBox.style.display = 'block';
            }
            showToast('Failed to create teacher account.', 'error');
            return;
        }

        showToast('Teacher account created successfully!', 'success');
        form.reset();
        loadAdminTeachers();
    });
}

async function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;

    showToast('Deleting teacher account...', 'info');

    const { data, error } = await secureFetch(`/api/admin/teachers/${teacherId}`, {
        method: 'DELETE'
    });

    if (error) {
        showToast(error, 'error');
        return;
    }

    showToast('Teacher account deleted successfully.', 'success');
    loadAdminTeachers();
}

// ----------------- COURSE MANAGEMENT SYSTEM LOGIC -----------------

function openCourseModal(editMode = false) {
    const modal = document.getElementById('course-modal');
    if (!modal) return;
    
    const title = document.getElementById('course-modal-title');
    const submitBtn = document.getElementById('btn-course-submit');
    const form = document.getElementById('course-form');
    const alertBox = document.getElementById('course-modal-alert');
    
    if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }
    
    if (!editMode) {
        if (form) form.reset();
        document.getElementById('course-edit-id').value = '';
        if (title) title.textContent = 'Add New Course';
        if (submitBtn) submitBtn.textContent = 'Create Course Program';
    } else {
        if (title) title.textContent = 'Edit Course Program';
        if (submitBtn) submitBtn.textContent = 'Save Course Settings';
    }
    
    modal.classList.add('active');
}

function closeCourseModal() {
    const modal = document.getElementById('course-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    const form = document.getElementById('course-form');
    if (form) form.reset();
}

async function loadAdminCourses() {
    const tbody = document.getElementById('admin-courses-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem;">Loading course registry...</td></tr>';

    const { data, error } = await secureFetch('/api/courses');
    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding:2rem; color: var(--primary);">${error || 'Failed to load courses.'}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">No course programs registered yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(c => {
        const row = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = c.name;
        nameTd.style.fontWeight = '600';

        const durationTd = document.createElement('td');
        durationTd.textContent = c.duration;

        const feesTd = document.createElement('td');
        feesTd.textContent = `₹${c.fees.toLocaleString('en-IN')}`;
        feesTd.style.fontWeight = '500';

        const actionTd = document.createElement('td');
        actionTd.style.display = 'flex';
        actionTd.style.gap = '0.5rem';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary';
        editBtn.style.padding = '0.4rem 0.8rem';
        editBtn.style.fontSize = '0.85rem';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => editCourse(c.id);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-primary';
        delBtn.style.padding = '0.4rem 0.8rem';
        delBtn.style.fontSize = '0.85rem';
        delBtn.textContent = 'Delete';
        delBtn.onclick = () => deleteCourse(c.id);

        actionTd.appendChild(editBtn);
        actionTd.appendChild(delBtn);

        row.appendChild(nameTd);
        row.appendChild(durationTd);
        row.appendChild(feesTd);
        row.appendChild(actionTd);
        tbody.appendChild(row);
    });
}

function setupCourseForm() {
    const form = document.getElementById('course-form');
    const alertBox = document.getElementById('course-modal-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (alertBox) {
            alertBox.style.display = 'none';
            alertBox.textContent = '';
        }

        const editId = document.getElementById('course-edit-id').value;
        const name = document.getElementById('course-name').value.trim();
        const description = document.getElementById('course-desc').value.trim();
        const fees = document.getElementById('course-fees').value;
        const duration = document.getElementById('course-duration').value.trim();
        const syllabus = document.getElementById('course-syllabus').value.trim();

        if (!name || !description || fees === '' || !duration || !syllabus) {
            showToast('All fields are required.', 'error');
            return;
        }

        const isEdit = !!editId;
        const url = isEdit ? `/api/admin/courses/${editId}` : '/api/admin/courses';
        const method = isEdit ? 'PUT' : 'POST';

        showToast(isEdit ? 'Updating course settings...' : 'Creating course program...', 'info');

        const { data, error } = await secureFetch(url, {
            method: method,
            body: JSON.stringify({ name, description, fees: parseInt(fees), duration, syllabus })
        });

        if (error) {
            if (alertBox) {
                alertBox.className = 'form-message error';
                alertBox.textContent = error;
                alertBox.style.display = 'block';
            }
            showToast('Failed to save course program.', 'error');
            return;
        }

        showToast(isEdit ? 'Course program updated successfully!' : 'Course program created successfully!', 'success');
        closeCourseModal();
        loadAdminCourses();
    });
}

async function editCourse(courseId) {
    showToast('Fetching course parameters...', 'info');
    
    const { data, error } = await secureFetch(`/api/courses/${courseId}`);
    if (error || !data) {
        showToast(error || 'Failed to load course details.', 'error');
        return;
    }

    document.getElementById('course-edit-id').value = data.id;
    document.getElementById('course-name').value = data.name;
    document.getElementById('course-desc').value = data.description;
    document.getElementById('course-fees').value = data.fees;
    document.getElementById('course-duration').value = data.duration;
    document.getElementById('course-syllabus').value = data.syllabus;

    openCourseModal(true);
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to retire and delete this course program?')) return;

    showToast('Deleting course program...', 'info');

    const { data, error } = await secureFetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE'
    });

    if (error) {
        showToast(error, 'error');
        return;
    }

    showToast('Course program deleted successfully.', 'success');
    loadAdminCourses();
}

