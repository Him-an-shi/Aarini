"""
Tests for PII sanitization utility (utils/sanitize.py).

Pure unit tests — no Flask test client required. Each test class covers a
specific PII pattern or edge case of sanitize_for_ai().

Run: python -m pytest tests/test_sanitize.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.sanitize import sanitize_for_ai


# ---------------------------------------------------------------------------
# Edge-case / empty inputs
# ---------------------------------------------------------------------------


class TestSanitizeEdgeCases:
    """sanitize_for_ai should gracefully handle None, empty, and non-string inputs."""

    def test_none_input_returns_unchanged(self):
        """None comes back as-is with was_modified=False."""
        result, modified = sanitize_for_ai(None)
        assert result is None
        assert modified is False

    def test_empty_string_returns_unchanged(self):
        """Empty string is falsy — should pass through unmodified."""
        result, modified = sanitize_for_ai("")
        assert result == ""
        assert modified is False

    def test_integer_input_returns_unchanged(self):
        """Non-string types should be returned without modification."""
        result, modified = sanitize_for_ai(42)
        assert result == 42
        assert modified is False

    def test_list_input_returns_unchanged(self):
        """A list should not be treated as a message."""
        val = ["hello"]
        result, modified = sanitize_for_ai(val)
        assert result is val
        assert modified is False

    def test_dict_input_returns_unchanged(self):
        """A dict should not be treated as a message."""
        val = {"key": "value"}
        result, modified = sanitize_for_ai(val)
        assert result is val
        assert modified is False


# ---------------------------------------------------------------------------
# No PII present
# ---------------------------------------------------------------------------


class TestNoPII:
    """Messages without PII should pass through unmodified."""

    def test_plain_text_not_modified(self):
        msg = "I have been experiencing headaches for the past week."
        result, modified = sanitize_for_ai(msg)
        assert result == msg
        assert modified is False

    def test_health_content_preserved(self):
        """Health-related language must never be stripped."""
        msg = "My period started on the 5th and I have severe cramps."
        result, modified = sanitize_for_ai(msg)
        assert result == msg
        assert modified is False


# ---------------------------------------------------------------------------
# Email detection & removal
# ---------------------------------------------------------------------------


class TestEmailSanitization:
    """EMAIL_PATTERN should catch standard email addresses."""

    def test_single_email_removed(self):
        msg = "Contact me at alice@example.com for details."
        result, modified = sanitize_for_ai(msg)
        assert "alice@example.com" not in result
        assert "[email removed]" in result
        assert modified is True

    def test_multiple_emails_removed(self):
        msg = "Send to alice@example.com and bob@domain.org please."
        result, modified = sanitize_for_ai(msg)
        assert "alice@example.com" not in result
        assert "bob@domain.org" not in result
        assert result.count("[email removed]") == 2
        assert modified is True

    def test_email_with_plus_tag(self):
        msg = "Use user+tag@example.com for signup."
        result, modified = sanitize_for_ai(msg)
        assert "user+tag@example.com" not in result
        assert modified is True

    def test_email_with_dots_in_local(self):
        msg = "My email is first.last@company.co.uk"
        result, modified = sanitize_for_ai(msg)
        assert "first.last@company.co.uk" not in result
        assert modified is True


# ---------------------------------------------------------------------------
# Phone number detection & removal
# ---------------------------------------------------------------------------


class TestPhoneSanitization:
    """PHONE_PATTERN should catch common US and international formats."""

    def test_phone_with_dashes(self):
        msg = "Call me at 555-123-4567."
        result, modified = sanitize_for_ai(msg)
        assert "555-123-4567" not in result
        assert "[phone removed]" in result
        assert modified is True

    def test_phone_with_parentheses(self):
        msg = "My number is (555) 123-4567."
        result, modified = sanitize_for_ai(msg)
        assert "(555) 123-4567" not in result
        assert "[phone removed]" in result
        assert modified is True

    def test_phone_with_country_code(self):
        msg = "Reach me at +1-555-123-4567."
        result, modified = sanitize_for_ai(msg)
        assert "555-123-4567" not in result
        assert "[phone removed]" in result
        assert modified is True

    def test_phone_with_spaces(self):
        msg = "My number is 555 123 4567."
        result, modified = sanitize_for_ai(msg)
        assert "555 123 4567" not in result
        assert "[phone removed]" in result
        assert modified is True

    def test_phone_with_dots(self):
        msg = "Contact: 555.123.4567"
        result, modified = sanitize_for_ai(msg)
        assert "555.123.4567" not in result
        assert "[phone removed]" in result
        assert modified is True


# ---------------------------------------------------------------------------
# Name detection & removal
# ---------------------------------------------------------------------------


class TestNameSanitization:
    """NAME_PATTERN should detect 'my name is ...', 'I'm ...', etc."""

    def test_my_name_is(self):
        msg = "My name is Alice Johnson and I need help."
        result, modified = sanitize_for_ai(msg)
        assert "Alice Johnson" not in result
        assert "the user" in result
        assert modified is True

    def test_i_am_pattern(self):
        msg = "I am Robert and I have a question."
        result, modified = sanitize_for_ai(msg)
        assert "Robert" not in result
        assert "the user" in result
        assert modified is True

    def test_im_pattern(self):
        msg = "I'm Sarah and my period is late."
        result, modified = sanitize_for_ai(msg)
        assert "Sarah" not in result
        assert "the user" in result
        assert modified is True

    def test_call_me_pattern(self):
        msg = "Please call me Diana when responding."
        result, modified = sanitize_for_ai(msg)
        assert "Diana" not in result
        assert "the user" in result
        assert modified is True

    def test_name_case_insensitive(self):
        """Trigger phrase should match regardless of case."""
        msg = "MY NAME IS Jessica and I feel dizzy."
        result, modified = sanitize_for_ai(msg)
        assert "Jessica" not in result
        assert modified is True


