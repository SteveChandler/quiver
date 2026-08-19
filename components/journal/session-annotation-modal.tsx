"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Upload,
  X,
  Eye,
  EyeOff,
  MapPin,
  Calendar,
  Clock,
  Waves,
  Star,
  Users,
  Car,
  Thermometer,
  Camera,
  Plus,
  Trash2,
} from "lucide-react";
import SessionPhotoUpload from "@/components/media/session-photo-upload";
import SessionPhotoGallery from "@/components/media/session-photo-gallery";
import { StarRating } from "@/components/ui/star-rating";
import { useAuth } from "@/context/auth-context";
import type { SessionWithDetails } from "@/types/database";
import { format } from "date-fns";
import { SESSION_PHOTO_MAX_PER_SESSION } from "@/lib/media/session-photo-policy";

type SessionPhoto = {
  id: string;
  session_id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  caption?: string;
  file_size: number;
  metadata?: any;
  created_at: string;
};

interface SessionAnnotationModalProps {
  session: SessionWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SessionAnnotationModal({
  session,
  isOpen,
  onClose,
  onSave,
}: SessionAnnotationModalProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(session.notes || "");
  const [isPrivate, setIsPrivate] = useState(!session.is_public);
  const [rating, setRating] = useState(session.rating || 0);
  const [isSaving, setSaving] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const remainingPhotoSlots = Math.max(
    SESSION_PHOTO_MAX_PER_SESSION - sessionPhotos.length,
    0,
  );

  const loadSessionPhotos = useCallback(async () => {
    if (!session.id) return;

    setLoadingPhotos(true);
    try {
      const response = await fetch(`/api/sessions/${session.id}/photos`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load photos (${response.status})`);
      }
      const json = await response.json();
      const rows = (json?.data?.photos as any[]) || [];
      if (Array.isArray(rows)) {
        setSessionPhotos(
          rows.map((row) => ({
            id: row.id,
            session_id: row.session_id ?? session.id,
            user_id: row.user_id,
            public_url: row.public_url,
            storage_path: row.storage_path,
            caption: row.caption ?? undefined,
            file_size: row.file_size,
            metadata: row.metadata ?? undefined,
            created_at: row.created_at,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading session photos:", error);
    } finally {
      setLoadingPhotos(false);
    }
  }, [session.id]);

  // Load session photos when modal opens
  useEffect(() => {
    if (isOpen && session.id) {
      loadSessionPhotos();
    }
  }, [isOpen, session.id, loadSessionPhotos]);

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const updateData = {
        notes,
        is_public: !isPrivate,
        rating,
      };

      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || `Failed to update session (${response.status})`);
      }
      onSave();
    } catch (error) {
      console.error("Error updating session:", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUploaded = () => {
    loadSessionPhotos(); // Refresh photo list
  };

  const getConditionIcon = (type: string) => {
    switch (type) {
      case "wave":
        return <Waves className="h-4 w-4" />;
      case "water":
        return <Thermometer className="h-4 w-4" />;
      case "crowd":
        return <Users className="h-4 w-4" />;
      case "parking":
        return <Car className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const formatConditionValue = (
    type: string,
    value: number | string | null | undefined
  ) => {
    if (!value && value !== 0) return "Not rated";

    switch (type) {
      case "wave":
        return `${value}ft`;
      case "water":
        return `${value}°F`;
      case "crowd":
      case "parking":
        return `${value}/5`;
      default:
        return String(value);
    }
  };

  const conditions = [
    {
      type: "wave",
      label: "Wave Height",
      value: session.wave_quality,
      color: "text-blue-600",
    },
    {
      type: "water",
      label: "Water Temp",
      value: session.water_temp != null ? Number(session.water_temp) : null,
      color: "text-green-600",
    },
    {
      type: "crowd",
      label: "Crowd Level",
      value: session.crowd_level,
      color: "text-yellow-600",
    },
    {
      type: "parking",
      label: "Parking",
      value: session.parking_ease,
      color: "text-purple-600",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Session Details & Annotations
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Session Info */}
          <div className="space-y-4">
            {/* Basic Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {session.beach?.name || session.beach_name || "Unknown Beach"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(session.arrival_time), "EEEE, MMMM d, yyyy")}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {format(new Date(session.arrival_time), "h:mm a")}
                  {session.duration_minutes && (
                    <span>
                      • {Math.round((session.duration_minutes / 60) * 10) / 10}h
                      session
                    </span>
                  )}
                </div>
                {session.board?.name && (
                  <Badge variant="outline">Board: {session.board.name}</Badge>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {conditions.map((condition) => (
                    <div
                      key={condition.type}
                      className="flex items-center gap-2"
                    >
                      <div className={condition.color}>
                        {getConditionIcon(condition.type)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {condition.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatConditionValue(
                            condition.type,
                            condition.value
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Session Photos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos ({sessionPhotos.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                    disabled={loadingPhotos || remainingPhotoSlots === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showPhotoUpload && (
                  <div className="mb-4">
                    <SessionPhotoUpload
                      sessionId={session.id}
                      onUploadComplete={handlePhotoUploaded}
                      maxPhotos={remainingPhotoSlots}
                    />
                  </div>
                )}

                {loadingPhotos ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading photos...
                  </div>
                ) : sessionPhotos.length > 0 ? (
                  <SessionPhotoGallery
                    sessionId={session.id}
                    photos={sessionPhotos}
                    canEdit={true}
                    onPhotosChange={(photos) => setSessionPhotos(photos)}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="h-8 w-8 mx-auto mb-2" />
                    <p>No photos yet</p>
                    <p className="text-xs">
                      Add photos to capture your session memories
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Annotations */}
          <div className="space-y-4">
            {/* Overall Rating */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <StarRating rating={rating} size="lg" />
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full"
                    aria-label="Overall rating"
                  />
                  <p className="text-sm text-muted-foreground">
                    Rate your overall session experience
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Session Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Textarea
                    placeholder="How was your session? What did you learn? Any memorable moments?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add personal notes, observations, or memories from this
                    session
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Privacy & Sharing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPrivate ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-green-600" />
                      )}
                      <div>
                        <Label htmlFor="privacy-toggle" className="font-medium">
                          {isPrivate ? "Private Session" : "Public Session"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isPrivate
                            ? "Only you can see this session"
                            : "Visible in community feed"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="privacy-toggle"
                      checked={!isPrivate}
                      onCheckedChange={(checked) => setIsPrivate(!checked)}
                    />
                  </div>

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">What gets shared:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Beach location and session time</li>
                      <li>Ratings and conditions</li>
                      <li>Photos (if you choose to add them)</li>
                      <li>Public notes (personal notes stay private)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
