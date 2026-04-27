import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * Privacy Policy dialog.
 *
 * Used in two places:
 *   - Footer (clicking "Privacy Policy")
 *   - SignUp Step 0 (clicking the linked text in the consent line)
 *
 * Content is realistic for a UK student-facing platform under GDPR. It is NOT
 * legal advice — the project owner should review with a lawyer before any real
 * commercial launch. For dissertation submission this is appropriate scope.
 */
export default function PrivacyPolicyDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        Privacy Policy
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Last updated: April 2026
        </Typography>

        <Section title="1. Who we are">
          StudySpace ("we", "us", "our") is a tutoring, community, and AI-assisted learning
          platform for UK university students. This Privacy Policy explains what personal
          data we collect about you, how we use it, who we share it with, and the rights you
          have over it.
        </Section>

        <Section title="2. Data we collect">
          When you create an account we collect your email address, a password (stored as a
          one-way hash — we never see your plain-text password), your name, your role
          (student or tutor), and your date of birth. If you choose to verify a university
          email, we collect that email and the resulting verification status. Tutors
          additionally provide qualifications, hourly rate, location area (city and postcode
          area only — never a full address), and identity-verification documents which are
          stored encrypted at rest.
          <br /><br />
          As you use StudySpace we collect content you create (forum posts, messages, AI
          chats, booking notes), and basic technical data (IP address, device type,
          accessibility preferences). We do not use third-party advertising trackers.
        </Section>

        <Section title="3. How we use your data">
          We use your data to provide the service: authenticating you, matching students
          with tutors, processing bookings, delivering messages, generating AI responses,
          sending transactional emails (verification codes, booking confirmations, password
          resets), and keeping the platform safe through moderation. We do not use your data
          for behavioural advertising or sell it to third parties.
        </Section>

        <Section title="4. AI assistant data">
          Messages you send to the StudySpace AI Assistant are sent to Google's Gemini API
          to generate replies. Google's terms apply to that processing. We retain your AI
          chat history in your account so you can review it. You can delete a chat at any
          time from the AI Assistant page.
        </Section>

        <Section title="5. Sharing">
          We share data only with processors that help us run the service:
          Google Cloud (hosting, database, AI), SendGrid (email), and your bank or payment
          processor when you book a tutoring session. We disclose data to law enforcement
          only when legally required, and we will tell you unless prohibited from doing so.
        </Section>

        <Section title="6. Storage and security">
          Data is stored in Google Cloud (London region) and protected with TLS in transit
          and managed encryption at rest. JWT authentication tokens are stored in your
          browser's local storage. Verification documents and chat content are stored
          plaintext at the application level so that StudySpace administrators can respond
          to safeguarding reports — this is a deliberate trade-off for a platform with a
          duty of care, and we never use that access for any other purpose.
        </Section>

        <Section title="7. Your rights">
          Under UK GDPR you have the right to access your data, correct inaccuracies,
          request deletion, restrict processing, port your data to another service, and
          object to certain uses. You can exercise most of these from{' '}
          <strong>Settings → Privacy &amp; Data</strong>. For other requests email{' '}
          <a href="mailto:studyspaceadmin@gmail.com">studyspaceadmin@gmail.com</a>. We aim
          to respond within 30 days. You also have the right to complain to the UK
          Information Commissioner's Office (<strong>ico.org.uk</strong>) if you believe we
          have mishandled your data.
        </Section>

        <Section title="8. Retention">
          We keep your account data for as long as you have an active account, plus 90 days
          after deletion. Verification documents are deleted within 30 days of account
          closure. Anonymised forum content may persist after account deletion — the
          username becomes "[Deleted user]" but the post stays so threads remain coherent.
        </Section>

        <Section title="9. Children">
          StudySpace is intended for users aged 16 and over. If you are under 18, please
          ensure a parent or guardian has reviewed this policy with you. We do not
          knowingly collect data from anyone under 16.
        </Section>

        <Section title="10. Changes to this policy">
          We will update this policy from time to time. Material changes will be flagged in
          the app. Continued use after a change means you accept the updated policy.
        </Section>

        <Section title="11. Contact">
          Questions about this policy or your data?<br />
          Email: <a href="mailto:studyspaceadmin@gmail.com">studyspaceadmin@gmail.com</a>
          <br />
          Phone: +44 7858 357360
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}
