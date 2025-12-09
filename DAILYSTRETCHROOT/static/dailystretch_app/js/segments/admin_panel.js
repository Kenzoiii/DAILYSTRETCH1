// --- 1. Tab Switching ---
function switchTab(tabName) {
    // Hide all cards
    document.querySelectorAll('.admin-card').forEach(el => el.classList.remove('active'));
    // Remove active class from buttons
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Show selected
    document.getElementById('tab-' + tabName).classList.add('active');
    // Highlight button
    event.target.classList.add('active');
}

// --- 2. Edit Routine ---
function editRoutine(id, title, category, difficulty, duration, description, instructions) {
    // Populate form
    document.getElementById('routine_id').value = id;
    document.getElementById('id_title').value = title;
    document.getElementById('id_category').value = category;
    document.getElementById('id_difficulty').value = difficulty;
    document.getElementById("id_duration").addEventListener("input", function () {
        if (this.value < 1) {
            this.value = 1;
            notifyAdmin("Duration cannot be less than 1 minute.", "info", "Validation");
        }
    });
    document.getElementById('id_description').value = description;
    document.getElementById('id_instructions').value = instructions;

    // Change UI state
    document.getElementById('formTitle').innerText = "Edit Exercise";
    document.getElementById('saveBtn').innerText = "Update Exercise";
    document.getElementById('cancelBtn').style.display = "inline-block";
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('routineForm').reset();
    document.getElementById('routine_id').value = "";
    document.getElementById('formTitle').innerText = "Add New Exercise";
    document.getElementById('saveBtn').innerText = "Add to Library";
    document.getElementById('cancelBtn').style.display = "none";
}

// --- 3. Save (Add or Update) ---
let __adminSubmitting = false;
document.getElementById('routineForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (__adminSubmitting) { return; }
    __adminSubmitting = true;
    const formData = new FormData(this);
    const id = document.getElementById('routine_id').value;
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = id ? 'Updating…' : 'Saving…'; }
    if (cancelBtn) { cancelBtn.disabled = true; }
    
    // Use the variable from HTML for the add URL
    let url = ADMIN_CONFIG.addRoutineUrl;
    
    // Construct the update URL manually (or you could pass a base URL pattern from HTML)
    if(id) {
        url = "/main/admin/routine/update/" + id + "/";
    }

    fetch(url, {
        method: 'POST',
        body: formData,
        // Use the token from the config
        headers: { 'X-CSRFToken': ADMIN_CONFIG.csrfToken }
    })
    .then(res => res.json())
    .then(data => {
        if(data.ok) {
            notifyAdmin('Saved successfully!', 'success', 'Success');
            setTimeout(() => location.reload(), 800);
        } else {
            notifyAdmin('Error: ' + (data.error || 'Unknown error'), 'error', 'Error');
            __adminSubmitting = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = id ? 'Update Exercise' : 'Add to Library'; }
            if (cancelBtn) { cancelBtn.disabled = false; }
        }
    });
    .catch(err => {
        notifyAdmin('Network error. Please try again.', 'error', 'Error');
        __adminSubmitting = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = id ? 'Update Exercise' : 'Add to Library'; }
        if (cancelBtn) { cancelBtn.disabled = false; }
    });
});

// --- 4. Delete Routine ---
async function deleteRoutine(id) {
    const ok = await confirmAdmin("Are you sure you want to delete this exercise?", { title: 'Delete Exercise', confirmText: 'Delete', danger: true });
    if(!ok) return;

    fetch("/main/admin/routine/delete/" + id + "/", {
        method: 'POST',
        headers: { 'X-CSRFToken': ADMIN_CONFIG.csrfToken }
    })
    .then(res => res.json())
    .then(data => {
        if(data.ok) {
            document.getElementById('routine-row-' + id).remove();
            notifyAdmin('Exercise deleted', 'error', 'Deleted');
            setTimeout(() => {}, 1000);
        } else {
            notifyAdmin('Error: ' + (data.error || 'Unknown error'), 'error', 'Error');
        }
    });
}

// --- 5. Toggle Admin ---
async function toggleAdmin(userId, action) {
    const confirmMsg = action === 'promote' 
        ? "Make this user an Admin? They will have full control." 
        : "Remove Admin privileges from this user?";
    const ok = await confirmAdmin(confirmMsg, { title: action === 'promote' ? 'Promote User' : 'Demote User', confirmText: action === 'promote' ? 'Promote' : 'Remove', danger: action !== 'promote' });
    if(!ok) return;

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('action', action);

    fetch(ADMIN_CONFIG.toggleAdminUrl, {
        method: 'POST',
        body: formData,
        headers: { 'X-CSRFToken': ADMIN_CONFIG.csrfToken }
    })
    .then(res => res.json())
    .then(data => {
        if(data.ok) {
            if (action === 'promote') {
                notifyAdmin('User promoted to admin', 'success', 'Updated');
            } else {
                notifyAdmin('Admin role removed', 'info', 'Updated');
            }
            setTimeout(() => location.reload(), 800);
        } else {
            notifyAdmin('Error: ' + (data.error || 'Unknown error'), 'error', 'Error');
        }
    });
}