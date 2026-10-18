// Positive numbers in log10 space: exponential growth without Infinity at 1e308.
export class Huge {
  constructor(log = -Infinity) { this.log = log; }
  static of(n) { return new Huge(n > 0 ? Math.log10(n) : -Infinity); }
  static read(n) { return new Huge(n === null ? -Infinity : n); }
  add(b) { const hi = Math.max(this.log,b.log), lo = Math.min(this.log,b.log); return hi === -Infinity ? new Huge() : new Huge(hi + Math.log10(1 + 10 ** (lo-hi))); }
  sub(b) { if (this.log <= b.log) return new Huge(); return new Huge(this.log + Math.log10(-Math.expm1((b.log-this.log)*Math.LN10))); }
  mul(n) { return new Huge(this.log + Math.log10(n)); }
  times(b) { return new Huge(this.log + b.log); }
  gte(b) { return this.log + 1e-12 >= b.log; }
  ratio(b) { return Math.min(1, 10 ** (this.log-b.log)) || 0; }
  toJSON() { return this.log === -Infinity ? null : this.log; }
  format() { if(this.log === -Infinity) return '0'; if(this.log < 6) return (10 ** this.log).toLocaleString('es-ES',{maximumFractionDigits:this.log < 2 ? 1 : 0}); const e=Math.floor(this.log); return `${(10 ** (this.log-e)).toFixed(2).replace('.',',')}e${e.toLocaleString('es-ES')}`; }
}
export const scaled = (base,growth,level) => new Huge(Math.log10(base)+Math.log10(growth)*level);
