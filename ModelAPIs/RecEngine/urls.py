from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import DevelopmentalPredictionView
from .views import SafetyPredictionView
from .views import RecommendationView
from .views import ContentRecommendationView
from .views import (
    ChildProfileViewSet,
    ContentAssessmentView,
    ContentDetailView,
    LoginView,
    RecommendationActivityView,
    RecommendationFeedbackView,
    RecommendationHistoryView,
    RegisterView,
    UserProfileView,
)

router = DefaultRouter()
router.register("children", ChildProfileViewSet, basename="child-profile")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("", include(router.urls)),
    path(
        "predict/",
        DevelopmentalPredictionView.as_view(),
        name="developmental-predict",
    ),
    path(
        "safety/predict/",
        SafetyPredictionView.as_view(),
        name="safety-predict",
    ),
    path(
        "content/",
        RecommendationView.as_view(),
        name="content-library",
    ),
    path(
        "content/<int:content_id>/assess/",
        ContentAssessmentView.as_view(),
        name="content-assess",
    ),
    path(
        "content/<int:content_id>/",
        ContentDetailView.as_view(),
        name="content-detail",
    ),

    path(
        "recommend/",
        ContentRecommendationView.as_view(),
        name="recommend-content",
    ),
    path(
        "recommend/history/",
        RecommendationHistoryView.as_view(),
        name="recommendation-history",
    ),
    path(
        "recommend/history/<int:history_id>/feedback/",
        RecommendationFeedbackView.as_view(),
        name="recommendation-feedback",
    ),
    path(
        "recommend/history/<int:history_id>/activity/",
        RecommendationActivityView.as_view(),
        name="recommendation-activity",
    ),
    path(
        "profile/",
        UserProfileView.as_view(),
        name="user-profile",
    ),
    path("refresh/", 
         TokenRefreshView.as_view(),
         name="token_refresh"
    ),
]
