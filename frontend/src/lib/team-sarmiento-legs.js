// Legs Day — Team Sarmiento (Fortachones coach sheet).
import { uid } from './format.js'

/** Custom id — máquina de hip thrust (no está en ExerciseDB). GIF temporal en pack del cliente. */
export const TEAM_SARMIENTO_HIP_THRUST = {
  id: 'ts-hip-thrust',
  n: 'Hip thrust',
  bp: 'upper legs',
  gif: 'ts-hip-thrust.gif',
  img: 'ts-hip-thrust.gif',
  desc: 'Máquina con disco (25–30 kg). GIF temporal — licenciar media propia.',
}

/** [exerciseId, sets, reps, weight kg] */
const LEGS_SPEC = [
  ['0598', 3, 15, 0],
  [TEAM_SARMIENTO_HIP_THRUST.id, 3, 12, 27.5],
  ['0743', 3, 10, 0],
  ['0585', 3, 10, 0],
  ['0599', 3, 15, 0],
  ['0605', 4, 25, 0],
]

export function teamSarmientoLegsRoutine() {
  return {
    id: uid(),
    name: 'Legs Day · Team Sarmiento',
    emoji: 'legs',
    ex: LEGS_SPEC.map(([id, sets, reps, weight]) => ({ id, sets, reps, weight: weight || 0 })),
  }
}

/** Ensure hip thrust custom ex + bundled GIF survive server sync and older local state. */
export function patchTeamSarmientoState(S) {
  if (!S) return S
  const inRoutines = (S.routines || []).some(r =>
    (r.ex || []).some(e => e.id === TEAM_SARMIENTO_HIP_THRUST.id))
  const inCustoms = (S.customEx || []).some(c => c.id === TEAM_SARMIENTO_HIP_THRUST.id)
  if (!inRoutines && !inCustoms) return S

  S.customEx = S.customEx || []
  const i = S.customEx.findIndex(c => c.id === TEAM_SARMIENTO_HIP_THRUST.id)
  if (i < 0) {
    S.customEx.push({ ...TEAM_SARMIENTO_HIP_THRUST })
  } else if (!S.customEx[i].gif) {
    S.customEx[i] = { ...S.customEx[i], ...TEAM_SARMIENTO_HIP_THRUST }
  }
  return S
}
