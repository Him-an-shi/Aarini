"""
PII sanitization for messages before they reach third-party AI services.
Strips identifiable information while preserving health-relevant content.
"""

import re
import logging

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_PATTERN = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}')

# 🛠️ FIX: Removed re.IGNORECASE and explicitly handled case in the prefix group.
# This strictly enforces capitalization for names and prevents lowercase symptoms
# (like "i am pregnant" or "i'm nauseous") from being stripped out!
NAME_PATTERN = re.compile(r"(?:[Mm]y name is|[Ii]'m|[Ii] am|[Cc]all me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")

ADDRESS_PATTERN = re.compile(r'\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Place|Pl)\b', re.IGNORECASE)
SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')


def sanitize_for_ai(message):
    """
    Strip PII from a user message before sending to a third-party AI.
    Returns (sanitized_message, was_modified) tuple.
    """
    if not message or not isinstance(message, str):
        return message, False

    original = message
    detections = []

    emails = EMAIL_PATTERN.findall(message)
    if emails:
        message = EMAIL_PATTERN.sub('[email removed]', message)
        detections.append(f"email(s): {len(emails)}")

    phones = PHONE_PATTERN.findall(message)
    if phones:
        message = PHONE_PATTERN.sub('[phone removed]', message)
        detections.append(f"phone(s): {len(phones)}")

    names = NAME_PATTERN.findall(message)
    if names:
        message = NAME_PATTERN.sub('the user', message)
        detections.append(f"name(s): {len(names)}")

    addresses = ADDRESS_PATTERN.findall(message)
    if addresses:
        message = ADDRESS_PATTERN.sub('[address removed]', message)
        detections.append(f"address(es): {len(addresses)}")

    ssns = SSN_PATTERN.findall(message)
    if ssns:
        message = SSN_PATTERN.sub('[id removed]', message)
        detections.append(f"SSN(s): {len(ssns)}")

    was_modified = message != original
    if was_modified:
        logger.warning(f"[PII] Stripped from user message: {', '.join(detections)}")

    return message, was_modified
