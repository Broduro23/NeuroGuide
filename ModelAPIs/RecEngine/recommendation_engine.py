# classifier/recommendation_engine.py

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from .models import Content


DEVELOPMENTAL_LABELS = [
    "number_identification",
    "number_size_discrimination",
    "letter_alphabet_knowledge",
    "phonological_awareness",
    "expressive_language",
    "receptive_language",
    "fine_motor",
    "mental_flexibility",
    "working_memory",
    "inhibition",
    "approaches_to_learning_play",
    "social_competence",
    "relationship_skills",
    "interpersonal_conflict_resolution",
    "prosocial_behaviour",
    "social_cognition",
    "theory_of_mind",
    "empathy",
    "emotion_knowledge",
    "self_regulation",
]


def recommend_content(age, learning_goals, top_n=5):
    """
    Recommend educational content using PostgreSQL records.

    Text content must have valid scores for every requested goal. Safe audio
    and video are included separately as general age-appropriate activities.
    """

    # 1. Validate age.
    if (
        not isinstance(age, int)
        or isinstance(age, bool)
        or not 0 <= age <= 83
    ):
        raise ValueError("Age must be an integer between 0 and 83 months.")

    # 2. Validate learning goals.
    if not isinstance(learning_goals, list) or not learning_goals:
        raise ValueError(
            "Provide at least one developmental learning goal."
        )

    if any(not isinstance(goal, str) for goal in learning_goals):
        raise ValueError("Every learning goal must be a string.")

    if len(set(learning_goals)) != len(learning_goals):
        raise ValueError("Duplicate learning goals are not allowed.")

    invalid_goals = [
        goal for goal in learning_goals
        if goal not in DEVELOPMENTAL_LABELS
    ]

    if invalid_goals:
        raise ValueError(
            f"Unknown developmental goals: {invalid_goals}"
        )

    # 3. Validate the requested number of recommendations.
    if (
        not isinstance(top_n, int)
        or isinstance(top_n, bool)
        or top_n < 1
    ):
        raise ValueError("top_n must be a positive integer.")

    # 4. Retrieve eligible content from PostgreSQL.
    content_items = Content.objects.filter(
        content_type=Content.ContentType.TEXT,
        safety_label=Content.SafetyStatus.SAFE,
        assessment_status=Content.AssessmentStatus.COMPLETED,
        recommendation_eligible=True,
        age_min__lte=age,
        age_max__gte=age,
    )

    recommendations = []

    for item in content_items.iterator():

        scores = item.developmental_scores

        if not isinstance(scores, dict):
            continue

        # 5. Retrieve scores for every requested learning goal.
        goal_scores = {}

        try:
            for goal in learning_goals:
                if goal not in scores:
                    break

                score = float(scores[goal])

                if not 0.0 <= score <= 1.0:
                    break

                goal_scores[goal] = score

            else:
                # All requested goals have valid scores.
                pass

            if len(goal_scores) != len(learning_goals):
                continue

        except (TypeError, ValueError, OverflowError):
            continue

        # 6. Calculate relevance score.
        relevance_score = (
            sum(goal_scores.values()) / len(learning_goals)
        )

        # 7. Build the recommendation result.
        recommendations.append({
            "id": item.pk,
            "title": item.title,
            "content_type": item.content_type,
            "age_range": {
                "minimum": item.age_min,
                "maximum": item.age_max,
            },
            "relevance_score": round(relevance_score, 4),
            "matched_goals": [
                goal
                for goal, score in goal_scores.items()
                if score >= 0.50
            ],
            "goal_scores": {
                goal: round(score, 4)
                for goal, score in goal_scores.items()
            },
        })

    # 8. Rank text resources by developmental-goal relevance.
    recommendations.sort(
        key=lambda item: (
            -item["relevance_score"],
            item["id"],
        )
    )

    # Safe media is offered as a general age-appropriate activity. It does
    # not receive transcript-derived developmental labels or relevance scores.
    media_items = Content.objects.filter(
        content_type__in=[Content.ContentType.AUDIO, Content.ContentType.VIDEO],
        safety_label=Content.SafetyStatus.SAFE,
        assessment_status=Content.AssessmentStatus.COMPLETED,
        processing_status=Content.ProcessingStatus.COMPLETED,
        recommendation_eligible=True,
        media_file__isnull=False,
        age_min__lte=age,
        age_max__gte=age,
    ).order_by('-created_at', 'pk')
    general_media = [
        {
            "id": item.pk,
            "title": item.title,
            "content_type": item.content_type,
            "media_file_url": item.media_file.url if item.media_file else None,
            "age_range": {
                "minimum": item.age_min,
                "maximum": item.age_max,
            },
            "relevance_score": None,
            "matched_goals": [],
            "goal_scores": {},
            "general_media": True,
        }
        for item in media_items
    ]

    if not recommendations:
        return general_media[:top_n]

    # Reserve one slot for a general media activity when the requested list
    # has room, then fill the remaining slots with goal-matched text.
    if general_media and top_n > 1:
        return recommendations[:top_n - 1] + general_media[:1]
    return recommendations[:top_n]
