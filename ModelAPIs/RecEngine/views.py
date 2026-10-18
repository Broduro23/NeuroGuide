from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import RegisterSerializer, UserProfileSerializer, ChildProfileSerializer
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import ChildProfile, Content
from .dev_assessment import predict_developmental_probabilities
from .safety_api import predict_safety
from .recommendation_engine import recommend_content

import logging

logger = logging.getLogger(__name__)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user



class ChildProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ChildProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChildProfile.objects.filter(
            caregiver=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(caregiver=self.request.user)

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
def serialize_content(content):
    """Convert a Content instance into a JSON-ready dictionary."""

    return {
        "id": content.pk,
        "title": content.title,
        "text": content.text,
        "source_filename": content.source_filename,
        "content_type": content.content_type,
        "age_min": content.age_min,
        "age_max": content.age_max,
        "safety_label": content.safety_label,
        "safety_confidence": content.safety_confidence,
        "safety_assessment": content.safety_assessment,
        "developmental_scores": content.developmental_scores,
        "assessment_status": content.assessment_status,
        "recommendation_eligible": content.recommendation_eligible,
        "created_at": content.created_at.isoformat(),
        "updated_at": content.updated_at.isoformat(),
    }


def extract_content_text(request):
    """
    Extract learning content from either a JSON request or a .txt upload.

    Returns:
        (text, filename, error)
    """

    uploaded_file = request.FILES.get("file")

    if uploaded_file is not None:
        if not uploaded_file.name.lower().endswith(".txt"):
            return None, None, "Only .txt files are supported."

        max_file_size = 2 * 1024 * 1024

        if uploaded_file.size > max_file_size:
            return None, None, "The uploaded file must not exceed 2 MB."

        try:
            text = uploaded_file.read().decode("utf-8")
        except UnicodeDecodeError:
            return None, None, "The uploaded file must use UTF-8 encoding."

        filename = uploaded_file.name

    else:
        text = request.data.get("text", "")
        filename = ""

    if not isinstance(text, str) or not text.strip():
        return None, None, "Learning content text is required."

    if len(text) > 100_000:
        return None, None, "Content must not exceed 100,000 characters."

    return text.strip(), filename, None


def normalize_safety_result(result):
    """
    Normalize a safety-model result.

    Supported tuple example:
        ("Safe", 0.95)
    Expected dictionary example:
        {"label": "safe", "confidence": 0.95}
    """

    if isinstance(result, (tuple, list)) and len(result) == 2:
        raw_label, raw_confidence = result
        label = str(raw_label).lower().strip()

        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError, OverflowError):
            confidence = None

        details = {
            "label": raw_label,
            "confidence": confidence,
        }

    elif isinstance(result, str):
        label = result.lower().strip()
        confidence = None
        details = {"label": result}

    elif isinstance(result, dict):
        label = str(
            result.get("safety_label", result.get("label", result.get("prediction", "")))
        ).lower().strip()

        raw_confidence = result.get("confidence", result.get("score"))

        try:
            confidence = (
                float(raw_confidence)
                if raw_confidence is not None
                else None
            )
        except (TypeError, ValueError):
            confidence = None

        details = result

    else:
        raise ValueError("Unsupported safety-model response format.")

    if label not in {"safe", "unsafe"}:
        label = "inconclusive"

    if confidence is not None and not 0 <= confidence <= 1:
        confidence = None

    return label, confidence, details


def normalize_developmental_result(result):
    """
    Normalize developmental-model predictions into a score dictionary.

    Expected example:
        {
            "number_identification": 0.92,
            "working_memory": 0.78
        }

    If your model returns a nested dictionary, adapt this function
    to extract its actual score mapping.
    """

    if not isinstance(result, dict):
        raise ValueError(
            "Developmental model must return a dictionary of scores."
        )

    # Support a common nested response format.
    scores = result.get("developmental_scores", result)

    if not isinstance(scores, dict) or not scores:
        raise ValueError("No developmental scores were returned.")

    normalized = {}

    for label, value in scores.items():
        try:
            score = float(value)
        except (TypeError, ValueError, OverflowError):
            raise ValueError(
                f"Invalid developmental score for '{label}'."
            )

        if not 0 <= score <= 1:
            raise ValueError(
                f"Developmental score for '{label}' must be between 0 and 1."
            )

        normalized[label] = score

    return normalized

