// Bump LEGAL_VERSION whenever PRIVACY_POLICY or TERMS_OF_SERVICE copy changes
// materially — App.jsx compares a signed-in user's stored `legalVersion`
// against this value to decide whether to show the re-consent banner.
export const LEGAL_VERSION    = '2026-10-03'
export const LEGAL_UPDATED_AT = 'October 3, 2026'
export const MINIMUM_AGE      = 16

export const LEGAL_DRAFT_NOTICE =
  'Draft — these documents have not yet been reviewed by a lawyer. This is a ' +
  'good-faith, thorough draft based on how Sartima actually works today, but ' +
  'it should be reviewed by qualified legal counsel in your jurisdiction ' +
  'before you rely on it as final — especially given real payment processing ' +
  'and the collection of body/face photos.'

const OPERATOR = '[Your legal name], operating as Sartima ("we," "us," or "Sartima")'
const GOVERNING_LAW = 'the laws of [Province], Canada'
const CONTACT_EMAIL = 'ytmunayi@gmail.com'

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'Who we are & scope',
      paragraphs: [
        `This Privacy Policy is issued by Yannis Munayi. It explains what personal information Sartima collects through its web app and installable PWA, why we collect it, who we share it with, and the choices and rights you have.`,
        'Sartima is a fashion discovery and personal styling app that helps you identify your style aesthetic, browse a curated product catalog, build a digital closet, generate AI outfit suggestions, and try on garments virtually.',
      ],
    },
    {
      heading: 'Information we collect',
      paragraphs: [
        'Account information: your name, email address, and password (Firebase Auth stores your password in hashed form — Sartima never sees or stores it in plain text). If you sign in with Google, we receive the name, email, and profile photo Google shares with us.',
        'Onboarding information: your occupation, preferred brands, how you heard about Sartima, and a separate "shopping email" you may provide so we can forward purchase receipts from retailer links to that inbox.',
        'Style and activity data: your quiz swipe responses, computed style-affinity scores, liked items, wishlist, outfit boards, and browsing signals (such as which brands and aesthetics you view) that we use to personalize your discovery feed.',
        'Photos: images you upload to your digital closet or outfits log, and — handled with particular care — a full body/face avatar photo you may provide to use Virtual Try-On. You choose whether to provide an avatar photo; it is only used if you use that feature.',
        'Payment information: Sartima uses Stripe to process payments and never receives or stores your card number. We store only your subscription status and the Stripe customer/subscription identifiers needed to manage your billing.',
        'Location information: with your device\'s permission, we use approximate (city-level) geolocation to fetch local weather for weather-aware outfit suggestions.',
        'Device and diagnostic data: if you accept analytics cookies (see "Cookies & tracking" below), Firebase Analytics automatically collects standard usage data such as pages viewed, session length, and device/browser type. Separately, if the app crashes or errors, diagnostic information (error messages, stack traces) is sent to our error-monitoring provider, Sentry.',
      ],
    },
    {
      heading: 'How we use your information',
      paragraphs: [
        'To create and secure your account, and to remember your preferences across sessions.',
        'To power the discovery feed and aesthetic matching using your quiz results and activity signals.',
        'To scan and catalog closet photos you upload using AI vision, so items are automatically tagged (category, color, brand) in your digital closet.',
        'To generate AI outfit suggestions and trip-packing lists based on your closet, the weather, and your stated occasion or destination.',
        'To generate Virtual Try-On renders showing how a garment might look on you, using the avatar photo you provide.',
        'To process subscription payments and one-time purchases, and to manage your billing relationship.',
        'To operate, secure, and improve the app, including diagnosing errors and understanding aggregate usage patterns (only if you\'ve accepted analytics).',
      ],
    },
    {
      heading: 'Who we share it with',
      paragraphs: [
        'We do not sell your personal information. We share it only with the service providers below, each of which processes it solely to provide the specific feature described:',
        'Google (Gemini API) — receives closet/outfit photos and your closet inventory data to power AI vision scanning, outfit generation, wardrobe suggestions, and trip planning. Sartima currently uses Google\'s free tier of the Gemini API, under which Google may use the content it receives to improve its products, and human reviewers may read it. Do not upload photos you would not want processed this way.',
        'Anthropic (Claude) — may be used instead of Google to provide the same AI features, receiving the same data.',
        'Replicate — receives your avatar photo and garment images to generate Virtual Try-On renders.',
        'Stripe — receives your email address and billing details to process payments and subscriptions.',
        'Firebase / Google Cloud — provides the hosting, authentication, database, and file-storage infrastructure that all of the data above runs on, and (if you accept analytics) collects app-usage analytics.',
        'OpenWeatherMap — receives your approximate location to return local weather data.',
        'Sentry — receives error and crash diagnostics; this does not include your photos.',
        'Pexels, Google Custom Search, and Unsplash — receive only text search terms (for example, an aesthetic or mood-board search) and never receive your personal information or photos.',
        'Sovrn Commerce — when you click a "shop" link to a retailer, the click may be routed through Sovrn\'s affiliate redirect so Sartima can earn a commission on resulting purchases. Sovrn receives standard click data (such as the destination retailer, your device/browser type, and IP address) and may set its own cookies on the retailer\'s site; it does not receive your Sartima account information or photos.',
        'Because most of these providers operate primarily in the United States, your information may be processed on servers outside of Canada. Each provider maintains its own security and privacy safeguards for cross-border processing.',
        'We may also disclose information if required by law, or to protect the rights, safety, or property of Sartima or our users.',
      ],
    },
    {
      heading: 'Data retention',
      paragraphs: [
        'We keep your account data, closet photos, and avatar photo for as long as your account is active, or until you delete the specific item or your account. You can delete individual closet items or your avatar at any time from within the app.',
        'If you delete your account, we cancel any active subscription, permanently delete your photos from storage, permanently delete your account data from our database, and delete your login credentials — see "Your rights" below.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Depending on where you live, you may have rights under Canadian privacy law (PIPEDA), U.S. state privacy laws (such as the CCPA/CPRA), the EU/UK GDPR, or similar laws. Sartima honors the following rights for all users, regardless of location:',
        'Access & portability — use "Export all my data" in Profile → Data & Privacy to download a copy of your account data, style history, closet, wishlist, and activity signals in JSON format.',
        'Deletion — use "Delete account" in Profile → Data & Privacy to permanently delete your account, photos, and stored data, and cancel any active subscription.',
        'Correction — update your name, email, preferences, and closet details at any time directly within the app.',
        'Opt-out of analytics — accept or decline analytics cookies from the banner shown on first visit, or change your choice later in Profile → Settings → Analytics.',
        `To exercise any right not covered by an in-app control, or if you have questions about this policy, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Children\'s privacy & minimum age',
      paragraphs: [
        `Sartima requires all users to be at least ${MINIMUM_AGE} years old, and asks you to confirm this when you create an account. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe a child has provided us with personal information, contact us at ${CONTACT_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: 'Cookies & tracking',
      paragraphs: [
        'On your first visit, we ask whether you\'d like to accept analytics cookies (Firebase Analytics / Google Analytics). If you accept, we collect standard usage analytics as described above; if you decline, that collection is not initialized. You can change this choice at any time in Profile → Settings → Analytics.',
        'Separately, Sartima stores a small amount of information in your browser\'s local storage — such as your theme preference and guest-mode selections — purely to make the app work correctly. This first-party storage is not used for tracking or advertising.',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Your data is protected by Firestore and Cloud Storage security rules that restrict access to your account records and files to you alone, transmitted over HTTPS. Sartima never receives or stores your payment card details — those are handled directly by Stripe. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        `We may update this policy from time to time. If we make a material change, signed-in users will see an in-app notice the next time they open Sartima, and can review the updated policy before continuing to use the app. The version in effect is dated above (last updated ${LEGAL_UPDATED_AT}).`,
      ],
    },
    {
      heading: 'Contact us',
      paragraphs: [
        `Questions about this policy or your data? Email ${CONTACT_EMAIL}.`,
      ],
    },
  ],
}

