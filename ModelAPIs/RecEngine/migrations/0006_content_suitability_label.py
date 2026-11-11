from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("RecEngine", "0005_userrole"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="suitability_label",
            field=models.CharField(
                blank=True,
                choices=[
                    ("suitable", "Suitable"),
                    ("partially_suitable", "Partially Suitable"),
                    ("not_suitable", "Not Suitable"),
                ],
                default="",
                max_length=24,
            ),
        ),
    ]
