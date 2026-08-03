<script lang="ts">
  import type { QuestPhase } from "$lib/server/read-models";

  let { phases }: { phases: QuestPhase[] } = $props();

  const text = (value: string | null): string => value?.trim() ?? "";
</script>

<section class="border-border rounded-lg border p-5">
  <h2 class="font-semibold">Phases</h2>

  {#if phases.length === 0}
    <p class="text-muted-foreground mt-3 text-sm">No phases recorded.</p>
  {:else}
    <ol class="mt-4 grid gap-6">
      {#each phases as phase, phaseIndex (`${phase.phaseGameId}-${phaseIndex}`)}
        <li class="border-border border-t pt-5 first:border-t-0 first:pt-0">
          <h3 class="text-lg font-semibold">
            Phase {phaseIndex + 1}{phase.name?.trim() ? `: ${phase.name.trim()}` : ""}
          </h3>

          {#if text(phase.journalEntry)}
            <div class="mt-3">
              <h4 class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Journal entry
              </h4>
              <p class="mt-1 leading-7">{phase.journalEntry}</p>
            </div>
          {/if}

          {#if text(phase.completedJournalEntry)}
            <div class="mt-3">
              <h4 class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Completed journal entry
              </h4>
              <p class="mt-1 leading-7">{phase.completedJournalEntry}</p>
            </div>
          {/if}

          <div class="mt-4">
            <h4 class="font-medium">Objectives</h4>
            {#if phase.objectives.length === 0}
              <p class="text-muted-foreground mt-2 text-sm">No objectives recorded.</p>
            {:else}
              <ol class="mt-2 grid gap-3">
                {#each phase.objectives as objective, objectiveIndex (`${objective.objectiveGameId}-${objectiveIndex}`)}
                  <li class="border-border bg-card rounded-lg border p-4">
                    <h5 class="font-medium">
                      Objective {objectiveIndex + 1}{objective.name?.trim()
                        ? `: ${objective.name.trim()}`
                        : ""}
                    </h5>
                    {#if objective.hidden}
                      <p class="text-muted-foreground mt-1 text-sm">Hidden objective</p>
                    {/if}
                    {#if text(objective.info)}
                      <p class="mt-3 leading-7">{objective.info}</p>
                    {/if}
                    {#if text(objective.journalEntry)}
                      <p class="text-muted-foreground mt-3 text-sm leading-6">
                        <span class="font-medium">Journal:</span>
                        {objective.journalEntry}
                      </p>
                    {/if}
                    {#if text(objective.successJournalEntry)}
                      <p class="text-muted-foreground mt-2 text-sm leading-6">
                        <span class="font-medium">Success:</span>
                        {objective.successJournalEntry}
                      </p>
                    {/if}
                    {#if text(objective.failureJournalEntry)}
                      <p class="text-muted-foreground mt-2 text-sm leading-6">
                        <span class="font-medium">Failure:</span>
                        {objective.failureJournalEntry}
                      </p>
                    {/if}
                  </li>
                {/each}
              </ol>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>
