import React from "react";
import {
  MapPin,
  Calendar,
  Target,
  Camera,
  FileText,
  Zap,
  Star,
} from "lucide-react";
import { SessionFormMode } from "@/hooks/use-session-form";

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: string;
  isRequired: boolean;
}

// Feature flag for consolidated wizard (safe rollout)
// Set to true to enable the new 4-step consolidated flow for log mode
export const USE_CONSOLIDATED_WIZARD = true;

// Legacy step configurations (6 steps for log mode)
const WIZARD_STEPS_V1: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "Set your session date and time",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      icon: <Target className="w-5 h-5" />,
      component: "GoalsSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
  log: [
    {
      id: "location",
      title: "Location",
      description: "Where did your session take place?",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "When did you surf?",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "equipment",
      title: "Equipment",
      description: "Which board did you ride?",
      icon: <Target className="w-5 h-5" />,
      component: "EquipmentStep",
      isRequired: false,
    },
    {
      id: "conditions",
      title: "Conditions",
      description: "How were the waves and conditions?",
      icon: <Target className="w-5 h-5" />,
      component: "ConditionsSection",
      isRequired: false,
    },
    {
      id: "photos",
      title: "Photos",
      description: "Add photos from your session",
      icon: <Camera className="w-5 h-5" />,
      component: "PhotoSelectionSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes",
      description: "Reflect on your session",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
};

// New consolidated step configurations (4 steps for log mode)
const WIZARD_STEPS_V2: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    // Plan mode unchanged (same as V1)
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "Set your session date and time",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      icon: <Target className="w-5 h-5" />,
      component: "GoalsSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      icon: <FileText className="w-5 h-5" />,
      component: "NotesSection",
      isRequired: false,
    },
  ],
  log: [
    // CONSOLIDATED: 4 steps (was 6)
    {
      id: "location",
      title: "Location",
      description: "Where did your session take place?",
      icon: <MapPin className="w-5 h-5" />,
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "When did you surf?",
      icon: <Calendar className="w-5 h-5" />,
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "equipment",
      title: "Equipment",
      description: "Which board did you ride?",
      icon: <Target className="w-5 h-5" />,
      component: "EquipmentStep",
      isRequired: false,
    },
    {
      id: "session-details",
      title: "Session Details",
      description: "Rate conditions, add photos, and share your experience",
      icon: <FileText className="w-5 h-5" />,
      component: "SessionDetailsSection", // NEW CONSOLIDATED COMPONENT
      isRequired: false,
    },
  ],
};

/**
 * Quick log mode: streamlined 2-step flow for first-time session logging.
 * Step 1 combines location + time, Step 2 is a simplified rating.
 */
const QUICK_LOG_STEPS: WizardStep[] = [
  {
    id: "quick-location-time",
    title: "Where & When",
    description: "Where and when did you surf?",
    icon: <Zap className="w-5 h-5" />,
    component: "QuickLocationTimeStep",
    isRequired: true,
  },
  {
    id: "quick-rating",
    title: "How Was It?",
    description: "Rate your session",
    icon: <Star className="w-5 h-5" />,
    component: "QuickRatingStep",
    isRequired: false,
  },
];

/**
 * Returns the appropriate wizard steps based on mode, feature flag, and quick mode.
 * @param mode - The session form mode (plan or log)
 * @param quick - Whether to use the streamlined 2-step quick log flow
 * @returns Array of wizard steps for the specified mode
 */
export function getWizardSteps(mode: SessionFormMode, quick?: boolean): WizardStep[] {
  if (quick && mode === "log") {
    return QUICK_LOG_STEPS;
  }
  const WIZARD_STEPS = USE_CONSOLIDATED_WIZARD
    ? WIZARD_STEPS_V2
    : WIZARD_STEPS_V1;
  return WIZARD_STEPS[mode];
}
