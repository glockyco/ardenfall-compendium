using System;
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
        var source = new[] { (TestAsset)null!, new TestAsset("one", "one"), new TestAsset("two", "two") };
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

    [Fact]
    public void IdenticalRecordRepeatProducesDiagnosticAndDropsRepeat()
    {
        var asset = new TestAsset("same", "payload");
        var diagnostics = new List<Diagnostic>();
        var refs = new RefResolver();

        var rows = ExtractorLifecycle.Run(
            new[] { asset, asset },
            diagnostics,
            refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "testAssetMissing",
                Field = "id",
                Message = "test source yielded a null row",
            },
            sourceAsset => ExtractorIdentity.Valid(sourceAsset.Id),
            (sourceAsset, id) => sourceAsset).ToList();

        Assert.Single(rows);
        var diagnostic = Assert.Single(diagnostics);
        Assert.Equal("sourceYieldedDuplicateRecord", diagnostic.Code);
        Assert.Contains("same", diagnostic.Message);
    }

    [Fact]
    public void DifferentRecordsWithOneIdFailFast()
    {
        var diagnostics = new List<Diagnostic>();
        var refs = new RefResolver();

        var exception = Assert.Throws<InvalidOperationException>(() => ExtractorLifecycle.Run(
            new[]
            {
                new TestAsset("same", "first"),
                new TestAsset("same", "second"),
            },
            diagnostics,
            refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "testAssetMissing",
                Field = "id",
                Message = "test source yielded a null row",
            },
            sourceAsset => ExtractorIdentity.Valid(sourceAsset.Id),
            (sourceAsset, id) => sourceAsset).ToList());

        Assert.Contains("same", exception.Message);
        Assert.Contains("different records", exception.Message);
    }
    private sealed record TestAsset(string Id, string Value);
}
