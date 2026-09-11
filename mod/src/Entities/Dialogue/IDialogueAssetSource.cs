namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>Where the conversations of the loaded assets come from.</summary>
public interface IDialogueAssetSource
{
    DialogueAssetSourceResult Read();
}

/// <summary>A source for a caller that publishes no asset-held conversation.</summary>
public sealed class EmptyDialogueAssetSource : IDialogueAssetSource
{
    public static readonly EmptyDialogueAssetSource Instance = new();

    public DialogueAssetSourceResult Read() =>
        new(
            System.Array.Empty<DialogueFields>(),
            new System.Collections.Generic.Dictionary<string, int>(),
            new System.Collections.Generic.Dictionary<string, int>(),
            System.Array.Empty<Dtos.Diagnostic>());
}
