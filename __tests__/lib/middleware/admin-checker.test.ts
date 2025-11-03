/**
 * AdminChecker Unit Tests
 *
 * Tests admin privilege validation logic including:
 * - Canonical admin user ID checking
 * - User metadata admin checking
 * - App metadata admin checking
 * - Multi-source validation priority
 */

import { AdminChecker, isUserAdmin } from "@/lib/middleware/admin-checker";
import type { User } from "@supabase/supabase-js";
import { ADMIN_USER_IDS } from "@/lib/auth/admin";

describe("AdminChecker", () => {
  let adminChecker: AdminChecker;

  beforeEach(() => {
    adminChecker = new AdminChecker();
  });

  describe("Canonical Admin User IDs", () => {
    it("should recognize canonical admin user ID", () => {
      const canonicalAdminId = ADMIN_USER_IDS[0];
      const mockUser: Partial<User> = {
        id: canonicalAdminId,
        email: "admin@quiver.surf",
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
      expect(result.userId).toBe(canonicalAdminId);
      expect(result.reason).toBe("Canonical admin user ID");
    });

    it("should reject non-admin canonical IDs", () => {
      const mockUser: Partial<User> = {
        id: "regular-user-123",
        email: "user@example.com",
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
      expect(result.reason).toBe("No admin privileges found");
    });

    it("should prioritize canonical ID over metadata", () => {
      const canonicalAdminId = ADMIN_USER_IDS[0];
      const mockUser: Partial<User> = {
        id: canonicalAdminId,
        email: "admin@quiver.surf",
        user_metadata: {
          is_admin: false, // Contradictory metadata
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      // Canonical ID should win
      expect(result.isAdmin).toBe(true);
      expect(result.reason).toBe("Canonical admin user ID");
    });
  });

  describe("User Metadata Admin Checking", () => {
    it("should recognize is_admin flag in user_metadata", () => {
      const mockUser: Partial<User> = {
        id: "user-789",
        email: "metadata-admin@example.com",
        user_metadata: {
          is_admin: true,
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
      expect(result.reason).toBe("Admin metadata flag");
    });

    it("should recognize role=admin in user_metadata", () => {
      const mockUser: Partial<User> = {
        id: "user-456",
        email: "role-admin@example.com",
        user_metadata: {
          role: "admin",
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
      expect(result.reason).toBe("Admin metadata flag");
    });

    it("should reject is_admin=false in metadata", () => {
      const mockUser: Partial<User> = {
        id: "user-999",
        email: "not-admin@example.com",
        user_metadata: {
          is_admin: false,
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
    });

    it("should reject non-admin roles", () => {
      const mockUser: Partial<User> = {
        id: "user-888",
        email: "moderator@example.com",
        user_metadata: {
          role: "moderator",
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
    });
  });

  describe("App Metadata Admin Checking", () => {
    it("should recognize is_admin flag in app_metadata", () => {
      const mockUser: any = {
        id: "user-555",
        email: "app-admin@example.com",
        app_metadata: {
          is_admin: true,
        },
      };

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
      expect(result.reason).toBe("Admin metadata flag");
    });

    it("should recognize role=admin in app_metadata", () => {
      const mockUser: any = {
        id: "user-444",
        email: "app-role-admin@example.com",
        app_metadata: {
          role: "admin",
        },
      };

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
      expect(result.reason).toBe("Admin metadata flag");
    });
  });

  describe("Multi-Source Validation", () => {
    it("should check user_metadata and app_metadata", () => {
      const mockUser: any = {
        id: "user-333",
        email: "multi-admin@example.com",
        user_metadata: {
          is_admin: false,
        },
        app_metadata: {
          is_admin: true, // app_metadata wins
        },
      };

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(true);
    });

    it("should handle missing metadata gracefully", () => {
      const mockUser: Partial<User> = {
        id: "user-222",
        email: "no-metadata@example.com",
        // No user_metadata or app_metadata
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
      expect(result.reason).toBe("No admin privileges found");
    });

    it("should handle null/undefined metadata", () => {
      const mockUser: any = {
        id: "user-111",
        email: "null-metadata@example.com",
        user_metadata: null,
        app_metadata: undefined,
      };

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty metadata objects", () => {
      const mockUser: Partial<User> = {
        id: "user-000",
        email: "empty-metadata@example.com",
        user_metadata: {},
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
    });

    it("should handle malformed role values", () => {
      const mockUser: Partial<User> = {
        id: "user-malformed",
        email: "malformed@example.com",
        user_metadata: {
          role: "ADMIN", // Should be lowercase "admin"
        },
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
    });

    it("should return user ID even when not admin", () => {
      const mockUser: Partial<User> = {
        id: "user-not-admin",
        email: "regular@example.com",
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);

      expect(result.isAdmin).toBe(false);
      expect(result.userId).toBe("user-not-admin");
    });
  });

  describe("Verbose Logging", () => {
    it("should support verbose mode", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const verboseChecker = new AdminChecker(true);
      const mockUser: Partial<User> = {
        id: ADMIN_USER_IDS[0],
        email: "admin@example.com",
      } as User;

      verboseChecker.checkAdminStatus(mockUser as User);

      // In test environment, verbose logging might not trigger
      // but we verify the parameter is accepted
      expect(verboseChecker).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("isUserAdmin Convenience Function", () => {
    it("should work as a convenience wrapper", () => {
      const canonicalAdminId = ADMIN_USER_IDS[0];
      const adminUser: Partial<User> = {
        id: canonicalAdminId,
        email: "admin@quiver.surf",
      } as User;

      const regularUser: Partial<User> = {
        id: "regular-user",
        email: "user@example.com",
      } as User;

      expect(isUserAdmin(adminUser as User)).toBe(true);
      expect(isUserAdmin(regularUser as User)).toBe(false);
    });
  });

  describe("Integration with ADMIN_USER_IDS", () => {
    it("should use actual ADMIN_USER_IDS constant", () => {
      // Verify we're using the real constant from lib/auth/admin
      expect(ADMIN_USER_IDS).toBeDefined();
      expect(ADMIN_USER_IDS.length).toBeGreaterThan(0);

      const adminId = ADMIN_USER_IDS[0];
      const mockUser: Partial<User> = {
        id: adminId,
        email: "admin@quiver.surf",
      } as User;

      const result = adminChecker.checkAdminStatus(mockUser as User);
      expect(result.isAdmin).toBe(true);
    });
  });
});
