namespace ArdenfallCompendium.Walker;

internal static class NamedAssetIdentity
{
    public static bool TryCreate(string entityId, string? assetName, out string identity)
    {
        if (string.IsNullOrWhiteSpace(assetName))
        {
            identity = "";
            return false;
        }

        identity = $"named;{entityId};{assetName}";
        return true;
    }
}
