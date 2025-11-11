from django.db import models
from django.contrib.auth.models import User

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

    def __str__(self):
        return f"{self.user.username}'s Settings"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True, null=True)
    avatar_url = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profile'


    def __str__(self):
        return self.user.username

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    routine = models.ForeignKey('Routine', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'routine')