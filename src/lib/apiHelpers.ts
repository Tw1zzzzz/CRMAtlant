export function extractPlayerId(playerId: string | any): string {
  if (typeof playerId === 'object' && playerId !== null) {
    if (playerId._id && typeof playerId._id === 'object' && playerId._id.toString) {
      return playerId._id.toString();
    }

    const id = playerId._id || playerId.userId || playerId.id;
    if (id) {
      return id;
    }
  }

  if (typeof playerId === 'string') {
    const objectIdMatch = playerId.match(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/);
    if (objectIdMatch?.[1]) {
      return objectIdMatch[1];
    }

    const jsonIdMatch = playerId.match(/_id['":\s]+(['"])([0-9a-fA-F]{24})(['"])/);
    if (jsonIdMatch?.[2]) {
      return jsonIdMatch[2];
    }

    if (/^[0-9a-fA-F]{24}$/.test(playerId)) {
      return playerId;
    }

    try {
      if (playerId.includes('{') && playerId.includes('}')) {
        const normalized = playerId.replace(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/g, '"$1"');
        const jsonObj = JSON.parse(normalized);
        if (jsonObj?._id) {
          return jsonObj._id;
        }
      }
    } catch (_error) {
      return playerId;
    }
  }

  return playerId;
}

export function normalizeBalanceWheelResponse(responseData: unknown): { data: unknown[] } {
  if (Array.isArray(responseData)) {
    return { data: responseData };
  }

  if (responseData && typeof responseData === 'object') {
    const payload = responseData as { data?: unknown; wheels?: unknown };
    if (Array.isArray(payload.data)) {
      return { data: payload.data };
    }

    const normalized = payload.wheels ?? payload.data ?? [responseData];
    return { data: Array.isArray(normalized) ? normalized : [normalized] };
  }

  return { data: [] };
}

export function buildTestsStateImpactPath(params?: {
  from?: string;
  to?: string;
  testType?: string;
  matchType?: string;
  map?: string;
  role?: string;
  source?: string;
}) {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);
  if (params?.testType) search.append('testType', params.testType);
  if (params?.matchType) search.append('matchType', params.matchType);
  if (params?.map) search.append('map', params.map);
  if (params?.role) search.append('role', params.role);
  if (params?.source) search.append('source', params.source);

  const query = search.toString();
  return `/stats/tests/state-impact${query ? `?${query}` : ''}`;
}

export function buildTeamReportsPath(filters?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });
  }

  const queryString = params.toString();
  return `/team-reports${queryString ? `?${queryString}` : ''}`;
}
