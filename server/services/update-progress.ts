export interface UpdateProgressInput {
  readonly received: number;
  readonly total: number;
  readonly speedBps: number;
}

export function speedBps(bytes: number, elapsedMs: number): number {
  return Math.round(bytes / Math.max(0.001, elapsedMs / 1000));
}

export function installerProgress(input: UpdateProgressInput) {
  const received = Number(input.received || 0);
  const total = Number(input.total || 0);
  const currentSpeed = Number(input.speedBps || 0);
  if (total > 0) {
    return {
      progress: Math.max(1, Math.min(99, Math.round((received / total) * 100))),
      etaSeconds: currentSpeed > 0 ? Math.max(0, Math.round((total - received) / currentSpeed)) : 0,
    };
  }
  const kb = Math.max(1, received / 1024);
  return {
    progress: Math.max(1, Math.min(88, Math.round(Math.log10(kb + 1) * 24))),
    etaSeconds: 0,
  };
}

export function patchProgress(input: UpdateProgressInput) {
  const received = Number(input.received || 0);
  const total = Number(input.total || 0);
  const currentSpeed = Number(input.speedBps || 0);
  if (total > 0) {
    return {
      progress: Math.max(1, Math.min(84, Math.round((received / total) * 84))),
      etaSeconds: currentSpeed > 0 ? Math.max(0, Math.round((total - received) / currentSpeed)) : 0,
    };
  }
  return {
    progress: Math.max(1, Math.min(76, Math.round(Math.log10(received / 1024 + 1) * 24))),
    etaSeconds: 0,
  };
}
