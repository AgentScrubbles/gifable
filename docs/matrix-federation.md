# Matrix Federation

Gifable supports Matrix federation, allowing Matrix clients (like Element, Gomuks, FluffyChat, etc.) to use GIFs from your Gifable instance using MXC URIs.

## Overview

Matrix uses MXC (Matrix Content) URIs to reference media across the federated network. These URIs follow the format:

```
mxc://<server-name>/<media-id>
```

For example: `mxc://gifs.example.com/50d66383-21a1-4943-81eb-25cda2ac2e9d`

## How It Works

1. Your Gifable instance acts as a Matrix media server
2. Public media can be referenced using MXC URIs
3. Matrix homeservers fetch media via standard Matrix endpoints
4. The same GIF used multiple times = single MXC URI (no duplicates!)
5. Homeservers cache the media and can purge it independently

## Setup

### 1. Configure Your Domain

Set your `APP_URL` in `.env` to your public domain:

```bash
APP_URL=https://gifs.example.com
```

The hostname from this URL becomes your Matrix server name.

### 2. Ensure Media is Public

Only **public** media is accessible via Matrix federation. Private media will return 404 errors to Matrix homeservers.

### 3. Test the Endpoints

Gifable automatically serves these Matrix endpoints:

**Server Discovery:**
```bash
curl https://gifs.example.com/.well-known/matrix/server
# Returns: {"m.server":"gifs.example.com:443"}
```

**Server Keys (for federation):**
```bash
curl https://gifs.example.com/_matrix/key/v2/server
# Returns: Signed public key response
```

**Media Download:**
```bash
curl https://gifs.example.com/_matrix/media/v3/download/gifs.example.com/{mediaId}
# Returns: The media file (proxied through your server with CORS headers)
```

**Thumbnail Download:**
```bash
curl https://gifs.example.com/_matrix/media/v3/thumbnail/gifs.example.com/{mediaId}
# Returns: The thumbnail file (proxied through your server with CORS headers)
```

## Usage in Code

### Generate MXC URIs

Use the helper function to generate MXC URIs for your media:

```typescript
import { getMxcUri } from "~/utils/media.server";

const mediaId = "50d66383-21a1-4943-81eb-25cda2ac2e9d";
const mxcUri = getMxcUri(mediaId);
// Returns: "mxc://gifs.example.com/50d66383-21a1-4943-81eb-25cda2ac2e9d"
```

### Convert MXC URIs to HTTP URLs

Convert MXC URIs back to HTTP URLs for display:

```typescript
import { mxcUriToHttpUrl } from "~/utils/media.server";

const mxcUri = "mxc://gifs.example.com/50d66383-21a1-4943-81eb-25cda2ac2e9d";
const httpUrl = mxcUriToHttpUrl(mxcUri);
// Returns: "https://gifs.example.com/_matrix/media/v3/download/gifs.example.com/50d66383-21a1-4943-81eb-25cda2ac2e9d"
```

## Testing with Matrix Federation Tester

You can test your instance with the Matrix Federation Tester:

1. Visit https://federationtester.matrix.org/
2. Enter your domain (e.g., `gifs.example.com`)
3. The tester will check your `.well-known` endpoint and server configuration

## Example: Using in Matrix Clients

### Element Web

You can use the MXC URIs in Matrix messages. For example, with a custom sticker picker:

```javascript
// Send a GIF as a message
const mediaId = "50d66383-21a1-4943-81eb-25cda2ac2e9d";
const mxcUri = `mxc://gifs.example.com/${mediaId}`;

// In Matrix, this will be rendered as an image
// Matrix clients will fetch it via:
// https://gifs.example.com/_matrix/media/v3/download/gifs.example.com/${mediaId}
```

### Building a Sticker Picker

Similar to [maunium-stickerpicker](https://github.com/maunium/stickerpicker), you can build a custom sticker/GIF picker that:

1. Searches your Gifable instance via the `/api/media` endpoint
2. Returns MXC URIs for selected GIFs
3. Sends them to Matrix rooms

## Performance & Caching

### Proxy Mode (Default)

Gifable proxies all media through your server (no redirects). This approach:

- ✅ **Full CORS control** - Your server controls all headers
- ✅ **No S3 CORS config needed** - Works regardless of S3 bucket settings
- ✅ **Matrix compatible** - Avoids CORS issues with redirects
- ✅ **Bandwidth monitoring** - Track all media requests
- ✅ **Future flexibility** - Can add caching, rate limiting, etc.

### Bandwidth Considerations

Since media is proxied through your server:
- Your server handles the bandwidth (not S3 directly)
- Consider adding caching middleware for frequently accessed media
- HTTP caching headers are set (`Cache-Control: public, max-age=86400`)
- Matrix homeservers will cache media on their end

### Future Optimization

For high-traffic deployments, consider:
- Adding a CDN in front of your server
- Implementing Redis/memory cache for hot media
- Using nginx proxy caching
- Monitoring bandwidth usage

## Security

- **Only public media** is accessible via Matrix federation
- Private media returns 404 errors (not 403) to avoid leaking existence
- Server name validation prevents serving media for other domains
- **CORS headers** allow cross-origin access for federation
  - All endpoints include `Access-Control-Allow-Origin: *`
  - **Important:** Even 308 redirects include CORS headers (required for browser fetch)

## Troubleshooting

### 404 Errors in Matrix Clients

**Check:**
1. Is the media marked as public? (`isPublic: true`)
2. Is your APP_URL correctly set?
3. Is the server name in the MXC URI correct?
4. Can you access the `.well-known` endpoint?

### Matrix Federation Tester Fails

**Check:**
1. Is your Gifable instance publicly accessible?
2. Is HTTPS configured correctly?
3. Is the `.well-known` endpoint returning JSON?
4. Are there any firewall or proxy issues?

### CORS Errors

If you see CORS errors in Matrix clients:

**This should not happen with the current implementation!** All media is proxied through your server with proper CORS headers.

**If you're still seeing CORS errors:**
1. Verify you're running the latest code
2. Check headers with: `curl -I https://gifs.example.com/_matrix/media/v3/thumbnail/...`
3. Look for `access-control-allow-origin: *` in the response
4. Check your reverse proxy (nginx, Cloudflare) isn't stripping CORS headers

## References

- [Matrix Content (MXC) URIs Spec](https://spec.matrix.org/latest/client-server-api/#matrix-content-mxc-uris)
- [Matrix Media Repository API](https://spec.matrix.org/latest/client-server-api/#content-repo)
- [Maunium Sticker Picker (with Giphy Proxy)](https://github.com/maunium/stickerpicker/tree/master/giphyproxy)
- [Matrix MXC Proxy Example](https://codeberg.org/austinhuang/matrix-mxc-proxy)
