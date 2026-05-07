namespace ArdenfallArchives.Triggers;

public static class Hotkey
{
    public static void Run(string outputDir, Plugin plugin) => plugin.RunExtractionFromAnyTrigger();
}
