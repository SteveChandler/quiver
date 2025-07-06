"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  FileText,
  Calendar,
  BarChart3,
  Image,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  SessionWithDetails,
  SessionAnalytics,
  ExportOptions,
  ExportResult,
} from "@/types/database";
import { format } from "date-fns";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionWithDetails[];
  analytics: SessionAnalytics | null;
}

export function ExportModal({
  isOpen,
  onClose,
  sessions,
  analytics,
}: ExportModalProps) {
  const [exportType, setExportType] = useState<"monthly" | "yearly" | "single">(
    "monthly"
  );
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Get available months from sessions
  const availableMonths = Array.from(
    new Set(
      sessions.map((session) =>
        format(new Date(session.arrival_time), "yyyy-MM")
      )
    )
  )
    .sort()
    .reverse();

  // Get available years from sessions
  const availableYears = Array.from(
    new Set(
      sessions.map((session) =>
        new Date(session.arrival_time).getFullYear().toString()
      )
    )
  )
    .sort()
    .reverse();

  // Get sessions for current selection
  const getFilteredSessions = () => {
    switch (exportType) {
      case "monthly":
        return sessions.filter(
          (session) =>
            format(new Date(session.arrival_time), "yyyy-MM") === selectedMonth
        );
      case "yearly":
        return sessions.filter(
          (session) =>
            new Date(session.arrival_time).getFullYear().toString() ===
            selectedYear
        );
      case "single":
        return sessions.filter((session) =>
          selectedSessionIds.includes(session.id)
        );
      default:
        return [];
    }
  };

  const filteredSessions = getFilteredSessions();

  const handleSessionSelect = (sessionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSessionIds((prev) => [...prev, sessionId]);
    } else {
      setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionId));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportResult(null);

    try {
      const exportOptions: ExportOptions = {
        type: exportType,
        sessionIds: exportType === "single" ? selectedSessionIds : undefined,
        month: exportType === "monthly" ? selectedMonth : undefined,
        year: exportType === "yearly" ? selectedYear : undefined,
        includePhotos,
        includeAnalytics,
        format: "pdf",
      };

      const response = await fetch("/api/journal/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      const result: ExportResult = await response.json();
      setExportResult(result);
    } catch (error) {
      console.error("Export error:", error);
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!exportResult) return;

    try {
      const response = await fetch(exportResult.downloadUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = exportResult.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      setExportError("Failed to download file");
    }
  };

  const resetModal = () => {
    setExportResult(null);
    setExportError(null);
    setSelectedSessionIds([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Surf Journal
          </DialogTitle>
        </DialogHeader>

        {exportResult ? (
          // Export Success View
          <div className="space-y-6">
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Export Complete!</h3>
              <p className="text-muted-foreground mb-4">
                Your surf journal has been exported successfully.
              </p>
              <Button onClick={handleDownload} size="lg">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filename:</span>
                    <span className="font-medium">{exportResult.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated:</span>
                    <span>
                      {format(new Date(exportResult.generatedAt), "PPp")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span>
                      {format(new Date(exportResult.expiresAt), "PPp")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetModal} className="flex-1">
                Export Another
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          // Export Configuration View
          <div className="space-y-6">
            {/* Export Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  What would you like to export?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={exportType}
                  onValueChange={(value) => setExportType(value as any)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label
                        htmlFor="monthly"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Calendar className="h-4 w-4" />
                        Monthly Summary
                        <Badge variant="secondary">
                          {availableMonths.length} months available
                        </Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yearly" id="yearly" />
                      <Label
                        htmlFor="yearly"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Yearly Report
                        <Badge variant="secondary">
                          {availableYears.length} years available
                        </Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="single" />
                      <Label
                        htmlFor="single"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        Selected Sessions
                        <Badge variant="secondary">
                          {sessions.length} sessions total
                        </Badge>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Date/Session Selection */}
            {exportType === "monthly" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {availableMonths.map((month) => (
                      <Button
                        key={month}
                        variant={
                          selectedMonth === month ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedMonth(month)}
                        className="justify-start"
                      >
                        {format(new Date(month + "-01"), "MMMM yyyy")}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {exportType === "yearly" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Year</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {availableYears.map((year) => (
                      <Button
                        key={year}
                        variant={selectedYear === year ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedYear(year)}
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {exportType === "single" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Select Sessions ({selectedSessionIds.length} selected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sessions.slice(0, 20).map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={session.id}
                          checked={selectedSessionIds.includes(session.id)}
                          onChange={(e) =>
                            handleSessionSelect(session.id, e.target.checked)
                          }
                          className="rounded"
                        />
                        <Label
                          htmlFor={session.id}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {session.beach?.name || session.beach_name}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(session.arrival_time), "MMM d")}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                    {sessions.length > 20 && (
                      <p className="text-xs text-muted-foreground">
                        Showing first 20 sessions. Use monthly/yearly export for
                        larger datasets.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <Label htmlFor="include-photos">Include Photos</Label>
                  </div>
                  <Switch
                    id="include-photos"
                    checked={includePhotos}
                    onCheckedChange={setIncludePhotos}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <Label htmlFor="include-analytics">Include Analytics</Label>
                  </div>
                  <Switch
                    id="include-analytics"
                    checked={includeAnalytics}
                    onCheckedChange={setIncludeAnalytics}
                  />
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Your export will include:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Session details (date, location, conditions)</li>
                    <li>Ratings and notes</li>
                    {includePhotos && <li>Session photos</li>}
                    {includeAnalytics && (
                      <li>Performance analytics and charts</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Export Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessions:</span>
                    <span className="font-medium">
                      {filteredSessions.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Hours:</span>
                    <span className="font-medium">
                      {Math.round(
                        (filteredSessions.reduce(
                          (sum, s) => sum + (s.duration_minutes || 0),
                          0
                        ) /
                          60) *
                          10
                      ) / 10}
                      h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date Range:</span>
                    <span className="font-medium">
                      {filteredSessions.length > 0 &&
                        `${format(
                          new Date(
                            filteredSessions[
                              filteredSessions.length - 1
                            ].arrival_time
                          ),
                          "MMM d"
                        )} - ${format(
                          new Date(filteredSessions[0].arrival_time),
                          "MMM d, yyyy"
                        )}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {exportError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{exportError}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleExport}
                disabled={isExporting || filteredSessions.length === 0}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
