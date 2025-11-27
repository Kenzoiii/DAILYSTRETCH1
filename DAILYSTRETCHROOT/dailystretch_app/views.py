import re
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Routine, UserSettings, Favorite
from .models import Profile
from .models import UserSettings, Favorite
import os
import json
from django.core.files import File


#helper for creating profile with default picture 
def create_profile_with_default_picture(user):
    profile, created = Profile.objects.get_or_create(user=user)
    if created and not profile.profile_picture:
        # Path to your static default image
        default_image_path = os.path.join(
            settings.BASE_DIR,
            'static/dailystretch_app/images/profilepicture.png'
        )
        
        # Open the file and save it to the ImageField
        with open(default_image_path, 'rb') as f:
            profile.profile_picture.save('default.png', File(f), save=True)
    return profile


# ====== Registration ======
def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')
        
        # 1. Get the Input Code
        admin_code = request.POST.get('admin_code', '').strip()
        
        # 2. Get the Secret Key
        secure_key = os.environ.get('ADMIN_SIGNUP_KEY') 

        # === DEBUGGING PRINTS (Check your terminal when you register!) ===
        print(f"DEBUG: User typed: '{admin_code}'")
        print(f"DEBUG: Real Secret Key is: '{secure_key}'")
        # ================================================================

        errors = {}
        if User.objects.filter(username=username).exists():
            errors['username'] = 'Username already exists!'
        if User.objects.filter(email=email).exists():
            errors['email'] = 'Email already in use!'
        if password != confirm_password:
            errors['password'] = 'Passwords do not match!'
        elif len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters.'

        if errors:
            context = {'errors': errors, 'username': username, 'email': email}
            return render(request, 'dailystretch_app/register.html', context)

        # Create the user
        user = User.objects.create_user(username=username, email=email, password=password)

        # 3. STRICT CHECK
        # We enforce that secure_key MUST exist and MUST match exactly
        if secure_key and admin_code == secure_key:
            user.is_superuser = True
            user.is_staff = True
            user.save()
            print("DEBUG: Admin access GRANTED.")
            messages.success(request, 'Admin Account created successfully!')
        else:
            print("DEBUG: Admin access DENIED.")
            messages.success(request, 'Account created successfully! Please login.')

        create_profile_with_default_picture(user)
        return redirect('login')

    return render(request, 'dailystretch_app/register.html')


# ====== Landing Page ======
def landing_page(request):
    return render(request, 'dailystretch_app/landing.html')


# ====== Login ======
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('main')
        else:
            messages.error(request, 'Invalid credentials!')
            return redirect('login')

    return render(request, 'dailystretch_app/login.html')


# ====== Logout ======
def logout_view(request):
    logout(request)
    return redirect('login')


# ====== Home Page (Navbar + Island) ======
@login_required(login_url='login')
def main_view(request):
    return render(request, 'dailystretch_app/main.html')


# ====== Segment Views ======
@login_required(login_url='login')
def dashboard_segment(request):
    user_settings, created = UserSettings.objects.get_or_create(user=request.user)
    
    # Count the user's favorite routines
    favorite_count = Favorite.objects.filter(user=request.user).count()
    
    return render(request, 'segments/dashboard.html', {
        'study_duration': user_settings.study_duration,
        'break_duration': user_settings.break_duration,
        'favorite_count': favorite_count,  # <-- pass it to the template
    })


@login_required(login_url='login')
def library_segment(request):
    # Pass serialized routines into the template so the frontend can render DB data
    try:
        qs = Routine.objects.all().values('id', 'title', 'description', 'category',
                                          'difficulty', 'duration_text', 'duration_minutes', 'instructions')
        import json
        routines_json = json.dumps(list(qs))
    except Exception:
        routines_json = '[]'
    # Optionally include Supabase keys from settings so the client can fetch directly
    context = {
        'routines_json': routines_json,
        'SUPABASE_URL': getattr(settings, 'SUPABASE_URL', ''),
        'SUPABASE_ANON_KEY': getattr(settings, 'SUPABASE_ANON_KEY', ''),
    }
    return render(request, 'segments/library.html', context)


@login_required(login_url='login')
def favorites_segment(request):
    fav_ids = Favorite.objects.filter(user=request.user).values_list('routine_id', flat=True)
    favorite_routines = Routine.objects.filter(id__in=fav_ids)
    context = {'favorite_routines': favorite_routines}
    return render(request, 'segments/favorites.html', context)

@login_required
@require_POST
def favorite_toggle(request):
    routine_id = request.POST.get("routine_id")
    if not routine_id:
        return JsonResponse({"ok": False, "error": "Missing ID"}, status=400)
    try:
        routine = Routine.objects.get(pk=routine_id)
    except Routine.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Invalid ID"}, status=404)
    fav, created = Favorite.objects.get_or_create(user=request.user, routine=routine)
    if not created:
        fav.delete()
        return JsonResponse({"ok": True, "favorited": False})
    else:
        return JsonResponse({"ok": True, "favorited": True})

