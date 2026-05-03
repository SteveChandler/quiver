import { render } from "@testing-library/react";
import {
  ForecastDigestEmail,
  ForecastDigestEmailProps,
} from "@/lib/mailer/templates/ForecastDigestEmail";

describe("Email Templates", () => {
  describe("ForecastDigestEmail", () => {
    const baseMockProps: ForecastDigestEmailProps = {
      displayName: "Alex",
      beachName: "Ocean Beach",
      beachSlug: "ocean-beach",
      forecastDate: "Monday, January 6",
      matchQuality: "excellent",
      waveHeight: "3-5ft",
      wavePeriod: "12s",
      windSpeed: "5mph",
      windDirection: "NE (offshore)",
      tideStatus: "Low, incoming",
      whyText: [
        "Wave height matches your 3-6ft preference",
        "Offshore wind creates clean faces",
        "Low tide incoming, your preferred tide direction",
      ],
      crowdWarning: null,
      bestWindow: {
        startTime: "8:30 AM",
        endTime: "9:30 AM",
      },
      ctaUrl: "https://quiversurf.app/beaches/ocean-beach",
      unsubscribeUrl: "https://quiversurf.app/settings/notifications",
    };

    describe("Component Rendering", () => {
      it("should render with all props provided", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container).toBeInTheDocument();
      });

      it("should display the correct greeting with displayName", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Hey Alex,");
      });

      it("should display generic greeting when displayName is null", () => {
        const props = { ...baseMockProps, displayName: null };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("Hey there,");
      });

      it("should display the forecast date in header", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Monday, January 6");
      });

      it("should display the beach name", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Ocean Beach");
      });
    });

    describe("Match Quality Indicators", () => {
      it("should display perfect match emoji and title", () => {
        const props = { ...baseMockProps, matchQuality: "perfect" as const };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("🔥");
        expect(container.textContent).toContain("Perfect Conditions");
      });

      it("should display excellent match emoji and title", () => {
        const props = { ...baseMockProps, matchQuality: "excellent" as const };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("✨");
        expect(container.textContent).toContain("Excellent Conditions");
      });

      it("should display good match emoji and title", () => {
        const props = { ...baseMockProps, matchQuality: "good" as const };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("👍");
        expect(container.textContent).toContain("Good Conditions");
      });

      it("should display fair match emoji and title", () => {
        const props = { ...baseMockProps, matchQuality: "fair" as const };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("🌊");
        expect(container.textContent).toContain("Fair Conditions");
      });
    });

    describe("Forecast Data Display", () => {
      it("should display wave information", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Waves");
        expect(container.textContent).toContain("3-5ft @ 12s");
      });

      it("should display wind information", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Wind");
        expect(container.textContent).toContain("5mph NE (offshore)");
      });

      it("should display tide information", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Tide");
        expect(container.textContent).toContain("Low, incoming");
      });

      it("should display best window when provided", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain("Best Window");
        expect(container.textContent).toContain("8:30 AM - 9:30 AM");
      });

      it("should not display best window when null", () => {
        const props = { ...baseMockProps, bestWindow: null };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).not.toContain("Best Window");
      });
    });

    describe("Personalization Section", () => {
      it("should display all why text reasons", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).toContain(
          "Why This Matches Your Playbook"
        );
        expect(container.textContent).toContain(
          "Wave height matches your 3-6ft preference"
        );
        expect(container.textContent).toContain(
          "Offshore wind creates clean faces"
        );
        expect(container.textContent).toContain(
          "Low tide incoming, your preferred tide direction"
        );
      });

      it("should render empty reasons list when whyText is empty", () => {
        const props = { ...baseMockProps, whyText: [] };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain(
          "Why This Matches Your Playbook"
        );
        // List should still exist, just empty
        const ul = container.querySelector("ul");
        expect(ul).toBeInTheDocument();
        expect(ul?.children.length).toBe(0);
      });

      it("should handle single reason", () => {
        const props = {
          ...baseMockProps,
          whyText: ["Perfect offshore wind"],
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("Perfect offshore wind");
      });
    });

    describe("Crowd Warning", () => {
      it("should display crowd warning when provided", () => {
        const props = {
          ...baseMockProps,
          crowdWarning: "Recent reports indicate heavy crowds this morning",
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("⚠️ Heads up:");
        expect(container.textContent).toContain(
          "Recent reports indicate heavy crowds this morning"
        );
      });

      it("should not display crowd warning when null", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        expect(container.textContent).not.toContain("⚠️ Heads up:");
      });

      it("should not display crowd warning when empty string", () => {
        const props = { ...baseMockProps, crowdWarning: "" };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).not.toContain("⚠️ Heads up:");
      });
    });

    describe("Call-to-Action", () => {
      it("should include CTA link with correct URL", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const ctaLink = Array.from(container.querySelectorAll("a")).find(
          (link) => link.href === "https://quiversurf.app/beaches/ocean-beach"
        );
        expect(ctaLink).toBeInTheDocument();
        expect(ctaLink?.textContent).toContain("Check Full Forecast");
      });

      it("should include unsubscribe link", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const unsubLink = Array.from(container.querySelectorAll("a")).find(
          (link) =>
            link.href === "https://quiversurf.app/settings/notifications"
        );
        expect(unsubLink).toBeInTheDocument();
        expect(unsubLink?.textContent).toContain("Unsubscribe");
      });
    });

    describe("HTML Structure for Email Clients", () => {
      it("should use inline styles for compatibility", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const rootDiv = container.firstChild as HTMLElement;
        expect(rootDiv.style.fontFamily).toContain("Arial");
        expect(rootDiv.style.lineHeight).toBe("1.6");
      });

      it("should use table for forecast data layout", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const table = container.querySelector("table");
        expect(table).toBeInTheDocument();
        expect(table?.style.borderCollapse).toBe("collapse");
      });

      it("should have proper header section styling", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const header = Array.from(container.querySelectorAll("div")).find(
          (div) => div.style.backgroundColor === "rgb(0, 102, 204)"
        );
        expect(header).toBeInTheDocument();
      });

      it("should use max-width for email client compatibility", () => {
        const { container } = render(<ForecastDigestEmail {...baseMockProps} />);
        const rootDiv = container.firstChild as HTMLElement;
        expect(rootDiv.style.maxWidth).toBe("600px");
      });
    });

    describe("Edge Cases", () => {
      it("should handle very long beach names", () => {
        const props = {
          ...baseMockProps,
          beachName:
            "Super Long Beach Name That Might Cause Layout Issues in Email Clients",
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain(
          "Super Long Beach Name That Might Cause Layout Issues in Email Clients"
        );
      });

      it("should handle special characters in text fields", () => {
        const props = {
          ...baseMockProps,
          beachName: "Côte d'Azur & Beach's Point",
          displayName: "François",
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain("François");
        expect(container.textContent).toContain("Côte d'Azur & Beach's Point");
      });

      it("should handle very long why text reasons", () => {
        const props = {
          ...baseMockProps,
          whyText: [
            "This is an extremely long reason that explains in great detail why the conditions match your preferences and includes multiple clauses and descriptive elements",
          ],
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container.textContent).toContain(
          "This is an extremely long reason"
        );
      });

      it("should handle many why text reasons", () => {
        const props = {
          ...baseMockProps,
          whyText: [
            "Reason 1",
            "Reason 2",
            "Reason 3",
            "Reason 4",
            "Reason 5",
            "Reason 6",
          ],
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        const listItems = container.querySelectorAll("ul li");
        expect(listItems.length).toBe(6);
      });
    });

    describe("Snapshot Tests", () => {
      it("should match snapshot for perfect conditions", () => {
        const props = {
          ...baseMockProps,
          matchQuality: "perfect" as const,
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container).toMatchSnapshot();
      });

      it("should match snapshot for excellent conditions with crowd warning", () => {
        const props = {
          ...baseMockProps,
          matchQuality: "excellent" as const,
          crowdWarning: "Heavy crowds expected",
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container).toMatchSnapshot();
      });

      it("should match snapshot without best window", () => {
        const props = {
          ...baseMockProps,
          bestWindow: null,
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container).toMatchSnapshot();
      });

      it("should match snapshot with minimal data", () => {
        const props = {
          ...baseMockProps,
          displayName: null,
          crowdWarning: null,
          bestWindow: null,
          whyText: ["Conditions match your preferences"],
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container).toMatchSnapshot();
      });

      it("should match snapshot for fair conditions", () => {
        const props = {
          ...baseMockProps,
          matchQuality: "fair" as const,
          whyText: ["Marginal conditions but surfable"],
        };
        const { container } = render(<ForecastDigestEmail {...props} />);
        expect(container).toMatchSnapshot();
      });
    });
  });

});
