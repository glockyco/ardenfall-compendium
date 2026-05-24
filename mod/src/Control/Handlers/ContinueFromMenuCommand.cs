using System;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;
using UnityEngine.UI;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class ContinueFromMenuCommand
    : IControlCommandHandler<EmptyArgs, ContinueFromMenuResult>
{
    public string Name => "compendium.continueFromMenu";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<ContinueFromMenuResult>> ExecuteAsync(
        ControlCommandContext<ContinueFromMenuResult> context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        foreach (var button in UnityObject.FindObjectsOfType<Button>())
        {
            if (button == null || !button.gameObject.activeInHierarchy || !button.interactable) continue;
            if (!IsContinueButton(button)) continue;

            button.onClick.Invoke();
            return new(
                ControlCommandResult.Ok(
                    new ContinueFromMenuResult
                    {
                        Clicked = true,
                        Button = HierarchyPath(button.transform),
                    }
                )
            );
        }

        return new(
            CompendiumCommandResults.Precondition(
                context,
                "continueButtonMissing",
                "No active interactable Continue button was found in the current Unity UI."
            )
        );
    }

    private static bool IsContinueButton(Button button)
    {
        if (ContainsContinue(button.name)) return true;
        var textComponents = button.GetComponentsInChildren<Text>(includeInactive: true);
        foreach (var text in textComponents)
        {
            if (text != null && ContainsContinue(text.text)) return true;
        }
        return false;
    }

    private static bool ContainsContinue(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Contains("continue", StringComparison.OrdinalIgnoreCase);

    private static string HierarchyPath(UnityEngine.Transform transform)
    {
        var path = transform.name;
        for (var current = transform.parent; current != null; current = current.parent)
        {
            path = current.name + "/" + path;
        }
        return path;
    }
}
