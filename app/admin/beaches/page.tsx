"use client";

/**
 * Beaches Admin Page
 *
 * Admin interface for managing beaches with CRUD operations.
 * Implements soft delete functionality and audit logging.
 */

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BeachTable } from "@/components/admin/beach-table";
import { BeachFormDialog } from "@/components/admin/beach-form-dialog";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  listBeaches,
  createBeach,
  updateBeach,
  softDeleteBeach,
  restoreBeach,
  getBeachForEdit,
} from "@/actions/admin/beaches";
import type { Beach } from "@/types/database";
import type { BeachFormData } from "@/lib/validation/admin/beach-schema";

export default function BeachesAdminPage() {
  // State management
  const [showDeleted, setShowDeleted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBeach, setEditingBeach] = useState<Beach | null>(null);
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

  // Fetch beaches with useDataFetcher
  const fetchBeaches = useCallback(async () => {
    const result = await listBeaches({ includeDeleted: showDeleted });
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch beaches");
    }
    return result.data || [];
  }, [showDeleted]);

  const { data: beaches, loading, refetch } = useDataFetcher<Beach[]>(fetchBeaches);

  // Handle create beach
  const handleCreate = () => {
    setEditingBeach(null);
    setFormOpen(true);
  };

  // Handle edit beach
  const handleEdit = async (beach: Beach) => {
    try {
      // Fetch full beach data for editing
      const result = await getBeachForEdit(beach.id);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to load beach details");
        return;
      }
      setEditingBeach(result.data);
      setFormOpen(true);
    } catch (error) {
      toast.error("Failed to load beach for editing");
      console.error(error);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (data: BeachFormData) => {
    setSubmitting(true);
    try {
      if (editingBeach) {
        // Update existing beach
        const result = await updateBeach(editingBeach.id, data);
        if (!result.success) {
          toast.error(result.error || "Failed to update beach");
          return;
        }
        toast.success("Beach updated successfully");
      } else {
        // Create new beach
        const result = await createBeach(data);
        if (!result.success) {
          toast.error(result.error || "Failed to create beach");
          return;
        }
        toast.success("Beach created successfully");
      }
      setFormOpen(false);
      setEditingBeach(null);
      refetch();
    } catch (error) {
      toast.error(editingBeach ? "Failed to update beach" : "Failed to create beach");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete beach
  const handleDelete = (beach: Beach) => {
    setConfirmDialog({
      open: true,
      title: "Delete Beach",
      description: `Are you sure you want to delete "${beach.name}"? This action can be undone by restoring the beach later. Any associated data (sessions, reviews) will be preserved.`,
      variant: "destructive",
      action: async () => {
        const result = await softDeleteBeach(beach.id);
        if (!result.success) {
          toast.error(result.error || "Failed to delete beach");
          return;
        }
        toast.success(`Beach "${beach.name}" deleted successfully`);
        refetch();
      },
    });
  };

  // Handle restore beach
  const handleRestore = (beach: Beach) => {
    setConfirmDialog({
      open: true,
      title: "Restore Beach",
      description: `Are you sure you want to restore "${beach.name}"? The beach will become active again and visible to users.`,
      variant: "default",
      action: async () => {
        const result = await restoreBeach(beach.id);
        if (!result.success) {
          toast.error(result.error || "Failed to restore beach");
          return;
        }
        toast.success(`Beach "${beach.name}" restored successfully`);
        refetch();
      },
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Beach Management"
        description="Manage beaches across the platform with full CRUD operations"
        action={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Beach
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="show-deleted"
          checked={showDeleted}
          onCheckedChange={(checked) => setShowDeleted(checked === true)}
        />
        <Label
          htmlFor="show-deleted"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show deleted beaches
        </Label>
      </div>

      {/* Beach Table */}
      <BeachTable
        beaches={beaches || []}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      {/* Beach Form Dialog */}
      <BeachFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        beach={editingBeach}
        onSubmit={handleFormSubmit}
        loading={submitting}
      />

      {/* Confirmation Dialog */}
      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
        title={confirmDialog.title}
        description={confirmDialog.description}
        actionLabel={confirmDialog.variant === "destructive" ? "Delete" : "Restore"}
        actionVariant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
      />
    </div>
  );
}
