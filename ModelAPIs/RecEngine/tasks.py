import logging

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist

from .media_processing import process_media_content
from .models import Content

logger = logging.getLogger(__name__)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def assess_media_content(self, content_id):
    try:
        content = Content.objects.get(pk=content_id)
    except ObjectDoesNotExist:
        logger.info('Skipping deleted media content %s', content_id)
        return

    process_media_content(content)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def assess_text_content(self, content_id):
    try:
        content = Content.objects.get(pk=content_id)
    except ObjectDoesNotExist:
        logger.info('Skipping deleted text content %s', content_id)
        return

    content.processing_status = Content.ProcessingStatus.PROCESSING
    content.assessment_status = Content.AssessmentStatus.PENDING
    content.recommendation_eligible = False
    content.save(update_fields=[
        'processing_status',
        'assessment_status',
        'recommendation_eligible',
        'updated_at',
    ])

    try:
        from .views import assess_content_record

        assess_content_record(content)
    except Exception:
        logger.exception('Text assessment task failed for content ID %s', content.pk)

    content.refresh_from_db()
    if content.assessment_status == Content.AssessmentStatus.PENDING:
        content.assessment_status = Content.AssessmentStatus.FAILED
        if content.safety_label == Content.SafetyStatus.PENDING:
            content.safety_label = Content.SafetyStatus.INCONCLUSIVE
        content.recommendation_eligible = False
    content.processing_status = (
        Content.ProcessingStatus.FAILED
        if content.assessment_status == Content.AssessmentStatus.FAILED
        else Content.ProcessingStatus.COMPLETED
    )
    content.save(update_fields=[
        'assessment_status',
        'safety_label',
        'recommendation_eligible',
        'processing_status',
        'updated_at',
    ])
