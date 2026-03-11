import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ActivityFeed } from "@/components/oracle/activity-feed";
import type { ActivityItem } from "@/components/oracle/activity-feed";

const SESSION_ITEM: ActivityItem = {
  id: "s1",
  userName: "Alex",
  action: "logged a session",
  timeAgo: "2h ago",
  initial: "A",
  type: "session",
};

const INTEL_ITEM: ActivityItem = {
  id: "i1",
  userName: "Jordan",
  action: "posted intel",
  timeAgo: "30m ago",
  initial: "J",
  type: "intel",
};

describe("ActivityFeed", () => {
  describe("section title", () => {
    it("renders the 'Activity' heading", () => {
      render(<ActivityFeed items={[]} />);
      expect(screen.getByRole("heading", { name: /activity/i })).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders the empty state message when items array is empty", () => {
      render(<ActivityFeed items={[]} />);
      expect(screen.getByText(/no local activity yet/i)).toBeInTheDocument();
    });

    it("does not render any activity rows in empty state", () => {
      render(<ActivityFeed items={[]} />);
      expect(screen.queryByText(/logged a session/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/posted intel/i)).not.toBeInTheDocument();
    });
  });

  describe("with items", () => {
    it("renders all provided items", () => {
      render(<ActivityFeed items={[SESSION_ITEM, INTEL_ITEM]} />);
      expect(screen.getByText("Alex")).toBeInTheDocument();
      expect(screen.getByText("Jordan")).toBeInTheDocument();
    });

    it("renders the action text for each item", () => {
      render(<ActivityFeed items={[SESSION_ITEM, INTEL_ITEM]} />);
      expect(screen.getByText(/logged a session/i)).toBeInTheDocument();
      expect(screen.getByText(/posted intel/i)).toBeInTheDocument();
    });

    it("renders the timeAgo text for each item", () => {
      render(<ActivityFeed items={[SESSION_ITEM, INTEL_ITEM]} />);
      expect(screen.getByText("2h ago")).toBeInTheDocument();
      expect(screen.getByText("30m ago")).toBeInTheDocument();
    });

    it("renders avatar initials for each item", () => {
      render(<ActivityFeed items={[SESSION_ITEM, INTEL_ITEM]} />);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("J")).toBeInTheDocument();
    });

    it("does not render the empty state message when items are present", () => {
      render(<ActivityFeed items={[SESSION_ITEM]} />);
      expect(screen.queryByText(/no local activity yet/i)).not.toBeInTheDocument();
    });
  });
});
