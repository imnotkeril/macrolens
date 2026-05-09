/**
 * Y-axis domain: pad data min/max by `padPct` of the span (default 10%), then round to readable ticks.
 * Same idea as Relative Performance charts (`roundedAutoDomain`).
 */
export function paddedYDomain(values: number[], padPct = 0.1): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [0, 1];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = Math.max(1e-9, hi - lo);
  if (span < 1e-15) {
    const eps = Math.max(1e-6, Math.abs(lo) * 0.01 || 0.01);
    return [lo - eps, hi + eps];
  }
  const rawLo = lo - span * padPct;
  const rawHi = hi + span * padPct;
  const stepBase = Math.max(0.01, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

/** Include horizontal guide values so reference lines stay inside the frame. */
export function paddedYDomainWithRefs(values: number[], refYs: number[], padPct = 0.1): [number, number] {
  const extras = refYs.filter((y) => Number.isFinite(y));
  if (extras.length === 0) return paddedYDomain(values, padPct);
  return paddedYDomain([...values, ...extras], padPct);
}
