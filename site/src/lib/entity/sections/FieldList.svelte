<script lang="ts">
  type Props = {
    title: string;
    fields: { id: string; label: string; value: unknown }[];
  };
  let { title, fields }: Props = $props();
</script>

<section class="border-border bg-secondary/40 rounded-md border p-4">
  <h2 class="text-lg font-semibold">{title}</h2>
  <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
    {#each fields as f (f.id)}
      <dt class="text-muted-foreground">{f.label}</dt>
      <dd>{f.value ?? "—"}</dd>
    {/each}
  </dl>
</section>
