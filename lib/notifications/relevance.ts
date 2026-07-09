export type NotificationConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface NotificationRelevanceMetadata {
  notification_category: string;
  trigger_source: string;
  relevance_confidence: NotificationConfidenceLevel;
  beach_confidence: NotificationConfidenceLevel;
  assumed_attendance: false;
  attendance_confidence_score?: number;
  beach_confidence_score?: number;
  relevance_score?: number;
}

function normalizeScore(score: number | null | undefined): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, score));
}

export function isHighConfidenceNotification(
  confidence: NotificationConfidenceLevel | null | undefined,
): boolean {
  return confidence === "high";
}

export function buildNotificationRelevanceMetadata(args: {
  category: string;
  triggerSource: string;
  relevanceConfidence: NotificationConfidenceLevel;
  beachConfidence?: NotificationConfidenceLevel;
  attendanceConfidenceScore?: number | null;
  beachConfidenceScore?: number | null;
  relevanceScore?: number | null;
}): NotificationRelevanceMetadata {
  const attendanceConfidenceScore = normalizeScore(args.attendanceConfidenceScore);
  const beachConfidenceScore = normalizeScore(args.beachConfidenceScore);
  const relevanceScore = normalizeScore(args.relevanceScore);

  return {
    notification_category: args.category,
    trigger_source: args.triggerSource,
    relevance_confidence: args.relevanceConfidence,
    beach_confidence: args.beachConfidence ?? "low",
    assumed_attendance: false,
    ...(attendanceConfidenceScore === undefined
      ? {}
      : { attendance_confidence_score: attendanceConfidenceScore }),
    ...(beachConfidenceScore === undefined
      ? {}
      : { beach_confidence_score: beachConfidenceScore }),
    ...(relevanceScore === undefined ? {} : { relevance_score: relevanceScore }),
  };
}
