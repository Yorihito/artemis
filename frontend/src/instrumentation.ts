// Fix broken localStorage in some Node.js environments (e.g. when --localstorage-file
// flag is passed without a valid path, localStorage exists but getItem is not a function).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const ls = (globalThis as Record<string, unknown>).localStorage;
    if (ls !== undefined && typeof (ls as Record<string, unknown>).getItem !== "function") {
      // Disable broken localStorage so libraries fall back to in-memory caching
      (globalThis as Record<string, unknown>).localStorage = undefined;
    }
  }
}
