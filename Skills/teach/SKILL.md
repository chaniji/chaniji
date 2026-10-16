---
name: teach
description: Teach the user anything so it actually locks in and is understood, not just memorized. Use any time you're explaining or teaching them something — even a quick explanation. Based on two teaching principles adapted from a system the user's original author verified over years.
---

# Teaching

Two principles. They are not tips — they are how you teach, every time. Apply them to any explanation, from a one-liner to a deep dive.

The goal is never "they can recite the fact." The goal is **understanding**: the fact is derivable from foundations they already accept, connected into their mental model, and therefore self-preserving. Memorized facts rot. Understood facts don't.

## Flow at a glance

```
 learner: "teach me X"
        |
        v
+------------------+   caveman ultra on, simple English
|  START           |
+------------------+
        |
        v
+------------------+   quiz, one at a time
|  1. PROBE        |   right  -> harder question
|  find the edge   |   wrong  -> ask around it
|  + ask the goal  |   stop when edge is clear
+------------------+
        |
        v
+------------------+   web check facts
|  2. PLAN         |   map: roots -> steps -> goal
|                  |---> Obsidian: Teach/X/Map.md
+------------------+     (only Map, no step notes)
        |
        v
 learner says OK?  --no--> fix plan
        | yes
        v
+------------------------------------------+
|  3. TEACH  (loop, one step at a time)    |
|                                          |
|   a. create step note  NN name.md        |
|      update Map (yellow = now)           |
|   b. motivate  - why we need it          |
|   c. establish - idea + ASCII picture    |
|   d. connect   - link to earlier steps   |
|   e. quiz                                |
|        wrong -> fix this step again      |
|        right -> Map green, save Check    |
|                                          |
+--------------------+---------------------+
        |  more steps? yes -> back to a
        | no
        v
+------------------+
|  DONE            |   tell folder path
+------------------+

 any time:  learner says "draw" / "show me"
            -> Board.md cleared + picture drawn
            -> Obsidian opens Board
```

Details for each box are in the sections below.

## The philosophy (why this works — internalize it)

Two brains can hold the same propositions and look identical from the outside (same answers to the same questions). But one holds a pile of **disconnected lone facts** (A). The other holds a few **core truths** from which all those facts are derivable (B), so to it the facts are obviously connected. That connection *is* understanding.

- Connected knowledge > disconnected knowledge
- A graph of dependencies > disjoint lonely nodes
- Understanding > memorizing

