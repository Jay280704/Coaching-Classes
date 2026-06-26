/**
 * LANDING PAGE SCRIPT - KOLEKAR'S ACADEMY
 */

document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    loadToppers();
    setupEnquiryForm();
});

// Load and render courses dynamically from the secure endpoint
async function loadCourses() {
    const container = document.getElementById('courses-container');
    const selectEl = document.getElementById('enquiry-course');
    if (!container) return;

    const { data, error } = await secureFetch('/api/courses');
    
    if (error) {
        container.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: var(--primary);">
            Failed to load courses. Please refresh or try again.
        </div>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: var(--text-muted);">
            No courses are currently available. Check back soon!
        </div>`;
        return;
    }

    // Dynamically populate Interested Course dropdown select list
    if (selectEl) {
        selectEl.innerHTML = '<option value="">Select a Course</option>';
        data.forEach(course => {
            const opt = document.createElement('option');
            opt.value = course.name;
            opt.textContent = course.name;
            selectEl.appendChild(opt);
        });
    }

    container.innerHTML = ''; // Clear loading placeholder

    data.forEach(course => {
        // Create elements manually for maximum XSS protection
        const card = document.createElement('div');
        card.className = 'course-card';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'course-header';

        const durationSpan = document.createElement('span');
        durationSpan.className = 'course-duration';
        durationSpan.textContent = course.duration;

        const titleH3 = document.createElement('h3');
        titleH3.className = 'course-title';
        titleH3.textContent = course.name;

        const descP = document.createElement('p');
        descP.className = 'course-desc';
        descP.textContent = course.description;

        headerDiv.appendChild(durationSpan);
        headerDiv.appendChild(titleH3);
        headerDiv.appendChild(descP);

        // Syllabus Section
        const syllabusDiv = document.createElement('div');
        syllabusDiv.className = 'course-syllabus-preview';

        const syllabusTitle = document.createElement('div');
        syllabusTitle.className = 'course-syllabus-title';
        syllabusTitle.textContent = 'Syllabus Highlights';

        const syllabusList = document.createElement('ul');
        syllabusList.className = 'course-syllabus-list';

        // Parse syllabus strings (comma-separated list expected)
        const items = course.syllabus ? course.syllabus.split(',') : [];
        items.slice(0, 3).forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.trim();
            syllabusList.appendChild(li);
        });

        syllabusDiv.appendChild(syllabusTitle);
        syllabusDiv.appendChild(syllabusList);

        // Footer Section
        const footerDiv = document.createElement('div');
        footerDiv.className = 'course-footer';

        const priceDiv = document.createElement('div');
        priceDiv.className = 'course-price';

        const priceLabel = document.createElement('span');
        priceLabel.className = 'price-label';
        priceLabel.textContent = 'Investment';

        const priceVal = document.createElement('span');
        priceVal.className = 'price-val';
        priceVal.textContent = `₹${course.fees.toLocaleString('en-IN')}`;
        const yearSpan = document.createElement('span');
        yearSpan.textContent = ''; // / Course
        priceVal.appendChild(yearSpan);

        priceDiv.appendChild(priceLabel);
        priceDiv.appendChild(priceVal);

        const enquireBtn = document.createElement('button');
        enquireBtn.className = 'btn btn-primary';
        enquireBtn.textContent = 'Enquire';
        enquireBtn.addEventListener('click', () => {
            // Scroll to contact form and pre-fill course interest
            const contactSection = document.getElementById('contact');
            const selectEl = document.getElementById('enquiry-course');
            
            if (selectEl) {
                // Find matching option
                for (let i = 0; i < selectEl.options.length; i++) {
                    if (course.name.toLowerCase().includes(selectEl.options[i].value.toLowerCase()) && selectEl.options[i].value !== "") {
                        selectEl.selectedIndex = i;
                        break;
                    }
                }
            }

            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
            }
        });

        footerDiv.appendChild(priceDiv);
        footerDiv.appendChild(enquireBtn);

        card.appendChild(headerDiv);
        card.appendChild(syllabusDiv);
        card.appendChild(footerDiv);

        container.appendChild(card);
    });
}

// Setup and validate the Enquiry Submit actions
function setupEnquiryForm() {
    const form = document.getElementById('enquiry-form');
    const alertBox = document.getElementById('enquiry-alert');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('enquiry-name').value.trim();
        const email = document.getElementById('enquiry-email').value.trim();
        const phone = document.getElementById('enquiry-phone').value.trim();
        const course_interest = document.getElementById('enquiry-course').value;
        const message = document.getElementById('enquiry-message').value.trim();

        // Front-end sanity validations
        if (!name || !email || !phone || !message) {
            showAlert('All required fields must be completed.', 'error');
            return;
        }

        if (!/^[a-zA-Z\s]{2,100}$/.test(name)) {
            showAlert('Please enter a valid name (letters only, min 2 chars).', 'error');
            return;
        }

        if (!/^\+?[0-9]{10,15}$/.test(phone)) {
            showAlert('Please enter a valid phone number (10 to 15 digits).', 'error');
            return;
        }

        showAlert('Submitting enquiry...', 'info');

        const { data, error, status } = await secureFetch('/api/enquiries', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, course_interest, message })
        });

        if (error) {
            if (status === 429) {
                showAlert('Too many submissions. Please wait a minute before trying again.', 'error');
            } else {
                showAlert(error, 'error');
            }
            return;
        }

        showAlert(data.message, 'success');
        form.reset();
    });

    function showAlert(msg, type) {
        if (!alertBox) return;
        alertBox.textContent = msg;
        alertBox.className = 'form-message ' + type;
    }
}

// Load and render toppers dynamically
async function loadToppers() {
    const section = document.getElementById('toppers-section');
    const container = document.getElementById('toppers-container');
    if (!container || !section) return;

    const { data, error } = await secureFetch('/api/toppers');
    if (error || !data || data.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    data.forEach(t => {
        const card = document.createElement('div');
        card.className = 'topper-card';

        const badge = document.createElement('div');
        badge.className = 'topper-badge';
        badge.textContent = t.year;

        const avatar = document.createElement('img');
        avatar.className = 'topper-avatar';
        avatar.src = t.image_path;
        avatar.alt = t.name;

        const nameEl = document.createElement('h3');
        nameEl.className = 'topper-name';
        nameEl.textContent = t.name;

        const scoreEl = document.createElement('div');
        scoreEl.className = 'topper-score';
        scoreEl.textContent = t.score;

        const examEl = document.createElement('div');
        examEl.className = 'topper-exam';
        examEl.textContent = t.exam;

        card.appendChild(badge);
        card.appendChild(avatar);
        card.appendChild(nameEl);
        card.appendChild(scoreEl);
        card.appendChild(examEl);

        container.appendChild(card);
    });
}
