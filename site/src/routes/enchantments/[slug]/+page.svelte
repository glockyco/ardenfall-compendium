<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import EnchantmentDetail from "$lib/components/enchantments/EnchantmentDetail.svelte";
  import EntityDetailHeader from "$lib/components/EntityDetailHeader.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const enchantment = $derived(data.presentation);
</script>

<svelte:head>
  <title>{enchantment.name} | Enchantments | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`${enchantment.name} enchantment in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={enchantment.routePath} />
  <meta property="og:title" content={`${enchantment.name} | Enchantments | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={`${enchantment.name} enchantment in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={enchantment.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.enchantmentRoute} label="enchantments" />
<EntityDetailHeader title={enchantment.name} iconSrc={null} />
<EnchantmentDetail {enchantment} />
<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
