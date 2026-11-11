import math

from .developmental_domains import DEVELOPMENTAL_LABELS
from .models import Content


def recommend_content(age, learning_goals, top_n=5):
    """Return safe, assessed, age-matched content ranked by selected goals."""
    if not isinstance(age, int) or isinstance(age, bool) or not 0 <= age <= 83:
        raise ValueError("Age must be an integer between 0 and 83 months.")

    if not isinstance(learning_goals, list) or not learning_goals:
        raise ValueError("Provide at least one developmental learning goal.")
    if any(not isinstance(goal, str) or not goal for goal in learning_goals):
        raise ValueError("Every learning goal must be a non-empty string.")
    if len(set(learning_goals)) != len(learning_goals):
        raise ValueError("Duplicate learning goals are not allowed.")

    invalid_goals = [
        goal for goal in learning_goals
        if goal not in DEVELOPMENTAL_LABELS
    ]
    if invalid_goals:
        raise ValueError(f"Unknown developmental goals: {invalid_goals}")

    if not isinstance(top_n, int) or isinstance(top_n, bool) or top_n < 1:
        raise ValueError("top_n must be a positive integer.")

    eligible_content = Content.objects.filter(
        safety_label=Content.SafetyStatus.SAFE,
        moderation_status=Content.ModerationStatus.CLEAR,
        assessment_status=Content.AssessmentStatus.COMPLETED,
        suitability_label__in=[
            Content.SuitabilityStatus.SUITABLE,
            Content.SuitabilityStatus.PARTIALLY_SUITABLE,
        ],
        recommendation_eligible=True,
        age_min__lte=age,
        age_max__gte=age,
    )

    recommendations = []
    for content in eligible_content.iterator():
        scores = content.developmental_scores
        if not isinstance(scores, dict):
            continue

        selected_scores = {}
        for goal in learning_goals:
            if goal not in scores:
                break
            if isinstance(scores[goal], bool):
                break
            try:
                score = float(scores[goal])
            except (TypeError, ValueError, OverflowError):
                break
            if not math.isfinite(score) or not 0.0 <= score <= 1.0:
                break
            selected_scores[goal] = score

        # Missing or malformed domain scores make this content unsuitable
        # for scoring; never substitute zero or another domain's probability.
        if len(selected_scores) != len(learning_goals):
            continue

        relevance_score = sum(selected_scores.values()) / len(learning_goals)
        recommendations.append({
            "id": content.pk,
            "title": content.title,
            "content_type": content.content_type,
            "media_file_url": (
                content.media_file.url if content.media_file else None
            ),
            "age_range": {
                "minimum": content.age_min,
                "maximum": content.age_max,
            },
            "suitability": content.get_suitability_label_display(),
            "relevance_score": round(relevance_score, 4),
            "matched_goals": [
                goal for goal, score in selected_scores.items()
                if score >= 0.5
            ],
            "goal_scores": {
                goal: round(score, 4)
                for goal, score in selected_scores.items()
            },
        })

    recommendations.sort(key=lambda item: (-item["relevance_score"], item["id"]))
    return recommendations[:top_n]