@login_required
def favorite_list(request):
    favorites = Favorite.objects.filter(user=request.user).values_list('routine_id', flat=True)
    return JsonResponse(list(favorites), safe=False)

@login_required(login_url='login')
def profile_segment(request):
    profile, created = Profile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        print("=== PROFILE UPDATE POST RECEIVED ===")  # for debugging
        print(request.POST)
        print(request.FILES)

        name = request.POST.get('name', '').strip()
        bio = request.POST.get('bio', '').strip()
        date_of_birth = request.POST.get('date_of_birth', '')
        profile_picture = request.FILES.get('profile_picture')

        profile.bio = bio
        # Update username if provided — validate uniqueness
        if name:
            if name != request.user.username:
                if User.objects.filter(username=name).exclude(pk=request.user.pk).exists():
                    # Username taken
                    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                        return JsonResponse({'ok': False, 'error': 'username_taken', 'message': 'That username is already taken.'}, status=400)
                    else:
                        messages.error(request, 'That username is already taken.')
                        return redirect('profile_segment')
                try:
                    request.user.username = name
                    request.user.save()
                except Exception:
                    # ignore save errors, continue
                    pass
        if date_of_birth:
            profile.date_of_birth = date_of_birth
        if profile_picture:
            profile.profile_picture = profile_picture

        profile.save()
        print("=== PROFILE SAVED ===")

        # If the request is AJAX (upload from the profile card), return JSON with the new image URL
        is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
        # Attempt to sync to Supabase if configured
        try:
            SUPABASE_URL = getattr(settings, 'SUPABASE_URL', '')
            SUPABASE_ANON_KEY = getattr(settings, 'SUPABASE_ANON_KEY', '')
            if SUPABASE_URL and SUPABASE_ANON_KEY:
                # call helper
                try:
                    update_supabase_profile(request.user, profile)
                except Exception:
                    pass
        except Exception:
            pass
        if is_ajax:
            # Build a sensible URL to return. If no profile picture, return empty string.
            pic_url = ''
            try:
                if profile.profile_picture:
                    pic_url = profile.profile_picture.url
            except Exception:
                pic_url = ''
            # Return the updated values so client can use server-canonical data
            return JsonResponse({'ok': True, 'profile_picture_url': pic_url, 'username': request.user.username, 'bio': profile.bio})

        messages.success(request, "Profile updated successfully!")
        # If the form was submitted via fetch/AJAX (profile modal), return JSON
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            # For modal/form AJAX saves return server-side canonical values
            pic_url = ''
            try:
                if profile.profile_picture:
                    pic_url = profile.profile_picture.url
            except Exception:
                pic_url = ''
            return JsonResponse({'ok': True, 'username': request.user.username, 'bio': profile.bio, 'profile_picture_url': pic_url})
        return redirect('profile_segment')  # make sure this matches your URL name

    return render(request, 'segments/profile.html', {'profile': profile})



@login_required(login_url='login')
def upload_profile_photo(request):
    """Endpoint to accept AJAX photo uploads from the profile card and return JSON."""
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'POST required'}, status=405)

    profile, created = Profile.objects.get_or_create(user=request.user)
    profile_picture = request.FILES.get('profile_picture')
    if not profile_picture:
        return JsonResponse({'ok': False, 'error': 'no_file'}, status=400)
    # Server-side validation: allow only common image types and limit size
    ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
    MAX_BYTES = 5 * 1024 * 1024  # 5 MB

    content_type = getattr(profile_picture, 'content_type', '')
    size = getattr(profile_picture, 'size', None)

    if content_type and content_type not in ALLOWED_MIME:
        return JsonResponse({'ok': False, 'error': 'invalid_type', 'message': 'Unsupported image type.'}, status=400)
    if size is not None and size > MAX_BYTES:
        return JsonResponse({'ok': False, 'error': 'file_too_large', 'message': 'Image exceeds 5MB limit.'}, status=400)

    try:
        profile.profile_picture = profile_picture
        profile.save()
        pic_url = ''
        try:
            if profile.profile_picture:
                pic_url = profile.profile_picture.url
        except Exception:
            pic_url = ''
        # Try to sync the profile photo/url to Supabase if configured
        try:
            SUPABASE_URL = getattr(settings, 'SUPABASE_URL', '')
            SUPABASE_ANON_KEY = getattr(settings, 'SUPABASE_ANON_KEY', '')
            if SUPABASE_URL and SUPABASE_ANON_KEY:
                try:
                    update_supabase_profile(request.user, profile)
                except Exception:
                    pass
        except Exception:
            pass
        return JsonResponse({'ok': True, 'profile_picture_url': pic_url})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': 'save_failed', 'message': str(e)}, status=500)


