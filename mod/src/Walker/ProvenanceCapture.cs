using ArdenfallArchives.Dtos;

namespace ArdenfallArchives.Walker;

/// <summary>Captures provenance for Parameter&lt;T&gt; and SmartListParameter&lt;T&gt; field resolution.</summary>
public static class ProvenanceCapture
{
    public static Provenance ForParameter<T>(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "parameter", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForSmartList<T>(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "smartListParameter", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForLookupAsset(string source, bool isSet, bool inherited, ParentRef? parent = null) =>
        new() { Kind = "lookupAsset", Source = source, IsSet = isSet, Inherited = inherited, Parent = parent };

    public static Provenance ForMissing(string source, bool inherited) =>
        new() { Kind = "missing", Source = source, IsSet = false, Inherited = inherited };
}
