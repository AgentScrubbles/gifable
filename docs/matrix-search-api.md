# Matrix Media Search API

## Overview

The Matrix Media Search API allows Matrix sticker picker widgets and clients to search for GIFs from your Gifable instance. Results are returned with MXC URIs, making them ready to use in Matrix messages.

## Endpoint

```
GET /_matrix/media/search
```

## Authentication

**None required** - This is a public endpoint that only returns public media.

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | `""` | Search query - searches the labels/tags field |
| `limit` | integer | No | `20` | Maximum number of results (max: 50) |

## Response Format

```json
{
  "results": [
    {
      "id": "media-uuid",
      "mxc": "mxc://gifs.scrubbles.tech/media-uuid",
      "body": "Description or alt text",
      "info": {
        "w": 640,
        "h": 480,
        "mimetype": "image/gif",
        "size": 0
      },
      "thumbnail_mxc": "mxc://gifs.scrubbles.tech/media-uuid/thumbnail",
      "thumbnail_info": {
        "w": 640,
        "h": 480,
        "mimetype": "image/jpeg"
      },
      "tags": ["tag1", "tag2", "tag3"],
      "http_url": "https://gifs.scrubbles.tech/_matrix/media/v3/download/gifs.scrubbles.tech/media-uuid",
      "thumbnail_url": "https://gifs.scrubbles.tech/_matrix/media/v3/thumbnail/gifs.scrubbles.tech/media-uuid"
    }
  ],
  "count": 1,
  "query": "cat"
}
```

## Response Fields

### Result Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Gifable media UUID |
| `mxc` | string | MXC URI for the media (use in Matrix messages) |
| `body` | string | Description/alt text for the media |
| `info` | object | Image metadata |
| `info.w` | integer | Image width in pixels |
| `info.h` | integer | Image height in pixels |
| `info.mimetype` | string | MIME type (typically `image/gif`) |
| `info.size` | integer | File size in bytes (currently always 0) |
| `thumbnail_mxc` | string | MXC URI for the thumbnail |
| `thumbnail_info` | object | Thumbnail metadata |
| `tags` | array | Array of tags/labels for the media |
| `http_url` | string | HTTP URL for direct download (for clients without MXC support) |
| `thumbnail_url` | string | HTTP URL for thumbnail |

### Top-Level Response

| Field | Type | Description |
|-------|------|-------------|
| `results` | array | Array of result objects |
| `count` | integer | Number of results returned |
| `query` | string | The search query that was executed |

## Examples

### Search for cat GIFs

```bash
curl "https://gifs.scrubbles.tech/_matrix/media/search?q=cat&limit=5"
```

### Get recent GIFs (no query)

```bash
curl "https://gifs.scrubbles.tech/_matrix/media/search?limit=10"
```

### Use in JavaScript

```javascript
async function searchGifs(query, limit = 20) {
  const response = await fetch(
    `https://gifs.scrubbles.tech/_matrix/media/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  const data = await response.json();
  return data.results;
}

// Search for "happy" GIFs
const results = await searchGifs("happy", 10);

