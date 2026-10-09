from django.urls import path
from .views import DevelopmentalPredictionView
from .views import SafetyPredictionView

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
    )
]