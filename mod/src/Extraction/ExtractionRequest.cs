namespace ArdenfallArchives.Extraction;

public sealed class ExtractionRequest
{
    public string OutputBaseDir { get; set; } = "";
    public string GameVersion { get; set; } = Game.GameInfo.SnapshotVersionSegment;
}
