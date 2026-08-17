using ArdenfallCompendium.Control.OperatorTools;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class OperatorSessionLedgerTests
{
    [Fact]
    public void RecordsTheValueAFlagHeldBeforeTheChange()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteFlagChange(OperatorSessionKeys.DebugTools, before: false, after: true);

        Assert.True(ledger.HasChanged(OperatorSessionKeys.DebugTools));
        Assert.True(ledger.TryTakeFlag(OperatorSessionKeys.DebugTools, out var original));
        Assert.False(original);
    }

    [Fact]
    public void KeepsTheFirstValueThroughARepeatedChange()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteFlagChange(OperatorSessionKeys.DebugTools, before: false, after: true);
        ledger.NoteFlagChange(OperatorSessionKeys.DebugTools, before: true, after: true);

        Assert.True(ledger.TryTakeFlag(OperatorSessionKeys.DebugTools, out var original));
        Assert.False(original);
    }

    [Fact]
    public void ForgetsTheChangeWhenAValueReturnsToItsFirstValue()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteFlagChange(OperatorSessionKeys.Invulnerable, before: false, after: true);
        ledger.NoteFlagChange(OperatorSessionKeys.Invulnerable, before: true, after: false);

        Assert.False(ledger.HasChanged(OperatorSessionKeys.Invulnerable));
        Assert.False(ledger.TryTakeFlag(OperatorSessionKeys.Invulnerable, out _));
    }

    [Fact]
    public void RecordsNothingWhenAWriteChangedNothing()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteFlagChange(OperatorSessionKeys.Invulnerable, before: true, after: true);

        Assert.False(ledger.HasChanged(OperatorSessionKeys.Invulnerable));
        Assert.Empty(ledger.ChangedKeys);
    }

    [Fact]
    public void TakingAFlagBackForgetsTheChange()
    {
        var ledger = new OperatorSessionLedger();
        ledger.NoteFlagChange(OperatorSessionKeys.DebugTools, before: true, after: false);

        Assert.True(ledger.TryTakeFlag(OperatorSessionKeys.DebugTools, out var original));

        Assert.True(original);
        Assert.False(ledger.HasChanged(OperatorSessionKeys.DebugTools));
        Assert.False(ledger.TryTakeFlag(OperatorSessionKeys.DebugTools, out _));
    }

    [Fact]
    public void TracksNumbersBesideFlags()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteNumberChange(OperatorSessionKeys.Timescale, before: 1f, after: 0f);

        Assert.True(ledger.HasChanged(OperatorSessionKeys.Timescale));

        ledger.NoteNumberChange(OperatorSessionKeys.Timescale, before: 0f, after: 1f);

        Assert.False(ledger.HasChanged(OperatorSessionKeys.Timescale));
    }

    [Fact]
    public void ReportsChangedKeysInAStableOrder()
    {
        var ledger = new OperatorSessionLedger();

        ledger.NoteNumberChange(OperatorSessionKeys.Timescale, before: 1f, after: 0f);
        ledger.NoteFlagChange(OperatorSessionKeys.Invulnerable, before: false, after: true);
        ledger.MarkChanged(OperatorSessionKeys.PhotoMode);

        Assert.Equal(
            new[]
            {
                OperatorSessionKeys.Invulnerable,
                OperatorSessionKeys.PhotoMode,
                OperatorSessionKeys.Timescale,
            },
            ledger.ChangedKeys
        );
    }
}
