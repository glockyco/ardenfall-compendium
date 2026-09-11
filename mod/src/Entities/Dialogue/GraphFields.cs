using System;
using System.Collections.Concurrent;
using System.Reflection;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>
/// Reads the authored value of a serialized field, whatever its access level.
/// </summary>
/// <remarks>
/// The dialogue nodes keep most authored data in private fields marked `[SerializeField]`:
/// `GreetingFlowNode.statement`, `MultipleChoiceFlowNode.availableChoices`,
/// `CharacterGraphRef.characterRecord`. Unity deserializes them, and the public accessors that exist
/// need a live graph, so an asset-time walk reads the fields.
///
/// A missing field is a build change rather than a bug in the caller, so a read returns the default
/// and the caller reports the node as unread instead of throwing.
/// </remarks>
internal static class GraphFields
{
    private const BindingFlags Flags =
        BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    private static readonly ConcurrentDictionary<(Type, string), FieldInfo?> Cache = new();

    public static bool TryRead<T>(object owner, string field, out T value)
    {
        value = default!;
        var info = Cache.GetOrAdd((owner.GetType(), field), key => Find(key.Item1, key.Item2));
        if (info == null) return false;
        var read = info.GetValue(owner);
        if (read is not T typed) return false;
        value = typed;
        return true;
    }

    public static T? Read<T>(object owner, string field)
        where T : class => TryRead<T>(owner, field, out var value) ? value : null;

    public static int ReadInt(object owner, string field) =>
        TryRead<int>(owner, field, out var value) ? value : 0;

    public static bool ReadBool(object owner, string field) =>
        TryRead<bool>(owner, field, out var value) && value;

    /// <summary>The authored value of an enum field, as the game names it.</summary>
    public static string? ReadEnumName(object owner, string field)
    {
        var info = Cache.GetOrAdd((owner.GetType(), field), key => Find(key.Item1, key.Item2));
        var read = info?.GetValue(owner);
        return read is Enum value ? value.ToString() : null;
    }

    /// <summary>
    /// The authored value of a property, walking the declaration hierarchy.
    /// </summary>
    /// <remarks>
    /// A generic wrapper such as `BBParameter&lt;int&gt;` declares `value` and inherits another
    /// `value` from its base, so a plain lookup throws `AmbiguousMatchException`. Walking the
    /// hierarchy takes the most derived declaration, which is the authored one.
    /// </remarks>
    public static T? ReadProperty<T>(object owner, string property)
        where T : struct
    {
        for (var current = owner.GetType(); current != null; current = current.BaseType)
        {
            var info = current.GetProperty(property, Flags | BindingFlags.DeclaredOnly);
            if (info == null) continue;
            return info.GetValue(owner) is T value ? value : null;
        }

        return null;
    }

    /// <summary>Walks the declaration hierarchy, because a node inherits most of its authored data.</summary>
    private static FieldInfo? Find(Type type, string field)
    {
        for (var current = type; current != null; current = current.BaseType)
        {
            var info = current.GetField(field, Flags);
            if (info != null) return info;
        }

        return null;
    }
}
