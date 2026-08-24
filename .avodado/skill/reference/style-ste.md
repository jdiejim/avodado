# STE discipline — style rules for Avodado text

Aerospace maintenance manuals follow rules like these so that a technician who
reads English as a second language cannot read a step in two ways. Our failure
mode is the same: text that looks fluent but means several things. These rules
adapt ASD-STE100 Simplified Technical English to software documentation. They
trade style for one property: each sentence has exactly one reading.

## Vocabulary and terms

- One word, one meaning. If `build` names a command, do not also use it for
  the compiled output.
- One concept, one word. If the doc says `endpoint`, it never says `route`,
  `path`, or `handler` for the same thing.
- Project terms live in a `glossary` block. That block is the approved term
  list for the doc. For every term outside it, use ordinary English.
- Prefer the short common word: use, not utilize; before, not prior to; end,
  not terminate; about, not approximately.

## Sentences

- Length limits: instructions, 20 words at most; descriptive sentences, 25.
- Write one instruction per sentence.
- Instructions are always active voice: "Run `avo check`", never "`avo check`
  should be run". Passive voice is allowed only in descriptive text, and only
  when the actor is truly unknown or irrelevant.
- Use simple tenses only: past, present, future. No perfect or continuous
  forms.
- Put the main action first and the condition after it: "Rerun the build if
  the check fails."
- Keep articles and relative pronouns: "Run the check that validates the doc",
  not "Run check validates doc". When you drop these small words, the sentence
  becomes ambiguous.
- Keep noun clusters to 3 words at most. Write "the handler that refreshes
  authentication tokens", not "authentication token refresh handler".
- Do not use an -ing word as a noun or modifier where a verb or clause works.
  Write "when the parser fails", not "on parsing failure".

## Paragraphs

- Descriptive paragraphs hold 6 sentences at most; procedural paragraphs, 3.
- Give each paragraph one topic. Announce the topic in the first sentence.
- Put warnings and prerequisites before the step they apply to, never after.

## Where each level applies

**Full STE** — procedural and machine-adjacent text: `steps` blocks, CLI help,
`avo check` diagnostics, error messages, MCP tool descriptions, and the skill's
own instructions. A reader parses this text under pressure, and the reader is
sometimes another model. Every rule above applies.

**STE-lite** — `prose`, `callout`, and `pullquote` content, and plain Markdown
paragraphs. Every rule applies except the restricted vocabulary. Prose carries
tradeoffs and consequences; a controlled word list flattens that. Keep the
sentence limits, active voice, and simple tenses, and keep one word per
concept.

**STE-lite, completeness first** — block text fields (`description`, `lede`,
`body`, `note`, `subtitle`, `summary`). The form rules apply, but never delete
a fact to satisfy a length rule. Split a long sentence into two sentences.
Keep every component, value, and condition the field states.

**Not applied** — marketing copy, changelog voice, code comments. Diagram data
(node names, messages, edge labels, states, values) is never edited for style:
the diagram is the data, and it must stay complete.

## Worked pairs

**Pair 1 — a restated diagram (docs/showcase.md:512).**

```
Before: A controller calls OrderService, which loads via an OrderRepository,
charges through a PaymentGateway interface (Stripe/Adyen adapters), and
egresses to Postgres, the event bus, and external gateways.

After:  Payment providers sit behind one interface, so a Stripe outage is a
config change, not a code change.
```

The before repeats what the diagram already shows. The after states the
consequence that the diagram cannot show.

**Pair 2 — a lede with three jobs (resources/orders-api.md:29).**

```
Before: Time runs downward. Solid arrows are synchronous requests; dashed are
responses. The order row exists as PENDING only inside the transaction — it is
CONFIRMED before commit, or rolled back to CANCELLED on decline.

After:  An order is never visible as PENDING outside the transaction: it
commits as CONFIRMED or rolls back to CANCELLED. Clients can treat every read
as final.
```

The before teaches notation, describes arrows, and buries the invariant. The
after does one job: the guarantee, and what it lets clients do.

**Pair 3 — the wrapper opener (docs/showcase.md:9).**

```
Before: The blocks below are rendered from typed YAML fences. Edit the source
.md file, rerun `avo html`, and the HTML updates accordingly.

After:  Edit a YAML block to change its diagram. Then run `avo html`. The
.md file is the only source; there is no rendered state to fix by hand.
```

The before is passive, restates the page, and stacks two instructions into one
sentence. The after gives one instruction per sentence, plus the fact that
makes the edit safe.

## Constraints on how we use STE

- ASD-STE100 is free to obtain but not free to redistribute. Never copy the
  specification text or its ~900-word approved dictionary into this repo. We
  apply the rules and keep our own term list.
- Never claim Avodado output "is STE" or "is STE-compliant". Write
  "STE-informed" or "follows STE writing discipline". Certified compliance
  requires the real dictionary, and we do not ship it.
