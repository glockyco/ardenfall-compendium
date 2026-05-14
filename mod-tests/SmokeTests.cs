using Xunit;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Tests;

public sealed class SmokeTests
{
    [Fact]
    public void TestProjectLinksMod() => Assert.Equal("ArdenfallCompendium", typeof(Manifest).Assembly.GetName().Name);
}
