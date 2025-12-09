from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dailystretch_app', '0010_alter_profile_profile_picture_delete_userprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='usersettings',
            name='theme',
            field=models.CharField(default='light', max_length=10),
        ),
    ]
