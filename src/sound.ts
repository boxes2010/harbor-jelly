let ctx: AudioContext | null = null

// A run of soft bell notes.
function notes(pitches: number[], gap: number, ring: number, volume = 0.12): void {
  ctx ??= new AudioContext()
  const start = ctx.currentTime + 0.02
  pitches.forEach((pitch, i) => {
    const t = start + i * gap
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.frequency.value = pitch
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ring)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(t)
    osc.stop(t + ring + 0.05)
  })
}

// Something needs a decision.
export const chime = () => notes([660, 880], 0.18, 0.9, 0.14)
// A ship left on time and paid its bonus.
export const payout = () => notes([1047, 1319, 1568, 2093], 0.07, 0.45, 0.08)
// A bonus big enough to celebrate.
export const windfall = () => notes([784, 1047, 1319, 1568, 2093, 2637], 0.075, 0.7, 0.085)
// Money spent on the port.
export const purchase = () => notes([523, 784], 0.08, 0.3, 0.1)
// A contract signed.
export const signed = () => notes([392, 523, 659], 0.1, 0.5, 0.1)

// System notification, only when the player is looking at another window.
export function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.hasFocus()) return
  const note = new Notification(title, { body, silent: true })
  note.onclick = () => window.focus()
}
