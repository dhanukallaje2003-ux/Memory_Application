export type MemoryRecord = {
  id: string;
  content: string;
  mood: string;
  createdAt: string;
};

export type MoodEntry = {
  id: string;
  mood: string;
  intensity: number;
  entryDate: string;
  createdAt: string;
};

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type DocumentationExport = {
  fileName: string;
  mimeType: string;
  blob: Blob;
};

const API_BASE_URL = "http://localhost:3001";

function clearStoredAuth() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

async function fetchWithAuth(path: string, init?: RequestInit, allowRefresh = true): Promise<Response> {
  const token = localStorage.getItem('accessToken');
  const isAuthRefreshRequest = path === "/api/auth/refresh";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if ((response.status === 401 || response.status === 403) && allowRefresh && !isAuthRefreshRequest) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          localStorage.setItem('accessToken', refreshData.accessToken);
          localStorage.setItem('refreshToken', refreshData.refreshToken);
          return fetchWithAuth(path, init, false);
        }
      } catch (error) {
        // Ignore here and fall through to the normal error path below.
      }
    }

    clearStoredAuth();
  }

  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(path, init);

  if (!response.ok) {
    let message = "Something went wrong while talking to the server.";

    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        message = data.error;
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (payload: { email: string; password: string }) =>
    request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  getCurrentUser: () =>
    request<{ user: AuthUser }>("/api/auth/me"),
  getMemories: () => request<MemoryRecord[]>("/api/memories"),
  createMemory: (payload: { content: string; mood: string }) =>
    request<MemoryRecord>("/api/memories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMoods: (days = 7) => request<MoodEntry[]>(`/api/moods?days=${days}`),
  saveMood: (payload: { mood: string; intensity: number; entryDate: string }) =>
    request<MoodEntry>("/api/moods", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getChatMessages: () => request<ChatMessageRecord[]>("/api/chat/messages"),
  sendChatMessage: (payload: { content: string }) =>
    request<{ userMessage: ChatMessageRecord; assistantMessage: ChatMessageRecord }>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  exportDocumentation: async (payload: { fromDate: string; toDate: string; label: string }): Promise<DocumentationExport> => {
    const response = await fetchWithAuth("/api/documentation/export", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Something went wrong while generating the PDF.";

      try {
        const data = await response.json();
        if (typeof data?.error === "string") {
          message = data.error;
        }
      } catch {
        // Keep fallback message.
      }

      throw new Error(message);
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const fileNameMatch = disposition.match(/filename="([^"]+)"/);

    return {
      fileName: fileNameMatch?.[1] || "memory-dump-documentation.pdf",
      mimeType: response.headers.get("Content-Type") || "application/pdf",
      blob: await response.blob(),
    };
  },
};
