using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities;

internal sealed class UnityObjectReferenceComparer<T> : IEqualityComparer<T>
    where T : UnityObject
{
    public static UnityObjectReferenceComparer<T> Instance { get; } = new();

    public bool Equals(T? x, T? y) => ReferenceEquals(x, y);

    public int GetHashCode(T obj) => RuntimeHelpers.GetHashCode(obj);
}
