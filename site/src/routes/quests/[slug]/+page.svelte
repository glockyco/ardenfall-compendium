<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import EntityDetailHeader from "$lib/components/EntityDetailHeader.svelte";
  import QuestPhaseList from "$lib/components/quests/QuestPhaseList.svelte";
  import QuestRewardList from "$lib/components/quests/QuestRewardList.svelte";
  import AvailabilityNotice from "$lib/components/content/AvailabilityNotice.svelte";
  import DialogueSection from "$lib/components/content/DialogueSection.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const quest = $derived(data.presentation);

  const text = (value: string | null): string => value?.trim() ?? "";
</script>

<svelte:head>
  <title>{quest.name} | Quests | Ardenfall Compendium</title>
  <meta
    name="description"
    content={quest.subname || `${quest.name} in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={quest.routePath} />
  <meta property="og:title" content={`${quest.name} | Quests | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={quest.subname || `${quest.name} in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={quest.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.questRoute} label="quests" />
<EntityDetailHeader title={quest.name} iconSrc={null} />
<AvailabilityNotice disabled={quest.disabled} hiddenInQuestUi={quest.hiddenInQuestUi} />

{#if quest.subname}
  <p class="text-muted-foreground mt-2 text-lg">{quest.subname}</p>
{/if}

<div class="mt-4 grid gap-6">
  <section class="border-border rounded-lg border p-5">
    <h2 class="font-semibold">Journal text</h2>
    {#if text(quest.journalOnStart) || text(quest.journalOnSucceed) || text(quest.journalOnFailure)}
      <dl class="mt-4 grid gap-4">
        {#if text(quest.journalOnStart)}
          <div>
            <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              On start
            </dt>
            <dd class="mt-1 leading-7">{quest.journalOnStart}</dd>
          </div>
        {/if}
        {#if text(quest.journalOnSucceed)}
          <div>
            <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              On success
            </dt>
            <dd class="mt-1 leading-7">{quest.journalOnSucceed}</dd>
          </div>
        {/if}
        {#if text(quest.journalOnFailure)}
          <div>
            <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              On failure
            </dt>
            <dd class="mt-1 leading-7">{quest.journalOnFailure}</dd>
          </div>
        {/if}
      </dl>
    {:else}
      <p class="text-muted-foreground mt-3 text-sm">No journal text recorded.</p>
    {/if}
  </section>

  <QuestPhaseList phases={quest.phases} />
  <QuestRewardList rewards={quest.rewards} />
  <DialogueSection groups={quest.dialogue} heading="Dialogue" />

  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
