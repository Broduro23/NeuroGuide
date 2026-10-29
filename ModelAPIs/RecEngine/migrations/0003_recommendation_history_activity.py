import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("RecEngine", "0002_content"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RecommendationHistory",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "age_months",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(0),
                            django.core.validators.MaxValueValidator(83),
                        ]
                    ),
                ),
                ("child_id_snapshot", models.PositiveIntegerField()),
                ("child_name_snapshot", models.CharField(max_length=100)),
                ("learning_goals", models.JSONField(default=list)),
                ("recommendations", models.JSONField(default=list)),
                (
                    "feedback_rating",
                    models.PositiveSmallIntegerField(
                        blank=True,
                        null=True,
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ],
                    ),
                ),
                ("feedback_text", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "caregiver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recommendation_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "child",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recommendation_history",
                        to="RecEngine.childprofile",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["caregiver", "-created_at"],
                        name="rec_hist_user_time_idx",
                    ),
                    models.Index(
                        fields=["child", "-created_at"],
                        name="rec_hist_child_time_idx",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="RecommendationActivity",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "content_id_snapshot",
                    models.PositiveIntegerField(),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("viewed", "Viewed"),
                            ("clicked", "Clicked"),
                            ("saved", "Saved"),
                            ("completed", "Completed"),
                            ("dismissed", "Dismissed"),
                        ],
                        max_length=20,
                    ),
                ),
                ("details", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "content",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recommendation_activities",
                        to="RecEngine.content",
                    ),
                ),
                (
                    "history",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="RecEngine.recommendationhistory",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["history", "-created_at"],
                        name="rec_activity_time_idx",
                    ),
                ],
            },
        ),
    ]
