using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemDiagnosticCodesTests
{
    [Fact]
    public void UnsupportedSubtypeDiagnosticCodeIsSliceNeutral()
    {
        Assert.Equal("itemSubtypeUnsupported", ItemDiagnosticCodes.UnsupportedSubtype);
    }
}
