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
                RecipeName: "Levitation I",
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
        Assert.Equal("Levitation I", row.Fields.RecipeName);
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

    [Theory]
    [InlineData("")]
    [InlineData(" \t")]
    public void BlankRecipeNameProducesDiagnostic(string recipeName)
    {
        var extractor = new PotionRecipeExtractor(new FakeSource(new[] { Build(recipeName: recipeName) }));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.RecipeName);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("potionRecipeNameMissing", diagnostic.Code);
        Assert.Equal("recipeName", diagnostic.Field);
    }

    private static PotionRecipeAsset Build(
        string recipeName = "Recipe",
        IReadOnlyList<PotionRecipeIngredientAsset>? ingredients = null) => new(
        Guid: "recipe-guid",
        AssetName: "recipe",
        RecipeName: recipeName,
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
