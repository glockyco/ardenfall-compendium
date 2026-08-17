using System;
using Ardenfall;
using Ardenfall.Animation;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>
/// Binds the operator surface to the running game. Every member resolves on access, so this target may
/// be constructed while the main menu is still open.
/// </summary>
public sealed class UnityOperatorTarget : IOperatorTarget
{
    /// <summary>Where the surface probe starts, above the tallest authored geometry.</summary>
    private const float ProbeHeight = 300f;

    /// <summary>How far the probe reaches down from <see cref="ProbeHeight" />.</summary>
    private const float ProbeDistance = 600f;

    private ArdenfallMaster? _master;

    public bool HasCharacter => PlayerCharacter.instance != null;

    public bool HasGame => ArdenfallGame.instance != null && BuildSettings != null;

    public bool Invulnerable
    {
        get => Character.GodMode;
        set => Character.GodMode = value;
    }

    public bool IsDead => Character.Dead;

    public bool DeathInterfaceOpen => Character.GameUI.deathLayer.gameObject.activeSelf;

    public bool FreeCameraEnabled => Game.freeCameraEnabled;

    public bool DebugTools
    {
        get => RequiredBuildSettings.enableDebugTools;
        set => RequiredBuildSettings.enableDebugTools = value;
    }

    public float Timescale
    {
        get => Game.toolTimeScale;
        set => Game.SetToolTimescale(value);
    }

    public OperatorPoint CharacterPosition
    {
        get
        {
            var position = Character.transform.position;
            return new OperatorPoint(position.x, position.y, position.z);
        }
    }

    private static PlayerCharacter Character =>
        PlayerCharacter.instance != null
            ? PlayerCharacter.instance
            : throw new InvalidOperationException("No live player character is available");

    private static ArdenfallGame Game =>
        ArdenfallGame.instance != null
            ? ArdenfallGame.instance
            : throw new InvalidOperationException("No live game instance is available");

    /// <summary>
    /// The one <c>enableDebugTools</c> holder. <c>BuildSettingsFile.Instance</c> reads the same object
    /// through <c>MonoBehaviourSingleton</c>, whose getter creates a master when none exists, so this
    /// target finds the existing one instead.
    /// </summary>
    private BuildSettingsFile? BuildSettings
    {
        get
        {
            if (_master == null) _master = UnityObject.FindObjectOfType<ArdenfallMaster>();
            return _master == null ? null : _master.buildSettings;
        }
    }

    private BuildSettingsFile RequiredBuildSettings =>
        BuildSettings
        ?? throw new InvalidOperationException("No live build settings are available");

    public void Revive() => Character.Revive();

    public void CloseDeathInterface() => Character.GameUI.deathLayer.CloseLayer();

    public void StopAnimationOverride() => Animator.StopOverridingAnimation(0f);

    public void RefreshAnimatorState() => Animator.ForceUpdateValues();

    public void EnableFreeCamera() => Game.EnableFreeCamera();

    /// <summary>
    /// Closes the free camera through its layer, which is how the game closes it: the layer shows the
    /// player again and then calls <c>ArdenfallGame.DisableFreeCamera</c>.
    /// </summary>
    public void DisableFreeCamera() => Character.GameUI.freeCameraLayer.CloseLayer();

    public void MoveCharacter(OperatorPoint position) =>
        Character.TeleportFar(new Vector3(position.X, position.Y, position.Z));

    public OperatorSurface? FindSurface(float x, float z)
    {
        var character = Character;
        var origin = new Vector3(x, ProbeHeight, z);
        var hits = Physics.RaycastAll(origin, Vector3.down, ProbeDistance, SurfaceLayerMask());
        Array.Sort(hits, CompareByDistance);

        var characterRoot = character.transform.root;
        foreach (var hit in hits)
        {
            if (hit.collider == null) continue;
            if (hit.collider.transform.root == characterRoot) continue;
            return new OperatorSurface(hit.point.y, hit.collider.name);
        }

        return null;
    }

    /// <summary>
    /// Everything a character can stand on. Water, items, damageables, and characters are excluded:
    /// a teleport that lands on a crate or on an NPC is not standing on the world.
    /// </summary>
    private static int SurfaceLayerMask() =>
        ~(
            (1 << LayerUtility.WaterLayer)
            | (1 << LayerUtility.ItemLayer)
            | (1 << LayerUtility.DamagableLayer)
            | (1 << LayerUtility.PlayerLayer)
            | (1 << LayerUtility.NpcLayer)
            | (1 << LayerUtility.RagdollLayer)
        );

    private static CharacterAvatarAnimator Animator
    {
        get
        {
            var avatar = Character.avatar;
            if (avatar == null)
                throw new InvalidOperationException("The player character has no avatar");
            return avatar.characterAnimator
                ?? throw new InvalidOperationException("The player avatar has no animator");
        }
    }

    private static readonly Comparison<RaycastHit> CompareByDistance = (left, right) =>
        left.distance.CompareTo(right.distance);
}
