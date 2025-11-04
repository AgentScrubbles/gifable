import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import type { ApiKey } from "@prisma/client";
import { copyToClipboard } from "~/utils/helpers.client";
import { useToast } from "./Toast";

type APIKeysManagerProps = {
  initialApiKeys: ApiKey[];
};

export function APIKeysManager({ initialApiKeys }: APIKeysManagerProps) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const createFetcher = useFetcher();
  const revokeFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const toast = useToast();

  // Update local state when fetcher returns
  useEffect(() => {
    if (createFetcher.data?.success && createFetcher.data?.apiKey) {
      const newKey = createFetcher.data.apiKey;
      setApiKeys((prev) => [newKey, ...prev]);
      setShowNewKey(newKey.key);
      // Auto-hide the key after 30 seconds for security
      setTimeout(() => setShowNewKey(null), 30000);
    }
  }, [createFetcher.data]);

  useEffect(() => {
    if (revokeFetcher.data?.success && revokeFetcher.data?.apiKey) {
      const updated = revokeFetcher.data.apiKey;
      setApiKeys((prev) =>
        prev.map((key) => (key.id === updated.id ? updated : key))
      );
    }
  }, [revokeFetcher.data]);

  useEffect(() => {
    if (deleteFetcher.data?.success && deleteFetcher.state === "idle") {
      // Remove the deleted key from the list
      const formData = deleteFetcher.formData;
      const deletedId = formData?.get("id");
      if (deletedId) {
        setApiKeys((prev) => prev.filter((key) => key.id !== deletedId));
      }
    }
  }, [deleteFetcher.data, deleteFetcher.state, deleteFetcher.formData]);

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <fieldset>
      <legend>
        <h3>API Keys</h3>
      </legend>

      <p>
        Create API keys to access your media programmatically. Use them in the{" "}
        <code>Authorization: Bearer &lt;key&gt;</code> header or{" "}
        <code>X-Api-Key: &lt;key&gt;</code> header.
      </p>

      {/* Create New Key Form */}
      <createFetcher.Form method="post" action="/api/api-keys">
        <input type="hidden" name="intent" value="create" />
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="api-key-name">
            Key Name
            <input
              type="text"
              id="api-key-name"
              name="name"
              placeholder="e.g., Mobile App, CI/CD, Desktop Client"
              required
              maxLength={100}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={createFetcher.state !== "idle"}
        >
          {createFetcher.state !== "idle" ? "Creating..." : "Create New API Key"}
        </button>
      </createFetcher.Form>

      {/* Show newly created key */}
      {showNewKey && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
          }}
        >
          <strong>⚠️ Important: Copy your API key now!</strong>
          <p style={{ margin: "0.5rem 0" }}>
            This key will only be shown once. Store it in a secure location.
          </p>
          <pre
            style={{
              padding: "0.5rem",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              overflowX: "auto",
              wordBreak: "break-all",
            }}
          >
            <code>{showNewKey}</code>
          </pre>
          <button
            onClick={() => {
              copyToClipboard(showNewKey, () => toast("API key copied!"));
            }}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={() => setShowNewKey(null)}
            style={{ marginLeft: "0.5rem" }}
          >
            I've saved it, hide this
          </button>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys.length > 0 ? (
        <div style={{ marginTop: "2rem" }}>
          <h4>Your API Keys</h4>
          <table style={{ width: "100%", marginTop: "1rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left" }}>Key Preview</th>
                <th style={{ textAlign: "left" }}>Created</th>
                <th style={{ textAlign: "left" }}>Last Used</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <code>{key.key.substring(0, 12)}...{key.key.slice(-4)}</code>
                  </td>
                  <td>{formatDate(key.createdAt)}</td>
                  <td>{formatDate(key.lastUsedAt)}</td>
                  <td>
                    {key.enabled ? (
                      <span style={{ color: "green" }}>Active</span>
                    ) : (
                      <span style={{ color: "red" }}>Revoked</span>
                    )}
                  </td>
                  <td>
                    {key.enabled ? (
                      <revokeFetcher.Form
                        method="post"
                        action="/api/api-keys"
                        style={{ display: "inline" }}
                      >
                        <input type="hidden" name="intent" value="revoke" />
                        <input type="hidden" name="id" value={key.id} />
                        <button
                          type="submit"
                          disabled={revokeFetcher.state !== "idle"}
                          style={{
                            background: "#dc3545",
                            color: "white",
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.875rem",
                          }}
                          onClick={(e) => {
                            if (
                              !confirm(
                                "Are you sure you want to revoke this API key? This action cannot be undone."
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Revoke
                        </button>
                      </revokeFetcher.Form>
                    ) : null}
                    {" "}
                    <deleteFetcher.Form
                      method="post"
                      action="/api/api-keys"
                      style={{ display: "inline" }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={key.id} />
                      <button
                        type="submit"
                        disabled={deleteFetcher.state !== "idle"}
                        style={{
                          background: "#6c757d",
                          color: "white",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={(e) => {
                          if (
                            !confirm(
                              "Are you sure you want to permanently delete this API key?"
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </deleteFetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: "1rem", color: "#666" }}>
          You don't have any API keys yet. Create one above to get started.
        </p>
      )}

      {/* API Documentation */}
      <details style={{ marginTop: "2rem" }}>
        <summary>
          <strong>API Usage Documentation</strong>
        </summary>
        <div style={{ marginTop: "1rem" }}>
          <h5>Endpoints</h5>
          <ul>
            <li>
              <code>GET /api/media</code> - Search your media. Use the{" "}
              <code>search</code> query parameter to filter by labels.
            </li>
          </ul>

          <h5>Authentication</h5>
          <p>Include your API key in the request headers using one of these methods:</p>
          <pre style={{ background: "#f5f5f5", padding: "0.5rem" }}>
            <code>Authorization: Bearer gbl_your_key_here</code>
          </pre>
          <p>Or:</p>
          <pre style={{ background: "#f5f5f5", padding: "0.5rem" }}>
            <code>X-Api-Key: gbl_your_key_here</code>
          </pre>

          <h5>Example Request</h5>
          <pre style={{ background: "#f5f5f5", padding: "0.5rem" }}>
            <code>
              {`curl -H "Authorization: Bearer gbl_your_key_here" \\
  "https://your-domain.com/api/media?search=cat"`}
            </code>
          </pre>
        </div>
      </details>
    </fieldset>
  );
}
