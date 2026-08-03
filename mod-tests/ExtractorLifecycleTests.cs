using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ExtractorLifecycleTests
{
    [Fact]
    public void NullSourceRowProducesFatalDiagnosticAndResolverIsDrainedOnce()
    {
        var source = new[] { (TestAsset)null!, new TestAsset("one"), new TestAsset("two") };
        var diagnostics = new List<Diagnostic>();
        var refs = new RefResolver();

        var rows = ExtractorLifecycle.Run(
            source,
            diagnostics,
            refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "testAssetMissing",
                Field = "id",
                Message = "test source yielded a null row",
            },
            asset => ExtractorIdentity.Valid(asset.Id),
            (asset, id) =>
            {
                refs.Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "testRefMissing",
                    Field = "ref",
                    Message = $"missing ref on {id}",
                });
                return asset;
            }).ToList();

        Assert.Equal(2, rows.Count);
        Assert.Single(diagnostics, diagnostic => diagnostic.Code == "testAssetMissing");
        Assert.Equal(2, diagnostics.Count(diagnostic => diagnostic.Code == "testRefMissing"));
        Assert.Empty(refs.Diagnostics);
    }

    private sealed record TestAsset(string Id);
}
