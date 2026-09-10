using System;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using ArdenfallCompendium.Control;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class PluginIdentityTests
{
    [Fact]
    public void ReportsTheDigestOfTheAssemblyFileOnDisk()
    {
        var assembly = typeof(PluginIdentityTests).Assembly;
        var source = new AssemblyPluginIdentitySource(assembly);

        Assert.Equal(assembly.Location, source.Path);
        Assert.Equal(FileDigest(assembly.Location), source.Sha256);
        Assert.Equal(
            File.GetLastWriteTimeUtc(assembly.Location).ToString("O"),
            source.ModifiedAt);
    }

    [Fact]
    public void RefusesAnAssemblyWithNoFileLocation()
    {
        var error = Assert.Throws<InvalidOperationException>(
            () => new AssemblyPluginIdentitySource(new LocationlessAssembly()));

        Assert.Contains("no file location", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void KeepsTheDigestItReadWhenTheFileIsReplacedLater()
    {
        var directory = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "plugin.dll");
        try
        {
            File.WriteAllText(path, "loaded build");
            var source = new AssemblyPluginIdentitySource(new FileBackedAssembly(path));
            var loaded = source.Sha256;

            // A deploy into a running game overwrites the file the plugin was loaded from.
            File.WriteAllText(path, "deployed build");

            Assert.Equal(loaded, source.Sha256);
            Assert.NotEqual(FileDigest(path), source.Sha256);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static string FileDigest(string path)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(File.ReadAllBytes(path))).ToLowerInvariant();
    }

    private sealed class LocationlessAssembly : Assembly
    {
        public override string Location => string.Empty;
    }

    private sealed class FileBackedAssembly : Assembly
    {
        private readonly string _location;

        public FileBackedAssembly(string location) => _location = location;

        public override string Location => _location;
    }
}
