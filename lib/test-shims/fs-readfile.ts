// Minimal shim to allow jest to mock readFile reliably
import { readFile as coreReadFile } from "fs/promises";
export const readFile: typeof coreReadFile = coreReadFile;
export default { readFile } as any;




