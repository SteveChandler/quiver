import {
  buildForecastBenchmarkQueries,
  classifyForecastBenchmarkRegion,
  createUnmeasuredForecastRetrievalBenchmark,
  extractForecastAnswerContractFacts,
  summarizeForecastCompetitiveBenchmark,
  summarizeForecastRetrievalEvidence,
  type ForecastBenchmarkSpot,
} from "@/lib/seo/forecast-authority-benchmark";

const spot = (overrides: Partial<ForecastBenchmarkSpot> = {}): ForecastBenchmarkSpot => ({
  id: "spot-1",
  name: "Oceanside Harbor",
  city: "Oceanside",
  state: "CA",
  country: "USA",
  canonicalPath: "/ca/oceanside/oceanside-harbor",
  ...overrides,
});

describe("forecast authority benchmark", () => {
  it("samples every domestic coast and international inventory", () => {
    const spots = [
      spot(),
      spot({ id: "hi", state: "HI", country: "USA" }),
      spot({ id: "east", state: "NC", country: "USA" }),
      spot({ id: "gulf", state: "TX", country: "USA" }),
      spot({ id: "west", state: "OR", country: "USA" }),
      spot({ id: "florida", state: "FL", country: "USA" }),
      spot({ id: "intl", state: "Jalisco", country: "Mexico" }),
    ];

    expect(spots.map(classifyForecastBenchmarkRegion)).toEqual([
      "California",
      "Hawaii",
      "East Coast",
      "Gulf Coast",
      "West Coast",
      "East Coast",
      "International",
    ]);
    expect(buildForecastBenchmarkQueries(spots, 1)).toHaveLength(60);
  });

  it("extracts the server-rendered answer contract from raw HTML", () => {
    const facts = extractForecastAnswerContractFacts(`
      <section data-testid="public-forecast-answer">
        <h2>Today's surf forecast</h2>
        <dt>Surf</dt><span>3-4 ft</span>
        <p>Best window: 6:00–9:00 AM</p>
        <p>Why: morning winds stay light.</p>
        <p>Forecast valid at 2026-08-08T12:00Z</p>
        <p>Source data updated 2026-08-08T10:00Z</p>
        <p>Quiver computed 2026-08-08T10:05Z</p>
        <p>Contributing sources: NOAA</p>
        <p>Score 8/10 · Confidence high</p>
      </section>
    `);

    expect(facts).toEqual({
      answerLayer: true,
      forecastDate: true,
      surfFacts: true,
      bestWindow: true,
      reasoning: true,
      freshness: true,
      provenance: true,
      score: 1,
    });
  });

  it("calculates Answer Share, citations, and canonical selection from query evidence", () => {
    const queries = buildForecastBenchmarkQueries([spot()], 1);
    const evidence = queries.map((query, index) => ({
      queryId: query.queryId,
      selectedUrl: query.canonicalPath === null
        ? null
        : index === 1
          ? "https://www.surfline.com/surf-report/oceanside-harbor"
          : index === 2
            ? null
            : "https://www.quiversurf.app/ca/oceanside/oceanside-harbor",
      answerUrl: index === 1
        ? "https://www.surfline.com/surf-report/oceanside-harbor"
        : query.canonicalPath === null
          ? null
          : "https://www.quiversurf.app/ca/oceanside/oceanside-harbor",
      citedUrl: index < 5
        ? "https://www.quiversurf.app/ca/oceanside/oceanside-harbor"
        : null,
      answerComplete: index < 8,
      current: index < 7,
    }));

    const benchmark = summarizeForecastRetrievalEvidence(
      queries,
      evidence,
      "fixture-search",
      "https://www.quiversurf.app",
    );
    const competitive = summarizeForecastCompetitiveBenchmark(queries, evidence, benchmark);

    expect(benchmark).toMatchObject({
      status: "measured",
      provider: "fixture-search",
      expectedQueries: 10,
      measuredQueries: 10,
      retrievedShare: 0.6,
      answerShare: 0.7,
      currentAnswerShare: 0.6,
      citationShare: 0.5,
      canonicalSelectionShare: 0.75,
      missingQueryIds: [],
      unexpectedQueryIds: [],
      duplicateQueryIds: [],
      reason: null,
    });
    expect(competitive).toMatchObject({
      status: "measured",
      competitors: [
        {
          name: "Surfline",
          selectedShare: 0.1,
          answerShare: 0.1,
          citationShare: 0,
        },
        {
          name: "Surf Captain",
          selectedShare: 0,
          answerShare: 0,
          citationShare: 0,
        },
      ],
    });
  });

  it("does not credit a competitor that uses the canonical Quiver path", () => {
    const queries = buildForecastBenchmarkQueries([spot()], 1);
    const evidence = queries.map((query) => ({
      queryId: query.queryId,
      selectedUrl: query.canonicalPath === null
        ? null
        : `https://competitor.example${query.canonicalPath}`,
      answerUrl: "https://competitor.example/answer",
      citedUrl: "https://competitor.example/citation",
      answerComplete: true,
      current: true,
    }));

    const benchmark = summarizeForecastRetrievalEvidence(queries, evidence, "fixture-search");

    expect(benchmark).toMatchObject({
      retrievedShare: 0,
      answerShare: 0,
      currentAnswerShare: 0,
      citationShare: 0,
      canonicalSelectionShare: 0,
    });
  });

  it("does not credit relative or malformed retrieval values as Quiver URLs", () => {
    const queries = buildForecastBenchmarkQueries([spot()], 1);
    const evidence = queries.map((query) => ({
      queryId: query.queryId,
      selectedUrl: query.canonicalPath,
      answerUrl: "not a URL",
      citedUrl: "/ca/oceanside/oceanside-harbor",
      answerComplete: true,
      current: true,
    }));

    expect(summarizeForecastRetrievalEvidence(queries, evidence, "fixture-search")).toMatchObject({
      retrievedShare: 0,
      answerShare: 0,
      currentAnswerShare: 0,
      citationShare: 0,
      canonicalSelectionShare: 0,
    });
  });

  it("rejects incomplete retrieval evidence instead of reporting partial coverage as measured", () => {
    const queries = buildForecastBenchmarkQueries([spot()], 1);
    const benchmark = summarizeForecastRetrievalEvidence(
      queries,
      queries.slice(0, -1).map((query) => ({
        queryId: query.queryId,
        selectedUrl: null,
        answerUrl: null,
        citedUrl: null,
        answerComplete: false,
        current: false,
      })),
      "fixture-search",
    );

    expect(benchmark.status).toBe("invalid");
    expect(benchmark.missingQueryIds).toEqual([queries.at(-1)?.queryId]);
    expect(benchmark.answerShare).toBeNull();
  });

  it("marks raw-HTML-only runs as unmeasured retrieval benchmarks", () => {
    const queries = buildForecastBenchmarkQueries([spot()], 1);
    const benchmark = createUnmeasuredForecastRetrievalBenchmark(
      queries,
      "provider not configured",
    );

    expect(benchmark).toMatchObject({
      status: "not-run",
      expectedQueries: 10,
      measuredQueries: 0,
      answerShare: null,
      reason: "provider not configured",
    });
  });
});
