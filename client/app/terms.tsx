import { CONTACT_EMAIL, LEGAL_ENTITY, LegalPage, type LegalSection } from '../components/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Agreeing to these terms',
    blocks: [
      `These Terms of Service ("Terms") are an agreement between you and ${LEGAL_ENTITY} ("we", "us"), which operates Eve Colors. By creating an account or using Eve Colors, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use Eve Colors.`,
    ],
  },
  {
    heading: 'Eve Colors is not medical care',
    blocks: [
      'Eve Colors is a tool for everyday self-reflection. It is not a medical device and does not provide medical, psychological, or therapeutic advice, diagnosis, or treatment. Colors, questions, activities, and wellness categories are descriptive prompts, not assessments or scores. Eve Colors is not a substitute for care from a qualified professional.',
      'If you are in crisis or thinking about harming yourself, contact local emergency services right away. In the United States, you can call or text 988 at any time to reach the Suicide & Crisis Lifeline.',
      'Suggested activities are optional. Use your own judgment, and skip anything that is not safe or suitable for you.',
    ],
  },
  {
    heading: 'Who can use Eve Colors',
    blocks: [
      'You must be at least 18 years old and able to form a binding contract to use Eve Colors. You sign in with a Google account. You are responsible for keeping that account secure and for activity that happens under your Eve Colors account. Tell us promptly if you believe your account has been used without your permission.',
    ],
  },
  {
    heading: 'Your content',
    blocks: [
      'Your answers and entries belong to you. You give us a limited license to store, process, and display your content only as needed to provide Eve Colors to you, as described in our Privacy Policy. This license ends when you delete the content or your account, except for copies that remain in backups for a limited period.',
    ],
  },
  {
    heading: 'Acceptable use',
    blocks: [
      'You agree not to:',
      [
        'Break the law or violate the rights of others while using Eve Colors.',
        'Try to access another person\'s account or data, or any part of our systems you are not authorized to use.',
        'Interfere with or disrupt the service, including by probing, scanning, or overloading it.',
        'Use bots, scrapers, or other automated means to access Eve Colors, except as we allow.',
        'Copy, resell, or build a competing service from Eve Colors or its content.',
        'Reverse engineer the service, except where the law allows it.',
      ],
    ],
  },
  {
    heading: 'Our content',
    blocks: [
      'Eve Colors, including its questions, activities, color descriptions, artwork, design, and software, is owned by us or our licensors and protected by intellectual property laws. We grant you a personal, non-transferable, revocable license to use it for your own non-commercial purposes while you have an account. "Eve Colors" and our logo are our trademarks.',
    ],
  },
  {
    heading: 'Price and changes to the service',
    blocks: [
      'Eve Colors is currently free. If we introduce paid features, we will tell you in advance and you will not be charged unless you choose to buy them. We may add, change, or remove features, and we may suspend or discontinue Eve Colors. If we discontinue it, we will try to give you reasonable notice.',
    ],
  },
  {
    heading: 'Ending your account',
    blocks: [
      'You can stop using Eve Colors and delete your account at any time from the "You" tab. We may suspend or close your account if you seriously or repeatedly break these Terms, if required by law, or to protect Eve Colors or other people. Sections that by their nature should survive (such as those on ownership, disclaimers, limitation of liability, and governing law) will survive after your account ends.',
    ],
  },
  {
    heading: 'Disclaimers',
    blocks: [
      'EVE COLORS IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not promise that Eve Colors will be uninterrupted, error-free, or that your content will never be lost, and we do not promise any particular wellness outcome.',
    ],
  },
  {
    heading: 'Limitation of liability',
    blocks: [
      'TO THE FULLEST EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF EVE COLORS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO EVE COLORS WILL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM.',
      'Some jurisdictions do not allow certain disclaimers or limitations, so some of the above may not apply to you. Nothing in these Terms limits rights you have under law that cannot be waived.',
    ],
  },
  {
    heading: 'Indemnity',
    blocks: [
      'To the extent permitted by law, you agree to defend and indemnify us against claims, losses, and expenses (including reasonable legal fees) arising from your breach of these Terms or your misuse of Eve Colors.',
    ],
  },
  {
    heading: 'Governing law and disputes',
    blocks: [
      'These Terms are governed by the laws of the State of New York, USA, without regard to its conflict-of-law rules. Any dispute arising from these Terms or Eve Colors will be brought exclusively in the state or federal courts located in New York County, New York, and you and we consent to their jurisdiction. If you live in a country whose laws give you the right to bring claims in your local courts, this section does not take that right away.',
    ],
  },
  {
    heading: 'Changes to these terms',
    blocks: [
      'We may update these Terms from time to time. We will change the effective date above, and if the changes are significant we will let you know in the app or by email before they take effect. If you keep using Eve Colors after changes take effect, you accept the updated Terms.',
    ],
  },
  {
    heading: 'General',
    blocks: [
      'These Terms and our Privacy Policy are the entire agreement between you and us about Eve Colors. If any part of these Terms is found unenforceable, the rest stays in effect. If we do not enforce a provision right away, we have not waived it. You may not transfer these Terms without our consent; we may transfer them as part of a merger, acquisition, or sale of assets.',
    ],
  },
  {
    heading: 'Contact us',
    blocks: [`${LEGAL_ENTITY}, New York, USA. Email: ${CONTACT_EMAIL}.`],
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate="September 24, 2026"
      intro="Welcome to Eve Colors. These Terms explain the rules for using Eve Colors and what you can expect from us. Please read them together with our Privacy Policy."
      sections={sections}
    />
  );
}
