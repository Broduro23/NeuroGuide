from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import ChildProfile

from rest_framework import serializers


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    password2 = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "password2",
        ]
        read_only_fields = ["id"]

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({
                "password2": "The passwords do not match."
            })

        candidate = User(
            username=attrs["username"],
            email=attrs.get("email", ""),
        )

        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "password": list(exc.messages)
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")

        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
        ]
        read_only_fields = ["id", "username"]

    def validate_email(self, value):
        value = value.strip().lower()

        existing = User.objects.filter(
            email__iexact=value
        ).exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError(
                "This email is already associated with another account."
            )

        return value
class ChildProfileSerializer(serializers.ModelSerializer):
    caregiver = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    class Meta:
        model = ChildProfile
        fields = [
            "id",
            "caregiver",
            "display_name",
            "age_months",
            "learning_goals",
            "interests",
            "notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "caregiver",
            "created_at",
            "updated_at",
        ]

    def validate_age_months(self, value):
        if not 0 <= value <= 83:
            raise serializers.ValidationError(
                "Age must be between 0 and 83 months."
            )

        return value

    def validate_learning_goals(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Learning goals must be a list."
            )

        if not all(
            isinstance(item, str) and item.strip()
            for item in value
        ):
            raise serializers.ValidationError(
                "Each learning goal must be a non-empty string."
            )

        return [item.strip() for item in value]

    def validate_interests(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Interests must be a list."
            )

        if not all(
            isinstance(item, str) and item.strip()
            for item in value
        ):
            raise serializers.ValidationError(
                "Each interest must be a non-empty string."
            )

        return [item.strip() for item in value]