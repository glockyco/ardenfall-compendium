using System;
using BepInEx.Logging;
using UnityEngine.SceneManagement;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Triggers;

public sealed class ReadinessMonitor : IDisposable
{
    private readonly ManualLogSource _log;
    private bool _loggedReady;

    public ReadinessMonitor(ManualLogSource log)
    {
        _log = log;
        SceneManager.sceneLoaded += OnSceneLoaded;
    }

    public void Dispose()
    {
        SceneManager.sceneLoaded -= OnSceneLoaded;
    }

    private void OnSceneLoaded(Scene scene, LoadSceneMode mode)
    {
        if (_loggedReady) return;
        var preflight = PreflightRunner.Run();
        if (preflight.Passed)
        {
            _log.LogInfo("[readiness] preflight now passing; extraction available");
            _loggedReady = true;
        }
    }
}
