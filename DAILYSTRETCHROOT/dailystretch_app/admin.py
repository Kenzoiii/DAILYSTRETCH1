from django.contrib import admin
from .models import UserSettings, Routine
try:
    from .models import UserPreference  # optional, may not exist
    HAS_USER_PREFERENCE = True
except Exception:
    UserPreference = None
    HAS_USER_PREFERENCE = False
# Register your models here.
class RoutineAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'difficulty', 'duration_minutes')
    search_fields = ('title', 'category')
    list_filter = ('category', 'difficulty')

admin.site.register(UserSettings)
if HAS_USER_PREFERENCE and UserPreference is not None:
    admin.site.register(UserPreference)
admin.site.register(Routine, RoutineAdmin)