# Voice FSM Orchestration (ElevenLabs + Twilio)

This document describes the call orchestration flow for AI collection calls.

## Goals

- Make call flow deterministic.
- Prevent agreement/dispute tool calls outside valid phases.
- Improve observability for debugging demos/production calls.

## States

- `VERIFY_IDENTITY`
- `DISCLOSE_DEBT`
- `PLAN_SELECTION`
- `PAYMENT_METHOD`
- `CONFIRM_AGREEMENT`
- `EXECUTE_AGREEMENT`
- `DISPUTE_CAPTURE`
- `EXECUTE_DISPUTE`
- `CLOSE`

## Tool Endpoints

- `POST /api/v1/eleven/tools/orchestrate-call-step`
- `POST /api/v1/eleven/tools/create-payment-agreement`
- `POST /api/v1/eleven/tools/create-dispute`
- `GET /api/v1/eleven/tools/call-state` (debug, protected by tool secret header)

## Behavior

1. The agent should call `orchestrate-call-step` before final actions.
2. `create-payment-agreement` is accepted only in:
   - `CONFIRM_AGREEMENT`
   - `EXECUTE_AGREEMENT`
3. `create-dispute` is accepted only in:
   - `DISPUTE_CAPTURE`
   - `EXECUTE_DISPUTE`
4. On invalid state, tool returns `INVALID_STATE_FOR_TOOL`.
5. Agreement tool is idempotent by `interaction_id`.
6. Stale active call interactions are auto-closed if older than `CALL_STALE_TTL_SECONDS`.

## Observability

- `call_fsm_transition` collection events are emitted on state transitions.
- Additional call tool events are emitted:
  - `agreement_tool_rejected_invalid_state`
  - `agreement_tool_validation_failed`
  - `agreement_tool_idempotent`
  - `agreement_tool_executed`
  - `dispute_tool_rejected_invalid_state`
  - `dispute_tool_executed`

## Environment

- `CALL_STALE_TTL_SECONDS` (optional, default `1800`)
- `ELEVENLABS_TOOL_SECRET` (required for tool endpoints)
