import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { copyToClipboard } from "~/utils/helpers.client";
import { useToast } from "./Toast";
import { formatDate } from "~/utils/format";

type ApiKey = {
  id: string;
  name: string | null;
  key: string;
  enabled: boolean;
  createdAt: string | Date;
  lastUsedAt: string | Date | null;
};

type ApiKeysResponse = {
  keys: ApiKey[];
};

export function ApiKeyManagement() {
  const fetcher = useFetcher<ApiKeysResponse>();
  const actionFetcher = useFetcher<{ success?: boolean; key?: ApiKey; message?: string }>();
  const toast = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

  // Load API keys on mount
  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/api/api-keys");
    }
  }, [fetcher]);

  // Show toast when action completes
  useEffect(() => {
    if (actionFetcher.data?.success) {
      toast(actionFetcher.data.message || "Action completed successfully");

      // If a new key was created, reveal it and store temporarily
      if (actionFetcher.data.key) {
        setJustCreatedKey(actionFetcher.data.key.key);
        setRevealedKeys(new Set([actionFetcher.data.key.id]));
        setNewKeyName("");
      }

      // Reload the list
      fetcher.load("/api/api-keys");
    }
  }, [actionFetcher.data]);

  const keys = fetcher.data?.keys || [];

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("action", "create");
    if (newKeyName.trim()) {
      formData.append("name", newKeyName.trim());
    }
    actionFetcher.submit(formData, { method: "post", action: "/api/api-keys" });
  };

  const handleToggleKey = (keyId: string, currentlyEnabled: boolean) => {
    const formData = new FormData();
    formData.append("action", currentlyEnabled ? "disable" : "enable");
    formData.append("keyId", keyId);
    actionFetcher.submit(formData, { method: "post", action: "/api/api-keys" });
  };

  const handleDeleteKey = (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }
    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("keyId", keyId);
    actionFetcher.submit(formData, { method: "post", action: "/api/api-keys" });

    // Clear just created key if it's being deleted
    if (justCreatedKey && keys.find(k => k.id === keyId)?.key === justCreatedKey) {
      setJustCreatedKey(null);
    }
  };

  const toggleRevealKey = (keyId: string) => {
    setRevealedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const handleCopyKey = (key: string) => {
    copyToClipboard(key, () => toast("API key copied to clipboard"));
  };

  return (
    <fieldset>
      <legend>
        <h3>API Keys</h3>
      </legend>

      <p>
        API keys allow you to authenticate to the search endpoint without logging in.
        Use the header <code>Authorization: Bearer YOUR_KEY</code> or <code>X-Api-Key: YOUR_KEY</code>.
      </p>

      {/* Create new key form */}
      <form onSubmit={handleCreateKey} style={{ marginBottom: "1rem" }}>
        <label htmlFor="keyName">
          Key Name (optional)
          <input
            id="keyName"
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g., Mobile App, CI/CD Pipeline"
            maxLength={100}
          />
        </label>
        <button
          type="submit"
          disabled={actionFetcher.state !== "idle"}
        >
          {actionFetcher.state !== "idle" ? "Creating..." : "Create New API Key"}
        </button>
      </form>

      {/* Show newly created key prominently */}
      {justCreatedKey && (
        <div className="notice" style={{ background: "#fff3cd", borderColor: "#ffc107", padding: "1rem", marginBottom: "1rem" }}>
          <strong>⚠️ Save this key now!</strong> You won't be able to see it again.
          <pre style={{ marginTop: "0.5rem", background: "#fff", padding: "0.5rem", border: "1px solid #ddd" }}>
            <code>{justCreatedKey}</code>
          </pre>
          <button onClick={() => handleCopyKey(justCreatedKey)} style={{ marginTop: "0.5rem" }}>
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* API keys list */}
      {fetcher.state === "loading" && !fetcher.data ? (
        <p>Loading API keys...</p>
      ) : keys.length === 0 ? (
        <div className="notice">
          You don't have any API keys yet. Create one above to get started.
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <h4>Your API Keys ({keys.length})</h4>
          {keys.map((key) => (
            <div
              key={key.id}
              style={{
                border: "1px solid #ddd",
                padding: "1rem",
                marginBottom: "0.5rem",
                borderRadius: "4px",
                background: key.enabled ? "#fff" : "#f5f5f5",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <strong>{key.name || "Unnamed Key"}</strong>
                  {!key.enabled && <span style={{ color: "#999", marginLeft: "0.5rem" }}>(Disabled)</span>}
                  <br />
                  <small style={{ color: "#666" }}>
                    Created: {formatDate(new Date(key.createdAt))}
                    {key.lastUsedAt && (
                      <> • Last used: {formatDate(new Date(key.lastUsedAt))}</>
                    )}
                  </small>
                  <div style={{ marginTop: "0.5rem" }}>
                    {revealedKeys.has(key.id) ? (
                      <>
                        <code style={{ fontSize: "0.85rem" }}>{key.key}</code>
                        <br />
                        <button
                          type="button"
                          onClick={() => toggleRevealKey(key.id)}
                          style={{ fontSize: "0.85rem", marginTop: "0.25rem", marginRight: "0.5rem" }}
                        >
                          Hide
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(key.key)}
                          style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}
                        >
                          Copy
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleRevealKey(key.id)}
                        style={{ fontSize: "0.85rem" }}
                      >
                        Reveal Key
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                  <button
                    type="button"
                    onClick={() => handleToggleKey(key.id, key.enabled)}
                    disabled={actionFetcher.state !== "idle"}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {key.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={actionFetcher.state !== "idle"}
                    style={{ fontSize: "0.85rem", background: "#dc3545", color: "white" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
