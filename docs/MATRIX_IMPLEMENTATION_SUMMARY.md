# Matrix Federation Implementation Summary

## Status: ✅ Complete and Working

All Matrix federation endpoints are implemented and cryptographically valid.

## Implemented Endpoints

### 1. Server Discovery
- **URL:** `/.well-known/matrix/server`
- **Purpose:** Tells Matrix clients/servers how to reach this instance
- **Response:** `{"m.server":"gifs.scrubbles.tech:443"}`

### 2. Server Keys (Federation)
- **URL:** `/_matrix/key/v2/server`
- **Purpose:** Publishes Ed25519 signing keys for federation
- **Response:** Properly signed JSON with server's public key
- **Features:**
  - Generates Ed25519 keypair automatically
  - Signs responses with canonical JSON algorithm
  - Unpadded base64 encoding (Matrix spec compliant)
  - Signatures cryptographically verified ✅

### 3. Media Download
- **URL:** `/_matrix/media/v3/download/{serverName}/{mediaId}`
- **Purpose:** Download media files via MXC URIs
- **Modes:**
  - Redirect (default): Returns 308 to S3 URL
  - Proxy: Streams content through server
- **Security:** Only serves public media

### 4. Thumbnail Download
- **URL:** `/_matrix/media/v3/thumbnail/{serverName}/{mediaId}`
- **Purpose:** Download thumbnail previews
- **Modes:** Same as media download
- **Fallback:** Uses original image if no thumbnail exists

### 5. Federation Version
- **URL:** `/_matrix/federation/v1/version`
- **Purpose:** Server version information
- **Response:** `{"server":{"name":"Gifable Media Proxy","version":"1.0.0"}}`

## Implementation Details

### Signing Algorithm
File: `app/utils/matrix-signing.server.ts`

Implements Matrix's canonical JSON signing:
1. **Remove** `signatures` and `unsigned` fields
2. **Recursively sort** all object keys lexicographically
3. **Stringify** with minimal whitespace
4. **Sign** with Ed25519
5. **Encode** signature as unpadded base64

### Keypair Management
- Auto-generates Ed25519 keypairs per server
- Cached in memory (regenerates on restart)
- For production persistence, see `.env.example`

### Route Naming Convention
Remix file-based routing requires escaping special characters:
- `[.]well-known.matrix.server.tsx` → `/.well-known/matrix/server`
- `[_matrix].key.v2.server.tsx` → `/_matrix/key/v2/server`

## Testing

### Local Tests
```bash
APP_URL=http://localhost:3000 TEST_MEDIA_ID=<media-id> ./scripts/test-matrix-federation.sh
```

All 6 tests passing:
- ✅ Server Discovery
- ✅ Media Download (Redirect)
- ✅ Media Download (Proxy)
- ✅ Thumbnail Download
- ✅ Invalid Server Rejection
- ✅ Non-Existent Media Handling

### Federation Tester
Visit: https://federationtester.matrix.org/

Expected results:
- ✅ Connection successful
- ✅ Valid certificates
- ✅ Ed25519 key present
- ✅ **Signature verification passes**
- ⚠️ Some warnings expected (media-only proxy, not full homeserver)

### Signature Verification
Signatures are cryptographically valid and verified with:
- Public key: 32-byte Ed25519 key (unpadded base64)
- Signature: 64-byte Ed25519 signature (unpadded base64)
- Algorithm: Canonical JSON + Ed25519

## Usage

### Generate MXC URIs
```typescript
import { getMxcUri } from "~/utils/media.server";

const mxcUri = getMxcUri(mediaId);
// Returns: "mxc://gifs.scrubbles.tech/abc-123-def"
```

### Use in Matrix Clients
1. Share the MXC URI in any Matrix room
2. Matrix homeservers fetch via `/_matrix/media/v3/download`
3. Media displays in Element, Gomuks, FluffyChat, etc.

## Security

### Public Media Only
- Only `isPublic: true` media is accessible via federation
- Private media returns 404 (not 403 to avoid leaking existence)

### Server Name Validation
- Validates serverName matches APP_URL hostname
- Rejects requests for other servers

### CORS
- Allows cross-origin access for federation
- Required for Matrix homeservers to fetch media

## Port Configuration

**No port 8448 required!**
- Uses standard HTTPS port 443
- `.well-known` endpoint specifies port 443
- Federation Tester may try 8448 first (expected)
- Matrix clients read `.well-known` and use port 443

## Files Added/Modified

### New Files
- `app/routes/[.]well-known.matrix.server.tsx`
- `app/routes/[_matrix].key.v2.server.tsx`
- `app/routes/[_matrix].federation.v1.version.tsx`
- `app/routes/[_matrix].media.v3.download.$serverName.$mediaId.tsx`
- `app/routes/[_matrix].media.v3.thumbnail.$serverName.$mediaId.tsx`
- `app/utils/matrix-signing.server.ts`
- `scripts/test-matrix-federation.sh`
- `docs/matrix-federation.md`
- `docs/matrix-federation-testing.md`
- `docs/matrix-port-configuration.md`

### Modified Files
- `app/utils/media.server.ts` - Added `getMxcUri()` and `mxcUriToHttpUrl()`
- `.env.example` - Added Matrix documentation
- `README.md` - Added Matrix Federation section

## Production Checklist

- [ ] Set `APP_URL` to public domain in `.env`
- [ ] Ensure HTTPS is configured
- [ ] Test with Federation Tester
- [ ] Test with real Matrix client (Element)
- [ ] Optional: Persist signing key for stable key across restarts
- [ ] Monitor logs for any federation errors

## Future Enhancements

### Optional Improvements
1. **Keypair Persistence** - Store private key in env/database
2. **Key Rotation** - Support multiple keys with expiry
3. **Metrics** - Track federation requests
4. **Rate Limiting** - Prevent federation abuse
5. **Thumbnail Sizing** - Support Matrix thumbnail size parameters

### Not Needed (Media-Only Proxy)
- ❌ Full server-to-server federation
- ❌ Event signing
- ❌ Room joining/syncing
- ❌ User authentication via federation

## References

- [Matrix Content (MXC) URIs Spec](https://spec.matrix.org/v1.16/client-server-api/#matrix-content-mxc-uris)
- [Matrix Media Repository API](https://spec.matrix.org/v1.16/client-server-api/#content-repo)
- [Matrix Server-Server API](https://spec.matrix.org/v1.16/server-server-api/)
- [Matrix JSON Signing](https://spec.matrix.org/v1.16/appendices/#signing-json)
- [Maunium Giphy Proxy](https://github.com/maunium/stickerpicker/tree/master/giphyproxy)
