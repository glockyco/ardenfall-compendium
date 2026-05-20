using System;
using System.Collections.Generic;
using HotRepl.Control;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Extraction;

namespace ArdenfallCompendium.Control;

public sealed class CompendiumCommandRegistry : IDisposable
{
    private readonly List<IDisposable> _registrations = new();

    public CompendiumCommandRegistry(CompendiumRunManager runs, string outputBaseDir)
    {
        var items = new ItemExtractionService(new BuiltLookupTableItemAssetSource());
        var statTypes = new StatTypeExtractionService(new BuiltLookupTableStatTypeAssetSource());

        Register(new Handlers.CompendiumInfoCommand());
        Register(new Handlers.CompendiumPreflightCommand());
        Register(new Handlers.ContinueFromMenuCommand());
        Register(new Handlers.RunBeginCommand(runs, outputBaseDir));
        Register(new Handlers.RunStatusCommand(runs));
        Register(new Handlers.EntityPlanCommand(runs, items));
        Register(new Handlers.EntityExportBatchCommand(runs, items));
        Register(new Handlers.RunFinalizeCommand(runs, items, statTypes: statTypes));
        Register(new Handlers.RunDiscardCommand(runs));
        Register(new Handlers.GameQuitCommand());
    }

    private void Register(IControlCommandHandler handler)
    {
        _registrations.Add(GlobalControlCommandRegistry.Instance.Register(handler));
    }

    public void Dispose()
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear();
    }
}
