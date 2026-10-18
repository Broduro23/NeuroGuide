from django.db import models
from django.conf import settings


class ChildProfile(models.Model):
    caregiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="children",
    )
    display_name = models.CharField(max_length=100)

    age_months = models.PositiveSmallIntegerField()

    learning_goals = models.JSONField(default=list, blank=True)

    interests = models.JSONField(default=list, blank=True)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.display_name} ({self.age_months} months)"



# Create your models here.
