<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import GateNote from "./GateNote.svelte";
  import OutcomeList from "./OutcomeList.svelte";
  import ScriptStep from "./ScriptStep.svelte";
  import type { DialogueScriptStep } from "$lib/server/entities/dialogue";

  let {
    step,
    depth = 0,
  }: {
    step: DialogueScriptStep;
    /** How far the step sits from an entry point. Choices open by default near the top only. */
    depth?: number;
  } = $props();

  /** What a fork reads before it picks an alternative. */
  const forkNote = (kind: string | undefined): string =>
    kind === "character-relationship"
      ? "The conversation forks on how the speaker feels about the player:"
      : kind === "faction-relationship"
        ? "The conversation forks on the player's standing with the faction:"
        : kind === undefined || kind === "unread"
          ? "The conversation forks on state the compendium cannot name:"
          : `The conversation forks on the ${kind} check:`;
</script>

<!--
  Each step carries the graph's own node id as an anchor, so a loop or a shared branch links to the
  place it returns to rather than repeating that part of the conversation.
-->
{#if step.kind === "speech"}
  <div class="border-border border-l-2 pl-3" id={`node-${step.nodeId}`}>
    {#if step.gate}
      <GateNote gate={step.gate} />
    {/if}
    {#each step.statements as statement, index (index)}
      <p class="mt-1"><RichText richText={statement} /></p>
    {/each}
    {#each step.next as next, index (index)}
      <ScriptStep step={next} depth={depth + 1} />
    {/each}
  </div>
{:else if step.kind === "choice"}
  <ul class="mt-3 grid gap-2" id={`node-${step.nodeId}`}>
    {#each step.options as option, index (`${option.port}-${index}`)}
      <li class="border-border rounded-md border p-3">
        <details open={depth < 3}>
          <summary class="cursor-pointer font-medium">{option.text || "Say nothing"}</summary>
          {#if option.gate}
            <GateNote gate={option.gate} />
          {/if}
          <div class="mt-2 grid gap-2">
            {#each option.next as next, nextIndex (nextIndex)}
              <ScriptStep step={next} depth={depth + 1} />
            {/each}
          </div>
        </details>
      </li>
    {/each}
  </ul>
{:else if step.kind === "branch"}
  <div class="mt-3 grid gap-2" id={`node-${step.nodeId}`}>
    <!--
      A branch's alternatives carry the meaning in their own labels, so the fork needs one line
      that says what the game reads, not a gate sentence that reads as a requirement.
    -->
    <p class="text-muted-foreground text-sm">{forkNote(step.gate?.kind)}</p>
    {#each step.alternatives as alternative, index (index)}
      <div class="border-border rounded-md border p-3">
        {#if alternative.gate}
          <!-- The branch names its own outputs, so the reader sees the check, not an index. -->
          <GateNote gate={alternative.gate} />
        {:else}
          <p class="text-muted-foreground text-xs uppercase">
            {alternative.label && alternative.label !== "ELSE"
              ? `If ${alternative.label}`
              : "Otherwise"}
          </p>
        {/if}
        {#each alternative.next as next, nextIndex (nextIndex)}
          <ScriptStep step={next} depth={depth + 1} />
        {/each}
      </div>
    {/each}
  </div>
{:else if step.kind === "condition"}
  <div class="border-border border-l-2 pl-3" id={`node-${step.nodeId}`}>
    <GateNote gate={step.gate} />
    {#each step.next as next, index (index)}
      <ScriptStep step={next} depth={depth + 1} />
    {/each}
  </div>
{:else if step.kind === "effects"}
  <div class="border-border border-l-2 pl-3" id={`node-${step.nodeId}`}>
    <OutcomeList outcomes={step.effects} />
    {#each step.next as next, index (index)}
      <ScriptStep step={next} depth={depth + 1} />
    {/each}
  </div>
{:else if step.kind === "end"}
  <p class="text-muted-foreground mt-1 text-xs uppercase" id={`node-${step.nodeId}`}>
    The conversation ends
  </p>
  {#each step.next as next, index (index)}
    <ScriptStep step={next} depth={depth + 1} />
  {/each}
{:else if step.kind === "jump"}
  <!--
    The game resolves this at runtime to the choice list the player last saw, so the page says
    that rather than naming a node the data does not name.
  -->
  <p class="text-muted-foreground mt-1 text-xs" id={`node-${step.nodeId}`}>
    Returns to the previous choices
  </p>
{:else if step.kind === "loop"}
  <p class="text-muted-foreground mt-1 text-xs">
    <a class="underline underline-offset-2" href={`#node-${step.targetNodeId}`}
      >Returns to an earlier point</a
    >
  </p>
{:else if step.kind === "reference"}
  <p class="text-muted-foreground mt-1 text-xs">
    <a class="underline underline-offset-2" href={`#node-${step.targetNodeId}`}
      >Continues where this conversation already went</a
    >
  </p>
{:else}
  <div class="border-border border-l-2 pl-3" id={`node-${step.nodeId}`}>
    <!--
      A node type the extraction does not read. Naming it keeps the gap visible rather than
      presenting a conversation that silently skips a step.
    -->
    <p class="text-muted-foreground mt-1 text-xs">
      The game runs {step.authoredType} here, which the compendium does not model.
    </p>
    {#each step.next as next, index (index)}
      <ScriptStep step={next} depth={depth + 1} />
    {/each}
  </div>
{/if}
