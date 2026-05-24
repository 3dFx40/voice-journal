export function toggleNoteIdSelection(selectedIds: string[], noteId: string) {
  if (selectedIds.includes(noteId)) {
    return selectedIds.filter((selectedId) => selectedId !== noteId);
  }

  return [...selectedIds, noteId];
}

export function toggleVisibleNoteSelection(selectedIds: string[], visibleIds: string[]) {
  if (getAllNoteIdsSelected(selectedIds, visibleIds)) {
    return selectedIds.filter((selectedId) => !visibleIds.includes(selectedId));
  }

  return Array.from(new Set([...selectedIds, ...visibleIds]));
}

export function removeNoteIdsFromSelection(selectedIds: string[], removedIds: string[]) {
  return selectedIds.filter((selectedId) => !removedIds.includes(selectedId));
}

export function getAllNoteIdsSelected(selectedIds: string[], visibleIds: string[]) {
  return (
    visibleIds.length > 0 &&
    visibleIds.every((visibleId) => selectedIds.includes(visibleId))
  );
}
