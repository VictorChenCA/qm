# QM × C&C: see your QM swarm on an RTS map

QM's team said at the Own Your Intelligence hackathon (YC, Sep 27 2026) that nobody has figured out how to
visualize swarms faithfully. This fork makes QM's own agents report to **C&C (Command & Control)**, an RTS command
center for agent swarms: https://github.com/VictorChenCA/OYIHack

## What it does
Every Claude-harness turn in QM mirrors its hook events (session start, prompt, each tool call and its result or
failure, subagent start and stop, notifications, stop) to C&C's `/hook` endpoint, tagged `source: "qm"`. On the map,
a QM session is a mothership, its research/code/consult subagents launch and dock, tool calls animate, and waits or
failures surface as enemies tethered to the units they block.

- `src/harness/cnc-bridge.ts`: the bridge (about 80 lines).
- `src/harness/claude-harness.ts`: `withCncHooks(...)` appends the mirror after QM's own hooks, which still run first
  and still decide. `cncOnlyHookOptions()` covers turns that have no hooks.
- `test/cnc-bridge.test.ts`: 4 tests. Events arrive, QM's hooks are kept, it's off by default, and an unreachable C&C never breaks a turn.

## Use it
```bash
export QM_CNC_HOOK_URL=http://localhost:7777/hook   # C&C's hook endpoint
npm run dev-instance:web                             # QM as usual; C&C shows the swarm
```
Unset `QM_CNC_HOOK_URL` and QM behaves exactly as upstream. The bridge is fire-and-forget with a 1s timeout; it
never blocks, denies or changes a turn.

## Status
Built and unit-tested on Sep 27 2026 (`node --test test/cnc-bridge.test.ts`: 4/4 pass). Not yet exercised
against a full live QM deployment.
