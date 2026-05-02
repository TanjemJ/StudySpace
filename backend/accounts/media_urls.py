import logging


logger = logging.getLogger(__name__)


def safe_file_url(file_field, request=None, absolute=False, fallback=None):
    """
    Return a storage URL without letting a storage/signing issue crash the API.

    Cloud Storage signed URL generation can fail if IAM signing is temporarily
    misconfigured. User-facing writes should still succeed and return a usable
    response instead of a 500.
    """
    if not file_field:
        return fallback

    try:
        url = file_field.url
    except Exception as exc:
        logger.warning(
            "Could not generate media URL for %s: %s",
            getattr(file_field, "name", "<unknown>"),
            exc,
            exc_info=True,
        )
        return fallback

    if absolute and request:
        try:
            return request.build_absolute_uri(url)
        except Exception as exc:
            logger.warning(
                "Could not build absolute media URL for %s: %s",
                url,
                exc,
                exc_info=True,
            )

    return url
