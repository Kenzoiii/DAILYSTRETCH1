from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from dailystretch_app.models import Profile
from django.conf import settings
import os
from django.core.files import File

class Command(BaseCommand):
    help = 'Create Profile objects for users missing them and optionally copy default profile picture.'

    def add_arguments(self, parser):
        parser.add_argument('--copy-default', action='store_true', help='Copy static default image into media for each created profile')

    def handle(self, *args, **options):
        copy_default = options.get('copy_default', False)
        users = User.objects.all()
        created_count = 0
        for user in users:
            profile, created = Profile.objects.get_or_create(user=user)
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created profile for {user.username}'))
                if copy_default:
                    static_default = os.path.join(settings.BASE_DIR, 'static', 'dailystretch_app', 'images', 'profilepicture.png')
                    if os.path.exists(static_default):
                        try:
                            with open(static_default, 'rb') as f:
                                profile.profile_picture.save('default.png', File(f), save=True)
                            self.stdout.write(self.style.SUCCESS(f'  -> Copied default image for {user.username}'))
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f'  -> Failed to copy default image: {e}'))
        self.stdout.write(self.style.SUCCESS(f'Done. Profiles created: {created_count}'))
