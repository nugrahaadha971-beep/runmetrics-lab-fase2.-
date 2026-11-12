// Fungsi murni. Nilai yang tidak bisa dihitung = null (tidak pernah NaN, Infinity, atau 0 palsu).
// Fase 2 memuat rumus 3.1, 3.2, 3.3 (sRPE), dan 3.5; sisanya menyusul di Fase 3.
const finite = Number.isFinite
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export const TRIMP_COEF = { male: { a: 0.64, b: 1.92 }, female: { a: 0.86, b: 1.67 } }

// 3.1 Pace (detik per km)
export function calcPace(durationSec, distanceKm) {
  if (!finite(durationSec) || !finite(distanceKm) || distanceKm <= 0 || durationSec <= 0) return null
  return durationSec / distanceKm
}

export function isHrProfileValid(p) {
  return !!p && finite(p.hrMax) && finite(p.hrRest) && p.hrRest < p.hrMax && Object.hasOwn(TRIMP_COEF, p.sex)
}

// 3.2 TRIMP Banister: sum( dt_menit * HRr * a * e^(b * HRr) ), HRr dibatasi 0..1
function trimpStep(minutes, hr, p) {
  const { a, b } = TRIMP_COEF[p.sex]
  const r = clamp((hr - p.hrRest) / (p.hrMax - p.hrRest), 0, 1)
  return minutes * r * a * Math.exp(b * r)
}

export function calcTrimpFromAvg(durationSec, avgHr, profile) {
  if (!isHrProfileValid(profile) || !finite(avgHr) || !finite(durationSec) || durationSec <= 0) return null
  return trimpStep(durationSec / 60, avgHr, profile)
}

export function calcTrimpFromStream(records, profile) {
  if (!isHrProfileValid(profile) || !Array.isArray(records)) return null
  let total = 0
  let used = 0
  for (let i = 1; i < records.length; i += 1) {
    const dt = records[i].t - records[i - 1].t
    const hr = records[i].hr
    if (!finite(dt) || dt <= 0 || dt > 30 || !finite(hr)) continue
    total += trimpStep(dt / 60, hr, profile)
    used += 1
  }
  return used > 0 ? total : null
}

// Stream bila ada, jika tidak pakai avgHr dan seluruh durasi.
export function calcTrimp(activity, records, profile) {
  return calcTrimpFromStream(records, profile) ?? calcTrimpFromAvg(activity?.durationSec, activity?.avgHr, profile)
}

// 3.3 sRPE = RPE x durasi (menit)
export function calcSrpe(rpe, durationSec) {
  if (!finite(rpe) || !finite(durationSec) || durationSec <= 0) return null
  return rpe * (durationSec / 60)
}

// 3.5 Efficiency Factor = (jarak m / durasi menit) / HR rata-rata
export function calcEF(distanceKm, durationSec, avgHr) {
  if (!finite(distanceKm) || !finite(durationSec) || !finite(avgHr) || distanceKm <= 0 || durationSec <= 0 || avgHr <= 0) return null
  return (distanceKm * 1000) / (durationSec / 60) / avgHr
}

export function buildMetrics({ distanceKm, durationSec, avgHr, rpe }, records, profile) {
  return {
    avgPaceSec: calcPace(durationSec, distanceKm),
    efficiencyFactor: calcEF(distanceKm, durationSec, avgHr),
    srpe: calcSrpe(rpe, durationSec),
    trimp: calcTrimp({ durationSec, avgHr }, records, profile),
  }
}
