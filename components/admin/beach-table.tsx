"use client";

/**
 * Beach Table Component
 *
 * Data table for displaying and managing beaches in the admin portal.
 * Features search, sorting, and action buttons for edit/delete/restore.
 */

import { useState, useMemo } from "react";
import { Edit2, Trash2, RotateCcw, MapPin } from "lucide-react";

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

import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface BeachTableProps {
  beaches: Beach[];
  onEdit: (beach: Beach) => void;
  onDelete: (beach: Beach) => void;
  onRestore: (beach: Beach) => void;
  loading?: boolean;
}

export function BeachTable({
  beaches,
  onEdit,
  onDelete,
  onRestore,
  loading = false,
}: BeachTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Beach>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filter and sort beaches
  const filteredBeaches = useMemo(() => {
    let filtered = beaches.filter((beach) => {
      const search = searchTerm.toLowerCase();
      return (
        beach.name.toLowerCase().includes(search) ||
        beach.region?.toLowerCase().includes(search) ||
        getBeachLocation(beach).toLowerCase().includes(search) ||
        beach.country?.toLowerCase().includes(search)
      );
    });

    // Sort beaches
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [beaches, searchTerm, sortField, sortDirection]);

  const handleSort = (field: keyof Beach) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const isDeleted = (beach: Beach) => !!beach.deleted_at;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search beaches by name, region, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="text-sm text-muted-foreground">
          {filteredBeaches.length} of {beaches.length} beaches
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Name
                  {sortField === "name" && (
                    <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("region")}
              >
                <div className="flex items-center gap-2">
                  Region
                  {sortField === "region" && (
                    <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Break Type</TableHead>
              <TableHead>Skill Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading beaches...
                </TableCell>
              </TableRow>
            ) : filteredBeaches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No beaches found matching your search" : "No beaches found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredBeaches.map((beach) => (
                <TableRow
                  key={beach.id}
                  className={isDeleted(beach) ? "bg-muted/30 opacity-60" : ""}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {beach.name}
                      {beach.is_private && (
                        <Badge variant="secondary" className="text-xs">
                          Private
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{beach.region || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {beach.lat && beach.lon && (
                        <MapPin className="h-3 w-3" />
                      )}
                      {getBeachLocation(beach)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {beach.break_type ? (
                      <Badge variant="outline" className="capitalize">
                        {beach.break_type}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {beach.skill_level ? (
                      <Badge variant="outline" className="capitalize">
                        {beach.skill_level}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isDeleted(beach) ? (
                      <Badge variant="destructive">Deleted</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isDeleted(beach) ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(beach)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit beach</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(beach)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete beach</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(beach)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Restore beach</span>
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
