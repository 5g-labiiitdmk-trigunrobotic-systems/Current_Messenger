export interface LabFeature {
  key: string;
  label: string;
  sub: string;
  icon: string;
  detail: string;
}

/**
 * Heavy long-tail features scoped as UI shells this pass, per the agreed
 * priority: hardening core chat (auth, contacts, messaging, encryption)
 * mattered more than building out AR/ML/game engines in the time available.
 * Each entry here is a real, navigable screen — just not functionally wired.
 */
export const LAB_FEATURES: LabFeature[] = [
  {
    key: 'ar-filters',
    label: 'AR filters',
    sub: 'Live camera effects for calls & photos',
    icon: 'M4 7l2-3h12l2 3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    detail: 'Real-time face-tracking AR filters need an on-device ML pipeline (ARKit/ARCore + a filter engine) — a substantial subsystem on its own. This entry is wired into navigation so the feature has a home once built.',
  },
  {
    key: 'mini-games',
    label: 'Mini-games in chat',
    sub: 'Play a quick round without leaving the thread',
    icon: 'M6 12h4m-2-2v4M15 11h.01M18 13h.01M17.3 5H6.7A4.7 4.7 0 0 0 2 9.7v4.6A4.7 4.7 0 0 0 6.7 19h10.6A4.7 4.7 0 0 0 22 14.3V9.7A4.7 4.7 0 0 0 17.3 5Z',
    detail: 'Planned: a synced game session relayed live (e.g. tic-tac-toe) with zero game-state persistence, matching the messaging model exactly. Not implemented yet.',
  },
  {
    key: 'voice-changer',
    label: 'Voice changer',
    sub: 'Pitch/effects on voice messages & calls',
    icon: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
    detail: 'Needs real-time audio DSP on recorded/streamed audio. Voice messages already record and play back for real — pitch-shifting is the next layer once prioritized.',
  },
  {
    key: 'doodle',
    label: 'Doodle on photos',
    sub: 'Draw over shared images before sending',
    icon: 'M12 19l7-7 3 3-7 7-3-3ZM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z',
    detail: 'Photo sharing already works end-to-end encrypted. A draw-over-image canvas is a self-contained addition planned for a future pass.',
  },
  {
    key: 'co-watching',
    label: 'Co-watching / co-listening',
    sub: 'Synced playback with someone, live',
    icon: 'M23 7l-7 5 7 5V7ZM1 5h15v14H1z',
    detail: 'Would sync only play/pause/seek state over the relay (no media persistence) — architecturally straightforward, not yet built.',
  },
  {
    key: 'business-profiles',
    label: 'Business profiles',
    sub: 'Verified org accounts with extra info',
    icon: 'M4 21V7a2 2 0 0 1 2-2h4l2-2h4v18M9 9h6M9 13h6M9 17h6',
    detail: 'Would extend the users table with an org/verification flag and a richer profile layout. Deferred to keep this pass focused on personal accounts.',
  },
  {
    key: 'bots',
    label: 'Bots & automation',
    sub: 'Stateless automated chat participants',
    icon: 'M12 8V4H8M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8ZM2 14h2M20 14h2M9 13v2M15 13v2',
    detail: 'A stateless bot could be just another authenticated relay client that responds live — no new server architecture required, but no bot exists yet.',
  },
  {
    key: 'topics',
    label: 'Topics within groups',
    sub: 'Sub-threads for large groups',
    icon: 'M8 12h8M8 8h8M8 16h4M21 12a9 9 0 1 1-9-9',
    detail: 'Group chat currently has one live stream per group. Topic sub-rooms are a natural relay-room extension, not yet built.',
  },
  {
    key: 'widget-presence',
    label: 'Widget-based presence',
    sub: 'See who’s online from your home screen',
    icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    detail: 'Needs a native iOS/Android widget extension (separate build target) reading live presence. Not implemented this pass.',
  },
];
