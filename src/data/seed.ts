import type { ContentPillar, Campaign } from '../types'

export const SEED_PILLARS: ContentPillar[] = [
  {
    id: 'people',
    title: 'People of Valmer',
    description: 'Team, faces, personality, behind-the-scenes, culture, warm human moments.',
    color: '#ec4899',
    goal: 'Create emotional connection and familiarity.',
    active: true,
    targetShare: 0.22,
  },
  {
    id: 'growth',
    title: 'Agent Growth + Support',
    description:
      'Marketing help, events, tools, resources, Valmer Insider, Agent Advantage, content support, Title Toolbox, headshots, workshops.',
    color: '#8b5cf6',
    goal: 'Show that Valmer helps agents grow their business, not just close transactions.',
    active: true,
    targetShare: 0.2,
  },
  {
    id: 'events',
    title: 'Events + Experiences',
    description:
      'Agent Advantage, Marketing Power Hour, CE, content days, headshots, partner events, Good Talk Club, office events.',
    color: '#f59e0b',
    goal: 'Increase registrations and make events feel worth attending.',
    active: true,
    targetShare: 0.18,
  },
  {
    id: 'proof',
    title: 'Proof + Social Trust',
    description:
      'Testimonials, agent feedback, event turnout, recap videos, client/agent wins, quotes, milestones, results.',
    color: '#6366f1',
    goal: 'Build credibility so agents feel “people like me trust Valmer.”',
    active: true,
    targetShare: 0.15,
  },
  {
    id: 'community',
    title: 'Community + Local Presence',
    description:
      'Events, partnerships, RMHC, local businesses, Real Producers, YPN, community involvement, office openings, charity work.',
    color: '#06b6d4',
    goal: 'Show Valmer as connected, local, and invested in the community.',
    active: true,
    targetShare: 0.12,
  },
  {
    id: 'tools',
    title: 'Modern Tools + Innovation',
    description:
      'Valmer Insider, Agent OS, Closinglock, Title Toolbox, marketing request systems, AI/social tools, modern communication.',
    color: '#14b8a6',
    goal: 'Position Valmer as forward-thinking and different from other title companies.',
    active: true,
    targetShare: 0.08,
  },
  {
    id: 'closing',
    title: 'Closing Confidence',
    description:
      'Client experience, communication, smooth closings, wire safety reminders, behind the scenes, closing day moments.',
    color: '#f43f5e',
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

// Universal campaign starting points that fit any brand. Rename after creating.
export const CAMPAIGN_TEMPLATES = [
  'Product / Service Launch',
  'Event Promotion',
  'Seasonal / Holiday',
  'Testimonial Spotlight',
  'Giveaway / Contest',
  'Behind the Scenes Series',
  'Milestone / Anniversary',
  'Partner Collaboration',
  'Community Initiative',
  'New Offer / Promotion',
]
