<script lang="ts">
  import { resolve } from "$app/paths";
  import FieldList from "$lib/entity/sections/FieldList.svelte";
  import { sectionRegistry } from "$lib/entity/registry.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.name ?? "Item"} | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={resolve("/items")}>← back to items</a>
<h1 class="mt-2 text-2xl font-bold">{data.name ?? data.id}</h1>
{#if data.variant}
  <p class="text-muted-foreground">{data.variant}</p>
{/if}

<div class="mt-6 grid gap-4">
  {#each data.sections as section (section.id)}
    {#if section.kind === "fieldList"}
      <FieldList title={section.title} fields={section.fields} />
    {:else if section.rendererKey && sectionRegistry[section.rendererKey]}
      {@const Renderer = sectionRegistry[section.rendererKey]}
      <Renderer title={section.title} fields={section.fields} payload={section.payload} />
    {:else}
      <section class="border-destructive bg-destructive/10 rounded-md border p-4 text-sm">
        Unknown section renderer: <code>{section.rendererKey}</code>
      </section>
    {/if}
  {/each}
</div>
