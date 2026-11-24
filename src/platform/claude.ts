// The only place that touches window.claude. Everything else asks this module.
// claude.use(name) resolves a capability namespace, or null when this view cannot run it.

type Use = (name: string) => Promise<any>;
const use: Use | null = (window as any).claude?.use ?? null;

export const STRAVA = "Strava";

export async function getDb(): Promise<any | null> {
  if (!use) return null;
  try { return await use("db"); } catch { return null; }
}

export async function getMcp(): Promise<any | null> {
  if (!use) return null;
  try { return await use("mcp"); } catch { return null; }
}

export const inArtifact = use !== null;
