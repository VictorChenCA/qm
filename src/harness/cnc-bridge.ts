// QM × C&C bridge: mirror every Claude agent hook event to a C&C command center
// (https://github.com/VictorChenCA/OYIHack), so a QM swarm shows up as units on an RTS map:
// sessions are motherships, subagents launch from them, tool calls animate, blockers become enemies.
// Off unless QM_CNC_HOOK_URL is set (e.g. http://localhost:7777/hook). Fire-and-forget with a 1s
// timeout: it never blocks, denies, or changes a turn, and delivery failures are ignored.

// deno-lint-ignore no-explicit-any
type HookFn = (input: any, toolUseId?: string, options?: unknown) => Promise<Record<string, unknown>>;
type Matcher = { matcher?: string; hooks: HookFn[] };
// deno-lint-ignore no-explicit-any
export type HookMap = Record<string, any[]>;

export const CNC_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "SessionEnd",
] as const;

export function cncHookUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const url = env.QM_CNC_HOOK_URL?.trim();
  return url ? url : undefined;
}

export async function forwardToCnc(url: string, input: unknown, timeoutMs = 1000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(input as Record<string, unknown>), source: "qm" }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Hook matchers that mirror each event to C&C. Empty when the bridge is off. */
export function cncHooks(url: string | undefined = cncHookUrl()): HookMap {
  if (!url) return {};
  const mirror: HookFn = async (input) => {
    void forwardToCnc(url, input);
    return { continue: true };
  };
  const matchers: Matcher[] = [{ hooks: [mirror] }];
  return Object.fromEntries(CNC_EVENTS.map((event) => [event, matchers]));
}

/** Append the C&C mirror to QM's existing hooks without touching them. */
export function withCncHooks<T>(base: T, url: string | undefined = cncHookUrl()): T {
  const out: HookMap = { ...(base as HookMap) };
  for (const [event, matchers] of Object.entries(cncHooks(url))) out[event] = [...(out[event] ?? []), ...matchers];
  return out as T;
}

/** For turns that have no hooks of their own: `{ hooks }` when the bridge is on, otherwise `{}`. */
export function cncOnlyHookOptions(url: string | undefined = cncHookUrl()): { hooks?: HookMap } {
  const hooks = cncHooks(url);
  return Object.keys(hooks).length ? { hooks } : {};
}
