/**
 * Who among a teacher's staff sees a surface. `'teacher'` = never an assistant; `'any'` =
 * every assistant; an ability key = assistants holding it (`can.<key>` in the context the
 * teacher layout sets). The server's `ui.gates[id]` overrides the bundled `assistantNeeds`,
 * so a NEW ability can open an existing control to assistants with no app change (founder
 * 2026-10-12: «an assistant had to wait for the next update»). A teacher is never gated.
 * Pure — no stores — so the search index and tests can use it at import time.
 */
export function assistantAllowed(id: string, bundled: string | undefined, ui: { gates?: Record<string, string> } | undefined, ctx: Record<string, unknown>): boolean {
  if (ctx.is_assistant !== true) return true;
  const gate = ui?.gates?.[id] ?? bundled;
  if (!gate || gate === 'any') return true;
  if (gate === 'teacher') return false;
  const can = ctx.can as Record<string, unknown> | undefined;
  return can?.[gate] === true;
}
