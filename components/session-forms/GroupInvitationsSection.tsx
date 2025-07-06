"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import { SessionFormState } from "@/hooks/use-session-form";
import {
  Users,
  Mail,
  Plus,
  X,
  UserPlus,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupInvitationsSectionProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

interface Friend {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function GroupInvitationsSection({
  formState,
  updateField,
}: GroupInvitationsSectionProps) {
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [invitationMessage, setInvitationMessage] = useState(
    formState.invitationMessage || ""
  );

  // Fetch user's following list (friends)
  const fetchFriends = async () => {
    if (!user?.id) return [];

    const response = await fetch(
      `/api/session-planner/invitations?type=friends`
    );
    if (!response.ok) {
      // Fallback to social actions if endpoint doesn't exist yet
      const { getUserFollowing } = await import("@/actions/social-actions");
      const result = await getUserFollowing(user.id, 50);
      if (result.success) {
        return result.data
          .map((follow: any) => follow.following)
          .filter(Boolean);
      }
      return [];
    }

    const data = await response.json();
    return data.success ? data.data : [];
  };

  const { data: friendsData, loading: loadingFriends } = useDataFetcher(
    fetchFriends,
    {
      enabled: !!user?.id,
    }
  );

  // Ensure friends is always an array, even if data is null
  const friends = Array.isArray(friendsData) ? friendsData : [];

  // Update form state when invitees change
  useEffect(() => {
    const invitees = [
      ...selectedFriends.map((friend) => ({
        userId: friend.id,
        email: friend.email,
        name: friend.full_name,
      })),
      ...emailInput
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email && email.includes("@"))
        .map((email) => ({ email, name: email.split("@")[0] })),
    ];

    updateField("invitees", invitees);
    updateField("invitationMessage", invitationMessage);
  }, [selectedFriends, emailInput, invitationMessage, updateField]);

  // Handle friend selection
  const handleFriendSelect = (friend: Friend) => {
    const isSelected = selectedFriends.some((f) => f.id === friend.id);
    if (isSelected) {
      setSelectedFriends((prev) => prev.filter((f) => f.id !== friend.id));
    } else {
      setSelectedFriends((prev) => [...prev, friend]);
    }
  };

  // Handle removing a selected friend
  const handleRemoveFriend = (friendId: string) => {
    setSelectedFriends((prev) => prev.filter((f) => f.id !== friendId));
  };

  // Parse and validate email input
  const emailList = emailInput
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email);

  const validEmails = emailList.filter((email) => email.includes("@"));
  const invalidEmails = emailList.filter(
    (email) => email && !email.includes("@")
  );

  return (
    <div className="pt-4 border-t space-y-4">
      <div className="flex items-center mb-3">
        <Users className="w-4 h-4 mr-2 text-primary" />
        <label className="block text-sm font-medium">
          Invite Friends (Optional)
        </label>
      </div>

      {/* Friends from Following List */}
      {friends.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Your Surf Buddies</h4>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
            {friends.slice(0, 10).map((friend: Friend) => {
              const isSelected = selectedFriends.some(
                (f) => f.id === friend.id
              );
              return (
                <Button
                  key={friend.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="justify-start h-auto p-2"
                  onClick={() => handleFriendSelect(friend)}
                >
                  <Avatar className="w-6 h-6 mr-2">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {friend.full_name?.charAt(0) ||
                        friend.email?.charAt(0) ||
                        "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left truncate">
                    {friend.full_name || friend.email}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 ml-2" />}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Email Input */}
      <div>
        <h4 className="text-sm font-medium mb-2">Invite by Email</h4>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            className="pl-10"
            placeholder="Enter email addresses (separated by commas)"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
        </div>
        {invalidEmails.length > 0 && (
          <div className="mt-1 text-xs text-destructive flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Invalid emails: {invalidEmails.join(", ")}
          </div>
        )}
        {validEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {validEmails.map((email, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {email}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Selected Friends Summary */}
      {selectedFriends.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Selected Friends ({selectedFriends.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {selectedFriends.map((friend) => (
              <Badge
                key={friend.id}
                variant="default"
                className="text-xs flex items-center gap-1"
              >
                {friend.full_name || friend.email}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-primary-foreground"
                  onClick={() => handleRemoveFriend(friend.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Invitation Message */}
      {(selectedFriends.length > 0 || validEmails.length > 0) && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Invitation Message (Optional)
          </h4>
          <div className="relative">
            <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Textarea
              placeholder="Add a personal message to your invitation..."
              className="pl-10 min-h-20"
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
              maxLength={200}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {invitationMessage.length}/200 characters
          </p>
        </div>
      )}

      {/* Invitation Preview */}
      {(selectedFriends.length > 0 || validEmails.length > 0) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-start">
              <UserPlus className="w-4 h-4 mt-0.5 mr-2 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">
                  Invitation Preview
                </p>
                <div className="text-blue-700 space-y-1 text-xs">
                  <p>
                    <strong>Who:</strong>{" "}
                    {selectedFriends.length + validEmails.length} people
                  </p>
                  {formState.selectedBeach && (
                    <p>
                      <strong>Where:</strong> {formState.selectedBeach}
                    </p>
                  )}
                  {formState.selectedDate && formState.selectedTime && (
                    <p>
                      <strong>When:</strong> {formState.selectedDate} at{" "}
                      {formState.selectedTime}
                    </p>
                  )}
                  {invitationMessage && (
                    <p>
                      <strong>Message:</strong> "{invitationMessage}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <Users className="w-4 h-4 mt-0.5 mr-2 text-blue-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 mb-1">
              How group sessions work:
            </p>
            <ul className="text-blue-700 space-y-1 text-xs">
              <li>• Friends receive notifications when you save the session</li>
              <li>• They can accept or decline your invitation</li>
              <li>• You'll see who's joining in your session details</li>
              <li>• Everyone can see who else is going</li>
              <li>• Perfect for coordinating dawn patrol sessions!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Invite Templates */}
      {selectedFriends.length === 0 && validEmails.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setInvitationMessage("Dawn patrol tomorrow! Who's in? 🌅🏄‍♂️")
            }
            className="text-xs"
          >
            Dawn Patrol Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setInvitationMessage(
                "Conditions looking epic! Let's get some waves 🤙"
              )
            }
            className="text-xs"
          >
            Epic Conditions Template
          </Button>
        </div>
      )}
    </div>
  );
}
