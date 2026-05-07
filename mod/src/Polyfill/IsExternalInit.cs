// Polyfill for `init`-only properties when targeting frameworks whose reference
// assemblies do not provide IsExternalInit. The C# compiler synthesizes a [modreq]
// reference to this type; declaring it as internal in our assembly satisfies the
// reference without depending on a newer BCL.
namespace System.Runtime.CompilerServices;

internal static class IsExternalInit { }
