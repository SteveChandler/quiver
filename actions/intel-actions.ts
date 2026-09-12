// Backward-compatibility shim — all logic has moved to actions/intel/
// This file re-exports everything so existing imports still resolve.
export {
  createIntelPost,
  getNearbyIntelPosts,
  getPublicIntelPosts,

  confirmIntelPost,
  removeIntelPostConfirmation,






} from "./intel";
