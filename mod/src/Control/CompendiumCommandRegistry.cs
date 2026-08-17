using System;
using System.Collections.Generic;
using HotRepl.Control;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.Enchantment;
using ArdenfallCompendium.Entities.PotionRecipe;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.Spell;
using ArdenfallCompendium.Entities.StatusEffect;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Entities.ItemTag;
using ArdenfallCompendium.Entities.Location;
using ArdenfallCompendium.Entities.Portal;
using ArdenfallCompendium.Entities.Character;
using ArdenfallCompendium.Entities.CharacterRace;
using ArdenfallCompendium.Entities.Faction;
using ArdenfallCompendium.Entities.NameSet;
using ArdenfallCompendium.Entities.Npc;
using ArdenfallCompendium.Entities.Quest;
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
        var potionRecipes = new PotionRecipeExtractionService(new LoadedPotionRecipeAssetSource());
        var enchantments = new EnchantmentExtractionService(new LoadedEnchantmentAssetSource());
        var statusEffects = new StatusEffectExtractionService(new BuiltLookupTableStatusEffectAssetSource());
        var itemCategories = new ItemCategoryExtractionService(new LoadedItemCategoryAssetSource());
        var itemTags = new ItemTagExtractionService(new BuiltLookupTableItemTagAssetSource());
        var locations = new LocationExtractionService(new BuiltLookupTableLocationAssetSource());
        var portals = new PortalExtractionService(new MasterRecordTablePortalRecordSource());
        var characters = new CharacterExtractionService(new BuiltLookupTableCharacterAssetSource());
        var characterRaces = new CharacterRaceExtractionService(new LoadedCharacterRaceAssetSource());
        var factions = new FactionExtractionService(new BuiltLookupTableFactionAssetSource());
        var nameSets = new NameSetExtractionService(new LoadedNameSetAssetSource());
        var npcs = new NpcExtractionService(new MasterRecordTableNpcRecordSource());
        var quests = new QuestExtractionService(new LoadedQuestAssetSource());

        Register(new Handlers.CompendiumInfoCommand());
        Register(new Handlers.CompendiumPreflightCommand());
        Register(new Handlers.ContinueFromMenuCommand());
        Register(new Handlers.RunBeginCommand(runs, outputBaseDir));
        Register(new Handlers.RunStatusCommand(runs));
        Register(new Handlers.EntityPlanCommand(runs, items));
        Register(new Handlers.EntityExportBatchCommand(runs, items));
        Register(new Handlers.RunFinalizeCommand(runs, items, spells: spells, potionRecipes: potionRecipes, enchantments: enchantments, characters: characters, statusEffects: statusEffects, masterTooltip: MasterTooltip.RuntimeMasterTooltipSnapshotSource.Instance, statTypes: statTypes, itemCategories: itemCategories, itemTags: itemTags, locations: locations, portals: portals, factions: factions, npcs: npcs, quests: quests, characterRaces: characterRaces, nameSets: nameSets));
        Register(new Handlers.RunDiscardCommand(runs, new IExtractionCache[]
        {
            items,
            statTypes,
            spells,
            potionRecipes,
            enchantments,
            itemCategories,
            itemTags,
            locations,
            portals,
            characters,
            characterRaces,
            factions,
            nameSets,
            npcs,
            quests,
        }));
        Register(new Handlers.GameQuitCommand());

        // The operator commands share one live target and one session ledger, so a photo-mode disable
        // restores the flag an earlier enable recorded.
        var operatorTarget = new OperatorTools.UnityOperatorTarget();
        var operatorSession = new OperatorTools.OperatorSessionLedger();
        Register(new Handlers.OperatorStatusCommand(operatorTarget, operatorSession));
        Register(new Handlers.OperatorSetInvulnerableCommand(operatorTarget, operatorSession));
        Register(new Handlers.OperatorRecoverFromDeathCommand(operatorTarget));
        Register(new Handlers.OperatorTeleportCommand(operatorTarget));
        Register(new Handlers.OperatorSetPhotoModeCommand(operatorTarget, operatorSession));
        Register(new Handlers.OperatorSetTimescaleCommand(operatorTarget, operatorSession));
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
