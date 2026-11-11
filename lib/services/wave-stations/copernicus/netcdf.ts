/**
 * NetCDF-4 (HDF5) reader for the Copernicus Marine in-situ files.
 *
 * h5wasm is the HDF5 C library compiled to WebAssembly (NIST licence, no
 * native binaries); the pure-JS reader jsfive cannot read the files'
 * dense attribute storage, so global and variable attributes would be lost.
 * It is loaded lazily, so only the cron function pays its ~4 MB, and files
 * are opened from its in-memory file system (nothing is written to disk).
 */

type H5 = typeof import("h5wasm");

export type NcAttributes = Record<string, string | number | null>;

export interface NcVariable {
  shape: number[];
  /** Row-major values ([TIME] or [TIME, DEPTH]). */
  values: ArrayLike<number>;
  attrs: NcAttributes;
}

export interface NcFile {
  attrs: NcAttributes;
  variables: Record<string, NcVariable>;
}

const HDF5_SIGNATURE = [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a];

let h5Promise: Promise<H5> | null = null;
let fileCounter = 0;

function loadH5(): Promise<H5> {
  h5Promise ??= import("h5wasm").then(async (h5) => {
    await h5.ready;
    return h5;
  });
  // A failed load (e.g. a cold-start error) is retried by the next call.
  h5Promise.catch(() => {
    h5Promise = null;
  });
  return h5Promise;
}

/** First element of a numeric array attribute; strings are trimmed; anything else is null. */
function attributeValue(value: unknown): string | number | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (ArrayBuffer.isView(value) && "length" in value) {
    const first = (value as unknown as ArrayLike<number | bigint>)[0];
    return first === undefined ? null : Number(first);
  }
  if (Array.isArray(value) && value.length > 0) return attributeValue(value[0]);
  return null;
}

function readAttributes(entity: { attrs: Record<string, { value: unknown }> }): NcAttributes {
  const out: NcAttributes = {};
  for (const [name, attribute] of Object.entries(entity.attrs)) out[name] = attributeValue(attribute.value);
  return out;
}

/**
 * Read the global attributes and the named variables (those present) of one
 * file. The handle is closed and the in-memory copy removed before returning.
 */
export async function readNetcdf(bytes: Uint8Array, variableNames: readonly string[]): Promise<NcFile> {
  // NetCDF-4 files start with the HDF5 superblock. Checking first keeps an
  // error page or a truncated download from reaching HDF5 (which logs a
  // page of diagnostics instead of throwing).
  if (!HDF5_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error("not a NetCDF-4 / HDF5 file");
  }
  const h5 = await loadH5();
  if (!h5.FS) throw new Error("h5wasm file system is not ready");
  const path = `/cmems-${process.pid}-${fileCounter++}.nc`;
  h5.FS.writeFile(path, bytes);
  let file: InstanceType<H5["File"]> | null = null;
  try {
    file = new h5.File(path, "r");
    const variables: Record<string, NcVariable> = {};
    const present = new Set(file.keys());
    for (const name of variableNames) {
      if (!present.has(name)) continue;
      const entity = file.get(name);
      if (!(entity instanceof h5.Dataset)) continue;
      const values = entity.value;
      if (!values || typeof values !== "object" || !("length" in values)) continue;
      variables[name] = {
        shape: entity.shape ?? [],
        values: values as ArrayLike<number>,
        attrs: readAttributes(entity as unknown as { attrs: Record<string, { value: unknown }> }),
      };
    }
    return { attrs: readAttributes(file as unknown as { attrs: Record<string, { value: unknown }> }), variables };
  } finally {
    try {
      file?.close();
    } catch (closeError) {
      // A damaged file can also fail to close; the read error (if any) is the one that matters.
      console.warn("[WaveStations] copernicus: closing a NetCDF file failed:", closeError);
    }
    h5.FS.unlink(path);
  }
}
