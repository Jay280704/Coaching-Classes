import os
import re
import time
import secrets
from datetime import datetime, timedelta
from collections import defaultdict
import pymysql
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort, g
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_talisman import Talisman
from models import db, User, Course, Batch, StudentProfile, Mark, Doubt, Enquiry, PasswordResetToken, Attendance, MockTest, MockTestQuestion, MockTestSubmission, Topper

app = Flask(__name__)

# Auto-detect MySQL credentials and create database if not exists
def get_mysql_uri():
    host = '127.0.0.1'
    user = 'root'
    passwords = ['', 'root', 'password', 'admin', 'admin123', '1234', '123456']
    db_name = 'kolekar_academy'
    
    # Check if user specified a password in environment
    env_pass = os.environ.get('MYSQL_PASSWORD')
    if env_pass is not None:
        passwords = [env_pass] + passwords

    working_password = None
    for p in passwords:
        try:
            conn = pymysql.connect(host=host, user=user, password=p, port=3306)
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            conn.commit()
            cursor.close()
            conn.close()
            working_password = p
            print(f"Connected to MySQL successfully with password: '{p}'")
            break
        except Exception as e:
            print(f"MySQL Connection attempt failed for password '{p}': {e}")
            continue
            
    if working_password is None:
        print("Warning: Could not connect to MySQL with common passwords. Using default root configuration.")
        return f"mysql+pymysql://root:@localhost/{db_name}"
        
    return f"mysql+pymysql://root:{working_password}@localhost/{db_name}"

# Configurations
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'kolekars_academy_ultra_secure_secret_key_2026')
app.config['SQLALCHEMY_DATABASE_URI'] = get_mysql_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Cookie security settings (HttpOnly, SameSite, Secure)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production (HTTPS)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

# Initialize DB
db.init_app(app)

# Initialize CSRF Protection
csrf = CSRFProtect(app)

# Configure Talisman (Security Headers, CSP)
csp = {
    'default-src': '\'self\'',
    'font-src': [
        '\'self\'',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
    ],
    'style-src': [
        '\'self\'',
        '\'unsafe-inline\'',
        'https://fonts.googleapis.com'
    ],
    'script-src': [
        '\'self\'',
        '\'unsafe-inline\''
    ],
    'img-src': [
        '\'self\'',
        'data:'
    ]
}
Talisman(app, content_security_policy=csp, force_https=False)

# Custom In-Memory Rate Limiting for Login & Registration
rate_limit_store = defaultdict(list)

def enforce_rate_limit(limit=5, period=60):
    ip = request.remote_addr
    now = time.time()
    # Remove logs older than 'period' seconds
    rate_limit_store[ip] = [t for t in rate_limit_store[ip] if now - t < period]
    if len(rate_limit_store[ip]) >= limit:
        return False
    rate_limit_store[ip].append(now)
    return True

# Helper: Input sanitization utility to prevent HTML XSS insertion
def sanitize_text(text):
    if not isinstance(text, str):
        return text
    clean = re.sub(r'<[^>]*>', '', text)
    return clean.strip()

# Decorator for authentication and role checks
def login_required(role=None):
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            session_key = 'admin_user_id' if role == 'admin' else 'student_user_id'
            if session_key not in session:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Unauthorized. Please login.'}), 401
                return redirect(url_for('admin_auth_page') if role == 'admin' else url_for('student_auth_page'))
            
            user = User.query.get(session[session_key])
            if not user:
                session.pop(session_key, None)
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Unauthorized. Please login.'}), 401
                return redirect(url_for('admin_auth_page') if role == 'admin' else url_for('student_auth_page'))
            
            # Check user status (must be approved by admin if student)
            if user.role == 'student' and user.status != 'approved':
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Account pending admin approval.'}), 403
                session.pop(session_key, None)
                return redirect(url_for('student_auth_page') + '?error=pending')

            if role:
                if role == 'admin':
                    if user.role not in ['admin', 'teacher']:
                        if request.path.startswith('/api/'):
                            return jsonify({'error': 'Forbidden. Access denied.'}), 403
                        return redirect(url_for('dashboard_page'))
                else:
                    if user.role != role:
                        if request.path.startswith('/api/'):
                            return jsonify({'error': 'Forbidden. Access denied.'}), 403
                        return redirect(url_for('admin_page'))
                
            # Set global context variables for role-specific usage
            g.user_id = user.id
            g.user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Inject CSRF token to headers dynamically on static requests
@app.after_request
def inject_csrf_token(response):
    # Set standard security headers not covered by Talisman or overrides
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response

# Error Handler
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify(error="Too many requests. Please try again later."), 429

@app.errorhandler(403)
def forbidden_handler(e):
    return jsonify(error="Forbidden access."), 403

# ----------------- PAGE ROUTING -----------------
@app.route('/')
def index_page():
    return render_template('index.html')

@app.route('/student/auth')
def student_auth_page():
    if 'student_user_id' in session:
        user = User.query.get(session['student_user_id'])
        if user:
            return redirect(url_for('dashboard_page'))
    return render_template('student_auth.html')

@app.route('/admin/auth')
def admin_auth_page():
    if 'admin_user_id' in session:
        user = User.query.get(session['admin_user_id'])
        if user:
            return redirect(url_for('admin_page'))
    return render_template('admin_auth.html')

@app.route('/auth')
def auth_page():
    return redirect(url_for('student_auth_page'))

@app.route('/reset-password')
def reset_password_page():
    token = request.args.get('token', '')
    if not token:
        return render_template('reset_password.html', error="Missing password reset token.", token="")
        
    reset_token = PasswordResetToken.query.filter_by(token=token).first()
    if not reset_token:
        return render_template('reset_password.html', error="Invalid or expired password reset token.", token="")
        
    if reset_token.expires_at < datetime.utcnow():
        # Clean up expired token
        try:
            db.session.delete(reset_token)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return render_template('reset_password.html', error="This password reset link has expired. Please request a new one.", token="")
        
    return render_template('reset_password.html', token=token, error="")

@app.route('/dashboard')
@login_required(role='student')
def dashboard_page():
    return render_template('dashboard.html')

@app.route('/admin')
@login_required(role='admin')
def admin_page():
    return render_template('admin.html')

# ----------------- API ENDPOINTS -----------------

# Auth APIs
@app.route('/api/auth/register', methods=['POST'])
def api_register():
    if not enforce_rate_limit(limit=5, period=60):
        return jsonify({'error': 'Too many registration requests. Please wait a minute.'}), 429
        
    data = request.get_json() or {}
    name = sanitize_text(data.get('name', ''))
    email = sanitize_text(data.get('email', '')).lower()
    password = data.get('password', '')
    phone = sanitize_text(data.get('phone', ''))

    if not name or not email or not password or not phone:
        return jsonify({'error': 'All fields are required.'}), 400

    # Email pattern validation
    if not re.match(r'[^@]+@[^@]+\.[^@]+', email):
        return jsonify({'error': 'Invalid email address.'}), 400

    # Phone validation
    if not re.match(r'^\+?[0-9]{10,15}$', phone):
        return jsonify({'error': 'Invalid phone number.'}), 400

    # Password strength check
    if len(password) < 8 or not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered.'}), 400

    try:
        new_user = User(name=name, email=email, role='student', status='pending')
        new_user.set_password(password)
        
        # Link profile using relationship for clean primary key management
        profile = StudentProfile(phone=phone, attendance_rate=100.0)
        new_user.student_profile = profile
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'Registration successful! Account is pending admin approval.'}), 201
    except Exception as e:
        print("Registration Exception Details:", e)
        db.session.rollback()
        return jsonify({'error': 'Registration failed. Internal server error.'}), 500

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    if not enforce_rate_limit(limit=10, period=60):
        return jsonify({'error': 'Too many login attempts. Please wait.'}), 429

    data = request.get_json() or {}
    email = sanitize_text(data.get('email', '')).lower()
    password = data.get('password', '')
    req_role = data.get('role', 'student') # Default to student login

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    if req_role not in ['student', 'admin']:
        return jsonify({'error': 'Invalid login portal role.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    # Enforce role matching
    if req_role == 'admin':
        if user.role not in ['admin', 'teacher']:
            return jsonify({'error': 'Access denied. Student accounts are not permitted to access the Admin Portal.'}), 403
    else:
        if user.role != 'student':
            return jsonify({'error': 'Access denied. Administrators must sign in through the Admin Portal.'}), 403

    if user.role == 'student' and user.status != 'approved':
        return jsonify({'error': 'Your registration request is pending admin approval.'}), 403

    # Secure the session
    session.permanent = True
    if user.role in ['admin', 'teacher']:
        session.pop('admin_user_id', None)
        session.pop('admin_user_role', None)
        session['admin_user_id'] = user.id
        session['admin_user_role'] = user.role
    else:
        session.pop('student_user_id', None)
        session.pop('student_user_role', None)
        session['student_user_id'] = user.id
        session['student_user_role'] = user.role

    return jsonify({
        'message': 'Login successful!',
        'user': user.to_dict()
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    referer = request.headers.get('Referer', '')
    if 'admin' in referer:
        session.pop('admin_user_id', None)
        session.pop('admin_user_role', None)
    else:
        session.pop('student_user_id', None)
        session.pop('student_user_role', None)
    return jsonify({'message': 'Logged out successfully.'}), 200

@app.route('/api/auth/me', methods=['GET'])
def api_me():
    requested_role = request.args.get('role')
    referer = request.headers.get('Referer', '')
    
    # Determine target role context
    if requested_role == 'admin':
        role = 'admin'
    elif requested_role == 'student':
        role = 'student'
    else:
        if 'admin' in referer:
            role = 'admin'
        elif 'student' in referer or 'dashboard' in referer:
            role = 'student'
        else:
            role = 'student' if 'student_user_id' in session else 'admin'
            
    # Get user_id for that specific role
    if role == 'admin':
        user_id = session.get('admin_user_id')
    else:
        user_id = session.get('student_user_id')
        
    if not user_id:
        return jsonify({'authenticated': False}), 200
        
    user = User.query.get(user_id)
    is_valid = False
    if user:
        if role == 'admin' and user.role in ['admin', 'teacher']:
            is_valid = True
        elif role == 'student' and user.role == 'student':
            is_valid = True

    if not is_valid:
        if role == 'admin':
            session.pop('admin_user_id', None)
            session.pop('admin_user_role', None)
        else:
            session.pop('student_user_id', None)
            session.pop('student_user_role', None)
        return jsonify({'authenticated': False}), 200
        
    return jsonify({
        'authenticated': True,
        'user': user.to_dict()
    }), 200

@app.route('/api/auth/forgot-password', methods=['POST'])
def api_forgot_password():
    if not enforce_rate_limit(limit=5, period=60):
        return jsonify({'error': 'Too many requests. Please wait.'}), 429

    data = request.get_json() or {}
    email = sanitize_text(data.get('email', '')).lower()
    role = sanitize_text(data.get('role', 'student'))
    phone = sanitize_text(data.get('phone', ''))
    new_password = data.get('new_password', '')

    if not email or not phone or not new_password:
        return jsonify({'error': 'Email, Phone/Secret Key, and New Password are required.'}), 400

    # Password strength check
    if len(new_password) < 8 or not any(c.isdigit() for c in new_password) or not any(c.isalpha() for c in new_password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}), 400

    user = User.query.filter_by(email=email, role=role).first()
    if not user:
        return jsonify({'error': 'Account not found with the provided email.'}), 404

    if role == 'student':
        if not user.student_profile or user.student_profile.phone != phone:
            return jsonify({'error': 'Registered phone number does not match.'}), 400
    elif role == 'admin':
        # Admin can reset using a predefined secret key or the flask SECRET_KEY
        if phone != 'admin123' and phone != app.config['SECRET_KEY']:
            return jsonify({'error': 'Invalid admin reset secret key.'}), 400

    try:
        user.set_password(new_password)
        db.session.commit()
        return jsonify({'message': 'Password has been successfully updated!'}), 200
    except Exception as e:
        db.session.rollback()
        print("Password Reset DB Exception:", e)
        return jsonify({'error': 'Failed to update password. Internal database error.'}), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def api_reset_password():
    if not enforce_rate_limit(limit=10, period=60):
        return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

    data = request.get_json() or {}
    token = sanitize_text(data.get('token', ''))
    password = data.get('password', '')

    if not token or not password:
        return jsonify({'error': 'Reset token and new password are required.'}), 400

    # Password strength check
    if len(password) < 8 or not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}), 400

    reset_token = PasswordResetToken.query.filter_by(token=token).first()
    if not reset_token:
        return jsonify({'error': 'Invalid or expired password reset token.'}), 400

    if reset_token.expires_at < datetime.utcnow():
        try:
            db.session.delete(reset_token)
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({'error': 'This password reset link has expired. Please request a new one.'}), 400

    user = User.query.get(reset_token.user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    try:
        user.set_password(password)
        db.session.delete(reset_token)
        db.session.commit()
        return jsonify({'message': 'Password updated successfully! You can now log in.'}), 200
    except Exception as e:
        db.session.rollback()
        print("Reset Password Commit Exception:", e)
        return jsonify({'error': 'Failed to reset password. Internal server error.'}), 500



# Courses & Batches APIs
@app.route('/api/courses', methods=['GET'])
def api_courses():
    courses = Course.query.all()
    return jsonify([c.to_dict() for c in courses]), 200

@app.route('/api/courses/<int:course_id>', methods=['GET'])
def api_course_detail(course_id):
    course = Course.query.get_or_404(course_id)
    return jsonify(course.to_dict()), 200

# Admin Courses Administration APIs
@app.route('/api/admin/courses', methods=['POST'])
@login_required(role='admin')
def api_admin_create_course():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403

    data = request.get_json() or {}
    name = sanitize_text(data.get('name', ''))
    description = sanitize_text(data.get('description', ''))
    fees = data.get('fees')
    duration = sanitize_text(data.get('duration', ''))
    syllabus = sanitize_text(data.get('syllabus', ''))

    if not name or fees is None or not duration:
        return jsonify({'error': 'Name, Fees, and Duration are required.'}), 400

    try:
        fees = int(fees)
    except ValueError:
        return jsonify({'error': 'Fees must be a numeric value.'}), 400

    try:
        new_course = Course(
            name=name,
            description=description,
            fees=fees,
            duration=duration,
            syllabus=syllabus
        )
        db.session.add(new_course)
        db.session.commit()
        return jsonify({'message': f'Course "{name}" created successfully.', 'course': new_course.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        print("Create Course Exception:", e)
        return jsonify({'error': 'Failed to create course.'}), 500

@app.route('/api/admin/courses/<int:course_id>', methods=['PUT'])
@login_required(role='admin')
def api_admin_update_course(course_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403

    course = Course.query.get_or_404(course_id)
    data = request.get_json() or {}
    name = sanitize_text(data.get('name', ''))
    description = sanitize_text(data.get('description', ''))
    fees = data.get('fees')
    duration = sanitize_text(data.get('duration', ''))
    syllabus = sanitize_text(data.get('syllabus', ''))

    if not name or fees is None or not duration:
        return jsonify({'error': 'Name, Fees, and Duration are required.'}), 400

    try:
        fees = int(fees)
    except ValueError:
        return jsonify({'error': 'Fees must be a numeric value.'}), 400

    try:
        course.name = name
        course.description = description
        course.fees = fees
        course.duration = duration
        course.syllabus = syllabus
        db.session.commit()
        return jsonify({'message': f'Course "{name}" updated successfully.', 'course': course.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        print("Update Course Exception:", e)
        return jsonify({'error': 'Failed to update course.'}), 500

@app.route('/api/admin/courses/<int:course_id>', methods=['DELETE'])
@login_required(role='admin')
def api_admin_delete_course(course_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403

    course = Course.query.get_or_404(course_id)
    try:
        db.session.delete(course)
        db.session.commit()
        return jsonify({'message': f'Course "{course.name}" deleted successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        print("Delete Course Exception:", e)
        return jsonify({'error': 'Failed to delete course.'}), 500

@app.route('/api/batches', methods=['GET'])
def api_batches():
    batches = Batch.query.all()
    return jsonify([b.to_dict() for b in batches]), 200


# Student Portal APIs
@app.route('/api/student/profile', methods=['GET', 'POST'])
@login_required(role='student')
def api_student_profile():
    profile = StudentProfile.query.get(g.user_id)
    if request.method == 'GET':
        if not profile:
            return jsonify({'error': 'Profile not found.'}), 404
        return jsonify(profile.to_dict()), 200
        
    # POST - update profile details
    data = request.get_json() or {}
    phone = sanitize_text(data.get('phone', ''))
    parent_phone = sanitize_text(data.get('parent_phone', ''))
    address = sanitize_text(data.get('address', ''))

    if phone and not re.match(r'^\+?[0-9]{10,15}$', phone):
        return jsonify({'error': 'Invalid phone number.'}), 400
    if parent_phone and not re.match(r'^\+?[0-9]{10,15}$', parent_phone):
        return jsonify({'error': 'Invalid parent phone number.'}), 400

    if not profile:
        profile = StudentProfile(user_id=g.user_id)
        db.session.add(profile)

    if phone: profile.phone = phone
    if parent_phone: profile.parent_phone = parent_phone
    if address: profile.address = address

    try:
        db.session.commit()
        return jsonify({'message': 'Profile updated successfully!', 'profile': profile.to_dict()}), 200
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile.'}), 500

@app.route('/api/student/marks', methods=['GET'])
@login_required(role='student')
def api_student_marks():
    marks = Mark.query.filter_by(student_id=g.user_id).order_by(Mark.test_date.asc()).all()
    return jsonify([m.to_dict() for m in marks]), 200

@app.route('/api/student/doubts', methods=['GET', 'POST'])
@login_required(role='student')
def api_student_doubts():
    if request.method == 'GET':
        doubts = Doubt.query.filter_by(student_id=g.user_id).order_by(Doubt.created_at.desc()).all()
        return jsonify([d.to_dict() for d in doubts]), 200

    # POST - submit a new doubt
    data = request.get_json() or {}
    title = sanitize_text(data.get('title', ''))
    description = sanitize_text(data.get('description', ''))

    if not title or not description:
        return jsonify({'error': 'Title and description are required.'}), 400

    try:
        new_doubt = Doubt(student_id=g.user_id, title=title, description=description, status='open')
        db.session.add(new_doubt)
        db.session.commit()
        return jsonify({'message': 'Doubt submitted successfully!', 'doubt': new_doubt.to_dict()}), 201
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to submit doubt.'}), 500


# Admin Panel APIs
@app.route('/api/admin/stats', methods=['GET'])
@login_required(role='admin')
def api_admin_stats():
    total_students = User.query.filter_by(role='student').count()
    pending_students = User.query.filter_by(role='student', status='pending').count()
    total_courses = Course.query.count()
    open_doubts = Doubt.query.filter_by(status='open').count()
    new_enquiries = Enquiry.query.filter_by(status='new').count()

    return jsonify({
        'total_students': total_students,
        'pending_students': pending_students,
        'total_courses': total_courses,
        'open_doubts': open_doubts,
        'new_enquiries': new_enquiries
    }), 200

@app.route('/api/admin/students', methods=['GET'])
@login_required(role='admin')
def api_admin_students():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    students = User.query.filter_by(role='student').order_by(User.status.desc(), User.created_at.desc()).all()
    results = []
    for s in students:
        s_dict = s.to_dict()
        profile = StudentProfile.query.get(s.id)
        s_dict['profile'] = profile.to_dict() if profile else None
        results.append(s_dict)
    return jsonify(results), 200

@app.route('/api/admin/students/<int:student_id>/approve', methods=['POST'])
@login_required(role='admin')
def api_approve_student(student_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    student = User.query.filter_by(id=student_id, role='student').first_or_404()
    student.status = 'approved'
    try:
        db.session.commit()
        return jsonify({'message': f'Student {student.name} approved successfully!'}), 200
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to approve student.'}), 500

@app.route('/api/admin/students/<int:student_id>/batch', methods=['POST'])
@login_required(role='admin')
def api_assign_batch(student_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    data = request.get_json() or {}
    batch_id = data.get('batch_id')
    
    student = User.query.filter_by(id=student_id, role='student').first_or_404()
    profile = StudentProfile.query.get(student_id)
    
    if not profile:
        profile = StudentProfile(user_id=student_id)
        db.session.add(profile)

    if batch_id:
        batch = Batch.query.get_or_404(batch_id)
        profile.batch_id = batch.id
    else:
        profile.batch_id = None

    try:
        db.session.commit()
        return jsonify({'message': 'Batch assignment updated!', 'profile': profile.to_dict()}), 200
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to assign batch.'}), 500

# Teacher Administration APIs
@app.route('/api/admin/teachers', methods=['GET'])
@login_required(role='admin')
def api_list_teachers():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    teachers = User.query.filter_by(role='teacher').order_by(User.created_at.desc()).all()
    return jsonify([t.to_dict() for t in teachers]), 200

@app.route('/api/admin/teachers', methods=['POST'])
@login_required(role='admin')
def api_create_teacher():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
        
    data = request.get_json() or {}
    name = sanitize_text(data.get('name', ''))
    email = sanitize_text(data.get('email', '')).lower()
    password = data.get('password', '')
    subject = sanitize_text(data.get('subject', ''))

    if not name or not email or not password or not subject:
        return jsonify({'error': 'All fields are required.'}), 400

    if not re.match(r'[^@]+@[^@]+\.[^@]+', email):
        return jsonify({'error': 'Invalid email address.'}), 400

    if len(password) < 8 or not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered.'}), 400

    try:
        new_teacher = User(name=name, email=email, role='teacher', status='approved', subject=subject)
        new_teacher.set_password(password)
        db.session.add(new_teacher)
        db.session.commit()
        return jsonify({'message': 'Teacher account created successfully!', 'teacher': new_teacher.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        print("Create Teacher Exception:", e)
        return jsonify({'error': 'Failed to create teacher account.'}), 500

@app.route('/api/admin/teachers/<int:teacher_id>', methods=['DELETE'])
@login_required(role='admin')
def api_delete_teacher(teacher_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    teacher = User.query.filter_by(id=teacher_id, role='teacher').first_or_404()
    try:
        db.session.delete(teacher)
        db.session.commit()
        return jsonify({'message': 'Teacher account deleted successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        print("Delete Teacher Exception:", e)
        return jsonify({'error': 'Failed to delete teacher account.'}), 500

@app.route('/api/admin/enquiries', methods=['GET'])
@login_required(role='admin')
def api_admin_enquiries():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    enquiries = Enquiry.query.order_by(Enquiry.status.asc(), Enquiry.created_at.desc()).all()
    return jsonify([e.to_dict() for e in enquiries]), 200

@app.route('/api/admin/enquiries/<int:enquiry_id>/resolve', methods=['POST'])
@login_required(role='admin')
def api_resolve_enquiry(enquiry_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    enquiry.status = 'resolved'
    try:
        db.session.commit()
        return jsonify({'message': 'Enquiry resolved successfully.'}), 200
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to resolve enquiry.'}), 500

@app.route('/api/admin/doubts', methods=['GET'])
@login_required(role='admin')
def api_admin_doubts():
    if g.user.role == 'teacher':
        prefix = f"{g.user.subject}:"
        doubts = Doubt.query.filter(Doubt.title.like(f"{prefix}%")).order_by(Doubt.status.asc(), Doubt.created_at.desc()).all()
    else:
        doubts = Doubt.query.order_by(Doubt.status.asc(), Doubt.created_at.desc()).all()
    return jsonify([d.to_dict() for d in doubts]), 200

@app.route('/api/admin/doubts/<int:doubt_id>/answer', methods=['POST'])
@login_required(role='admin')
def api_answer_doubt(doubt_id):
    data = request.get_json() or {}
    answer = sanitize_text(data.get('answer', ''))

    if not answer:
        return jsonify({'error': 'Answer is required.'}), 400

    doubt = Doubt.query.get_or_404(doubt_id)
    if g.user.role == 'teacher':
        prefix = f"{g.user.subject}:"
        if not doubt.title.startswith(prefix):
            return jsonify({'error': 'Forbidden. You can only answer doubts for your assigned subject.'}), 403

    doubt.answer = answer
    doubt.status = 'resolved'
    doubt.answered_by = g.user_id

    try:
        db.session.commit()
        return jsonify({'message': 'Doubt resolved with answer!', 'doubt': doubt.to_dict()}), 200
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to save answer.'}), 500

@app.route('/api/admin/marks', methods=['POST'])
@login_required(role='admin')
def api_add_marks():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    subject = sanitize_text(data.get('subject', ''))
    test_date = sanitize_text(data.get('test_date', ''))
    marks_obtained = data.get('marks_obtained')
    max_marks = data.get('max_marks')

    if not student_id or not subject or not test_date or marks_obtained is None or not max_marks:
        return jsonify({'error': 'All mark entry fields are required.'}), 400

    if g.user.role == 'teacher' and subject != g.user.subject:
        return jsonify({'error': f'Forbidden. You are only allowed to enter marks for your subject: {g.user.subject}.'}), 403

    try:
        marks_obtained = float(marks_obtained)
        max_marks = float(max_marks)
    except ValueError:
        return jsonify({'error': 'Marks must be numerical values.'}), 400

    if marks_obtained < 0 or max_marks <= 0 or marks_obtained > max_marks:
        return jsonify({'error': 'Invalid mark ratios.'}), 400

    student = User.query.filter_by(id=student_id, role='student').first_or_404()

    try:
        new_mark = Mark(
            student_id=student_id,
            subject=subject,
            test_date=test_date,
            marks_obtained=marks_obtained,
            max_marks=max_marks
        )
        db.session.add(new_mark)
        db.session.commit()
        return jsonify({'message': f'Marks added for {student.name}!', 'mark': new_mark.to_dict()}), 201
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to log marks.'}), 500


# ----------------- ATTENDANCE APIs -----------------

@app.route('/api/admin/attendance', methods=['GET'])
@login_required(role='admin')
def api_get_attendance():
    batch_id = request.args.get('batch_id', type=int)
    date = request.args.get('date', '')

    if not batch_id or not date:
        return jsonify({'error': 'batch_id and date parameters are required.'}), 400

    # Verify batch exists
    batch = Batch.query.get_or_404(batch_id)

    # Find all student users assigned to this batch
    students = User.query.join(StudentProfile).filter(
        User.role == 'student',
        User.status == 'approved',
        StudentProfile.batch_id == batch_id
    ).all()

    # Find attendance records for this date
    records = Attendance.query.filter_by(date=date).all()
    records_map = {r.student_id: r.status for r in records}

    student_list = []
    for s in students:
        student_list.append({
            'id': s.id,
            'name': s.name,
            'status': records_map.get(s.id, '')
        })

    return jsonify({'date': date, 'batch_name': batch.name, 'students': student_list}), 200

@app.route('/api/admin/attendance', methods=['POST'])
@login_required(role='admin')
def api_save_attendance():
    data = request.get_json() or {}
    batch_id = data.get('batch_id')
    date = sanitize_text(data.get('date', ''))
    records = data.get('records', [])

    if not batch_id or not date or not records:
        return jsonify({'error': 'batch_id, date, and records list are required.'}), 400

    try:
        for r in records:
            student_id = r.get('student_id')
            status = r.get('status')
            if not student_id or status not in ['present', 'absent']:
                continue

            # Update or insert record
            att = Attendance.query.filter_by(student_id=student_id, date=date).first()
            if att:
                att.status = status
            else:
                att = Attendance(student_id=student_id, date=date, status=status)
                db.session.add(att)
            
            db.session.flush()

            # Calculate new attendance rate
            total_att = Attendance.query.filter_by(student_id=student_id).all()
            total_count = len(total_att)
            present_count = len([x for x in total_att if x.status == 'present'])
            rate = (present_count / total_count) * 100.0 if total_count > 0 else 100.0

            # Update StudentProfile
            profile = StudentProfile.query.get(student_id)
            if profile:
                profile.attendance_rate = round(rate, 2)

        db.session.commit()
        return jsonify({'message': 'Attendance saved and rates updated successfully.'}), 200
    except Exception as e:
        db.session.rollback()
        print("Save Attendance Exception:", e)
        return jsonify({'error': 'Failed to save attendance.'}), 500

@app.route('/api/student/attendance', methods=['GET'])
@login_required(role='student')
def api_student_get_attendance():
    records = Attendance.query.filter_by(student_id=g.user_id).order_by(Attendance.date.desc()).all()
    profile = StudentProfile.query.get(g.user_id)
    rate = profile.attendance_rate if profile else 100.0

    return jsonify({
        'attendance_rate': rate,
        'records': [r.to_dict() for r in records]
    }), 200


# ----------------- MOCK TEST APIs -----------------

@app.route('/api/admin/tests', methods=['POST'])
@login_required(role='admin')
def api_admin_create_test():
    data = request.get_json() or {}
    title = sanitize_text(data.get('title', ''))
    subject = sanitize_text(data.get('subject', ''))
    batch_id = data.get('batch_id')
    duration = data.get('duration')
    questions = data.get('questions', [])

    if not title or not subject or not batch_id or not duration or not questions:
        return jsonify({'error': 'All fields and at least one question are required.'}), 400

    if g.user.role == 'teacher' and subject != g.user.subject:
        return jsonify({'error': f'Forbidden. You are only allowed to create tests for your subject: {g.user.subject}.'}), 403

    try:
        duration = int(duration)
    except ValueError:
        return jsonify({'error': 'Duration must be an integer.'}), 400

    try:
        new_test = MockTest(title=title, subject=subject, batch_id=batch_id, duration=duration)
        db.session.add(new_test)
        db.session.flush()

        for q in questions:
            q_text = sanitize_text(q.get('question_text', ''))
            opt_a = sanitize_text(q.get('option_a', ''))
            opt_b = sanitize_text(q.get('option_b', ''))
            opt_c = sanitize_text(q.get('option_c', ''))
            opt_d = sanitize_text(q.get('option_d', ''))
            correct = sanitize_text(q.get('correct_option', '')).upper()

            if not q_text or not opt_a or not opt_b or not opt_c or not opt_d or correct not in ['A', 'B', 'C', 'D']:
                db.session.rollback()
                return jsonify({'error': 'All questions must have text, 4 options, and a correct answer (A/B/C/D).'}), 400

            question = MockTestQuestion(
                test_id=new_test.id,
                question_text=q_text,
                option_a=opt_a,
                option_b=opt_b,
                option_c=opt_c,
                option_d=opt_d,
                correct_option=correct
            )
            db.session.add(question)

        db.session.commit()
        return jsonify({'message': f'Mock test "{title}" created successfully.', 'test_id': new_test.id}), 201
    except Exception as e:
        db.session.rollback()
        print("Create Test Exception:", e)
        return jsonify({'error': 'Failed to create mock test.'}), 500

@app.route('/api/admin/tests', methods=['GET'])
@login_required(role='admin')
def api_admin_list_tests():
    if g.user.role == 'teacher':
        tests = MockTest.query.filter_by(subject=g.user.subject).order_by(MockTest.created_at.desc()).all()
    else:
        tests = MockTest.query.order_by(MockTest.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tests]), 200

@app.route('/api/admin/tests/<int:test_id>/submissions', methods=['GET'])
@login_required(role='admin')
def api_admin_test_submissions(test_id):
    test = MockTest.query.get_or_404(test_id)
    if g.user.role == 'teacher' and test.subject != g.user.subject:
        return jsonify({'error': 'Forbidden. Access to this test is restricted.'}), 403
    submissions = MockTestSubmission.query.filter_by(test_id=test_id).order_by(MockTestSubmission.submitted_at.desc()).all()
    return jsonify({
        'test_title': test.title,
        'submissions': [s.to_dict() for s in submissions]
    }), 200

@app.route('/api/student/tests', methods=['GET'])
@login_required(role='student')
def api_student_list_tests():
    profile = StudentProfile.query.get(g.user_id)
    if not profile or not profile.batch_id:
        return jsonify([]), 200

    tests = MockTest.query.filter_by(batch_id=profile.batch_id).order_by(MockTest.created_at.desc()).all()
    submissions = MockTestSubmission.query.filter_by(student_id=g.user_id).all()
    sub_map = {s.test_id: s for s in submissions}

    result = []
    for t in tests:
        sub = sub_map.get(t.id)
        result.append({
            'id': t.id,
            'title': t.title,
            'subject': t.subject,
            'duration': t.duration,
            'created_at': t.created_at.isoformat(),
            'status': 'completed' if sub else 'pending',
            'score': sub.score if sub else None,
            'total_questions': sub.total_questions if sub else len(t.questions)
        })
    return jsonify(result), 200

@app.route('/api/student/tests/<int:test_id>', methods=['GET'])
@login_required(role='student')
def api_student_get_test_details(test_id):
    profile = StudentProfile.query.get(g.user_id)
    test = MockTest.query.get_or_404(test_id)

    if not profile or test.batch_id != profile.batch_id:
        return jsonify({'error': 'You do not have access to this mock test.'}), 403

    existing_sub = MockTestSubmission.query.filter_by(student_id=g.user_id, test_id=test_id).first()
    if existing_sub:
        return jsonify({'error': 'You have already solved this test.'}), 400

    questions = MockTestQuestion.query.filter_by(test_id=test_id).all()
    q_list = [q.to_dict(hide_answer=True) for q in questions]

    return jsonify({
        'id': test.id,
        'title': test.title,
        'subject': test.subject,
        'duration': test.duration,
        'questions': q_list
    }), 200

@app.route('/api/student/tests/<int:test_id>/submit', methods=['POST'])
@login_required(role='student')
def api_student_submit_test(test_id):
    profile = StudentProfile.query.get(g.user_id)
    test = MockTest.query.get_or_404(test_id)

    if not profile or test.batch_id != profile.batch_id:
        return jsonify({'error': 'You do not have access to this mock test.'}), 403

    existing_sub = MockTestSubmission.query.filter_by(student_id=g.user_id, test_id=test_id).first()
    if existing_sub:
        return jsonify({'error': 'You have already solved this test.'}), 400

    data = request.get_json() or {}
    answers = data.get('answers', {})

    questions = MockTestQuestion.query.filter_by(test_id=test_id).all()
    
    score = 0
    for q in questions:
        chosen = answers.get(str(q.id)) or answers.get(q.id)
        if chosen and chosen.strip().upper() == q.correct_option:
            score += 1

    try:
        submission = MockTestSubmission(
            student_id=g.user_id,
            test_id=test_id,
            score=score,
            total_questions=len(questions)
        )
        db.session.add(submission)
        db.session.commit()

        return jsonify({
            'message': 'Test submitted successfully!',
            'score': score,
            'total_questions': len(questions),
            'percentage': round((score / len(questions)) * 100, 2) if len(questions) > 0 else 0
        }), 201
    except Exception as e:
        db.session.rollback()
        print("Submit Test Exception:", e)
        return jsonify({'error': 'Failed to submit test.'}), 500


# Enquiries Form Submission (Public)
@app.route('/api/enquiries', methods=['POST'])
def api_submit_enquiry():
    if not enforce_rate_limit(limit=3, period=60):
        return jsonify({'error': 'Too many messages sent. Please wait.'}), 429

    data = request.get_json() or {}
    name = sanitize_text(data.get('name', ''))
    email = sanitize_text(data.get('email', '')).lower()
    phone = sanitize_text(data.get('phone', ''))
    course_interest = sanitize_text(data.get('course_interest', ''))
    message = sanitize_text(data.get('message', ''))

    if not name or not email or not phone or not message:
        return jsonify({'error': 'Name, email, phone, and message are required.'}), 400

    if not re.match(r'[^@]+@[^@]+\.[^@]+', email):
        return jsonify({'error': 'Invalid email address.'}), 400
        
    if not re.match(r'^\+?[0-9]{10,15}$', phone):
        return jsonify({'error': 'Invalid phone number.'}), 400

    try:
        new_enquiry = Enquiry(
            name=name,
            email=email,
            phone=phone,
            course_interest=course_interest,
            message=message,
            status='new'
        )
        db.session.add(new_enquiry)
        db.session.commit()
        return jsonify({'message': 'Enquiry submitted successfully! We will contact you soon.'}), 201
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Enquiry submission failed.'}), 500

# Toppers APIs (Public)
@app.route('/api/toppers', methods=['GET'])
def api_get_toppers():
    toppers = Topper.query.order_by(Topper.created_at.desc()).all()
    return jsonify([t.to_dict() for t in toppers]), 200

# Toppers Admin APIs
@app.route('/api/admin/toppers', methods=['POST'])
@login_required(role='admin')
def api_add_topper():
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    name = sanitize_text(request.form.get('name', ''))
    score = sanitize_text(request.form.get('score', ''))
    exam = sanitize_text(request.form.get('exam', ''))
    year = sanitize_text(request.form.get('year', ''))

    if not name or not score or not exam or not year:
        return jsonify({'error': 'Name, score, exam, and year are required.'}), 400

    if 'photo' not in request.files:
        return jsonify({'error': 'Photo file is required.'}), 400

    photo_file = request.files['photo']
    if photo_file.filename == '':
        return jsonify({'error': 'No photo selected.'}), 400

    # Secure filename and validate extension
    from werkzeug.utils import secure_filename
    filename = secure_filename(photo_file.filename)
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext not in {'png', 'jpg', 'jpeg', 'gif', 'webp'}:
        return jsonify({'error': 'Invalid file type. Only PNG, JPG, JPEG, GIF, and WEBP images are allowed.'}), 400

    # Ensure upload folder exists
    upload_folder = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    unique_filename = f"{int(time.time())}_{filename}"
    file_path = os.path.join(upload_folder, unique_filename)
    
    try:
        photo_file.save(file_path)
        image_path = f"/static/uploads/{unique_filename}"
        
        new_topper = Topper(
            name=name,
            score=score,
            exam=exam,
            year=year,
            image_path=image_path
        )
        db.session.add(new_topper)
        db.session.commit()
        return jsonify({'message': 'Topper added successfully!', 'topper': new_topper.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        print("Add Topper Exception:", e)
        return jsonify({'error': 'Failed to save topper. Internal server error.'}), 500

@app.route('/api/admin/toppers/<int:topper_id>', methods=['DELETE'])
@login_required(role='admin')
def api_delete_topper(topper_id):
    if g.user.role != 'admin':
        return jsonify({'error': 'Admin privilege required.'}), 403
    topper = Topper.query.get(topper_id)
    if not topper:
        return jsonify({'error': 'Topper not found.'}), 404

    try:
        try:
            full_path = os.path.join(app.root_path, topper.image_path.lstrip('/'))
            if os.path.exists(full_path):
                os.remove(full_path)
        except Exception as e:
            print("Failed to delete physical file:", e)

        db.session.delete(topper)
        db.session.commit()
        return jsonify({'message': 'Topper deleted successfully!'}), 200
    except Exception as e:
        db.session.rollback()
        print("Delete Topper Exception:", e)
        return jsonify({'error': 'Failed to delete topper.'}), 500

# ----------------- DB SEED FUNCTION -----------------
def seed_database():
    # Admin Seed
    admin_email = 'admin@kolekaracademy.com'
    admin_user = User.query.filter_by(role='admin').first()
    if not admin_user:
        admin_user = User(
            name='Prof. Kolekar',
            email=admin_email,
            role='admin',
            status='approved'
        )
        # Using secure hash
        admin_user.set_password('KolekarAdmin@2026')
        db.session.add(admin_user)
        db.session.commit()
        print(f"Database seeded with admin: {admin_email}")

    # Courses & Batches Seed
    if Course.query.count() == 0:
        courses = [
            Course(
                name='JEE Masterclass (Physics, Chemistry, Maths)',
                description='Comprehensive 2-year classroom program specifically designed for JEE Main & Advanced aspirants. Includes premium practice sheets, weekly mock test series, and dedicated 1-on-1 doubt solving.',
                fees=85000,
                duration='24 Months',
                syllabus='Physics (Mechanics, Electrodynamics, Optics, Thermodynamics, Modern Physics), Chemistry (Physical, Organic, Inorganic), Mathematics (Calculus, Algebra, Coordinate Geometry, Trigonometry, Vectors)'
            ),
            Course(
                name='NEET Achiever Batch (Biology, Physics, Chemistry)',
                description='Intensive 1-year course for medical aspirants preparing for NEET. Deep focus on NCERT syllabus, intensive practical-diagram workshops, and biological speed-run tests.',
                fees=75000,
                duration='12 Months',
                syllabus='Physics (General Physics, Heat, Sound, Current), Chemistry (Chemical Bonding, Organic Compounds, Periodic Table), Biology (Botany, Zoology, Cell Biology, Human Physiology, Genetics)'
            ),
            Course(
                name='Class 10th Board Booster (Science & Maths)',
                description='Targeted board prep for Class 10 board exams. Includes revision marathons, previous year question bank analyses, and exam writing guidelines.',
                fees=30000,
                duration='8 Months',
                syllabus='Mathematics (Real Numbers, Polynomials, Triangles, Stats, Probability), Science (Chemical Reactions, Carbon, Light, Electricity, Life Processes)'
            ),
            Course(
                name='Olympiad Foundation Course (Class 8th - 9th)',
                description='Strengthen logical reasoning and structural base for competitive examinations like Science/Math Olympiads, NTSE, and early base building.',
                fees=40000,
                duration='12 Months',
                syllabus='Advanced Math puzzles, Logical & Analytical Reasoning, Science basics, Mental ability training'
            )
        ]
        db.session.add_all(courses)
        db.session.commit()
        print("Database seeded with default courses.")

        # Batch Seed
        c1 = Course.query.filter_by(name='JEE Masterclass (Physics, Chemistry, Maths)').first()
        c2 = Course.query.filter_by(name='NEET Achiever Batch (Biology, Physics, Chemistry)').first()
        c3 = Course.query.filter_by(name='Class 10th Board Booster (Science & Maths)').first()
        c4 = Course.query.filter_by(name='Olympiad Foundation Course (Class 8th - 9th)').first()

        batches = [
            Batch(course_id=c1.id, name='JEE Morning Batch A', timing='07:00 AM - 10:00 AM', instructor='Prof. S. Kolekar (Maths)'),
            Batch(course_id=c1.id, name='JEE Evening Batch B', timing='04:00 PM - 07:00 PM', instructor='Prof. R. Deshmukh (Physics)'),
            Batch(course_id=c2.id, name='NEET Medical Target', timing='10:30 AM - 01:30 PM', instructor='Dr. Anjali Patil (Biology)'),
            Batch(course_id=c3.id, name='Class 10 Evening Star', timing='05:30 PM - 07:30 PM', instructor='Prof. S. Kolekar (Maths)'),
            Batch(course_id=c4.id, name='Olympiad Foundation Morning', timing='08:30 AM - 10:30 AM', instructor='Prof. V. Joshi (Science)')
        ]
        db.session.add_all(batches)
        db.session.commit()
        print("Database seeded with default batches.")

# Server boot up
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Safe migration: Add 'subject' column to 'users' table if missing
        try:
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            if 'users' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('users')]
                if 'subject' not in columns:
                    with db.engine.begin() as conn:
                        conn.execute(db.text("ALTER TABLE users ADD COLUMN subject VARCHAR(100) NULL;"))
                    print("Successfully added missing column 'subject' to 'users' table.")
        except Exception as e:
            print("Auto-migration warning:", e)
        seed_database()
    app.run(debug=True)
