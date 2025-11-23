const editBtn = document.getElementById('editProfileBtn');
const modal = document.getElementById('editProfileModal');
const cancelBtn = document.getElementById('cancelBtn');

function safeOpenModal() {
    if (!modal) return;
    modal.classList.add('active');
}

function safeCloseModal() {
    if (!modal) return;
    modal.classList.remove('active');
}

function prefillModalFromDom() {
    if (!modal) return;
    setTimeout(() => {
        const modalName = document.getElementById('name');
        const modalBio = document.getElementById('bio');
        const modalDob = document.getElementById('date_of_birth');
        const inlineName = document.getElementById('pf-name');
        const inlineBio = document.getElementById('pf-bio');
        const profileCard = document.getElementById('profile-card');

        try {
            if (modalName) {
                modalName.value = inlineName ? inlineName.value : (profileCard ? profileCard.dataset.name || '' : '');
            }
            if (modalBio) {
                modalBio.value = inlineBio ? inlineBio.value : (profileCard ? profileCard.dataset.bio || '' : '');
            }
            if (modalDob) {
                // attempt to read from data attribute if present
                modalDob.value = profileCard ? profileCard.dataset.dob || '' : '';
            }
        } catch (e) { console.warn('prefill modal', e); }
    }, 80);
}

if (editBtn) {
    editBtn.addEventListener('click', () => {
        safeOpenModal();
        prefillModalFromDom();
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        safeCloseModal();
    });
}

