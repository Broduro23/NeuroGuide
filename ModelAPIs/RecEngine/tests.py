"""Backend tests for the NeuroGuide API and media/recommendation flows.

Model inference and Celery dispatch are mocked so the suite runs in the API
container without model weights, Hugging Face access, Redis, or a worker.
"""

import sys
import tempfile
import types
from pathlib import Path
from unittest.mock import Mock, call, patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from .media_processing import _classify_frames, process_media_content
from .models import (
    ChildProfile,
    Content,
    RecommendationActivity,
    RecommendationHistory,
)


VALID_GOAL = "number_identification"
STRONG_PASSWORD = "Violet!7_River-Quartz-9382"


class MediaStorageMixin:
    """Give tests an isolated media directory and remove it after each test."""

    def setUp(self):
        super().setUp()
        self._media_directory = tempfile.TemporaryDirectory(
            prefix="neuroguide-tests-"
        )
        self.addCleanup(self._media_directory.cleanup)
        settings_override = override_settings(
            MEDIA_ROOT=self._media_directory.name,
            MEDIA_MAX_UPLOAD_BYTES=100 * 1024 * 1024,
        )
        settings_override.enable()
        self.addCleanup(settings_override.disable)


class AuthenticatedAPITestCase(MediaStorageMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="caregiver",
            email="caregiver@example.com",
            password=STRONG_PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def make_child(self, *, caregiver=None, age=36, goals=None):
        return ChildProfile.objects.create(
            caregiver=caregiver or self.user,
            display_name="Ari",
            age_months=age,
            learning_goals=goals if goals is not None else [VALID_GOAL],
        )

    def make_text_content(
        self,
        *,
        title="Counting activity",
        age_min=24,
        age_max=48,
        safety=Content.SafetyStatus.SAFE,
        assessment=Content.AssessmentStatus.COMPLETED,
        eligible=True,
        scores=None,
    ):
        return Content.objects.create(
            title=title,
            text="Count the objects together.",
            content_type=Content.ContentType.TEXT,
            age_min=age_min,
            age_max=age_max,
            safety_label=safety,
            assessment_status=assessment,
            recommendation_eligible=eligible,
            developmental_scores=(
                scores if scores is not None else {VALID_GOAL: 0.9}
            ),
            created_by=self.user,
        )

    def make_media_content(
        self,
        *,
        content_type=Content.ContentType.VIDEO,
        filename=None,
        age_min=24,
        age_max=48,
        safety=Content.SafetyStatus.SAFE,
        assessment=Content.AssessmentStatus.COMPLETED,
        processing=Content.ProcessingStatus.COMPLETED,
        eligible=True,
        scores=None,
    ):
        extension = "mp3" if content_type == Content.ContentType.AUDIO else "mp4"
        file_name = filename or f"sample.{extension}"
        return Content.objects.create(
            title="Sample media",
            content_type=content_type,
            media_file=SimpleUploadedFile(file_name, b"fake media bytes"),
            age_min=age_min,
            age_max=age_max,
            safety_label=safety,
            assessment_status=assessment,
            processing_status=processing,
            recommendation_eligible=eligible,
            developmental_scores=scores or {},
            created_by=self.user,
        )

    def make_history(self, recommendations, *, caregiver=None, child=None):
        child = child or self.make_child(caregiver=caregiver or self.user)
        return RecommendationHistory.objects.create(
            caregiver=caregiver or self.user,
            child=child,
            child_id_snapshot=child.pk,
            child_name_snapshot=child.display_name,
            age_months=child.age_months,
            learning_goals=child.learning_goals,
            recommendations=recommendations,
        )


class RegistrationAndAuthenticationTests(MediaStorageMixin, APITestCase):
    def test_registration_creates_user_with_hashed_password(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newcaregiver",
                "email": " NEW@example.com ",
                "password": STRONG_PASSWORD,
                "password2": STRONG_PASSWORD,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="newcaregiver")
        self.assertTrue(user.check_password(STRONG_PASSWORD))
        self.assertNotEqual(user.password, STRONG_PASSWORD)
        self.assertEqual(user.email, "new@example.com")

    def test_registration_rejects_mismatched_passwords(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "newcaregiver",
                "email": "new@example.com",
                "password": STRONG_PASSWORD,
                "password2": "Different!Password-9274",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password2", response.data)
        self.assertFalse(User.objects.filter(username="newcaregiver").exists())

    def test_login_and_refresh_issue_valid_tokens(self):
        user = User.objects.create_user(
            username="loginuser",
            password=STRONG_PASSWORD,
        )
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": user.username, "password": STRONG_PASSWORD},
            format="json",
        )

        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)
        self.assertIn("refresh", login.data)

        refreshed = self.client.post(
            reverse("token_refresh"),
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.data)

    def test_profile_requires_authentication(self):
        response = self.client.get(reverse("user-profile"))
        self.assertEqual(response.status_code, 403)


