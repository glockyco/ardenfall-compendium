<script lang="ts">
  import RichText from "./RichText.svelte";
  import type { DialogueGroup } from "$lib/server/entities/dialogue";

  let {
    groups,
    heading,
  }: {
    groups: DialogueGroup[];
    /** Names the side of the pair being listed: characters on a quest, quests on a character. */
    heading: string;
  } = $props();
</script>

{#if groups.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">{heading}</h2>
    <div class="mt-3 grid gap-4">
      {#each groups as group (group.id)}
        <div>
          <h3 class="text-sm font-medium">
            {#if group.routePath !== null}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
              <a class="underline underline-offset-2" href={group.routePath}>{group.label}</a>
            {:else}
              {group.label}
            {/if}
          </h3>
          <ul class="mt-2 grid gap-2 text-sm">
            {#each group.lines as line, index (`${group.id}-${index}`)}
              <li>
                <!--
                  A topic is what the player can raise; a greeting is what the character
                  opens with. Marking which is which keeps a bare line from reading as
                  though the character said it unprompted.
                -->
                <span class="text-muted-foreground mr-2 text-xs uppercase">
                  {line.kind === "topic" ? "Topic" : "Greeting"}
                </span>
                <RichText richText={line.text} />
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </section>
{/if}
