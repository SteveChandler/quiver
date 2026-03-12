/**
 * MethodologySection
 *
 * Server component — static content explaining how Quiver's ML bias
 * correction pipeline works and how accuracy is measured.
 */

export function MethodologySection() {
  return (
    <section aria-label="Forecast accuracy methodology">
      <div className="rounded-2xl border border-white/15 bg-white p-6 md:p-8">
        <h2 className="text-xl font-semibold text-white mb-6">
          How We Measure Forecast Accuracy
        </h2>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                NOAA Marine Forecasts as the Baseline
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                NOAA&apos;s National Weather Service publishes marine wave height
                forecasts for coastal regions across the US. These serve as our
                baseline — they represent what any surfer would see checking a
                government forecast. Our ML model starts from these raw NOAA
                predictions and refines them.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                Per-Beach ML Bias Correction
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                Every beach has unique exposure to swell direction, wind patterns,
                and local geography. Quiver&apos;s XGBoost model learns per-beach
                correction factors from historical buoy observations, adjusting
                NOAA&apos;s regional forecast to the specific conditions at each
                spot. Corrections account for terrain-aware factors like swell
                access and wind shelter across 72 directional bins.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                Ground Truth from the IOOS Buoy Network
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                Validation uses real wave height readings from the Integrated
                Ocean Observing System (IOOS) buoy network. Buoys report
                significant wave height every 1–6 hours. We match each
                ML-corrected forecast to the nearest buoy observation within
                a 3-hour window to produce a verified prediction pair.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                What MAE Means
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                Mean Absolute Error (MAE) measures the average absolute
                difference between a forecast and the observed buoy reading,
                expressed in meters. A raw MAE of 0.40m means the forecast is,
                on average, 0.4 meters off from what the buoy actually recorded.
                Lower MAE = more accurate forecast.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                Rolling 14-Day Evaluation Window
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                All accuracy statistics shown here use a 14-day rolling window
                of matched forecast-observation pairs. This keeps the data
                current and reflects recent model performance rather than
                long-term historical averages. The data refreshes daily as new
                buoy observations become available.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-high mb-2">
                Automated Weekly Retraining
              </h3>
              <p className="text-sm text-medium leading-relaxed">
                The ML model retrains weekly using a 90-day rolling window of
                matched observation data. Retraining includes validation gates —
                the new model must outperform the previous version before
                deployment. This ensures the model stays calibrated as swell
                patterns and buoy data evolve over time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
