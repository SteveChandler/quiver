import type { ResolvedSpotPhoto } from "./types";

const MIN_RANKING_VOTES = 5;

export function mergeResolvedSpotPhotos({
  curated,
  community,
  limit,
}: {
  curated: ResolvedSpotPhoto[];
  community: ResolvedSpotPhoto[];
  limit: number;
}): ResolvedSpotPhoto[] {
  const rankedCommunity = [...community].sort((left, right) => {
    const leftCommunity = left.community;
    const rightCommunity = right.community;
    if (!leftCommunity || !rightCommunity) return left.id.localeCompare(right.id);

    if (leftCommunity.isPinned !== rightCommunity.isPinned) {
      return leftCommunity.isPinned ? -1 : 1;
    }
    if (leftCommunity.voteScore !== rightCommunity.voteScore) {
      return rightCommunity.voteScore - leftCommunity.voteScore;
    }
    const leftTotal = leftCommunity.upvotes + leftCommunity.downvotes;
    const rightTotal = rightCommunity.upvotes + rightCommunity.downvotes;
    if (leftTotal !== rightTotal) return rightTotal - leftTotal;
    return left.id.localeCompare(right.id);
  });

  const pinned = rankedCommunity.filter(
    (photo) => photo.community?.isPinned === true,
  );
  const eligible = rankedCommunity.filter((photo) => {
    if (photo.community?.isPinned) return false;
    return (
      (photo.community?.upvotes ?? 0) + (photo.community?.downvotes ?? 0) >=
      MIN_RANKING_VOTES
    );
  });
  const gatheringVotes = rankedCommunity.filter((photo) => {
    if (photo.community?.isPinned) return false;
    return (
      (photo.community?.upvotes ?? 0) + (photo.community?.downvotes ?? 0) <
      MIN_RANKING_VOTES
    );
  });

  return [...pinned, ...eligible, ...curated, ...gatheringVotes].slice(
    0,
    Math.max(0, limit),
  );
}
