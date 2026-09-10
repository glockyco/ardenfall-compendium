namespace ArdenfallCompendium.Extraction;

public sealed class ExtractionRequest
{
    public string OutputBaseDir { get; set; } = "";
    public string GameVersion { get; set; } = Game.GameInfo.SnapshotVersionSegment;
    public string ProductName { get; set; } = "";

    /// <summary>Digest of the plugin assembly, captured when the plugin loaded.</summary>
    public string PluginSha256 { get; set; } = "";
    public string BuildProfile { get; set; } = "";
}
