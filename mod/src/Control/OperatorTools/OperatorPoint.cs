using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>
/// A world position in the operator surface. Deliberately not <c>UnityEngine.Vector3</c>: the mod
/// tests run on .NET 10 with no Unity runtime, and the operator logic must execute there.
/// </summary>
public readonly struct OperatorPoint
{
    public OperatorPoint(float x, float y, float z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    [JsonProperty("x", Required = Required.Always)]
    public float X { get; }

    [JsonProperty("y", Required = Required.Always)]
    public float Y { get; }

    [JsonProperty("z", Required = Required.Always)]
    public float Z { get; }
}
