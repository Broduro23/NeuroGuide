"""Validation and normalization for developmental-model predictions."""

import math

from .developmental_domains import (
    DEVELOPMENTAL_LABELS,
    NOT_SUITABLE_LABEL,
    PARTIALLY_SUITABLE_LABEL,
    SUITABLE_LABEL,
    SUITABILITY_LABELS,
)
from .models import Content


def normalize_developmental_result(result):
    """Return domain scores, suitability label, and class probabilities."""
    if not isinstance(result, dict):
        raise ValueError("Developmental model must return a structured result.")

    scores = result.get("domain_probabilities")
    if not isinstance(scores, dict) or set(scores) != set(DEVELOPMENTAL_LABELS):
        raise ValueError("The model must return scores for all 21 known domains.")

    normalized = {}
    for label, value in scores.items():
        if isinstance(value, bool):
            raise ValueError(f"Invalid developmental score for '{label}'.")
        try:
            score = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"Invalid developmental score for '{label}'.") from exc
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError(
                f"Developmental score for '{label}' must be between 0 and 1."
            )
        normalized[label] = score

    suitability_values = {
        SUITABLE_LABEL: Content.SuitabilityStatus.SUITABLE,
        PARTIALLY_SUITABLE_LABEL: Content.SuitabilityStatus.PARTIALLY_SUITABLE,
        NOT_SUITABLE_LABEL: Content.SuitabilityStatus.NOT_SUITABLE,
    }
    suitability = suitability_values.get(result.get("suitability"))
    if suitability is None:
        raise ValueError("Developmental model returned an unknown suitability label.")

    raw_suitability_scores = result.get("suitability_probabilities")
    if (
        not isinstance(raw_suitability_scores, dict)
        or set(raw_suitability_scores) != set(SUITABILITY_LABELS)
    ):
        raise ValueError("The model must return probabilities for all suitability classes.")

    suitability_scores = {}
    for label, value in raw_suitability_scores.items():
        if isinstance(value, bool):
            raise ValueError(f"Invalid suitability probability for '{label}'.")
        try:
            probability = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"Invalid suitability probability for '{label}'.") from exc
        if not math.isfinite(probability) or not 0 <= probability <= 1:
            raise ValueError(
                f"Suitability probability for '{label}' must be between 0 and 1."
            )
        suitability_scores[label] = probability

    return normalized, suitability, suitability_scores
