import { apiRequest } from './apiClient';
import type { Note } from './types';

// POST /sample_db/create-note
export const createNote = async (
  accessToken: string,
  note: Note,
): Promise<void> => {
  await apiRequest('/sample_db/create-note', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(note),
  });
};

// GET /sample_db/notes
export const listNotes = async (accessToken: string): Promise<Note[]> => {
  const { data } = await apiRequest<Note[]>('/sample_db/notes', {
    accessToken,
  });
  return data;
};
