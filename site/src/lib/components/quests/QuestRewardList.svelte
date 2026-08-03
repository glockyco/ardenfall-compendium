<script lang="ts">
  import type { QuestReward } from "$lib/server/read-models";

  let { rewards }: { rewards: QuestReward[] } = $props();

  const amount = (reward: QuestReward): string => reward.amount?.trim() || "Amount unavailable";
</script>

<section class="border-border rounded-lg border p-5">
  <h2 class="font-semibold">Rewards</h2>

  {#if rewards.length === 0}
    <p class="text-muted-foreground mt-3 text-sm">No rewards recorded.</p>
  {:else}
    <ul class="mt-3 grid gap-3">
      {#each rewards as reward, rewardIndex (`${reward.kind}-${rewardIndex}`)}
        <li class="border-border bg-card rounded-lg border p-4">
          {#if reward.kind === "gold"}
            <p><span class="font-medium">Gold:</span> {amount(reward)}</p>
          {:else if reward.kind === "experience"}
            <p><span class="font-medium">Experience:</span> {amount(reward)}</p>
          {:else if reward.kind === "faction-reputation"}
            <p>
              <span class="font-medium">Faction reputation:</span>
              {#if reward.targetLabel && reward.targetRoutePath}
                <a class="underline underline-offset-2" href={reward.targetRoutePath}
                  >{reward.targetLabel}</a
                >
              {:else}
                {reward.targetLabel ?? "Faction not recorded"}
              {/if}
              <span class="text-muted-foreground"> ({amount(reward)})</span>
            </p>
          {:else if reward.kind === "character-reputation"}
            <p>
              <span class="font-medium">Character reputation:</span>
              {#if reward.targetLabel && reward.targetRoutePath}
                <a class="underline underline-offset-2" href={reward.targetRoutePath}
                  >{reward.targetLabel}</a
                >
              {:else}
                {reward.targetLabel ?? "Character not recorded"}
              {/if}
              <span class="text-muted-foreground"> ({amount(reward)})</span>
            </p>
          {:else}
            <p class="font-medium">Items</p>
            {#if reward.items.length > 0}
              <ul class="mt-2 list-inside list-disc">
                {#each reward.items as item, itemIndex (`${item.label}-${itemIndex}`)}
                  <li>
                    {#if item.routePath}
                      <a class="underline underline-offset-2" href={item.routePath}>{item.label}</a>
                    {:else}
                      {item.label}
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-muted-foreground mt-2 text-sm">No item names recorded.</p>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
