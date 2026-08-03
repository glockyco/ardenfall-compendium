using System;
using System.Collections.Generic;
using HotRepl.Control;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.Spell;
using ArdenfallCompendium.Entities.StatusEffect;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Entities.ItemTag;
using ArdenfallCompendium.Entities.Location;
using ArdenfallCompendium.Entities.Portal;
using ArdenfallCompendium.Entities.Character;
using ArdenfallCompendium.Extraction;

namespace ArdenfallCompendium.Control;

public sealed class CompendiumCommandRegistry : IDisposable
{
    private readonly List<IDisposable> _registrations = new();

    public CompendiumCommandRegistry(CompendiumRunManager runs, string outputBaseDir)
    {
        var items = new ItemExtractionService(new BuiltLookupTableItemAssetSource());
        var statTypes = new StatTypeExtractionService(new LoadedStatTypeAssetSource());
        var spells = new SpellExtractionService(new LoadedSpellAssetSource());
        var statusEffects = new StatusEffectExtractionService(new BuiltLookupTableStatusEffectAssetSource());
        var itemCategories = new ItemCategoryExtractionService(new LoadedItemCategoryAssetSource());
        var itemTags = new ItemTagExtractionService(new BuiltLookupTableItemTagAssetSource());
        var locations = new LocationExtractionService(new BuiltLookupTableLocationAssetSource());
        var portals = new PortalExtractionService(new MasterRecordTablePortalRecordSource());
        var characters = new CharacterExtractionService(new BuiltLookupTableCharacterAssetSource());

        Register(new Handlers.CompendiumInfoCommand());
        Register(new Handlers.CompendiumPreflightCommand());
        Register(new Handlers.ContinueFromMenuCommand());
        Register(new Handlers.RunBeginCommand(runs, outputBaseDir));
        Register(new Handlers.RunStatusCommand(runs));
        Register(new Handlers.EntityPlanCommand(runs, items));
        Register(new Handlers.EntityExportBatchCommand(runs, items));
        Register(new Handlers.RunFinalizeCommand(runs, items, spells: spells, characters: characters, statusEffects: statusEffects, masterTooltip: MasterTooltip.RuntimeMasterTooltipSnapshotSource.Instance, statTypes: statTypes, itemCategories: itemCategories, itemTags: itemTags, locations: locations, portals: portals));
        Register(new Handlers.RunDiscardCommand(runs, new IExtractionCache[]
        {
            items,
            statTypes,
            spells,
            statusEffects,
            itemCategories,
            itemTags,
            locations,
            portals,
            characters,
        }));
        Register(new Handlers.GameQuitCommand());
    }

    private void Register<TArgs, TOutput>(IControlCommandHandler<TArgs, TOutput> handler)
    {
        _registrations.Add(GlobalControlCommandRegistry.Instance.Register(handler));
    }

    public void Dispose()
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear();
    }
}
