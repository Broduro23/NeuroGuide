from django.db import migrations, models
import django.db.models.deletion


def add_existing_user_roles(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserRole = apps.get_model("RecEngine", "UserRole")
    for user in User.objects.all().iterator():
        role = "admin" if user.is_staff or user.is_superuser else "caregiver"
        UserRole.objects.get_or_create(user_id=user.pk, defaults={"role": role})


class Migration(migrations.Migration):
    dependencies = [
        ("RecEngine", "0004_content_audio_assessment_and_more"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("admin", "Admin"), ("caregiver", "Caregiver/Parent"), ("content_provider", "Content Provider")], default="caregiver", max_length=32)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="role_profile", to="auth.user")),
            ],
        ),
        migrations.RunPython(add_existing_user_roles, migrations.RunPython.noop),
    ]
