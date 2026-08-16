## Purpose

Defines where each kind of instruction to an agent lives, which instructions are enforced by a test rather than by reading, and what happens when an instruction decays or is written twice.

## ADDED Requirements

### Requirement: One home per kind of statement

Each instruction has exactly one home, chosen by what kind of statement it is.

- `.omp/RULES.md` holds hard requirements about this repository. It is sticky, so it stays in force through a long session.
- `AGENTS.md` and the subsystem guides hold orientation, commands, and what counts as verified.
- The user-level rules hold working style that is not specific to this repository.
- `openspec/config.yaml` holds planning-time artifact rules and points at `AGENTS.md` for everything else.

A requirement MUST NOT appear in two homes. Beyond the drift that two copies invite, `omp` omits an always-apply rule whose content already appears in a loaded context file, so a duplicated sticky requirement can lose its stickiness entirely.

#### Scenario: A requirement is stated twice

- **WHEN** the same requirement sentence appears in `.omp/RULES.md` and in `openspec/config.yaml`
- **THEN** a test fails naming the sentence and both files
- **AND** the failure names which home the requirement belongs to

#### Scenario: A planning artifact needs repository context

- **WHEN** an agent reads the planning context for a change
- **THEN** it receives the planning-time artifact rules and a pointer to `AGENTS.md`
- **AND** it does not receive a second copy of a requirement that `.omp/RULES.md` already states

### Requirement: A written command is verified against the command it names

Guidance that names a command, a script or a skill is checked, because both decayed unnoticed while the work that outgrew them passed every gate.

#### Scenario: The gate list omits a smoke

- **WHEN** a site smoke script exists that the gate list in `AGENTS.md` does not name
- **THEN** a test fails naming the missing script

#### Scenario: The gate list names a removed script

- **WHEN** the gate list names a script that `package.json` no longer defines
- **THEN** a test fails naming the stale entry

#### Scenario: Guidance points at a skill that does not exist

- **WHEN** any guidance file references `skill://<name>`
- **THEN** a test resolves that name against the discovered skills
- **AND** fails naming the reference and the file when it does not resolve

### Requirement: A named anti-pattern is caught when it is written

An anti-pattern that has already cost a cycle is encoded as a rule that matches the tool arguments introducing it, rather than as prose that is read once at the start of a session.

A rule MUST interrupt only where continuing wastes a cycle or disables a guard. Every other rule reports without interrupting, because a rule that fires often on work that is fine teaches an agent to ignore the mechanism.

#### Scenario: A commit bypasses the hooks

- **WHEN** a tool call would run a commit with `--no-verify`
- **THEN** the rule interrupts before the call runs

#### Scenario: A test asserts on source text

- **WHEN** a tool call would write a test or smoke that reads a `.svelte`, `.ts` or config file and asserts on its contents
- **THEN** the rule interrupts, naming the behaviour the assertion should judge instead
- **AND** a check that a policy about how code is written asserts on source is allowed when it says so

#### Scenario: A column fakes a value it does not have

- **WHEN** a tool call would add a `NOT NULL DEFAULT` column to pipeline SQL
- **THEN** the rule interrupts, because a defaulted provenance or reference states something the export never measured

#### Scenario: A retired contract is reintroduced

- **WHEN** a tool call would reintroduce a name this repository deliberately removed, such as a legacy route table or the `Unnamed character` placeholder
- **THEN** the rule reports without interrupting, naming the change that removed it

### Requirement: Instructions state the decision they settle

An instruction earns its place by changing a decision and by being checkable. A statement that every reader already believes they follow MUST NOT be added, because it cannot be verified and it displaces instructions that can.

#### Scenario: A tiebreak between a complete fix and a smaller one

- **WHEN** a complete fix and a partial one are both available
- **THEN** the instructions say to take the complete fix regardless of its size
- **AND** they say to record the work as a change rather than ship the partial fix when the complete one cannot be finished and verified

#### Scenario: A defect of the same class is found nearby

- **WHEN** work in a file reveals a defect of the class being fixed
- **THEN** the instructions require fixing it or recording it
- **AND** they require looking for siblings before a fix is committed, so the class is fixed rather than the instance

### Requirement: Plans hold evidence and specs hold contracts

`openspec/specs` states what must be true. `openspec/changes` states what is in flight. `docs/plans` holds audits, measurements and slice evidence, which specs deliberately do not carry.

Slice status is read from the change tracker rather than restated in prose, because two records of one status drift.

#### Scenario: A slice is delivered

- **WHEN** a slice completes
- **THEN** its measured evidence is recorded in the roadmap with its date
- **AND** its status is read from the change tracker rather than written beside the evidence
