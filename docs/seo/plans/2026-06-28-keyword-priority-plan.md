# Keyword Priority Plan

Date: 2026-06-28
Status: implemented canonical alias pass + ready for next content wave

## Ranked keyword targets

1. `surfline alternative`
2. `free surfline alternative`
3. `free surf forecast`
4. `best free surf forecast app`
5. `surf forecast accuracy`
6. `magicseaweed alternative`
7. `machine learning surf forecast`
8. `best surf forecast app`
9. `surf report app`
10. `surf session log app`

## Why this ranking

- `surfline alternative` is Quiver's strongest live product-intent cluster and already has a ranking foothold via `/vs/surfline`.
- `free surfline alternative`, `free surf forecast`, and `best free surf forecast app` match Quiver's clearest market wedge: useful forecasts without a forecast paywall.
- `surf forecast accuracy` and `machine learning surf forecast` are authority terms where Quiver has a real product truth and supporting pages already.
- `magicseaweed alternative` is still worth intercepting because Quiver already answers the displacement story inside the Surfline/free comparison copy.
- `best surf forecast app` and `surf report app` have demand, but the SERPs are broader and less favorable for a self-authored brand roundup.
- `surf session log app` is lower priority because it is weaker acquisition intent than forecast/comparison terms.

## Canonical page map

| Keyword | Canonical page | Decision |
|---|---|---|
| `surfline alternative` | `/vs/surfline` | keep and strengthen |
| `free surfline alternative` | `/vs/surfline/free` | keep and strengthen |
| `free surf forecast` | `/free-surf-reports` | keep and strengthen |
| `best free surf forecast app` | `/best-free-surf-forecast-app` | keep and strengthen |
| `surf forecast accuracy` | `/forecast-accuracy` | keep and strengthen |
| `machine learning surf forecast` | `/learn/how-quiver-calibrates-your-beach` | keep and strengthen |
| `magicseaweed alternative` | `/vs/surfline/free` | alias for now, dedicated page only if the cluster proves out |
| `best surf forecast app` | none yet | do not build a self-ranking roundup page |
| `surf report app` | `/best-free-surf-forecast-app` + `/free-surf-reports` | support through internal links, not a new canonical yet |
| `surf session log app` | none yet | defer |

## Implemented in this pass

- Live route added for `/vs/surfline/free`.
- Permanent aliases added:
  - `/surfline-alternative` -> `/vs/surfline`
  - `/free-surfline-alternative` -> `/vs/surfline/free`
  - `/magicseaweed-alternative` -> `/vs/surfline/free`
  - `/free-surf-forecast` -> `/free-surf-reports`
  - `/learn/ml-surf-forecast` -> `/learn/how-quiver-calibrates-your-beach`

## Build plan

### Codex build order

1. Keep improving the existing comparison cluster before adding new branded pages.
2. Expand internal links from `free-surf-reports`, `best-free-surf-forecast-app`, `/vs/surfline`, and `how-quiver-calibrates-your-beach`.
3. Build a dedicated `magicseaweed alternative` page only if the redirected alias starts earning impressions or if GSC shows clear query demand.
4. Do not build `/best-surf-forecast-apps` as a self-ranking roundup unless third-party evidence shows Quiver can credibly win that SERP.

### Claude review pass

Run Claude against the final diff with a review-only prompt:

```bash
/Users/stevenchandler/.local/bin/claude -p --allowedTools Read,Grep,Glob,Bash(git diff:*) "Review the staged diff for SEO routing, canonicalization risk, duplicate-content risk, and test gaps. Return findings first, ordered by severity."
```

If Claude returns actionable findings, fix them before pushing.
