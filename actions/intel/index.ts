// Barrel re-exports for backward compatibility
// Allows: import { createIntelPost } from "@/actions/intel"
// All types and functions that were previously exported from intel-actions.ts



export { createIntelPost } from "./intel-create-actions";

export {
  getNearbyIntelPosts,
  getPublicIntelPosts,

} from "./intel-query-actions";

export {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "./intel-confirm-actions";
