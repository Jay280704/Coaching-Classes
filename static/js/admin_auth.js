/**
 * ADMIN PORTAL AUTHENTICATION SCRIPTS - KOLEKAR'S ACADEMY
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    checkAuth(true);

    setupLogin();
    setupForgot();
});

function showAlert(msg, type) {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = 'form-message ' + type;
    alertBox.style.display = 'block';
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

        showAlert('Authenticating admin session...', 'info');

        // Post with role context
        const { data, error } = await secureFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role: 'admin' })
        });

        if (error) {
            showAlert(error, 'error');
            return;
        }

        showAlert('Access granted! Redirecting to command center...', 'success');
        
        setTimeout(() => {
            window.location.href = '/admin';
        }, 800);
    });
}

function showForgotForm(show) {
    const loginForm = document.getElementById('login-container');
    const forgotForm = document.getElementById('forgot-container');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox) alertBox.style.display = 'none';

    if (show) {
        if (loginForm) loginForm.classList.remove('active');
        if (forgotForm) forgotForm.classList.add('active');
    } else {
        if (forgotForm) forgotForm.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
    }
}

function setupForgot() {
    const form = document.getElementById('forgot-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value.trim();
        const phone = document.getElementById('forgot-phone').value.trim(); // Admin secret key
        const new_password = document.getElementById('forgot-password').value;

        if (!email || !phone || !new_password) {
            showAlert('Please fill in all the fields.', 'error');
            return;
        }

        const hasLetter = /[a-zA-Z]/.test(new_password);
        const hasDigit = /[0-9]/.test(new_password);
        if (new_password.length < 8 || !hasLetter || !hasDigit) {
            showAlert('Password must contain at least 8 characters, with letters and numbers combined.', 'error');
            return;
        }

        showAlert('Resetting admin password...', 'info');

        const { data, error } = await secureFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email, phone, new_password, role: 'admin' })
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
