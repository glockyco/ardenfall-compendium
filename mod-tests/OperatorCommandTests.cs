using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class OperatorCommandTests
{
    [Fact]
    public async Task SetInvulnerableReportsTheLiveFlag()
    {
        var target = new FakeOperatorTarget();
        var command = new OperatorSetInvulnerableCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorInvulnerableResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        Assert.True(result.Output!.Invulnerable);
        Assert.True(target.Invulnerable);
    }

    [Fact]
    public async Task SetInvulnerableRejectsAnAbsentFlag()
    {
        var target = new FakeOperatorTarget { Invulnerable = true };
        var command = new OperatorSetInvulnerableCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorInvulnerableResult>(),
            new OperatorEnabledArgs(),
            CancellationToken.None
        );

        AssertFailed(result, ControlCommandDiagnosticKind.ValidationFailed, "enabledRequired");
        Assert.True(target.Invulnerable);
    }

    [Fact]
    public async Task AnAbsentCharacterFailsByNameAndChangesNothing()
    {
        var target = new FakeOperatorTarget { HasCharacter = false, Invulnerable = false };
        var command = new OperatorSetInvulnerableCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorInvulnerableResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );

        AssertFailed(
            result,
            ControlCommandDiagnosticKind.PreconditionFailed,
            OperatorPreconditions.CharacterMissingCode
        );
        Assert.False(target.Invulnerable);
    }

    [Fact]
    public async Task AnAbsentGameFailsByName()
    {
        var target = new FakeOperatorTarget { HasGame = false };
        var command = new OperatorStatusCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorStatusResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        AssertFailed(
            result,
            ControlCommandDiagnosticKind.PreconditionFailed,
            OperatorPreconditions.GameMissingCode
        );
    }

    [Fact]
    public async Task StatusReportsEveryOperatorOwnedValue()
    {
        var target = new FakeOperatorTarget { DebugTools = false, FreeCameraEnabled = false };
        var session = new OperatorSessionLedger();

        await new OperatorSetInvulnerableCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorInvulnerableResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );
        await new OperatorSetTimescaleCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorTimescaleResult>(),
            new OperatorTimescaleArgs { Scale = 0f },
            CancellationToken.None
        );

        var result = await new OperatorStatusCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorStatusResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.True(output.Invulnerable);
        Assert.False(output.PhotoMode);
        Assert.Equal(0f, output.Timescale);
        Assert.False(output.RoamingClampLifted);
        Assert.False(output.DebugTools);
        Assert.Equal(
            new[] { OperatorSessionKeys.Invulnerable, OperatorSessionKeys.Timescale },
            output.Changed
        );
    }

    [Fact]
    public async Task RecoveringADeadCharacterReportsEachPartItChanged()
    {
        var target = new FakeOperatorTarget { IsDead = true, DeathInterfaceOpen = true };
        var command = new OperatorRecoverFromDeathCommand(target);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorDeathRecoveryResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.True(output.Alive);
        Assert.True(output.Revived);
        Assert.True(output.DeathInterfaceClosed);
        Assert.True(output.AnimationOverrideStopped);
        Assert.Equal(1, target.ReviveCalls);
        Assert.Equal(1, target.StopAnimationOverrideCalls);
        Assert.Equal(1, target.RefreshAnimatorStateCalls);
        Assert.False(target.DeathInterfaceOpen);
    }

    [Fact]
    public async Task RecoveringALivingCharacterStillStopsTheOverride()
    {
        var target = new FakeOperatorTarget { IsDead = false, DeathInterfaceOpen = false };
        var command = new OperatorRecoverFromDeathCommand(target);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorDeathRecoveryResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.True(output.Alive);
        Assert.False(output.Revived);
        Assert.False(output.DeathInterfaceClosed);
        Assert.True(output.AnimationOverrideStopped);
        Assert.Equal(0, target.ReviveCalls);
        Assert.Equal(1, target.StopAnimationOverrideCalls);
    }

    [Fact]
    public async Task TeleportPlacesTheCharacterAboveTheSurfaceItFound()
    {
        var target = new FakeOperatorTarget { Surface = new OperatorSurface(12.5f, "pier_deck") };
        var command = new OperatorTeleportCommand(target);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorTeleportResult>(),
            new OperatorTeleportArgs { X = 50f, Z = -1073f },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.Equal(12.5f, output.SurfaceHeight);
        Assert.Equal("pier_deck", output.Surface);
        var move = Assert.Single(target.Moves);
        Assert.Equal(50f, move.X);
        Assert.Equal(13.7f, move.Y, 3);
        Assert.Equal(-1073f, move.Z);
        Assert.Equal(move.Y, output.Position.Y, 3);
    }

    [Fact]
    public async Task TeleportWithoutASurfaceRefusesAndLeavesTheCharacterInPlace()
    {
        var target = new FakeOperatorTarget { Surface = null };
        var command = new OperatorTeleportCommand(target);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorTeleportResult>(),
            new OperatorTeleportArgs { X = 50f, Z = -1073f },
            CancellationToken.None
        );

        AssertFailed(
            result,
            ControlCommandDiagnosticKind.PreconditionFailed,
            OperatorTeleportCommand.SurfaceMissingCode
        );
        Assert.Empty(target.Moves);
    }

    [Fact]
    public async Task TeleportRequiresBothCoordinates()
    {
        var target = new FakeOperatorTarget { Surface = new OperatorSurface(1f, "ground") };
        var command = new OperatorTeleportCommand(target);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorTeleportResult>(),
            new OperatorTeleportArgs { X = 50f },
            CancellationToken.None
        );

        AssertFailed(result, ControlCommandDiagnosticKind.ValidationFailed, "zRequired");
        Assert.Empty(target.Probes);
    }

    [Fact]
    public async Task EnablingPhotoModeLiftsTheClampAndOpensTheCamera()
    {
        var target = new FakeOperatorTarget { DebugTools = false, FreeCameraEnabled = false };
        var command = new OperatorSetPhotoModeCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.True(output.PhotoMode);
        Assert.True(output.RoamingClampLifted);
        Assert.True(output.FreeCamera);
        Assert.True(output.DebugTools);
        Assert.Equal(1, target.EnableFreeCameraCalls);
    }

    [Fact]
    public async Task DisablingPhotoModeRestoresTheFlagTheSessionFound()
    {
        var target = new FakeOperatorTarget
        {
            DebugTools = false,
            FreeCameraEnabled = false,
            ClosesFreeCameraImmediately = true,
        };
        var session = new OperatorSessionLedger();
        var command = new OperatorSetPhotoModeCommand(target, session);

        await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );
        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = false },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.False(output.PhotoMode);
        Assert.False(output.RoamingClampLifted);
        Assert.False(output.FreeCamera);
        Assert.False(output.FreeCameraClosePending);
        Assert.False(target.DebugTools);
        Assert.Equal(1, target.DisableFreeCameraCalls);
        Assert.Empty(session.ChangedKeys);
    }

    [Fact]
    public async Task DisablingPhotoModeRestoresTheClampAndReportsThePendingCameraClose()
    {
        var target = new FakeOperatorTarget { DebugTools = false, FreeCameraEnabled = false };
        var session = new OperatorSessionLedger();
        var command = new OperatorSetPhotoModeCommand(target, session);

        await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );
        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = false },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        var output = result.Output!;
        Assert.False(output.RoamingClampLifted);
        Assert.False(output.DebugTools);
        Assert.False(output.PhotoMode);
        Assert.True(output.FreeCamera);
        Assert.True(output.FreeCameraClosePending);
    }

    [Fact]
    public async Task EnablingPhotoModePausesTheGameAndStatusReportsTheLiveTimescale()
    {
        var target = new FakeOperatorTarget { Timescale = 1f };
        var session = new OperatorSessionLedger();

        await new OperatorSetPhotoModeCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );
        var status = await new OperatorStatusCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorStatusResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        Assert.Equal(0f, status.Output!.Timescale);
        Assert.DoesNotContain(OperatorSessionKeys.Timescale, status.Output.Changed);
    }

    [Fact]
    public async Task StatusForgetsAChangeTheGameReversedItself()
    {
        var target = new FakeOperatorTarget { Timescale = 1f };
        var session = new OperatorSessionLedger();

        await new OperatorSetTimescaleCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorTimescaleResult>(),
            new OperatorTimescaleArgs { Scale = 0.5f },
            CancellationToken.None
        );
        Assert.Contains(OperatorSessionKeys.Timescale, session.ChangedKeys);

        // The game restores the timescale itself when it closes the free camera.
        target.Timescale = 1f;

        var status = await new OperatorStatusCommand(target, session).ExecuteAsync(
            TestControlCommandContext.Create<OperatorStatusResult>(),
            new EmptyArgs(),
            CancellationToken.None
        );

        Assert.Equal(1f, status.Output!.Timescale);
        Assert.DoesNotContain(OperatorSessionKeys.Timescale, status.Output.Changed);
    }

    [Fact]
    public async Task DisablingPhotoModeKeepsAFlagTheSessionNeverSet()
    {
        var target = new FakeOperatorTarget { DebugTools = true, FreeCameraEnabled = false };
        var session = new OperatorSessionLedger();
        var command = new OperatorSetPhotoModeCommand(target, session);

        await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = true },
            CancellationToken.None
        );
        await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorPhotoModeResult>(),
            new OperatorEnabledArgs { Enabled = false },
            CancellationToken.None
        );

        Assert.True(target.DebugTools);
    }

    [Fact]
    public async Task SettingTheTimescaleToZeroPausesAndReportsIt()
    {
        var target = new FakeOperatorTarget { Timescale = 1f };
        var command = new OperatorSetTimescaleCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorTimescaleResult>(),
            new OperatorTimescaleArgs { Scale = 0f },
            CancellationToken.None
        );

        Assert.True(result.Succeeded);
        Assert.Equal(0f, result.Output!.Timescale);
        Assert.Equal(0f, target.Timescale);
    }

    [Theory]
    [InlineData(1.5f)]
    [InlineData(-0.5f)]
    [InlineData(float.NaN)]
    public async Task AnUnappliedTimescaleIsRejected(float scale)
    {
        var target = new FakeOperatorTarget { Timescale = 1f };
        var command = new OperatorSetTimescaleCommand(target, new OperatorSessionLedger());

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<OperatorTimescaleResult>(),
            new OperatorTimescaleArgs { Scale = scale },
            CancellationToken.None
        );

        AssertFailed(
            result,
            ControlCommandDiagnosticKind.ValidationFailed,
            OperatorSetTimescaleCommand.ScaleOutOfRangeCode
        );
        Assert.Equal(1f, target.Timescale);
    }

    private static void AssertFailed<TOutput>(
        ControlCommandResult<TOutput> result,
        ControlCommandDiagnosticKind kind,
        string code
    )
    {
        Assert.False(result.Succeeded);
        Assert.Null(result.Output);
        var diagnostic = Assert.Single(result.Diagnostics);
        Assert.Equal(kind, diagnostic.Kind);
        Assert.Equal(code, diagnostic.Code);
    }

    private sealed class FakeOperatorTarget : IOperatorTarget
    {
        public bool HasCharacter { get; set; } = true;

        public bool HasGame { get; set; } = true;

        public bool Invulnerable { get; set; }

        public bool IsDead { get; set; }

        public bool DeathInterfaceOpen { get; set; }

        public bool FreeCameraEnabled { get; set; }

        public bool DebugTools { get; set; }

        public float Timescale { get; set; } = 1f;

        public OperatorPoint CharacterPosition { get; private set; } = new(0f, 0f, 0f);

        public OperatorSurface? Surface { get; set; }

        public int ReviveCalls { get; private set; }

        public int StopAnimationOverrideCalls { get; private set; }

        public int RefreshAnimatorStateCalls { get; private set; }

        public int EnableFreeCameraCalls { get; private set; }

        public int DisableFreeCameraCalls { get; private set; }

        public List<OperatorPoint> Moves { get; } = new();

        public List<OperatorPoint> Probes { get; } = new();

        public void Revive()
        {
            ReviveCalls++;
            IsDead = false;
            // The game's own Revive closes the death interface, which is why recovery reads that
            // interface before it revives.
            DeathInterfaceOpen = false;
        }

        public void CloseDeathInterface() => DeathInterfaceOpen = false;

        public void StopAnimationOverride() => StopAnimationOverrideCalls++;

        public void RefreshAnimatorState() => RefreshAnimatorStateCalls++;

        public void EnableFreeCamera()
        {
            EnableFreeCameraCalls++;
            FreeCameraEnabled = true;
            // Opening the free-camera layer pauses the game, measured live as timescale 0.
            Timescale = 0f;
        }

        /// <summary>
        /// Whether closing the free camera finishes at once. The game defers it behind the layer's close
        /// animation, which is the default here.
        /// </summary>
        public bool ClosesFreeCameraImmediately { get; set; }

        public void DisableFreeCamera()
        {
            DisableFreeCameraCalls++;
            if (!ClosesFreeCameraImmediately) return;
            FreeCameraEnabled = false;
            // The game's own close step restores the timescale it paused for the free camera.
            Timescale = 1f;
        }

        public void MoveCharacter(OperatorPoint position)
        {
            Moves.Add(position);
            CharacterPosition = position;
        }

        public OperatorSurface? FindSurface(float x, float z)
        {
            Probes.Add(new OperatorPoint(x, 0f, z));
            return Surface;
        }
    }
}
