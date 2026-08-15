using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;

namespace ArdenfallCompendium.Walker;

/// <summary>
/// Identifies the object that authored a parameter value. The game's Parameter.IsSet
/// is the authored-value test (Ardenfall/Parameter.cs:23), while ParameterizedObject.parent
/// is the prototype link (Ardenfall/ParameterizedObject.cs:11-18).
/// </summary>
public readonly struct ParameterOwnership
{
    public ParameterOwnership(bool isSet, ParameterizedObject? owner)
    {
        IsSet = isSet;
        Owner = owner;
    }

    /// <summary>
    /// True when the queried parameter is set on the object supplied to the resolver;
    /// this follows Parameter.IsSet (Ardenfall/Parameter.cs:23).
    /// </summary>
    public bool IsSet { get; }

    /// <summary>
    /// The nearest object whose same-named parameter is set, or null when the chain
    /// has no authored value. ParameterizedObject.GetValue returns that parameter
    /// while walking parent links (Ardenfall/ParameterizedObject.cs:185-193), so
    /// this parallel walk retains the object that supplied it.
    /// </summary>
    public ParameterizedObject? Owner { get; }

    /// <summary>True when the value is authored by an ancestor rather than the queried object.</summary>
    public bool Inherited => !IsSet && Owner != null;

    /// <summary>True when no object in the chain authored the parameter.</summary>
    public bool Absent => Owner == null;
}

/// <summary>Pairs a game-resolved value with the object that authored it.</summary>
public readonly struct ParameterResolution<T>
{
    public ParameterResolution(T value, ParameterOwnership ownership)
    {
        Value = value;
        Ownership = ownership;
    }

    /// <summary>The value returned by the game's Parameter.Get or SmartListParameter.Get.</summary>
    public T Value { get; }

    /// <summary>The authored-value information found while walking the prototype chain.</summary>
    public ParameterOwnership Ownership { get; }
}

/// <summary>
/// Resolves parameter ownership along Ardenfall's prototype chain. Parameter.Get already
/// performs value resolution through parent.GetValue (Ardenfall/Parameter.cs:142-184),
/// so this class walks only to identify the node that set the value.
/// </summary>
public static class ParameterChain
{
    private const BindingFlags InstanceFields = BindingFlags.Instance |
                                                 BindingFlags.Public |
                                                 BindingFlags.NonPublic |
                                                 BindingFlags.DeclaredOnly;

    /// <summary>
    /// Resolve a Parameter value and identify its author. The value is obtained from
    /// Parameter.Get, whose parent lookup is defined at Ardenfall/Parameter.cs:142-184;
    /// the separate ownership walk follows the same field through parent links described
    /// by Ardenfall/ParameterizedObject.cs:185-193.
    /// </summary>
    public static ParameterResolution<T> Resolve<T>(ParameterizedObject owner, Parameter<T> parameter)
    {
        if (owner == null) throw new ArgumentNullException(nameof(owner));
        if (parameter == null) throw new ArgumentNullException(nameof(parameter));

        var parameterName = FindParameterName(owner, parameter);
        var ownership = FindOwnership(owner, parameterName, typeof(Parameter<T>), out var cycle);
        var value = cycle && ownership.Absent ? default! : parameter.Get();
        return new ParameterResolution<T>(value, ownership);
    }

    /// <summary>
    /// Resolve a Parameter using its recorded owner. Parameter.Init stores that owner
    /// (Ardenfall/Parameter.cs:29-33), and Parameter.Get uses it for parent resolution
    /// (Ardenfall/Parameter.cs:150-179).
    /// </summary>
    public static ParameterResolution<T> Resolve<T>(Parameter<T> parameter)
    {
        if (parameter == null) throw new ArgumentNullException(nameof(parameter));
        return Resolve(parameter.owner, parameter);
    }

