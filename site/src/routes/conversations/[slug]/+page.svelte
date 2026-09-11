<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import ConversationDetail from "$lib/components/conversations/ConversationDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const conversation = $derived(data.presentation);
</script>

<svelte:head>
  <title>{conversation.name} | Conversations | Ardenfall Compendium</title>
  <meta name="description" content={`${conversation.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={conversation.routePath} />
  <meta
    property="og:title"
    content={`${conversation.name} | Conversations | Ardenfall Compendium`}
  />
  <meta property="og:description" content={`${conversation.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={conversation.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.conversationRoute} label="conversations" />
<h1 class="mt-2 text-2xl font-bold">{conversation.name}</h1>

<ConversationDetail presentation={conversation} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
