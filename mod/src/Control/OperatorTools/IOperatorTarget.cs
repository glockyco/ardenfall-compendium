namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>
/// The live game state the operator commands read and change.
/// </summary>
/// <remarks>
/// One target owns every value the commands share, because a status command reports all of it and a
/// split would give several producers of one fact. Every member resolves against the running game on
/// access, so a target may be constructed before the world loads.
/// </remarks>
public interface IOperatorTarget
{
    /// <summary>Whether a live player character exists. False before the world loads.</summary>
    bool HasCharacter { get; }

    /// <summary>Whether a live game instance and its build settings exist.</summary>
    bool HasGame { get; }

    /// <summary>The game's own damage floor, which keeps health at 1 instead of blocking damage.</summary>
    bool Invulnerable { get; set; }

    bool IsDead { get; }

    bool DeathInterfaceOpen { get; }

    bool FreeCameraEnabled { get; }

    /// <summary>
    /// The game's <c>enableDebugTools</c> flag. One field: <c>BuildSettingsFile.Instance</c> returns
    /// <c>ArdenfallMaster.buildSettings</c>, so it is exposed once here.
    /// </summary>
    bool DebugTools { get; set; }

    /// <summary>The game's tool timescale, which it multiplies into <c>Time.timeScale</c>.</summary>
    float Timescale { get; set; }

    OperatorPoint CharacterPosition { get; }

    void Revive();

    void CloseDeathInterface();

    void StopAnimationOverride();

    void RefreshAnimatorState();

    void EnableFreeCamera();

    void DisableFreeCamera();

    void MoveCharacter(OperatorPoint position);

    /// <summary>
    /// Finds the surface under a horizontal target, ignoring water and the character's own colliders.
    /// Returns null when no surface lies within the probe distance.
    /// </summary>
    OperatorSurface? FindSurface(float x, float z);
}
