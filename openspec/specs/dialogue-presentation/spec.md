# dialogue-presentation Specification

## Purpose

Defines what a reader sees of a conversation: the openers, the choices, the replies, the gates, the
outcomes, and the points where a conversation returns to an earlier choice.

## Requirements

### Requirement: A conversation page reads as a script

A conversation page MUST present the authored flow, and MUST separate what the speaker opens with
from what the player can choose. Each choice MUST show its reply and its outcomes with it, so a
reader learns the consequence in the place where the choice is made.

The page MUST NOT present the nodes as a flat list, and MUST NOT imply an order the graph does not
carry.

#### Scenario: A conversation with openers and topics

- **WHEN** a reader opens a conversation with two openers and two topics
- **THEN** the openers appear as alternatives, in authored priority order
- **AND** the topics appear as what the player can raise, because the game offers every topic whose
  gate passes rather than reaching them from an opener
- **AND** each topic carries its reply and its outcomes

#### Scenario: What happens after the conversation closes

- **WHEN** a choice ends the conversation and then acts on the world
- **THEN** the page states that the conversation ends
- **AND** it states the outcome that follows, such as the destination a teleport moves the player to

#### Scenario: A conversation with no choice

- **WHEN** a conversation carries only speech, currently 50 of 231 graphs
- **THEN** the page presents the speech in authored order
- **AND** the page states that the conversation offers no choice

### Requirement: A gate is stated in the reader's words

A gated opener or choice MUST state its requirement as prose built from the published condition. A
list comparison MUST use the game's own wording. The page MUST NOT state whether the reader passes a
gate, because that depends on a save.

A requirement built from several checks MUST state each of them and whether all or any must pass. The
page MUST NOT print a comparison as the game's own enumeration name, and MUST place a subject inside
the sentence rather than after it.

#### Scenario: A gated opener

- **WHEN** an opener is gated
- **THEN** the page states the requirement beside that opener
- **AND** the page marks the openers as alternatives rather than as a sequence

#### Scenario: A requirement of several checks

- **WHEN** a gate holds several checks
- **THEN** the page states each of them
- **AND** it states whether all or any must pass

#### Scenario: A standing check

- **WHEN** a gate compares standing with a faction
- **THEN** the page names the faction inside the sentence and states the tier in words

#### Scenario: A gate naming published entities

- **WHEN** a gate names factions, races, characters or quests
- **THEN** each subject links to its page

#### Scenario: A gate the extraction could not resolve

- **WHEN** a gate carries no resolved subject
- **THEN** the page states that the game checks something it cannot name
- **AND** the page does not present the choice as unconditional

### Requirement: An outcome is stated with its amount and its target

Each outcome MUST appear with the choice or reply that causes it, MUST state its amount when it
carries one, and MUST link to the entity it acts on.

#### Scenario: A choice with several outcomes

- **WHEN** a choice awards experience and money and then teleports the character
- **THEN** the page states each amount
- **AND** the destination links to its location page
- **AND** the outcomes read in authored order

### Requirement: Branches and loops are visible as structure

A branch MUST present its alternatives with the check behind each output, or with the label of the
output when the branch declares no check. A jump MUST
present as a link to the point the conversation returns to, and MUST NOT repeat that part of the
conversation.

#### Scenario: A relationship branch

- **WHEN** a reply branches on a relationship tier
- **THEN** each alternative carries its tier label
- **AND** the alternatives read as siblings

#### Scenario: A branch that checks each output

- **WHEN** a branch states a check per output
- **THEN** each alternative reads as the requirement it carries
- **AND** the fall-through alternative reads as the remaining case

#### Scenario: A loop back to the choices

- **WHEN** a reply returns to the choice list
- **THEN** the page states that the conversation returns there
- **AND** the choice list appears once on the page

### Requirement: A long conversation stays readable and searchable

A conversation page MUST render every statement into the prerendered HTML, and MUST use progressive
disclosure for depth rather than a diagram. The page MUST work with no client script, because half of
this build's graphs hold more than 29 nodes and the largest holds 396.

#### Scenario: A large conversation

- **WHEN** a reader opens the largest conversation
- **THEN** the page presents the openers and the top-level choices without expansion
- **AND** a reader can expand a choice to read its reply and its follow-up choices
- **AND** every statement is present in the HTML

#### Scenario: The search index reaches the prose

- **WHEN** the search index is built
- **THEN** a statement inside a collapsed choice is findable
- **AND** a search result links to the conversation that holds it

### Requirement: Every surface that speaks reaches the conversation

A character page, a quest page and a scene placement MUST link to the conversations they hold, and
MUST NOT render a second, simpler copy of the dialogue.

#### Scenario: A character that speaks in several conversations

- **WHEN** a character holds conversations through its definition and through a quest
- **THEN** the character page lists each conversation with its holder
- **AND** each entry links to the conversation page

#### Scenario: The flat line lists are gone

- **WHEN** the site renders a character page, a quest page or a scene dialogue page
- **THEN** no page renders a flat list of dialogue lines
- **AND** no read model carries a dialogue line without its place in the flow
