<script lang="ts">
  type Props = {
    title: string;
    fields: { id: string; label: string; value: unknown }[];
  };
  let { title, fields }: Props = $props();
</script>

<section class="border-border bg-secondary/40 rounded-md border p-4">
  <h2 class="text-lg font-semibold">{title}</h2>
  <p class="text-muted-foreground text-sm">Custom melee stats renderer.</p>
  <ul class="mt-2 text-sm">
    {#each fields as f (f.id)}
      <li><strong>{f.label}:</strong> {f.value ?? "—"}</li>
    {/each}
  </ul>
</section>
