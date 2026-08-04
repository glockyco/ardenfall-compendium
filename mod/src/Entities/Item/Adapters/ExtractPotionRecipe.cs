using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using ArdenfallPotionRecipe = Ardenfall.Item.PotionRecipe;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractPotionRecipe
{
    public static ItemAdapterResult Extract(PotionRecipeItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(System.StringComparer.Ordinal)
        {
            ["recipeRef"] = ItemAdapterHelpers.ResolveOptionalAsset(
                refs,
                asset.recipe.Get(),
                "recipeRef",
                rowId,
                "PotionRecipeItemData.recipe"),
        };
        var recipeIsSet = asset.recipe.IsSet;
        var provenance = new Dictionary<string, Provenance>(System.StringComparer.Ordinal)
        {
            ["recipeRef"] = ProvenanceCapture.ForParameter<ArdenfallPotionRecipe>(
                "recipe.Get()",
                recipeIsSet,
                inherited: !recipeIsSet),
        };
        return new ItemAdapterResult(
            fields,
            provenance,
            ItemAdapterHelpers.DrainDiagnostics(refs),
            ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
