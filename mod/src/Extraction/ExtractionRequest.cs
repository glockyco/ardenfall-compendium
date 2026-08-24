namespace ArdenfallCompendium.Extraction;

public sealed class ExtractionRequest
{
    public string OutputBaseDir { get; set; } = "";
    public string GameVersion { get; set; } = Game.GameInfo.SnapshotVersionSegment;
    public string ProductName { get; set; } = "";
    public string BuildProfile { get; set; } = "";
}
