from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from .ml_service import predict_developmental_probabilities

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
        