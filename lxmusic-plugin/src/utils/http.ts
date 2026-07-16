export async function callHostAPI(path: string, options: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Promise<unknown> {
  const hostUrl = await songloft.plugin.getHostUrl();
  const token = await songloft.plugin.getToken();
  
  const url = hostUrl + path;
  
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, fetchOptions);
  return response.json();
}

export async function importSongToLibrary(song: {
  title: string;
  artist: string;
  album: string;
  cover_url: string;
  duration: number;
  source_data: unknown;
  lyric?: string;
  lyric_source?: string;
}): Promise<unknown> {
  const dedupKey = generateDedupKey(song.source_data as Record<string, unknown>);
  
  return callHostAPI('/api/v1/songs/remote', {
    method: 'POST',
    body: {
      title: song.title,
      artist: song.artist,
      album: song.album,
      cover_url: song.cover_url,
      duration: song.duration,
      plugin_entry_path: 'lxmusic',
      source_data: JSON.stringify(song.source_data),
      dedup_key: dedupKey,
      lyric: song.lyric,
      lyric_source: song.lyric_source || 'url',
    },
  });
}

function generateDedupKey(sourceData: Record<string, unknown>): string {
  const songInfo = sourceData.songInfo as Record<string, unknown>;
  const platform = sourceData.platform as string;
  
  if (songInfo) {
    if (songInfo.songmid) return `${platform}:${songInfo.songmid}`;
    if (songInfo.musicId) return `${platform}:${songInfo.musicId}`;
    if (songInfo.hash) return `${platform}:${songInfo.hash}`;
    if (songInfo.copyrightId) return `${platform}:${songInfo.copyrightId}`;
  }
  
  return '';
}

export async function createPlaylist(name: string, description?: string): Promise<unknown> {
  return callHostAPI('/api/v1/playlists', {
    method: 'POST',
    body: {
      name,
      description,
    },
  });
}

export async function addSongToPlaylist(playlistId: string, songId: string): Promise<unknown> {
  return callHostAPI(`/api/v1/playlists/${playlistId}/songs`, {
    method: 'POST',
    body: {
      song_id: songId,
    },
  });
}