// Use the first result in a Matrix message
const firstGif = results[0];
console.log("MXC URI:", firstGif.mxc);
console.log("Tags:", firstGif.tags);
```

## Using with Matrix Sticker Pickers

### Integration with maunium-stickerpicker

The response format is compatible with Matrix sticker picker widgets. To integrate with your custom sticker picker:

1. **Configure the endpoint URL:**
   ```
   https://gifs.scrubbles.tech/_matrix/media/search
   ```

2. **Map the response to your picker:**
   ```javascript
   const results = data.results.map(item => ({
     mxc: item.mxc,
     body: item.body,
     w: item.info.w,
     h: item.info.h,
     tags: item.tags
   }));
   ```

3. **Send to Matrix room:**
   ```javascript
   await matrixClient.sendEvent(roomId, "m.sticker", {
     body: result.body,
     url: result.mxc,
     info: result.info
   });
   ```

### Custom Widget Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Gifable Sticker Picker</title>
</head>
<body>
  <input type="text" id="search" placeholder="Search GIFs...">
  <div id="results"></div>

  <script>
    const GIFABLE_URL = 'https://gifs.scrubbles.tech';

    document.getElementById('search').addEventListener('input', async (e) => {
      const query = e.target.value;
      const response = await fetch(
        `${GIFABLE_URL}/_matrix/media/search?q=${encodeURIComponent(query)}&limit=20`
      );
      const data = await response.json();

      // Display results
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = data.results.map(gif => `
        <img
          src="${gif.thumbnail_url}"
          alt="${gif.body}"
          data-mxc="${gif.mxc}"
          onclick="sendGif('${gif.mxc}', '${gif.body}', ${gif.info.w}, ${gif.info.h})"
        >
      `).join('');
    });

    function sendGif(mxc, body, width, height) {
      // Send to Matrix (using Matrix widget API)
      window.parent.postMessage({
        api: "fromWidget",
        action: "send_event",
        data: {
          type: "m.sticker",
          content: {
            body: body,
            url: mxc,
            info: {
              w: width,
              h: height,
              mimetype: "image/gif"
            }
          }
        }
      }, "*");
    }
  </script>
</body>
</html>
```

## CORS Support

The endpoint includes CORS headers to allow cross-origin requests:

```
Access-Control-Allow-Origin: *
```

This allows Matrix clients and widgets hosted on different domains to access the API.

## Caching

Responses are cached for 60 seconds:

```
Cache-Control: public, max-age=60
```

## Privacy & Security

- **Public Media Only:** Only media marked as `isPublic: true` is returned
- **No Authentication:** No API tokens or credentials are required
- **No Rate Limiting:** Currently no rate limiting (consider adding in production)

## Performance Considerations

### Recommended Practices

1. **Set appropriate limits:** Don't request more results than needed
   ```
   ?q=cat&limit=10  ✅ Good
   ?q=cat&limit=50  ⚠️ Use sparingly
   ```

2. **Implement client-side caching:** Cache results in your picker widget
   ```javascript
   const cache = new Map();

   async function searchGifs(query) {
     if (cache.has(query)) {
       return cache.get(query);
     }
     const response = await fetch(`...?q=${query}`);
     const data = await response.json();
     cache.set(query, data.results);
     return data.results;
   }
   ```

3. **Debounce search queries:** Wait for user to stop typing
   ```javascript
   let searchTimeout;
   input.addEventListener('input', (e) => {
     clearTimeout(searchTimeout);
     searchTimeout = setTimeout(() => searchGifs(e.target.value), 300);
   });
   ```

## Comparison with Giphy/Tenor APIs

Unlike Giphy or Tenor APIs, this endpoint:

✅ **Returns MXC URIs** - Ready to use in Matrix without conversion
✅ **No API key required** - Public endpoint, no authentication
✅ **Self-hosted** - You control the data and privacy
✅ **Direct S3 access** - Media served via 308 redirects to S3
✅ **Federation-native** - Works seamlessly with Matrix homeservers

## Error Responses

The API uses standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error

## Future Enhancements

Potential improvements for future versions:

- [ ] Add pagination support (offset/page parameters)
- [ ] Add sorting options (relevance, date, popularity)
- [ ] Add category/tag filtering
- [ ] Add faceted search (filter by width, height, etc.)
- [ ] Add autocomplete for tags
- [ ] Add usage analytics (popular searches)
- [ ] Add rate limiting
- [ ] Add file size information
- [ ] Support for animated stickers (APNG, WebP)

## Support

For issues or questions:
- GitHub: [pietvanzoen/gifable](https://github.com/pietvanzoen/gifable)
- Matrix: Use this API to find the perfect GIF for your question! 😉
