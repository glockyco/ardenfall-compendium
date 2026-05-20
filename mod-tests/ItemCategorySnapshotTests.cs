using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.ItemCategory;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemCategorySnapshotTests
{
    [Fact]
    public void RecordCarriesColorDefaultIconAndColumns()
    {
        var snapshot = new ItemCategorySnapshot(
            Id: "category-weapons",
            CategoryName: "Weapons",
            IconRef: null,
            DefaultItemIconRef: null,
            CategoryColor: new AssetColorSnapshot { R = 0.9f, G = 0.2f, B = 0.2f, A = 1f },
            ShowInAllCategory: true,
            Columns: new List<ItemCategoryColumnSnapshot>
            {
                new(
                    Label: "Name",
                    IconRef: null,
                    PreferedWidth: 1.5f,
                    FlexibleWidth: 2.0f,
                    IsItemName: true,
                    IsItemIconAndCategory: true,
                    IsItemValue: false,
                    IsAffectedBySkillRequirement: false,
                    IsAffectedByBrokenDurability: false,
                    AffectingRedColor: true,
                    AffectingIconsAfter: false,
                    HideIfNegativeOne: false,
                    Alignment: "MiddleLeft",
                    ItemDataField: null,
                    ItemFunctionField: null),
            });

        Assert.Equal("category-weapons", snapshot.Id);
        Assert.Equal(0.9f, snapshot.CategoryColor.R);
        Assert.Single(snapshot.Columns);
        Assert.Equal(2.0f, snapshot.Columns[0].FlexibleWidth);
        Assert.True(snapshot.Columns[0].IsItemIconAndCategory);
    }
}