    /// <summary>
    /// Resolve a SmartListParameter value and identify its author. SmartListParameter.Get
    /// resolves an unset list through owner.parent.GetValue (Ardenfall/SmartListParameter.cs:51-75),
    /// while IsSet remains the authored-value test (Ardenfall/SmartListParameter.cs:23-25).
    /// </summary>
    public static ParameterResolution<List<T>> Resolve<T>(
        ParameterizedObject owner,
        SmartListParameter<T> parameter)
    {
        if (owner == null) throw new ArgumentNullException(nameof(owner));
        if (parameter == null) throw new ArgumentNullException(nameof(parameter));

        var parameterName = FindParameterName(owner, parameter);
        var ownership = FindOwnership(owner, parameterName, typeof(SmartListParameter<T>), out var cycle);
        var value = cycle && ownership.Absent ? new List<T>() : parameter.Get();
        return new ParameterResolution<List<T>>(value, ownership);
    }

    /// <summary>
    /// Resolve a SmartListParameter using its recorded owner. SmartListParameter.Init
    /// delegates to Parameter.Init (Ardenfall/SmartListParameter.cs:35-44), which records
    /// the owner used by its Get implementation.
    /// </summary>
    public static ParameterResolution<List<T>> Resolve<T>(SmartListParameter<T> parameter)
    {
        if (parameter == null) throw new ArgumentNullException(nameof(parameter));
        return Resolve(parameter.owner, parameter);
    }

    /// <summary>
    /// Return the immediate parent, honoring UnityEngine.Object's overloaded null
    /// comparison for destroyed ScriptableObjects. The field is the game's prototype
    /// link (Ardenfall/ParameterizedObject.cs:11-18), and the game checks it with null
    /// before continuing its own chain walk (Ardenfall/ParameterizedObject.cs:75-79).
    /// </summary>
    public static ParameterizedObject? GetParent(ParameterizedObject? value)
    {
        if (value == null || value.parent == null) return null;
        return value.parent;
    }

    /// <summary>
    /// Return the nearest ancestor satisfying <paramref name="predicate"/>. The game
    /// guards its recursive HasParentInChain walk against infinite parent chains
    /// (Ardenfall/ParameterizedObject.cs:69-102); this walk uses an instance-ID set
    /// instead of the game's runtime cache so every call remains safe and current.
    /// </summary>
    public static ParameterizedObject? FindAncestor(
        ParameterizedObject? value,
        Func<ParameterizedObject, bool> predicate)
    {
        if (predicate == null) throw new ArgumentNullException(nameof(predicate));

        var current = GetParent(value);
        var visited = new HashSet<int>();
        while (current != null)
        {
            if (!visited.Add(current.GetInstanceID())) return null;
            if (predicate(current)) return current;
            current = GetParent(current);
        }

        return null;
    }

    private static ParameterOwnership FindOwnership(
        ParameterizedObject owner,
        string parameterName,
        Type parameterType,
        out bool cycle)
    {
        var current = owner;
        var visited = new HashSet<int>();
        cycle = false;

        while (current != null)
        {
            if (!visited.Add(current.GetInstanceID()))
            {
                cycle = true;
                break;
            }

            var parameter = FindField(current.GetType(), parameterName)?.GetValue(current) as Parameter;
            if (parameter != null && parameterType.IsInstanceOfType(parameter) && parameter.IsSet)
            {
                return new ParameterOwnership(ReferenceEquals(current, owner), current);
            }

            current = GetParent(current);
        }

        return new ParameterOwnership(false, null);
    }

    private static string FindParameterName(ParameterizedObject owner, Parameter parameter)
    {
        for (var type = owner.GetType(); type != null && typeof(ParameterizedObject).IsAssignableFrom(type); type = type.BaseType)
        {
            foreach (var field in type.GetFields(InstanceFields))
            {
                if (typeof(Parameter).IsAssignableFrom(field.FieldType) &&
                    ReferenceEquals(field.GetValue(owner), parameter))
                {
                    return field.Name;
                }
            }
        }

        throw new ArgumentException("The parameter is not a field on the supplied owner.", nameof(parameter));
    }

    private static FieldInfo? FindField(Type type, string name)
    {
        for (var current = type; current != null && typeof(ParameterizedObject).IsAssignableFrom(current); current = current.BaseType)
        {
            var field = current.GetField(name, InstanceFields);
            if (field != null) return field;
        }

        return null;
    }
}
