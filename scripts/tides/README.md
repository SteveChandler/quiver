# FES2022 coastal tide constants

Register for a free AVISO+ account and select **FES (Finite Element Solution - Oceanic Tides Heights)**. Download `fes2022b/ocean_tide_extrapolated` from `sftp://ftp-access.aviso.altimetry.fr:2221/auxiliary/tide_model`. Keep the 34 constituent `.nc.xz` files together; `mask_fes2022B.nc` is optional. The extractor decompresses into a temporary directory.

Citation: The FES2022 Tide product was funded by CNES, produced by LEGOS, NOVELTIS and CLS and made freely available by AVISO.

Use Node 22 and Python 3. Create the Python environment outside this repository:

```sh
python3 -m venv /tmp/fes-venv
/tmp/fes-venv/bin/pip install numpy netCDF4
```

Run in this order from the repository root:

```sh
npx tsx scripts/tides/list-model-tide-beaches.ts --out /tmp/fes-points.json --include-reference
/tmp/fes-venv/bin/python scripts/tides/extract_fes2022_constituents.py --fes-dir /path/to/fes2022b/ocean_tide_extrapolated --points /tmp/fes-points.json --out /tmp/fes-raw.json
npx tsx --conditions=import scripts/tides/build-fes2022-constants.ts --raw /tmp/fes-raw.json --out lib/services/tides/fes2022-constituents.json
npx tsx --conditions=import scripts/tides/validate-fes2022.ts --raw /tmp/fes-raw.json --start 2026-09-29 --days 7 --report /tmp/fes-validation.md
```

The list step reads `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and NOAA's current tide prediction stations. `--conditions=import` loads the model predictor's ESM-only package in these scripts. Review unresolved points and the validation report before using the catalog.
