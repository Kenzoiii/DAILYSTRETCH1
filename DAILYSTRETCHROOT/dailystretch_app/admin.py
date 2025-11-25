from django.contrib import admin
from .models import UserSettings, Routine
# Register your models here.
class RoutineAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'difficulty', 'duration_minutes')
    search_fields = ('title', 'category')
    list_filter = ('category', 'difficulty')

admin.site.register(UserSettings)
admin.site.register(Routine, RoutineAdmin)