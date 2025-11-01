# Matrix Federation Port Configuration

## Port 8448 vs Port 443

Matrix federation uses **port 8448** by default, but Gifable is configured to use **port 443** (standard HTTPS) instead.

## How It Works

1. **Matrix homeservers** see an MXC URI like `mxc://gifs.example.com/abc123`
2. They request `https://gifs.example.com/.well-known/matrix/server`
3. Our server responds: `{"m.server": "gifs.example.com:443"}`
4. The homeserver connects to port **443** instead of 8448

## Do You Need Port 8448 Open?

**No!** You do NOT need port 8448 open. Everything works on port 443 (standard HTTPS).

## Production Setup

### Option 1: Standard HTTPS (Port 443) - RECOMMENDED

This is what Gifable is configured for:

```bash
# In your .env
APP_URL=https://gifs.example.com  # Port 443 is implied
```

Your reverse proxy (nginx, Cloudflare, etc.) handles HTTPS on port 443, and everything works.

### Option 2: Custom Port (Advanced)

If you're running on a non-standard port:

```bash
# In your .env
APP_URL=https://gifs.example.com:8448
```

Update the `.well-known` endpoint to reflect this (modify `app/routes/.well-known.matrix.server.tsx`).

## Reverse Proxy Configuration

### Nginx

Make sure your nginx config proxies these paths:

```nginx
server {
    listen 443 ssl;
    server_name gifs.example.com;

    # Matrix federation endpoints
    location /.well-known/matrix/server {
        proxy_pass http://localhost:3000;
        add_header Access-Control-Allow-Origin *;
    }

    location /_matrix/ {
        proxy_pass http://localhost:3000;
        add_header Access-Control-Allow-Origin *;
    }

    # Regular Gifable routes
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Cloudflare

If you're using Cloudflare:

1. **SSL/TLS Mode**: Set to "Full" or "Full (Strict)"
2. **Port Forwarding**: Cloudflare proxies port 443 by default
3. **Firewall Rules**: Make sure Matrix endpoints aren't blocked

## Testing

### Test 1: Check .well-known is accessible

```bash
curl https://gifs.example.com/.well-known/matrix/server
```

**Expected:**
```json
{"m.server":"gifs.example.com:443"}
```

### Test 2: Check Matrix endpoints are accessible

```bash
curl https://gifs.example.com/_matrix/key/v2/server
curl https://gifs.example.com/_matrix/federation/v1/version
```

### Test 3: Check media download works

```bash
curl -I https://gifs.example.com/_matrix/media/v3/download/gifs.example.com/YOUR_MEDIA_ID
```

## Common Issues

### "Connection refused" on port 8448

**Solution:** You don't need port 8448. Make sure your `.well-known` endpoint is working and returning port 443.

### Federation Tester fails

The **Matrix Federation Tester** (https://federationtester.matrix.org/) is designed for **full homeservers**, not media-only proxies. It will try to test server-to-server federation APIs.

For a media-only server:
- ✅ You CAN test with actual Matrix homeservers/clients
- ❌ You might NOT pass the full federation tester (that's OK!)

**Better test:** Try using the MXC URI in a real Matrix client (Element, Gomuks) and see if the image loads.

### Cloudflare shows errors

If behind Cloudflare, the IPs you see (104.21.x.x, 172.67.x.x) are Cloudflare's edge servers, not your origin server. This is normal.

Make sure:
1. SSL/TLS is set to "Full" or "Full (Strict)"
2. Your origin server is accessible from Cloudflare
3. Cloudflare isn't blocking `/_matrix/*` paths

## Alternative: Port 8448 Setup (Not Recommended)

If you really want to use port 8448:

1. **Open port 8448** in your firewall
2. **Run Gifable on port 8448** (or proxy to it)
3. **Update `.well-known`**:
   ```typescript
   "m.server": `${serverName}:8448`
   ```

But this is unnecessary - port 443 works fine and is simpler!

## Summary

- ✅ Port 443 (standard HTTPS) - Recommended, works out of the box
- ❌ Port 8448 - Not needed for Gifable media federation
- ✅ `.well-known/matrix/server` tells Matrix to use port 443
- ✅ All Matrix media endpoints work on port 443