# ---------------------------------------------------------------------------
# Address detection & removal
# ---------------------------------------------------------------------------


class TestAddressSanitization:
    """ADDRESS_PATTERN should catch street addresses."""

    def test_street_address(self):
        msg = "I live at 123 Main St and need a nearby clinic."
        result, modified = sanitize_for_ai(msg)
        assert "123 Main St" not in result
        assert "[address removed]" in result
        assert modified is True

    def test_avenue_address(self):
        msg = "My office is at 456 Park Ave downtown."
        result, modified = sanitize_for_ai(msg)
        assert "456 Park Ave" not in result
        assert "[address removed]" in result
        assert modified is True

    def test_road_address(self):
        msg = "Ship it to 789 Oak Rd please."
        result, modified = sanitize_for_ai(msg)
        assert "789 Oak Rd" not in result
        assert "[address removed]" in result
        assert modified is True

    def test_boulevard_address(self):
        msg = "Located at 100 Sunset Blvd in the city."
        result, modified = sanitize_for_ai(msg)
        assert "100 Sunset Blvd" not in result
        assert "[address removed]" in result
        assert modified is True

    def test_drive_address(self):
        msg = "My address is 55 Maple Drive for deliveries."
        result, modified = sanitize_for_ai(msg)
        assert "55 Maple Drive" not in result
        assert "[address removed]" in result
        assert modified is True

    def test_lane_address(self):
        msg = "We are at 12 Willow Ln out in the suburbs."
        result, modified = sanitize_for_ai(msg)
        assert "12 Willow Ln" not in result
        assert "[address removed]" in result
        assert modified is True


# ---------------------------------------------------------------------------
# SSN detection & removal
# ---------------------------------------------------------------------------


class TestSSNSanitization:
    """SSN_PATTERN should match XXX-XX-XXXX format."""

    def test_ssn_removed(self):
        msg = "My SSN is 123-45-6789 for the records."
        result, modified = sanitize_for_ai(msg)
        assert "123-45-6789" not in result
        assert "[id removed]" in result
        assert modified is True

    def test_multiple_ssns_removed(self):
        msg = "SSNs: 111-22-3333 and 444-55-6666."
        result, modified = sanitize_for_ai(msg)
        assert "111-22-3333" not in result
        assert "444-55-6666" not in result
        assert result.count("[id removed]") == 2
        assert modified is True

    def test_non_ssn_dash_numbers_not_matched(self):
        """Numbers like dates (2026-07-15) shouldn't match the SSN pattern."""
        msg = "My appointment is on 2026-07-15."
        result, modified = sanitize_for_ai(msg)
        # The date doesn't match XXX-XX-XXXX format, so it should survive.
        assert "2026-07-15" in result


# ---------------------------------------------------------------------------
# Multiple PII types in a single message
# ---------------------------------------------------------------------------


class TestMultiplePIITypes:
    """Messages containing more than one kind of PII."""

    def test_email_and_phone(self):
        msg = "Email alice@example.com or call 555-123-4567."
        result, modified = sanitize_for_ai(msg)
        assert "alice@example.com" not in result
        assert "555-123-4567" not in result
        assert "[email removed]" in result
        assert "[phone removed]" in result
        assert modified is True

    def test_name_and_ssn(self):
        msg = "My name is David and my SSN is 123-45-6789."
        result, modified = sanitize_for_ai(msg)
        assert "David" not in result
        assert "123-45-6789" not in result
        assert modified is True

    def test_all_pii_types_at_once(self):
        """A message with email, phone, name, address, and SSN."""
        msg = (
            "My name is Alice Johnson. "
            "Email me at alice@example.com or call 555-123-4567. "
            "I live at 42 Oak Ave. My SSN is 111-22-3333."
        )
        result, modified = sanitize_for_ai(msg)
        assert "Alice Johnson" not in result
        assert "alice@example.com" not in result
        assert "555-123-4567" not in result
        assert "42 Oak Ave" not in result
        assert "111-22-3333" not in result
        assert modified is True

    def test_health_content_preserved_with_pii_stripped(self):
        """Medical context should remain even after PII removal."""
        msg = (
            "My name is Sarah. I have severe cramps and heavy bleeding "
            "since 3 days. Contact me at sarah@test.com."
        )
        result, modified = sanitize_for_ai(msg)
        assert "severe cramps" in result
        assert "heavy bleeding" in result
        assert "sarah@test.com" not in result
        assert "Sarah" not in result
        assert modified is True
