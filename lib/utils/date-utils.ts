// Consolidated date and time formatting utilities

export const dateUtils = {
  /**
   * Format a date string to short format (e.g., "Jan 15")
   */
  formatDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  /**
   * Format forecast time with date and time
   */
  formatForecastTime: (
    forecast_date: string,
    forecast_time?: string
  ): string => {
    const date = new Date(forecast_date);
    let timeStr = "";

    if (forecast_time) {
      // Parse time if provided (assuming format like "06:00" or "18:00")
      const [hours, minutes] = forecast_time.split(":").map(Number);
      date.setHours(hours, minutes || 0);
      timeStr = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
  },

  /**
   * Format forecast time with more detailed information
   */
  formatForecastTimeDetailed: (
    forecast_date: string,
    forecast_time?: string
  ): string => {
    const date = new Date(forecast_date);

    if (forecast_time) {
      const [hours, minutes] = forecast_time.split(":").map(Number);
      date.setHours(hours, minutes || 0);
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: forecast_time ? "numeric" : undefined,
      minute: forecast_time ? "2-digit" : undefined,
      hour12: forecast_time ? true : undefined,
    });
  },

  /**
   * Format last update time to relative time (e.g., "5m ago", "2h ago")
   */
  formatLastUpdate: (date: Date | string): string => {
    const now = new Date();
    const updateTime = new Date(date);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return updateTime.toLocaleDateString();
    }
  },

  /**
   * Format tide time from timestamp
   */
  formatTideTime: (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";

    if (hours > 12) {
      hours -= 12;
    } else if (hours === 0) {
      hours = 12;
    }

    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
    return `${hours}:${minutesStr} ${ampm}`;
  },

  /**
   * Check if a date is today
   */
  isToday: (dateString: string): boolean => {
    const today = new Date().toISOString().split("T")[0];
    return dateString === today;
  },

  /**
   * Get relative day name (Today, Tomorrow, Yesterday, or date)
   */
  getRelativeDayName: (dateString: string): string => {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    return dateUtils.formatDate(dateString);
  },
};
