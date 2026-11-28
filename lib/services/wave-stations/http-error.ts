export class WaveStationHttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(`${message}: HTTP ${status}`);
    this.name = "WaveStationHttpError";
  }
}
