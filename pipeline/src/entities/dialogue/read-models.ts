import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { translateRichTextV1, type RichTextV1 } from "../../rich-text/rich-text-v1.ts";
import type {
  DialogueConditionSnapshot,
  DialogueEdgeSnapshot,
  DialogueEffectSnapshot,
  DialogueHolderSnapshot,
  DialogueNodeSnapshot,
  DialogueParticipantSnapshot,
  SnapshotRef,
} from "../../types.ts";

interface DialogueRow {
  id: string;
  graph_name: string;
  nodes_json: string;
  edges_json: string;
  entry_nodes_json: string;
  holders_json: string;
}

/** An entity a gate reads or an outcome acts on, resolved to the page a reader can open. */
interface EntityLink {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string | null;
}

interface GateView {
  kind: string;
  compare: string | null;
  value: string | null;
  invert: boolean;
  authoredType: string;
  subjects: EntityLink[];
  participants: DialogueParticipantSnapshot[];
}

interface EffectView {
  kind: string;
  amount: number | null;
  amountLabel: string | null;
  authoredType: string;
  target: EntityLink | null;
  participant: DialogueParticipantSnapshot | null;
}

/**
 * One step of the script a reader follows.
 *
 * The store keeps a graph, because the corpus is one: 1,383 nodes have more than one inbound edge
 * and 949 jump back to an earlier point. A page needs a reading order, so this is the order, built
 * once here. A `loop` step names a node already on the path, and a `reference` step names one this
 * script printed elsewhere, so the page never repeats a subtree and never recurses forever.
 */
type ScriptStep =
  | {
      kind: "speech";
      nodeId: number;
      statements: RichTextV1[];
      singleScreen: boolean;
      gate: GateView | null;
      next: ScriptStep[];
    }
  | { kind: "choice"; nodeId: number; options: ScriptOption[] }
  | {
      kind: "branch";
      nodeId: number;
      authoredType: string;
      gate: GateView | null;
      alternatives: ScriptAlternative[];
    }
  | { kind: "condition"; nodeId: number; gate: GateView; next: ScriptStep[] }
  | { kind: "effects"; nodeId: number; effects: EffectView[]; next: ScriptStep[] }
  | { kind: "end"; nodeId: number }
  | { kind: "jump"; nodeId: number; targetNodeId: number | null }
  | { kind: "loop"; targetNodeId: number }
  | { kind: "reference"; targetNodeId: number }
  | { kind: "unmodelled"; nodeId: number; authoredType: string; next: ScriptStep[] };

interface ScriptOption {
  port: string;
  text: string;
  gate: GateView | null;
  next: ScriptStep[];
}

interface ScriptAlternative {
  label: string | null;
  next: ScriptStep[];
}

interface Script {
  /** Greetings, in the order the game prefers them. They are alternatives, not a sequence. */
  openers: ScriptStep[];
  /**
   * What the player can raise once the conversation is open.
   *
   * A topic is an entry point of the graph rather than something a greeting points at: the game
   * offers every topic whose gate passes, so they are the conversation's menu.
   */
  topics: ScriptStep[];
  /** Every other entry point: a quest event, or another conversation. */
  starts: ScriptStep[];
}

