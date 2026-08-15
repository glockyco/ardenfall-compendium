<script lang="ts">
  import AvailabilityNotice from "$lib/components/content/AvailabilityNotice.svelte";
  import type { AvailabilityFlag } from "$lib/components/content/availability-flags";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const questAvailability = (quest: {
    disabled: boolean;
    hiddenInQuestUi: boolean;
  }): AvailabilityFlag[] => [
    ...(quest.disabled ? [{ kind: "disabled" as const, subject: "quest" }] : []),
    ...(quest.hiddenInQuestUi ? [{ kind: "hidden-in-quest-ui" as const, subject: "quest" }] : []),
  ];
</script>

<svelte:head>
  <title>Quests | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.quests.length} quests in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.questRoute} />
  <meta property="og:title" content="Quests | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.quests.length} quests in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.questRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Quests</h1>
<p class="text-muted-foreground mt-2">{data.quests.length} authored quests.</p>

{#if data.quests.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.quests as quest (quest.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={quest.routePath}>
          <span class="block font-medium">{quest.name}</span>
          {#if quest.subname}
            <span class="text-muted-foreground mt-1 block text-sm">{quest.subname}</span>
          {/if}
        </a>
        <AvailabilityNotice flags={questAvailability(quest)} />
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No quests found.</p>
{/if}
