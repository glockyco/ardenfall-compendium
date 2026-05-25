using System.IO;

namespace ArdenfallCompendium.Emit;

public static class AtomicFile
{
    public static void WriteAllText(string path, string contents)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        var tempPath = path + ".tmp";
        if (File.Exists(tempPath)) File.Delete(tempPath);
        File.WriteAllText(tempPath, contents);
        if (File.Exists(path)) File.Replace(tempPath, path, null);
        else File.Move(tempPath, path);
    }
}
