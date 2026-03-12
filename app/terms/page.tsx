import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TERMS_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review Quiver's Terms of Service. Understand your rights and responsibilities when using our surf forecasting and community platform.",
  alternates: { canonical: "/terms" },
  keywords: [
    "terms of service",
    "user agreement",
    "surf app terms",
    "quiver terms",
    "legal terms",
  ],
  openGraph: {
    title: "Terms of Service",
    description:
      "Review the terms and conditions for using Quiver, the surf community platform.",
    type: "website",
  },
};

export default function TermsPage() {
  const { hero, overview, sections, contact } = TERMS_CONTENT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-dark-grey mb-6">
            {hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-sans">
            {hero.subtitle}
          </p>
          <div className="space-y-2">
            <Badge variant="outline" className="text-sm font-medium">
              Last Updated: {hero.lastUpdated}
            </Badge>
            <p className="text-sm text-gray-500 font-sans">
              {hero.effectiveDate}
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-dark-grey mb-6 text-center">
            {overview.title}
          </h2>
          <p className="text-lg text-gray-600 font-sans leading-relaxed text-center">
            {overview.description}
          </p>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-16">
            {sections.map((section) => (
              <div key={section.id} id={section.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-ocean-blue/10 rounded-full flex items-center justify-center">
                        <section.icon className="h-6 w-6 text-ocean-blue" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark-grey">
                        {section.title}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {section.content.map((item, itemIndex) => (
                        <div key={itemIndex}>
                          <h3 className="text-lg font-heading font-semibold text-dark-grey mb-3">
                            {item.subtitle}
                          </h3>
                          <p className="text-gray-600 font-sans leading-relaxed">
                            {item.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-heading font-bold text-dark-grey mb-8 text-center">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-lg hover:shadow-md transition-shadow duration-300 group"
              >
                <section.icon className="h-5 w-5 text-ocean-blue group-hover:text-ocean-blue/80" />
                <span className="text-dark-grey font-sans group-hover:text-ocean-blue transition-colors">
                  {section.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
            {contact.title}
          </h2>
          <p className="text-xl text-high mb-8 font-sans">
            {contact.description}
          </p>

          <div className="space-y-4 text-high font-sans max-w-2xl mx-auto mb-8">
            {contact.methods.map((method, index) => (
              <div key={index} className="text-center">
                <p>
                  <strong>{method.type}:</strong> {method.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="mailto:legal@quiversurf.com">
                <Mail className="mr-2 h-5 w-5" />
                Contact Legal Team
              </Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
