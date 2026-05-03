using System.Collections.Generic;
using Ardenfall;
using ArdenfallArchives.Dtos;
using UnityEngine;

namespace ArdenfallArchives.Walker;

/// <summary>Resolves Unity object references to SnapshotRefs, applying the missing-ref policy.</summary>
public sealed class RefResolver
{
    public List<Diagnostic> Diagnostics { get; } = new();

    /// <summary>Resolve an asset-backed ref. Policy: fatal | diagnostic | optional-empty.</summary>
    public SnapshotRef ResolveAsset(Object? asset, string field, string entityRowId, MissingPolicy policy)
    {
        if (asset == null)
        {
            return EmitMissing(field, entityRowId, policy, reason: "nullAsset", source: field);
        }
        var guid = BuiltLookupTable.Instance != null
            ? BuiltLookupTable.Instance.GetGuid(asset)
            : null;
        if (guid is null || guid.Length == 0)
        {
            return EmitMissing(field, entityRowId, policy, reason: "lookupAssetGuidMissing", source: field);
        }
        return SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }

    private SnapshotRef EmitMissing(string field, string entityRowId, MissingPolicy policy, string reason, string source)
    {
        var severity = policy switch
        {
            MissingPolicy.Fatal => "fatal",
            MissingPolicy.Diagnostic => "diagnostic",
            MissingPolicy.OptionalEmpty => null,
            _ => "diagnostic",
        };
        if (severity != null)
        {
            Diagnostics.Add(new Diagnostic
            {
                Severity = severity,
                Code = reason,
                Field = field,
                Message = $"missing ref '{field}' on {entityRowId}",
            });
        }
        return SnapshotRef.Missing(reason, source);
    }
}

public enum MissingPolicy { Fatal, Diagnostic, OptionalEmpty }
