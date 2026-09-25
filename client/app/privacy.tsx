import { CONTACT_EMAIL, LEGAL_ENTITY, LegalPage, type LegalSection } from '../components/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Who we are',
    blocks: [
      `Eve Colors is operated by ${LEGAL_ENTITY}, based in New York, USA. We are the controller of the personal information described in this policy. You can reach us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: 'Information we collect',
    blocks: [
      'From your Google account, when you sign in with Google:',
      [
        'Your name, email address, and Google account ID.',
        'The web address of your Google profile photo.',
      ],
      'We request only the basic "openid", "email", and "profile" permissions. We never get your Google password, and we cannot see your Gmail, contacts, calendar, files, or any other Google data.',
      'What you create in Eve Colors:',
      [
        'The color you pick each day.',
        'Your written answers to reflection questions.',
        'The question and activity you were shown, whether you completed the activity, the date, and where your flower was planted in your garden.',
      ],
      'Your choices and account records:',
      [
        'When you accepted our terms, and whether you have opted in to analytics or email (with the time of each choice).',
      ],
      'Technical information:',
      [
        'A session cookie that keeps you signed in. It is strictly necessary for the app to work; we do not use advertising or tracking cookies.',
        'Your IP address and browser details (user agent), stored with your active sign-in session and in routine server logs, used to keep the service secure and working.',
      ],
    ],
  },
  {
    heading: 'Your reflections may be sensitive',
    blocks: [
      'What you write about how you feel may reveal information about your health or wellbeing. We treat your answers as private. We use them only to show your own journal and garden back to you. We do not analyze them for advertising, sell them, or use them to train AI models. Our administration tools do not display your written answers, and we do not read them unless you ask us to (for example, to help with a support request) or the law requires it.',
      'By writing entries you give us your explicit consent to store and process them for this purpose. You can withdraw that consent at any time by deleting individual entries or your account.',
    ],
  },
  {
    heading: 'How we use your information',
    blocks: [
      [
        'To create and run your account and sign you in.',
        'To provide the daily check-in, your garden, and your entry history.',
        'To keep Eve Colors secure, prevent abuse, and fix problems.',
        'If you opt in: to understand how the app is used so we can improve it.',
        'If you opt in: to send you occasional emails about new questions and seasonal prompts.',
        'To send you essential notices about your account or changes to these policies.',
        'To comply with the law.',
      ],
      'Legal bases (for users in the EEA, UK, and similar jurisdictions): we process account and journal data to provide the service you asked for (contract); your reflections with your explicit consent; analytics and marketing email only with your consent; and security and technical data under our legitimate interest in keeping the service safe.',
    ],
  },
  {
    heading: 'Analytics and email are opt-in',
    blocks: [
      'Analytics and marketing email are off by default. You choose them separately when you first start, and you can change either one at any time in the "You" tab.',
      'If you turn on analytics, we use PostHog (hosted in the EU) to record how the app is used, such as which screens are visited and which features are used. Analytics are linked to your account so that we can delete them if you delete your account. Your written answers are never sent to analytics.',
      'If you turn on email, you can turn it off in the app or by using the unsubscribe link in any email we send.',
    ],
  },
  {
    heading: 'Google user data',
    blocks: [
      "Eve Colors' use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We use your Google name, email, account ID, and profile photo only to create your account, sign you in, and show your account details in the app. We do not sell this data, use it for advertising, transfer it to others except as needed to run the service or as required by law, or allow humans to read it except as described in this policy.",
    ],
  },
  {
    heading: 'Who we share information with',
    blocks: [
      'We do not sell your personal information, and we do not share it for targeted advertising. We share it only with service providers who help us run Eve Colors and who may use it only on our behalf:',
      [
        'Laravel Cloud (running on Amazon Web Services in the United States): hosts our servers and database.',
        'Cloudflare: hosts and delivers the Eve Colors web app.',
        'Google: provides sign-in.',
        'PostHog (EU): product analytics, only if you opt in.',
        'An email delivery provider: only if you opt in to email.',
      ],
      'We may also disclose information if required by law or to protect the rights, safety, or property of our users or others. If Eve Colors is ever part of a merger or acquisition, your information may transfer to the new owner, who must continue to honor this policy.',
    ],
  },
  {
    heading: 'Where your information is stored',
    blocks: [
      'Our database is located in the United States. If you use Eve Colors from outside the United States, your information will be transferred to and processed there. Where required, we rely on appropriate safeguards, such as the Standard Contractual Clauses offered by our service providers.',
    ],
  },
  {
    heading: 'How long we keep it',
    blocks: [
      [
        'Your account and entries: until you delete them. You can delete a single entry from your garden, or delete your whole account in the "You" tab.',
        'When you delete your account, we immediately and permanently remove your account, all of your entries, and your sign-in sessions, and we request deletion of your analytics data from PostHog.',
        'Copies may remain in our hosting provider\'s backups for a limited period until they are overwritten.',
        'Server logs are kept for a limited period for security and troubleshooting.',
      ],
    ],
  },
  {
    heading: 'Your rights and choices',
    blocks: [
      'Depending on where you live, you may have the right to access, correct, delete, or receive a copy of your personal information, to object to or restrict certain processing, and to withdraw consent at any time (without affecting processing that already happened).',
      [
        'Delete: use "Delete my account" in the "You" tab, or delete individual entries.',
        'Change your analytics and email choices: use the toggles in the "You" tab.',
        `Access, correction, or a copy of your data: email ${CONTACT_EMAIL} and we will respond within 30 days.`,
      ],
      'We will not discriminate against you for exercising these rights. If you are in the EEA or UK and are unhappy with how we handled your information, you can complain to your local data protection authority.',
    ],
  },
  {
    heading: 'Security',
    blocks: [
      'We protect your information with encrypted connections (HTTPS), access controls that limit who can reach our systems, and reputable hosting providers. No online service can be perfectly secure, but we work to protect your information and will notify you as required by law if a breach affects you.',
    ],
  },
  {
    heading: 'Age requirement',
    blocks: [
      'Eve Colors is for adults 18 and older. We do not knowingly collect information from anyone under 18. If you believe someone under 18 has created an account, contact us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    blocks: [
      'We may update this policy from time to time. We will change the effective date above, and if the changes are significant we will let you know in the app or by email before they take effect.',
    ],
  },
  {
    heading: 'Contact us',
    blocks: [`${LEGAL_ENTITY}, New York, USA. Email: ${CONTACT_EMAIL}.`],
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="September 24, 2026"
      intro="Eve Colors is a private space for a quick daily check-in: pick a color that matches how you feel, answer a short reflection question, and try a small activity. This policy explains what information we collect, how we use it, and the choices you have. The short version: we collect only what we need to run your account and your journal, we never sell your information, and analytics and email are off unless you turn them on."
      sections={sections}
    />
  );
}
