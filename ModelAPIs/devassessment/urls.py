from django.urls import path
from .views import DevelopmentalPredictionView

urlpatterns = [
    path(
        "predict/",
        DevelopmentalPredictionView.as_view(),
        name="developmental-predict",
    ),
]