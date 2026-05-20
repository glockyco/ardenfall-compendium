using ArdenfallCompendium.Entities.ItemTag;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemTagSnapshotTests
{
    [Fact]
    public void RecordCarriesTagNameAndDescription()
    {
        var snapshot = new ItemTagSnapshot(
            Id: "tag-valuable-remedy",
            TagName: "Valuable remedy",
            Description: "Incredibly valuable remedy");

        Assert.Equal("tag-valuable-remedy", snapshot.Id);
        Assert.Equal("Valuable remedy", snapshot.TagName);
        Assert.Equal("Incredibly valuable remedy", snapshot.Description);
    }
}
