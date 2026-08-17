namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>
/// One surface found under a teleport target. The name travels with the height so an operator can
/// tell a rooftop from a seabed without a second probe.
/// </summary>
public readonly struct OperatorSurface
{
    public OperatorSurface(float height, string name)
    {
        Height = height;
        Name = name;
    }

    public float Height { get; }

    public string Name { get; }
}
