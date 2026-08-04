using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;
using ArdenfallPotionRecipe = Ardenfall.Item.PotionRecipe;

namespace ArdenfallCompendium.Entities.PotionRecipe;

public sealed class LoadedPotionRecipeAssetSource : IPotionRecipeAssetSource
{
    private readonly Func<IEnumerable<ArdenfallPotionRecipe>> _lookupRecipes;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string?> _lookupGuid;
    private readonly Func<UnityObject, string> _assetName;

    public LoadedPotionRecipeAssetSource()
        : this(
            lookupRecipes: () => BuiltLookupTable.GetAssetsOfType<ArdenfallPotionRecipe>(),
            isUnityNull: IsUnityNull,
            lookupGuid: LookupGuid,
            assetName: SafeName)
    {
    }

    public LoadedPotionRecipeAssetSource(
        Func<IEnumerable<ArdenfallPotionRecipe>> lookupRecipes,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string?>? lookupGuid = null,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupRecipes = lookupRecipes;
        _isUnityNull = isUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<PotionRecipeAsset> EnumeratePotionRecipes()
    {
        foreach (var asset in _lookupRecipes())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }

            var ingredients = (asset.recipe ?? new List<RecipeItem>())
                .Where(ingredient => ingredient != null)
                .Select(ingredient => new PotionRecipeIngredientAsset(
                    ResolveAsset(ingredient.tag, _lookupGuid, _assetName, "PotionRecipe.recipe.tag"),
                    ingredient.count))
                .ToList();
            var producedRefs = new List<PotionRecipeProductAsset>();
            foreach (var potion in asset.drinkablePotions ?? new List<ThrowingPotionData>())
            {
                producedRefs.Add(new PotionRecipeProductAsset(
                    ResolveAsset(potion, _lookupGuid, _assetName, "PotionRecipe.drinkablePotions"),
                    "drinkable"));
            }
            foreach (var potion in asset.throwingPotions ?? new List<ThrowingPotionData>())
            {
                producedRefs.Add(new PotionRecipeProductAsset(
                    ResolveAsset(potion, _lookupGuid, _assetName, "PotionRecipe.throwingPotions"),
                    "throwing"));
            }

            string? recipeName = null;
            if ((asset.drinkablePotions?.Count ?? 0) > 0 || (asset.throwingPotions?.Count ?? 0) > 0)
            {
                recipeName = asset.RecipeName;
            }

            yield return new PotionRecipeAsset(
                Guid: _lookupGuid(asset),
                AssetName: _assetName(asset),
                RecipeName: recipeName,
                LockedByDefault: asset.lockedByDefault,
                EnableSkillRequirement: asset.enableSkillRequirement,
                SkillRequirement: asset.skillRequirement,
                LevelModifier: asset.levelModifier,
                SuccessModifier: asset.successModifier,
                Ingredients: ingredients,
                ProducedRefs: producedRefs);
        }
    }

    private static SnapshotRef? ResolveAsset(
        UnityObject? asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName,
        string source)
    {
        if (asset == null) return null;
        var guid = lookupGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, assetName(asset));
    }

    private static string? LookupGuid(UnityObject asset) => BuiltLookupTable.Instance?.GetGuid(asset);

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("PotionRecipe lookup failed for field 'name' because the Unity object was destroyed.", exception);
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("PotionRecipe lookup failed for field 'asset' because the Unity object was destroyed.", exception);
        }
    }
}
