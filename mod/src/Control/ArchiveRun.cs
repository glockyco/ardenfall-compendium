using System.Collections.Generic;

namespace ArdenfallArchives.Control;

public sealed class ArchiveRun
{
    public string RunId { get; set; } = "";
    public string GameVersion { get; set; } = ArdenfallArchives.Game.GameInfo.SnapshotVersionSegment;
    public string OutputBaseDir { get; set; } = "";
    public string WorkspaceDir { get; set; } = "";
    public string? PublishedDir { get; set; }
    public string State { get; set; } = "open";
    public Dictionary<string, int> Counts { get; } = new();
    public bool Finalized => State == "finalized";
}
