using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public sealed record ItemAdapterResult(
    Dictionary<string, object?> Fields,
    Dictionary<string, Provenance> Provenance,
    List<Diagnostic> Diagnostics);

public sealed record StackModeSnapshot(
    [property: JsonProperty("type")] string? Type,
    [property: JsonProperty("addLevel")] float AddLevel,
    [property: JsonProperty("maxLevel")] float MaxLevel);

public sealed record LeveledStatusEffectSnapshot(
    [property: JsonProperty("statusEffectRef")] object? StatusEffectRef,
    [property: JsonProperty("level")] float Level,
    [property: JsonProperty("lifetime")] float Lifetime,
    [property: JsonProperty("stackMode")] StackModeSnapshot? StackMode);

public sealed record NoteSectionSnapshot(
    [property: JsonProperty("textContent")] string? TextContent,
    [property: JsonProperty("imageRef")] object? ImageRef,
    [property: JsonProperty("separator")] bool Separator);

public sealed record RecipeIngredientSnapshot(
    [property: JsonProperty("tagRef")] object? TagRef,
    [property: JsonProperty("count")] int Count);

public sealed record PotionRecipeSnapshot(
    [property: JsonProperty("recipeName")] string? RecipeName,
    [property: JsonProperty("isValid")] bool IsValid,
    [property: JsonProperty("hasDrinkingPotions")] bool HasDrinkingPotions,
    [property: JsonProperty("hasThrowingPotions")] bool HasThrowingPotions,
    [property: JsonProperty("lockedByDefault")] bool LockedByDefault,
    [property: JsonProperty("enableSkillRequirement")] bool EnableSkillRequirement,
    [property: JsonProperty("skillRequirement")] int SkillRequirement,
    [property: JsonProperty("levelModifier")] float LevelModifier,
    [property: JsonProperty("successModifier")] float SuccessModifier,
    [property: JsonProperty("ingredients")] List<RecipeIngredientSnapshot> Ingredients,
    [property: JsonProperty("drinkablePotionRefs")] List<object?> DrinkablePotionRefs,
    [property: JsonProperty("throwingPotionRefs")] List<object?> ThrowingPotionRefs);

public static class ItemAdapterHelpers
{
    public static ItemAdapterResult EmptyResult() =>
        new(new Dictionary<string, object?>(System.StringComparer.Ordinal), new Dictionary<string, Provenance>(System.StringComparer.Ordinal), new List<Diagnostic>());

    public static List<Diagnostic> DrainDiagnostics(RefResolver refs)
    {
        var diagnostics = new List<Diagnostic>(refs.Diagnostics);
        refs.Diagnostics.Clear();
        return diagnostics;
    }

    public static object? ResolveOptionalAsset(RefResolver? refs, Object? asset, string field, string rowId, string source)
    {
        if (ReferenceEquals(asset, null) || refs == null) return null;
        return refs.ResolveAsset(asset, field, rowId, MissingPolicy.Diagnostic, source);
    }

    public static LeveledStatusEffectSnapshot? SnapshotLeveledStatusEffect(LeveledStatusEffect? effect, RefResolver? refs, string rowId)
    {
        if (effect == null) return null;
        var stackMode = effect.StackMode;
        var stackModeSnapshot = stackMode == null
            ? null
            : new StackModeSnapshot(stackMode.type.ToString(), stackMode.addLevel, stackMode.maxLevel);

        return new LeveledStatusEffectSnapshot(
            ResolveOptionalAsset(refs, effect.StatusEffect, "statusEffectRef", rowId, "LeveledStatusEffect.StatusEffect"),
            effect.Level,
            effect.Lifetime,
            stackModeSnapshot);
    }

    public static List<LeveledStatusEffectSnapshot> SnapshotLeveledStatusEffects(LeveledStatusEffect[]? effects, RefResolver? refs, string rowId)
    {
        var snapshots = new List<LeveledStatusEffectSnapshot>();
        if (effects == null) return snapshots;
        foreach (var effect in effects)
        {
            var snapshot = SnapshotLeveledStatusEffect(effect, refs, rowId);
            if (snapshot != null) snapshots.Add(snapshot);
        }
        return snapshots;
    }

    public static PotionRecipeSnapshot? SnapshotPotionRecipe(PotionRecipe? recipe, RefResolver? refs, string rowId)
    {
        if (ReferenceEquals(recipe, null)) return null;

        var hasDrinkingPotions = recipe.HasDrinkingPotions;
        var hasThrowingPotions = recipe.HasThrowingPotions;
        var hasPotionNameSource = HasPotionNameSource(recipe);
        var isValid = recipe.IsValid && hasPotionNameSource;
        var recipeName = isValid ? recipe.RecipeName : null;

        return new PotionRecipeSnapshot(
            recipeName,
            isValid,
            hasDrinkingPotions,
            hasThrowingPotions,
            recipe.lockedByDefault,
            recipe.enableSkillRequirement,
            recipe.skillRequirement,
            recipe.levelModifier,
            recipe.successModifier,
            SnapshotRecipeIngredients(recipe.recipe, refs, rowId),
            SnapshotRefs(recipe.drinkablePotions, refs, "drinkablePotionRefs", rowId, "PotionRecipe.drinkablePotions"),
            SnapshotRefs(recipe.throwingPotions, refs, "throwingPotionRefs", rowId, "PotionRecipe.throwingPotions"));
    }

    public static List<RecipeIngredientSnapshot> SnapshotRecipeIngredients(List<RecipeItem>? ingredients, RefResolver? refs, string rowId)
    {
        var snapshots = new List<RecipeIngredientSnapshot>();
        if (ingredients == null) return snapshots;
        foreach (var ingredient in ingredients)
        {
            if (ingredient == null) continue;
            snapshots.Add(new RecipeIngredientSnapshot(
                ResolveOptionalAsset(refs, ingredient.tag, "ingredientTagRef", rowId, "RecipeItem.tag"),
                ingredient.count));
        }
        return snapshots;
    }

    private static bool HasPotionNameSource(PotionRecipe recipe) =>
        (recipe.drinkablePotions != null && recipe.drinkablePotions.Count > 0 && !ReferenceEquals(recipe.drinkablePotions[0], null)) ||
        (recipe.throwingPotions != null && recipe.throwingPotions.Count > 0 && !ReferenceEquals(recipe.throwingPotions[0], null));

    public static List<NoteSectionSnapshot> SnapshotNoteSections(NoteItem.NoteContents? contents, RefResolver? refs, string rowId)
    {
        var snapshots = new List<NoteSectionSnapshot>();
        if (contents?.sections == null) return snapshots;
        foreach (var section in contents.sections)
        {
            if (section == null) continue;
            snapshots.Add(new NoteSectionSnapshot(
                section.textContent,
                ResolveOptionalAsset(refs, section.imageContent, "noteSectionImageRef", rowId, "NoteSection.imageContent"),
                section.separator));
        }
        return snapshots;
    }

    public static List<object?> SnapshotRefs<T>(List<T>? assets, RefResolver? refs, string field, string rowId, string source)
        where T : Object
    {
        var snapshots = new List<object?>();
        if (assets == null) return snapshots;
        foreach (var asset in assets)
        {
            snapshots.Add(ResolveOptionalAsset(refs, asset, field, rowId, source));
        }
        return snapshots;
    }
}
