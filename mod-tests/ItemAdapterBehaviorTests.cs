using System.Collections.Generic;
using System.Runtime.CompilerServices;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item.Adapters;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemAdapterBehaviorTests
{
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
}
