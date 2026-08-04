using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.PotionRecipe;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class PotionRecipeExtractorTests
{
    [Fact]
    public void EmitsDrinkableAndThrowingProductsInOrder()
    {
        var source = new FakeSource(new[]
        {
            new PotionRecipeAsset(
                Guid: "recipe-guid",
                AssetName: "recipe",
                StatusEffectRef: SnapshotRef.LookupAsset("status-effect-guid"),
                LockedByDefault: true,
                EnableSkillRequirement: true,
                SkillRequirement: 4,
                LevelModifier: 1.5f,
                SuccessModifier: 0.25f,
                Ingredients: new[] { new PotionRecipeIngredientAsset(SnapshotRef.LookupAsset("tag-guid"), 2) },
                ProducedRefs: new[]
                {
                    new PotionRecipeProductAsset(SnapshotRef.LookupAsset("drink-guid"), "drinkable"),
                    new PotionRecipeProductAsset(SnapshotRef.LookupAsset("throw-guid"), "throwing"),
                }),
        });

        var row = Assert.Single(new PotionRecipeExtractor(source).Walk());

        Assert.Equal("recipe-guid", row.Id);
        Assert.Equal("status-effect-guid", row.Fields.StatusEffectRef.Guid);
        Assert.Equal(2, row.Fields.ProducedRefs.Count);
        Assert.Equal("drinkable", row.Fields.ProducedRefs[0].Form);
        Assert.Equal("throwing", row.Fields.ProducedRefs[1].Form);
        Assert.Equal("tag-guid", row.Fields.Ingredients[0].TagRef?.Guid);
    }

    [Fact]
    public void EmitsEmptyIngredientList()
    {
        var source = new FakeSource(new[] { Build(ingredients: new List<PotionRecipeIngredientAsset>()) });

        var row = Assert.Single(new PotionRecipeExtractor(source).Walk());

        Assert.Empty(row.Fields.Ingredients);
    }

    [Fact]
    public void MissingStatusEffectReferenceProducesDiagnostic()
    {
        var extractor = new PotionRecipeExtractor(new FakeSource(new[] { Build(statusEffectRef: SnapshotRef.Missing("potionRecipeStatusEffectMissing", "PotionRecipe.product")) }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("missing", row.Fields.StatusEffectRef.Kind);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("potionRecipeStatusEffectMissing", diagnostic.Code);
        Assert.Equal("statusEffectRef", diagnostic.Field);
        Assert.Contains("recipe-guid", diagnostic.Message);
    }

    private static PotionRecipeAsset Build(
        SnapshotRef? statusEffectRef = null,
        IReadOnlyList<PotionRecipeIngredientAsset>? ingredients = null) => new(
        Guid: "recipe-guid",
        AssetName: "recipe",
        StatusEffectRef: statusEffectRef ?? SnapshotRef.LookupAsset("status-effect-guid"),
        LockedByDefault: false,
        EnableSkillRequirement: false,
        SkillRequirement: 0,
        LevelModifier: 0,
        SuccessModifier: 0,
        Ingredients: ingredients,
        ProducedRefs: new[] { new PotionRecipeProductAsset(SnapshotRef.LookupAsset("item-guid"), "drinkable") });

    private sealed class FakeSource : IPotionRecipeAssetSource
    {
        private readonly IReadOnlyList<PotionRecipeAsset> _assets;
        public FakeSource(IReadOnlyList<PotionRecipeAsset> assets) => _assets = assets;
        public IEnumerable<PotionRecipeAsset> EnumeratePotionRecipes() => _assets;
    }
}
