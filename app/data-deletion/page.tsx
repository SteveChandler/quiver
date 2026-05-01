import { Metadata } from "next";
import Link from "next/link";
import { Mail, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Delete Your Quiver Account & Data",
  description:
    "How to delete your Quiver account and personal data. Step-by-step instructions for in-app deletion and contact for users who cannot access the app.",
  alternates: { canonical: "/data-deletion" },
  robots: { index: true, follow: true },
};

const IN_APP_STEPS = [
  "Open the Quiver app on iOS or Android (or sign in at quiversurf.app on web)",
  "Tap the Profile tab in the bottom navigation",
  "Tap Edit Profile",
  "Scroll to the bottom and tap Delete Account",
  "Confirm the deletion in the modal — your account and personal data are removed immediately",
];

const DELETED_DATA = [
  "Profile (display name, bio, avatar, location, experience level)",
  "Authentication record (email, password hash, OAuth links)",
  "Surf sessions and session photos you uploaded",
  "Comments you left on sessions",
  "Boards in your quiver",
  "Saved beaches and favorite locations",
  "Follow relationships (followers and following)",
  "Push notification tokens and notification preferences",
  "Subscription state and entitlement records (purchase receipts retained per Apple/Google policy)",
];

const RETAINED_DATA = [
  "Aggregated, anonymized usage analytics (no personal identifiers, used for product improvement)",
  "Crash and error logs in Sentry (anonymized within 30 days)",
  "Financial transaction records required by tax law (retained up to 7 years; not linkable to a usable identity)",
  "Public surf forecast and beach data (not personal — these are environmental measurements)",
];

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-dark-grey mb-6">
            Delete Your Quiver Account & Data
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-sans">
            You own your data. Here&apos;s exactly how to delete it.
          </p>
          <div className="space-y-2">
            <Badge variant="outline" className="text-sm font-medium">
              Last Updated: April 30, 2026
            </Badge>
            <p className="text-sm text-gray-500 font-sans">
              Applies to the Quiver mobile app (iOS &amp; Android) and quiversurf.app
            </p>
          </div>
        </div>
      </section>

      {/* In-App Steps */}
      <section className="py-12 px-4 bg-white/60">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <h2 className="text-3xl font-heading font-bold text-dark-grey">
                Delete from inside the app (recommended)
              </h2>
              <p className="text-gray-600 mt-2 font-sans">
                The fastest way. Takes under 30 seconds.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {IN_APP_STEPS.map((step, idx) => (
                  <li key={idx} className="flex gap-4 items-start">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-ocean-blue text-white font-heading font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-lg text-gray-700 font-sans pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Email Fallback */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm border-l-4 border-amber-400">
            <CardHeader>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-heading font-bold text-dark-grey">
                    Can&apos;t access the app?
                  </h2>
                  <p className="text-gray-600 mt-2 font-sans">
                    If you&apos;ve lost device access, forgot your password, or otherwise can&apos;t
                    sign in, email us and we&apos;ll process the deletion manually within 7 days.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-6 py-3 font-heading font-semibold rounded-full"
                asChild
              >
                <Link href="mailto:privacy@quiversurf.app?subject=Account%20deletion%20request">
                  <Mail className="mr-2 h-5 w-5" />
                  privacy@quiversurf.app
                </Link>
              </Button>
              <p className="text-sm text-gray-500 mt-4 font-sans">
                Include the email you signed up with so we can locate your account. We&apos;ll
                confirm deletion when complete.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What Gets Deleted */}
      <section className="py-12 px-4 bg-white/60">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          <Card className="bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <h2 className="text-2xl font-heading font-bold text-dark-grey">
                  Data we delete
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 font-sans">Removed immediately</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {DELETED_DATA.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-700 font-sans">
                    <span className="text-emerald-600 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
                <h2 className="text-2xl font-heading font-bold text-dark-grey">
                  Data we retain
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 font-sans">
                Anonymized or required by law
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {RETAINED_DATA.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-700 font-sans">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Timing & Reversal */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <h2 className="text-2xl font-heading font-bold text-dark-grey">
                Timing &amp; reversal
              </h2>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700 font-sans">
              <p>
                <strong>In-app deletion:</strong> immediate. The auth record and all linked
                personal data are removed from our database the moment you confirm.
              </p>
              <p>
                <strong>Email-requested deletion:</strong> processed within 7 calendar days.
                We may verify your identity by replying to the email address on file before
                we delete.
              </p>
              <p>
                <strong>Backups:</strong> any deleted data persists in encrypted backups for
                up to 30 days, after which it is permanently overwritten.
              </p>
              <p>
                <strong>Reversal:</strong> account deletion is permanent. We do not maintain
                a recovery window. If you&apos;d like to take a break instead, you can sign
                out and your data will remain unchanged.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer link */}
      <section className="py-12 px-4 text-center">
        <p className="text-gray-600 font-sans">
          Questions about your data?{" "}
          <Link href="/privacy" className="text-ocean-blue hover:underline">
            Read the full Privacy Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
