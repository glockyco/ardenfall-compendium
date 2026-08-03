using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace ArdenfallCompendium.Assets;

public sealed record SpriteAssetExport(string PngHash, string SourcePath);

public sealed class SpriteAssetExporter
{
    /// <summary>
    /// Cuts a sprite's rectangle out of a texture and returns it in image row order.
    /// </summary>
    ///
    /// <remarks>
    /// Unity puts the origin of a texture at the bottom left, so row 0 of
    /// <c>GetRawTextureData</c> is the bottom row of the picture. PNG puts the origin at the
    /// top left. The rows are therefore copied in reverse, which turns the picture the right
    /// way up at no extra cost, because the copy already walks one row at a time.
    ///
    /// The <c>y</c> argument stays in Unity space, because it comes from
    /// <c>Sprite.textureRect</c> and must index the buffer it was measured against.
    /// </remarks>
    public static byte[] CropRgba(byte[] rgba, int textureWidth, int textureHeight, int x, int y, int width, int height)
    {
        if (textureWidth <= 0) throw new ArgumentOutOfRangeException(nameof(textureWidth));
        if (textureHeight <= 0) throw new ArgumentOutOfRangeException(nameof(textureHeight));
        if (width <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (height <= 0) throw new ArgumentOutOfRangeException(nameof(height));
        if (x < 0 || y < 0 || x + width > textureWidth || y + height > textureHeight) throw new ArgumentOutOfRangeException(nameof(x));
        if (rgba.Length < textureWidth * textureHeight * 4) throw new ArgumentException("RGBA buffer is smaller than texture dimensions.", nameof(rgba));

        var output = new byte[width * height * 4];
        for (var row = 0; row < height; row++)
        {
            var sourceOffset = ((y + row) * textureWidth + x) * 4;
            var targetOffset = (height - 1 - row) * width * 4;
            Buffer.BlockCopy(rgba, sourceOffset, output, targetOffset, width * 4);
        }
        return output;
    }

    public static string Sha256Hex(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    private static byte[] EncodeRgbaPng(byte[] rgba, int width, int height)
    {
        using var output = new MemoryStream();
        output.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, 0, 8);

        var ihdr = new byte[13];
        WriteUInt32BigEndian(ihdr, 0, (uint)width);
        WriteUInt32BigEndian(ihdr, 4, (uint)height);
        ihdr[8] = 8;
        ihdr[9] = 6;
        WriteChunk(output, "IHDR", ihdr);

        var scanlines = new byte[height * (width * 4 + 1)];
        for (var row = 0; row < height; row++)
        {
            var targetOffset = row * (width * 4 + 1);
            scanlines[targetOffset] = 0;
            Buffer.BlockCopy(rgba, row * width * 4, scanlines, targetOffset + 1, width * 4);
        }
        WriteChunk(output, "IDAT", ZlibStore(scanlines));
        WriteChunk(output, "IEND", Array.Empty<byte>());
        return output.ToArray();
    }

    private static byte[] ZlibStore(byte[] input)
    {
        using var output = new MemoryStream();
        output.WriteByte(0x78);
        output.WriteByte(0x01);
        var offset = 0;
        while (offset < input.Length)
        {
            var blockLength = Math.Min(65535, input.Length - offset);
            var final = offset + blockLength == input.Length;
            output.WriteByte(final ? (byte)1 : (byte)0);
            output.WriteByte((byte)(blockLength & 0xff));
            output.WriteByte((byte)(blockLength >> 8));
            var complement = (ushort)~blockLength;
            output.WriteByte((byte)(complement & 0xff));
            output.WriteByte((byte)(complement >> 8));
            output.Write(input, offset, blockLength);
            offset += blockLength;
        }
        WriteUInt32BigEndian(output, Adler32(input));
        return output.ToArray();
    }

    private static uint Adler32(byte[] input)
    {
        const uint mod = 65521;
        uint a = 1;
        uint b = 0;
        foreach (var value in input)
        {
            a = (a + value) % mod;
            b = (b + a) % mod;
        }
        return (b << 16) | a;
    }

    private static void WriteChunk(Stream output, string type, byte[] data)
    {
        WriteUInt32BigEndian(output, (uint)data.Length);
        var typeBytes = Encoding.ASCII.GetBytes(type);
        output.Write(typeBytes, 0, typeBytes.Length);
        output.Write(data, 0, data.Length);
        var crcInput = new byte[typeBytes.Length + data.Length];
        Buffer.BlockCopy(typeBytes, 0, crcInput, 0, typeBytes.Length);
        Buffer.BlockCopy(data, 0, crcInput, typeBytes.Length, data.Length);
        WriteUInt32BigEndian(output, Crc32(crcInput));
    }

    private static uint Crc32(byte[] input)
    {
        uint crc = 0xffffffff;
        foreach (var value in input)
        {
            crc ^= value;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) == 1 ? (crc >> 1) ^ 0xedb88320u : crc >> 1;
            }
        }
        return ~crc;
    }

    private static void WriteUInt32BigEndian(Stream output, uint value)
    {
        output.WriteByte((byte)(value >> 24));
        output.WriteByte((byte)(value >> 16));
        output.WriteByte((byte)(value >> 8));
        output.WriteByte((byte)value);
    }

    private static void WriteUInt32BigEndian(byte[] output, int offset, uint value)
    {
        output[offset] = (byte)(value >> 24);
        output[offset + 1] = (byte)(value >> 16);
        output[offset + 2] = (byte)(value >> 8);
        output[offset + 3] = (byte)value;
    }

    public SpriteAssetExport WriteSpritePng(Sprite sprite, string stagingDir, string entityId)
    {
        if (sprite == null) throw new ArgumentNullException(nameof(sprite));
        var texture = sprite.texture;
        var rect = sprite.textureRect;
        var x = Mathf.RoundToInt(rect.x);
        var y = Mathf.RoundToInt(rect.y);
        var width = Mathf.RoundToInt(rect.width);
        var height = Mathf.RoundToInt(rect.height);
        var previous = RenderTexture.active;
        var rt = RenderTexture.GetTemporary(texture.width, texture.height, 0, RenderTextureFormat.ARGB32);
        Texture2D? readable = null;
        try
        {
            Graphics.Blit(texture, rt);
            RenderTexture.active = rt;
            readable = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false);
            readable.ReadPixels(new Rect(0, 0, texture.width, texture.height), 0, 0);
            readable.Apply();
            var cropped = CropRgba(readable.GetRawTextureData(), readable.width, readable.height, x, y, width, height);
            var png = EncodeRgbaPng(cropped, width, height);
            var hash = Sha256Hex(png);
            var relativePath = $"assets/{entityId}/{hash}.png";
            var fullPath = Path.Combine(stagingDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            if (!File.Exists(fullPath)) File.WriteAllBytes(fullPath, png);
            return new SpriteAssetExport(hash, relativePath);
        }
        finally
        {
            if (readable != null) UnityEngine.Object.Destroy(readable);
            RenderTexture.active = previous;
            RenderTexture.ReleaseTemporary(rt);
        }
    }
}
