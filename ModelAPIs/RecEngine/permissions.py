from rest_framework.permissions import BasePermission

from .models import UserRole


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_staff or user.is_superuser:
        return UserRole.Role.ADMIN
    try:
        return user.role_profile.role
    except UserRole.DoesNotExist:
        return UserRole.Role.CAREGIVER


class RolePermission(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        return user_role(request.user) in self.allowed_roles


class AdminOnly(RolePermission):
    allowed_roles = (UserRole.Role.ADMIN,)


class CaregiverAccess(RolePermission):
    allowed_roles = (UserRole.Role.ADMIN, UserRole.Role.CAREGIVER)


class ContentProviderAccess(RolePermission):
    allowed_roles = (UserRole.Role.ADMIN, UserRole.Role.CONTENT_PROVIDER)


class ApplicationUserAccess(RolePermission):
    allowed_roles = tuple(UserRole.Role.values)
