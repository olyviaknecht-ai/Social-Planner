import type { ContentPillar, Campaign } from '../types'

export const SEED_PILLARS: ContentPillar[] = [
  {
    id: 'people',
    title: 'People of Valmer',
    description: 'Team, faces, personality, behind-the-scenes, culture, warm human moments.',
    color: '#c0714f',
    goal: 'Create emotional connection and familiarity.',
    active: true,
    targetShare: 0.22,
  },
  {
    id: 'growth',
    title: 'Agent Growth + Support',
    description:
      'Marketing help, events, tools, resources, Valmer Insider, Agent Advantage, content support, Title Toolbox, headshots, workshops.',
    color: '#5b7c6f',
    goal: 'Show that Valmer helps agents grow their business, not just close transactions.',
    active: true,
    targetShare: 0.2,
  },
  {
    id: 'events',
    title: 'Events + Experiences',
    description:
      'Agent Advantage, Marketing Power Hour, CE, content days, headshots, partner events, Good Talk Club, office events.',
    color: '#c79a4b',
    goal: 'Increase registrations and make events feel worth attending.',
    active: true,
    targetShare: 0.18,
  },
  {
    id: 'proof',
    title: 'Proof + Social Trust',
    description:
      'Testimonials, agent feedback, event turnout, recap videos, client/agent wins, quotes, milestones, results.',
    color: '#7a6cae',
    goal: 'Build credibility so agents feel “people like me trust Valmer.”',
    active: true,
    targetShare: 0.15,
  },
  {
    id: 'community',
    title: 'Community + Local Presence',
    description:
      'Events, partnerships, RMHC, local businesses, Real Producers, YPN, community involvement, office openings, charity work.',
    color: '#4a8db5',
    goal: 'Show Valmer as connected, local, and invested in the community.',
    active: true,
    targetShare: 0.12,
  },
  {
    id: 'tools',
    title: 'Modern Tools + Innovation',
    description:
      'Valmer Insider, Agent OS, Closinglock, Title Toolbox, marketing request systems, AI/social tools, modern communication.',
    color: '#3f7d7a',
    goal: 'Position Valmer as forward-thinking and different from other title companies.',
    active: true,
    targetShare: 0.08,
  },
  {
    id: 'closing',
    title: 'Closing Confidence',
    description:
      'Client experience, communication, smooth closings, wire safety reminders, behind the scenes, closing day moments.',
    color: '#9c5d6b',
    goal: 'Reinforce trust and professionalism without being boring.',
    active: true,
    targetShare: 0.05,
  },
]

export const SEED_CAMPAIGNS: Campaign[] = []

export const CAMPAIGN_STAGES = [
  'Tease',
  'Explain value',
  'Show proof',
  'Show people/faces',
  'Invite/register',
  'Reminder',
  'Last call',
  'Recap',
  'Follow-up/resource',
]

export const CAMPAIGN_TEMPLATES = [
  'Agent Advantage',
  'Marketing Power Hour',
  'New Year, New Agent',
  'Good Talk Club',
  'Office Opening',
  'RMHC / Community Initiative',
  'Podcast Episode Launch',
  'COSI / American Dream TV',
  'Valmer Insider Launch',
  'Title Toolbox Promotion',
  'Content Day / Headshots',
]
