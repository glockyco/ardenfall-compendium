using System;
using System.Collections.Generic;
using HotRepl.Control;

namespace ArdenfallArchives.Control;

public sealed class ArchiveCommandRegistry : IDisposable
{
    private readonly List<IDisposable> _registrations = new();

    public ArchiveCommandRegistry(ArchiveRunManager runs, string outputBaseDir)
    {
        Register(new Handlers.ArchiveInfoCommand());
        Register(new Handlers.ArchivePreflightCommand());
    }

    private void Register(IControlCommandHandler handler)
    {
        _registrations.Add(GlobalControlCommandRegistry.Instance.Register(handler));
    }

    public void Dispose()
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear();
    }
}
