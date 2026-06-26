/**
 * STUDENT PORTAL AUTHENTICATION SCRIPTS - KOLEKAR'S ACADEMY
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    checkAuth(true);

    // Initial check for URL tab options
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const err = urlParams.get('error');

    if (tab === 'register') {
        switchTab('register');
    }
    
    if (err === 'pending') {
        showAlert('Your student account is pending approval by the admin. Please wait or contact support.', 'error');
    }

    setupLogin();
    setupRegister();
    setupForgot();
});

function showAlert(msg, type) {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = 'form-message ' + type;
    alertBox.style.display = 'block';
}

// Tab Swapping Controller
function switchTab(target) {
    const loginTab = document.getElementById('tab-login-btn');
    const registerTab = document.getElementById('tab-register-btn');
    const loginForm = document.getElementById('login-container');
    const registerForm = document.getElementById('register-container');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox) {
        alertBox.style.display = 'none'; // Reset alert status
    }

    if (target === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

// Login Actions Handler
function setupLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showAlert('Please fill in both email and password fields.', 'error');
            return;
        }

        showAlert('Signing in...', 'info');

        // Post with role context
        const { data, error } = await secureFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role: 'student' })
        });

        if (error) {
            showAlert(error, 'error');
            return;
        }

        showAlert('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 800);
    });
}

// Registration Actions Handler
function setupRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const phone = document.getElementById('register-phone').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        if (!name || !email || !phone || !password || !confirm) {
            showAlert('Please fill in all registration fields.', 'error');
            return;
        }

        // Name validation
        if (!/^[a-zA-Z\s]{2,100}$/.test(name)) {
            showAlert('Name must contain letters and spaces only.', 'error');
            return;
        }

        // Phone validation
        if (!/^\+?[0-9]{10,15}$/.test(phone)) {
            showAlert('Phone number must contain between 10 and 15 digits.', 'error');
            return;
        }

        // Password strength verification
        if (password.length < 8 || !anyDigit(password) || !anyLetter(password)) {
            showAlert('Password must contain at least 8 characters, with letters and numbers combined.', 'error');
            return;
        }

        // Confirm password match check
        if (password !== confirm) {
            showAlert('Passwords do not match. Please verify.', 'error');
            return;
        }

        showAlert('Registering account...', 'info');

        const { data, error } = await secureFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, password })
        });

        if (error) {
            showAlert(error, 'error');
            return;
        }

        showAlert(data.message, 'success');
        form.reset();
        
        setTimeout(() => {
            switchTab('login');
        }, 3000);
    });
}

function anyDigit(str) {
    return /\d/.test(str);
}

function anyLetter(str) {
    return /[a-zA-Z]/.test(str);
}

function showForgotForm(show) {
    const loginForm = document.getElementById('login-container');
    const registerForm = document.getElementById('register-container');
    const forgotForm = document.getElementById('forgot-container');
    const tabs = document.querySelector('.auth-tabs');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox) alertBox.style.display = 'none';

    if (show) {
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.remove('active');
        if (forgotForm) forgotForm.classList.add('active');
        if (tabs) tabs.style.display = 'none';
    } else {
        if (forgotForm) forgotForm.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
        if (tabs) tabs.style.display = 'flex';
        // Also select login tab
        const loginTab = document.getElementById('tab-login-btn');
        const registerTab = document.getElementById('tab-register-btn');
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
    }
}

function setupForgot() {
    const form = document.getElementById('forgot-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value.trim();
        const phone = document.getElementById('forgot-phone').value.trim();
        const new_password = document.getElementById('forgot-password').value;

        if (!email || !phone || !new_password) {
            showAlert('Please fill in all the fields.', 'error');
            return;
        }

        if (new_password.length < 8 || !anyDigit(new_password) || !anyLetter(new_password)) {
            showAlert('Password must contain at least 8 characters, with letters and numbers combined.', 'error');
            return;
        }

        showAlert('Resetting password...', 'info');

        const { data, error } = await secureFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email, phone, new_password, role: 'student' })
        });

        if (error) {
            showAlert(error, 'error');
            return;
        }

        showAlert(data.message, 'success');
        form.reset();
        setTimeout(() => {
            showForgotForm(false);
        }, 1500);
    });
}

