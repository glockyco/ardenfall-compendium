using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control;

public static class CompendiumCommandSchemas
{
    public static JObject EmptyObject { get; } = JObject.Parse("{\"type\":\"object\",\"additionalProperties\":false}");
    public static JObject AnyObject { get; } = JObject.Parse("{\"type\":\"object\"}");
}
