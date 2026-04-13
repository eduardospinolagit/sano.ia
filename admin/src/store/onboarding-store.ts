import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  agentName:           string
  objective:           string
  niche:               string
  style:               string
  followUpEnabled:     boolean
  followupDelayHours:  number
  followupMaxAttempts: number
  hoursConfig:         Record<string, any>
  products:            string

  setAgentName:           (v: string)              => void
  setObjective:           (v: string)              => void
  setNiche:               (v: string)              => void
  setStyle:               (v: string)              => void
  setFollowUpEnabled:     (v: boolean)             => void
  setFollowupDelayHours:  (v: number)              => void
  setFollowupMaxAttempts: (v: number)              => void
  setHoursConfig:         (v: Record<string, any>) => void
  setProducts:            (v: string)              => void
  reset:                  ()                       => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      agentName:           '',
      objective:           'sales',
      niche:               '',
      style:               'casual',
      followUpEnabled:     true,
      followupDelayHours:  24,
      followupMaxAttempts: 3,
      hoursConfig:         {},
      products:            '',

      setAgentName:           (agentName)           => set({ agentName }),
      setObjective:           (objective)           => set({ objective }),
      setNiche:               (niche)               => set({ niche }),
      setStyle:               (style)               => set({ style }),
      setFollowUpEnabled:     (followUpEnabled)     => set({ followUpEnabled }),
      setFollowupDelayHours:  (followupDelayHours)  => set({ followupDelayHours }),
      setFollowupMaxAttempts: (followupMaxAttempts) => set({ followupMaxAttempts }),
      setHoursConfig:         (hoursConfig)         => set({ hoursConfig }),
      setProducts:            (products)            => set({ products }),
      reset: () => set({
        agentName: '', objective: 'sales', niche: '', style: 'casual',
        followUpEnabled: true, followupDelayHours: 24, followupMaxAttempts: 3,
        hoursConfig: {}, products: '',
      }),
    }),
    { name: 'sano-onboarding' }
  )
)