class RecommendationView(APIView):
    """
    Submit educational content, assess it, and persist it in PostgreSQL.

    GET  /api/content/  -> List stored content.
    POST /api/content/ -> Submit and assess content.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        """
        Retrieve content records from PostgreSQL.

        Unsafe and ineligible records are not exposed by default.
        """

        queryset = Content.objects.filter(
            safety_label=Content.SafetyStatus.SAFE,
            assessment_status=Content.AssessmentStatus.COMPLETED,
            recommendation_eligible=True,
        )

        results = [
            serialize_content(item)
            for item in queryset
        ]

        return Response(results, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Save content, run safety classification, and then developmental
        assessment when the safety policy permits it.
        """

        text, filename, error = extract_content_text(request)

        if error:
            return Response(
                {"error": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = request.data.get("title", "").strip()

        if not title:
            title = filename.rsplit(".", 1)[0] if filename else "Untitled content"

        if len(title) > 255:
            return Response(
                {"error": "Title must not exceed 255 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            age_min = int(request.data.get("age_min"))
            age_max = int(request.data.get("age_max"))
        except (TypeError, ValueError):
            return Response(
                {"error": "age_min and age_max must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (0 <= age_min <= age_max <= 83):
            return Response(
                {
                    "error": (
                        "Age range must satisfy "
                        "0 <= age_min <= age_max <= 83 months."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = request.data.get("content_type", "text")

        # Persist the submission before running expensive ML inference.
        content = Content.objects.create(
            title=title,
            text=text,
            source_filename=filename,
            content_type=content_type,
            age_min=age_min,
            age_max=age_max,
            safety_label=Content.SafetyStatus.PENDING,
            assessment_status=Content.AssessmentStatus.PENDING,
            recommendation_eligible=False,
            created_by=request.user,
        )

        try:
            # Stage 1: safety classification.
            safety_result = predict_safety(text)

            safety_label, confidence, details = normalize_safety_result(
                safety_result
            )

            content.safety_label = safety_label
            content.safety_confidence = confidence
            content.safety_assessment = details

            # Stage 2: assess developmental domains only if safety passes.
            if safety_label != Content.SafetyStatus.SAFE:
                content.assessment_status = (
                    Content.AssessmentStatus.COMPLETED
                )
                content.recommendation_eligible = False
                content.save()

                return Response(
                    {
                        "message": (
                            "Content was assessed but is not eligible "
                            "for recommendations."
                        ),
                        "content": serialize_content(content),
                    },
                    status=status.HTTP_201_CREATED,
                )

            developmental_result = (
                predict_developmental_probabilities(text)
            )

            scores = normalize_developmental_result(
                developmental_result
            )

            # Save all assessment results together.
            with transaction.atomic():
                content.developmental_scores = scores
                content.assessment_status = (
                    Content.AssessmentStatus.COMPLETED
                )

                # Only eligible if both required assessments succeeded.
                content.recommendation_eligible = (
                    content.safety_label
                    == Content.SafetyStatus.SAFE
                    and bool(content.developmental_scores)
                )

                content.save()

            return Response(
                {
                    "message": "Content submitted and assessed successfully.",
                    "content": serialize_content(content),
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception:
            logger.exception(
                "Content assessment failed for content ID %s",
                content.pk,
            )

            # Keep the content record, but fail closed.
            content.assessment_status = (
                Content.AssessmentStatus.FAILED
            )
            content.recommendation_eligible = False
            content.save(
                update_fields=[
                    "assessment_status",
                    "recommendation_eligible",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "error": (
                        "Content was saved, but its assessment failed. "
                        "It is not eligible for recommendations."
                    ),
                    "content_id": content.pk,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class ContentDetailView(APIView):
    """
    Retrieve, update, or delete an educational content record.

    GET    /api/content/<id>/
    PATCH  /api/content/<id>/
    DELETE /api/content/<id>/
    """

    permission_classes = [IsAuthenticated]

    def get_object(self, content_id):
        return get_object_or_404(
            Content,
            pk=content_id,
        )

    def get(self, request, content_id):
        content = self.get_object(content_id)

        return Response(
            serialize_content(content),
            status=status.HTTP_200_OK,
        )

    def patch(self, request, content_id):
        content = self.get_object(content_id)

        allowed_fields = {
            "title",
            "text",
            "age_min",
            "age_max",
            "content_type",
        }

        unexpected_fields = set(request.data.keys()) - allowed_fields

        if unexpected_fields:
            return Response(
                {
                    "error": "Unsupported fields.",
                    "fields": sorted(unexpected_fields),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = {}

        for field in allowed_fields:
            if field in request.data:
                updated[field] = request.data[field]

        new_age_min = updated.get("age_min", content.age_min)
        new_age_max = updated.get("age_max", content.age_max)

        try:
            new_age_min = int(new_age_min)
            new_age_max = int(new_age_max)
        except (TypeError, ValueError):
            return Response(
                {"error": "Age values must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (0 <= new_age_min <= new_age_max <= 83):
            return Response(
                {"error": "Invalid age range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "title" in updated:
            if not isinstance(updated["title"], str) or not updated["title"].strip():
                return Response(
                    {"error": "Title must not be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if len(updated["title"]) > 255:
                return Response(
                    {"error": "Title must not exceed 255 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Any change to assessed content or its intended age range
        # invalidates previous results and eligibility.
        reassess = any(
            field in updated
            for field in ("text", "age_min", "age_max")
        )

        for field, value in updated.items():
            if field == "text":
                if not isinstance(value, str) or not value.strip():
                    return Response(
                        {"error": "Content text must not be empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if len(value) > 100_000:
                    return Response(
                        {"error": "Content exceeds the maximum text length."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                value = value.strip()

            setattr(content, field, value)

        content.age_min = new_age_min
        content.age_max = new_age_max

        if reassess:
            content.safety_label = Content.SafetyStatus.PENDING
            content.safety_confidence = None
            content.safety_assessment = {}
            content.developmental_scores = {}
            content.assessment_status = (
                Content.AssessmentStatus.PENDING
            )
            content.recommendation_eligible = False

        content.save()

        return Response(
            {
                "message": (
                    "Content updated. Reassessment is required."
                    if reassess
                    else "Content updated successfully."
                ),
                "content": serialize_content(content),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, content_id):
        content = self.get_object(content_id)
        content.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

class ContentRecommendationView(APIView):


    def post(self, request):
        """
        Recommend assessed learning resources based on age and goals.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        age = data.get("age")
        learning_goals = data.get("learning_goals")
        top_n = data.get("top_n", 5)

        try:
            recommendations = recommend_content(
                age=age,
                learning_goals=learning_goals,
                top_n=top_n,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Failed to generate content recommendations.")
            return Response(
                {"error": "Recommendation generation failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "count": len(recommendations),
                "recommendations": recommendations,
            },
            status=status.HTTP_200_OK,
        )




