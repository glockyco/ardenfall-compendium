using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorPhotoModeResult
{
    [JsonProperty("photoMode", Required = Required.Always)]
    public bool PhotoMode { get; set; }

    /// <summary>Whether the free camera may leave the retail roaming clamp.</summary>
    [JsonProperty("roamingClampLifted", Required = Required.Always)]
    public bool RoamingClampLifted { get; set; }

    /// <summary>The live free-camera state when the command replied.</summary>
    [JsonProperty("freeCamera", Required = Required.Always)]
    public bool FreeCamera { get; set; }

    /// <summary>
    /// True when a disable asked the game to close the free camera and the game has not finished. The
    /// layer closes behind its close animation, and the game restores the timescale in that same step.
    /// </summary>
    [JsonProperty("freeCameraClosePending", Required = Required.Always)]
    public bool FreeCameraClosePending { get; set; }

    /// <summary>The live <c>enableDebugTools</c> flag, which also gates camera speed and smoothing.</summary>
    [JsonProperty("debugTools", Required = Required.Always)]
    public bool DebugTools { get; set; }
}