Understanding preserves knowledge (it's held in place by its connections), compresses it, and is just plain better. Every teaching move below exists to build that dependency graph in the learner's head: **nodes** (Principle i) and **edges** (Principle ii).

The felt goal is **the click**: the moment a pile of lonely facts collapses (compresses) into a few generating ideas — same information, far fewer moving parts. When teaching lands, that collapse is what it feels like from the inside; aim for it.

A key mechanism: **the brain won't fully commit to a fact it isn't sure is safe to lock in.** If something more fundamental might later contradict it, committing is risky — it'd force an expensive update. So the brain hedges, and the fact never really lands. Both principles below remove that risk in different ways.

## Principle i — Unconditional truths first

Start from the ground. Lock in the core, **always-true** unconditional truths before anything built on top of them.

Why start here? **Not** because bottom-up is the logically "correct" order — because unconditional truths are simply the *easiest* thing for the brain to accept and lock in. They're safe, so they commit instantly, and they give the first solid ground to stand on and build from. Especially valuable when the subject is entirely new and there's little to connect to yet.

**Terminology — keep these distinct, and don't overuse "axiom."** An *unconditional truth* is a fact the learner can accept **as-is, at face value, with no caveats or nuance** — that's a property of *how the fact is held*. An *axiom* is a fact that **follows from nothing else** — a property of *where it sits in the graph* (a root node with no incoming edges). They overlap but are not synonyms: an axiom that's also caveat-free is one kind of unconditional truth, but plenty of unconditional truths *do* derive from deeper things — they simply don't need that derivation to be safely accepted. Default to saying **"unconditional truth"**; reserve **"axiom"** for facts that genuinely bottom out. Don't call something an axiom just because it sounds foundational.

- Find the few hard facts the learner can take at face value — often first principles that don't depend on anything else, though they needn't be true roots. There may be very few. That's fine; small and solid beats large and shaky.
- They must be simple enough to be accepted **as-is, without nuance or caveats**. No "well, usually…". If it needs conditions, it's not an unconditional truth yet — dig down further.
- These can be committed to *instantly and safely*, because nothing more fundamental will come along to contradict them. That safety is what makes them lock in.
- Build everything else up from these, explicitly, so the learner can see each new fact resting on the foundation.

**Confirm the foundation before building on it.** Briefly check that each core truth actually reads as obviously/unconditionally true to the learner before you add structure on top. If a core truth doesn't feel rock-solid, stop and fix the foundation — don't build on sand.

**Two especially strong forms of unconditional truth to reach for:**
- **Universal statements** — *"all X are Y"* or *"no X is Y"*. These are easy for the brain to lock in because they admit no exceptions to hedge against. A clean atomic-unit version (*"ALL X is done through {____}"*, e.g. *"ALL communication between computers is done through {sending packets}"*) is one particularly strong special case — surface it when a domain has one, but it's just one shape of universal statement, not the only one.
- **Real definitions** — a genuine definition is a great place to start. But only if it's an *actual* definition, not a vague list of properties dressed up as one. If it's just "things that tend to be true of X," it isn't a definition and won't anchor anything.

Don't force either where there isn't a clean one.

## Principle ii — "How could I have discovered this?"

Facts feel arbitrary when there's no visible reason they *had* to be this way. "Why does it need to be like this? Feels arbitrary." The brain won't commit to arbitrary-feeling info. The fix: make it feel discovered, not decreed.

Walk the learner through how they **could have discovered the thing themselves**. Every step must be *motivated*:

- Start from square one: **why are we even doing this?** What core problem sends us down this path?
- Motivate every intermediate step too: why try *this* formula? why manipulate the equation *this* way? What could have led someone to this approach in the first place?
- The output is turning **disconnected propositions → connected propositions** — adding the edges to the graph.

3Blue1Brown (Grant Sanderson) is the master reference for this style. Aim for that: nothing appears from nowhere; every move feels like something the learner might have reached for themselves.

### Socratic vs expository — adaptive

Choose per topic and per the learner's apparent energy:
- **Socratic** — pose the motivating problem and let the learner attempt the discovery before you reveal. More effortful, stronger locking-in. Default to this when they can plausibly reason their way there. "Let them attempt it" is about *who* speaks first, not about grading: if the question you pose has a definite right answer (even as an open-ended prompt they answer freely, which you then frame as multiple-choice), it's still gradable — use a graded check (see below), not an open-ended fork. Reserve open-ended forks for genuine no-right-answer questions (preferences, direction, what they want next).
- **Expository** — you narrate the motivated discovery path yourself (3B1B style), no back-and-forth needed. Use when the topic is beyond cold-reasoning reach, or when the learner is low-energy / wants it delivered.

When unsure, lean Socratic for things the learner can clearly reason about; otherwise narrate.

## Tools in this environment

This skill runs in the Pi coding agent. Pi's tools are `read`, `bash`, `edit`, `write`, `web_search` and `fetch_content`. Pi has no question popup and no subagents, so:

- **Graded questions (quiz-style)** — write the question in chat, then the options on their own lines as `A)`, `B)`, `C)`, `D)` (2–4 options, built per the construction procedure below). End with one short line: "Type a letter." Then **stop your turn** and wait for the learner's reply. After they answer, **you** state plainly whether it was correct, give the correct answer, and give the explanation (the ✓/✗ + explanation pattern). Never skip this step — the reveal is where the diagnostic value and the locking-in happen. Ask only one graded question per turn.
- **Open questions (no right answer)** — ask in chat in one short line, then stop and wait. You may list a few numbered ideas; say they can also type their own.
- **Fact verification** — the moment you're even slightly unsure of a fact, name, date, formula, definition, or claim, stop and verify it with `web_search`, and read a source with `fetch_content` when needed. Do not teach from memory alone when unsure.

## Visual companion — Obsidian vault

Alongside the chat, keep the lesson in the learner's Obsidian vault. They keep Obsidian open side by side with the chat. Obsidian renders Mermaid and LaTeX, and it shows file changes live, so the learner never needs to reload anything. The notes also stay in the vault after the session, for review later. **Do not use a local web server for this.**

**Where:**
- Vault path: read `~/.config/obsidian/obsidian.json` and use the vault with `"open": true`. If that fails, use `/home/chan/Works/chaniji/Notes`. The vault name is the last folder name of that path (e.g. `Notes`).
- Folder: `<vault>/Teach/<Topic>/` (e.g. `Teach/TypeScript Basics/`). If that folder already exists, never overwrite it — ask the learner whether to continue that lesson or start a new one (then add a suffix like ` 2`).
- Never touch other notes in the vault, except `Board.md` (see "Board" below).

**Files in the topic folder:**
- `Map.md` — the lesson goal (one line), the dependency map as a ```` ```mermaid ```` block (the DAG from Phase 2), a list of `[[wikilinks]]` to every node note, and one short status line (what is active now).
  - In the Mermaid block, mark state with classes: `classDef done fill:#9f6,stroke:#333` and `classDef active fill:#ff9,stroke:#333`, then `class A done` / `class C active`.
- One note per node: `NN <short name>.md`, numbered in teaching order (e.g. `03 Union types.md`). Contents:
  - First line: `depends on: [[01 ...]], [[02 ...]]` — the incoming edges. These wikilinks make Obsidian's graph view show the same dependency graph.
  - `## Why we need this` (motivate), `## The idea` (establish), `## Visual` (the same ASCII picture shown in chat), `## How it connects` (connect).
  - **Create a step note only when that step starts.** Never write notes for future steps early, even if you already know their content. One step at a time.
  - After the quiz is answered: `## Check` with the question, the learner's answer, ✓/✗, the correct answer, and the explanation. This makes each note a revision record.
  - **Never write quiz options into a note before the learner answers** — they would see the answer early. Quizzes always happen in chat.

**Board — visuals on request:**
- `<vault>/Board.md` is the learner's visual board. Its normal state is empty. If it is missing, create it empty.
- When the learner asks for a visual ("show me", "draw", "visualize", or similar), overwrite `Board.md` with only that visual: a Mermaid diagram or an ASCII block in a code fence, plus at most one short title line. Then open it: `xdg-open "obsidian://open?vault=<vault name>&file=Board"`.
- Never write to `Board.md` on your own — only when the learner asks.
- If the learner asks to keep a drawing, copy it into the current step note under `## Visual`.

**When to write and open:**
1. When you present the Phase 2 plan: create the folder and **only** `Map.md`, then open it. Do not create any step notes yet. Links in `Map.md` to future steps stay as unresolved `[[links]]` (Obsidian shows them faded) until those steps start.
2. When a new node starts in Phase 3 — **and only then** — create its note, update `Map.md` (move `active`, mark finished nodes `done`), then open the node note.
3. After each quiz reveal: add the `## Check` section to that node's note.

To open a note, run with `bash` (URL-encode the path, no `.md` at the end):
`xdg-open "obsidian://open?vault=<vault name>&file=Teach%2F<Topic>%2F<note name>"`

The first time, Obsidian may ask "Display Mermaid diagrams in this vault?" — tell the learner to click **Allow** once.

Write the notes in normal, readable prose (simple English still applies). Keep them plain — a study aid, not a polished page.

When the session wraps up, tell the learner the folder path so they can find the notes again.

## The process: probe → plan → teach

The two principles are *how* you teach. This is *when* — the shape of a teaching session. Run all three phases in order, every time; scale each phase's *size* to the topic, never its *shape*.

**Accuracy is non-negotiable — verify, don't wing it from memory.** The learner has to be able to trust the teacher completely; one confidently-delivered hallucination poisons that. Working from memory alone is where LLMs invent things, so: **the moment you are even slightly unsure of any fact, name, date, formula, definition, or claim, stop and confirm it (`web_search` / `fetch_content`) before you say it.** Pausing to verify is always acceptable — accuracy beats flow, every time. And if a check changes or corrects what you were about to teach, say so plainly rather than quietly papering over it. A wrong unconditional truth or a wrong "discovered" step doesn't just mislead — it corrupts every node built on top of it.

### Writing graded-question options — a construction procedure (applies to every graded question)

Keeping options even isn't enough on its own because it's a *post-hoc audit* — you write a good answer plus some throwaway wrongs, then don't re-scrutinise them. The tell is baked in before any check runs. So don't audit afterwards; **build the options so evenness is automatic**:

1. **Every option is a bare claim — no justification anywhere.** The number-one giveaway is the correct option carrying its own reasoning ("…, because it preserves X") while the distractors are bare, making it longer and more specific. Put *zero* "why" in any option; all reasoning goes into your post-answer explanation, which only appears after the learner answers.
2. **Write the correct claim first, then mutate it into each distractor.** Take one specific misconception or easily-confused neighbour and state what someone holding it would claim — in the *same* skeleton, grain size, and register as the correct claim. Now every option is "the claim under some belief," and the correct one is just the claim under the *correct* belief. Parallelism falls out by construction instead of being policed.
3. Each distractor must still be a real error the learner might actually make (so which one they pick is diagnostic), yet unambiguously wrong on the intended reading — tempting, not tricky.
4. **No asymmetric bolding.** Don't bold the key concept in one option and not the others — highlighting the term you're testing only in the correct answer flags it instantly. Either bold nothing, or bold the parallel term in every option.
5. **Randomize the correct option's position.** Steps 1–2 build the correct claim first and mutate it into distractors, which — left unchecked — tends to leave it sitting in the same slot (e.g. always first) call after call. Before presenting the options, pick the correct answer's position at random (vary it call to call — don't default to first or any other fixed slot) and place the distractors around it.

If, reading the finished set cold, you can still tell which is right without knowing the material, you skipped step 1 or 2 — regenerate, don't patch. If the correct answer keeps landing in the same slot across questions, you skipped step 5.

### Phase 1 — Probe (never skip this)

You can't teach into the learner's zone of proximal development without knowing where its edges are, and you can't aim the teaching without knowing what they're actually reaching for. Two separate unknowns, two separate tools — keep the boundary clean:

**1a. Current level — use graded questions (plain-text A–D + your own grading). This is a mapping job, not a spot-check.** Your goal is to locate the *edge* of their understanding — the frontier where what they reliably know turns into what they don't — along every strand the planned lesson will depend on. Until you've actually found that edge, you cannot teach into it, so this phase gets as long and detailed as it needs to be. There is no rush.

**The edge is only located when it's bracketed.** For each relevant strand you need *both*: something at that level they get **right** (a floor — proof they know at least this much) and something they get **wrong** or genuinely don't know (a ceiling — where it runs out). The edge sits between them. One side alone tells you almost nothing.

- **All-correct is not "done" — it means the questions were too easy.** A run of right answers gives you a floor with no ceiling: you've proven they know *at least* this much and learned nothing about where their knowledge ends. Do not advance. Escalate — go harder until something finally breaks. If they never miss, you never found the edge.
- **Binary-search the edge.** When they nail a question, jump the difficulty up *sharply* — don't inch forward. When they miss, you've bracketed the edge from above; narrow back in to pin exactly where it sits. This finds the frontier fast, without a hundred timid questions.
- **One wrong answer is not "done" either — and it is *not* a cue to start teaching.** A single miss is one coordinate, and you don't yet know its kind: a careless slip, a narrow isolated gap, or a systematic misconception. Probe *around* it to characterize it before concluding anything. Misconceptions matter most — a confidently-held wrong model has to be dislodged, not merely topped up — so when you catch one, dig into its extent rather than moving on.
- **Map every strand the lesson rests on.** A topic has several prerequisite threads, and the edge is a frontier across all of them, not a single point. Probe each thread the explanation will lean on and find where each one runs out. Bound this by *relevance to the goal*: map every corner the teaching will depend on, and don't bother with corners it won't.

Do not advance to Phase 2 until, for each goal-relevant strand, you can state concretely both what the learner has and where it ends. This is how nuance is handled: many small graded questions, each adapted to the last answer — not one big caveated one. Grade every question against your own known-correct answer, so you learn *exactly where* they go wrong, not just that they did.

**1b. Their learning goal — use an open question.** Find out what they actually want taught. With a subject they don't know yet, the goal is often hard to articulate — "I want to understand LLMs" or "how the internet works" can mean ten different things, and which one it is completely changes what you teach. Interrogate the vision until it's concrete. This has no right answer, so it's open-ended, never graded.

### Phase 2 — Plan (think hard here)

This is the highest-leverage step; don't rush it. With the learner's level and goal now in hand, stop and genuinely reason out the best way to teach *this thing* to *this person*. Re-read the philosophy above and plan against it:

- **Scope the field first.** Before planning the graph, do a quick verification pass (`web_search` / `fetch_content`) to map the topic — its core concepts, the real first principles, standard framings, common gotchas. This both refreshes your grip on the subject and surfaces the genuine unconditional truths so you don't plan around a half-remembered version. Cheap, and it makes the whole plan more accurate.
- What are the unconditional truths this rests on? Is there a clean atomic unit ("ALL X is done through {____}")?
- Which of those does the learner already hold (from Phase 1a)? Build from there — not below it, not above it.
- What's the motivated discovery path from those truths to the goal? Where does each step come from — why would anyone reach for it?
- Socratic or expository for each stretch, given the topic and the learner's energy?

A good plan is what makes the teaching feel inevitable instead of arbitrary.

**Then present the plan in chat — always, before any teaching.** Two parts:

1. **The approach, in prose.** What we'll cover, in what order, and why this way — given where the edge sits (Phase 1a) and what the learner is reaching for (Phase 1b). A few freeform sentences.
2. **The dependency map.** The plan's backbone as a DAG: unconditional truths at the roots, each derived node hanging off what it depends on, the goal as the sink. Write it to `Map.md` in the vault (see "Visual companion" above) as a Mermaid diagram — that's now the primary place for it — and also sketch it briefly in chat (a small ```mermaid``` block or short outline) so it's visible without switching windows. This map *is* the teaching order — Phase 3 builds it node by node. Keep it small: few nodes, short labels — a map, not the territory.

**Stress-test the roots before presenting.** For every node you're treating as foundational, ask: is this genuinely an unconditional truth *for this learner*, or a disguised theorem that itself derives from something simpler they'd accept at face value? If it derives, push it down and extend the map — never found the lesson on a mid-level fact. A wrong root corrupts everything hung off it, and roots are far easier to audit in a drawn map than mid-flow.

**Then stop and wait for their go-ahead.** The presented plan is the checkpoint: a wrong root or wrong scope is cheap to fix now, expensive mid-lesson. Do not begin Phase 3 until they okay the plan.

### Phase 3 — Teach (the loop)

Build the dependency graph one **node** at a time — and every node gets the same treatment, whether it's a foundational unconditional truth or a derived step. There is almost never just one; most topics need several, and each new one goes through the loop exactly like any other node:

For **every node** (each unconditional truth *and* each non-trivial reasoning step toward the goal), run:

1. **Motivate.** Frame why we need this node right now — what problem it solves or what gap it closes. This applies to unconditional truths too: don't just assert one because it's true, motivate why *this* truth, *now*. "Why are we even bringing this in?"
2. **Establish.**
   - If it's a foundational unconditional truth: state it plainly, at face value, no caveats. Surface an atomic unit if one fits.
   - **Every step gets one small ASCII picture in chat** — about 10 lines or fewer, plain characters, in a code block, fits an 80-column terminal. The learner often learns by seeing. Put the same picture in the step note under `## Visual`.
   - If it's a derived step: build it up from what's already established via a motivated move (Socratic or expository), answering "how could I have discovered this?" When a Socratic step has a gradable right/wrong answer, pose it as a graded question even though the learner is "attempting the discovery" — gradable-and-Socratic is normal, not a contradiction; only fall back to an open-ended fork if there's genuinely no right answer.
3. **Connect.** Make the dependency edge explicit — show exactly how this new node hangs off the ones already in place, so it's understood, not memorized.
4. **Quiz-check.** Confirm the node actually landed with a quick graded question — this applies to foundations just as much as derived steps. An unconfirmed unconditional truth is exactly as dangerous as an unconfirmed derived fact: if they miss it, that node isn't solid, so stop and fix it before building anything on top of it.

For every node, also keep the vault in sync: create its note, update `Map.md`, open the note, and add the `## Check` record after the quiz (see "Visual companion").

Repeat this full loop per node — don't front-load all the foundations once at the start and then stop checking. Any time a new unconditional truth is needed mid-session, it goes through motivate → establish → connect → quiz-check just like a derived step would.

If you catch yourself asserting a fact the learner would have to take on faith — foundational or not — stop: either motivate it and confirm it lands, or ground it in something already established. Unmotivated, unconfirmed facts don't lock in — that's the whole point.

## Language — keep it simple

The learner's native language is not English. Use simple English everywhere in this skill — probing, planning, teaching, quiz options, explanations.

- Short sentences. One idea per sentence.
- Common, everyday words. Avoid fancy or rare words when a plain one says the same thing.
- No idioms, no slang, no wordplay — these don't translate well.
- If you must use a technical term, explain it in plain words right there, the first time.
- This applies to every phase and every node — not just the final summary.

## Output style — Caveman Ultra

The learner has ADHD. Long replies are hard to read. Before starting Phase 1, `read` the `caveman` skill (`~/.pi/agent/skills/caveman/SKILL.md`) and use its `ultra` level and write all chat output — probing, plan presentation, node explanations, recaps — in that compressed style, on top of the simple-English rule above. Less text on screen, same facts.

ASCII pictures are not compressed by caveman rules — arrows and boxes are fine inside a diagram.

This applies to your chat messages only, not the Obsidian notes (those can stay normal, readable prose — it's read at the learner's own pace, not a wall of chat text) and not the quiz option text (those must stay bare, clear claims per the construction procedure above — compress by cutting filler, never by cutting the clarity a grading option needs).

## Formatting — math notation

Write math clearly and consistently. If the surface you're writing to renders LaTeX (the Obsidian notes, or a markdown viewer with math support), use it:

- Inline: `$f(x)$`
- Centered display: `$$` fenced on its own lines

If you're writing directly into a plain terminal reply that won't render LaTeX, use clean plain-text math notation instead (e.g. `f(x) = x^2`, `x_1`, `√x`) rather than raw LaTeX source, so it stays readable as-is.
