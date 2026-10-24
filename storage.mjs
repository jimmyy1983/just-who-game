export class LocalMemory {
  constructor(storage, prefix = 'just-who:') { this.storage = storage; this.prefix = prefix; this.memory = new Map(); this.available = Boolean(storage); }
  get(key, fallback) {
    try { const raw = this.storage?.getItem(this.prefix + key); if (raw !== null && raw !== undefined) { const result = JSON.parse(raw); this.memory.set(key, result); return result; } }
    catch { this.available = false; }
    return this.memory.has(key) ? this.memory.get(key) : fallback;
  }
  set(key, value) { this.memory.set(key, value); try { this.storage?.setItem(this.prefix + key, JSON.stringify(value)); } catch { this.available = false; } }
  records(kind) { const data = this.get(kind === 'time' ? 'timeRecords' : 'countRecords', []); return Array.isArray(data) ? data.filter(e => e && Number.isFinite(e.count) && e.count >= 0 && e.count <= 100 && Number.isFinite(e.seconds) && e.seconds >= 0).slice(0, 20) : []; }
  add(result) {
    const entry = { count: result.count, seconds: Math.round(result.seconds * 100) / 100, won: Boolean(result.won), at: result.at };
    const count = [...this.records('count'), entry].sort((a, b) => b.count - a.count || b.seconds - a.seconds).slice(0, 20);
    const time = [...this.records('time'), entry].sort((a, b) => b.seconds - a.seconds || b.count - a.count).slice(0, 20);
    this.set('countRecords', count); this.set('timeRecords', time); this.set('best', Math.max(this.get('best', 0), result.count));
  }
}
export function formatTime(seconds) { const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
