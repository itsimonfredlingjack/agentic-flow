# Brainstorming Skill

Transform rough ideas into detailed, validated designs through structured dialogue.

## Trigger

Use this skill when:
- Starting a new feature or project
- User says "brainstorm", "let's think about", "design", "how should we"
- Before any major implementation

## Process

### Phase 1: Understanding

**Goal:** Fully grasp what the user wants before proposing solutions.

Rules:
- Ask ONE question at a time
- Use multiple-choice options when possible (reduces cognitive load)
- Focus on: purpose, constraints, success criteria
- Don't assume - clarify

Example questions:
- "What's the primary goal here?"
- "Who is this for?"
- "What constraints should I know about?"
- "How will we know if this succeeds?"

### Phase 2: Exploration

**Goal:** Present alternatives before committing to a solution.

Rules:
- Always present 2-3 different approaches
- Include trade-offs for each (pros/cons)
- Lead with your recommended option
- Explain WHY you recommend it

Format:
```
## Approach A: [Name] ⭐ Recommended
[Description]
**Pros:** ...
**Cons:** ...

## Approach B: [Name]
[Description]
**Pros:** ...
**Cons:** ...
```

### Phase 3: Design Presentation

**Goal:** Break down the chosen approach into digestible chunks.

Rules:
- Present in 200-300 word sections
- Ask for validation after EACH section
- Cover: architecture, components, data flow, error handling, testing
- Be specific - include file names, function signatures

Sections to cover:
1. High-level architecture
2. Key components/modules
3. Data flow
4. Error handling strategy
5. Testing approach

### Phase 4: Documentation

**Goal:** Capture the validated design.

After validation:
1. Create design doc: `docs/plans/YYYY-MM-DD-<topic>-design.md`
2. Include all validated sections
3. Commit to version control

## Key Principles

- **YAGNI:** Ruthlessly eliminate unnecessary features
- **Alternatives:** Always explore before deciding
- **Validation:** Get explicit approval at each stage
- **Flexibility:** OK to revisit earlier phases if needed

## Example Dialogue

```
User: "I want to add user authentication"

AI (Phase 1): "What type of authentication fits your needs best?
   A) Email/password (simple, self-hosted)
   B) OAuth (Google, GitHub login)
   C) Magic links (passwordless)
   D) Other"

User: "A - email/password"

AI (Phase 1): "Should users be able to reset their password?"

User: "Yes"

AI (Phase 2): "Here are 3 approaches:

## Approach A: NextAuth.js ⭐ Recommended
Built-in session management, easy setup.
**Pros:** Battle-tested, good docs
**Cons:** Some magic/abstraction

## Approach B: Custom JWT
Full control, no dependencies.
**Pros:** Flexible, lightweight
**Cons:** More code to maintain

## Approach C: Supabase Auth
Hosted solution with dashboard.
**Pros:** Zero backend code
**Cons:** External dependency

I recommend A because..."

User: "Let's go with A"

AI (Phase 3): "Great! Let me break down the design:

### Section 1: Architecture
[200 words about auth flow]

Does this architecture make sense? Any concerns?"

User: "Looks good"

AI: "### Section 2: Components..."
[continues...]
```
