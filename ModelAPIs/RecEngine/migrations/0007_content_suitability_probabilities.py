from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("RecEngine", "0006_content_suitability_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="suitability_probabilities",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
