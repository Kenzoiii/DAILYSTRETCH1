"""
Django settings for dailystretch project (Render-ready).
"""

from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv

# ------------------------------
# Base Directory & Environment
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, ".env"))
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ------------------------------
# Security
# ------------------------------
SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-*-&su5(umv95o$-1v0ae)q3*&&o&5fdcf&cdoy9u@b&mo!1l+u"
)
DEBUG = os.environ.get("DEBUG", "True") == "True"

# When deploying to Render, Render automatically sets the domain.
# For now, use * to allow access — later you can restrict it.
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split()

# ------------------------------
# Application definition
# ------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'dailystretch_app',  # your app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Added for Render static handling
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'dailystretch.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'dailystretch.wsgi.application'

# ------------------------------
# Database Configuration
# ------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(default=DATABASE_URL, conn_max_age=600, ssl_require=True)
    }
else:
    try:
        # Try Supabase connection
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': 'postgres',
                'USER': 'postgres.toutspsgjnhlfryvevqi',
                'PASSWORD': 'qUMJN?L&M.sq&X6',
                'HOST': 'aws-1-ap-southeast-1.pooler.supabase.com',
                'PORT': '6543',
                'OPTIONS': {'sslmode': 'require'},
            }
        }
    except Exception:
        # Fallback to SQLite if Postgres fails
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
            }
        }


# ------------------------------
# Password validation
# ------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ------------------------------
# Internationalization
# ------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ------------------------------
# Static files (important for Render)
# ------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

# Tell Whitenoise to compress and cache static files
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ------------------------------
# Default primary key field type
# ------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
