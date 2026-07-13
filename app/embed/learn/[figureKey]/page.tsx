import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnFigure } from "@/components/learn/figures/learn-figure";
import { LearnEmbedFooter } from "@/components/learn/figures/learn-embed-footer";
import { FIGURE_KEYS, isFigureKey } from "@/components/learn/figures/figure-keys";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return FIGURE_KEYS.map((figureKey) => ({ figureKey }));
}

interface Props {
  params: Promise<{ figureKey: string }>;
}

export default async function LearnFigureEmbedPage({ params }: Props) {
  const { figureKey } = await params;
  if (!isFigureKey(figureKey)) notFound();

  return (
    <main className="min-h-screen w-full bg-[#F4EBD8] p-2">
      <LearnFigure figureKey={figureKey} />
      <LearnEmbedFooter figureKey={figureKey} />
    </main>
  );
}
