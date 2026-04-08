import type { DetectedProvider } from '../types';

export interface CatchAllInstructions {
  providerName: string;
  steps: string[];
  adminUrl: string | null;
  notes: string | null;
}

const INSTRUCTIONS: Record<DetectedProvider | 'generic', CatchAllInstructions> = {
  'google-workspace': {
    providerName: 'Google Workspace',
    steps: [
      'Open the Google Admin Console',
      'Go to Apps > Google Workspace > Gmail > Default routing',
      'Click "Add setting" or edit an existing catch-all rule',
      'Under "Envelope recipients", select "Pattern match" and enter .*',
      'Under "Route", choose "Modify message" and set "Also deliver to" with your catch-all mailbox',
      'Save the routing rule',
    ],
    adminUrl: 'https://admin.google.com/ac/apps/gmail/defaultrouting',
    notes: 'Requires Google Workspace admin access. Changes may take up to 24 hours to propagate.',
  },
  'microsoft-365': {
    providerName: 'Microsoft 365',
    steps: [
      'Open the Exchange Admin Center',
      'Go to Mail flow > Rules',
      'Click "+ Add a rule" > "Create a new rule"',
      'Name it "Catch-All" and set condition: "The recipient domain is..." > your domain',
      'Add exception: "The recipient... is a member of the organization"',
      'Set action: "Redirect the message to..." > your catch-all mailbox',
      'Save and enable the rule',
    ],
    adminUrl: 'https://admin.exchange.microsoft.com/#/transportrules',
    notes:
      'Requires Exchange admin access. You may also need to set the domain as "Internal relay" under Accepted domains.',
  },
  fastmail: {
    providerName: 'Fastmail',
    steps: [
      'Open Fastmail Settings',
      'Go to Domains > select your domain',
      'Enable "Accept all mail" (catch-all)',
      'Choose which mailbox should receive the catch-all emails',
    ],
    adminUrl: 'https://app.fastmail.com/settings/domains',
    notes: null,
  },
  protonmail: {
    providerName: 'Proton Mail',
    steps: [
      'Open Proton Mail Settings',
      'Go to Domain addresses under your custom domain',
      'Enable the catch-all toggle for your domain',
      'Select which address should receive catch-all emails',
    ],
    adminUrl: 'https://account.proton.me/u/0/mail/domain-addresses',
    notes: 'Requires a Proton Mail paid plan with custom domain support.',
  },
  zoho: {
    providerName: 'Zoho Mail',
    steps: [
      'Open the Zoho Mail Admin Console',
      'Go to Domains > select your domain',
      'Navigate to Email routing / Catch-all settings',
      'Enable catch-all and set the target mailbox',
    ],
    adminUrl: 'https://mailadmin.zoho.com/cpanel/index.do#domains/',
    notes: 'Requires Zoho Mail admin access.',
  },
  icloud: {
    providerName: 'iCloud Mail',
    steps: [],
    adminUrl: null,
    notes:
      'iCloud Mail does not support catch-all for custom domains. Consider using a different email provider for catch-all mode.',
  },
  mimecast: {
    providerName: 'Mimecast (Security Gateway)',
    steps: [
      'Mimecast is a security gateway — your actual email provider is behind it',
      'Configure catch-all in your underlying email provider (e.g., Google Workspace or Microsoft 365)',
      'Ensure Mimecast is configured to forward unrecognized recipients to your mail server',
    ],
    adminUrl: null,
    notes: 'Catch-all must be configured in your actual email provider, not in Mimecast itself.',
  },
  barracuda: {
    providerName: 'Barracuda (Security Gateway)',
    steps: [
      'Barracuda is a security gateway — your actual email provider is behind it',
      'Configure catch-all in your underlying email provider (e.g., Google Workspace or Microsoft 365)',
      'Ensure Barracuda is configured to forward unrecognized recipients to your mail server',
    ],
    adminUrl: null,
    notes: 'Catch-all must be configured in your actual email provider, not in Barracuda itself.',
  },
  generic: {
    providerName: 'Your Email Provider',
    steps: [
      "Log in to your email provider's admin panel",
      'Look for "Catch-all", "Default routing", or "Accept all mail" settings',
      'Enable catch-all and set the target mailbox to receive unmatched emails',
      'Save and test by sending an email to a random address on your domain',
    ],
    adminUrl: null,
    notes:
      "The exact steps vary by provider. Check your email provider's documentation for catch-all setup instructions.",
  },
};

export function getCatchAllInstructions(provider: DetectedProvider | null): CatchAllInstructions {
  return INSTRUCTIONS[provider ?? 'generic'];
}
