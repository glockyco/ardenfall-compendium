using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control;

public sealed class CompendiumRun
{
    public string RunId { get; set; } = "";
    public string GameVersion { get; set; } = "unknown";
    public string OutputBaseDir { get; set; } = "";
    public string WorkspaceDir { get; set; } = "";
    public string? PublishedDir { get; set; }
    public string State { get; set; } = "open";
    public Dictionary<string, int> Counts { get; } = new();
    public Dictionary<string, CompendiumEntityRunPlan> EntityPlans { get; } = new();
    public bool Finalized => State == "finalized";

    public CompendiumEntityRunPlan SetEntityPlan(string entity, int total, int batchSize)
    {
        var plan = new CompendiumEntityRunPlan
        {
            Entity = entity,
            Total = total,
            BatchSize = batchSize,
        };
        EntityPlans[entity] = plan;
        return plan;
    }

    public bool TryGetEntityPlan(string entity, out CompendiumEntityRunPlan plan) =>
        EntityPlans.TryGetValue(entity, out plan!);

    public void MarkEntityChunkComplete(string entity, int offset, int written)
    {
        if (!EntityPlans.TryGetValue(entity, out var plan)) return;
        plan.MarkCompleted(offset, written);
        Counts[entity] = plan.CompletedRowCount;
    }
}

public sealed class CompendiumEntityRunPlan
{
    [JsonProperty("entity")] public string Entity { get; set; } = "";
    [JsonProperty("total")] public int Total { get; set; }
    [JsonProperty("batchSize")] public int BatchSize { get; set; }
    [JsonProperty("completedChunks")] public List<CompendiumEntityChunk> CompletedChunks { get; } = new();

    [JsonIgnore]
    public int CompletedRowCount => CompletedChunks.Sum(chunk => chunk.Written);

    public IEnumerable<int> ExpectedOffsets()
    {
        for (var offset = 0; offset < Total; offset += BatchSize)
            yield return offset;
    }

    public bool IsExpectedOffset(int offset) =>
        BatchSize > 0 && offset >= 0 && offset < Total && offset % BatchSize == 0;

    public bool IsComplete(int offset) => CompletedChunks.Any(chunk => chunk.Offset == offset);

    public void MarkCompleted(int offset, int written)
    {
        var existing = CompletedChunks.FirstOrDefault(chunk => chunk.Offset == offset);
        if (existing is not null)
        {
            existing.Written = written;
            return;
        }
        CompletedChunks.Add(new CompendiumEntityChunk { Offset = offset, Written = written });
        CompletedChunks.Sort((left, right) => left.Offset.CompareTo(right.Offset));
    }
}

public sealed class CompendiumEntityChunk
{
    [JsonProperty("offset")] public int Offset { get; set; }
    [JsonProperty("written")] public int Written { get; set; }
}
