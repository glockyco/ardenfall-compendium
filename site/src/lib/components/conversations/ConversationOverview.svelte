<script lang="ts">
  import type { DialogueOverviewRow } from "$lib/server/entities/dialogue";

  let { rows }: { rows: DialogueOverviewRow[] } = $props();
  const count = (value: number, one: string, many: string) =>
    value === 1 ? `1 ${one}` : `${value} ${many}`;
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as conversation (conversation.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="block underline-offset-4 hover:underline" href={conversation.routePath}>
          <span class="block font-medium">{conversation.name}</span>
        </a>
        {#if conversation.context}
          <p class="text-muted-foreground text-xs">{conversation.context}</p>
        {/if}
        <p class="text-muted-foreground mt-1 text-sm">
          {count(conversation.statementCount, "line", "lines")} · {count(
            conversation.optionCount,
            "choice",
            "choices",
          )}
        </p>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No conversations found.</p>
{/if}
