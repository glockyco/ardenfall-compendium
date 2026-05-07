using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace ArdenfallCompendium.Emit;

public static class JsonSettings
{
    public static readonly JsonSerializerSettings Default = new()
    {
        Formatting = Formatting.Indented,
        NullValueHandling = NullValueHandling.Include,
        DefaultValueHandling = DefaultValueHandling.Include,
        ContractResolver = new DefaultContractResolver { NamingStrategy = new CamelCaseNamingStrategy() },
    };
}
