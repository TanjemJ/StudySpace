import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


# Minimum length for a banned substring check.
# Shorter tokens like "al" from "alice@..." would false-positive too often.
MIN_BANNED_SUBSTRING = 3


class StudySpacePasswordValidator:

    def __init__(
        self,
        min_length=8,
        require_upper=True,
        require_lower=True,
        require_digit=True,
        require_symbol=True,
    ):
        self.min_length = min_length
        self.require_upper = require_upper
        self.require_lower = require_lower
        self.require_digit = require_digit
        self.require_symbol = require_symbol

    # ---- public API expected by Django ----

    def validate(self, password, user=None):
        errors = []

        if len(password) < self.min_length:
            errors.append(
                _("Password must be at least %(n)d characters long.") % {'n': self.min_length}
            )

        if self.require_upper and not re.search(r'[A-Z]', password):
            errors.append(_("Password must contain at least one uppercase letter."))

        if self.require_lower and not re.search(r'[a-z]', password):
            errors.append(_("Password must contain at least one lowercase letter."))

        if self.require_digit and not re.search(r'\d', password):
            errors.append(_("Password must contain at least one digit."))

        if self.require_symbol and not re.search(r'[^A-Za-z0-9]', password):
            errors.append(_("Password must contain at least one symbol (e.g. ! ? @ # $ %)."))

        # Personal-info leakage check.
        banned = self._collect_banned_tokens(user)
        lower_pw = password.lower()
        for token in banned:
            if len(token) >= MIN_BANNED_SUBSTRING and token in lower_pw:
                errors.append(
                    _("Password must not contain your personal details like your "
                      "email or name.")
                )
                break  # don't spam duplicate messages

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must be at least 8 characters, include upper and lower case "
            "letters, a digit, and a symbol, and must not contain your email or name."
        )

    # ---- helpers ----

    @staticmethod
    def _collect_banned_tokens(user):
        if user is None:
            return []

        tokens = []

        email = getattr(user, 'email', '') or ''
        if '@' in email:
            tokens.append(email.split('@', 1)[0])
        elif email:
            tokens.append(email)

        for field in ('first_name', 'last_name', 'display_name', 'username'):
            value = getattr(user, field, '') or ''
            if value:
                tokens.append(value)

        # Return unique lowercase tokens.
        return list({t.lower().strip() for t in tokens if t and t.strip()})
