using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities;

public sealed record ExtractorIdentity(string? Id, Diagnostic? Error)
{
    public static ExtractorIdentity Valid(string id) => new(id, null);

    public static ExtractorIdentity Invalid(Diagnostic error) => new(null, error);
}

/// <summary>Runs the common source-to-row lifecycle for an entity extractor.</summary>
public static class ExtractorLifecycle
{
    public static IEnumerable<TRow> Run<TAsset, TRow>(
        IEnumerable<TAsset> source,
        IList<Diagnostic> diagnostics,
        Walker.RefResolver refs,
        Func<Diagnostic> nullRowDiagnostic,
        Func<TAsset, ExtractorIdentity> identify,
        Func<TAsset, string, TRow?> map)
        where TAsset : class
        where TRow : class
    {
        try
        {
            foreach (var asset in source)
            {
                if (ReferenceEquals(asset, null))
                {
                    diagnostics.Add(nullRowDiagnostic());
                    continue;
                }

                var identity = identify(asset);
                if (string.IsNullOrWhiteSpace(identity.Id) || identity.Error != null)
                {
                    if (identity.Error != null) diagnostics.Add(identity.Error);
                    continue;
                }

                var row = map(asset, identity.Id);
                if (row != null) yield return row;
            }
        }
        finally
        {
            foreach (var diagnostic in refs.Diagnostics) diagnostics.Add(diagnostic);
            refs.Diagnostics.Clear();
        }
    }
}
