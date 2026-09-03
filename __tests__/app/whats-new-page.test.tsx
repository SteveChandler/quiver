import { render, screen, within } from "@testing-library/react";

import WhatsNewPage from "@/app/whats-new/page";
import {
  getAllReleases,
  getLatestRelease,
  getPreviousReleases,
} from "@/lib/data/whats-new";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// jsdom has no HTMLMediaElement.play; render the recording as a plain <video>.
jest.mock("@/components/landing-page/field-guide/autoplay-video", () => ({
  AutoplayVideo: ({
    src,
    poster,
    ariaLabel,
  }: {
    src: string;
    poster?: string;
    ariaLabel: string;
  }) => <video src={src} poster={poster} aria-label={ariaLabel} />,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, ...props }: any) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

describe("what's new data", () => {
  it("orders releases newest first", () => {
    const dates = getAllReleases().map((release) => release.date);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : -1));

    expect(dates).toEqual(sorted);
    expect(getLatestRelease().date).toBe(sorted[0]);
  });

  it("splits the latest release from the previous ones", () => {
    const latest = getLatestRelease();
    const previous = getPreviousReleases();

    expect(previous).not.toContainEqual(latest);
    expect(previous).toHaveLength(getAllReleases().length - 1);
  });

  it("keeps slugs and section ids unique", () => {
    const releases = getAllReleases();
    const slugs = releases.map((release) => release.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const release of releases) {
      const ids = release.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never claims AI or ML forecasting and never says 'the call'", () => {
    const text = JSON.stringify(getAllReleases()).toLowerCase();

    expect(text).not.toMatch(/\bthe call\b/);
    expect(text).not.toMatch(/machine learning|\bml\b|\bai\b/);
  });
});

describe("what's new page", () => {
  it("renders the latest release in full and previous releases as a list", () => {
    const latest = getLatestRelease();
    const previous = getPreviousReleases();

    render(<WhatsNewPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /what's new/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: latest.title }),
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: /jump to/i });
    for (const section of latest.sections) {
      expect(
        within(nav).getByRole("link", { name: section.label }),
      ).toHaveAttribute("href", `#${section.id}`);
      expect(document.getElementById(section.id)).not.toBeNull();
    }

    const previousList = screen.getByTestId("whats-new-previous");
    for (const release of previous) {
      expect(within(previousList).getByText(release.title)).toBeInTheDocument();
    }
  });

  it("shows an app preview screenshot on sections that declare one", () => {
    const latest = getLatestRelease();
    const withPreview = latest.sections.filter((section) => section.preview);
    expect(withPreview.length).toBeGreaterThan(0);

    render(<WhatsNewPage />);

    for (const section of withPreview) {
      const image = screen.getByAltText(section.preview!.alt);
      expect(image).toHaveAttribute("src", section.preview!.src);
      expect(
        document.getElementById(section.id)?.contains(image),
      ).toBe(true);
    }
  });

  it("plays the screen recording over its poster where a section has one", () => {
    const latest = getLatestRelease();
    const withVideo = latest.sections.filter((section) => section.preview?.video);
    expect(withVideo.length).toBeGreaterThan(0);

    render(<WhatsNewPage />);

    for (const section of withVideo) {
      const video = screen.getByLabelText(section.preview!.alt);
      expect(video).toHaveAttribute("src", section.preview!.video);
      expect(video).toHaveAttribute("poster", section.preview!.src);
    }
  });
});
