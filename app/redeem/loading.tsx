import type { ReactElement } from "react";

import { RedeemView, type RedeemViewState } from "./redeem-view";

const LOADING_STATE: RedeemViewState = { kind: "loading" };

export default function Loading(): ReactElement {
  return <RedeemView platform="desktop" state={LOADING_STATE} />;
}
