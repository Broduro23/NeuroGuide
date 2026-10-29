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
