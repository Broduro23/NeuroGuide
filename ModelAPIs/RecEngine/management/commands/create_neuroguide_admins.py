from getpass import getpass

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from RecEngine.models import UserRole


class Command(BaseCommand):
    help = "Create or update the two requested NeuroGuide administrator accounts."

    def handle(self, *args, **options):
        password = getpass("Password for neuroguide4 and neuroguide5: ")
        if not password:
            raise CommandError("A non-empty password is required.")

        for username in ("neuroguide4", "neuroguide5"):
            user, created = User.objects.get_or_create(username=username)
            user.is_staff = True
            user.is_superuser = True
            user.set_password(password)
            user.save()
            UserRole.objects.update_or_create(
                user=user, defaults={"role": UserRole.Role.ADMIN}
            )
            action = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} admin account {username}."))