/**
 * Publishes what a reader needs of a conversation: the script, and the entities it touches.
 *
 * A gate says what the game reads and an outcome says what it changes, so each becomes its own
 * predicate: an item page names the conversations that grant it, and a faction page names the ones
 * gated on it. Nothing here evaluates a gate or picks a branch.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitDialogueReadModels(
  db: Database,
  routeBase = "/conversations",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<DialogueRow, []>(
      `SELECT id, graph_name, nodes_json, edges_json, entry_nodes_json, holders_json
       FROM dialogues ORDER BY id`,
    )
    .all();

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO dialogue_presentation_rows (
      id, render_context, graph_name, label, statement_count, node_count, option_count,
      script_json, holders_json
    ) VALUES (?, 'dialogue-presentation-v1', ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, 'dialogue', ?, ?, ?, ?, ?, 1, ?, NULL)`,
  );

  const holderEdgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, ?, ?, 'dialogue', ?, 'holds_dialogue', ?, 1, ?, NULL)`,
  );

  const resolve = prepareEntityResolver(db);

  const tx = db.transaction(() => {
    for (const row of rows) {
      const nodes = new Map(
        (JSON.parse(row.nodes_json) as DialogueNodeSnapshot[]).map((node) => [node.id, node]),
      );
      const edges = JSON.parse(row.edges_json) as DialogueEdgeSnapshot[];
      const entryNodes = JSON.parse(row.entry_nodes_json) as number[];
      const holders = JSON.parse(row.holders_json) as DialogueHolderSnapshot[];

      const label = dialogueLabel(row, holders, resolve);
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "dialogue",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });

      const context: ScriptContext = {
        dialogueId: row.id,
        nodes,
        outgoing: groupEdges(edges),
        resolve,
        diagnostics,
        richTextDiagnostics: [],
        printed: new Set<number>(),
      };

      const script = buildScript(entryNodes, context);
      diagnostics.push(...context.richTextDiagnostics);

      presentationInsert.run(
        row.id,
        row.graph_name,
        label,
        [...nodes.values()].reduce((total, node) => total + node.statements.length, 0),
        nodes.size,
        [...nodes.values()].reduce((total, node) => total + node.options.length, 0),
        JSON.stringify(script),
        JSON.stringify(resolveHolders(holders, resolve)),
      );

      // The holder reaches the conversation, so its own page can name it. A scene placement has
      // no entity of its own here: its page comes from the scene dialogue family.
      for (const holder of resolveHolders(holders, resolve)) {
        if (holder.link === null) continue;
        holderEdgeInsert.run(
          `${holder.link.entityType}:${holder.link.entityId}:holds_dialogue:${row.id}`,
          holder.link.entityType,
          holder.link.entityId,
          row.id,
          label,
          JSON.stringify({ holder: holder.kind }),
        );
      }

      for (const [predicate, link, evidence] of touchedEntities(nodes.values(), resolve)) {
        if (link === null || link.entityType === "unresolved") continue;
        edgeInsert.run(
          `dialogue:${row.id}:${predicate}:${link.entityType}:${link.entityId}`,
          row.id,
          link.entityType,
          link.entityId,
          predicate,
          link.label,
          JSON.stringify(evidence),
        );
      }
    }
  });
  tx();

  return diagnostics;
}

interface ScriptContext {
  dialogueId: string;
  nodes: Map<number, DialogueNodeSnapshot>;
  outgoing: Map<number, DialogueEdgeSnapshot[]>;
  resolve: EntityResolver;
  diagnostics: PipelineDiagnostic[];
  richTextDiagnostics: PipelineDiagnostic[];
  printed: Set<number>;
}

function buildScript(entryNodes: number[], context: ScriptContext): Script {
  const openers: ScriptStep[] = [];
  const topics: ScriptStep[] = [];
  const starts: ScriptStep[] = [];

  // A greeting is an opener, and the game prefers the one with the highest importance. Ordering
  // them is what lets a page say which opener wins rather than listing them as speech.
  const entries = entryNodes
    .map((id) => context.nodes.get(id))
    .filter((node): node is DialogueNodeSnapshot => node !== undefined)
    .sort(byOpenerOrder);

  for (const entry of entries) {
    const step = buildStep(entry.id, new Set<number>(), context);
    if (step === null) continue;
    if (isOpener(entry)) openers.push(step);
    else if (entry.role === "choice") topics.push(step);
    else starts.push(step);
  }

  return { openers, topics, starts };
}

const isOpener = (node: DialogueNodeSnapshot): boolean =>
  node.role === "speech" && node.importance !== null;

/** Openers first, then topics, each in the order the game prefers them. */
function byOpenerOrder(left: DialogueNodeSnapshot, right: DialogueNodeSnapshot): number {
  const rank = (node: DialogueNodeSnapshot): number =>
    isOpener(node) ? 0 : node.role === "choice" ? 1 : 2;
  return (
    rank(left) - rank(right) ||
    (right.importance ?? 0) - (left.importance ?? 0) ||
    left.id - right.id
  );
}

