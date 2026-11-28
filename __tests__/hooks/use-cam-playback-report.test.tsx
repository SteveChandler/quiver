import { render } from "@testing-library/react";
import { useRef } from "react";

import { useCamPlaybackReport } from "@/hooks/use-cam-playback-report";
import { subscribeCamPlayback } from "@/lib/app-store/cam-install-sheet";

function Player(): React.ReactElement {
  const ref = useRef<HTMLVideoElement>(null);
  useCamPlaybackReport(ref);
  return <video ref={ref} data-testid="cam" />;
}

function setVideoState(video: HTMLVideoElement, state: { currentTime: number; paused: boolean }): void {
  Object.defineProperty(video, "currentTime", { configurable: true, value: state.currentTime });
  Object.defineProperty(video, "paused", { configurable: true, value: state.paused });
  Object.defineProperty(video, "seeking", { configurable: true, value: false });
  Object.defineProperty(video, "ended", { configurable: true, value: false });
}

function tick(video: HTMLVideoElement, currentTime: number, paused = false): void {
  setVideoState(video, { currentTime, paused });
  video.dispatchEvent(new Event("timeupdate"));
}

describe("useCamPlaybackReport", () => {
  it("adds up actual playback from timeupdate, not wall time", () => {
    const deltas: number[] = [];
    const unsubscribe = subscribeCamPlayback((delta) => deltas.push(delta));
    const { getByTestId } = render(<Player />);
    const video = getByTestId("cam") as HTMLVideoElement;

    tick(video, 100);
    tick(video, 100.25);
    tick(video, 100.5);
    // Paused: the clock does not move and nothing counts.
    tick(video, 100.5, true);
    video.dispatchEvent(new Event("pause"));
    // A resume after pause starts a fresh baseline.
    tick(video, 130);
    tick(video, 130.25);
    // A live-edge jump is not watching.
    tick(video, 160);

    unsubscribe();
    expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBeCloseTo(0.75);
  });

  it("reports nothing for a cam that errors or never plays", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCamPlayback(listener);
    const { getByTestId } = render(<Player />);
    const video = getByTestId("cam") as HTMLVideoElement;

    video.dispatchEvent(new Event("error"));
    tick(video, 0, true);

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });
});
