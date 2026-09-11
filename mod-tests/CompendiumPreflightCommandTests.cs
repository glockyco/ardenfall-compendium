using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CompendiumPreflightCommandTests
{
    [Fact]
    public async Task ReportsLiveGameIdentityAlongsideReadiness()
    {
        var command = new CompendiumPreflightCommand(
            new FakeGameIdentitySource("Ardenfall", "0.0.10.91"),
            () => new PreflightReport
            {
                Passed = true,
                CompletedAt = "2026-08-02T00:00:00.0000000Z",
                Checks = new List<PreflightCheck>
                {
                    new() { Name = "test", Ok = true },
                },
            },
            new FakePluginIdentitySource());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<CompendiumPreflightResult>(),
            new EmptyArgs(),
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.True(result.Output!.Ready);
        Assert.True(result.Output.Passed);
        Assert.Equal("Ardenfall", result.Output.ProductName);
        Assert.Equal("0.0.10.91", result.Output.GameVersion);
        Assert.Equal("/plugins/ArdenfallCompendium.dll", result.Output.PluginPath);
        Assert.Equal(new string('a', 64), result.Output.PluginSha256);
        Assert.Equal("2026-09-10T18:00:00.0000000Z", result.Output.PluginModifiedAt);

        var json = JObject.Parse(JsonConvert.SerializeObject(result.Output));
        Assert.Equal("Ardenfall", json["productName"]?.Value<string>());
        Assert.Equal("0.0.10.91", json["gameVersion"]?.Value<string>());
        Assert.Equal(new string('a', 64), json["pluginSha256"]?.Value<string>());
        Assert.Equal("/plugins/ArdenfallCompendium.dll", json["pluginPath"]?.Value<string>());
    }

    [Fact]
    public async Task RefusesToReportReadinessWithoutAPluginDigest()
    {
        var command = new CompendiumPreflightCommand(
            new FakeGameIdentitySource("Ardenfall", "0.0.10.91"),
            () => new PreflightReport { Passed = true },
            new FakePluginIdentitySource(sha256: string.Empty));

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await command.ExecuteAsync(
                TestControlCommandContext.Create<CompendiumPreflightResult>(),
                new EmptyArgs(),
                CancellationToken.None));
    }

    private sealed class FakePluginIdentitySource : IPluginIdentitySource
    {
        public FakePluginIdentitySource(string? sha256 = null)
        {
            Sha256 = sha256 ?? new string('a', 64);
        }

        public string Path => "/plugins/ArdenfallCompendium.dll";

        public string Sha256 { get; }

        public string ModifiedAt => "2026-09-10T18:00:00.0000000Z";
    }

    private sealed class FakeGameIdentitySource : IGameIdentitySource
    {
        public FakeGameIdentitySource(string productName, string gameVersion)
        {
            ProductName = productName;
            GameVersion = gameVersion;
        }

        public string ProductName { get; }

        public string GameVersion { get; }

        public string BuildProfile => "release";
    }
}
