using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item.Adapters;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using ArdenfallCompendium.Walker;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemAdapterBehaviorTests
{
    [Fact]
    public void ResolvedReferenceSlotUsesSnapshotRefJsonShape()
    {
        var asset = (StatusEffectData)RuntimeHelpers.GetUninitializedObject(typeof(StatusEffectData));
        var resolved = ItemAdapterHelpers.ResolveOptionalAsset(new RefResolver(), asset, "statusEffectRef", "fixture", "StatusEffectData.statusEffect");
        Assert.IsType<SnapshotRef>(resolved);

        var reference = SnapshotRef.LookupAsset("status-guid", "Ardenfall.StatusEffectData", "Burning");
        var snapshot = new LeveledStatusEffectSnapshot(reference, 2, 30, null);

        Assert.IsType<SnapshotRef>(snapshot.StatusEffectRef);

        var parsed = JObject.Parse(JsonConvert.SerializeObject(snapshot, JsonSettings.Default));
        Assert.Equal("lookupAsset", parsed["statusEffectRef"]?["kind"]?.Value<string>());
        Assert.Equal("status-guid", parsed["statusEffectRef"]?["guid"]?.Value<string>());
        Assert.Equal("Ardenfall.StatusEffectData", parsed["statusEffectRef"]?["unityType"]?.Value<string>());
        Assert.Equal("Burning", parsed["statusEffectRef"]?["name"]?.Value<string>());
    }

    [Fact]
    public void NamedDefinitionRefsUseNamedAssetSnapshotVariant()
    {
        var stat = (StatType)RuntimeHelpers.GetUninitializedObject(typeof(StatType));
        var category = (ItemCategory)RuntimeHelpers.GetUninitializedObject(typeof(ItemCategory));
        var refs = new RefResolver(
            assetName: asset => ReferenceEquals(asset, stat) ? "att_strength" : "itemcat_weapons",
            isUnityNull: _ => false);

        var statRef = refs.ResolveAsset(stat, "statTypeRef", "item-row", MissingPolicy.Diagnostic);
        var categoryRef = refs.ResolveAsset(category, "categoryRef", "item-row", MissingPolicy.Diagnostic);

        Assert.Equal("namedAsset", statRef.Kind);
        Assert.Equal("stat-type", statRef.Entity);
        Assert.Equal("att_strength", statRef.Name);
        Assert.Equal("namedAsset", categoryRef.Kind);
        Assert.Equal("item-category", categoryRef.Entity);
        Assert.Equal("itemcat_weapons", categoryRef.Name);
        Assert.DoesNotContain(refs.Diagnostics, d => d.Code == "lookupAssetGuidMissing");
    }

    [Fact]
    public void EngineResourceRefDoesNotDiagnoseMissingLookupGuid()
    {
        var sprite = (Sprite)RuntimeHelpers.GetUninitializedObject(typeof(Sprite));
        var lookupCalled = false;
        var refs = new RefResolver(
            isUnityNull: _ => false,
            lookupGuid: _ =>
            {
                lookupCalled = true;
                return null;
            });

        var resolved = refs.ResolveAsset(sprite, "iconRef", "item-row", MissingPolicy.Diagnostic);

        Assert.Equal("missing", resolved.Kind);
        Assert.Equal("engineResource", resolved.Reason);
        Assert.Equal("iconRef", resolved.Source);
        Assert.Empty(refs.Diagnostics);
        Assert.False(lookupCalled);
    }

    [Fact]
    public void UnregisteredArdenfallAssetStillDiagnosesMissingLookupGuid()
    {
        var spellData = (SpellData)RuntimeHelpers.GetUninitializedObject(typeof(SpellData));
        var refs = new RefResolver(
            isUnityNull: _ => false,
            lookupGuid: _ => null);

        var resolved = refs.ResolveAsset(spellData, "spellRef", "item-row", MissingPolicy.Diagnostic);

        Assert.Equal("missing", resolved.Kind);
        Assert.Equal("lookupAssetGuidMissing", resolved.Reason);
        var diagnostic = Assert.Single(refs.Diagnostics);
        Assert.Equal("lookupAssetGuidMissing", diagnostic.Code);
    }

    [Fact]
    public void NullAssetRefKeepsNullAssetReason()
    {
        var refs = new RefResolver();

        var resolved = refs.ResolveAsset(null, "iconRef", "item-row", MissingPolicy.Diagnostic);

        Assert.Equal("missing", resolved.Kind);
        Assert.Equal("nullAsset", resolved.Reason);
        var diagnostic = Assert.Single(refs.Diagnostics);
        Assert.Equal("nullAsset", diagnostic.Code);
    }

    [Fact]
    public void LeveledStatusEffectSnapshotIncludesStructuredStackMode()
    {
        var stackMode = new StatusEffectData.StackMode
        {
            type = StatusEffectData.StackModeType.AddLevel,
            addLevel = 1,
            maxLevel = 5,
        };
        var effect = new LeveledStatusEffect(statusEffect: null, level: 2, lifetime: 30, stackMode);

        var dto = ItemAdapterHelpers.SnapshotLeveledStatusEffect(effect, refs: null, rowId: "fixture");
        Assert.NotNull(dto);

        Assert.Equal("AddLevel", dto.StackMode?.Type);
        Assert.Equal(1, dto.StackMode?.AddLevel);
        Assert.Equal(5, dto.StackMode?.MaxLevel);
    }

    [Fact]
    public void PotionRecipeSnapshotDoesNotReadRecipeNameWhenInvalid()
    {
        var recipe = (PotionRecipe)RuntimeHelpers.GetUninitializedObject(typeof(PotionRecipe));
        recipe.drinkablePotions = new List<ThrowingPotionData>();
        recipe.throwingPotions = new List<ThrowingPotionData>();
        recipe.recipe = new List<RecipeItem>();

        var dto = ItemAdapterHelpers.SnapshotPotionRecipe(recipe, refs: null, rowId: "fixture");
        Assert.NotNull(dto);

        Assert.False(dto.IsValid);
        Assert.False(dto.HasDrinkingPotions);
        Assert.False(dto.HasThrowingPotions);
        Assert.Null(dto.RecipeName);
    }

    [Fact]
    public void LeveledSpellSnapshotUsesBehaviorDerivedSecondaryLevel()
    {
        var spell = (SpellData)RuntimeHelpers.GetUninitializedObject(typeof(SpellData));
        spell.spellName = "Spark";
        spell.subSpells = new List<SpellData.SubSpellData>();
        var leveled = new LeveledSpellData { spellData = spell, level = 3 };
        typeof(LeveledSpellData)
            .GetField("enableSecondaryLevel", BindingFlags.Instance | BindingFlags.NonPublic)!
            .SetValue(leveled, true);
        typeof(LeveledSpellData)
            .GetField("secondaryLevel", BindingFlags.Instance | BindingFlags.NonPublic)!
            .SetValue(leveled, 7f);

        var dto = ItemAdapterHelpers.SnapshotLeveledSpellData(leveled, refs: null, rowId: "fixture");

        Assert.Equal(3, dto?.Level);
        Assert.Equal(7, dto?.SecondaryLevel);
        Assert.Equal("Spark", dto?.SpellName);
    }


    [Fact]
    public void ThrowingPotionEffectNameReturnsNullWhenFirstStatusEffectMissing()
    {
        var effects = new[] { new LeveledStatusEffect(statusEffect: null, level: 2.5f, lifetime: 10f) };

        Assert.Null(ExtractThrowingPotion.GetEffectNameSafe(effects, visualLevel: 0));
    }


    [Fact]
    public void ColorSnapshotSerializesRgbaChannels()
    {
        var color = new Color(0.1f, 0.2f, 0.3f, 0.4f);

        var dto = ItemAdapterHelpers.SnapshotColor(color);

        Assert.Equal(0.1f, dto.R);
        Assert.Equal(0.2f, dto.G);
        Assert.Equal(0.3f, dto.B);
        Assert.Equal(0.4f, dto.A);
    }

    [Fact]
    public void ItemTagRefsSkipAndDiagnoseAssetsMissingLookupGuid()
    {
        var tag = (ItemTag)RuntimeHelpers.GetUninitializedObject(typeof(ItemTag));
        tag.tagName = "Readable tag";
        var refs = new RefResolver();

        var tagId = ExtractItem.ResolveTagRef(tag, refs, "item-guid", _ => null);

        Assert.Null(tagId);
        Assert.Contains(refs.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "tags");
    }

    [Fact]
    public void CategoryNameForFallbackUsesResolvedCategoryName()
    {
        var category = (ItemCategory)RuntimeHelpers.GetUninitializedObject(typeof(ItemCategory));
        category.categoryName = "Weapons";

        Assert.Equal("Weapons", ExtractItem.CategoryNameForFallback(category));
        Assert.Null(ExtractItem.CategoryNameForFallback(null));
    }

    [Fact]
    public void EquipmentStatTypeLabelUsesDisplayName()
    {
        var statType = (StatType)RuntimeHelpers.GetUninitializedObject(typeof(StatType));
        statType.id = "sk_armor-light";
        statType.statName = "Light Armor";

        Assert.Equal("Light Armor", ExtractEquipment.StatTypeLabel(statType));
    }

    [Fact]
    public void SlateSpellRequirementStatTypeFallsBackToSpellStatType()
    {
        var spellStatType = (StatType)RuntimeHelpers.GetUninitializedObject(typeof(StatType));
        spellStatType.statName = "Night Eye";
        var spellData = (SpellData)RuntimeHelpers.GetUninitializedObject(typeof(SpellData));
        spellData.statType = spellStatType;
        var spell = new LeveledSpellData { spellData = spellData, level = 3 };

        Assert.Equal("Night Eye", ExtractSlateSpell.RequirementStatTypeLabel(equipStatType: null, spell));
        Assert.Equal("Night Eye Scroll", ExtractSlateSpell.ItemTypeLabel(spell, SpellItemType.Scroll));
    }

}
