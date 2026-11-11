from django.db import models
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User


class UserRole(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        CAREGIVER = "caregiver", "Caregiver/Parent"
        CONTENT_PROVIDER = "content_provider", "Content Provider"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="role_profile")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.CAREGIVER)

    def __str__(self):
        return f"{self.user.username}: {self.role}"


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

    class SuitabilityStatus(models.TextChoices):
        SUITABLE = "suitable", "Suitable"
        PARTIALLY_SUITABLE = "partially_suitable", "Partially Suitable"
        NOT_SUITABLE = "not_suitable", "Not Suitable"

    class SafetyStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SAFE = "safe", "Safe"
        UNSAFE = "unsafe", "Unsafe"
        INCONCLUSIVE = "inconclusive", "Inconclusive"

    class AssessmentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class ModerationStatus(models.TextChoices):
        CLEAR = "clear", "Clear"
        FLAGGED = "flagged", "Flagged"
        REJECTED = "rejected", "Rejected"

    class ContentType(models.TextChoices):
        TEXT = "text", "Text"
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"

    # Content information
    title = models.CharField(max_length=255)

    text = models.TextField(
        blank=True,
        default="",
    )

    source_filename = models.CharField(
        max_length=255,
        blank=True,
    )

    content_type = models.CharField(
        max_length=50,
        choices=ContentType.choices,
        default=ContentType.TEXT,
    )

    # Uploaded audio or video file
    media_file = models.FileField(
        upload_to="learning_content/%Y/%m/",
        null=True,
        blank=True,
    )

    # Speech transcribed from uploaded audio or video
    transcript = models.TextField(
        blank=True,
        default="",
    )

    # Duration of uploaded audio/video, in seconds
    media_duration_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

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

    # Visual screening results from video frames
    visual_assessment = models.JSONField(
        default=dict,
        blank=True,
    )

    # Audio-specific assessment results
    audio_assessment = models.JSONField(
        default=dict,
        blank=True,
    )

    # Developmental assessment results
    developmental_scores = models.JSONField(
        default=dict,
        blank=True,
    )

    # Overall textual suitability predicted by the developmental model.
    suitability_label = models.CharField(
        max_length=24,
        choices=SuitabilityStatus.choices,
        blank=True,
        default="",
    )

    suitability_probabilities = models.JSONField(
        default=dict,
        blank=True,
    )

    # Developmental assessment status
    assessment_status = models.CharField(
        max_length=20,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.PENDING,
    )

    # Audio/video processing status
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
    )

    # Recommendation eligibility
    recommendation_eligible = models.BooleanField(
        default=False,
    )

    moderation_status = models.CharField(
        max_length=16,
        choices=ModerationStatus.choices,
        default=ModerationStatus.CLEAR,
        db_index=True,
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
                fields=[
                    "safety_label",
                    "recommendation_eligible",
                ],
                name="content_eligibility_idx",
            ),
            models.Index(
                fields=["age_min", "age_max"],
                name="content_age_range_idx",
            ),
            models.Index(
                fields=["content_type", "processing_status"],
                name="content_processing_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if self.age_max < self.age_min:
            raise ValidationError({
                "age_max": (
                    "Maximum age must be greater than "
                    "or equal to minimum age."
                )
            })

        if self.content_type == self.ContentType.TEXT:
            if not self.text.strip():
                raise ValidationError({
                    "text": "Text content must not be empty."
                })

        elif self.content_type in [
            self.ContentType.VIDEO,
            self.ContentType.AUDIO,
        ]:
            if not self.media_file:
                raise ValidationError({
                    "media_file": (
                        "An uploaded media file is required "
                        "for audio or video content."
                    )
                })

    def save(self, *args, **kwargs):
        # Fail closed: content is not eligible unless the
        # required safety and developmental assessments pass.
        if (
            self.safety_label != self.SafetyStatus.SAFE
            or self.moderation_status != self.ModerationStatus.CLEAR
            or self.assessment_status
            != self.AssessmentStatus.COMPLETED
            or self.suitability_label
            not in {
                self.SuitabilityStatus.SUITABLE,
                self.SuitabilityStatus.PARTIALLY_SUITABLE,
            }
            or not isinstance(self.developmental_scores, dict)
            or not self.developmental_scores
        ):
            self.recommendation_eligible = False

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ContentFlag(models.Model):
    class Resolution(models.TextChoices):
        PENDING = "pending", "Pending"
        CLEARED = "cleared", "Cleared"
        REJECTED = "rejected", "Rejected"

    content = models.ForeignKey(
        Content,
        on_delete=models.CASCADE,
        related_name="flags",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_flags",
    )
    reason = models.TextField(blank=True, max_length=1000)
    resolution = models.CharField(
        max_length=16,
        choices=Resolution.choices,
        default=Resolution.PENDING,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_content_flags",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["content", "reporter"],
                name="one_flag_per_user_content",
            )
        ]


class UserNotification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="neuroguide_notifications",
    )
    content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    title = models.CharField(max_length=180)
    message = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class RecommendationHistory(models.Model):
    caregiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommendation_history",
    )
    child = models.ForeignKey(
        ChildProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recommendation_history",
    )
    child_id_snapshot = models.PositiveIntegerField()
    child_name_snapshot = models.CharField(max_length=100)
    age_months = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(83)],
    )
    learning_goals = models.JSONField(default=list)
    recommendations = models.JSONField(default=list)
    feedback_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    feedback_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["caregiver", "-created_at"],
                name="rec_hist_user_time_idx",
            ),
            models.Index(
                fields=["child", "-created_at"],
                name="rec_hist_child_time_idx",
            ),
        ]

    def __str__(self):
        return f"Recommendations for {self.child_id} at {self.created_at}"


class RecommendationActivity(models.Model):
    class EventType(models.TextChoices):
        VIEWED = "viewed", "Viewed"
        CLICKED = "clicked", "Clicked"
        SAVED = "saved", "Saved"
        COMPLETED = "completed", "Completed"
        DISMISSED = "dismissed", "Dismissed"

    history = models.ForeignKey(
        RecommendationHistory,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recommendation_activities",
    )
    content_id_snapshot = models.PositiveIntegerField()
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["history", "-created_at"],
                name="rec_activity_time_idx",
            ),
        ]

    def __str__(self):
        return f"{self.event_type} content {self.content_id_snapshot}"
    
