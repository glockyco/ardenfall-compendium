using System;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;
using UnityEngine.UI;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class ContinueFromMenuCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "compendium.continueFromMenu",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: CompendiumCommandSchemas.AnyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        foreach (var button in UnityObject.FindObjectsOfType<Button>())
        {
            if (button == null || !button.gameObject.activeInHierarchy || !button.interactable) continue;
            if (!IsContinueButton(button)) continue;

            button.onClick.Invoke();
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(new JObject
            {
                ["clicked"] = true,
                ["button"] = HierarchyPath(button.transform),
            }));
        }

        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition(
            "continueButtonMissing",
            "No active interactable Continue button was found in the current Unity UI."));
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
