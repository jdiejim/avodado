# Avodado blocks — AI & agents

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### AI & agents

Purpose-built for documenting LLM agents and pipelines: the loop itself
(`agentloop`), what one episode actually did (`trace`), what the model is
told (`prompt`), and what fills the window (`context`). They compose — the
*Agent system doc* playbook in `SKILL.md` stacks all four. For the surrounding
architecture (services, queues, vector stores) stay with `block`/`infra`
(`kind: llm`/`agent` gets the violet card); for one turn's message timing
use `sequence`.

#### `agentloop` — the canonical agent-loop diagram
```agentloop
title: Support triage agent
description: One loop turn — the agent reads the ticket, calls tools, and replies or escalates.
agent:
  name: Triage agent
  model: claude-sonnet-4-6
  note: Routes each ticket to a fix or a human.
env: Customer
tools:
  - { name: search_kb, desc: Search help-center articles }
  - { name: get_account, desc: Look up plan and billing state }
  - { name: create_ticket, desc: Escalate to a human queue }
memory:
  - conversation history
  - customer profile
stop: reply sent or ticket escalated
```
The environment (`env`, default "User") sits left, the agent card centre
(`model` renders as a mono chip, `note` as small text), tools stack right
(capped at 5 + "+N more"), and a memory cylinder hangs beneath **only when
`memory:` is present**. The numbered arrows are fixed — ① prompt → ② tool
call → ③ result (dashed) → ④ response — so keep `tools` to what the agent
can actually call. `stop` renders as a "stops when:" foot pill. Use
`agentloop` for the loop itself; use `block`/`infra` for the deployment
around it.

#### `trace` — an agent / session execution transcript
```trace
title: Password reset — one episode
turns:
  - role: user
    text: I never get the reset email.
  - role: assistant
    thinking: Could be a bounce — check delivery logs before blaming spam.
    text: Let me check our email logs.
  - role: tool
    tool: email_logs.search
    args: '{ "to": "sam@example.com", "type": "password_reset" }'
    result: "1 result: bounced (mailbox full)"
  - role: assistant
    text: Your mailbox rejected the email — free up space and I will resend it.
```
A vertical transcript — one entry per turn, each with a role chip (USER navy
· ASSISTANT violet · TOOL teal · SYSTEM gray) and a card. Assistant turns may
carry `thinking` (renders first, small italic); a tool turn is `tool` +
`args` + `result` (mono chips, "args:" / "→"). Multi-line strings keep their
line breaks, so block scalars (`|`) work for long output. **Quote `args` /
`result`** — JSON braces and colons are YAML syntax. Use `trace` to show
what one real episode did; use `sequence` for the timing between services.

#### `prompt` — prompt anatomy with variable highlighting
```prompt
title: Support reply template
segments:
  - kind: system
    label: role + guardrails
    text: "You are a support agent for {{product}}. Answer from the docs only."
  - kind: user
    text: "Customer ({{plan}} plan) asks: {{question}}"
vars:
  - { name: product, desc: Product name from config }
  - { name: plan, desc: Plan tier of the signed-in customer }
  - { name: question, desc: The inbound message }
```
Stacked cards, one per segment, each with a coloured role kicker (SYSTEM
gray · USER navy · ASSISTANT violet · TOOL teal) and the text in a mono face.
Any `{{variable}}` token highlights as an amber chip; list those variables in
`vars` so the legend explains where each value comes from. **`text`
containing `{{ }}` must be quoted** — bare braces are YAML flow syntax. Use
`prompt` for templates and system prompts; use `code` for actual code.

#### `context` — context-window token budget
```context
title: Where the 200k window goes
window: 200000
segments:
  - { label: system prompt, tokens: 6000, accent: navy }
  - { label: tool schemas, tokens: 14000, accent: teal }
  - { label: retrieval, tokens: 60000, accent: amber, desc: top-8 chunks }
  - { label: history, tokens: 70000, accent: purple }
```
One horizontal bar sized against `window`: segments left → right, leftover
space as a dim "free (N)" segment, and a legend row per segment with `N
tokens · NN%`. Zero-token segments are skipped; if the sum **exceeds** the
window the overflow renders red past a dashed boundary with an "over budget"
chip — deliberately alarming, use it to show the failure case. `unit`
defaults to "tokens". Use `context` for window budgets; use `waterfall` for
latency/cost cascades and `funnel` for conversion.
