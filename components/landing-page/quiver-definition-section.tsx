import { SectionWrapper } from "@/components/landing-page/section-wrapper";

export function QuiverDefinitionSection() {
  return (
    <SectionWrapper
      className="py-20 px-4 bg-[#1a1f4e]"
      noiseVariant="texture"
      title="What is Quiver?"
      titleClassName="text-4xl md:text-5xl font-heading font-bold text-white mb-4"
      centerContent
      data-testid="quiver-definition-section"
    >
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 md:p-12 max-w-3xl mx-auto">
        <p className="text-lg md:text-xl text-white/90 leading-relaxed">
          Quiver is a free, ML-powered surf forecast platform that corrects
          raw NOAA predictions down to individual beach breaks. Standard
          forecasts like WaveWatch III use a 30-mile ocean grid designed for
          shipping routes — accurate offshore, but often wrong at the sand.
          Quiver trains per-beach XGBoost models on 30,000+ buoy observations
          from CDIP, NDBC, and IOOS stations, analyzing 72 directional swell
          bins to learn how each beach refracts, shelters, and amplifies
          incoming energy. The result is a bias-corrected forecast updated
          every 3 hours for 185+ beaches across California, Hawaii, Oregon,
          Washington, Florida, the East Coast, and Puerto Rico. Every spot
          includes a personalized Match Score that rates conditions against
          your skill level and preferences — so you spend less time checking
          forecasts and more time in the water.
        </p>
      </div>
    </SectionWrapper>
  );
}
