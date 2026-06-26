/**
 * PASSWORD RESET PAGE SCRIPTS - KOLEKAR'S ACADEMY
 */

document.addEventListener('DOMContentLoaded', () => {
    setupResetPassword();
});

function showAlert(msg, type) {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = 'form-message ' + type;
    alertBox.style.display = 'block';
}

function setupResetPassword() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = document.getElementById('reset-token').value;
        const password = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (!token) {
            showAlert('Missing or invalid reset token. Please request a new link.', 'error');
            return;
        }

        if (!password || !confirm) {
            showAlert('Please fill in all fields.', 'error');
            return;
        }

        // Strength check
        if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            showAlert('Password must contain at least 8 characters, including both letters and numbers.', 'error');
            return;
        }

        if (password !== confirm) {
            showAlert('Passwords do not match.', 'error');
            return;
        }

        showAlert('Updating password...', 'info');

        const { data, error } = await secureFetch('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });

        if (error) {
            showAlert(error, 'error');
            return;
        }

        showAlert(data.message + ' Redirecting to portal sign in...', 'success');
        form.reset();

        setTimeout(() => {
            window.location.href = '/student/auth';
        }, 3000);
    });
}