export const TERMS_OF_SERVICE = {
  title: 'Terms of Service',
  sections: [
    {
      heading: 'Eligibility',
      paragraphs: [
        `You must be at least ${MINIMUM_AGE} years old to create a Sartima account, and you confirm this when you sign up. We may suspend or terminate an account if we learn this was not true.`,
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'You agree to provide accurate information when you register, and to keep your password secure. You are responsible for activity that happens under your account. Please create one account per person.',
      ],
    },
    {
      heading: 'Subscriptions & payments',
      paragraphs: [
        'Sartima Pro is offered as a monthly or annual subscription (see current pricing in the app), and Virtual Try-On credit packs are available as one-time purchases. All payments are processed by Stripe.',
        'Subscriptions automatically renew at the end of each billing period until you cancel. You can cancel anytime from Profile → Manage subscription, which opens Stripe\'s billing portal; cancellation takes effect at the end of your current billing period, and you keep Pro access until then.',
        'All payments are non-refundable, including partial billing periods and unused Virtual Try-On credit packs, except where required by applicable law.',
      ],
    },
    {
      heading: 'AI-generated content disclaimer',
      paragraphs: [
        'Outfit suggestions, trip-packing recommendations, and Virtual Try-On renders are generated by AI and are intended for inspiration and visualization only. They are approximations, not guarantees of real-world fit, sizing, color accuracy, or appearance, and should not be relied on as a substitute for trying on an item yourself.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You own the photos and other content you upload to Sartima. By uploading content, you grant Sartima a limited license to store, process, and transmit it — including to the third-party providers named in our Privacy Policy — solely to provide the feature you requested (for example, scanning a closet photo, or generating a try-on render). We do not use your photos to train AI models or for any purpose beyond providing the app\'s features to you.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You agree not to upload content that is illegal, infringes someone else\'s rights, or that you don\'t have permission to share; not to scrape, reverse-engineer, or abuse the app or its AI features; and not to impersonate another person or misrepresent your affiliation with anyone.',
      ],
    },
    {
      heading: 'Third-party retailer links',
      paragraphs: [
        'Sartima\'s discovery feed and Shop Scout feature link out to third-party retailer websites. Sartima is not a party to, and is not responsible for, any purchase you make on a retailer\'s site — those transactions are governed by that retailer\'s own terms and policies.',
        'Affiliate disclosure: some retailer links in Sartima are affiliate links, meaning Sartima may earn a commission if you make a purchase after clicking them — at no additional cost to you. Commissions never influence which products are recommended to you; recommendations are driven by your style profile.',
      ],
    },
    {
      heading: 'Intellectual property',
      paragraphs: [
        'Sartima\'s brand, curated product catalog, aesthetic guides, and underlying software are owned by Sartima. Your own uploaded content remains yours, as described above.',
      ],
    },
    {
      heading: 'Disclaimers & limitation of liability',
      paragraphs: [
        'Sartima is provided "as is" and "as available," without warranties of any kind, express or implied. To the fullest extent permitted by law, Sartima and its operator are not liable for any indirect, incidental, or consequential damages arising from your use of the app, and our total liability for any claim is limited to the amount you paid Sartima in the twelve months before the claim arose.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You may stop using Sartima and delete your account at any time from Profile → Data & Privacy. We may suspend or terminate your account if you violate these Terms.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        `These Terms are governed by ${GOVERNING_LAW}, without regard to conflict-of-law principles.`,
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        `We may update these Terms from time to time. If we make a material change, signed-in users will see an in-app notice the next time they open Sartima. The version in effect is dated above (last updated ${LEGAL_UPDATED_AT}).`,
      ],
    },
  ],
}
