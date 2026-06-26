/**
 * GLOBAL COMMON UTILITIES - KOLEKAR'S ACADEMY
 */

// Helper to make API requests with automated CSRF token inclusion and error handling
async function secureFetch(url, options = {}) {
    // Read the CSRF token from the DOM meta tag
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

    // Merge headers
    options.headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        ...(options.headers || {})
    };

    // Include credentials (cookies)
    options.credentials = 'include';

    try {
        const response = await fetch(url, options);
        
        // Handle 401 Unauthorized redirect to auth page (except for checking auth status or active logging-in)
        if (response.status === 401 && !url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
            window.location.href = '/auth';
            return null;
        }

        const data = await response.json();
        if (!response.ok) {
            return { error: data.error || 'Something went wrong.', status: response.status };
        }

        return { data, status: response.status };
    } catch (err) {
        console.error('Fetch error for ' + url + ':', err);
        return { error: 'Network connection failed. Please try again.', status: 500 };
    }
}

// Global Custom Toast Notification System
function showToast(message, type = 'success') {
    // Remove existing toast if any
    const existing = document.getElementById('academy-toast');
    if (existing) {
        existing.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'academy-toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Apply basic styles dynamically (keeps CSS clean)
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem 2rem',
        borderRadius: '8px',
        color: '#fff',
        fontWeight: '600',
        zIndex: '10000',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        transform: 'translateY(100px)',
        opacity: '0'
    });

    if (type === 'success') {
        toast.style.background = '#10b981';
        toast.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    } else if (type === 'error') {
        toast.style.background = '#ef4444';
        toast.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    } else {
        toast.style.background = '#f59e0b';
        toast.style.border = '1px solid rgba(245, 158, 11, 0.2)';
    }

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);

    // Fade out and remove
    setTimeout(() => {
        toast.style.transform = 'translateY(50px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Check authentication status on protected layouts
async function checkAuth(redirectIfFound = false) {
    const currentPath = window.location.pathname;
    const isAdminPage = currentPath.startsWith('/admin');
    const isStudentPage = currentPath.startsWith('/student') || currentPath.startsWith('/dashboard');
    
    let url = '/api/auth/me';
    if (isAdminPage) {
        url += '?role=admin';
    } else if (isStudentPage) {
        url += '?role=student';
    }

    const { data, error } = await secureFetch(url);
    if (error || !data || !data.authenticated) {
        if (!redirectIfFound && !currentPath.endsWith('/auth') && currentPath !== '/') {
            window.location.href = '/auth';
        }
        return null;
    }

    // If authenticated, we can optionally redirect to portals (only if matching the current portal type)
    if (redirectIfFound) {
        if ((data.user.role === 'admin' || data.user.role === 'teacher') && currentPath.includes('/admin/auth')) {
            window.location.href = '/admin';
        } else if (data.user.role === 'student' && currentPath.includes('/student/auth')) {
            window.location.href = '/dashboard';
        }
    }

    return data.user;
}

// Global mobile menu toggler
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navAuth = document.querySelector('.nav-auth');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (navAuth) navAuth.classList.toggle('active');
        });
    }

    // Sidebar toggler for dashboards
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        // Create overlay element if not present
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close sidebar when a navigation link is clicked
        const sidebarLinks = sidebar.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }

    // Dynamic header styling on scroll
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
});
