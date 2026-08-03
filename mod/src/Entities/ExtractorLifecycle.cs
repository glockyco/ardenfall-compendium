using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

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
        var emitted = new Dictionary<string, TRow>();
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

                var rowId = identity.Id!;
                var row = map(asset, rowId);
                if (row == null) continue;

                if (emitted.TryGetValue(rowId, out var first))
                {
                    // Serialise only on a repeat, so the common path pays nothing. JSON is the form
                    // these rows reach the snapshot in, so it is the right thing to compare.
                    if (JsonConvert.SerializeObject(first) != JsonConvert.SerializeObject(row))
                    {
                        throw new InvalidOperationException(
                            $"Source yielded two different records for id '{rowId}'. "
                            + "An id must identify one record, so the extractor cannot choose between them.");
                    }

                    diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "sourceYieldedDuplicateRecord",
                        Field = "id",
                        Message =
                            $"Source yielded id '{rowId}' more than once with identical data, so the repeat was dropped",
                    });
                    continue;
                }

                emitted.Add(rowId, row);
                yield return row;
            }
        }
        finally
        {
            foreach (var diagnostic in refs.Diagnostics) diagnostics.Add(diagnostic);
            refs.Diagnostics.Clear();
        }
    }
}
