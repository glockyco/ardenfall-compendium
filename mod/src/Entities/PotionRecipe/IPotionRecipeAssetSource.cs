using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.PotionRecipe;

public sealed record PotionRecipeIngredientAsset(
    SnapshotRef? TagRef,
    int Count);

public sealed record PotionRecipeProductAsset(
    SnapshotRef? Ref,
    string Form);

public sealed record PotionRecipeAsset(
    string? Guid,
    string AssetName,
    string? RecipeName,
    bool LockedByDefault,
    bool EnableSkillRequirement,
    int SkillRequirement,
    float LevelModifier,
    float SuccessModifier,
    IReadOnlyList<PotionRecipeIngredientAsset>? Ingredients = null,
    IReadOnlyList<PotionRecipeProductAsset>? ProducedRefs = null);

public interface IPotionRecipeAssetSource
{
    IEnumerable<PotionRecipeAsset> EnumeratePotionRecipes();
}
