using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Walker;

/// <summary>Resolves Unity object references to SnapshotRefs, applying the missing-ref policy.</summary>
public sealed class RefResolver
{
    private readonly System.Func<Object, string> _assetName;
    private readonly System.Func<Object?, bool> _isUnityNull;
    private readonly System.Func<Object, string?> _lookupGuid;
    private static readonly IReadOnlyDictionary<System.Type, string> NamedAssetEntities =
        new Dictionary<System.Type, string>
        {
            [typeof(Ardenfall.StatType)] = "stat-type",
            [typeof(Ardenfall.ItemCategory)] = "item-category",
            [typeof(Ardenfall.SpellData)] = "spell",
        };
    public List<Diagnostic> Diagnostics { get; } = new();

    public RefResolver(
        System.Func<Object, string>? assetName = null,
        System.Func<Object?, bool>? isUnityNull = null,
        System.Func<Object, string?>? lookupGuid = null)
    {
        _assetName = assetName ?? SafeAssetName;
        _isUnityNull = isUnityNull ?? IsUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
    }


    /// <summary>Resolve an asset-backed ref. Policy: fatal | diagnostic | optional-empty.</summary>
    public SnapshotRef ResolveAsset(
        Object? asset,
        string field,
        string entityRowId,
        MissingPolicy policy,
        string? source = null,
        string? diagnosticCode = null)
    {
        if (_isUnityNull(asset))
        {
            return EmitMissing(
                field,
                entityRowId,
                policy,
                reason: diagnosticCode ?? "nullAsset",
                source: source ?? field);
        }
        if (ReferenceEquals(asset, null))
        {
            return EmitMissing(
                field,
                entityRowId,
                policy,
                reason: diagnosticCode ?? "nullAsset",
                source: source ?? field);
        }
        if (NamedAssetEntities.TryGetValue(asset.GetType(), out var entityId))
        {
            var name = _assetName(asset);
            return NamedAssetIdentity.TryCreate(entityId, name, out _)
                ? SnapshotRef.NamedAsset(entityId, name)
                : EmitMissing(
                    field,
                    entityRowId,
                    policy,
                    reason: diagnosticCode ?? "lookupAssetGuidMissing",
                    source: source ?? field);
        }

        if (!IsArdenfallContent(asset))
        {
            // Engine resources are out of scope by design. An unregistered Ardenfall asset is a gap worth reporting.
            return SnapshotRef.Missing("engineResource", source ?? field);
        }

        var guid = _lookupGuid(asset);
        if (guid is null || guid.Length == 0)
        {
            return EmitMissing(
                field,
                entityRowId,
                policy,
                reason: diagnosticCode ?? "lookupAssetGuidMissing",
                source: source ?? field);
        }
        return SnapshotRef.LookupAsset(guid, asset.GetType().FullName, _assetName(asset));
    }

    private static string? LookupGuid(Object asset)
    {
        return BuiltLookupTable.Instance != null
            ? BuiltLookupTable.Instance.GetGuid(asset)
            : null;
    }

    private static bool IsArdenfallContent(Object asset)
    {
        var ns = asset.GetType().Namespace;
        return ns == "Ardenfall"
            || (ns != null && ns.StartsWith("Ardenfall.", System.StringComparison.Ordinal));
    }

    private static bool IsUnityNull(Object? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch
        {
            return false;
        }
    }

    private static string SafeAssetName(Object asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch
        {
            return "";
        }
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
