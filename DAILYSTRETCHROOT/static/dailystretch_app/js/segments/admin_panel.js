// --- 1. Tab Switching ---
        function switchTab(tabName) {
            // Hide all cards
            document.querySelectorAll('.admin-card').forEach(el => el.classList.remove('active'));
            // Remove active class from buttons
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            
            // Show selected
            document.getElementById('tab-' + tabName).classList.add('active');
            // Highlight button (find by text roughly or add IDs to buttons)
            event.target.classList.add('active');
        }

        // --- 2. Edit Routine ---
        function editRoutine(id, title, category, difficulty, duration, description, instructions) {
            // Populate form
            document.getElementById('routine_id').value = id;
            document.getElementById('id_title').value = title;
            document.getElementById('id_category').value = category;
            document.getElementById('id_difficulty').value = difficulty;
            document.getElementById('id_duration').value = duration;
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
        document.getElementById('routineForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const id = document.getElementById('routine_id').value;
            
            // Decide URL based on if we have an ID
            let url = "{% url 'add_routine' %}";
            if(id) {
                url = "/main/admin/routine/update/" + id + "/";
            }

            fetch(url, {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': '{{ csrf_token }}' }
            })
            .then(res => res.json())
            .then(data => {
                if(data.ok) {
                    alert('Saved successfully!');
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            });
        });

        // --- 4. Delete Routine ---
        function deleteRoutine(id) {
            if(!confirm("Are you sure you want to delete this exercise?")) return;

            fetch("/main/admin/routine/delete/" + id + "/", {
                method: 'POST',
                headers: { 'X-CSRFToken': '{{ csrf_token }}' }
            })
            .then(res => res.json())
            .then(data => {
                if(data.ok) {
                    document.getElementById('routine-row-' + id).remove();
                } else {
                    alert('Error: ' + data.error);
                }
            });
        }

        // --- 5. Toggle Admin ---
        function toggleAdmin(userId, action) {
            const confirmMsg = action === 'promote' 
                ? "Make this user an Admin? They will have full control." 
                : "Remove Admin privileges from this user?";
            
            if(!confirm(confirmMsg)) return;

            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('action', action);

            fetch("{% url 'toggle_admin_status' %}", {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': '{{ csrf_token }}' }
            })
            .then(res => res.json())
            .then(data => {
                if(data.ok) {
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            });
        }