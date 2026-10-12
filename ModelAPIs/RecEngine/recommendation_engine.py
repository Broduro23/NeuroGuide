# classifier/recommendation_engine.py

from .temp_store import get_all_content


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
    Recommend learning resources based on the child's age
    and selected developmental goals.

    Only assessed, safe content is eligible.
    """

    if not isinstance(age, int) or isinstance(age, bool) or age < 0:
        raise ValueError("Age must be a non-negative integer.")

    if not isinstance(learning_goals, list) or not learning_goals:
        raise ValueError(
            "Provide at least one developmental learning goal."
        )

    if not isinstance(top_n, int) or isinstance(top_n, bool) or top_n < 1:
        raise ValueError("top_n must be a positive integer.")

    # Validate goals against the trained model's labels.
    invalid_goals = [
        goal for goal in learning_goals
        if goal not in DEVELOPMENTAL_LABELS
    ]

    if invalid_goals:
        raise ValueError(
            f"Unknown developmental goals: {invalid_goals}"
        )

    recommendations = []

    for item in get_all_content():

        # 1. Exclude content that has not passed the safety gate.
        if item.get("safety_label", "").lower() != "safe":
            continue

        if not item.get("assessment_complete", False):
            continue

        # 2. Apply the configured age range.
        age_min = item.get("age_min")
        age_max = item.get("age_max")

        if not isinstance(age_min, int) or isinstance(age_min, bool):
            continue

        if not isinstance(age_max, int) or isinstance(age_max, bool):
            continue

        if age_min > age_max:
            continue

        if not age_min <= age <= age_max:
            continue

        # 3. Obtain developmental scores.
        scores = item.get("developmental_scores", {})

        if not isinstance(scores, dict):
            continue

        try:
            goal_scores = {
                goal: float(scores[goal])
                for goal in learning_goals
                if goal in scores
            }
        except (TypeError, ValueError):
            continue

        # Require a score for every requested goal.
        if len(goal_scores) != len(learning_goals):
            continue

        # Check that model outputs are valid.
        if any(
            score < 0 or score > 1
            for score in goal_scores.values()
        ):
            continue

        # 4. Calculate the mean score across requested goals.
        relevance_score = (
            sum(goal_scores.values()) / len(goal_scores)
        )

        # 5. Build the recommendation result.
        recommendations.append({
            "id": item["id"],
            "title": item["title"],
            "content_type": item.get("content_type", "text"),
            "age_range": {
                "minimum": age_min,
                "maximum": age_max,
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

    # 6. Rank from highest to lowest relevance.
    recommendations.sort(
        key=lambda item: item["relevance_score"],
        reverse=True,
    )

    return recommendations[:top_n]