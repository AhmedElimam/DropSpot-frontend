/**
 * A tiny, safe condition language for the backend's `ui.conditions` (server
 * config/mobile_ui.php): «student.billing.pending_total > 0 && online && can.collect_payments».
 *
 * Grammar: literals (numbers, 'strings' / "strings", true, false, null), dotted names
 * looked up in the context the screen hands in, `!`, comparisons (== != > >= < <=), `&&`,
 * `||`, parentheses, and `in` against a [list, of, literals]. Nothing is executed: the text
 * is parsed into a tree and walked. A broken expression evaluates to `undefined` and the
 * surface stays as it is — a typo in backend code can never take a button away by accident.
 */
type Tok = { t: 'num' | 'str' | 'id' | 'op' | 'lp' | 'rp' | 'lb' | 'rb' | 'comma'; v: string };

const OPS = ['&&', '||', '==', '!=', '>=', '<=', '>', '<', '!', 'in'];

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { out.push({ t: 'lp', v: c }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp', v: c }); i++; continue; }
    if (c === '[') { out.push({ t: 'lb', v: c }); i++; continue; }
    if (c === ']') { out.push({ t: 'rb', v: c }); i++; continue; }
    if (c === ',') { out.push({ t: 'comma', v: c }); i++; continue; }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      if (j < 0) return null;
      out.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    const two = src.slice(i, i + 2);
    if (OPS.includes(two) && two !== 'in') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('><!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) { out.push(id[0] === 'in' ? { t: 'op', v: 'in' } : { t: 'id', v: id[0] }); i += id[0].length; continue; }
    return null;
  }
  return out;
}

type Node =
  | { k: 'lit'; v: unknown }
  | { k: 'ref'; path: string[] }
  | { k: 'not'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'list'; items: Node[] };

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private take(): Tok | undefined { return this.toks[this.i++]; }
  private isOp(v: string): boolean { const p = this.peek(); return !!p && p.t === 'op' && p.v === v; }
  parse(): Node | null {
    const n = this.or();
    return n && this.i === this.toks.length ? n : null;
  }
  private or(): Node | null {
    let a = this.and();
    while (a && this.isOp('||')) { this.take(); const b = this.and(); if (!b) return null; a = { k: 'bin', op: '||', a, b }; }
    return a;
  }
  private and(): Node | null {
    let a = this.cmp();
    while (a && this.isOp('&&')) { this.take(); const b = this.cmp(); if (!b) return null; a = { k: 'bin', op: '&&', a, b }; }
    return a;
  }
  private cmp(): Node | null {
    const a = this.unary();
    if (!a) return null;
    const p = this.peek();
    if (p && p.t === 'op' && ['==', '!=', '>', '>=', '<', '<=', 'in'].includes(p.v)) {
      this.take();
      const b = p.v === 'in' ? this.list() : this.unary();
      if (!b) return null;
      return { k: 'bin', op: p.v, a, b };
    }
    return a;
  }
  private list(): Node | null {
    const p = this.take();
    if (!p || p.t !== 'lb') return null;
    const items: Node[] = [];
    while (this.peek() && this.peek()!.t !== 'rb') {
      const n = this.primary();
      if (!n) return null;
      items.push(n);
      if (this.peek()?.t === 'comma') this.take();
    }
    if (this.take()?.t !== 'rb') return null;
    return { k: 'list', items };
  }
  private unary(): Node | null {
    if (this.isOp('!')) { this.take(); const a = this.unary(); return a ? { k: 'not', a } : null; }
    return this.primary();
  }
  private primary(): Node | null {
    const p = this.take();
    if (!p) return null;
    if (p.t === 'num') return { k: 'lit', v: Number(p.v) };
    if (p.t === 'str') return { k: 'lit', v: p.v };
    if (p.t === 'id') {
      if (p.v === 'true') return { k: 'lit', v: true };
      if (p.v === 'false') return { k: 'lit', v: false };
      if (p.v === 'null') return { k: 'lit', v: null };
      return { k: 'ref', path: p.v.split('.') };
    }
    if (p.t === 'lp') { const n = this.or(); if (!n || this.take()?.t !== 'rp') return null; return n; }
    return null;
  }
}

const cache = new Map<string, Node | null>();

export function parseCondition(src: string): Node | null {
  if (!cache.has(src)) {
    const toks = tokenize(src);
    cache.set(src, toks ? new Parser(toks).parse() : null);
  }
  return cache.get(src) ?? null;
}

function lookup(ctx: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = ctx;
  for (const p of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function walk(n: Node, ctx: Record<string, unknown>): unknown {
  switch (n.k) {
    case 'lit': return n.v;
    case 'ref': return lookup(ctx, n.path);
    case 'not': return !walk(n.a, ctx);
    case 'list': return n.items.map((i) => walk(i, ctx));
    case 'bin': {
      if (n.op === '&&') return !!walk(n.a, ctx) && !!walk(n.b, ctx);
      if (n.op === '||') return !!walk(n.a, ctx) || !!walk(n.b, ctx);
      const a = walk(n.a, ctx); const b = walk(n.b, ctx);
      switch (n.op) {
        case '==': return a == b; // eslint-disable-line eqeqeq -- '3' == 3 is what a config author means
        case '!=': return a != b; // eslint-disable-line eqeqeq
        case '>': return Number(a) > Number(b);
        case '>=': return Number(a) >= Number(b);
        case '<': return Number(a) < Number(b);
        case '<=': return Number(a) <= Number(b);
        case 'in': return Array.isArray(b) && b.some((x) => x == a); // eslint-disable-line eqeqeq
      }
      return undefined;
    }
  }
}

/** true / false, or undefined when the expression is malformed (the caller then changes nothing). */
export function evaluateCondition(src: string, ctx: Record<string, unknown>): boolean | undefined {
  const tree = parseCondition(src);
  if (!tree) return undefined;
  try { return !!walk(tree, ctx); } catch { return undefined; }
}
