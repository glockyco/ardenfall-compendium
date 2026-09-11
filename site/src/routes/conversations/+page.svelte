<script lang="ts">
  import ConversationOverview from "$lib/components/conversations/ConversationOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Conversations | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.conversations.length} authored conversations in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.conversationRoute} />
  <meta property="og:title" content="Conversations | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.conversations.length} authored conversations in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.conversationRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Conversations</h1>
<p class="text-muted-foreground mt-2">
  {data.conversations.length} authored conversations: what a speaker opens with, what a player can say,
  and what each choice causes.
</p>

<ConversationOverview rows={data.conversations} />
