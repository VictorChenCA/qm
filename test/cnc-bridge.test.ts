import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { cncHooks, cncOnlyHookOptions, withCncHooks, CNC_EVENTS } from "../src/harness/cnc-bridge.ts";

test("bridge is off without QM_CNC_HOOK_URL", () => {
  assert.deepEqual(cncHooks(undefined), {});
  assert.deepEqual(cncOnlyHookOptions(undefined), {});
  const base = { PreToolUse: [{ matcher: "Agent", hooks: [] }] };
  assert.deepEqual(withCncHooks(base, undefined), base);
});

test("every hook event is mirrored to C&C, tagged source=qm, and the turn continues", async () => {
  const got: Record<string, unknown>[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { got.push(JSON.parse(body)); res.end("{}"); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  try {
    const hooks = cncHooks(url);
    assert.deepEqual(Object.keys(hooks).sort(), [...CNC_EVENTS].sort());
    const out = await hooks.PreToolUse[0].hooks[0]({ hook_event_name: "PreToolUse", session_id: "s1", tool_name: "mcp__qm__execute", cwd: "/jail/eng" });
    assert.deepEqual(out, { continue: true });
    await hooks.SubagentStart[0].hooks[0]({ hook_event_name: "SubagentStart", session_id: "s1", agent_id: "a1" });
    for (let i = 0; i < 50 && got.length < 2; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(got.length, 2);
    assert.equal(got[0].source, "qm");
    assert.deepEqual(got.map((g) => g.hook_event_name).sort(), ["PreToolUse", "SubagentStart"]);
  } finally {
    server.close();
  }
});

test("QM's own hooks are kept and run first; the mirror is appended", () => {
  const own = { matcher: "mcp__qm__.*", hooks: [async () => ({ continue: true })] };
  const merged = withCncHooks({ PreToolUse: [own] }, "http://127.0.0.1:9/hook");
  assert.equal(merged.PreToolUse[0], own);
  assert.equal(merged.PreToolUse.length, 2);
  assert.ok(merged.Stop?.length === 1);
});

test("an unreachable C&C never breaks a turn", async () => {
  const hooks = cncHooks("http://127.0.0.1:9/hook");
  assert.deepEqual(await hooks.Stop[0].hooks[0]({ hook_event_name: "Stop", session_id: "s2" }), { continue: true });
});
