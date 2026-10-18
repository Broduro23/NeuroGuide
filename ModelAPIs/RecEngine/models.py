from django.db import models
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator


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
class Content(models.Model):
    class SafetyStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SAFE = "safe", "Safe"
        UNSAFE = "unsafe", "Unsafe"
        INCONCLUSIVE = "inconclusive", "Inconclusive"

    class AssessmentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    # Content information
    title = models.CharField(max_length=255)
    text = models.TextField()
    source_filename = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=50, default="text")

    # Intended age range, expressed in months
    age_min = models.PositiveSmallIntegerField(
        validators=[
            MinValueValidator(0),
            MaxValueValidator(83),
        ]
    )

    age_max = models.PositiveSmallIntegerField(
        validators=[
            MinValueValidator(0),
            MaxValueValidator(83),
        ]
    )

    # Safety classification results
    safety_label = models.CharField(
        max_length=20,
        choices=SafetyStatus.choices,
        default=SafetyStatus.PENDING,
    )

    safety_confidence = models.FloatField(
        null=True,
        blank=True,
    )

    safety_assessment = models.JSONField(
        default=dict,
        blank=True,
    )

    # Developmental assessment results
    developmental_scores = models.JSONField(
        default=dict,
        blank=True,
    )

    # Assessment and recommendation status
    assessment_status = models.CharField(
        max_length=20,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.PENDING,
    )

    recommendation_eligible = models.BooleanField(
        default=False,
    )

    # Account responsible for submitting the content
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_learning_content",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["safety_label", "recommendation_eligible"],
                name="content_eligibility_idx",
            ),
            models.Index(
                fields=["age_min", "age_max"],
                name="content_age_range_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if self.age_max < self.age_min:
            from django.core.exceptions import ValidationError

            raise ValidationError({
                "age_max": (
                    "Maximum age must be greater than "
                    "or equal to minimum age."
                )
            })

    def save(self, *args, **kwargs):
        # Fail closed: content cannot be recommended unless
        # safety and assessment requirements are satisfied.
        if (
            self.safety_label != self.SafetyStatus.SAFE
            or self.assessment_status != self.AssessmentStatus.COMPLETED
        ):
            self.recommendation_eligible = False

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
    