window.addEventListener('click', (e) => {
    if (!modal) return;
    if (e.target === modal) {
        safeCloseModal();
    }
});

    const uploadBtn = document.getElementById('uploadPicBtn');
    const fileInput = document.getElementById('profile_picture_external');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
        fileInput.click(); 
    });

    
    fileInput.addEventListener('change', async () => {
        if (fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        console.log('Selected file for upload:', file.name);

        // Client-side validation
        const MAX_BYTES = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!file.type || !file.type.startsWith('image/')) {
            showToast('Please select an image file');
            return;
        }
        if (!allowedTypes.includes(file.type)) {
            showToast('Unsupported image type');
            return;
        }
        if (file.size > MAX_BYTES) {
            showToast('Image too large (max 5MB)');
            return;
        }

   
        const fd = new FormData();
        fd.append('profile_picture', file);


        let csrf = null;
        const profileFormEl = document.getElementById('profileForm');
        if (profileFormEl) {
            const csrfEl = profileFormEl.querySelector('input[name=csrfmiddlewaretoken]');
            if (csrfEl) csrf = csrfEl.value;
        }

        if (!csrf) {
            const getCookie = (name) => {
                const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
                return v ? v.pop() : '';
            };
            csrf = getCookie('csrftoken');
        }


        uploadBtn.disabled = true;
        let spinner = document.getElementById('pf-upload-spinner');
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.id = 'pf-upload-spinner';
            spinner.style.marginLeft = '8px';
            spinner.style.fontSize = '0.9rem';
            spinner.style.color = '#444';
            spinner.innerText = 'Uploading...';
            uploadBtn.parentNode.appendChild(spinner);
        }

        try {
            const uploadUrl = '/main/profile/upload-photo/';
            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrf || ''
                },
                body: fd,
                credentials: 'same-origin'
            });

            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                console.error('Upload failed', resp.status, text);
                throw new Error('Upload failed: ' + resp.status);
            }

            let data = null;
            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await resp.json();
            } else {
                const text = await resp.text().catch(() => '');
                console.error('Expected JSON but got:', text);
                throw new Error('Server returned non-JSON response');
            }

            console.log('Upload response', data);
            if (data && data.ok) {
                const url = data.profile_picture_url || '';
                if (url) {
                    const imgEl = document.querySelector('.profile-image') || document.getElementById('profileImg');
                    if (imgEl) imgEl.src = url + '?t=' + Date.now();
                }
                showToast('Profile photo updated', 1600);
            } else {
                console.warn('Upload returned non-ok', data);
                const message = data && data.message ? data.message : 'Upload failed';
                showToast(message, 2500);
            }
        } catch (err) {
            console.error('Upload error', err);
            showToast('Upload failed — check console for details', 3000);
        } finally {
            uploadBtn.disabled = false;
            const sp = document.getElementById('pf-upload-spinner');
            if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
        }
    });
    }

      
        function showToast(text, duration = 1600) {
            try {
                let toast = document.getElementById('pf-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'pf-toast';
                    toast.style.position = 'fixed';
                    toast.style.right = '20px';
                    toast.style.bottom = '20px';
                    toast.style.background = 'rgba(10,10,10,0.92)';
                    toast.style.color = 'white';
                    toast.style.padding = '10px 14px';
                    toast.style.borderRadius = '8px';
                    toast.style.zIndex = 9999;
                    toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';
                    document.body.appendChild(toast);
                }
                toast.textContent = text;
                toast.style.opacity = '1';
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, duration);
            } catch (e) { console.warn('toast', e); }
        }

        const nameInput = document.getElementById('name') || document.getElementById('pf-name');
        const bioInput = document.getElementById('bio') || document.getElementById('pf-bio');
        const nameCount = document.getElementById('name-count');
        const bioCount = document.getElementById('bio-count');

        // Helper to set value on various inline elements (input/textarea vs non-input)
        function setInlineValue(el, val) {
            if (!el) return;
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                el.value = val;
            } else {
                el.textContent = val;
            }
        }
        if (nameInput && nameCount) {
            nameInput.addEventListener('input', () => {
                const len = Math.min(50, nameInput.value.length);
                nameCount.textContent = `${len}/50 characters`;
                if (nameInput.value.length > 50) nameInput.value = nameInput.value.slice(0,50);
            });
        }
        if (bioInput && bioCount) {
            bioInput.addEventListener('input', () => {
                const len = Math.min(200, bioInput.value.length);
                bioCount.textContent = `${len}/200 characters`;
                if (bioInput.value.length > 200) bioInput.value = bioInput.value.slice(0,200);
            });
        }

        // AJAX submit for the form to give instant feedback and avoid full page reload
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const submitBtn = profileForm.querySelector('.save-btn');
                if (submitBtn) submitBtn.disabled = true;

                const fd = new FormData(profileForm);
                // if in-page inputs exist, copy them to FormData
                try { if (nameInput) fd.set('name', nameInput.value); } catch(e){}
                try { if (bioInput) fd.set('bio', bioInput.value); } catch(e){}

                // CSRF token
                const csrfEl = profileForm.querySelector('input[name=csrfmiddlewaretoken]');
                const csrf = csrfEl ? csrfEl.value : null;

                try {
                    const headers = csrf ? { 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' } : { 'X-Requested-With': 'XMLHttpRequest' };
                    const resp = await fetch(profileForm.action || window.location.href, {
                        method: 'POST',
                        body: fd,
                        headers,
                        credentials: 'same-origin'
                    });
                    if (!resp.ok) {
                        // Try to parse JSON error message when available
                        let errMsg = 'Save failed';
                        try {
                            const ct = resp.headers.get('content-type') || '';
                            if (ct.includes('application/json')) {
                                const errData = await resp.json().catch(() => null);
                                if (errData && errData.message) errMsg = errData.message;
                                else if (errData && errData.error) errMsg = errData.error;
                            } else {
                                const txt = await resp.text().catch(() => '');
                                if (txt) errMsg = txt;
                            }
                        } catch (e) { /* ignore */ }
                        showToast(errMsg, 2200);
                        console.warn('Profile save failed', resp.status, errMsg);
                    } else {
                        // Prefer JSON response for AJAX saves
                        const contentType = resp.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const data = await resp.json().catch(() => null);
                            if (data && data.ok) {
                                // Update inline fields using server-returned canonical values when available
                                try {
                                    const inlineName = document.getElementById('pf-name');
                                    const inlineBio = document.getElementById('pf-bio');
                                    const nameVal = data.username !== undefined ? data.username : fd.get('name');
                                    const bioVal = data.bio !== undefined ? data.bio : fd.get('bio');
                                    if (nameVal !== null && nameVal !== undefined) setInlineValue(inlineName, nameVal);
                                    if (bioVal !== null && bioVal !== undefined) setInlineValue(inlineBio, bioVal);
                                    // if server returned a profile picture url, update it
                                    if (data.profile_picture_url) {
                                        const imgEl = document.querySelector('.profile-image') || document.getElementById('profileImg');
                                        if (imgEl) imgEl.src = data.profile_picture_url + '?t=' + Date.now();
                                    }
                                } catch (e) { console.warn('update inline fields', e); }
                                showToast('Profile saved', 1200);
                                safeCloseModal();
                            } else {
                                showToast('Save failed', 1400);
                            }
                        } else {
                            // fallback: reload page to reflect changes
                            showToast('Profile saved', 1200);
                            safeCloseModal();
                            setTimeout(() => window.location.reload(), 900);
                        }
                    }
                } catch (e) {
                    console.error('Profile save error', e);
                    showToast('Save failed', 1800);
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }