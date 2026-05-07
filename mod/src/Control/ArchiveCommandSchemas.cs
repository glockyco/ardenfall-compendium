using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control;

public static class ArchiveCommandSchemas
{
    public static JObject EmptyObject { get; } = JObject.Parse("{\"type\":\"object\",\"additionalProperties\":false}");
    public static JObject AnyObject { get; } = JObject.Parse("{\"type\":\"object\"}");
}
