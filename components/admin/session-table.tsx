"use client";

/**
 * Session Table Component
 *
 * Data table for displaying and managing sessions in the admin portal.
 * Features search, sorting, filters, and action buttons for delete/restore.
 */

import { useState, useMemo } from "react";
import { Eye, Trash2, RotateCcw, CalendarDays, Heart, MessageCircle } from "lucide-react";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AdminSessionListItem } from "@/actions/admin/sessions";

interface SessionTableProps {
  sessions: AdminSessionListItem[];
  onViewDetails: (session: AdminSessionListItem) => void;
  onDelete: (session: AdminSessionListItem) => void;
  onRestore: (session: AdminSessionListItem) => void;
  loading?: boolean;
}

export function SessionTable({
  sessions,
  onViewDetails,
  onDelete,
  onRestore,
  loading = false,
}: SessionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof AdminSessionListItem>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    // Guard: ensure sessions is an array
    if (!Array.isArray(sessions)) {
      return [];
    }

    let filtered = sessions.filter((session) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        session.user_email?.toLowerCase().includes(search) ||
        session.user_name?.toLowerCase().includes(search) ||
        session.beach_name?.toLowerCase().includes(search) ||
        session.description?.toLowerCase().includes(search);

      const matchesStatus = statusFilter === "all" || session.status === statusFilter;

      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "public" && session.is_public) ||
        (visibilityFilter === "private" && !session.is_public);

      return matchesSearch && matchesStatus && matchesVisibility;
    });

    // Sort sessions
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return filtered;
  }, [sessions, searchTerm, statusFilter, visibilityFilter, sortField, sortDirection]);

  const handleSort = (field: keyof AdminSessionListItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "logged":
        return "default";
      case "planned":
        return "secondary";
      case "cancelled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return "text-gray-400";
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by user, beach, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:max-w-xs"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="logged">Logged</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visibility</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("arrival_time")}
              >
                Date
                {sortField === "arrival_time" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("user_email")}
              >
                User
                {sortField === "user_email" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("beach_name")}
              >
                Beach
                {sortField === "beach_name" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("rating")}
              >
                Rating
                {sortField === "rating" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No sessions found
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow key={session.id} className={session.deleted_at ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(session.arrival_time), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(session.arrival_time), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{session.user_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{session.user_email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{session.beach_name || "Unknown Beach"}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.duration_minutes} min
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={getStatusBadgeVariant(session.status)}>
                        {session.status || "unknown"}
                      </Badge>
                      {session.is_public ? (
                        <Badge variant="outline" className="w-fit text-xs">
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit text-xs">
                          Private
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-semibold ${getRatingColor(session.rating)}`}>
                      {session.rating ? `${session.rating}/5 ★` : "—"}
                    </div>
                    {session.wave_quality && (
                      <div className="text-xs text-muted-foreground">
                        Wave: {session.wave_quality}/5
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="h-3 w-3" />
                        {session.likes_count}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        {session.comments_count}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(session)}
                        title="View session details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {session.deleted_at ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(session)}
                          title="Restore session"
                        >
                          <RotateCcw className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(session)}
                          title="Delete session"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
