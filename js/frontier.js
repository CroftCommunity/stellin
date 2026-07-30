// frontier.js — registry of every intentionally-unbuilt UI affordance.
export const FRONTIERS = [
  { key: 'interview-notes', label: 'Interview notes',
    description: 'Private per-applicant notes visible only to the hiring team.', screens: ['employer'] },
  { key: 'pipeline-bulk-actions', label: 'Bulk actions',
    description: 'Select multiple applicants and move or reject them in one step.', screens: ['employer'] },
  { key: 'schedule-interview', label: 'Schedule interview',
    description: 'Propose interview times and sync them to a calendar.', screens: ['employer'] },
  { key: 'message-from-pipeline', label: 'Message applicant',
    description: 'Message a candidate directly from the pipeline row.', screens: ['employer'] },
  { key: 'typing-indicator', label: 'Typing indicator',
    description: 'Live "…is typing" presence inside a conversation.', screens: ['messaging'] },
  { key: 'create-document-post', label: 'Create document post',
    description: 'Upload a document and publish it as a swipeable carousel.', screens: ['feed', 'composer'] },
  { key: 'premium-checkout', label: 'Upgrade to Premium',
    description: 'The premium purchase flow. This mock explains the tier instead of charging.', screens: ['jobs', 'search', 'messaging', 'settings'] },
  { key: 'groups', label: 'Groups',
    description: 'Topic-based professional groups with their own feeds.', screens: ['network'] },
  { key: 'events', label: 'Events',
    description: 'Create and RSVP to professional events.', screens: ['network'] },
  { key: 'analytics-dashboard', label: 'Analytics',
    description: 'Post and profile analytics over time.', screens: ['profile', 'company'] },
  { key: 'contact-import-real', label: 'Import contacts',
    description: 'Real contact-book import. The signup flow simulates this with a permission modal.', screens: ['onboarding', 'network'] },
];

export function getFrontier(key) { return FRONTIERS.find(f => f.key === key); }
