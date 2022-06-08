from django.db import models

class Chat(models.Model):
    room_name = models.CharField(max_length=255)
    allowed_users = models.CharField(max_length=255)
    username = models.CharField(max_length=255, default="")