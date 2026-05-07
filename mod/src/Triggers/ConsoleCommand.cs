using BepInEx.Logging;

namespace ArdenfallCompendium.Triggers;

public static class ConsoleCommand
{
    /// <summary>
    /// Registers /extract and /status with the game console if a console API exists.
    /// If not, this is a no-op and the hotkey is the only trigger.
    /// </summary>
    public static void TryRegister(ManualLogSource log, Plugin plugin)
    {
        log.LogInfo("console command registration: not implemented in slice 1; use F8 hotkey.");
    }
}
