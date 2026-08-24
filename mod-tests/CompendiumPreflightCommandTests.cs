using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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
            new FakeGameIdentitySource("Ardenfall Demo 2025", "0.0.10.91"),
            () => new PreflightReport
            {
                Passed = true,
                CompletedAt = "2026-08-02T00:00:00.0000000Z",
                Checks = new List<PreflightCheck>
                {
                    new() { Name = "test", Ok = true },
                },
            });

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<CompendiumPreflightResult>(),
            new EmptyArgs(),
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.True(result.Output!.Ready);
        Assert.True(result.Output.Passed);
        Assert.Equal("Ardenfall Demo 2025", result.Output.ProductName);
        Assert.Equal("0.0.10.91", result.Output.GameVersion);

        var json = JObject.Parse(JsonConvert.SerializeObject(result.Output));
        Assert.Equal("Ardenfall Demo 2025", json["productName"]?.Value<string>());
        Assert.Equal("0.0.10.91", json["gameVersion"]?.Value<string>());
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