def update_supabase_profile(user, profile):
    """Attempt to PATCH the user's profile row in Supabase using the anon key.
    Matches on email. This is best-effort and logs errors silently.
    """
    SUPABASE_URL = getattr(settings, 'SUPABASE_URL', '')
    SUPABASE_ANON_KEY = getattr(settings, 'SUPABASE_ANON_KEY', '')
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None

    table = 'profiles'
    # Build request URL to update rows where email matches
    email = user.email
    if not email:
        return None

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?email=eq.{email}"
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    payload = {}
    try:
        # import requests lazily so Django can run without the dependency
        try:
            import requests
        except ImportError:
            try:
                print('requests library not installed; skipping Supabase sync')
            except Exception:
                pass
            return None

        payload['username'] = user.username
        payload['bio'] = profile.bio or ''
        # include profile_picture url if present
        try:
            if profile.profile_picture:
                payload['profile_picture'] = profile.profile_picture.url
        except Exception:
            pass

        resp = requests.patch(url, headers=headers, data=json.dumps(payload), timeout=5)
        if resp.status_code not in (200, 204):
            # log but don't raise
            try:
                print('Supabase sync failed:', resp.status_code, resp.text)
            except Exception:
                pass
        return resp
    except Exception as e:
        try:
            print('Supabase update exception', e)
        except Exception:
            pass
        return None



@login_required(login_url='login')
def settings_segment(request):
    user_settings, created = UserSettings.objects.get_or_create(user=request.user)
    if request.method == 'POST':
        study = request.POST.get('study_duration')
        brk = request.POST.get('break_duration')
        # print("Received POST:", study, brk)
        if study:
            user_settings.study_duration = int(study)
        if brk:
            user_settings.break_duration = int(brk)
        user_settings.save()
        # print("Saved settings:", user_settings.study_duration, user_settings.break_duration)
        return redirect('main')   # This matches the url name for /main/dashboard/
    return render(request, 'segments/settings.html', {'user_settings': user_settings})


@login_required(login_url='login')
def api_routines(request):
    # Return a simple JSON list of routines for the logged-in user to fetch
    qs = Routine.objects.all().values('id', 'title', 'description', 'category',
                                      'difficulty', 'duration_text', 'duration_minutes', 'instructions')
    return JsonResponse(list(qs), safe=False)


@login_required(login_url='login')
def admin_panel_segment(request):
    # Security Check: Only allow Superusers
    if not request.user.is_superuser:
        return redirect('dashboard')
    
    # Fetch all routines (newest first)
    routines = Routine.objects.all().order_by('-id')
    
    # Fetch all users (sorted by ID)
    users = User.objects.all().order_by('id')

    return render(request, 'segments/admin_panel.html', {
        'routines': routines,
        'users': users
    })

@login_required
@require_POST
def add_routine(request):
    # Security Check: Only allow Superusers
    if not request.user.is_superuser:
        return JsonResponse({'ok': False, 'error': 'Unauthorized'}, status=403)

    try:
        # Get data from the form
        title = request.POST.get('title')
        category = request.POST.get('category')
        difficulty = request.POST.get('difficulty')
        duration = request.POST.get('duration_minutes')
        description = request.POST.get('description')
        instructions = request.POST.get('instructions')

        # Basic validation
        if not title or not duration:
            return JsonResponse({'ok': False, 'error': 'Title and Duration are required.'})

        # Create the Routine in the Database
        Routine.objects.create(
            title=title,
            category=category,
            difficulty=difficulty,
            duration_minutes=int(duration),
            duration_text=f"{duration} min", # Auto-generate text
            description=description,
            instructions=instructions
        )
        return JsonResponse({'ok': True})
        
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)})

# ====== Admin Actions ======

@login_required
@require_POST
def delete_routine(request, routine_id):
    if not request.user.is_superuser:
        return JsonResponse({'ok': False, 'error': 'Unauthorized'}, status=403)
    
    routine = get_object_or_404(Routine, id=routine_id)
    routine.delete()
    return JsonResponse({'ok': True})

@login_required
@require_POST
def update_routine(request, routine_id):
    if not request.user.is_superuser:
        return JsonResponse({'ok': False, 'error': 'Unauthorized'}, status=403)

    try:
        routine = get_object_or_404(Routine, id=routine_id)
        
        # Update fields
        routine.title = request.POST.get('title')
        routine.category = request.POST.get('category')
        routine.difficulty = request.POST.get('difficulty')
        duration = request.POST.get('duration_minutes')
        routine.duration_minutes = int(duration)
        routine.duration_text = f"{duration} min"
        routine.description = request.POST.get('description')
        routine.instructions = request.POST.get('instructions')
        
        routine.save()
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)})

@login_required
@require_POST
def toggle_admin_status(request):
    if not request.user.is_superuser:
        return JsonResponse({'ok': False, 'error': 'Unauthorized'}, status=403)
    
    target_user_id = request.POST.get('user_id')
    action = request.POST.get('action') # 'promote' or 'demote'
    
    try:
        user = User.objects.get(id=target_user_id)
        
        # Prevent removing yourself
        if user == request.user:
            return JsonResponse({'ok': False, 'error': "You cannot remove your own admin status."})

        if action == 'promote':
            user.is_superuser = True
            user.is_staff = True
        elif action == 'demote':
            user.is_superuser = False
            user.is_staff = False
        
        user.save()
        return JsonResponse({'ok': True})
    except User.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'User not found'})