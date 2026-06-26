from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')
    status = db.Column(db.String(20), nullable=False, default='pending')
    subject = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    student_profile = db.relationship('StudentProfile', back_populates='user', uselist=False, cascade='all, delete-orphan')
    marks = db.relationship('Mark', back_populates='student', cascade='all, delete-orphan')
    doubts = db.relationship('Doubt', back_populates='student', foreign_keys='Doubt.student_id', cascade='all, delete-orphan')
    answered_doubts = db.relationship('Doubt', back_populates='admin', foreign_keys='Doubt.answered_by')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'status': self.status,
            'subject': self.subject,
            'created_at': self.created_at.isoformat()
        }

class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    fees = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.String(50), nullable=False)
    syllabus = db.Column(db.Text)

    # Relationships
    batches = db.relationship('Batch', back_populates='course', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'fees': self.fees,
            'duration': self.duration,
            'syllabus': self.syllabus
        }

class Batch(db.Model):
    __tablename__ = 'batches'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    timing = db.Column(db.String(100), nullable=False)
    instructor = db.Column(db.String(100), nullable=False)

    # Relationships
    course = db.relationship('Course', back_populates='batches')
    student_profiles = db.relationship('StudentProfile', back_populates='batch')

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else '',
            'name': self.name,
            'timing': self.timing,
            'instructor': self.instructor
        }

class StudentProfile(db.Model):
    __tablename__ = 'student_profiles'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id', ondelete='SET NULL'), nullable=True)
    phone = db.Column(db.String(20))
    parent_phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    attendance_rate = db.Column(db.Float, default=100.0)

    # Relationships
    user = db.relationship('User', back_populates='student_profile')
    batch = db.relationship('Batch', back_populates='student_profiles')

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'batch_id': self.batch_id,
            'batch_name': self.batch.name if self.batch else 'Not Assigned',
            'course_name': self.batch.course.name if self.batch and self.batch.course else 'Not Enrolled',
            'phone': self.phone,
            'parent_phone': self.parent_phone,
            'address': self.address,
            'attendance_rate': self.attendance_rate
        }

class Mark(db.Model):
    __tablename__ = 'marks'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    test_date = db.Column(db.String(20), nullable=False)
    marks_obtained = db.Column(db.Float, nullable=False)
    max_marks = db.Column(db.Float, nullable=False)

    # Relationships
    student = db.relationship('User', back_populates='marks')

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else '',
            'subject': self.subject,
            'test_date': self.test_date,
            'marks_obtained': self.marks_obtained,
            'max_marks': self.max_marks,
            'percentage': round((self.marks_obtained / self.max_marks) * 100, 2) if self.max_marks > 0 else 0
        }

class Doubt(db.Model):
    __tablename__ = 'doubts'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='open')
    answer = db.Column(db.Text, nullable=True)
    answered_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    student = db.relationship('User', back_populates='doubts', foreign_keys=[student_id])
    admin = db.relationship('User', back_populates='answered_doubts', foreign_keys=[answered_by])

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else '',
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'answer': self.answer,
            'answered_by_name': self.admin.name if self.admin else None,
            'created_at': self.created_at.isoformat()
        }

class Enquiry(db.Model):
    __tablename__ = 'enquiries'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    course_interest = db.Column(db.String(150))
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='new')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'course_interest': self.course_interest,
            'message': self.message,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(128), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User')

class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.String(20), nullable=False, index=True)
    status = db.Column(db.String(10), nullable=False) # 'present' or 'absent'

    # Relationship
    student = db.relationship('User', backref=db.backref('attendance_records', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else '',
            'date': self.date,
            'status': self.status
        }

class MockTest(db.Model):
    __tablename__ = 'mock_tests'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id', ondelete='CASCADE'), nullable=False)
    duration = db.Column(db.Integer, nullable=False) # in minutes
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    batch = db.relationship('Batch', backref=db.backref('mock_tests', cascade='all, delete-orphan'))
    questions = db.relationship('MockTestQuestion', backref='mock_test', cascade='all, delete-orphan')
    submissions = db.relationship('MockTestSubmission', backref='mock_test', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'subject': self.subject,
            'batch_id': self.batch_id,
            'batch_name': self.batch.name if self.batch else 'General',
            'duration': self.duration,
            'created_at': self.created_at.isoformat()
        }

class MockTestQuestion(db.Model):
    __tablename__ = 'mock_test_questions'
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('mock_tests.id', ondelete='CASCADE'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.String(256), nullable=False)
    option_b = db.Column(db.String(256), nullable=False)
    option_c = db.Column(db.String(256), nullable=False)
    option_d = db.Column(db.String(256), nullable=False)
    correct_option = db.Column(db.String(2), nullable=False) # 'A', 'B', 'C', 'D'

    def to_dict(self, hide_answer=False):
        res = {
            'id': self.id,
            'test_id': self.test_id,
            'question_text': self.question_text,
            'option_a': self.option_a,
            'option_b': self.option_b,
            'option_c': self.option_c,
            'option_d': self.option_d
        }
        if not hide_answer:
            res['correct_option'] = self.correct_option
        return res

class MockTestSubmission(db.Model):
    __tablename__ = 'mock_test_submissions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    test_id = db.Column(db.Integer, db.ForeignKey('mock_tests.id', ondelete='CASCADE'), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    student = db.relationship('User', backref=db.backref('mock_submissions', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else '',
            'test_id': self.test_id,
            'test_title': self.mock_test.title if self.mock_test else '',
            'test_subject': self.mock_test.subject if self.mock_test else '',
            'score': self.score,
            'total_questions': self.total_questions,
            'percentage': round((self.score / self.total_questions) * 100, 2) if self.total_questions > 0 else 0,
            'submitted_at': self.submitted_at.isoformat()
        }


class Topper(db.Model):
    __tablename__ = 'toppers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    score = db.Column(db.String(50), nullable=False)
    exam = db.Column(db.String(100), nullable=False)
    year = db.Column(db.String(20), nullable=False)
    image_path = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'score': self.score,
            'exam': self.exam,
            'year': self.year,
            'image_path': self.image_path,
            'created_at': self.created_at.isoformat()
        }


