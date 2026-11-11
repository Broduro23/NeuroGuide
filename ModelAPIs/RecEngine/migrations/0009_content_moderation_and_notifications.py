# Generated manually because Celery is not installed in the local venv.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("RecEngine", "0008_merge_20261106_0954"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="moderation_status",
            field=models.CharField(
                choices=[("clear", "Clear"), ("flagged", "Flagged"), ("rejected", "Rejected")],
                db_index=True,
                default="clear",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="ContentFlag",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField(blank=True, max_length=1000)),
                ("resolution", models.CharField(choices=[("pending", "Pending"), ("cleared", "Cleared"), ("rejected", "Rejected")], default="pending", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("content", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="RecEngine.content")),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="content_flags", to=settings.AUTH_USER_MODEL)),
                ("resolved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="resolved_content_flags", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="contentflag",
            constraint=models.UniqueConstraint(fields=("content", "reporter"), name="one_flag_per_user_content"),
        ),
        migrations.CreateModel(
            name="UserNotification",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("message", models.TextField(max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("content", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="RecEngine.content")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="neuroguide_notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
