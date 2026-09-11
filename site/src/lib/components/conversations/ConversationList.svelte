<script lang="ts">
  let {
    conversations,
    heading,
  }: {
    conversations: { id: string; label: string; routePath: string; holderKind: string }[];
    heading: string;
  } = $props();

  /** How the game reaches the conversation from this page's subject. */
  const reach = (kind: string): string =>
    kind === "character"
      ? "From this character's definition"
      : kind === "character-module"
        ? "From a module of this character"
        : kind === "quest-character"
          ? "From a character of this quest"
          : kind === "quest-character-group"
            ? "From a character group of this quest"
            : kind === "quest-scene-object"
              ? "From a scene object of this quest"
              : "From a placement in the world";
</script>

{#if conversations.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">{heading}</h2>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2">
      {#each conversations as conversation (conversation.id)}
        <li class="border-border rounded-md border p-3 text-sm">
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
          <a class="underline underline-offset-2" href={conversation.routePath}
            >{conversation.label}</a
          >
          <span class="text-muted-foreground block text-xs">{reach(conversation.holderKind)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