class ProfileAndChildAPITests(AuthenticatedAPITestCase):
    def test_profile_returns_and_updates_current_user(self):
        get_response = self.client.get(reverse("user-profile"))
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data["username"], self.user.username)

        update_response = self.client.patch(
            reverse("user-profile"),
            {"first_name": "Taylor", "last_name": "Caregiver"},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data["first_name"], "Taylor")
        self.assertEqual(update_response.data["last_name"], "Caregiver")

    def test_child_create_list_and_update_are_scoped_to_caregiver(self):
        create_response = self.client.post(
            reverse("child-profile-list"),
            {
                "display_name": "Mika",
                "age_months": 30,
                "learning_goals": [VALID_GOAL],
                "interests": ["music"],
                "notes": "Likes songs",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        child_id = create_response.data["id"]
        self.assertEqual(create_response.data["caregiver"], self.user.pk)

        list_response = self.client.get(reverse("child-profile-list"))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([child["id"] for child in list_response.data], [child_id])

        second_user = User.objects.create_user(
            username="othercaregiver",
            password=STRONG_PASSWORD,
        )
        self.client.force_authenticate(second_user)
        self.assertEqual(
            self.client.get(
                reverse("child-profile-detail", kwargs={"pk": child_id})
            ).status_code,
            404,
        )

    def test_child_validation_rejects_invalid_age_and_goals(self):
        response = self.client.post(
            reverse("child-profile-list"),
            {
                "display_name": "Mika",
                "age_months": 84,
                "learning_goals": [VALID_GOAL],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.post(
            reverse("child-profile-list"),
            {
                "display_name": "Mika",
                "age_months": 30,
                "learning_goals": ["   "],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class PredictionAPITests(MediaStorageMixin, APITestCase):
    def _fake_module(self, name, **functions):
        module = types.ModuleType(name)
        for function_name, function in functions.items():
            setattr(module, function_name, function)
        return module

    def test_safety_prediction_returns_classification_and_confidence(self):
        predict = Mock(return_value=("Safe", 0.97))
        fake_safety = self._fake_module(
            "RecEngine.safety_api", predict_safety=predict
        )
        with patch.dict(sys.modules, {"RecEngine.safety_api": fake_safety}):
            response = self.client.post(
                reverse("safety-predict"),
                {"text": "We will read a story."},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["classification"], "Safe")
        self.assertEqual(response.data["confidence"], 0.97)
        predict.assert_called_once_with("We will read a story.")

    def test_developmental_prediction_returns_probabilities_and_thresholded_domains(self):
        probabilities = {VALID_GOAL: 0.8, "working_memory": 0.2}
        predict = Mock(return_value=probabilities)
        fake_developmental = self._fake_module(
            "RecEngine.dev_assessment",
            predict_developmental_probabilities=predict,
        )
        with patch.dict(
            sys.modules,
            {"RecEngine.dev_assessment": fake_developmental},
        ):
            response = self.client.post(
                reverse("developmental-predict"),
                {"text": "Count the blocks."},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["probabilities"], probabilities)
        self.assertEqual(response.data["predicted_domains"], [VALID_GOAL])

    def test_prediction_endpoints_reject_empty_text(self):
        self.assertEqual(
            self.client.post(
                reverse("safety-predict"), {"text": "  "}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                reverse("developmental-predict"), {"text": ""}, format="json"
            ).status_code,
            400,
        )


class ContentAPITests(AuthenticatedAPITestCase):
    @staticmethod
    def fake_module(name, **functions):
        module = types.ModuleType(name)
        for function_name, function in functions.items():
            setattr(module, function_name, function)
        return module

    def test_safe_text_upload_is_assessed_and_eligible(self):
        safety_prediction = Mock(return_value=("Safe", 0.99))
        developmental_prediction = Mock(return_value={VALID_GOAL: 0.91})
        modules = {
            "RecEngine.safety_api": self.fake_module(
                "RecEngine.safety_api", predict_safety=safety_prediction
            ),
            "RecEngine.dev_assessment": self.fake_module(
                "RecEngine.dev_assessment",
                predict_developmental_probabilities=developmental_prediction,
            ),
        }
        with patch.dict(sys.modules, modules):
            response = self.client.post(
                reverse("content-library"),
                {
                    "title": "Count together",
                    "text": "Count the blocks together.",
                    "content_type": "text",
                    "age_min": 24,
                    "age_max": 48,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        content = Content.objects.get(pk=response.data["content"]["id"])
        self.assertEqual(content.safety_label, Content.SafetyStatus.SAFE)
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.COMPLETED)
        self.assertTrue(content.recommendation_eligible)
        self.assertEqual(content.developmental_scores, {VALID_GOAL: 0.91})
        developmental_prediction.assert_called_once()

    def test_unsafe_text_skips_developmental_assessment(self):
        safety_prediction = Mock(return_value=("Unsafe", 0.98))
        developmental_prediction = Mock()
        modules = {
            "RecEngine.safety_api": self.fake_module(
                "RecEngine.safety_api", predict_safety=safety_prediction
            ),
            "RecEngine.dev_assessment": self.fake_module(
                "RecEngine.dev_assessment",
                predict_developmental_probabilities=developmental_prediction,
            ),
        }
        with patch.dict(sys.modules, modules):
            response = self.client.post(
                reverse("content-library"),
                {
                    "text": "Unsafe sample content.",
                    "age_min": 24,
                    "age_max": 48,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        content = Content.objects.get(pk=response.data["content"]["id"])
        self.assertEqual(content.safety_label, Content.SafetyStatus.UNSAFE)
        self.assertFalse(content.recommendation_eligible)
        developmental_prediction.assert_not_called()

    def test_text_assessment_failure_is_saved_fail_closed(self):
        safety_prediction = Mock(return_value=("Safe", 0.99))
        developmental_prediction = Mock(side_effect=RuntimeError("model unavailable"))
        modules = {
            "RecEngine.safety_api": self.fake_module(
                "RecEngine.safety_api", predict_safety=safety_prediction
            ),
            "RecEngine.dev_assessment": self.fake_module(
                "RecEngine.dev_assessment",
                predict_developmental_probabilities=developmental_prediction,
            ),
        }
        with patch.dict(sys.modules, modules):
            response = self.client.post(
                reverse("content-library"),
                {"text": "Count the blocks.", "age_min": 24, "age_max": 48},
                format="json",
            )

        self.assertEqual(response.status_code, 500)
        content = Content.objects.get(title="Untitled content")
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.FAILED)
        self.assertFalse(content.recommendation_eligible)

    def test_text_upload_validation_rejects_invalid_age_and_empty_content(self):
        bad_age = self.client.post(
            reverse("content-library"),
            {"text": "Some text", "age_min": 49, "age_max": 24},
            format="json",
        )
        self.assertEqual(bad_age.status_code, 400)

        empty = self.client.post(
            reverse("content-library"),
            {"text": "   ", "age_min": 24, "age_max": 48},
            format="json",
        )
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(Content.objects.count(), 0)

    def test_text_edit_resets_previous_assessment(self):
        content = self.make_text_content()
        response = self.client.patch(
            reverse("content-detail", kwargs={"content_id": content.pk}),
            {"text": "Updated learning text."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.PENDING)
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.PENDING)
        self.assertEqual(content.developmental_scores, {})
        self.assertFalse(content.recommendation_eligible)

    def test_content_detail_serializes_media_url_and_delete_removes_record(self):
        content = self.make_media_content()
        response = self.client.get(
            reverse("content-detail", kwargs={"content_id": content.pk})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["media_file_url"].startswith("/media/"))

        deleted = self.client.delete(
            reverse("content-detail", kwargs={"content_id": content.pk})
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Content.objects.filter(pk=content.pk).exists())

    def test_content_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse("content-library")).status_code, 403)
        self.assertEqual(
            self.client.post(
                reverse("content-library"),
                {"text": "test", "age_min": 1, "age_max": 2},
                format="json",
            ).status_code,
            403,
        )


class MediaUploadAPITests(AuthenticatedAPITestCase):
    @patch("RecEngine.tasks.assess_media_content.delay")
    def test_video_upload_is_queued_and_returns_media_url(self, enqueue):
        upload = SimpleUploadedFile("learning.mp4", b"fake video bytes")
        response = self.client.post(
            reverse("content-library"),
            {
                "title": "Learning video",
                "content_type": "video",
                "age_min": 24,
                "age_max": 48,
                "media_file": upload,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        content_id = response.data["content"]["id"]
        content = Content.objects.get(pk=content_id)
        self.assertEqual(content.content_type, Content.ContentType.VIDEO)
        self.assertEqual(content.processing_status, Content.ProcessingStatus.PENDING)
        self.assertFalse(content.recommendation_eligible)
        self.assertTrue(response.data["content"]["media_file_url"].startswith("/media/"))
        enqueue.assert_called_once_with(content.pk)

    @patch("RecEngine.tasks.assess_media_content.delay")
    def test_audio_upload_is_queued(self, enqueue):
        response = self.client.post(
            reverse("content-library"),
            {
                "content_type": "audio",
                "age_min": 0,
                "age_max": 24,
                "media_file": SimpleUploadedFile("song.mp3", b"fake audio"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["content"]["content_type"], "audio")
        enqueue.assert_called_once_with(response.data["content"]["id"])

    @patch("RecEngine.tasks.assess_media_content.delay")
    def test_media_upload_rejects_missing_file_unsupported_extension_and_oversize(
        self, enqueue
    ):
        base = {"content_type": "video", "age_min": 24, "age_max": 48}
        missing = self.client.post(
            reverse("content-library"), base, format="multipart"
        )
        self.assertEqual(missing.status_code, 400)

        bad_extension = self.client.post(
            reverse("content-library"),
            {**base, "media_file": SimpleUploadedFile("clip.txt", b"video")},
            format="multipart",
        )
        self.assertEqual(bad_extension.status_code, 400)

        with self.settings(MEDIA_MAX_UPLOAD_BYTES=3):
            too_large = self.client.post(
                reverse("content-library"),
                {**base, "media_file": SimpleUploadedFile("clip.mp4", b"1234")},
                format="multipart",
            )
        self.assertEqual(too_large.status_code, 400)
        enqueue.assert_not_called()

    @patch(
        "RecEngine.tasks.assess_media_content.delay",
        side_effect=RuntimeError("broker unavailable"),
    )
    def test_queue_failure_marks_media_failed_and_ineligible(self, _enqueue):
        response = self.client.post(
            reverse("content-library"),
            {
                "content_type": "audio",
                "age_min": 12,
                "age_max": 36,
                "media_file": SimpleUploadedFile("song.mp3", b"fake audio"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 503)
        content = Content.objects.get(pk=response.data["content_id"])
        self.assertEqual(content.processing_status, Content.ProcessingStatus.FAILED)
        self.assertEqual(content.safety_label, Content.SafetyStatus.INCONCLUSIVE)
        self.assertFalse(content.recommendation_eligible)

    @patch("RecEngine.tasks.assess_media_content.delay")
    def test_media_reassessment_requeues_and_resets_eligibility(self, enqueue):
        content = self.make_media_content()
        response = self.client.post(
            reverse("content-assess", kwargs={"content_id": content.pk})
        )

        self.assertEqual(response.status_code, 202)
        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.PENDING)
        self.assertEqual(content.processing_status, Content.ProcessingStatus.PENDING)
        self.assertFalse(content.recommendation_eligible)
        enqueue.assert_called_once_with(content.pk)




class RecommendationAPITests(AuthenticatedAPITestCase):
    def test_recommendations_match_safe_text_and_include_safe_media_generically(self):
        child = self.make_child(age=36)
        text = self.make_text_content()
        video = self.make_media_content(content_type=Content.ContentType.VIDEO)
        self.make_text_content(
            title="Unsafe resource",
            safety=Content.SafetyStatus.UNSAFE,
        )
        self.make_text_content(
            title="Still processing",
            assessment=Content.AssessmentStatus.PENDING,
        )
        self.make_text_content(title="Wrong age", age_min=49, age_max=70)

        response = self.client.post(
            reverse("recommend-content"),
            {"child_id": child.pk, "top_n": 4},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        results = response.data["recommendations"]
        self.assertEqual({item["id"] for item in results}, {text.pk, video.pk})
        media_result = next(item for item in results if item["id"] == video.pk)
        self.assertTrue(media_result["general_media"])
        self.assertEqual(media_result["matched_goals"], [])
        self.assertEqual(media_result["goal_scores"], {})
        self.assertIsNone(media_result["relevance_score"])
        self.assertIn("media_file_url", media_result)
        self.assertEqual(response.data["count"], 2)
        self.assertTrue(
            RecommendationHistory.objects.filter(
                pk=response.data["history_id"], caregiver=self.user
            ).exists()
        )

    def test_safe_audio_can_be_recommended_without_a_matching_text_item(self):
        child = self.make_child(age=18)
        audio = self.make_media_content(
            content_type=Content.ContentType.AUDIO,
            age_min=0,
            age_max=24,
            scores={"mismatched_old_label": 0.99},
        )

        response = self.client.post(
            reverse("recommend-content"),
            {"child_id": child.pk, "top_n": 4},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recommendations"]), 1)
        self.assertEqual(response.data["recommendations"][0]["id"], audio.pk)
        self.assertEqual(response.data["recommendations"][0]["goal_scores"], {})

    def test_recommendation_request_validates_child_goal_and_top_n(self):
        child = self.make_child(goals=[])
        no_goals = self.client.post(
            reverse("recommend-content"), {"child_id": child.pk}, format="json"
        )
        self.assertEqual(no_goals.status_code, 400)

        child.learning_goals = ["not_a_developmental_goal"]
        child.save()
        invalid_goal = self.client.post(
            reverse("recommend-content"), {"child_id": child.pk}, format="json"
        )
        self.assertEqual(invalid_goal.status_code, 400)

        child.learning_goals = [VALID_GOAL]
        child.save()
        invalid_top_n = self.client.post(
            reverse("recommend-content"),
            {"child_id": child.pk, "top_n": 0},
            format="json",
        )
        self.assertEqual(invalid_top_n.status_code, 400)

    def test_caregiver_cannot_request_recommendations_for_another_users_child(self):
        other = User.objects.create_user(
            username="anothercaregiver",
            password=STRONG_PASSWORD,
        )
        child = self.make_child(caregiver=other)

        response = self.client.post(
            reverse("recommend-content"),
            {"child_id": child.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 404)


class RecommendationHistoryAndActivityTests(AuthenticatedAPITestCase):
    def test_history_hides_recommendations_that_are_now_unsafe(self):
        safe_content = self.make_text_content(title="Still safe")
        unsafe_content = self.make_text_content(title="Now unsafe")
        history = self.make_history([
            {"id": safe_content.pk, "title": safe_content.title},
            {"id": unsafe_content.pk, "title": unsafe_content.title},
        ])
        unsafe_content.safety_label = Content.SafetyStatus.UNSAFE
        unsafe_content.save()

        response = self.client.get(reverse("recommendation-history"))

        self.assertEqual(response.status_code, 200)
        serialized = next(item for item in response.data if item["id"] == history.pk)
        self.assertEqual(
            [item["id"] for item in serialized["recommendations"]],
            [safe_content.pk],
        )

    def test_activity_events_allow_safe_recommended_content(self):
        content = self.make_text_content()
        history = self.make_history([{"id": content.pk, "title": content.title}])

        response = self.client.post(
            reverse("recommendation-activity", kwargs={"history_id": history.pk}),
            {
                "content_id": content.pk,
                "event_type": RecommendationActivity.EventType.COMPLETED,
                "details": {"source": "test"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["event_type"], "completed")
        self.assertTrue(history.activities.filter(event_type="completed").exists())

    def test_activity_events_reject_unsafe_or_unrecommended_content(self):
        unsafe = self.make_text_content(title="Unsafe")
        history = self.make_history([{"id": unsafe.pk, "title": unsafe.title}])
        unsafe.safety_label = Content.SafetyStatus.UNSAFE
        unsafe.save()

        unsafe_response = self.client.post(
            reverse("recommendation-activity", kwargs={"history_id": history.pk}),
            {"content_id": unsafe.pk, "event_type": "viewed"},
            format="json",
        )
        self.assertEqual(unsafe_response.status_code, 400)
        self.assertFalse(history.activities.exists())

        safe_other = self.make_text_content(title="Not in this history")
        unrelated_response = self.client.post(
            reverse("recommendation-activity", kwargs={"history_id": history.pk}),
            {"content_id": safe_other.pk, "event_type": "viewed"},
            format="json",
        )
        self.assertEqual(unrelated_response.status_code, 400)

    def test_activity_event_validation_and_history_ownership(self):
        content = self.make_text_content()
        history = self.make_history([{"id": content.pk}])
        url = reverse("recommendation-activity", kwargs={"history_id": history.pk})

        bad_event = self.client.post(
            url,
            {"content_id": content.pk, "event_type": "watched"},
            format="json",
        )
        self.assertEqual(bad_event.status_code, 400)

        other = User.objects.create_user(
            username="other",
            password=STRONG_PASSWORD,
        )
        self.client.force_authenticate(other)
        forbidden = self.client.post(
            url,
            {"content_id": content.pk, "event_type": "viewed"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 404)

    def test_feedback_accepts_valid_rating_and_rejects_invalid_rating(self):
        content = self.make_text_content()
        history = self.make_history([{"id": content.pk, "title": content.title}])
        url = reverse("recommendation-feedback", kwargs={"history_id": history.pk})

        saved = self.client.post(
            url,
            {"rating": 5, "text": "Helpful activity"},
            format="json",
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data["feedback"]["rating"], 5)
        self.assertEqual(saved.data["feedback"]["text"], "Helpful activity")

        invalid = self.client.post(url, {"rating": 6}, format="json")
        self.assertEqual(invalid.status_code, 400)


class ContentModelTests(TestCase):
    def test_recommendation_eligibility_is_forced_off_until_safe_and_complete(self):
        content = Content.objects.create(
            title="Pending text",
            text="A short activity.",
            age_min=0,
            age_max=24,
            recommendation_eligible=True,
        )
        self.assertFalse(content.recommendation_eligible)

        content.safety_label = Content.SafetyStatus.SAFE
        content.assessment_status = Content.AssessmentStatus.COMPLETED
        content.recommendation_eligible = True
        content.save()
        self.assertTrue(content.recommendation_eligible)

    def test_content_clean_rejects_missing_media_and_reversed_age_range(self):
        missing_media = Content(
            title="Missing video",
            content_type=Content.ContentType.VIDEO,
            age_min=0,
            age_max=24,
        )
        with self.assertRaises(ValidationError):
            missing_media.full_clean()

        reversed_age = Content(
            title="Bad age range",
            text="An activity.",
            age_min=48,
            age_max=24,
        )
        with self.assertRaises(ValidationError):
            reversed_age.full_clean()


class MediaProcessingTests(MediaStorageMixin, TestCase):
    def make_video(self):
        return Content.objects.create(
            title="A video",
            content_type=Content.ContentType.VIDEO,
            media_file=SimpleUploadedFile("video.mp4", b"fake video bytes"),
            age_min=24,
            age_max=48,
        )

    def make_audio(self):
        return Content.objects.create(
            title="An audio recording",
            content_type=Content.ContentType.AUDIO,
            media_file=SimpleUploadedFile("audio.mp3", b"fake audio bytes"),
            age_min=12,
            age_max=36,
        )

    @patch("RecEngine.media_processing._probe_media", return_value=(12.2, True, False))
    @patch("RecEngine.media_processing._extract_frames")
    @patch("RecEngine.media_processing._classify_frames", return_value=([], False))
    def test_safe_video_finishes_eligible_without_developmental_labels(
        self, classify_frames, extract_frames, _probe
    ):
        extract_frames.return_value = [Path("sample-frame.jpg")]
        content = self.make_video()
        content.developmental_scores = {"mismatched_old_label": 0.99}
        content.save()
        developmental_prediction = Mock(
            side_effect=AssertionError("media should not receive dev labels")
        )
        fake_developmental = types.ModuleType("RecEngine.dev_assessment")
        fake_developmental.predict_developmental_probabilities = developmental_prediction

        with patch.dict(
            sys.modules,
            {"RecEngine.dev_assessment": fake_developmental},
        ):
            process_media_content(content)

        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.SAFE)
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.COMPLETED)
        self.assertEqual(content.processing_status, Content.ProcessingStatus.COMPLETED)
        self.assertTrue(content.recommendation_eligible)
        self.assertEqual(content.developmental_scores, {})
        developmental_prediction.assert_not_called()
        classify_frames.assert_called_once()

    @patch("RecEngine.media_processing._probe_media", return_value=(8.0, False, True))
    @patch("RecEngine.media_processing._assess_audio")
    def test_safe_audio_finishes_eligible_without_developmental_labels(
        self, assess_audio, _probe
    ):
        assess_audio.return_value = (
            "A song about counting.",
            {"status": "completed", "transcript_safety": {"label": "safe"}},
            False,
        )
        content = self.make_audio()

        process_media_content(content)

        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.SAFE)
        self.assertTrue(content.recommendation_eligible)
        self.assertEqual(content.developmental_scores, {})
        self.assertEqual(content.transcript, "A song about counting.")
        assess_audio.assert_called_once()

    @patch("RecEngine.media_processing._probe_media", return_value=(8.0, False, True))
    @patch("RecEngine.media_processing._assess_audio")
    def test_unsafe_audio_transcript_is_not_recommendation_eligible(
        self, assess_audio, _probe
    ):
        assess_audio.return_value = (
            "Unsafe transcript",
            {
                "status": "completed",
                "transcript_safety": {"label": "unsafe", "confidence": 0.99},
            },
            True,
        )
        content = self.make_audio()

        process_media_content(content)

        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.UNSAFE)
        self.assertEqual(content.audio_assessment["transcript_safety"]["label"], "unsafe")
        self.assertFalse(content.recommendation_eligible)

    @override_settings(HF_NSFW_THRESHOLD=0.5, MEDIA_NSFW_MIN_FLAGGED_FRAMES=2)
    @patch("RecEngine.media_processing._get_nsfw_classifier")
    def test_single_flagged_frame_does_not_reject_video(self, get_classifier):
        def prediction_for_frame(frame_path, top_k=None):
            if str(frame_path).endswith("frame-2.jpg"):
                return [
                    {"label": "normal", "score": 0.4107},
                    {"label": "nsfw", "score": 0.5893},
                ]
            return [
                {"label": "normal", "score": 0.999},
                {"label": "nsfw", "score": 0.001},
            ]

        classifier = Mock(side_effect=prediction_for_frame)
        get_classifier.return_value = classifier
        frames = [Path(f"frame-{index}.jpg") for index in range(1, 4)]

        results, rejected = _classify_frames(frames)

        self.assertFalse(rejected)
        self.assertEqual(sum(frame["unsafe"] for frame in results), 1)
        self.assertEqual(len(results), 3)
        classifier.assert_has_calls(
            [call(str(frame), top_k=None) for frame in frames]
        )

    @override_settings(HF_NSFW_THRESHOLD=0.5, MEDIA_NSFW_MIN_FLAGGED_FRAMES=2)
    @patch("RecEngine.media_processing._get_nsfw_classifier")
    def test_two_flagged_frames_reject_video(self, get_classifier):
        classifier = Mock(return_value=[
            {"label": "normal", "score": 0.4},
            {"label": "nsfw", "score": 0.6},
        ])
        get_classifier.return_value = classifier
        frames = [Path("frame-1.jpg"), Path("frame-2.jpg")]

        results, rejected = _classify_frames(frames)

        self.assertTrue(rejected)
        self.assertTrue(all(frame["unsafe"] for frame in results))

    @patch("RecEngine.media_processing._probe_media", return_value=(12.2, True, False))
    @patch("RecEngine.media_processing._extract_frames")
    @patch(
        "RecEngine.media_processing._classify_frames",
        return_value=([{"frame": "frame.jpg", "unsafe": True}], True),
    )
    def test_unsafe_video_is_completed_but_ineligible(
        self, _classify_frames, extract_frames, _probe
    ):
        extract_frames.return_value = [Path("frame.jpg")]
        content = self.make_video()

        process_media_content(content)

        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.UNSAFE)
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.COMPLETED)
        self.assertEqual(content.processing_status, Content.ProcessingStatus.COMPLETED)
        self.assertFalse(content.recommendation_eligible)

    @patch("RecEngine.media_processing._probe_media", return_value=(12.2, True, False))
    @patch("RecEngine.media_processing._extract_frames")
    @patch(
        "RecEngine.media_processing._classify_frames",
        side_effect=RuntimeError("classifier unavailable"),
    )
    def test_processing_error_fails_closed(
        self, _classify_frames, extract_frames, _probe
    ):
        extract_frames.return_value = [Path("frame.jpg")]
        content = self.make_video()

        with self.assertRaisesRegex(RuntimeError, "classifier unavailable"):
            process_media_content(content)

        content.refresh_from_db()
        self.assertEqual(content.safety_label, Content.SafetyStatus.INCONCLUSIVE)
        self.assertEqual(content.assessment_status, Content.AssessmentStatus.FAILED)
        self.assertEqual(content.processing_status, Content.ProcessingStatus.FAILED)
        self.assertFalse(content.recommendation_eligible)
