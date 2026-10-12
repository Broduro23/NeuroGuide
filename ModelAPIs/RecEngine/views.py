from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from .dev_assessment import predict_developmental_probabilities
from .safety_api import predict_safety
from .recommendation_engine import recommend_content
from .temp_store import get_all_content, add_content
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
import logging

logger = logging.getLogger(__name__)


# Create your views here.
class DevelopmentalPredictionView(APIView):

    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]

    def post(self, request):

        text = request.data.get("text", "")

        # If a text file was uploaded, read its contents.
        uploaded_file = request.FILES.get("file")

        if uploaded_file:
            if not uploaded_file.name.lower().endswith(".txt"):
                return Response(
                    {
                        "error": "Only .txt files are supported."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Limit uploads to 1 MB.
            if uploaded_file.size > 1_000_000:
                return Response(
                    {
                        "error": "The file must not exceed 1 MB."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                text = uploaded_file.read().decode("utf-8")
            except UnicodeDecodeError:
                return Response(
                    {
                        "error": "The file must use UTF-8 text encoding."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(text, str) or not text.strip():
            return Response(
                {
                    "error": "Provide non-empty text or upload a .txt file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            probabilities = predict_developmental_probabilities(text)

            # Use a configurable threshold for predicted labels.
            threshold = 0.5

            predicted_domains = [
                label
                for label, probability in probabilities.items()
                if probability >= threshold
            ]

            return Response(
                {
                    "input_text": text,
                    "probabilities": probabilities,
                    "predicted_domains": predicted_domains,
                    "threshold": threshold,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            return Response(
                {
                    "error": "Prediction failed. Check the model configuration and server logs."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class SafetyPredictionView(APIView):
    parser_classes = [
        JSONParser,
        MultiPartParser,
        FormParser,
    ]

    def post(self, request):

        text = request.data.get("text", "")

        # If a text file was uploaded, read its contents.
        uploaded_file = request.FILES.get("file")

        if uploaded_file:
            if not uploaded_file.name.lower().endswith(".txt"):
                return Response(
                    {
                        "error": "Only .txt files are supported."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Limit uploads to 1 MB.
            if uploaded_file.size > 1_000_000:
                return Response(
                    {
                        "error": "The file must not exceed 1 MB."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                text = uploaded_file.read().decode("utf-8")
            except UnicodeDecodeError:
                return Response(
                    {
                        "error": "The file must use UTF-8 text encoding."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(text, str) or not text.strip():
            return Response(
                {
                    "error": "Provide non-empty text or upload a .txt file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result, confidence = predict_safety(text)

            return Response(
                {
                    "input_text": text,
                    "classification": result,
                    "confidence": confidence,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            return Response(
                {
                    "error": "Prediction failed. Check the model configuration and server logs."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
class RecommendationView(APIView):

    def add_learning_content(request):
        """
        Assess a learning resource and add it to the temporary library.
        """

        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse(
                {"error": "Invalid JSON request."},
                status=400,
            )

        if not isinstance(data, dict):
            return JsonResponse(
                {"error": "Request body must be a JSON object."},
                status=400,
            )

        title = data.get("title")
        text = data.get("text")
        age_min = data.get("age_min")
        age_max = data.get("age_max")
        content_type = data.get("content_type", "text")

        # Validate title and text.
        if not isinstance(title, str) or not title.strip():
            return JsonResponse(
                {"error": "A title is required."},
                status=400,
            )

        if not isinstance(text, str) or not text.strip():
            return JsonResponse(
                {"error": "Non-empty content text is required."},
                status=400,
            )

        if len(text) > 5000:
            return JsonResponse(
                {"error": "Text must not exceed 5000 characters."},
                status=400,
            )

        # Validate age bounds.
        if (
            not isinstance(age_min, int)
            or isinstance(age_min, bool)
            or not isinstance(age_max, int)
            or isinstance(age_max, bool)
            or age_min < 0
            or age_max < age_min
        ):
            return JsonResponse(
                {
                    "error": (
                        "Provide valid age_min and age_max integers. "
                        "age_max must be greater than or equal to age_min."
                    )
                },
                status=400,
            )

        if not isinstance(content_type, str) or not content_type.strip():
            return JsonResponse(
                {"error": "content_type must be a non-empty string."},
                status=400,
            )

        text = text.strip()

        try:
            # Step 1: Run the safety classifier.
            safety_result = predict_safety(text)

            if not isinstance(safety_result, dict):
                return JsonResponse(
                    {"error": "Invalid safety classifier response."},
                    status=503,
                )

            safety_label = str(
                safety_result.get("label", "")
            ).strip().lower()

            # Fail closed if the result is not recognized.
            if safety_label not in {"safe", "unsafe"}:
                return JsonResponse(
                    {
                        "error": "Safety assessment was inconclusive.",
                        "stored": False,
                    },
                    status=503,
                )

            # Step 2: If unsafe, store it as ineligible.
            if safety_label == "unsafe":
                item = add_content({
                    "title": title.strip(),
                    "text": text,
                    "age_min": age_min,
                    "age_max": age_max,
                    "content_type": content_type.strip(),
                    "safety_label": "Unsafe",
                    "safety_assessment": safety_result,
                    "developmental_scores": {},
                    "assessment_complete": True,
                    "recommendation_eligible": False,
                })

                return JsonResponse(
                    {
                        "message": (
                            "Content assessed and excluded from "
                            "recommendations because it was classified "
                            "as unsafe."
                        ),
                        "content": {
                            "id": item["id"],
                            "title": item["title"],
                            "safety": item["safety_assessment"],
                            "recommendation_eligible": False,
                        },
                    },
                    status=201,
                )

            # Step 3: Run developmental assessment for safe content.
            developmental_scores = (
                predict_developmental_probabilities(text)
            )

            if not isinstance(developmental_scores, dict):
                return JsonResponse(
                    {
                        "error": (
                            "Invalid developmental classifier response."
                        ),
                        "stored": False,
                    },
                    status=503,
                )

            # Step 4: Store the assessed content.
            item = add_content({
                "title": title.strip(),
                "text": text,
                "age_min": age_min,
                "age_max": age_max,
                "content_type": content_type.strip(),
                "safety_label": "Safe",
                "safety_assessment": safety_result,
                "developmental_scores": developmental_scores,
                "assessment_complete": True,
                "recommendation_eligible": True,
            })

            return JsonResponse(
                {
                    "message": "Content assessed and added successfully.",
                    "content": {
                        "id": item["id"],
                        "title": item["title"],
                        "safety": item["safety_assessment"],
                        "developmental_scores": (
                            item["developmental_scores"]
                        ),
                        "recommendation_eligible": True,
                    },
                },
                status=201,
            )

        except Exception:
            logger.exception("Failed to assess learning content.")

            return JsonResponse(
                {
                    "error": "Content assessment failed.",
                    "stored": False,
                },
                status=500,
            )
    @require_http_methods(["GET"])  
    def list_learning_content(request):
        """
        Return a summary of all resources in the temporary library.
        """

        content_items = get_all_content()

        results = []

        for item in content_items:
            results.append({
                "id": item["id"],
                "title": item["title"],
                "content_type": item["content_type"],
                "age_min": item["age_min"],
                "age_max": item["age_max"],
                "safety_label": item["safety_label"],
                "assessment_complete": item["assessment_complete"],
                "recommendation_eligible": (
                    item["recommendation_eligible"]
                ),
            })

        return JsonResponse({
            "count": len(results),
            "content": results,
        })
    @require_http_methods(["POST"])
    def get_recommendations(request):
        """
        Recommend assessed learning resources based on age and goals.
        """

        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse(
                {"error": "Invalid JSON request."},
                status=400,
            )

        if not isinstance(data, dict):
            return JsonResponse(
                {"error": "Request body must be a JSON object."},
                status=400,
            )
    
class ContentRecommendationView(RecommendationView):

    def post(self, request):
        return self.recommend(request)          