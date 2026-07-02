export type UpdateRuntimeJobMap = Map<string, any>;

export type UpdateRuntime = {
  readonly jobs: UpdateRuntimeJobMap;
  platform: (fallback: string) => string;
  manifest: (fallback: string) => string;
  autoDownload: () => boolean;
  autoPatch: () => boolean;
  setPlatform: (value: unknown) => void;
  setManifest: (value: unknown) => void;
  setAutoDownload: (value: unknown) => void;
  setAutoPatch: (value: unknown) => void;
  reset: () => void;
};

export function createUpdateRuntime(): UpdateRuntime {
  const jobs: UpdateRuntimeJobMap = new Map();
  const overrides = {
    platform: '',
    manifest: '',
    autoDownload: true,
    autoPatch: true,
  };

  return {
    jobs,
    platform(fallback: string): string {
      return overrides.platform || fallback;
    },
    manifest(fallback: string): string {
      return overrides.manifest || fallback;
    },
    autoDownload(): boolean {
      return overrides.autoDownload;
    },
    autoPatch(): boolean {
      return overrides.autoPatch;
    },
    setPlatform(value: unknown): void {
      overrides.platform = String(value || '');
    },
    setManifest(value: unknown): void {
      overrides.manifest = String(value || '');
    },
    setAutoDownload(value: unknown): void {
      overrides.autoDownload = value !== false;
    },
    setAutoPatch(value: unknown): void {
      overrides.autoPatch = value !== false;
    },
    reset(): void {
      overrides.platform = '';
      overrides.manifest = '';
      overrides.autoDownload = true;
      overrides.autoPatch = true;
      jobs.clear();
    },
  };
}
