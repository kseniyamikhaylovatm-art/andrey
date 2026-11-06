/** Small, local feedback sounds; no downloads or external audio service. */
export class FeedbackPlayer {
  private context: AudioContext | null = null;
  private nodes = new Set<{oscillator: OscillatorNode; gain: GainNode}>();
  private generation = 0;

  constructor(private unavailable: () => void) {}

  /** Called synchronously from a click so Safari/Chrome can unlock playback. */
  unlock() {
    try {
      const Constructor = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Constructor) { this.unavailable(); return; }
      if (!this.context || this.context.state === 'closed') this.context = new Constructor();
      if (this.context.state === 'suspended') void this.context.resume().catch(this.unavailable);
    } catch { this.unavailable(); }
  }

  play(correct: boolean) {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    this.stop();
    const generation = this.generation;
    const schedule = () => {
      if (generation !== this.generation || context.state !== 'running') return;
      const notes = correct
        ? [{frequency:659.25, offset:0, duration:0.14}, {frequency:880, offset:0.12, duration:0.2}]
        : [{frequency:220, offset:0, duration:0.17}, {frequency:164.81, offset:0.15, duration:0.21}];
      const start = context.currentTime + 0.01;
      for (const note of notes) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = correct ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(note.frequency, start + note.offset);
        const from = start + note.offset, end = from + note.duration;
        gain.gain.setValueAtTime(0, from);
        gain.gain.linearRampToValueAtTime(correct ? 0.09 : 0.06, from + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, end - 0.01);
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain); gain.connect(context.destination);
        const node = {oscillator, gain}; this.nodes.add(node);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes.delete(node); };
        oscillator.start(from); oscillator.stop(end);
      }
    };
    try {
      if (context.state === 'suspended') void context.resume().then(schedule).catch(this.unavailable);
      else schedule();
    } catch { this.unavailable(); }
  }

  stop() {
    this.generation++;
    const time = this.context?.currentTime || 0;
    for (const {oscillator,gain} of this.nodes) {
      try { gain.gain.cancelScheduledValues(time); gain.gain.setValueAtTime(0,time); oscillator.stop(time); } catch { /* already ended */ }
    }
    this.nodes.clear();
  }

  close() {
    this.stop();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null;
  }
}
