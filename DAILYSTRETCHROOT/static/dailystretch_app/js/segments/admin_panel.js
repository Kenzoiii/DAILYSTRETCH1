;(function(){
    // Namespace and idempotent bindings
    window.DS = window.DS || {};
    window.DS.admin = window.DS.admin || {};

    // Expose global functions (safe to overwrite)
    window.switchTab = function(tabName, btn) {
        document.querySelectorAll('.admin-card').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        const card = document.getElementById('tab-' + tabName);
        if (card) card.classList.add('active');
        if (btn && btn.classList) btn.classList.add('active');
    }

    window.editRoutine = function(id, title, category, difficulty, duration, description, instructions) {
        const form = document.getElementById('routineForm');
        if (!form) return;
        form.querySelector('#routine_id').value = id;
        form.querySelector('#id_title').value = title;
        form.querySelector('#id_category').value = category;
        form.querySelector('#id_difficulty').value = difficulty;
        const dur = form.querySelector('#id_duration');
        if (dur && !dur.__bound) {
            dur.addEventListener('input', function(){
                if (this.value < 1) { this.value = 1; notifyAdmin('Duration cannot be less than 1 minute.', 'info', 'Validation'); }
            });
            dur.__bound = true;
        }
        form.querySelector('#id_description').value = description;
        form.querySelector('#id_instructions').value = instructions;
        document.getElementById('formTitle').innerText = 'Edit Exercise';
        document.getElementById('saveBtn').innerText = 'Update Exercise';
        document.getElementById('cancelBtn').style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.resetForm = function() {
        const form = document.getElementById('routineForm');
        if (!form) return;
        form.reset();
        form.querySelector('#routine_id').value = '';
        document.getElementById('formTitle').innerText = 'Add New Exercise';
        document.getElementById('saveBtn').innerText = 'Add to Library';
        document.getElementById('cancelBtn').style.display = 'none';
    }

    // Prevent duplicate binding
    if (!window.DS.admin.boundSubmit) {
        document.addEventListener('submit', function(e){
            const form = e.target;
            if (!form || form.id !== 'routineForm') return;
            e.preventDefault();
            if (window.DS.admin.submitting) return;
            window.DS.admin.submitting = true;

            const formData = new FormData(form);
            const id = form.querySelector('#routine_id').value;
            const saveBtn = form.querySelector('#saveBtn');
            const cancelBtn = form.querySelector('#cancelBtn');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = id ? 'Updating…' : 'Saving…'; }
            if (cancelBtn) { cancelBtn.disabled = true; }

            let url = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.addRoutineUrl) ? window.ADMIN_CONFIG.addRoutineUrl : '/main/admin/routine/add/';
            if (id) url = '/main/admin/routine/update/' + id + '/';

            fetch(url, {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': window.ADMIN_CONFIG ? window.ADMIN_CONFIG.csrfToken : '' }
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.ok) {
                    notifyAdmin('Saved successfully!', 'success', 'Success');
                    setTimeout(() => location.reload(), 800);
                } else {
                    notifyAdmin('Error: ' + ((data && data.error) || 'Unknown error'), 'error', 'Error');
                    window.DS.admin.submitting = false;
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = id ? 'Update Exercise' : 'Add to Library'; }
                    if (cancelBtn) { cancelBtn.disabled = false; }
                }
            })
            .catch(() => {
                notifyAdmin('Network error. Please try again.', 'error', 'Error');
                window.DS.admin.submitting = false;
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = id ? 'Update Exercise' : 'Add to Library'; }
                if (cancelBtn) { cancelBtn.disabled = false; }
            });
        });
        window.DS.admin.boundSubmit = true;
    }

    window.deleteRoutine = async function(id) {
        const ok = await confirmAdmin('Are you sure you want to delete this exercise?', { title: 'Delete Exercise', confirmText: 'Delete', danger: true });
        if (!ok) return;
        fetch('/main/admin/routine/delete/' + id + '/', {
            method: 'POST',
            headers: { 'X-CSRFToken': window.ADMIN_CONFIG ? window.ADMIN_CONFIG.csrfToken : '' }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.ok) {
                const row = document.getElementById('routine-row-' + id);
                if (row) row.remove();
                notifyAdmin('Exercise deleted', 'error', 'Deleted');
            } else {
                notifyAdmin('Error: ' + ((data && data.error) || 'Unknown error'), 'error', 'Error');
            }
        });
    }

    window.toggleAdmin = async function(userId, action) {
        const confirmMsg = action === 'promote' ? 'Make this user an Admin? They will have full control.' : 'Remove Admin privileges from this user?';
        const ok = await confirmAdmin(confirmMsg, { title: action === 'promote' ? 'Promote User' : 'Demote User', confirmText: action === 'promote' ? 'Promote' : 'Remove', danger: action !== 'promote' });
        if (!ok) return;

        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('action', action);

        fetch(window.ADMIN_CONFIG ? window.ADMIN_CONFIG.toggleAdminUrl : '/main/admin/toggle/', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': window.ADMIN_CONFIG ? window.ADMIN_CONFIG.csrfToken : '' }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.ok) {
                if (action === 'promote') notifyAdmin('User promoted to admin', 'success', 'Updated');
                else notifyAdmin('Admin role removed', 'info', 'Updated');
                setTimeout(() => location.reload(), 800);
            } else {
                notifyAdmin('Error: ' + ((data && data.error) || 'Unknown error'), 'error', 'Error');
            }
        });
    }
})();