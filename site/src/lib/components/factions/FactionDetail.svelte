<script lang="ts">
  import type { FactionPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: FactionPresentationRow } = $props();
</script>

<div class="border-border bg-card rounded-lg border p-5">
  {#if presentation.description}
    <section>
      <h2 class="font-semibold">Description</h2>
      <p class="mt-2 leading-7">{presentation.description}</p>
    </section>
  {:else}
    <p class="text-muted-foreground">No description available.</p>
  {/if}

  <dl class="mt-6 grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Can be allied with
      </dt>
      <dd class="mt-1">{presentation.alliable ? "Yes" : "No"}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Tracks reputation
      </dt>
      <dd class="mt-1">{presentation.enableReputation ? "Yes" : "No"}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Always shown in UI
      </dt>
      <dd class="mt-1">{presentation.alwaysShowInUI ? "Yes" : "No"}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Can be disguised as
      </dt>
      <dd class="mt-1">{presentation.canBeDisguised ? "Yes" : "No"}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Issues bounties
      </dt>
      <dd class="mt-1">{presentation.enableBounty ? "Yes" : "No"}</dd>
    </div>
  </dl>
</div>
