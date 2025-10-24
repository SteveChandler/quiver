"use client";

/**
 * Intel Table Component
 *
 * Displays intel posts in a searchable, sortable table.
 * Supports filtering by active status and real-time search.
 */

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Edit,
  Power,
  PowerOff,
  MapPin,
  User,
  Calendar,
  Eye,
  MessageSquare,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { IntelPostWithDetails } from "@/actions/admin/intel";
import type { IntelPostTag } from "@/types/database";

interface IntelTableProps {
  intel: IntelPostWithDetails[];
  onEdit: (intel: IntelPostWithDetails) => void;
  onToggleActive: (intel: IntelPostWithDetails) => void;
  loading?: boolean;
}

const INTEL_TAG_LABELS: Record<IntelPostTag, string> = {
  parking: "Parking",
  hazard: "Hazard",
  crowd: "Crowd",
  conditions: "Conditions",
  access: "Access",
  other: "Other",
};

const INTEL_TAG_COLORS: Record<IntelPostTag, string> = {
  parking: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hazard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  crowd: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  conditions: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  access: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function IntelTable({
  intel,
  onEdit,
  onToggleActive,
  loading = false,
}: IntelTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<
    "created_at" | "title" | "tag" | "beach"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filter and sort intel posts
  const filteredIntel = useMemo(() => {
    let filtered = intel;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query) ||
          post.beach?.name.toLowerCase().includes(query) ||
          post.user?.full_name?.toLowerCase().includes(query) ||
          post.tag.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      switch (sortColumn) {
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "tag":
          aValue = a.tag.toLowerCase();
          bValue = b.tag.toLowerCase();
          break;
        case "beach":
          aValue = a.beach?.name.toLowerCase() || "";
          bValue = b.beach?.name.toLowerCase() || "";
          break;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [intel, searchQuery, sortColumn, sortDirection]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Search intel posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleSort("tag")}
              >
                Tag {sortColumn === "tag" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleSort("title")}
              >
                Title {sortColumn === "title" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleSort("beach")}
              >
                Beach {sortColumn === "beach" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Confirmations</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleSort("created_at")}
              >
                Created{" "}
                {sortColumn === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading intel posts...
                </TableCell>
              </TableRow>
            ) : filteredIntel.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No intel posts match your search"
                    : "No intel posts found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredIntel.map((post) => (
                <TableRow key={post.id}>
                  {/* Status */}
                  <TableCell>
                    {post.is_active ? (
                      <Badge variant="outline" className="bg-green-50 border-green-200">
                        <Power className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 border-gray-200">
                        <PowerOff className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>

                  {/* Tag */}
                  <TableCell>
                    <Badge className={INTEL_TAG_COLORS[post.tag]}>
                      {INTEL_TAG_LABELS[post.tag]}
                    </Badge>
                  </TableCell>

                  {/* Title */}
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {post.title}
                  </TableCell>

                  {/* Description */}
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {post.description}
                    </p>
                  </TableCell>

                  {/* Beach */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">
                        {post.beach?.name || "Unknown"}
                      </span>
                    </div>
                    {post.beach?.region && (
                      <p className="text-xs text-muted-foreground">{post.beach.region}</p>
                    )}
                  </TableCell>

                  {/* Author */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">
                        {post.user?.full_name || "Anonymous"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Confirmations */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      {post.confirmations_count}
                    </div>
                  </TableCell>

                  {/* Created */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.created_at)}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(post)}
                        title="Edit intel post"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleActive(post)}
                        title={post.is_active ? "Deactivate" : "Activate"}
                      >
                        {post.is_active ? (
                          <PowerOff className="w-4 h-4 text-red-600" />
                        ) : (
                          <Power className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredIntel.length} of {intel.length} intel posts
        </p>
      )}
    </div>
  );
}
