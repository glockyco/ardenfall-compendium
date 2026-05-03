// Polyfill for `init`-only properties on net472 (which predates IsExternalInit).
// Required by C# 9+ init accessors. The compiler synthesises a [modreq] reference
// to this type; declaring it as internal in our assembly satisfies the reference
// without depending on a newer BCL.
namespace System.Runtime.CompilerServices;

internal static class IsExternalInit { }
