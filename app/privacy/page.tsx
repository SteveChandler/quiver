import { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRIVACY_CONTENT } from "@/lib/constants/content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Quiver protects your privacy and handles your personal data. Our comprehensive privacy policy explains our data practices in clear terms.",
  alternates: { canonical: "/privacy" },
  keywords: [
    "privacy policy",
    "data protection",
    "personal data",
    "surf app privacy",
    "user data",
  ],
  openGraph: {
    title: "Privacy Policy",
    description:
      "Transparent privacy practices for the surf community. Learn how we protect and handle your personal information.",
    type: "website",
  },
};

export default function PrivacyPage() {
  const {
    hero,
    overview,
    importantInfo,
    dataCategories,
    accessibility,
    sections,
    annexes,
    contact,
  } = PRIVACY_CONTENT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-roboto font-bold text-dark-grey mb-6">
            {hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-open-sans">
            {hero.subtitle}
          </p>
          <div className="space-y-2">
            <Badge variant="outline" className="text-sm font-medium">
              Last Updated: {hero.lastUpdated}
            </Badge>
            <p className="text-sm text-gray-500 font-open-sans">
              {hero.effectiveDate}
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-roboto font-bold text-dark-grey mb-6 text-center">
            {overview.title}
          </h2>
          <p className="text-lg text-gray-600 font-open-sans leading-relaxed text-center">
            {overview.description}
          </p>
        </div>
      </section>

      {/* Important Information */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <h2 className="text-3xl font-roboto font-bold text-dark-grey mb-4">
                {importantInfo.title}
              </h2>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                  Purpose of this Privacy Policy
                </h3>
                <p className="text-gray-600 font-open-sans leading-relaxed">
                  {importantInfo.purpose}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                  Children’s Privacy
                </h3>
                <p className="text-gray-600 font-open-sans leading-relaxed">
                  {importantInfo.childrenPolicy}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                  Contact Details
                </h3>
                <p className="text-gray-600 font-open-sans leading-relaxed">
                  {importantInfo.contact}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                  Changes to Privacy Policy
                </h3>
                <p className="text-gray-600 font-open-sans leading-relaxed">
                  {importantInfo.changes}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                  Third-Party Links
                </h3>
                <p className="text-gray-600 font-open-sans leading-relaxed">
                  {importantInfo.thirdPartyLinks}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Data Categories Table */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-roboto font-bold text-dark-grey mb-6">
              {dataCategories.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-4xl mx-auto font-open-sans">
              {dataCategories.intro}
            </p>
          </div>

          <div className="space-y-6">
            {dataCategories.categories.map((category, index) => (
              <Card
                key={index}
                className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <h3 className="text-xl font-roboto font-bold text-dark-grey mb-3">
                    {category.name}
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">
                        Description:
                      </p>
                      <p className="text-gray-600 font-open-sans">
                        {category.description}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">
                        Sources:
                      </p>
                      <p className="text-gray-600 font-open-sans">
                        {category.sources}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">
                        Legal Basis:
                      </p>
                      <p className="text-gray-600 font-open-sans">
                        {category.purpose}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">
                        Third Parties Disclosed:
                      </p>
                      <p className="text-gray-600 font-open-sans">
                        {category.disclosed}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Accessibility Notice */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-roboto font-bold text-dark-grey mb-4">
                {accessibility.title}
              </h3>
              <p className="text-gray-600 font-open-sans leading-relaxed">
                {accessibility.description}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Privacy Sections */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-16">
            {sections.map((section, sectionIndex) => (
              <div key={section.id} id={section.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-ocean-blue/10 rounded-full flex items-center justify-center">
                        <section.icon className="h-6 w-6 text-ocean-blue" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-roboto font-bold text-dark-grey">
                        {section.title}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {section.content.map((item, itemIndex) => (
                        <div key={itemIndex}>
                          <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                            {item.subtitle}
                          </h3>
                          <p className="text-gray-600 font-open-sans leading-relaxed">
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
          <h2 className="text-2xl font-roboto font-bold text-dark-grey mb-8 text-center">
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
                <span className="text-dark-grey font-open-sans group-hover:text-ocean-blue transition-colors">
                  {section.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Annexes Section */}
      <section className="py-12 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* US Residents Annex */}
          <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <h2 className="text-2xl md:text-3xl font-roboto font-bold text-dark-grey">
                {annexes.usResidents.title}
              </h2>
              <p className="text-gray-600 font-open-sans">
                {annexes.usResidents.intro}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {annexes.usResidents.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                    {section.title}
                  </h3>
                  <p className="text-gray-600 font-open-sans leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Surf Sessions Annex */}
          <Card className="hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <h2 className="text-2xl md:text-3xl font-roboto font-bold text-dark-grey">
                {annexes.surfSessions.title}
              </h2>
              <p className="text-gray-600 font-open-sans">
                {annexes.surfSessions.intro}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {annexes.surfSessions.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="text-lg font-roboto font-semibold text-dark-grey mb-3">
                    {section.title}
                  </h3>
                  <p className="text-gray-600 font-open-sans leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-ocean-blue to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-roboto font-bold text-white mb-6">
            {contact.title}
          </h2>
          <p className="text-xl text-white/90 mb-8 font-open-sans">
            {contact.description}
          </p>

          <div className="space-y-4 text-white/90 font-open-sans max-w-2xl mx-auto mb-8">
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
              className="bg-white text-ocean-blue hover:bg-gray-50 px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="mailto:privacy@quiversurf.com">
                <Mail className="mr-2 h-5 w-5" />
                Contact Privacy Team
              </Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
