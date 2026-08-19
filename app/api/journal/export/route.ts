import {
  withAuth,
  createSuccessResponse,
  createValidationError,
} from "@/lib/middleware/api-wrappers";
import { addFeaturedPhotoToSessions } from "@/actions/session-actions";
import { getSessionAnalytics } from "@/lib/analytics/session-analytics";
import type { ExportOptions, ExportResult } from "@/types/database";
import { format } from "date-fns";
import { PROFILE_PUBLIC_SESSION_RELATION_SELECT } from "@/lib/profile/constants";

/**
 * Generate and export PDF documents for surf journal data
 * POST /api/journal/export
 */
export const POST = withAuth(async (request, { user, supabase }) => {
  const exportOptions: ExportOptions = await request.json();

  // Validate export options
  if (!exportOptions.type || !exportOptions.format) {
    return createValidationError("Export type and format are required");
  }

  // Inline the sessions fetch using the Bearer-aware supabase from withAuth.
  // The previous `getUserSessions(user.id)` server action created its own
  // cookie-only client and silently returned empty for native callers.
  const { data: rawSessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      `
      *,
      session_date:arrival_time,
      beach:beaches(*),
      board:boards(*),
      ${PROFILE_PUBLIC_SESSION_RELATION_SELECT}
    `,
    )
    .eq("user_id", user.id)
    .order("arrival_time", { ascending: false });

  if (sessionsError) {
    throw new Error(`Failed to fetch user sessions: ${sessionsError.message}`);
  }

  const allSessions = await addFeaturedPhotoToSessions(
    supabase,
    rawSessions || [],
  );

  let sessions: typeof allSessions = [];
  let analytics = null;

  // Filter sessions based on export type
  switch (exportOptions.type) {
    case "monthly":
      if (!exportOptions.month) {
        return createValidationError("Month is required for monthly export");
      }
      sessions = allSessions.filter(
        (session) =>
          format(new Date(session.arrival_time), "yyyy-MM") ===
          exportOptions.month,
      );
      break;

    case "yearly":
      if (!exportOptions.year) {
        return createValidationError("Year is required for yearly export");
      }
      sessions = allSessions.filter(
        (session) =>
          new Date(session.arrival_time).getFullYear().toString() ===
          exportOptions.year,
      );
      break;

    case "single":
      if (
        !exportOptions.sessionIds ||
        exportOptions.sessionIds.length === 0
      ) {
        return createValidationError(
          "Session IDs are required for single session export",
        );
      }
      sessions = allSessions.filter((session) =>
        exportOptions.sessionIds!.includes(session.id),
      );
      break;

    default:
      return createValidationError("Invalid export type");
  }

  // Get analytics if requested
  if (exportOptions.includeAnalytics) {
    const analyticsResult = await getSessionAnalytics(supabase, user.id);
    if (analyticsResult.success) {
      analytics = analyticsResult.data;
    }
  }

  // Generate PDF content
  const pdfContent = await generatePDFContent({
    sessions,
    analytics,
    exportOptions,
    userEmail: user.email || "user@example.com",
  });

  // For now, we'll simulate PDF generation
  // In a real implementation, you would use a library like:
  // - puppeteer + html-pdf
  // - @react-pdf/renderer
  // - jsPDF
  // - pdfkit

  const filename = generateFilename(exportOptions);
  const downloadUrl = await createTempDownloadUrl(pdfContent, filename);

  const result: ExportResult = {
    filename,
    downloadUrl,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  return createSuccessResponse(result);
}, { errorMessage: "Error generating export" });

/**
 * Generate PDF content from session data
 */
async function generatePDFContent({
  sessions,
  analytics,
  exportOptions,
  userEmail,
}: {
  sessions: any[];
  analytics: any;
  exportOptions: ExportOptions;
  userEmail: string;
}) {
  // This is a simplified version. In a real implementation, you would:
  // 1. Use a proper PDF generation library
  // 2. Create styled HTML templates
  // 3. Include charts and images
  // 4. Handle photo attachments

  const totalHours =
    sessions.reduce((sum, session) => {
      return sum + (session.duration_minutes || 0);
    }, 0) / 60;

  const averageRating =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + (session.rating || 0), 0) /
        sessions.length
      : 0;

  // Create HTML content for PDF generation
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Surf Journal Export</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0ea5e9;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .summary {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .session {
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 8px;
        }
        .session-header {
          font-weight: bold;
          color: #0ea5e9;
          margin-bottom: 10px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          text-align: center;
          padding: 15px;
          background: #f1f5f9;
          border-radius: 8px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #0ea5e9;
        }
        .rating {
          color: #fbbf24;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏄‍♂️ Surf Journal Export</h1>
        <p>Generated on ${format(new Date(), "PPPP")}</p>
        <p>For: ${userEmail}</p>
      </div>

      <div class="summary">
        <h2>Summary</h2>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${sessions.length}</div>
            <div>Total Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Math.round(totalHours * 10) / 10}h</div>
            <div>Time Surfed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value rating">${averageRating.toFixed(1)}/5</div>
            <div>Average Rating</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${exportOptions.type}</div>
            <div>Export Type</div>
          </div>
        </div>
      </div>

      ${
        analytics && exportOptions.includeAnalytics
          ? `
        <div class="summary">
          <h2>Analytics Insights</h2>
          <p><strong>Favorite Beach:</strong> ${
            analytics.favoriteBeach || "Not available"
          }</p>
          <p><strong>Average Wave Height:</strong> ${
            analytics.averageWaveHeight
          }ft</p>
          <p><strong>Most Used Board:</strong> ${
            analytics.frequentBoards[0]?.boardName || "Not available"
          }</p>
        </div>
      `
          : ""
      }

      <h2>Session Details</h2>
      ${sessions
        .map(
          (session) => `
        <div class="session">
          <div class="session-header">
            📍 ${session.beach?.name || session.beach_name || "Unknown Beach"}
          </div>
          <p><strong>Date:</strong> ${format(
            new Date(session.arrival_time),
            "PPPp"
          )}</p>
          ${
            session.duration_minutes
              ? `<p><strong>Duration:</strong> ${
                  Math.round((session.duration_minutes / 60) * 10) / 10
                } hours</p>`
              : ""
          }
          ${
            session.rating
              ? `<p><strong>Rating:</strong> ${"⭐".repeat(session.rating)} (${
                  session.rating
                }/5)</p>`
              : ""
          }
          ${
            session.wave_quality
              ? `<p><strong>Wave Height:</strong> ${session.wave_quality}ft</p>`
              : ""
          }
          ${
            session.water_temp
              ? `<p><strong>Water Temperature:</strong> ${session.water_temp}°F</p>`
              : ""
          }
          ${
            session.board?.name
              ? `<p><strong>Board:</strong> ${session.board.name}</p>`
              : ""
          }
          ${
            session.notes
              ? `<p><strong>Notes:</strong> ${session.notes}</p>`
              : ""
          }
        </div>
      `
        )
        .join("")}

      <div style="margin-top: 50px; text-align: center; color: #64748b; font-size: 12px;">
        <p>Generated by Quiver Surf Journal</p>
        <p>Export includes ${sessions.length} sessions ${
    exportOptions.includeAnalytics ? "with analytics" : ""
  } ${exportOptions.includePhotos ? "and photos" : ""}</p>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

/**
 * Generate filename for export
 */
function generateFilename(exportOptions: ExportOptions): string {
  const timestamp = format(new Date(), "yyyy-MM-dd");

  switch (exportOptions.type) {
    case "monthly":
      return `surf-journal-${exportOptions.month}-${timestamp}.pdf`;
    case "yearly":
      return `surf-journal-${exportOptions.year}-${timestamp}.pdf`;
    case "single":
      return `surf-sessions-${timestamp}.pdf`;
    default:
      return `surf-journal-${timestamp}.pdf`;
  }
}

/**
 * Create temporary download URL
 * In production, you would:
 * 1. Generate actual PDF file
 * 2. Upload to cloud storage (S3, etc.)
 * 3. Return signed URL with expiration
 */
async function createTempDownloadUrl(
  content: string,
  filename: string
): Promise<string> {
  // For demo purposes, we'll return a data URL
  // In production, implement proper file storage and signed URLs

  const blob = new Blob([content], { type: "text/html" });
  const base64 = Buffer.from(content).toString("base64");

  // This would be replaced with actual cloud storage URL
  return `data:text/html;base64,${base64}`;
}
