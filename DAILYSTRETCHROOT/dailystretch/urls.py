"""
URL configuration for dailystretch project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from dailystretch_app import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.landing_page, name='landing'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),

    # Home page
    path('main/', views.main_view, name='main'),

    # Segment URLs (for dynamic loading into the "island")
    path('main/dashboard/', views.dashboard_segment, name='dashboard'),
    path('main/library/', views.library_segment, name='library'),
    path('main/favorites/', views.favorites_segment, name='favorites'),
    path('main/profile/', views.profile_segment, name='profile'),
    path('main/profile/upload-photo/', views.upload_profile_photo, name='upload_profile_photo'),
    path('main/settings/', views.settings_segment, name='settings'),
    path('main/admin-panel/', views.admin_panel_segment, name='admin_panel'),
    path('main/add-routine/', views.add_routine, name='add_routine'),
    path('main/admin/routine/delete/<int:routine_id>/', views.delete_routine, name='delete_routine'),
    path('main/admin/routine/update/<int:routine_id>/', views.update_routine, name='update_routine'),
    path('main/admin/user/toggle/', views.toggle_admin_status, name='toggle_admin_status'),
    path('favorite-toggle/', views.favorite_toggle, name='favorite_toggle'),
    path('favorite-list/', views.favorite_list, name='favorite_list'),
    # API
    path('api/routines/', views.api_routines, name='api_routines'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

