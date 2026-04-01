export function buildOnlineCompilerUrl(code: string): string {
  return `https://onecompiler.com/java?code=${encodeURIComponent(code)}`
}

const SIMPLE_MODULES = new Set(["java-platform", "java-basics"])

export function canSimulateLocally(moduleId: string): boolean {
  return SIMPLE_MODULES.has(moduleId)
}
