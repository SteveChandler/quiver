import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ABOUT_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "About | Quiver - Surf Community Platform",
  description:
    "Learn about Quiver's mission to connect surfers worldwide and build the ultimate surf community platform. Discover our story and values.",
  keywords: [
    "about quiver",
    "surf community",
    "company story",
    "mission",
    "surf platform",
  ],
  openGraph: {
    title: "About | Quiver - Surf Community Platform",
    description:
      "Born from a passion for surfing and belief that the best sessions happen with friends. Learn about our mission to connect surfers worldwide.",
    type: "website",
  },
};

export default function AboutPage() {
  const { hero, mission, story, team, future } = ABOUT_CONTENT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              href="/"
              className="text-2xl font-roboto font-bold text-dark-grey"
            >
              Quiver
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/sign-in"
                className="text-dark-grey hover:text-ocean-blue transition-colors"
              >
                Sign In
              </Link>
              <Button asChild className="bg-ocean-blue hover:bg-ocean-blue/90">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6">
            {hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans">
            {hero.subtitle}
          </p>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto font-open-sans">
            {hero.description}
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
              {mission.title}
            </h2>
            <p className="text-xl text-gray-600 mb-8 font-open-sans">
              {mission.subtitle}
            </p>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto font-open-sans">
              {mission.description}
            </p>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mission.values.map((value, index) => (
              <Card
                key={index}
                className="text-center hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className="mx-auto mb-4 w-16 h-16 bg-ocean-blue/10 rounded-full flex items-center justify-center">
                    <value.icon className="h-8 w-8 text-ocean-blue" />
                  </div>
                  <h3 className="text-xl font-roboto font-bold text-dark-grey">
                    {value.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 font-open-sans">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-12 text-center">
            {story.title}
          </h2>
          <div className="space-y-8">
            {story.content.map((paragraph, index) => (
              <p
                key={index}
                className="text-lg text-gray-600 font-open-sans leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
            {team.title}
          </h2>
          <p className="text-lg text-gray-600 font-open-sans leading-relaxed">
            {team.description}
          </p>
        </div>
      </section>

      {/* Future Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
              {future.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto font-open-sans mb-12">
              {future.description}
            </p>
          </div>

          {/* Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {future.goals.map((goal, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-6 bg-white/80 backdrop-blur-sm rounded-lg"
              >
                <div className="w-8 h-8 bg-ocean-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-ocean-blue font-bold text-sm">
                    {index + 1}
                  </span>
                </div>
                <p className="text-gray-700 font-open-sans">{goal}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-white mb-6">
            Ready to Be Part of Our Story?
          </h2>
          <p className="text-xl text-white/90 mb-8 font-open-sans">
            Join thousands of surfers who are already building the future of
            surf community on Quiver.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="/auth/sign-up">
                Join Our Community
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="text-white/80 text-sm mt-4 font-open-sans">
            Free to join • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-grey text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <h3 className="text-2xl font-roboto font-bold mb-4">Quiver</h3>
              <p className="font-open-sans text-gray-300 mb-4 max-w-md">
                The ultimate social platform for surfers. Connect with your
                community, plan sessions, and share the stoke.
              </p>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Product</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-roboto font-semibold mb-4">Company</h4>
              <ul className="space-y-2 font-open-sans text-gray-300">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-white transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-600 pt-8 text-center">
            <p className="font-open-sans text-gray-300 text-sm">
              © 2025 Quiver. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
