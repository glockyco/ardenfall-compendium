using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.PotionRecipe;

public sealed class PotionRecipeExtractor : WalkerBase<PotionRecipeSnapshotRow>
{
    private readonly IPotionRecipeAssetSource _source;

    public PotionRecipeExtractor()
        : this(new LoadedPotionRecipeAssetSource())
    {
    }

    public PotionRecipeExtractor(IPotionRecipeAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<PotionRecipeSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumeratePotionRecipes(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "potionRecipeAssetMissing",
                Field = "id",
                Message = "PotionRecipe asset source yielded a null row",
            },
            asset =>
            {
                if (string.IsNullOrWhiteSpace(asset.Guid))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "lookupAssetGuidMissing",
                        Field = "id",
                        Message = $"PotionRecipe asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
                var recipeName = NullIfEmpty(asset.RecipeName);
                if (recipeName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "potionRecipeNameMissing",
                        Field = "recipeName",
                        Message = $"PotionRecipe '{id}' has empty or whitespace RecipeName",
                    });
                }

                var ingredients = new List<PotionRecipeIngredientSnapshot>();
                foreach (var ingredient in asset.Ingredients ?? Array.Empty<PotionRecipeIngredientAsset>())
                {
                    ingredients.Add(new PotionRecipeIngredientSnapshot(ingredient.TagRef, ingredient.Count));
                }

                var producedRefs = new List<PotionRecipeProductSnapshot>();
                foreach (var product in asset.ProducedRefs ?? Array.Empty<PotionRecipeProductAsset>())
                {
                    producedRefs.Add(new PotionRecipeProductSnapshot(product.Ref, product.Form));
                }

                return new PotionRecipeSnapshotRow
                {
                    Id = id,
                    Fields = new PotionRecipeSnapshot(
                        Id: id,
                        RecipeName: recipeName,
                        LockedByDefault: asset.LockedByDefault,
                        EnableSkillRequirement: asset.EnableSkillRequirement,
                        SkillRequirement: asset.SkillRequirement,
                        LevelModifier: asset.LevelModifier,
                        SuccessModifier: asset.SuccessModifier,
                        Ingredients: ingredients,
                        ProducedRefs: producedRefs),
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
