using System;
using HotRepl.Control;
using HotRepl.Control.Artifacts;

namespace ArdenfallCompendium.Tests;

internal static class TestControlCommandContext
{
    public static ControlCommandContext<TOutput> Create<TOutput>() =>
        new(
            requestId: "test-1",
            timeout: TimeSpan.FromSeconds(30),
            jobId: null,
            progress: null,
            artifacts: new InMemoryArtifactWriter()
        );
}
