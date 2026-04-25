const MIN_LENGTH = 8;

// All the rules we enforce, in display order.
export const PASSWORD_RULES = [
  {
    key: 'length',
    label: `At least ${MIN_LENGTH} characters`,
    test: (pw) => pw.length >= MIN_LENGTH,
  },
  {
    key: 'upper',
    label: 'At least one uppercase letter',
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    key: 'lower',
    label: 'At least one lowercase letter',
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    key: 'digit',
    label: 'At least one digit',
    test: (pw) => /\d/.test(pw),
  },
  {
    key: 'symbol',
    label: 'At least one symbol (!?@#$ etc.)',
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
  {
    key: 'personal',
    label: "Doesn't contain your email or name",
    // Takes the full context object so we can check against email/name.
    test: (pw, { email, firstName, lastName, displayName } = {}) => {
      if (!pw) return false;
      const lower = pw.toLowerCase();
      const banned = collectBannedTokens({ email, firstName, lastName, displayName });
      return !banned.some((token) => token.length >= 3 && lower.includes(token));
    },
  },
];

/**
 * Evaluate every rule against a password and (optional) user context.
 *
 * Returns:
 *   {
 *     results: [ { key, label, pass: boolean }, ... ],
 *     score:   0..7  (number of rules passed, plus +1 for length >= 12),
 *     label:   'Weak' | 'Fair' | 'Strong',
 *     color:   'error' | 'warning' | 'success'  (MUI color prop)
 *     allPass: boolean
 *   }
 */
export function evaluatePassword(password, context = {}) {
  const results = PASSWORD_RULES.map((r) => ({
    key: r.key,
    label: r.label,
    pass: r.test(password, context),
  }));

  let score = results.filter((r) => r.pass).length;
  // Bonus point for "long" passwords.
  if (password.length >= 12) score += 1;

  const allPass = results.every((r) => r.pass);

  let label = 'Weak';
  let color = 'error';
  if (score >= 7) { label = 'Strong'; color = 'success'; }
  else if (score >= 5) { label = 'Fair'; color = 'warning'; }

  return { results, score, label, color, allPass };
}

/**
 * Collect lowercase tokens from the user's context that must NOT appear in
 * the password. Matches the server's `_collect_banned_tokens`.
 */
function collectBannedTokens({ email, firstName, lastName, displayName } = {}) {
  const tokens = [];
  if (email) {
    const at = email.indexOf('@');
    if (at > 0) tokens.push(email.slice(0, at));
    else tokens.push(email);
  }
  for (const v of [firstName, lastName, displayName]) {
    if (v && v.trim()) tokens.push(v);
  }
  return [...new Set(tokens.map((t) => t.toLowerCase().trim()).filter(Boolean))];
}

/**
 * Handlers that block paste / drop / copy on the confirm-password input.
 * Returns an object you can spread onto a TextField to disable those flows.
 *
 * Usage:
 *   <TextField {...noPasteProps()} ... />
 */
export function noPasteProps() {
  const block = (e) => e.preventDefault();
  return {
    onPaste: block,
    onCopy: block,
    onDrop: block,
    onContextMenu: block,
  };
}
