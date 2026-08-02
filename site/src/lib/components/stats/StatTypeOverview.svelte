<script lang="ts">
  import type { StatTypeOverviewRow } from "$lib/server/read-models";
  type StatGroup = StatTypeOverviewRow["grouping"];

  let { rows }: { rows: StatTypeOverviewRow[] } = $props();

  const groupLabels: Record<StatGroup, string> = {
    attribute: "Attributes",
    skill: "Skills",
  };
  const groups = ["attribute", "skill"] as const;
  const groupedRows = $derived(
    groups.map((group) => ({
      group,
      label: groupLabels[group],
      rows: rows.filter((row) => row.grouping === group),
    })),
  );
</script>

{#each groupedRows as group (group.group)}
  {#if group.rows.length > 0}
    <section class="mt-8">
      <h2 class="text-xl font-semibold">{group.label}</h2>
      <ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.rows as row (row.id)}
          <li class="border-border bg-card rounded-lg border p-4">
            <a
              class="flex items-start gap-3 underline-offset-4 hover:underline"
              href={row.routePath}
            >
              <span
                class="border-border bg-muted flex size-8 shrink-0 items-center justify-center rounded border"
                style:background-color={row.iconColor ?? undefined}
                aria-hidden="true"
              >
                {#if row.iconSrc}
                  <img
                    class="size-6 object-contain"
                    src={row.iconSrc}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                {/if}
              </span>
              <span>
                <span class="block font-medium">{row.name}</span>
                <span class="text-muted-foreground text-sm">{row.grouping}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/each}

{#if rows.length === 0}
  <p class="text-muted-foreground mt-4">No stats found.</p>
{/if}
