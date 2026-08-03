using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractPotionRecipe
{
    public static ItemAdapterResult Extract(PotionRecipeItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);

        var recipe = asset.recipe.Get();
        var recipeIsSet = asset.recipe.IsSet;
        var recipeSnapshot = ItemAdapterHelpers.SnapshotPotionRecipe(recipe, refs, rowId);

        fields["recipeRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, recipe, "recipeRef", rowId, "PotionRecipeItemData.recipe");
        fields["recipeName"] = recipeSnapshot?.RecipeName;
        fields["isValid"] = recipeSnapshot?.IsValid ?? false;
        fields["hasDrinkingPotions"] = recipeSnapshot?.HasDrinkingPotions ?? false;
        fields["hasThrowingPotions"] = recipeSnapshot?.HasThrowingPotions ?? false;
        fields["lockedByDefault"] = recipeSnapshot?.LockedByDefault ?? false;
        fields["enableSkillRequirement"] = recipeSnapshot?.EnableSkillRequirement ?? false;
        fields["skillRequirement"] = recipeSnapshot?.SkillRequirement ?? 0;
        fields["levelModifier"] = recipeSnapshot?.LevelModifier ?? 0f;
        fields["successModifier"] = recipeSnapshot?.SuccessModifier ?? 0f;
        fields["ingredientsJson"] = recipeSnapshot?.Ingredients ?? new List<RecipeIngredientSnapshot>();
        fields["drinkablePotionRefsJson"] = recipeSnapshot?.DrinkablePotionRefs ?? new List<SnapshotRef?>();
        fields["throwingPotionRefsJson"] = recipeSnapshot?.ThrowingPotionRefs ?? new List<SnapshotRef?>();

        var recipeProvenance = ProvenanceCapture.ForParameter<PotionRecipe>("recipe.Get()", recipeIsSet, inherited: !recipeIsSet);
        foreach (var field in fields.Keys)
        {
            provenance[field] = recipeProvenance;
        }

        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
