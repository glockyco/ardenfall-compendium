using System.IO;
using System.Linq;
using UnityEngine;

namespace ArdenfallCompendium.Game;

public static class GameInfo
{
    public static string Version
    {
        get
        {
            var version = Application.version;
            return string.IsNullOrWhiteSpace(version) ? "unknown" : version;
        }
    }

    public static string SnapshotVersionSegment
    {
        get
        {
            var invalid = Path.GetInvalidFileNameChars();
            var chars = Version.Select(c => invalid.Contains(c) ? '_' : c).ToArray();
            return new string(chars);
        }
    }
}
