"use client";

/**
 * Intel Admin Page
 *
 * Admin interface for managing intel posts.
 * Implements toggle active/inactive and content editing.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { IntelTable } from "@/components/admin/intel-table";
import { IntelEditDialog } from "@/components/admin/intel-edit-dialog";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  listIntelPosts,
  toggleIntelActive,
  updateIntelContent,
  getIntelStats,
  type IntelPostWithDetails,
  type IntelStats,
} from "@/actions/admin/intel";
import type { IntelPostTag } from "@/types/database";
import { MessageSquare, Power, FileText, AlertCircle } from "lucide-react";

export default function AdminIntelPage() {
  // State management
  const [showInactive, setShowInactive] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    intel: IntelPostWithDetails | null;
  }>({
    open: false,
    intel: null,
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch intel posts with useDataFetcher
  const fetchIntelPosts = useCallback(async () => {
    const result = await listIntelPosts({ includeInactive: showInactive });
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch intel posts");
    }
    return result.data || [];
  }, [showInactive]);

  const { data: intelPosts, loading, refetch } = useDataFetcher<IntelPostWithDetails[]>(
    fetchIntelPosts
  );

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const result = await getIntelStats();
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch stats");
    }
    return result.data!;
  }, []);

  const { data: stats } = useDataFetcher<IntelStats>(fetchStats);

  // Handle edit intel post
  const handleEdit = (intel: IntelPostWithDetails) => {
    setEditDialog({
      open: true,
      intel,
    });
  };

  // Handle edit form submission
  const handleEditSubmit = async (data: {
    intelPostId: string;
    title: string;
    description: string;
    tag: IntelPostTag;
  }) => {
    setSubmitting(true);
    try {
      const result = await updateIntelContent(data);
      if (!result.success) {
        toast.error(result.error || "Failed to update intel post");
        return;
      }
      toast.success("Intel post updated successfully");
      refetch();
      setEditDialog({ open: false, intel: null });
    } catch (error) {
      toast.error("Failed to update intel post");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle toggle active status
  const handleToggleActive = (intel: IntelPostWithDetails) => {
    const newStatus = !intel.is_active;
    setConfirmDialog({
      open: true,
      title: newStatus ? "Activate Intel Post" : "Deactivate Intel Post",
      description: newStatus
        ? `Are you sure you want to activate "${intel.title}"? It will be visible to all users.`
        : `Are you sure you want to deactivate "${intel.title}"? It will be hidden from users.`,
      variant: newStatus ? "default" : "destructive",
      action: async () => {
        try {
          const result = await toggleIntelActive({
            intelPostId: intel.id,
            isActive: newStatus,
          });
          if (!result.success) {
            toast.error(result.error || "Failed to update status");
            return;
          }
          toast.success(
            newStatus ? "Intel post activated" : "Intel post deactivated"
          );
          refetch();
        } catch (error) {
          toast.error("Failed to update status");
          console.error(error);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Intel Management"
        description="Manage surf intel posts and community reports"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Intel</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Posts</CardTitle>
              <Power className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Posts</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Tag</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {Object.entries(stats.byTag).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(stats.byTag).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} posts
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showInactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked === true)}
          />
          <Label htmlFor="showInactive" className="cursor-pointer">
            Show inactive posts
          </Label>
        </div>
      </div>

      {/* Intel Table */}
      <IntelTable
        intel={intelPosts || []}
        loading={loading}
        onEdit={handleEdit}
        onToggleActive={handleToggleActive}
      />

      {/* Edit Dialog */}
      <IntelEditDialog
        intel={editDialog.intel}
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, intel: null })}
        onSubmit={handleEditSubmit}
        submitting={submitting}
      />

      {/* Confirmation Dialog */}
      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ ...confirmDialog, open: false });
          }
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionVariant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
      />
    </div>
  );
}
