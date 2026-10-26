# agent-instructions Specification

## Purpose

Defines the home of each kind of instruction to an agent. Defines which instructions a test enforces. Defines the treatment of an instruction that decays or appears twice.

## Requirements

### Requirement: One home per kind of statement

Each instruction SHALL have one home selected by its kind. A requirement SHALL NOT appear in two homes because copies drift apart and `omp` can drop an always-apply duplicate of loaded context, losing its sticky copy.

#### Scenario: A requirement appears twice

- **WHEN** one requirement sentence appears in `.omp/RULES.md` and in `openspec/config.yaml`
- **THEN** a test fails and names the sentence and both files
- **AND** the failure names the home that owns the requirement

### Requirement: Repository requirements remain sticky

`.omp/RULES.md` SHALL hold hard repository requirements so they stay in force through a long session.

#### Scenario: A session needs a repository requirement

- WHEN an agent works through a long session
- THEN hard repository requirements remain in the sticky `.omp/RULES.md` file

### Requirement: Orientation lives in repository guidance

`AGENTS.md` and subsystem guides SHALL hold orientation, commands, and the definition of verified work.

#### Scenario: An agent needs repository orientation

- WHEN an agent needs commands or the definition of verified work
- THEN it finds them in `AGENTS.md` or the subsystem guides

### Requirement: Working style lives in user rules

User-level rules SHALL hold working style that applies to every repository.

#### Scenario: Working style applies across repositories

- WHEN an instruction defines working style
- THEN its home is the user-level rules

### Requirement: Planning context points to repository guidance

`openspec/config.yaml` SHALL hold planning-time artifact rules and a pointer to `AGENTS.md`.

#### Scenario: A planning artifact needs repository context

- **WHEN** an agent reads the planning context of a change
- **THEN** the agent receives the planning-time artifact rules and a pointer to `AGENTS.md`
- **AND** the agent receives no second copy of a requirement from `.omp/RULES.md`

### Requirement: A test compares a written command against the command it names

Guidance names commands, scripts, and skills. A test SHALL check each name. Two such names decayed while every gate stayed green.

#### Scenario: The gate list omits a smoke

- **WHEN** `package.json` defines a site smoke script that the gate list in `AGENTS.md` does not name
- **THEN** a test fails and names the missing script

#### Scenario: The gate list names a removed script

- **WHEN** the gate list names a script that `package.json` no longer defines
- **THEN** a test fails and names the stale entry

#### Scenario: Guidance names a skill that does not exist

- **WHEN** a guidance file refers to `skill://<name>`
- **THEN** a test resolves the name against the discovered skills
- **AND** the test fails and names the reference and its file when the name does not resolve

### Requirement: A rule catches a named anti-pattern in the tool arguments

An anti-pattern that already cost a cycle becomes a rule. The rule matches the tool arguments that introduce the anti-pattern.

A rule MUST interrupt only when the work wastes a cycle or disables a guard. Every other rule reports and does not interrupt. A rule that fires often on correct work teaches an agent to ignore the mechanism.

#### Scenario: A commit bypasses the hooks

- **WHEN** a tool call runs a commit with `--no-verify`
- **THEN** the rule interrupts before the call runs

#### Scenario: A test asserts on source text

- **WHEN** a tool call writes a test or a smoke that reads a `.svelte`, `.ts`, or config file and asserts on its content
- **THEN** the rule interrupts and names the behaviour that the assertion must judge
- **AND** the rule permits a check on source when the check states that it tests a policy about code

#### Scenario: A column supplies a value that no export measured

- **WHEN** a tool call adds a `NOT NULL DEFAULT` column under `pipeline/src/sql/`
- **THEN** the rule interrupts, because a defaulted provenance or reference states an unmeasured fact

#### Scenario: Work reintroduces a retired contract

- **WHEN** a tool call reintroduces a name that this repository removed, such as a legacy route table or the `Unnamed character` placeholder
- **THEN** the rule reports and names the change that removed the name

### Requirement: An instruction states the decision that it settles

An instruction earns its place in two ways. The instruction changes a decision, and a reader can check the outcome. An instruction that every reader already believes MUST NOT enter the guidance. Nobody can check such an instruction, and it takes the place of one that a reader can check.

#### Scenario: A complete fix and a partial fix are both available

- **WHEN** work can take a complete fix or a smaller compromise
- **THEN** the instructions require the complete fix, whatever its size
- **AND** the instructions require a recorded change instead of the compromise when the complete fix cannot land and pass verification

#### Scenario: Work finds a nearby defect of the same class

- **WHEN** work in a file reveals another defect of the class under repair
- **THEN** the instructions require a fix or a record for that defect
- **AND** the instructions require a search for further instances before the commit