function buildStep(
  nodeId: number,
  path: ReadonlySet<number>,
  context: ScriptContext,
): ScriptStep | null {
  if (path.has(nodeId)) return { kind: "loop", targetNodeId: nodeId };

  const node = context.nodes.get(nodeId);
  if (node === undefined) return null;
  // A node that ends the conversation is one word, so printing it again reads better than a
  // reference to somewhere else on the page. Anything with a body is referenced rather than
  // repeated.
  if (context.printed.has(nodeId) && node.role !== "end") {
    return { kind: "reference", targetNodeId: nodeId };
  }

  context.printed.add(nodeId);
  const nextPath = new Set(path).add(nodeId);
  const outgoing = context.outgoing.get(nodeId) ?? [];

  switch (node.role) {
    case "choice":
      return {
        kind: "choice",
        nodeId,
        options: node.options.map((option) => ({
          port: option.port,
          text: option.text,
          gate: option.gate === null ? null : gateView(option.gate, context),
          // An option's port names the edges that leave it. A topic has one output and no port, so
          // its option follows every edge of the node.
          next: followEdges(
            outgoing.filter((edge) => option.port === "" || edge.port === option.port),
            nextPath,
            context,
          ),
        })),
      };
    case "branch":
      return {
        kind: "branch",
        nodeId,
        authoredType: node.authoredType,
        gate: node.gate === null ? null : gateView(node.gate, context),
        alternatives: outgoing.map((edge) => ({
          label: edge.port,
          next: followEdges([edge], nextPath, context),
        })),
      };
    case "condition":
      return {
        kind: "condition",
        nodeId,
        gate: gateView(node.gate ?? emptyGate(node.authoredType), context),
        next: followEdges(outgoing, nextPath, context),
      };
    case "effect":
      return {
        kind: "effects",
        nodeId,
        effects: node.effects.map((effect) => effectView(effect, context)),
        next: followEdges(outgoing, nextPath, context),
      };
    case "end":
      return { kind: "end", nodeId };
    case "jump":
      // The game resolves this at runtime to the choice list the player last saw, so the walk can
      // name no target and the page says where the conversation returns to instead of inventing one.
      return { kind: "jump", nodeId, targetNodeId: node.jumpTarget };
    case "unmodelled":
      return {
        kind: "unmodelled",
        nodeId,
        authoredType: node.authoredType,
        next: followEdges(outgoing, nextPath, context),
      };
    default:
      return {
        kind: "speech",
        nodeId,
        statements: node.statements.map((statement) => richText(statement.text, context, node.id)),
        singleScreen: node.singleScreen,
        gate: node.gate === null ? null : gateView(node.gate, context),
        next: followEdges(outgoing, nextPath, context),
      };
  }
}

function followEdges(
  edges: DialogueEdgeSnapshot[],
  path: ReadonlySet<number>,
  context: ScriptContext,
): ScriptStep[] {
  return edges
    .map((edge) => buildStep(edge.to, path, context))
    .filter((step): step is ScriptStep => step !== null);
}

function groupEdges(edges: DialogueEdgeSnapshot[]): Map<number, DialogueEdgeSnapshot[]> {
  const grouped = new Map<number, DialogueEdgeSnapshot[]>();
  for (const edge of [...edges].sort((left, right) => left.ordinal - right.ordinal)) {
    const list = grouped.get(edge.from) ?? [];
    list.push(edge);
    grouped.set(edge.from, list);
  }

  return grouped;
}

function richText(text: string, context: ScriptContext, nodeId: number): RichTextV1 {
  const translated = translateRichTextV1(text);
  for (const diagnostic of translated.diagnostics) {
    context.richTextDiagnostics.push({
      severity: diagnostic.severity,
      source: "rich-text",
      code: diagnostic.code,
      message: diagnostic.message,
      entityType: "dialogue",
      entityId: context.dialogueId,
      field: diagnostic.field,
      evidence: { nodeId },
    });
  }

  return translated;
}

const emptyGate = (authoredType: string): DialogueConditionSnapshot => ({
  kind: "unread",
  compare: null,
  value: null,
  invert: false,
  subjects: [],
  participants: [],
  authoredType,
});

function gateView(gate: DialogueConditionSnapshot, context: ScriptContext): GateView {
  return {
    kind: gate.kind,
    compare: gate.compare,
    value: gate.value,
    invert: gate.invert,
    authoredType: gate.authoredType,
    // A subject the compendium does not publish, such as a race group, still belongs in the
    // sentence: dropping it would leave a gate that reads as a requirement with no object.
    subjects: gate.subjects.map((subject) => context.resolve(subject) ?? unresolvedLink(subject)),
    participants: gate.participants,
  };
}

function effectView(effect: DialogueEffectSnapshot, context: ScriptContext): EffectView {
  return {
    kind: effect.kind,
    amount: effect.amount,
    amountLabel: effect.amountLabel,
    authoredType: effect.authoredType,
    target:
      effect.target === null
        ? null
        : (context.resolve(effect.target) ?? unresolvedLink(effect.target)),
    participant: effect.participant,
  };
}

