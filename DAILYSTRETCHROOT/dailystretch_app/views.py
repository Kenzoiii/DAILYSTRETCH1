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
from .models import Routine, UserSettings, Favorite
from .models import Profile
from .models import UserSettings, Favorite


# ====== Registration ======
def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')

        errors = {}

        # Username/email checks
        if User.objects.filter(username=username).exists():
            errors['username'] = 'Username already exists!'
        if User.objects.filter(email=email).exists():
            errors['email'] = 'Email already in use!'

        # Password validation
        if password != confirm_password:
            errors['password'] = 'Passwords do not match!'
        elif len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters.'
        elif not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
            errors['password'] = 'Password must contain at least one letter and one number.'

        if errors:
            # Pass previously entered values to template
            context = {'errors': errors, 'username': username, 'email': email}
            return render(request, 'dailystretch_app/register.html', context)

        # Create new user
        user = User.objects.create_user(
            username=username, email=email, password=password)
        user.save()
        messages.success(
            request, 'Account created successfully! Please login.')
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

        bio = request.POST.get('bio', '').strip()
        date_of_birth = request.POST.get('date_of_birth', '')
        profile_picture = request.FILES.get('profile_picture')

        profile.bio = bio
        if date_of_birth:
            profile.date_of_birth = date_of_birth
        if profile_picture:
            profile.profile_picture = profile_picture

        profile.save()
        print("=== PROFILE SAVED ===")
        messages.success(request, "Profile updated successfully!")
        return redirect('profile_segment')  # make sure this matches your URL name

    return render(request, 'segments/profile.html', {'profile': profile})



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


