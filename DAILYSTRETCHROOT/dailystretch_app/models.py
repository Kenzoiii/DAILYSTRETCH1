from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
import os
from django.core.files import File
from django.contrib.postgres.fields import JSONField as PostgresJSONField
try:
    # Django 3.1+ has JSONField in django.db.models
    from django.db.models import JSONField as DjangoJSONField
except Exception:
    DjangoJSONField = None

class Routine(models.Model):
    title = models.TextField()
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=64, blank=True, null=True)
    difficulty = models.CharField(max_length=32, blank=True, null=True)
    duration_text = models.CharField(max_length=64, blank=True, null=True)
    duration_minutes = models.IntegerField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.title

class UserSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    study_duration = models.PositiveIntegerField(default=25)
    break_duration = models.PositiveIntegerField(default=5)
    theme = models.CharField(max_length=10, default='light')

    def __str__(self):
        return f"{self.user.username}'s Settings"


# Ensure a UserSettings row exists for each new User
@receiver(post_save, sender=User)
def create_usersettings_for_new_user(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        UserSettings.objects.get_or_create(user=instance)
    except Exception:
        pass


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        default='profile_pictures/default.png',  # <- default image
        blank=True,
        null=True
    )


# Ensure a Profile is created for each new User and populate a default picture
@receiver(post_save, sender=User)
def create_profile_for_new_user(sender, instance, created, **kwargs):
    if not created:
        return
    profile = Profile.objects.create(user=instance)

    # Try to copy the project's static default image into the user's media profile picture
    default_static_path = os.path.join(
        settings.BASE_DIR,
        'static', 'dailystretch_app', 'images', 'profilepicture.png'
    )

    if os.path.exists(default_static_path):
        try:
            with open(default_static_path, 'rb') as f:
                profile.profile_picture.save('default.png', File(f), save=True)
        except Exception:
            # If saving fails, leave the default field alone (it already has a default path)
            pass

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    routine = models.ForeignKey('Routine', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'routine')

