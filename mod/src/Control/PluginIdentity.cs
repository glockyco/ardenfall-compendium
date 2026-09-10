using System;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace ArdenfallCompendium.Control;

/// <summary>
/// Identity of the plugin assembly that answers a control command. The controller compares it
/// against the plugin it deployed, so an export cannot be served by an earlier build.
/// </summary>
public interface IPluginIdentitySource
{
    string Path { get; }

    string Sha256 { get; }

    string ModifiedAt { get; }
}

/// <summary>
/// Reads the identity from the assembly file this code was loaded from. The digest is the file's
/// bytes, because that is what a deploy copies and what a rebuild changes.
/// </summary>
/// <remarks>
/// The read happens when this object is constructed, and the plugin constructs one while it loads.
/// Reading it later would report whatever sits at that path at that moment: a deploy into a running
/// game replaces the file, and a lazy read then reported the new build as the running one. That
/// defect was measured — an export against a game running the previous build passed.
/// </remarks>
public sealed class AssemblyPluginIdentitySource : IPluginIdentitySource
{
    private readonly Identity _identity;

    public AssemblyPluginIdentitySource()
        : this(typeof(AssemblyPluginIdentitySource).Assembly) { }

    public AssemblyPluginIdentitySource(Assembly assembly)
    {
        if (assembly is null) throw new ArgumentNullException(nameof(assembly));
        _identity = Read(assembly);
    }

    public string Path => _identity.Path;

    public string Sha256 => _identity.Sha256;

    public string ModifiedAt => _identity.ModifiedAt;

    private static Identity Read(Assembly assembly)
    {
        var location = assembly.Location;
        if (string.IsNullOrWhiteSpace(location))
        {
            throw new InvalidOperationException(
                "The plugin assembly reports no file location, so its identity cannot be proven. "
                    + "A loader that loads plugins from bytes needs a different identity source.");
        }

        if (!File.Exists(location))
        {
            throw new InvalidOperationException(
                $"The plugin assembly file is missing: {location}");
        }

        return new Identity(
            location,
            Sha256Hex(File.ReadAllBytes(location)),
            File.GetLastWriteTimeUtc(location).ToString("O", CultureInfo.InvariantCulture));
    }

    private static string Sha256Hex(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash) sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        return sb.ToString();
    }

    private sealed class Identity
    {
        public Identity(string path, string sha256, string modifiedAt)
        {
            Path = path;
            Sha256 = sha256;
            ModifiedAt = modifiedAt;
        }

        public string Path { get; }

        public string Sha256 { get; }

        public string ModifiedAt { get; }
    }
}