function resolveHolders(
  holders: DialogueHolderSnapshot[],
  resolve: EntityResolver,
): { kind: string; label: string | null; link: EntityLink | null }[] {
  return holders.map((holder) => ({
    kind: holder.kind,
    label: holder.label,
    link: holder.ref === null ? null : resolve(holder.ref),
  }));
}

/** The predicates a conversation emits, and the entity each one reaches. */
function* touchedEntities(
  nodes: Iterable<DialogueNodeSnapshot>,
  resolve: EntityResolver,
): Generator<[string, EntityLink | null, Record<string, unknown>]> {
  for (const node of nodes) {
    const gates = [node.gate, ...node.options.map((option) => option.gate)].filter(
      (gate): gate is DialogueConditionSnapshot => gate !== null && gate !== undefined,
    );
    for (const gate of gates) {
      for (const subject of gate.subjects) {
        yield ["dialogue_checks", resolve(subject), { nodeId: node.id, kind: gate.kind }];
      }
    }

    for (const effect of node.effects) {
      if (effect.target === null) continue;
      yield ["dialogue_changes", resolve(effect.target), { nodeId: node.id, kind: effect.kind }];
    }
  }
}

/**
 * What the reference names, when it resolves to no published entity.
 *
 * The authored name is what the game calls it, so a reader sees the subject rather than a blank.
 * No edge is emitted for it, because the compendium has no page to link.
 */
function unresolvedLink(ref: SnapshotRef): EntityLink {
  const name =
    (ref.kind === "lookupAsset" || ref.kind === "namedAsset") && ref.name !== undefined
      ? ref.name
      : "something the compendium does not publish";
  return { entityType: "unresolved", entityId: name, label: name, routePath: null };
}

type EntityResolver = (ref: SnapshotRef) => EntityLink | null;

/**
 * Resolves a reference to the page a reader can open.
 *
 * A reference resolves through the graph nodes, which every entity writes, so this needs no table
 * per entity type. A reference that resolves to nothing yields null, and the caller emits no edge
 * rather than inventing one.
 */
function prepareEntityResolver(db: Database): EntityResolver {
  const nodes = db
    .query<
      {
        entity_type: string;
        entity_id: string;
        display_label: string;
        route_path: string;
        has_page: number;
      },
      []
    >(`SELECT entity_type, entity_id, display_label, route_path, has_page FROM entity_nodes`)
    .all();
  const byId = new Map(nodes.map((node) => [`${node.entity_type}:${node.entity_id}`, node]));
  const byGuid = new Map(nodes.map((node) => [node.entity_id, node]));

  return (ref: SnapshotRef): EntityLink | null => {
    const candidates: string[] = [];
    if (ref.kind === "lookupAsset" && typeof ref.guid === "string") candidates.push(ref.guid);
    if (
      ref.kind === "namedAsset" &&
      typeof ref.name === "string" &&
      typeof ref.entity === "string"
    ) {
      candidates.push(`named;${ref.entity};${ref.name}`);
    }

    if (ref.kind === "record" && typeof ref.table === "string") {
      candidates.push(`${ref.table};${ref.subtable};${ref.id}`);
    }

    for (const candidate of candidates) {
      const node = byGuid.get(candidate) ?? byId.get(candidate);
      if (node === undefined) continue;
      return {
        entityType: node.entity_type,
        entityId: node.entity_id,
        label: node.display_label,
        routePath: node.has_page === 1 ? node.route_path : null,
      };
    }

    return null;
  };
}

/**
 * The name a reader knows the conversation by.
 *
 * A graph asset name is an internal identifier, so a holder's authored name is better when the
 * holders agree on one. They disagree when one graph serves several speakers, and electing one
 * speaker's name would state something the data does not.
 */
function dialogueLabel(
  row: DialogueRow,
  holders: DialogueHolderSnapshot[],
  resolve: EntityResolver,
): string {
  // A scene placement names the speaker a player reads on screen, a quest object names the role it
  // plays, and a character definition is an asset name unless the compendium published a label for
  // it. That is the order of usefulness.
  const order = [
    "scene-placement",
    "quest-character",
    "quest-character-group",
    "quest-scene-object",
    "character",
    "character-module",
  ];
  for (const kind of order) {
    for (const holder of holders.filter((candidate) => candidate.kind === kind)) {
      const resolved = holder.ref === null ? null : resolve(holder.ref);
      const name = resolved?.label ?? holder.label;
      if (name !== null && name !== undefined && name.trim().length > 0) return name;
    }
  }

  return row.graph_name;
}
