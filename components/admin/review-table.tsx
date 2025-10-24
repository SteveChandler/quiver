"use client";

/**
 * Review Table Component
 *
 * Data table for displaying and managing beach reviews in the admin portal.
 * Features search, sorting, filters, star ratings, and action buttons.
 */

import { useState, useMemo } from "react";
import { Eye, Trash2, RotateCcw, Star, ThumbsUp } from "lucide-react";
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

import type { AdminReviewListItem } from "@/actions/admin/reviews";

interface ReviewTableProps {
  reviews: AdminReviewListItem[];
  onViewDetails: (review: AdminReviewListItem) => void;
  onDelete: (review: AdminReviewListItem) => void;
  onRestore: (review: AdminReviewListItem) => void;
  loading?: boolean;
}

export function ReviewTable({
  reviews,
  onViewDetails,
  onDelete,
  onRestore,
  loading = false,
}: ReviewTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof AdminReviewListItem>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    // Guard: ensure reviews is an array
    if (!Array.isArray(reviews)) {
      return [];
    }

    let filtered = reviews.filter((review) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        review.user_email?.toLowerCase().includes(search) ||
        review.user_name?.toLowerCase().includes(search) ||
        review.beach_name?.toLowerCase().includes(search) ||
        review.title.toLowerCase().includes(search) ||
        review.content.toLowerCase().includes(search);

      const matchesRating =
        ratingFilter === "all" ||
        (ratingFilter === "5" && review.overall_rating === 5) ||
        (ratingFilter === "4" && review.overall_rating === 4) ||
        (ratingFilter === "3" && review.overall_rating === 3) ||
        (ratingFilter === "2" && review.overall_rating === 2) ||
        (ratingFilter === "1" && review.overall_rating === 1);

      return matchesSearch && matchesRating;
    });

    // Sort reviews
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
  }, [reviews, searchTerm, ratingFilter, sortField, sortDirection]);

  const handleSort = (field: keyof AdminReviewListItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getRatingBadgeVariant = (rating: number): "default" | "secondary" | "outline" | "destructive" => {
    if (rating >= 4) return "default";
    if (rating >= 3) return "secondary";
    return "destructive";
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by user, beach, title, or content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:max-w-xs"
        />

        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredReviews.length} review{filteredReviews.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("beach_name")}
              >
                Beach
                {sortField === "beach_name" && (sortDirection === "asc" ? " ↑" : " ↓")}
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
                onClick={() => handleSort("overall_rating")}
              >
                Overall Rating
                {sortField === "overall_rating" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead>Categories</TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("helpful_count")}
              >
                Helpful
                {sortField === "helpful_count" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("created_at")}
              >
                Date
                {sortField === "created_at" && (sortDirection === "asc" ? " ↑" : " ↓")}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No reviews found
                </TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((review) => (
                <TableRow key={review.id} className={review.deleted_at ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="font-medium">{review.beach_name || "Unknown Beach"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {review.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{review.user_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{review.user_email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className={`font-semibold ${getRatingColor(review.overall_rating)}`}>
                        {review.overall_rating}/5
                      </div>
                      {renderStars(review.overall_rating)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Wave:</span>
                        <Badge variant={getRatingBadgeVariant(review.wave_quality_rating)} className="h-5 text-xs">
                          {review.wave_quality_rating}/5
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Crowd:</span>
                        <Badge variant={getRatingBadgeVariant(review.crowd_density_rating)} className="h-5 text-xs">
                          {review.crowd_density_rating}/5
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{review.helpful_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {review.created_at
                        ? format(new Date(review.created_at), "MMM d, yyyy")
                        : "—"}
                    </div>
                    {review.visit_date && (
                      <div className="text-xs text-muted-foreground">
                        Visited: {format(new Date(review.visit_date), "MMM d")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(review)}
                        title="View review details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {review.deleted_at ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(review)}
                          title="Restore review"
                        >
                          <RotateCcw className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(review)}
                          title="Delete review"
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
