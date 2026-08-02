using System;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using HotRepl.Control;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;
using UnityEngine;

namespace ArdenfallCompendium.Control.Handlers;

public interface IGameIdentitySource
{
    string ProductName { get; }

    string GameVersion { get; }
}

public sealed class UnityGameIdentitySource : IGameIdentitySource
{
    public string ProductName => Application.productName;

    public string GameVersion => Application.version;
}

public sealed class CompendiumPreflightCommand
    : IControlCommandHandler<EmptyArgs, CompendiumPreflightResult>
{
    private readonly IGameIdentitySource _gameIdentity;
    private readonly System.Func<PreflightReport> _preflight;

    public CompendiumPreflightCommand(
        IGameIdentitySource? gameIdentity = null,
        System.Func<PreflightReport>? preflight = null)
    {
        _gameIdentity = gameIdentity ?? new UnityGameIdentitySource();
        _preflight = preflight ?? PreflightRunner.Run;
    }

    public string Name => "compendium.preflight";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<CompendiumPreflightResult>> ExecuteAsync(
        ControlCommandContext<CompendiumPreflightResult> context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        var report = _preflight();
        return new(
            ControlCommandResult.Ok(
                new CompendiumPreflightResult
                {
                    Ready = report.Passed,
                    Passed = report.Passed,
                    CompletedAt = report.CompletedAt,
                    Checks = report.Checks,
                    ProductName = RequireIdentity(_gameIdentity.ProductName, "Unity product name"),
                    GameVersion = RequireIdentity(_gameIdentity.GameVersion, "Unity game version"),
                }
            )
        );
    }

    private static string RequireIdentity(string value, string label) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new InvalidOperationException($"{label} is unavailable from the running game")
            : value;
}
