using HotRepl.Control;

namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>
/// The live targets an operator command needs before it changes anything. A missing target is a named
/// precondition failure, never an unhandled exception.
/// </summary>
public static class OperatorPreconditions
{
    public const string CharacterMissingCode = "playerCharacterMissing";

    public const string GameMissingCode = "gameInstanceMissing";

    public static ControlCommandResult<TOutput>? RequireCharacter<TOutput>(
        ControlCommandContext<TOutput> context,
        IOperatorTarget target
    ) =>
        target.HasCharacter
            ? null
            : CompendiumCommandResults.Precondition(
                context,
                CharacterMissingCode,
                "No live player character is available. Load the world with compendium.continueFromMenu first."
            );

    public static ControlCommandResult<TOutput>? RequireGame<TOutput>(
        ControlCommandContext<TOutput> context,
        IOperatorTarget target
    ) =>
        target.HasGame
            ? null
            : CompendiumCommandResults.Precondition(
                context,
                GameMissingCode,
                "No live game instance is available. Load the world with compendium.continueFromMenu first."
            );
}
