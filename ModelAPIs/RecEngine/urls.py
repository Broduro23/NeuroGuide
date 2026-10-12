from django.urls import path
from .views import DevelopmentalPredictionView
from .views import SafetyPredictionView
from .views import RecommendationView
from .views import ContentRecommendationView

urlpatterns = [
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
        "recommend/",
        ContentRecommendationView.as_view(),
        name="recommend-content",
    ),
]